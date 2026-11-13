/**
 * Um só lugar para falar com a IA de texto. Ordem: OpenRouter (OPENROUTER_API_KEY, a conta com
 * saldo dos donos) e, se ela não existir, o gateway do Lovable (LOVABLE_API_KEY, só existe lá).
 * Server-only: importe com `await import(...)` dentro dos handlers.
 */
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
/** Tentados nessa ordem depois do modelo pedido, caso a OpenRouter não tenha o nome exato. */
const TEXT_FALLBACKS = ["google/gemini-2.5-flash", "openai/gpt-4o-mini"];

export function openRouterKey() {
  return (process.env["OPENROUTER_API_KEY"] ?? "").trim() || null;
}

/** Alguma chave de IA de texto configurada? (não devolve o valor para o cliente) */
export function aiTextKey() {
  return openRouterKey() ?? ((process.env["LOVABLE_API_KEY"] ?? "").trim() || null);
}

export function openRouterHeaders(key: string) {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env["PUBLIC_SITE_URL"]?.trim() || "https://shopcenter.cloud",
    "X-Title": "Shop Center",
  };
}

/** Mesmo formato do fetch que existia antes: recebe `{ body: JSON }` de chat completions e devolve a Response. */
export async function aiChat(init: { body: string; method?: string; headers?: unknown }): Promise<Response> {
  const orKey = openRouterKey();
  if (!orKey) {
    const key = (process.env["LOVABLE_API_KEY"] ?? "").trim();
    if (!key) return new Response("IA não configurada", { status: 503 });
    return fetch(LOVABLE_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: init.body });
  }
  const payload = JSON.parse(init.body) as Record<string, unknown>;
  const override = (process.env["AI_TEXT_MODEL"] ?? "").trim();
  const models = [...new Set([override, String(payload["model"] ?? ""), ...TEXT_FALLBACKS].filter(Boolean))];
  let last: Response | null = null;
  for (const model of models) {
    last = await fetch(OPENROUTER_URL, { method: "POST", headers: openRouterHeaders(orKey), body: JSON.stringify({ ...payload, model }) });
    // 400/404 = nome de modelo que a OpenRouter não conhece: tenta o próximo. Saldo, limite e o resto voltam como estão.
    if (last.status !== 400 && last.status !== 404) return last;
  }
  return last ?? new Response("IA não configurada", { status: 503 });
}
