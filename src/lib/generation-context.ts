/**
 * Contexto único de geração do Studio.
 * A interface envia apenas IDs; o servidor reconstrói este objeto do zero a
 * cada geração, valida e só então monta o prompt final em blocos.
 */

import { buildMotionScript } from "@/lib/flow-motion-templates";
import { autoScenario, objectiveByValue, productInteractionPlan, scenarioByValue, videoContinuityPlan } from "@/lib/flow-studio";

export type GenerationInfluencer = {
  id: string;
  name: string;
  imageUrl: string | null;
  referenceImages: string[];
  description: string;
};

export type GenerationProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  referenceImages: string[];
  category: string;
  description: string;
};

export type GenerationContentType = {
  id: string;
  name: string;
  objective: string;
  behavior: string;
  requiredActions: string;
  camera: string;
  framing: string;
};

export type GenerationScenario = {
  id: string;
  name: string;
  environment: string;
  resolvedFrom: "user" | "custom" | "auto";
};

export type GenerationContext = {
  influencer: GenerationInfluencer;
  product: GenerationProduct;
  contentType: GenerationContentType;
  scenario: GenerationScenario;
  variation: number;
};

/** Comportamento obrigatório de cada tipo de conteúdo (não é apenas um rótulo). */
const CONTENT_BEHAVIOR: Record<string, { behavior: string; requiredActions: string }> = {
  mostrar: {
    behavior:
      "Product-hero presentation: the selected product is the main focus and stays fully readable in frame; commercial, simple composition.",
    requiredActions:
      "The influencer presents the selected product toward the camera with a stable grip. No complex or invented usage.",
  },
  usando: {
    behavior:
      "Real lifestyle usage: the influencer genuinely wears or uses the selected product with coherent physical interaction.",
    requiredActions:
      "The influencer is already wearing/using the product and performs one natural, physically plausible movement while the product stays identical.",
  },
  review: {
    behavior:
      "Review: the influencer speaks to the camera with evaluative body language while the product remains clearly present.",
    requiredActions:
      "The influencer holds the product near chest level, faces the lens and shows natural speaking micro-expressions.",
  },
  unboxing: {
    behavior:
      "Unboxing: the product starts closed inside its packaging and is opened in a coherent visual sequence.",
    requiredActions:
      "Packaging is visible from the first frame and never disappears; the influencer opens it with visible continuous hand motion and reveals the same product.",
  },
  "antes-depois": {
    behavior:
      "Before-and-after transformation: a clear initial state and a clear final state, with the same person and same product.",
    requiredActions:
      "One logical continuous transition between the two states; identity, environment and product stay the same across both.",
  },
  "em-uso": {
    behavior:
      "Practical demonstration: the product is shown working in a plausible, realistic way.",
    requiredActions:
      "The influencer performs one realistic step of usage; the product keeps its shape, scale and function coherent.",
  },
  venda: {
    behavior:
      "Conversion-oriented composition: the product is highlighted and the influencer presents a benefit with commercial body language.",
    requiredActions:
      "The influencer raises the product toward the camera and finishes looking at the lens with an inviting expression.",
  },
  pov: {
    behavior:
      "Point of view: the camera represents the viewer's own eyes; no posed model framing.",
    requiredActions:
      "Only the influencer's hands and forearms are visible interacting with the product from a first-person perspective.",
  },
};

export function contentTypeFor(value: string): GenerationContentType {
  const obj = objectiveByValue(value);
  const map = CONTENT_BEHAVIOR[obj.value] ?? CONTENT_BEHAVIOR['mostrar']!;
  return {
    id: obj.value,
    name: obj.label,
    objective: obj.strategy,
    behavior: map.behavior,
    requiredActions: `${map.requiredActions} ${obj.action}`,
    camera: obj.camera,
    framing: obj.framing,
  };
}

export function scenarioFor(value: string, custom: string, objective: string, category: string): GenerationScenario {
  const sc = scenarioByValue(value);
  if (value === "auto")
    return { id: "auto", name: "Automático", environment: autoScenario(objective, category), resolvedFrom: "auto" };
  if (value === "outro") {
    const text = custom.trim();
    return {
      id: "outro",
      name: "Outro cenário",
      environment: text || autoScenario(objective, category),
      resolvedFrom: text ? "custom" : "auto",
    };
  }
  return { id: sc.value, name: sc.label, environment: sc.prompt, resolvedFrom: "user" };
}

