/** Geração de imagens pelo projeto do Google AI Studio configurado no servidor. */
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export const GEMINI_MODEL_STANDARD = "gemini-2.5-flash-image";
export const GEMINI_MODEL_MAX = "gemini-3-pro-image-preview";

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

const SAFE_IMAGE_CONTEXT = [
  "[SAFETY AND SUBJECT CONTEXT]",
  "Create a wholesome professional e-commerce advertising image.",
  "Every depicted person is an adult aged 25 or older.",
  "The adult is fully clothed in modest everyday clothing, with a neutral non-suggestive pose and expression.",
  "No nudity, lingerie, swimwear, transparent clothing, intimate framing, violence, substances, medical claims or sexualized content.",
  "Show only normal, safe product use suitable for a mainstream online marketplace.",
].join("\n");

export function safeImagePrompt(prompt: string): string {
  return `${SAFE_IMAGE_CONTEXT}\n\n${prompt}\n\n[FINAL SAFETY CHECK]\nKeep the result family-friendly, non-suggestive and suitable for a general-audience product catalog.`;
}

export function isImageSafetyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /IMAGE_SAFETY|SAFETY|content blocked|blocked by the provider|não retornou imagem/i.test(message);
}

export const IMAGE_SAFETY_MESSAGE =
  "A IA recusou esta combinação por segurança. Escolha outro produto ou use uma foto de produto mais neutra; se preferir, troque também a roupa, a pose ou o cenário da influenciadora.";

async function toInlineData(url: string): Promise<GeminiPart | null> {
  try {
    const { fetchPublicUrl } = await import("@/lib/safe-fetch");
    const response = await fetchPublicUrl(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return {
      inline_data: {
        mime_type: response.headers.get("content-type")?.split(";")[0] ?? "image/png",
        data: btoa(binary),
      },
    };
  } catch {
    return null;
  }
}

function googleError(status: number, body: string): Error {
  if (/IMAGE_SAFETY|SAFETY|content blocked|blocked by the provider/i.test(body))
    return new Error(`SAFETY:${IMAGE_SAFETY_MESSAGE}`);
  if (status === 402)
    return new Error("Os créditos do Google AI Studio acabaram. Recarregue o projeto Google configurado para gerar imagens.");
  if (status === 429) return new Error("Limite da API do Google atingido. Aguarde alguns segundos.");
  if (status === 400 && /API key/i.test(body)) return new Error("A chave da API do Google é inválida.");
  if (status === 403) return new Error("A chave do Google não tem permissão ou o faturamento não está ativo.");
  return new Error(`Falha na geração pelo Google (${status}). ${body.slice(0, 180)}`);
}

/**
 * Envia, na ordem, as fotos da influenciadora e do produto junto do prompt de
 * DNA. O Google recebe as imagens reais em cada geração, sem reutilizar estado.
 */
export async function generateImageWithGemini(opts: {
  prompt: string;
  quality?: string;
  referenceUrls?: string[];
  referenceLabels?: string[];
}): Promise<string> {
  const { openRouterKey } = await import("@/lib/ai-gateway.server");
  const orKey = openRouterKey();
  if (orKey) return generateImageWithOpenRouter(orKey, opts);

  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("A geração de imagens não está configurada.");

  const model =
    opts.quality === "max" || opts.quality === "ultra" || opts.quality === "high"
      ? GEMINI_MODEL_MAX
      : GEMINI_MODEL_STANDARD;
  const parts: GeminiPart[] = [{ text: safeImagePrompt(opts.prompt) }];

  for (const [index, url] of (opts.referenceUrls ?? []).entries()) {
    const image = await toInlineData(url);
    if (!image) continue;
    const label = opts.referenceLabels?.[index] ?? `REFERENCE ${index + 1}`;
    parts.push({ text: `[${label}]` }, image);
  }

  const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
      ],
    }),
  });

  if (!response.ok) throw googleError(response.status, await response.text().catch(() => ""));

  const json = (await response.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[];
  };
  for (const part of json.candidates?.[0]?.content?.parts ?? []) {
    const image = part.inlineData?.data ?? part.inline_data?.data;
    if (image) return image;
  }
  throw new Error(`SAFETY:${IMAGE_SAFETY_MESSAGE}`);
}
/** Nomes dos mesmos modelos de imagem na OpenRouter; os seguintes são tentados se o primeiro não existir lá. */
const OPENROUTER_IMAGE_STANDARD = ["google/gemini-2.5-flash-image", "google/gemini-2.5-flash-image-preview"];
const OPENROUTER_IMAGE_MAX = ["google/gemini-3-pro-image-preview", ...OPENROUTER_IMAGE_STANDARD];

function openRouterError(status: number, body: string): Error {
  if (/IMAGE_SAFETY|SAFETY|content blocked|blocked by the provider|moderation/i.test(body)) return new Error(`SAFETY:${IMAGE_SAFETY_MESSAGE}`);
  if (status === 402) return new Error("O saldo da IA acabou. Avise o suporte do Shop Center.");
  if (status === 401 || status === 403) return new Error("A chave da IA é inválida ou está sem permissão.");
  if (status === 429) return new Error("Muitas gerações ao mesmo tempo. Aguarde alguns segundos.");
  return new Error(`Falha na geração de imagem (${status}). ${body.slice(0, 180)}`);
}

/** Mesma geração, pela OpenRouter (chat completions com saída de imagem). Devolve o base64 da imagem. */
async function generateImageWithOpenRouter(key: string, opts: { prompt: string; quality?: string; referenceUrls?: string[]; referenceLabels?: string[] }): Promise<string> {
  const { openRouterHeaders } = await import("@/lib/ai-gateway.server");
  const content: Array<Record<string, unknown>> = [{ type: "text", text: safeImagePrompt(opts.prompt) }];
  for (const [index, url] of (opts.referenceUrls ?? []).entries()) {
    const image = await toInlineData(url);
    if (!image || !("inline_data" in image)) continue;
    content.push(
      { type: "text", text: `[${opts.referenceLabels?.[index] ?? `REFERENCE ${index + 1}`}]` },
      { type: "image_url", image_url: { url: `data:${image.inline_data.mime_type};base64,${image.inline_data.data}` } },
    );
  }
  const wantsMax = opts.quality === "max" || opts.quality === "ultra" || opts.quality === "high";
  const override = (process.env["AI_IMAGE_MODEL"] ?? "").trim();
  const models = [...new Set([override, ...(wantsMax ? OPENROUTER_IMAGE_MAX : OPENROUTER_IMAGE_STANDARD)].filter(Boolean))];
  let failure: Error | null = null;
  for (const model of models) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: openRouterHeaders(key),
      body: JSON.stringify({ model, modalities: ["image", "text"], messages: [{ role: "user", content }] }),
    });
    if (!response.ok) {
      failure = openRouterError(response.status, await response.text().catch(() => ""));
      // Nome de modelo desconhecido: tenta o próximo. Qualquer outro erro (saldo, limite, segurança) volta na hora.
      if ((response.status === 400 || response.status === 404) && !failure.message.startsWith("SAFETY:")) continue;
      throw failure;
    }
    const json = (await response.json()) as { choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[] };
    const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? "";
    const base64 = dataUrl.includes("base64,") ? dataUrl.slice(dataUrl.indexOf("base64,") + 7) : "";
    if (base64) return base64;
    throw new Error(`SAFETY:${IMAGE_SAFETY_MESSAGE}`);
  }
  throw failure ?? new Error("A geração de imagens não está configurada.");
}
