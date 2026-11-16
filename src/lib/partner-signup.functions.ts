import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const partnerSignupSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  /** Código ou link de checkout da Applyfy do afiliado (opcional no cadastro). */
  affiliate: z.string().trim().max(400).optional(),
});

export const activatePartnerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => partnerSignupSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: identity, error: identityError } = await context.supabase.auth.getUser();
    const email = identity.user?.email?.trim().toLowerCase();
    if (identityError || !email) throw new Error("Não foi possível confirmar sua conta.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { affiliateCheckouts, parseAffiliateCode } = await import("@/lib/checkouts");
    const code = parseAffiliateCode(data.affiliate);
    const links = code ? affiliateCheckouts(code) : null;
    const checkout = links ? { checkout_lifetime_url: links.lifetime, checkout_monthly_url: links.monthly } : {};

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, status: "active" })
      .eq("id", context.userId);
    if (profileError) throw new Error("Não foi possível liberar seu perfil.");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("partner_profiles")
      .select("id, user_id")
      .ilike("email", email)
      .maybeSingle();
    if (existingError) throw new Error("Não foi possível verificar seu acesso de parceiro.");

    if (existing) {
      // An email alone does not prove ownership (sign-up confirms emails automatically),
      // so a partner pre-registered by the owner is linked only by the owner, never here.
      if (existing.user_id !== context.userId) {
        throw new Error("Este e-mail já tem um cadastro de parceiro. Peça ao administrador para liberar o seu acesso.");
      }
      const { error } = await supabaseAdmin
        .from("partner_profiles")
        .update({ user_id: context.userId, name: data.fullName, status: "active", ...checkout })
        .eq("id", existing.id);
      if (error) throw new Error("Não foi possível ativar seu acesso de parceiro.");
      return { ok: true };
    }

    // Sem slug: o banco atribui o próximo endereço logistica-NN.
    const { error: insertError } = await supabaseAdmin.from("partner_profiles").insert({
      user_id: context.userId,
      name: data.fullName,
      email,
      status: "active",
      notes: "Cadastro realizado pela página reservada de parceiros.",
      ...checkout,
    });
    if (insertError) throw new Error("Não foi possível criar seu acesso de parceiro.");

    return { ok: true };
  });
/**
 * O parceiro informa o próprio código/link da Applyfy e o sistema monta os dois checkouts dele.
 * Só o código muda: produto e oferta são sempre os oficiais, então ninguém aponta a venda para outro produto.
 */
export const setMyAffiliateLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ affiliate: z.string().trim().min(4).max(400) }).parse(input))
  .handler(async ({ data, context }) => {
    const { affiliateCheckouts, parseAffiliateCode } = await import("@/lib/checkouts");
    const code = parseAffiliateCode(data.affiliate);
    if (!code) throw new Error("Não reconheci o link. Cole o link de checkout da Applyfy que tem \"code=\" ou só o seu código de afiliado.");
    const links = affiliateCheckouts(code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("partner_profiles")
      .update({ checkout_lifetime_url: links.lifetime, checkout_monthly_url: links.monthly })
      .eq("user_id", context.userId)
      .eq("status", "active")
      .select("id");
    if (error || !updated?.length) throw new Error("Não foi possível salvar. Seu cadastro de parceiro precisa estar ativo.");
    return { code };
  });
