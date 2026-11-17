import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireActiveUser } from "@/lib/access-control";
import { connectProviders, MAX_STORES_PER_MARKETPLACE, normalizeShopifyDomain, type ConnectProviderId } from "@/lib/marketplace-connect";

const providerIds = connectProviders.map((p) => p.id) as [ConnectProviderId, ...ConnectProviderId[]];

export type MarketplaceConnectionSummary = {
  id: string;
  provider: ConnectProviderId;
  accountName: string | null;
  externalAccountId: string;
  status: "active" | "expired" | "revoked";
  connectedAt: string;
};

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // As tabelas novas ainda não estão nos tipos gerados do Supabase.
  return supabaseAdmin as unknown as SupabaseClient;
}

/** Status de cada marketplace (app liberado ou não) e as contas do aluno. Nunca devolve tokens. */
export const listMarketplaceConnections = createServerFn({ method: "GET" })
  .middleware([requireActiveUser])
  .handler(async ({ context }) => {
    const { configuredProviders } = await import("@/lib/marketplace-connect.server");
    const db = await admin();
    const { data, error } = await db
      .from("marketplace_connections")
      .select("id, provider, account_name, external_account_id, status, created_at")
      .eq("user_id", context.userId)
      .neq("status", "revoked")
      .order("created_at", { ascending: true });
    // Sem a tabela (migração ainda não aplicada) a tela continua abrindo, só sem contas.
    if (error) console.warn("marketplace_connections unavailable:", error.message);
    const connections: MarketplaceConnectionSummary[] = (data ?? []).map((row) => ({
      id: String(row.id),
      provider: row.provider as ConnectProviderId,
      accountName: (row.account_name as string | null) ?? null,
      externalAccountId: String(row.external_account_id),
      status: row.status as MarketplaceConnectionSummary["status"],
      connectedAt: String(row.created_at),
    }));
    return { configured: configuredProviders(), connections, ready: !error };
  });

export const beginMarketplaceConnection = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input) => z.object({ provider: z.enum(providerIds), shopDomain: z.string().max(200).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { createConnectState, getProvider } = await import("@/lib/marketplace-connect.server");
    const provider = getProvider(data.provider);
    const name = connectProviders.find((p) => p.id === data.provider)?.name ?? data.provider;
    if (!provider.configured()) throw new Error(`A conexão com ${name} ainda está aguardando a liberação do app do Shop Center.`);
    const shopDomain = data.provider === "shopify" ? normalizeShopifyDomain(data.shopDomain ?? "") : null;
    if (data.provider === "shopify" && !shopDomain) throw new Error("Endereço da loja inválido. Use algo como minhaloja.myshopify.com.");
    const db = await admin();
    const { count } = await db
      .from("marketplace_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("provider", data.provider)
      .eq("status", "active");
    if ((count ?? 0) >= MAX_STORES_PER_MARKETPLACE) {
      throw new Error(`Você já conectou ${MAX_STORES_PER_MARKETPLACE} contas ${name}, o limite por aluno. Desconecte uma para conectar outra.`);
    }
    const state = createConnectState();
    const { error } = await db.from("marketplace_oauth_states").insert({
      user_id: context.userId,
      provider: data.provider,
      state_hash: state.hash,
      code_verifier: state.codeVerifier,
      shop_domain: shopDomain,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error(`Não foi possível iniciar a conexão com ${name}.`);
    return { url: provider.buildAuthUrl({ state: state.raw, codeChallenge: state.codeChallenge, shopDomain }) };
  });

export const disconnectMarketplaceConnection = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input) => z.object({ connectionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    // Apaga os tokens junto: desconectar não deixa acesso guardado.
    const { error } = await db
      .from("marketplace_connections")
      .update({ status: "revoked", access_token: "", refresh_token: null, updated_at: new Date().toISOString() })
      .eq("id", data.connectionId)
      .eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível desconectar a conta.");
    return { ok: true };
  });
