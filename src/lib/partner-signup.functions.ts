import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const partnerSignupSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
});

export const activatePartnerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => partnerSignupSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: identity, error: identityError } = await context.supabase.auth.getUser();
    const email = identity.user?.email?.trim().toLowerCase();
    if (identityError || !email) throw new Error("Não foi possível confirmar sua conta.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
        .update({ user_id: context.userId, name: data.fullName, status: "active" })
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
    });
    if (insertError) throw new Error("Não foi possível criar seu acesso de parceiro.");

    return { ok: true };
  });