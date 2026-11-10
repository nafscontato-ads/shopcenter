// =============================================================================
// PAS · IA opcional para escolher características NÃO regulatórias
// -----------------------------------------------------------------------------
// Usa o Lovable AI Gateway (LOVABLE_API_KEY, criado pelo Lovable Cloud) ou
// OpenAI (OPENAI_API_KEY). Sem chave, o pipeline segue só com regras.
// Modelo configurável em PAS_AI_MODEL (o padrão pode mudar no gateway).
// =============================================================================
import type { AiFn } from "./types.ts";

export function createAiFromEnv(env: { get(name: string): string | undefined } = Deno.env): AiFn | undefined {
  const lovableKey = env.get("LOVABLE_API_KEY");
  const openaiKey = env.get("OPENAI_API_KEY");
  if (!lovableKey && !openaiKey) return undefined;

  const endpoint = lovableKey ? "https://ai.gateway.lovable.dev/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
  const model = env.get("PAS_AI_MODEL") ?? (lovableKey ? "google/gemini-3.7-flash" : "gpt-4o-mini");
  const key = (lovableKey ?? openaiKey)!;

  return async (system: string, user: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          ...(lovableKey ? { "Lovable-API-Key": key } : {}),
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`IA HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("IA sem conteúdo");
      return content;
    } finally {
      clearTimeout(timer);
    }
  };
}
