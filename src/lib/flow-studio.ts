/** Catálogo simples exibido no Studio + direção técnica interna (o cliente não vê). */

export type Objective = {
  value: string;
  label: string;
  hint: string;
  /** Estratégias internas do motor. */
  strategy: string;
  action: string;
  camera: string;
  framing: string;
};

export const objectives: Objective[] = [
  {
    value: "mostrar",
    label: "Mostrar produto",
    hint: "Produto em destaque nas mãos dela",
    strategy: "Produto Hero + Macro Product Shot",
    action:
      "she holds the product with both hands close to the camera, presenting it clearly to the viewer with a confident smile",
    camera: "slow push-in, 35mm, subtle handheld",
    framing: "medium close-up, product perfectly readable in frame",
  },
  {
    value: "usando",
    label: "Usando o produto",
    hint: "Ela usando de verdade, natural",
    strategy: "Influencer usando o produto + Lifestyle",
    action: "she is actually wearing/using the product in a natural everyday moment, relaxed body language",
    camera: "slow orbit around her, 50mm",
    framing: "full body to waist-up, product clearly visible",
  },
  {
    value: "review",
    label: "Review",
    hint: "Falando para a câmera sobre o produto",
    strategy: "Review + Falando para a câmera",
    action:
      "she talks directly to the camera about the product, holding it near her chest, natural micro-expressions and lip movement",
    camera: "static tripod shot with tiny breathing movement, 35mm",
    framing: "waist-up selfie framing, eyes to lens",
  },
  {
    value: "unboxing",
    label: "Unboxing",
    hint: "Abrindo o produto pela primeira vez",
    strategy: "Unboxing + Reação",
    action:
      "she opens the product packaging for the first time, hands in frame, genuine surprised reaction as the product appears",
    camera: "top-down to eye-level transition, 35mm handheld",
    framing: "hands and product centered, face visible",
  },
  {
    value: "antes-depois",
    label: "Antes e depois",
    hint: "Transformação em uma cena só",
    strategy: "Antes e depois + Transição",
    action:
      "single continuous shot where she shows the before state and then, with a natural transition, the after state using the product",
    camera: "match-cut transition with whip pan, 35mm",
    framing: "same framing before and after for a clean comparison",
  },
  {
    value: "em-uso",
    label: "Produto em uso",
    hint: "Demonstração prática funcionando",
    strategy: "Demonstração + Teste real",
    action: "she demonstrates the product working in real time, showing how it is used step by step",
    camera: "handheld follow with slight rack focus to the product",
    framing: "close-up on the product action, her face entering frame",
  },
  {
    value: "venda",
    label: "Venda",
    hint: "Conteúdo direto para conversão",
    strategy: "Problema → Solução + CTA",
    action:
      "she presents the product as the solution, points to it, and finishes looking at the camera inviting the viewer to buy",
    camera: "slow dolly-in ending on a clean product beauty shot",
    framing: "waist-up, product raised to camera at the end",
  },
  {
    value: "pov",
    label: "POV",
    hint: "Ponto de vista de quem está usando",
    strategy: "POV + ASMR visual",
    action:
      "first person point of view: only her hands and forearms are visible interacting with the product, as if the viewer were her",
    camera: "POV head-mounted perspective, natural micro shake",
    framing: "hands and product filling the frame, no face",
  },
];

export type Scenario = { value: string; label: string; prompt: string };

export const scenarios: Scenario[] = [
  { value: "auto", label: "Automático", prompt: "" },
  {
    value: "casa",
    label: "Casa",
    prompt: "cozy modern home interior, soft daylight from a window, tidy background with shallow depth of field",
  },
  {
    value: "loja",
    label: "Loja",
    prompt: "bright retail store aisle with shelves softly blurred in the background, clean commercial lighting",
  },
  {
    value: "rua",
    label: "Rua",
    prompt: "urban street in golden hour, blurred city bokeh in the background, natural sunlight",
  },
  {
    value: "estudio",
    label: "Estúdio",
    prompt: "clean photo studio with seamless backdrop, professional softbox lighting, subtle rim light",
  },
  { value: "outro", label: "Outro cenário", prompt: "" },
];

export const objectiveByValue = (v: string) => objectives.find((o) => o.value === v) ?? objectives[0]!;
export const scenarioByValue = (v: string) => scenarios.find((s) => s.value === v) ?? scenarios[0]!;

export type ProductInteractionPlan = {
  kind: string;
  stillAction: string;
  videoAction: string;
  framing: string;
  contact: string;
  lock: string;
};

export type VideoContinuityPlan = {
  positiveDirection: string;
  timeline: string;
  continuity: string;
  negative: string;
};

/**
 * Gives the image/video models one physically simple interaction instead of
 * the ambiguous "use the product" instruction that commonly causes merging.
 */
