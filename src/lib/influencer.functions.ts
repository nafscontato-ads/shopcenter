import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveUser } from "@/lib/access-control";

import { buildCharacterPrompt, buildVariationPrompt, NEGATIVE_PROMPT, VARIATION_BRIEFS } from "./character-dna";
import type { CharacterDNA } from "./character-dna";

/** Runs an AI call and records any failure in the platform health log. */
async function guard<T>(userId: string, route: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const { reportError, errorMessage } = await import("@/lib/health.server");
    await reportError({ kind: "generation", message: errorMessage(e), userId, route });
    throw e;
  }
}

const MODEL_STANDARD = "gemini-2.5-flash-image";
const MODEL_MAX = "gemini-3-pro-image-preview";
const TEXT_MODEL = "openai/gpt-5.6-sol";

const dnaSchema = z.record(z.string(), z.any());

function apiKey() {
  const key = (process.env["OPENROUTER_API_KEY"] ?? "").trim() || process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("A geração de imagens não está configurada.");
  return key;
}

function gatewayError(status: number, body: string): Error {
  if (status === 429) return new Error("Muitas gerações ao mesmo tempo. Aguarde alguns segundos e tente novamente.");
  if (status === 402) return new Error("Créditos de IA insuficientes para gerar as imagens.");
  if (status === 403) return new Error("A geração de imagens está bloqueada nas configurações do workspace.");
  return new Error(`Falha na geração da imagem (${status}). ${body.slice(0, 180)}`);
}

async function generateImageOnce(opts: {
  prompt: string;
  quality?: "standard" | "max";
  referenceUrls?: string[];
}): Promise<string> {
  const { generateImageWithGemini } = await import("@/lib/gemini-image.server");
  return generateImageWithGemini(opts);
}

async function generateImage(opts: {
  prompt: string;
  quality?: "standard" | "max";
  referenceUrls?: string[];
}): Promise<string> {
  try {
    return await generateImageOnce(opts);
  } catch (e) {
    const { isImageSafetyError, IMAGE_SAFETY_MESSAGE } = await import("@/lib/gemini-image.server");
    if (isImageSafetyError(e)) throw new Error(IMAGE_SAFETY_MESSAGE);
    throw e;
  }
}

async function uploadPng(b64: string, prefix: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const path = `${prefix}/${crypto.randomUUID()}.png`;
  const { error } = await supabaseAdmin.storage
    .from("influencers")
    .upload(path, bytes, { contentType: "image/png", upsert: false });
  if (error) throw new Error(`Não foi possível salvar a imagem: ${error.message}`);
  const { data, error: signErr } = await supabaseAdmin.storage
    .from("influencers")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (signErr || !data?.signedUrl) throw new Error("Não foi possível gerar o link da imagem.");
  return data.signedUrl;
}

export const generateIdentity = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .inputValidator((data: unknown) =>
    z
      .object({
        dna: dnaSchema,
        quality: z.enum(["standard", "max"]).default("standard"),
        referenceUrl: z.string().url().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertCanGenerate, logUsage } = await import("@/lib/quota.server");
    await assertCanGenerate(context.userId);
    const dna = data.dna as unknown as CharacterDNA;
    const prompt = buildCharacterPrompt(dna, { referenceSheet: true });
    const b64 = await guard(context.userId, "/influencer/novo", () => generateImage({
      prompt:
        prompt +
        "\n\n[OUTPUT]\nSingle photorealistic full-body reference photo of the whole person, head to feet fully inside the frame, plain white studio background, vertical 4:5 framing, maximum available resolution.",
      quality: data.quality,
      referenceUrls: data.referenceUrl ? [data.referenceUrl] : [],
    }));
    const url = await uploadPng(b64, "identity");
    await logUsage({
      userId: context.userId,
      rateKey: "influencer_image",
      model: data.quality === "max" ? MODEL_MAX : MODEL_STANDARD,
    });
    return {
      url,
      prompt,
      negativePrompt: NEGATIVE_PROMPT,
      model: data.quality === "max" ? MODEL_MAX : MODEL_STANDARD,
    };
  });

