import { createServerFn } from "@tanstack/react-start";

import { requireActiveUser } from "@/lib/access-control";

export type SalesAccess = {
  allowed: boolean;
  role: "partner" | "admin" | "user";
  partnerId: string | null;
  partnerName: string | null;
  salesPageSlug: string | null;
  status: string | null;
};

const APPROVED = new Set(["approved", "active"]);

/**
 * Acesso ao Dashboard de Vendas / notificações — exclusivo de parceiros aprovados
 * (admins também entram). Validado no servidor: esconder o menu não basta.
 * Contas criadas pelo link de parceiros que confirmaram o e-mail depois do
 * cadastro são ativadas aqui no primeiro acesso.
 */
export const getSalesAccess = createServerFn({ method: "GET" })
  .middleware([requireActiveUser])
  .handler(async ({ context }): Promise<SalesAccess> => {
    const [partnerRes, adminRes] = await Promise.all([
      context.supabase
        .from("partner_profiles")
        .select("id, name, status, slug")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("admin_users")
        .select("id, is_active")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);

    // A failed read must not look like "not a partner": the dashboard would drop to zero.
    if (partnerRes.error || adminRes.error) throw new Error("Não foi possível conferir o acesso agora.");

    let partner = partnerRes.data;
    if (!partner) {
      const meta = (context.claims["user_metadata"] ?? {}) as Record<string, unknown>;
      const email = typeof context.claims["email"] === "string" ? context.claims["email"].trim().toLowerCase() : "";
      if (meta["partner_signup"] === true && email) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const name = String(meta["full_name"] ?? email.split("@")[0]).slice(0, 120);
        const { data: existing } = await supabaseAdmin.from("partner_profiles").select("id, user_id").ilike("email", email).maybeSingle();
        // Pre-registered partner rows are never claimed by an (unverified) email match;
        // the owner links them from the partner panel.
        if (existing && existing.user_id === context.userId) {
          const { data } = await supabaseAdmin.from("partner_profiles").update({ user_id: context.userId, status: "active" }).eq("id", existing.id).select("id, name, status, slug").single();
          partner = data;
        } else if (!existing) {
          const { data } = await supabaseAdmin.from("partner_profiles").insert({
            // Sem slug: o banco atribui o próximo endereço logistica-NN.
            user_id: context.userId, name, email, status: "active",
            notes: "Cadastro realizado pela página reservada de parceiros.",
          }).select("id, name, status, slug").single();
          partner = data;
        }
      }
    }

    const isAdmin = Boolean(adminRes.data?.is_active);
    const isPartner = Boolean(partner && APPROVED.has(String(partner.status)));
    return {
      allowed: isPartner || isAdmin,
      role: isPartner ? "partner" : isAdmin ? "admin" : "user",
      partnerId: partner?.id ?? null,
      partnerName: partner?.name ?? null,
      salesPageSlug: partner?.slug ?? null,
      status: partner?.status ?? null,
    };
  });
