// =============================================================================
// PAS · Credenciais da loja + renovação do access_token (expira a cada 4 h)
// -----------------------------------------------------------------------------
// ADAPTAR: o ideal é reaproveitar a função que o projeto JÁ usa para pegar o
// token válido da loja (a mesma da publicação atual). Este arquivo é o
// fallback: lê a tabela de lojas e só renova o token se conseguir salvar o
// novo refresh_token (na Shopee ele é de uso único — perder = loja desconectada).
// =============================================================================
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import { buildSignedUrl, SHOPEE_BR_BASE_URL, type ShopeeAuth } from "./client.ts";

const SHOPS_TABLE = Deno.env.get("PAS_SHOPS_TABLE") ?? "shopee_shops";

/** Primeiro nome de coluna que EXISTE na linha (mesmo que o valor seja null). */
function colName(row: Record<string, unknown>, ...names: string[]): string | null {
  return names.find((n) => Object.prototype.hasOwnProperty.call(row, n)) ?? null;
}

export async function loadShopAuth(sb: SupabaseClient, shopId: number, userId?: string): Promise<ShopeeAuth> {
  const partnerId = Number(Deno.env.get("SHOPEE_PARTNER_ID"));
  const partnerKey = Deno.env.get("SHOPEE_PARTNER_KEY") ?? "";
  const baseUrl = Deno.env.get("SHOPEE_API_BASE_URL") ?? SHOPEE_BR_BASE_URL;
  if (!partnerId || !partnerKey) throw new Error("SHOPEE_PARTNER_ID/SHOPEE_PARTNER_KEY não configurados");

  let q = sb.from(SHOPS_TABLE).select("*").eq("shop_id", shopId);
  if (userId) q = q.eq("user_id", userId);
  const { data: row, error } = await q.maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Loja não encontrada para este usuário");

  const accessCol = colName(row, "access_token", "shopee_access_token", "token");
  const refreshCol = colName(row, "refresh_token", "shopee_refresh_token");
  const expCol = colName(row, "expires_at", "token_expires_at", "access_token_expires_at", "expire_at");
  if (!accessCol) throw new Error(`Tabela ${SHOPS_TABLE} sem coluna de access_token — ligue loadShopAuth ao helper de token do projeto`);

  let accessToken = String(row[accessCol] ?? "");
  const expiresAt = expCol && row[expCol] ? new Date(row[expCol]).getTime() : NaN;
  const needsRefresh = !accessToken || (Number.isFinite(expiresAt) && expiresAt - Date.now() < 10 * 60 * 1000);

  if (needsRefresh && refreshCol && expCol && row[refreshCol] && Deno.env.get("PAS_REFRESH_TOKENS") !== "false") {
    const url = await buildSignedUrl({ partnerId, partnerKey, shopId, accessToken: "", baseUrl }, "/api/v2/auth/access_token/get", {}, "public");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: row[refreshCol], partner_id: partnerId, shop_id: shopId }),
    });
    const j = await res.json();
    if (!j?.access_token) throw new Error(`A conexão com a loja expirou. Reconecte a loja Shopee no PAS. (${j?.error ?? ""} ${j?.message ?? ""})`);
    const { error: upErr } = await sb.from(SHOPS_TABLE).update({
      [accessCol]: j.access_token,
      [refreshCol]: j.refresh_token ?? row[refreshCol],
      [expCol]: new Date(Date.now() + Number(j.expire_in ?? 14400) * 1000).toISOString(),
    }).eq("shop_id", shopId);
    if (upErr) throw new Error(`Token renovado mas não salvo (${upErr.message}). Verifique a tabela ${SHOPS_TABLE}.`);
    accessToken = j.access_token;
  }
  if (!accessToken) throw new Error("A conexão com a loja expirou. Reconecte a loja Shopee no PAS.");
  return { partnerId, partnerKey, shopId, accessToken, baseUrl };
}
