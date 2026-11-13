import { createFileRoute } from "@tanstack/react-router";

/** Diagnóstico sem segredos: o servidor consegue falar com o banco usando a chave de serviço? */
export const Route = createFileRoute("/api/public/saude")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env["SUPABASE_URL"]?.trim() ?? "";
        const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.replace(/\s+/g, "") ?? "";
        let role = "desconhecido";
        try { role = key.startsWith("sb_secret_") ? "sb_secret" : String(JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString())["role"] ?? "?"); } catch { role = "chave ilegível"; }
        const out: Record<string, unknown> = {
          supabase_url: url ? new URL(url).host : "FALTANDO",
          service_key: key ? `${key.length} caracteres, tipo ${role}, ${/^[\x21-\x7e]+$/.test(key) ? "só caracteres válidos" : "TEM CARACTERE INVÁLIDO"}` : "FALTANDO",
          shopee_partner: process.env["SHOPEE_PARTNER_ID"] ? "ok" : "faltando",
          applyfy_token: process.env["APPLYFY_WEBHOOK_TOKEN"] ? "ok" : "faltando",
          resend: process.env["RESEND_API_KEY"] ? "ok" : "faltando",
          ia_textos: process.env["OPENROUTER_API_KEY"] ? "ok (OpenRouter)" : process.env["LOVABLE_API_KEY"] ? "ok (Lovable)" : "faltando (OPENROUTER_API_KEY)",
          ia_imagens: process.env["OPENROUTER_API_KEY"] ? "ok (OpenRouter)" : process.env["GEMINI_API_KEY"] ? "ok (Google)" : "faltando (OPENROUTER_API_KEY)",
          versao: "painel-suporte-v3",
          hora_do_servidor: new Date().toISOString(),
        };
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { count, error } = await supabaseAdmin.from("shopee_shop_connections").select("id", { count: "exact", head: true });
          out["banco_com_chave_de_servico"] = error ? `ERRO: ${error.message} ${error.details ?? ""}`.trim() : `ok (${count} lojas)`;
        } catch (error) {
          out["banco_com_chave_de_servico"] = `ERRO: ${error instanceof Error ? `${error.message} ${(error as { cause?: Error }).cause?.message ?? ""}` : String(error)}`;
        }
        try {
          const { diagnoseShopeeAuth } = await import("@/lib/shopee.server");
          out["shopee_producao"] = await diagnoseShopeeAuth();
        } catch (error) {
          out["shopee_producao"] = `ERRO: ${error instanceof Error ? `${error.message} ${(error as { cause?: Error }).cause?.message ?? ""}` : String(error)}`;
        }
        return Response.json(out, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
