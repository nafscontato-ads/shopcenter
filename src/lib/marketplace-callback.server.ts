import type { SupabaseClient } from "@supabase/supabase-js";

import { connectProviders, isConnectProviderId, MAX_STORES_PER_MARKETPLACE } from "@/lib/marketplace-connect";

/**
 * Retorno da autorização de qualquer marketplace. Sempre volta para a tela
 * Integração com ?mkt=<marketplace>&mkt_status=success|error.
 */
export async function handleMarketplaceCallback(request: Request, providerParam: string) {
  const url = new URL(request.url);
  const destination = new URL("/shopee", (process.env["PUBLIC_SITE_URL"] || url.origin).replace(/\/+$/, ""));
  destination.searchParams.set("mkt", providerParam);
  const fail = (reason: string) => {
    destination.searchParams.set("mkt_status", "error");
    destination.searchParams.set("mkt_reason", reason.slice(0, 200));
    return Response.redirect(destination, 302);
  };
  if (!isConnectProviderId(providerParam)) return fail("Marketplace desconhecido.");
  const provider = providerParam;
  const name = connectProviders.find((p) => p.id === provider)?.name ?? provider;
  const providerError = url.searchParams.get("error") ?? url.searchParams.get("error_code");
  if (providerError) return fail(url.searchParams.get("error_description") ?? url.searchParams.get("message") ?? `A autorização foi recusada no ${name}.`);
  const state = url.searchParams.get("state");
  if (!state) return fail(`O ${name} não devolveu a confirmação de segurança. Inicie a conexão novamente.`);

  try {
    const { getProvider, hashConnectState } = await import("@/lib/marketplace-connect.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as SupabaseClient;
    const { data: oauthState } = await db
      .from("marketplace_oauth_states")
      .select("id, user_id, provider, code_verifier, shop_domain, expires_at, used_at")
      .eq("state_hash", hashConnectState(state))
      .maybeSingle();
    if (!oauthState || oauthState.used_at || oauthState.provider !== provider || new Date(String(oauthState.expires_at)).getTime() < Date.now()) {
      throw new Error("Autorização inválida ou expirada. Clique em integrar de novo.");
    }
    // Marca como usada antes de trocar o código: o mesmo retorno não conecta duas vezes.
    await db.from("marketplace_oauth_states").update({ used_at: new Date().toISOString() }).eq("id", oauthState.id);

    const result = await getProvider(provider).exchange({
      params: url.searchParams,
      codeVerifier: (oauthState.code_verifier as string | null) ?? null,
      shopDomain: (oauthState.shop_domain as string | null) ?? null,
    });
    if (!result.externalAccountId) throw new Error(`O ${name} não informou qual conta foi autorizada.`);

    const { data: active } = await db
      .from("marketplace_connections")
      .select("external_account_id")
      .eq("user_id", oauthState.user_id)
      .eq("provider", provider)
      .eq("status", "active");
    const others = (active ?? []).filter((row) => String(row.external_account_id) !== result.externalAccountId);
    if (others.length >= MAX_STORES_PER_MARKETPLACE) {
      throw new Error(`Limite de ${MAX_STORES_PER_MARKETPLACE} contas ${name} por aluno atingido.`);
    }

    const { error } = await db.from("marketplace_connections").upsert({
      user_id: oauthState.user_id,
      provider,
      external_account_id: result.externalAccountId,
      account_name: result.accountName,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      token_expires_at: result.tokenExpiresAt,
      refresh_token_expires_at: result.refreshTokenExpiresAt,
      scopes: result.scopes,
      metadata: result.metadata,
      status: "active",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider,external_account_id" });
    if (error) throw error;
    destination.searchParams.set("mkt_status", "success");
    return Response.redirect(destination, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : `O ${name} não concluiu a conexão.`;
    console.error(`Marketplace OAuth callback failed (${provider}):`, message);
    return fail(message);
  }
}