export const generateVariation = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .inputValidator((data: unknown) =>
    z
      .object({
        dna: dnaSchema,
        identityUrl: z.string().url(),
        sourceUrl: z.string().url().optional(),
        index: z.number().int().min(0).max(3),
        quality: z.enum(["standard", "max"]).default("standard"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertCanGenerate, logUsage } = await import("@/lib/quota.server");
    await assertCanGenerate(context.userId);
    const dna = data.dna as unknown as CharacterDNA;
    const refs = [data.identityUrl, ...(data.sourceUrl ? [data.sourceUrl] : [])];
    const b64 = await guard(context.userId, "/influencer/novo", () =>
      generateImage({
        prompt: buildVariationPrompt(dna, data.index),
        quality: data.quality,
        referenceUrls: refs,
      }),
    );
    const url = await uploadPng(b64, "variations");
    await logUsage({
      userId: context.userId,
      rateKey: "influencer_variation",
      model: data.quality === "max" ? MODEL_MAX : MODEL_STANDARD,
    });
    return { url, index: data.index, label: VARIATION_BRIEFS[data.index]!.label };
  });

const analysisSchema = z.object({
  presentation: z.string().nullable().optional(),
  apparent_age_range: z.string().nullable().optional(),
  skin_tone: z.string().nullable().optional(),
  hair_color: z.string().nullable().optional(),
  hair_length: z.string().nullable().optional(),
  hair_texture: z.string().nullable().optional(),
  hair_style: z.string().nullable().optional(),
  eye_color: z.string().nullable().optional(),
  face_shape: z.string().nullable().optional(),
  facial_features: z.array(z.string()).nullable().optional(),
  body_type: z.string().nullable().optional(),
  clothing_style: z.string().nullable().optional(),
  accessories: z.array(z.string()).nullable().optional(),
  makeup: z.string().nullable().optional(),
  photography_style: z.string().nullable().optional(),
  lighting: z.string().nullable().optional(),
  environment: z.string().nullable().optional(),
  composition: z.string().nullable().optional(),
  mood: z.string().nullable().optional(),
});

export type ReferenceAnalysis = z.infer<typeof analysisSchema>;

export const analyzeReference = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .inputValidator((data: unknown) => z.object({ imageUrl: z.string().url() }).parse(data))
  .handler(async ({ data }) => {
    const instruction = `Você analisa uma imagem de referência para criar um influenciador virtual.
Responda SOMENTE com JSON válido, sem markdown, com estas chaves:
presentation ("Feminina" ou "Masculina"), apparent_age_range (ex: "25–30"), skin_tone (Muito clara|Clara|Morena clara|Morena|Morena escura|Negra), hair_color (Preto|Castanho escuro|Castanho|Loiro escuro|Loiro|Ruivo|Colorido), hair_length (Muito curto|Curto|Médio|Longo|Muito longo), hair_texture (Liso|Ondulado|Cacheado|Crespo), hair_style, eye_color (Castanho escuro|Castanho|Mel|Verde|Azul|Cinza), face_shape (Oval|Redondo|Quadrado|Coração|Alongado), facial_features (array), body_type (Slim|Atlético|Curvilíneo|Musculoso|Natural|Plus size), clothing_style, accessories (array), makeup, photography_style, lighting, environment, composition, mood.
Use null em qualquer campo que não puder ser identificado com segurança. Nunca invente.`;

    const res = await (await import("@/lib/ai-gateway.server")).aiChat({
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              { type: "image_url", image_url: { url: data.imageUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) throw gatewayError(res.status, await res.text().catch(() => ""));
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Não foi possível interpretar a análise da imagem.");
    const parsed = analysisSchema.safeParse(JSON.parse(match[0]));
    if (!parsed.success) throw new Error("A análise retornou um formato inesperado.");
    return parsed.data;
  });
