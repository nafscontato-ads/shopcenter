import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveUser } from "@/lib/access-control";
import { objectiveByValue } from "@/lib/flow-studio";
import {
  buildImagePrompt,
  buildVideoPrompt,
  contentTypeFor,
  scenarioFor,
  validateGenerationContext,
  type GenerationContext,
} from "@/lib/generation-context";


const IMAGE_MODEL = "gemini-3-pro-image-preview";

async function generateImage(prompt: string, references: string[], referenceLabels: string[]): Promise<string> {
  const { generateImageWithGemini, isImageSafetyError, IMAGE_SAFETY_MESSAGE } = await import(
    "@/lib/gemini-image.server"
  );
  try {
    return await generateImageWithGemini({
      prompt,
      quality: "max",
      referenceUrls: references,
      referenceLabels,
    });
  } catch (error) {
    if (isImageSafetyError(error)) throw new Error(IMAGE_SAFETY_MESSAGE);
    throw error;
  }
}

function isInsufficientCredits(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:\b402\b|not enough credits|insufficient.*credits|cr[eé]ditos.*(?:acabaram|insuficientes|esgotados))/i.test(
    message,
  );
}

async function uploadPng(b64: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const path = `scenes/${crypto.randomUUID()}.png`;
  const { error } = await supabaseAdmin.storage
    .from("studio")
    .upload(path, bytes, { contentType: "image/png", upsert: false });
  if (error) throw new Error(`Não foi possível salvar a imagem: ${error.message}`);
  const { data, error: signErr } = await supabaseAdmin.storage
    .from("studio")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (signErr || !data?.signedUrl) throw new Error("Não foi possível gerar o link da imagem.");
  return data.signedUrl;
}

type Influencer = Record<string, any>;

function influencerDescription(inf: Influencer): string {
  const parts = [
    inf['apparent_age'] && `aparência de ${inf['apparent_age']}`,
    inf['skin_tone'] && `pele ${inf['skin_tone']}`,
    inf['hair_color'] && `cabelo ${inf['hair_color']}`,
    inf['hair_length'],
    inf['hair_texture'],
    inf['hair_style'],
    inf['eye_color'] && `olhos ${inf['eye_color']}`,
    inf['face_shape'] && `rosto ${inf['face_shape']}`,
    inf['eyebrow_style'] && `sobrancelhas ${inf['eyebrow_style']}`,
    inf['lip_style'] && `lábios ${inf['lip_style']}`,
    inf['nose_style'] && `nariz ${inf['nose_style']}`,
    inf['body_type'],
    inf['height_type'],
    inf['makeup_style'] && `maquiagem ${inf['makeup_style']}`,
    inf['clothing_style'] && `estilo ${inf['clothing_style']}`,
    inf['expression'] && `expressão ${inf['expression']}`,
  ].filter(Boolean);
  return parts.join(", ");
}

const NEGATIVE =
  "no extra fingers, no deformed hands, no distorted product, no changed logo, no invented packaging text, no watermark, no duplicated limbs, no plastic skin, no text overlays, no AI artifacts";

