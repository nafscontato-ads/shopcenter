import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type AccessRow = { email: string; signup_token_expires_at: string | null; signup_used_at: string | null; status: string };

async function findByToken(token: string) {
  const { hashToken } = await import("@/lib/purchase-access.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("purchase_access" as never)
    .select("email, signup_token_expires_at, signup_used_at, status")
    .eq("signup_token_hash", hashToken(token))
    .maybeSingle();
  const row = data as AccessRow | null;
  if (!row || row.status !== "active") return { row: null, reason: "Link inválido. Use o link que chegou no seu e-mail de compra." };
  if (row.signup_used_at) return { row: null, reason: "Este link já foi usado. Entre com seu e-mail e senha." };
  if (row.signup_token_expires_at && Date.parse(row.signup_token_expires_at) < Date.now()) return { row: null, reason: "Este link expirou. Fale com o suporte para receber outro." };
  return { row, reason: null };
}

const tokenSchema = z.string().trim().min(20).max(80).regex(/^[A-Za-z0-9_-]+$/);

/** Abre a página de cadastro: devolve o e-mail da compra se o link vale. */
export const readSignupLink = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }) => {
    const { row, reason } = await findByToken(data.token);
    return row ? { ok: true as const, email: row.email } : { ok: false as const, reason: reason ?? "Link inválido." };
  });

/** Cria a conta já confirmada (o link do e-mail prova que a pessoa é dona do e-mail). */
export const completeSignup = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: tokenSchema,
    fullName: z.string().trim().min(3).max(120),
    password: z.string().min(8).max(72),
  }).parse(input))
  .handler(async ({ data }) => {
    const { row, reason } = await findByToken(data.token);
    if (!row) throw new Error(reason ?? "Link inválido.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: row.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName.replace(/\s+/g, " ") },
    });
    if (error && !/already|registered|exists/i.test(error.message)) throw new Error(`Não foi possível criar a conta: ${error.message}`);
    await supabaseAdmin.from("purchase_access" as never).update({ signup_used_at: new Date().toISOString() } as never).eq("email", row.email);
    if (error) throw new Error("Este e-mail já tem conta. Entre com sua senha ou use 'Esqueci minha senha'.");
    return { email: row.email };
  });