/** Mensagens em português para o usuário; nunca gerar com contexto incompleto. */
export function validateGenerationContext(ctx: GenerationContext): string[] {
  const errors: string[] = [];
  if (!ctx.influencer?.id) errors.push("Selecione uma influenciadora antes de gerar.");
  if (!ctx.influencer?.imageUrl)
    errors.push("Não foi possível gerar a cena porque a referência visual da influenciadora não foi encontrada.");
  if (!ctx.product?.id) errors.push("Selecione um produto antes de gerar.");
  if (!ctx.product?.imageUrl)
    errors.push("Não foi possível gerar a cena porque a referência visual do produto não foi encontrada.");
  if (!ctx.contentType?.id) errors.push("Selecione o tipo de conteúdo antes de gerar.");
  if (!ctx.scenario?.environment) errors.push("Selecione um cenário antes de gerar.");
  return errors;
}

const ANTI_BUGS = [
  "extra, missing or fused fingers",
  "malformed hands or duplicated limbs",
  "distorted face or changing facial identity",
  "changing body proportions",
  "floating, disappearing or duplicated objects",
  "morphing, deformed or wrongly scaled product",
  "impossible interactions or objects passing through hands",
  "clothing deformation",
  "unstable logos, unreadable labels or random text",
  "random people, accessories or products",
  "background changes and lighting inconsistencies",
  "camera teleportation, unnatural movement, sudden position changes, temporal discontinuity",
].join(", ");

const NEGATIVE_BLOCK = [
  "Do not replace, swap or reinvent the selected influencer or the selected product.",
  "Do not use another person, another influencer, another product or an unrelated extra product.",
  "Do not invent packaging, labels, typography or product characteristics; do not change product colors, shape, scale or logo.",
  "Do not remove or duplicate the product, and do not change the selected scenario or ignore the selected content type.",
  "Do not alter facial features, body proportions, clothing or hairstyle without an explicit described transition.",
  "Do not create random actions, impossible interactions, unnatural movement or temporal discontinuity.",
  "No watermark, no on-screen text overlays, no plastic skin, no AI artifacts.",
].join("\n");

