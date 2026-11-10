import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Webhook da Applyfy. URL: https://shopcenter.cloud/api/public/applyfy/webhook
 * Autenticação: o token do webhook (o que a Applyfy mostra na lista, ex. "blha1sdi")
 * vai em APPLYFY_WEBHOOK_TOKEN; aceitamos no corpo, no header ou em ?token=.
 * Só "transação paga" libera. Reembolso/chargeback ficam só registrados.
 */
export const Route = createFileRoute("/api/public/applyfy/webhook")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, info: "Webhook da Applyfy ativo. Envie POST." }),
      POST: async ({ request }) => {
        const { sameSecret, bodyToken, readPurchaseEvent, approvePurchase } = await import("@/lib/purchase-access.server");
        const raw = (await request.text()).slice(0, 200_000);
        let body: Record<string, unknown> = {};
        try { body = JSON.parse(raw) as Record<string, unknown>; }
        catch { body = Object.fromEntries(new URLSearchParams(raw)); }

        const expected = (process.env["APPLYFY_WEBHOOK_TOKEN"] ?? "").split(",").map((v) => v.trim()).filter(Boolean);
        const url = new URL(request.url);
        const candidates = [
          url.searchParams.get("token") ?? "",
          request.headers.get("x-webhook-token") ?? "",
          request.headers.get("x-applyfy-token") ?? "",
          (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""),
          bodyToken(body),
        ].filter(Boolean);
        const authorized = expected.length > 0 && candidates.some((c) => expected.some((e) => sameSecret(c, e)));

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as unknown as SupabaseClient;
        const parsed = readPurchaseEvent(body);
        let result = "ignorado (não é pagamento aprovado)";
        if (!authorized) result = "token inválido";
        else if (!parsed.email) result = "sem e-mail no payload";
        else if (parsed.paid) {
          try { result = await approvePurchase(db, parsed.email, parsed.name, parsed.event, parsed.offer); }
          catch (error) { result = `erro: ${error instanceof Error ? error.message : String(error)}`; console.error("[applyfy-webhook]", result); }
        }
        // Guarda tudo (sem headers) para conferência e ajuste do formato.
        await db.from("purchase_webhook_events").insert({ source: "applyfy", email: parsed.email, event: parsed.event, result, payload: body });
        return Response.json({ ok: authorized, result }, { status: authorized ? 200 : 401 });
      },
    },
  },
});