export function productInteractionPlan(name: string, category: string): ProductInteractionPlan {
  const text = `${name} ${category}`.toLowerCase();

  if (/bolsa|mochila|carteira|pochete|mala|bag/.test(text)) {
    return {
      kind: "bag",
      stillAction:
        "The bag hangs naturally beside her body. One hand grips only the real handle; the other arm stays relaxed and separate. Keep a visible air gap between the bag and her torso.",
      videoAction:
        "She makes one small natural posture adjustment while the bag remains hanging from the same handle in the same hand.",
      framing: "Frame the complete bag, both handles, all corners and the supporting hand without cropping.",
      contact: "Contact is allowed only where her fingers wrap around the handle. No other part of the bag touches or intersects her body.",
      lock: "The handle count, hardware, seams, silhouette, size and strap attachment points remain unchanged.",
    };
  }
  if (
    /vestido|camisa|camiseta|blusa|blusão|moletom|moleton|hoodie|capuz|suéter|sueter|sweater|tricot|cardig|blazer|colete|calça|calca|legging|short|bermuda|saia|jaqueta|casaco|sobretudo|parka|corta.?vento|roupa|vestuário|vestuario|conjunto|macacão|macacao|macaquinho|body|top|cropped|regata|pijama|camisola|biquíni|biquini|maiô|maio|sutiã|sutia|calcinha|cueca|meia|moda íntima|lingerie|uniforme|abrigo/.test(
      text,
    )
  ) {
    return {
      kind: "clothing",
      stillAction:
        "She is WEARING the garment on her body, dressed normally and correctly: head through the neckline, both arms through the sleeves, the piece fully pulled down over her torso. She is never holding, displaying, hanging or presenting the garment in front of her body. Her arms stay slightly away from her sides so the full cut is visible.",
      videoAction: "She makes one slow quarter-turn and stops. The garment stays worn on her body and follows normal fabric physics.",
      framing: "Use a stable full-body or three-quarter view that shows the entire garment as worn.",
      contact: "The garment is in full contact with her body as clothing. Hands do not pull it off, hold it up, cover it or pass through it.",
      lock: "Keep the exact cut, length, color, print, seams, neckline and sleeve count from the product reference.",
    };
  }

  if (/tênis|sapato|sandália|chinelo|bota|calçado/.test(text)) {
    return {
      kind: "footwear",
      stillAction: "She is wearing the exact pair of footwear, with both feet planted and clearly separated.",
      videoAction: "She shifts her weight once and takes one short slow step; both shoes keep the same shape and remain attached to the correct feet.",
      framing: "Use a stable full-body view with both shoes fully visible and not cropped.",
      contact: "The footwear contacts only the feet and floor, with realistic pressure and shadows.",
      lock: "Keep the sole, laces, panels, logo placement, color and left/right pair identical.",
    };
  }
  if (/batom|perfume|creme|sérum|serum|maquiagem|skincare|shampoo|cosmético/.test(text)) {
    return {
      kind: "beauty",
      stillAction: "She holds the closed product upright beside her shoulder with one hand, away from her face and clothing; the label faces the camera.",
      videoAction: "She slowly raises the same hand a few centimeters and holds still. The product stays closed, upright and front-facing.",
      framing: "Use a stable medium close-up with the complete product and all five fingers visible.",
      contact: "Only the fingertips and palm touch the container. Do not apply, open, pour or spray it.",
      lock: "Keep the container, cap, pump, label position, colors and proportions unchanged; never fabricate unreadable label text.",
    };
  }
  if (/celular|smartphone|fone|headphone|caixa de som|relógio|smartwatch|eletrôn|tablet/.test(text)) {
    return {
      kind: "electronics",
      stillAction: "She supports the device from its outer edges with both hands, ten centimeters in front of her torso; its complete silhouette is visible.",
      videoAction: "She holds the device steady and makes one small tilt toward the light without changing grip or turning it around.",
      framing: "Use a stable medium close-up; do not crop the device or hands.",
      contact: "Fingers touch only the outer edges and never cover the main product details.",
      lock: "Keep every button, port, screen, opening, logo and dimension fixed. The screen content does not change.",
    };
  }
  if (/organizador|panela|liquidificador|cafeteira|luminária|ferramenta|móvel|cozinha|casa/.test(text)) {
    return {
      kind: "tabletop",
      stillAction: "The product rests completely on a clean table or counter. She stands beside it and points with one open hand without lifting it.",
      videoAction: "She makes one small pointing gesture while the product remains perfectly stationary on the same surface.",
      framing: "Show the complete product, its base, the supporting surface and her separate hand.",
      contact: "The product contacts only the surface. Her hand stays a few centimeters away from it.",
      lock: "Keep all parts, edges, openings, accessories, proportions and materials unchanged.",
    };
  }

  return {
    kind: "handheld",
    stillAction:
      "She holds the product steadily with both hands at its outer edges, ten centimeters in front of her torso. Its complete silhouette stays separate from her body.",
    videoAction: "She makes one subtle natural breathing movement while both hands and the product remain in the same pose.",
    framing: "Use a stable medium shot with the complete product, both hands and every finger visible.",
    contact: "Hands touch only the product edges; fingers never cover important details and nothing intersects skin or clothing.",
    lock: "Keep the exact shape, part count, proportions, color, material, label and logo placement unchanged.",
  };
}

