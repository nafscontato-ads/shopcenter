import { createMiddleware } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Exige autenticação e uma conta explicitamente liberada pelo administrador. */
export const requireActiveUser = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("status")
      .eq("id", context.userId)
      .maybeSingle();

    if (error || !profile || profile.status !== "active") {
      throw new Error(profile?.status === "pending"
        ? "Acesso não liberado: não encontramos compra do Shop Center com o e-mail desta conta. Fale com o suporte."
        : "Acesso não liberado. Fale com o responsável pela sua conta.");
    }

    return next({ context });
  });
/**
 * The platform owner is the active super_admin row bound to this account id.
 * Never decided by email: sign-up confirms emails automatically.
 */
export async function isOwnerAccount(supabase: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("admin_users")
    .select("role, is_active")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data?.is_active && data.role === "super_admin");
}

/** Owner or an active/approved partner: the accounts that see the partner-only catalogue. */
export async function isPartnerOrOwner(supabase: SupabaseClient<Database>, userId: string): Promise<boolean> {
  if (await isOwnerAccount(supabase, userId)) return true;
  const { data } = await supabase.from("partner_profiles").select("status").eq("user_id", userId).maybeSingle();
  return data?.status === "active" || data?.status === "approved";
}
