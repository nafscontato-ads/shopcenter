import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveUser } from "@/lib/access-control";

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

function apiKey() {
  const key = (process.env["OPENROUTER_API_KEY"] ?? "").trim() || process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("A geração de imagens não está configurada.");
  return key;
}

function gatewayError(status: number, body: string): Error {
  if (status === 429) return new Error("Muitas gerações ao mesmo tempo. Aguarde alguns segundos.");
  if (status === 402) return new Error("Créditos de IA insuficientes para gerar a cena.");
  if (status === 403) return new Error("A geração está bloqueada nas configurações do workspace.");
  return new Error(`Falha na geração (${status}). ${body.slice(0, 180)}`);
}

async function generateImageOnce(prompt: string, quality: string, referenceUrls: string[]): Promise<string> {
  const { generateImageWithGemini } = await import("@/lib/gemini-image.server");
  return generateImageWithGemini({ prompt, quality, referenceUrls });
}

async function generateImage(prompt: string, quality: string, referenceUrls: string[]): Promise<string> {
  try {
    return await generateImageOnce(prompt, quality, referenceUrls);
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
    .from("studio")
    .upload(path, bytes, { contentType: "image/png", upsert: false });
  if (error) throw new Error(`Não foi possível salvar a imagem: ${error.message}`);
  const { data, error: signErr } = await supabaseAdmin.storage
    .from("studio")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (signErr || !data?.signedUrl) throw new Error("Não foi possível gerar o link da imagem.");
  return data.signedUrl;
}

export const generateMasterFrame = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .inputValidator((data: unknown) =>
    z
      .object({
        prompt: z.string().min(20),
        quality: z.string().default("standard"),
        format: z.string().default("9:16"),
        references: z.array(z.string().url()).max(4).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertCanGenerate, logUsage } = await import("@/lib/quota.server");
    await assertCanGenerate(context.userId);
    const prompt = `${data.prompt}\n\n[OUTPUT]\nSingle photorealistic image, ${data.format} aspect ratio, maximum available resolution. This image is the first frame of a short vertical video.`;
    const b64 = await guard(context.userId, "/studio", () => generateImage(prompt, data.quality, data.references));
    const url = await uploadPng(b64, "master-frames");
    await logUsage({ userId: context.userId, rateKey: "studio_master_frame" });
    return { url, model: data.quality === "ultra" || data.quality === "high" ? MODEL_MAX : MODEL_STANDARD };
  });

export const refineMasterFrame = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .inputValidator((data: unknown) =>
    z
      .object({
        imageUrl: z.string().url(),
        instruction: z.string().min(3),
        basePrompt: z.string().min(20),
        quality: z.string().default("standard"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertCanGenerate, logUsage } = await import("@/lib/quota.server");
    await assertCanGenerate(context.userId);
    const prompt = [
      "[EDIT — change only what is requested]",
      `Requested change: ${data.instruction}`,
      "Keep the exact same person, same face, same hair, same outfit, same product and same environment as the reference image. Do not rebuild the identity.",
      "\n[ORIGINAL DIRECTION]\n" + data.basePrompt,
    ].join("\n");
    const b64 = await guard(context.userId, "/studio", () => generateImage(prompt, data.quality, [data.imageUrl]));
    const url = await uploadPng(b64, "master-frames");
    await logUsage({ userId: context.userId, rateKey: "studio_refine" });
    return { url };
  });

export const generateScript = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .inputValidator((data: unknown) =>
    z
      .object({
        product: z.string().min(2),
        category: z.string().default(""),
        price: z.string().default(""),
        commission: z.string().default(""),
        influencer: z.string().default("a influencer"),
        style: z.string().default("Review"),
        tone: z.string().default("Natural"),
        cta: z.string().default("Confira o produto"),
        duration: z.number().int().min(5).max(90).default(15),
        language: z.string().default("Português BR"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const instruction = `Você é roteirista de vídeos curtos de afiliado (Shopee).
Escreva a FALA de ${data.influencer} para um vídeo de ${data.duration} segundos em ${data.language}.
Produto: ${data.product}${data.category ? ` (${data.category})` : ""}${data.price ? `, ${data.price}` : ""}.
Estilo: ${data.style}. Tom: ${data.tone}. CTA final: "${data.cta}".
Estrutura: HOOK → DEMONSTRAÇÃO → BENEFÍCIO → PROVA → CTA.
Regras: linguagem falada e natural, frases curtas, sem emoji, sem hashtags, sem marcadores.
NUNCA invente características técnicas, resultados ou promessas que não estejam no nome/categoria do produto.
Responda apenas com o texto da fala corrido, no tamanho certo para ${data.duration} segundos.`;

    const res = await (await import("@/lib/ai-gateway.server")).aiChat({
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: TEXT_MODEL, messages: [{ role: "user", content: instruction }] }),
    });
    if (!res.ok) throw gatewayError(res.status, await res.text().catch(() => ""));
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Não foi possível gerar o roteiro.");
    return { script: text };
  });