/**
 * Shared physical-continuity layer used by every Studio video prompt.
 * It favors one fully described action over a long generic prohibition list.
 */
export function videoContinuityPlan(
  interaction: ProductInteractionPlan,
  productName: string,
  duration = 8,
): VideoContinuityPlan {
  const actionEnd = Math.max(3.5, duration - 2.2).toFixed(1);
  const settleStart = Math.max(4.5, duration - 1.5).toFixed(1);

  return {
    positiveDirection: [
      `Begin from the uploaded frame with the product "${productName}" already in its exact visible position and contact state.`,
      interaction.videoAction,
      "Use one simple human action only. It begins from rest, accelerates gently, follows one continuous visible path, decelerates naturally and finishes before the final pose.",
      `Physical contact remains explicit throughout: ${interaction.contact}`,
      "Hands keep anatomically plausible articulation and five fingers per hand; fabric and hair react subtly to the same body motion.",
    ].join(" "),
    timeline: [
      `0.0–1.0s — Hold the exact initial pose from frame zero; establish the person, product, grip and environment without changing them.`,
      `1.0–${actionEnd}s — Perform the single described action slowly along one continuous physical path. No second action begins during this movement.`,
      `${actionEnd}–${settleStart}s — Complete the movement and decelerate into the final position while preserving the same grip and product orientation.`,
      `${settleStart}–${duration.toFixed(1)}s — Hold a natural stable final pose; keep the complete product clearly visible and the subject's gaze and expression calm.`,
    ].join("\n"),
    continuity: [
      "Maintain strict frame-to-frame visual continuity throughout this single uninterrupted take.",
      `Product identity and scale lock: ${interaction.lock} Preserve its geometry, relative dimensions, part count, color, material, texture, finish, packaging, label and logo placement; its size relative to the hand remains constant even as camera distance changes.`,
      "Treat every visible item in frame zero as persistent: person, clothing, hair, accessories, furniture, packaging and background objects retain the same identity, geometry, color and spatial relationship.",
      "If anything legitimately leaves the crop, it continues to exist off-camera and can return only through a continuous physically visible path; nothing teleports, appears or disappears.",
      "Keep the same face, facial structure, skin, body, hairstyle, outfit and accessories from first to final frame; generate no second person.",
      "Clothing preserves its cut, length, sleeves, neckline, print, color and texture, following the body with natural fabric physics without merging into skin or product.",
      "The environment, architecture, props, shadows, exposure, color and textures remain stable with no flicker or pulsing.",
      "The camera keeps one stable lens, field of view and angle, using only a very slow continuous push-in from start to finish; no cuts, reframing jumps, focus pumping or lens switches.",
    ].join(" "),
    negative: [
      "morphing",
      "object identity or geometry changes",
      "product deformation or duplication",
      "scale or color changes",
      "altered logo or invented writing",
      "spontaneous or disappearing objects",
      "teleportation",
      "hand-object intersection",
      "floating product",
      "identity drift",
      "wardrobe or accessory changes",
      "background instability",
      "flicker",
      "anatomical errors",
    ].join(", "),
  };
}

const REQUIRED_VIDEO_MARKERS = [
  "0.0–1.0s",
  "single uninterrupted take",
  "Product identity and scale lock",
  "Treat every visible item in frame zero as persistent",
  "nothing teleports, appears or disappears",
  "same face",
  "camera keeps one stable lens",
  "stable final pose",
];

/** Prevents an AI-polished prompt from silently dropping critical locks. */
export function hasRequiredVideoContinuity(prompt: string): boolean {
  return REQUIRED_VIDEO_MARKERS.every((marker) => prompt.includes(marker));
}

/** Cenário coerente escolhido pelo PAS quando o cliente deixa em "Automático". */
export function autoScenario(objective: string, category: string): string {
  const c = category.toLowerCase();
  if (objective === "unboxing" || objective === "pov")
    return "cozy modern home interior with a clean table, soft daylight, tidy background";
  if (objective === "venda" || objective === "mostrar")
    return "clean photo studio with seamless neutral backdrop, professional softbox lighting";
  if (c.includes("moda") || c.includes("roup") || c.includes("calçad"))
    return "urban street in golden hour with soft city bokeh in the background";
  if (c.includes("casa") || c.includes("cozinha") || c.includes("decor"))
    return "bright modern home interior, natural window light, minimal styling";
  if (c.includes("beleza") || c.includes("maquiagem") || c.includes("skin"))
    return "soft bathroom vanity or beauty corner with warm diffused light and clean surfaces";
  return "bright modern lifestyle environment with soft natural light and a clean, uncluttered background";
}