export const generateStudioScene = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .inputValidator((data: unknown) =>
    z
      .object({
        influencerId: z.string().uuid(),
        productId: z.string().min(1),
        objective: z.string().min(2),
        scenario: z.string().min(2),
        customScenario: z.string().max(240).default(""),
        variation: z.number().int().min(1).max(20).default(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;

    // STEP 1–6: reconstruir tudo a partir dos IDs enviados pela interface.
    const { data: inf } = await supabase
      .from("influencers")
      .select("*")
      .eq("id", data.influencerId)
      .maybeSingle();
    if (!inf) throw new Error("Influenciadora não encontrada na sua conta.");

    const { data: savedRow } = await supabase
      .from("saved_products")
      .select("product_id, product_data")
      .eq("product_id", data.productId)
      .maybeSingle();
    if (!savedRow) throw new Error("Produto não encontrado em Meus Produtos.");
    const product = (savedRow.product_data ?? {}) as Record<string, any>;

    const httpOnly = (list: unknown[]) =>
      Array.from(
        new Set(list.filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))),
      );

    const influencerRefs = httpOnly([
      inf.identity_image_url,
      inf.source_image_url,
      ...((inf.identity_reference_urls as string[] | null) ?? []),
    ]).slice(0, 3);

    const productRefs = httpOnly([
      product['image'],
      ...((Array.isArray(product['images']) ? product['images'] : []) as unknown[]),
      ...((Array.isArray(product['gallery']) ? product['gallery'] : []) as unknown[]),
    ]).slice(0, 3);

    const productName = String(product['name'] ?? "").trim();
    const productCategory = String(product['category'] ?? "");

    // STEP 7: contexto único de geração, reconstruído do zero a cada execução.
    const genContext: GenerationContext = {
      influencer: {
        id: String(inf.id),
        name: String(inf.name ?? ""),
        imageUrl: influencerRefs[0] ?? null,
        referenceImages: influencerRefs,
        description: influencerDescription(inf),
      },
      product: {
        id: String(savedRow.product_id),
        name: productName || "o produto",
        imageUrl: productRefs[0] ?? null,
        referenceImages: productRefs,
        category: productCategory,
        description: String(product['description'] ?? "").slice(0, 400),
      },
      contentType: contentTypeFor(data.objective),
      scenario: scenarioFor(data.scenario, data.customScenario, data.objective, productCategory),
      variation: data.variation,
    };

    // STEP 8: validação — nunca gerar com contexto incompleto, nunca cair em prompt genérico.
    const problems = validateGenerationContext(genContext);
    if (problems.length) throw new Error(problems.join(" "));

    const obj = objectiveByValue(data.objective);
    const place = genContext.scenario.environment;
    const identity = genContext.influencer.imageUrl!;
    const productImage = genContext.product.imageUrl!;

    // STEP 9: prompt montado exclusivamente a partir do contexto validado.
    const imagePrompt = buildImagePrompt(genContext);

    const referenceLabels = [
      ...influencerRefs.map(
        (_, i) => `INFLUENCER REFERENCE ${i + 1} — SAME PERSON "${genContext.influencer.name}", IDENTITY ONLY`,
      ),
      ...productRefs.map(
        (_, i) =>
          `PRODUCT REFERENCE ${i + 1} — SAME PRODUCT "${genContext.product.name}" ONLY; IGNORE ANY PERSON OR BACKGROUND`,
      ),
    ];

    const { assertCanGenerate, logUsage } = await import("@/lib/quota.server");
    await assertCanGenerate(context.userId);

    // O prompt é determinístico e não precisa de IA nem consome créditos.
    const flowPrompt = buildVideoPrompt(genContext, 8);

    let url: string | null = null;
    let generationNotice: string | null = null;
    try {
      const b64 = await generateImage(imagePrompt, [...influencerRefs, ...productRefs], referenceLabels);
      url = await uploadPng(b64);
      await logUsage({ userId: context.userId, rateKey: "studio_scene" });
    } catch (e) {
      const { reportError, errorMessage } = await import("@/lib/health.server");
      await reportError({ kind: "generation", message: errorMessage(e), userId: context.userId, route: "/studio" });
      if (!isInsufficientCredits(e)) throw e;
      generationNotice =
        "Prompt gerado sem custo. A imagem da cena não foi criada porque os créditos de IA do workspace acabaram.";
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("studio_generations" as never).insert({
        user_id: context.userId,
        kind: "scene",
        url,
        prompt: flowPrompt,
        model: IMAGE_MODEL,
        metadata: {
          influencer_id: genContext.influencer.id,
          influencer_name: genContext.influencer.name,
          product_id: genContext.product.id,
          product_name: genContext.product.name,
          product_image: productImage,
          objective: genContext.contentType.id,
          objective_label: genContext.contentType.name,
          content_type: genContext.contentType.name,
          scenario: place,
          scenario_label: genContext.scenario.name,
          image_prompt: imagePrompt,
          variation: data.variation,
          influencer_references: influencerRefs.length,
          product_references: productRefs.length,
        },
      } as never);
    } catch {
      /* histórico é best-effort */
    }

    return {
      url,
      flowPrompt,
      imagePrompt,
      imageGenerated: Boolean(url),
      generationNotice,
      direction: {
        influencer: genContext.influencer.name,
        product: genContext.product.name,
        objective: genContext.contentType.name,
        strategy: obj.strategy,
        scenario: place,
        scenarioLabel: genContext.scenario.name,
        camera: genContext.contentType.camera,
        framing: genContext.contentType.framing,
        influencerId: genContext.influencer.id,
        productId: genContext.product.id,
        contentTypeId: genContext.contentType.id,
        scenarioId: genContext.scenario.id,
        references: {
          influencer: influencerRefs.length,
          product: productRefs.length,
        },
      },
    };

  });

export const listSceneHistory = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    const { data } = await supabase
      .from("studio_generations")
      .select("id, url, prompt, metadata, created_at")
      .eq("kind", "scene")
      .order("created_at", { ascending: false })
      .limit(24);
    return (data ?? []) as {
      id: string;
      url: string | null;
      prompt: string | null;
      metadata: Record<string, any> | null;
      created_at: string;
    }[];
  });
