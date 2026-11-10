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
        // O ML não assina as notificações: só aceitamos as do nosso app e de uma
        // conta conectada. O conteúdo real é sempre relido na API do ML com o
        // token da conta, nunca confiado a partir deste corpo.
        const appId = process.env["ML_CLIENT_ID"]?.trim();
        const userId = body["user_id"] != null ? String(body["user_id"]) : "";
        if (!appId || String(body["application_id"] ?? "") !== appId || !/^\d{1,20}$/.test(userId)) {
          return new Response("ignored", { status: 200 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as unknown as SupabaseClient;
          const { count } = await db
            .from("marketplace_connections")
            .select("id", { count: "exact", head: true })
            .eq("provider", "mercado-livre")
            .eq("external_account_id", userId)
            .eq("status", "active");
          if (!count) return new Response("ignored", { status: 200 });
          await db.from("marketplace_notifications").insert({
            provider: "mercado-livre",
            topic: String(body["topic"]).slice(0, 60),
            resource: String(body["resource"]).slice(0, 300),
            external_account_id: userId,
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
