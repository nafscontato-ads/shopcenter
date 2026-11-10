import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Webhook da Applyfy: compra aprovada libera o e-mail do comprador;
 * reembolso/chargeback/cancelamento revoga. URL:
 * https://shopcenter.cloud/api/public/applyfy/webhook?token=APPLYFY_WEBHOOK_TOKEN
 */
export const Route = createFileRoute("/api/public/applyfy/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { sameSecret, readPurchaseEvent, applyPurchaseEvent } = await import("@/lib/purchase-access.server");
        const expected = process.env["APPLYFY_WEBHOOK_TOKEN"]?.trim();
        const url = new URL(request.url);
        const given = url.searchParams.get("token") ?? request.headers.get("x-webhook-token") ?? "";
        if (!expected || !sameSecret(given, expected)) return new Response("unauthorized", { status: 401 });

        const raw = await request.text();
        let body: Record<string, unknown> | null = null;
        try { body = JSON.parse(raw) as Record<string, unknown>; }
        catch { body = Object.fromEntries(new URLSearchParams(raw)); }
        if (!body || typeof body !== "object") return new Response("ignored", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as unknown as SupabaseClient;
        const parsed = readPurchaseEvent(body);
        let result = "ignorado";
        try {
          if (!parsed.email) result = "sem e-mail no payload";
          else if (parsed.action !== "ignore") result = await applyPurchaseEvent(db, parsed.email, parsed.action, parsed.event, parsed.offer);
        } catch (error) {
          result = `erro: ${error instanceof Error ? error.message : String(error)}`;
          console.error("[applyfy-webhook]", result);
        }
        await db.from("purchase_webhook_events").insert({ source: "applyfy", email: parsed.email, event: parsed.event, result, payload: body });
        return Response.json({ ok: true, result });
      },
    },
  },
});