/** Prompt da imagem (primeiro frame), em blocos, 100% derivado do contexto. */
export function buildImagePrompt(ctx: GenerationContext): string {
  const { influencer, product, contentType, scenario } = ctx;
  const interaction = productInteractionPlan(product.name, product.category);

  return [
    "[GENERATION_CONTEXT]",
    `Create ONE photorealistic vertical (9:16) first frame for a short-form affiliate video (UGC style), built strictly from the four selections below: influencer "${influencer.name}", product "${product.name}", content type "${contentType.name}", scenario "${scenario.name}".`,
    "",
    "[INFLUENCER_REFERENCE]",
    `Reference image 1${influencer.referenceImages.length > 1 ? ` and the following ${influencer.referenceImages.length - 1} influencer reference(s)` : ""} show the SAME single person: "${influencer.name}". They define the person only — ignore any object, product or background in them.`,
    influencer.description ? `Character DNA: ${influencer.description}.` : "",
    "[INFLUENCER_IDENTITY_LOCK] Preserve facial structure, face shape, eyes, nose, lips, eyebrows, skin tone, hair color, hair length, hairstyle, body proportions and overall appearance. Do not replace the person with a generic model, do not create a different person, do not blend her with another reference person, and generate no second human in the scene.",
    "",
    "[PRODUCT_REFERENCE]",
    `The product reference image(s) are the authoritative visual source for "${product.name}"${product.category ? ` (${product.category})` : ""}. All product references show the SAME single product from different angles or details — never treat them as different products. If a product photo contains a model, hands, room or background, ignore them completely and never copy that person.`,
    product.description ? `Product details: ${product.description}.` : "",
    `[PRODUCT_IDENTITY_LOCK] Reproduce one single product preserving shape, proportions, colors, materials, texture, packaging, labels, logos, typography and distinctive details. ${interaction.lock} Never redesign it, never replace it with a generic version and never invent writing; if tiny text cannot be reproduced, keep it visually neutral.`,
    interaction.kind === "clothing"
      ? "[GARMENT_FIDELITY] The garment must be an exact photographic match to the product reference, as if the real piece were photographed on this person: identical print artwork, pattern scale, motif placement and repeat direction, identical colorway and saturation, identical neckline, shoulder line, sleeve type and length, waist, closure, buttons, zippers, ties, cuffs, hem length and slits, identical fabric weight, drape, sheen, transparency and texture, identical trims, lace, ruffles, embroidery and stitching. Fit the garment to her real body with correct size, natural wrinkles, seam alignment and contact shadows. Never restyle, simplify, redesign, recolor, mirror the print, crop the length, add or remove sleeves, straps or details, and never blend it with another garment. Any clothing not part of the product stays neutral and does not cover the product."
      : "",
    interaction.kind === "clothing" || interaction.kind === "footwear"
      ? `[WEAR_MODE_LOCK] MANDATORY: the product is a wearable item, so "${influencer.name}" must be WEARING it on her body in the final image — dressed and fitted exactly as the real piece would be worn. It is strictly forbidden to show her holding it up, hanging it, stretching it between her hands, displaying it in front of her torso, presenting it on a hanger, mannequin, table, bed or floor, or showing it separated from her body in any way. Both hands stay free and away from the garment; the garment is worn, never presented.`
      : "",
    "",
    "[CONTENT_TYPE]",
    `${contentType.name} — ${contentType.behavior}`,
    `Required behavior: ${
      interaction.kind === "clothing" || interaction.kind === "footwear"
        ? `${contentType.requiredActions} Whatever the content type, the wearable product is worn on her body — never held, hung or presented.`
        : contentType.requiredActions
    }`,

    "",
    "[SCENARIO]",
    `${scenario.name}: ${scenario.environment}. This environment is mandatory and must not be substituted by another location.`,
    "",
    "[CAMERA]",
    `${contentType.camera.replace(/orbit|transition|whip pan/gi, "very subtle push-in")}. Framing: ${contentType.framing}. Stable perspective, no wide-angle distortion, no extreme foreshortening, depth of field that keeps the product sharp.`,
    "",
    "[ACTION]",
    `${influencer.name} is in the selected environment performing the described content-type action with the selected product. ${interaction.stillAction}`,
    "",
    "[PRODUCT_INTERACTION]",
    `${interaction.contact} ${interaction.framing}`,
    "",
    "[PHYSICS_AND_REALISM]",
    "Natural realistic skin with pores, real ambient light, correct contact shadows, plausible weight and support for every object, authentic smartphone-UGC feel, cinematic color grading.",
    "",
    "[ANTI_GENERATION_BUGS]",
    `Prevent: ${ANTI_BUGS}.`,
    "",
    "[NEGATIVE_CONSTRAINTS]",
    NEGATIVE_BLOCK,
    ctx.variation > 1
      ? `\n[VARIATION ${ctx.variation}] Change only pose, angle, framing, lighting nuance and micro-expression. Keep the same person, the same product, the same content type and the same environment.`
      : "",
    "",
    "[FINAL_VALIDATION]",
    "Before finishing: exactly one person (the selected influencer), exactly one product (the selected product, unmodified), the selected environment, correct hands, and no invented text.",
    "",
    "[OUTPUT]",
    "Single photorealistic image, 9:16 vertical aspect ratio, maximum resolution, ready to be used as the first frame of a video.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * Prompt de vídeo: usa o par aprovado para a categoria e alterna pela variação.
 */
export function buildVideoPrompt(ctx: GenerationContext, duration = 8): string {
  void duration;
  return buildMotionScript({ productName: ctx.product.name }, ctx.variation, ctx.contentType.id);
}

/** Versão antiga em blocos, mantida apenas para referência interna. */
export function buildVideoPromptBlocks(ctx: GenerationContext, duration = 8): string {
  const { influencer, product, contentType, scenario } = ctx;
  const interaction = productInteractionPlan(product.name, product.category);
  const continuity = videoContinuityPlan(interaction, product.name, duration);


  return [
    "[GENERATION_CONTEXT]",
    `Use the uploaded first-frame image as the sole visual source and exact starting frame. Create an ${duration}-second vertical 9:16 video in a single uninterrupted take with influencer "${influencer.name}" and product "${product.name}".`,
    "",
    "[CONTENT_TYPE]",
    `${contentType.name} — ${contentType.behavior} Required behavior: ${contentType.requiredActions}`,
    "",
    "[SCENARIO]",
    `${scenario.name}: ${scenario.environment}. The environment never changes during the take.`,
    "",
    "[CAMERA]",
    "One stable lens and field of view with a single very slow continuous push-in. No cuts, no reframing jumps, no focus pumping, no lens switches.",
    "",
    "[ACTION]",
    continuity.positiveDirection,
    "",
    "[PRODUCT_INTERACTION]",
    `${interaction.contact} ${interaction.lock}`,
    "",
    "[TEMPORAL_CONTINUITY]",
    continuity.timeline,
    "",
    "[VISUAL_CONTINUITY]",
    continuity.continuity,
    "",
    "[PHYSICS_AND_REALISM]",
    "All motion follows real-world physics: gravity, weight, inertia, fabric behaviour and contact friction. During the final segment motion stops naturally, the person holds a stable final pose and the product stays fully visible, separate from the body and identical to frame zero.",
    "",
    "[AUDIO]",
    "Natural ambient room sound only; no dialogue and no on-screen text.",
    "",
    "[ANTI_GENERATION_BUGS]",
    `Prevent: ${ANTI_BUGS}.`,
    "",
    "[NEGATIVE_CONSTRAINTS]",
    `${continuity.negative}.`,
    NEGATIVE_BLOCK,
    "",
    "[FINAL_VALIDATION]",
    "Every frame must contain the same single person, the same single product, the same outfit, the same accessories and the same environment as frame zero.",
  ].join("\n");
}
