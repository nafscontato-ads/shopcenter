import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Notificações do Mercado Livre (vendas, anúncios, envios).
 * O ML exige resposta 200 rápida; aqui só guardamos o aviso para processar depois.
 */
export const Route = createFileRoute("/api/public/mercadolivre/notificacoes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body || typeof body["topic"] !== "string" || typeof body["resource"] !== "string") {
          return new Response("ignored", { status: 200 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as unknown as SupabaseClient;
          await db.from("marketplace_notifications").insert({
            provider: "mercado-livre",
            topic: String(body["topic"]).slice(0, 60),
            resource: String(body["resource"]).slice(0, 300),
            external_account_id: body["user_id"] != null ? String(body["user_id"]) : null,
            payload: body,
          });
        } catch (error) {
          console.error("Mercado Livre notification not stored:", error instanceof Error ? error.message : error);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
