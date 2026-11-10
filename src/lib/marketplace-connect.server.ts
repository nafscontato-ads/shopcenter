import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConnectProviderId } from "@/lib/marketplace-connect";

/**
 * Conexão oficial (OAuth) com os marketplaces além da Shopee.
 * Cada provedor só fica ativo quando o app do Shop Center está cadastrado nele
 * e as chaves estão nas variáveis de ambiente do servidor.
 */

const PUBLIC_SITE_URL = (process.env["PUBLIC_SITE_URL"] || "https://shopcenter.cloud").replace(/\/+$/, "");

/** O Mercado Livre usa um endereço próprio, que já foi passado para o cadastro do app. */
export function callbackUrl(provider: ConnectProviderId) {
  if (provider === "mercado-livre") return `${PUBLIC_SITE_URL}/api/public/mercadolivre/callback`;
  return `${PUBLIC_SITE_URL}/api/public/marketplaces/${provider}/callback`;
}

export type TokenResult = {
  externalAccountId: string;
  accountName: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  scopes: string | null;
  metadata: Record<string, unknown>;
};

export type StartContext = { state: string; codeChallenge: string; shopDomain: string | null };
export type CallbackContext = { params: URLSearchParams; codeVerifier: string | null; shopDomain: string | null };

type Provider = {
  configured(): boolean;
  buildAuthUrl(ctx: StartContext): string;
  /** Lê o retorno do marketplace e troca o código pela autorização da loja. */
  exchange(ctx: CallbackContext): Promise<TokenResult>;
  refresh?(refreshToken: string, metadata: Record<string, unknown>): Promise<Omit<TokenResult, "externalAccountId" | "accountName" | "metadata"> & { metadata?: Record<string, unknown> }>;
};

function env(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function inSeconds(seconds: unknown) {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? new Date(Date.now() + n * 1000).toISOString() : null;
}

function atUnix(timestamp: unknown) {
  const n = Number(timestamp);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

async function readJson(response: Response, fallback: string) {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = body["message"] ?? body["error_description"] ?? body["error"] ?? fallback;
    throw new Error(String(message).slice(0, 200));
  }
  return body;
}

function requireParam(params: URLSearchParams, name: string, message: string) {
  const value = params.get(name);
  if (!value) throw new Error(message);
  return value;
}

// ---------------------------------------------------------------- Mercado Livre
// https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao

const ML_AUTH = "https://auth.mercadolivre.com.br/authorization";
const ML_API = "https://api.mercadolibre.com";

async function mlToken(body: Record<string, string>) {
  const response = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(body),
  });
  return readJson(response, "O Mercado Livre recusou a autorização.");
}

const mercadoLivre: Provider = {
  configured: () => Boolean(env("ML_CLIENT_ID") && env("ML_CLIENT_SECRET")),
  buildAuthUrl({ state, codeChallenge }) {
    const query = new URLSearchParams({
      response_type: "code",
      client_id: env("ML_CLIENT_ID")!,
      redirect_uri: callbackUrl("mercado-livre"),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    return `${ML_AUTH}?${query}`;
  },
  async exchange({ params, codeVerifier }) {
    const code = requireParam(params, "code", "O Mercado Livre não confirmou a autorização.");
    const token = await mlToken({
      grant_type: "authorization_code",
      client_id: env("ML_CLIENT_ID")!,
      client_secret: env("ML_CLIENT_SECRET")!,
      code,
      redirect_uri: callbackUrl("mercado-livre"),
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });
    const accessToken = String(token["access_token"] ?? "");
    if (!accessToken) throw new Error("O Mercado Livre não devolveu a autorização da conta.");
    let accountName: string | null = null;
    let siteId: string | null = null;
    try {
      const me = await readJson(await fetch(`${ML_API}/users/me`, { headers: { authorization: `Bearer ${accessToken}` } }), "");
      accountName = me["nickname"] ? String(me["nickname"]) : null;
      siteId = me["site_id"] ? String(me["site_id"]) : null;
    } catch (error) {
      console.warn("Mercado Livre /users/me unavailable after authorization:", error instanceof Error ? error.message : error);
    }
    return {
      externalAccountId: String(token["user_id"]),
      accountName,
      accessToken,
      refreshToken: token["refresh_token"] ? String(token["refresh_token"]) : null,
      tokenExpiresAt: inSeconds(token["expires_in"]),
      // O refresh token do ML vale 6 meses e é trocado a cada renovação.
      refreshTokenExpiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      scopes: token["scope"] ? String(token["scope"]) : null,
      metadata: { site_id: siteId },
    };
  },
  async refresh(refreshToken) {
    const token = await mlToken({
      grant_type: "refresh_token",
      client_id: env("ML_CLIENT_ID")!,
      client_secret: env("ML_CLIENT_SECRET")!,
      refresh_token: refreshToken,
    });
    return {
      accessToken: String(token["access_token"]),
      refreshToken: token["refresh_token"] ? String(token["refresh_token"]) : refreshToken,
      tokenExpiresAt: inSeconds(token["expires_in"]),
      refreshTokenExpiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      scopes: token["scope"] ? String(token["scope"]) : null,
    };
  },
};

// ---------------------------------------------------------------- Shopify
// https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant

const SHOPIFY_SCOPES = "read_products,write_products,read_orders,write_orders,read_fulfillments,write_fulfillments,read_inventory,write_inventory";

function shopifyHmacValid(params: URLSearchParams, secret: string) {
  const hmac = params.get("hmac");
  if (!hmac) return false;
  const message = [...params.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const expected = Buffer.from(createHmac("sha256", secret).update(message).digest("hex"), "hex");
  const actual = Buffer.from(hmac, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const shopify: Provider = {
  configured: () => Boolean(env("SHOPIFY_CLIENT_ID") && env("SHOPIFY_CLIENT_SECRET")),
  buildAuthUrl({ state, shopDomain }) {
    if (!shopDomain) throw new Error("Informe o endereço da sua loja Shopify.");
    const query = new URLSearchParams({
      client_id: env("SHOPIFY_CLIENT_ID")!,
      scope: env("SHOPIFY_SCOPES") ?? SHOPIFY_SCOPES,
      redirect_uri: callbackUrl("shopify"),
      state,
    });
    return `https://${shopDomain}/admin/oauth/authorize?${query}`;
  },
  async exchange({ params, shopDomain }) {
    const secret = env("SHOPIFY_CLIENT_SECRET")!;
    if (!shopifyHmacValid(params, secret)) throw new Error("A assinatura da Shopify não confere. Tente conectar de novo.");
    const shop = params.get("shop");
    if (!shop || shop !== shopDomain) throw new Error("A Shopify devolveu uma loja diferente da que você informou.");
    const code = requireParam(params, "code", "A Shopify não confirmou a autorização.");
    const token = await readJson(await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ client_id: env("SHOPIFY_CLIENT_ID"), client_secret: secret, code }),
    }), "A Shopify recusou a autorização.");
    const accessToken = String(token["access_token"] ?? "");
    if (!accessToken) throw new Error("A Shopify não devolveu a autorização da loja.");
    let accountName: string | null = null;
    try {
      const info = await readJson(await fetch(`https://${shop}/admin/api/2025-01/shop.json`, { headers: { "x-shopify-access-token": accessToken } }), "");
      accountName = String((info["shop"] as Record<string, unknown> | undefined)?.["name"] ?? "") || null;
    } catch (error) {
      console.warn("Shopify shop info unavailable after authorization:", error instanceof Error ? error.message : error);
    }
    return {
      externalAccountId: shop,
      accountName: accountName ?? shop,
      accessToken,
      refreshToken: token["refresh_token"] ? String(token["refresh_token"]) : null,
      tokenExpiresAt: inSeconds(token["expires_in"]),
      refreshTokenExpiresAt: inSeconds(token["refresh_token_expires_in"]),
      scopes: token["scope"] ? String(token["scope"]) : null,
      metadata: { shop },
    };
  },
};

// ---------------------------------------------------------------- TikTok Shop
// https://partner.tiktokshop.com/docv2/page/authorization-overview

const TIKTOK_AUTH_API = "https://auth.tiktok-shops.com/api/v2/token";

async function tiktokToken(query: Record<string, string>) {
  const response = await fetch(`${TIKTOK_AUTH_API}/${query["grant_type"] === "refresh_token" ? "refresh" : "get"}?${new URLSearchParams(query)}`);
  const body = await readJson(response, "O TikTok Shop recusou a autorização.");
  if (Number(body["code"] ?? 0) !== 0) throw new Error(String(body["message"] ?? "O TikTok Shop recusou a autorização."));
  return (body["data"] ?? {}) as Record<string, unknown>;
}

const tiktokShop: Provider = {
  configured: () => Boolean(env("TIKTOK_SHOP_APP_KEY") && env("TIKTOK_SHOP_APP_SECRET") && env("TIKTOK_SHOP_SERVICE_ID")),
  buildAuthUrl({ state }) {
    // O endereço de retorno fica cadastrado no Partner Center, não vai na URL.
    const query = new URLSearchParams({ service_id: env("TIKTOK_SHOP_SERVICE_ID")!, state });
    return `https://services.tiktokshop.com/open/authorize?${query}`;
  },
  async exchange({ params }) {
    const code = requireParam(params, "code", "O TikTok Shop não confirmou a autorização.");
    const data = await tiktokToken({
      app_key: env("TIKTOK_SHOP_APP_KEY")!,
      app_secret: env("TIKTOK_SHOP_APP_SECRET")!,
      auth_code: code,
      grant_type: "authorized_code",
    });
    const accessToken = String(data["access_token"] ?? "");
    if (!accessToken) throw new Error("O TikTok Shop não devolveu a autorização da loja.");
    return {
      externalAccountId: String(data["open_id"] ?? data["seller_name"] ?? ""),
      accountName: data["seller_name"] ? String(data["seller_name"]) : null,
      accessToken,
      refreshToken: data["refresh_token"] ? String(data["refresh_token"]) : null,
      tokenExpiresAt: atUnix(data["access_token_expire_in"]),
      refreshTokenExpiresAt: atUnix(data["refresh_token_expire_in"]),
      scopes: Array.isArray(data["granted_scopes"]) ? (data["granted_scopes"] as unknown[]).join(",") : null,
      metadata: { region: data["seller_base_region"] ?? null },
    };
  },
  async refresh(refreshToken) {
    const data = await tiktokToken({
      app_key: env("TIKTOK_SHOP_APP_KEY")!,
      app_secret: env("TIKTOK_SHOP_APP_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    return {
      accessToken: String(data["access_token"]),
      refreshToken: data["refresh_token"] ? String(data["refresh_token"]) : refreshToken,
      tokenExpiresAt: atUnix(data["access_token_expire_in"]),
      refreshTokenExpiresAt: atUnix(data["refresh_token_expire_in"]),
      scopes: null,
    };
  },
};

// ---------------------------------------------------------------- Amazon (SP-API)
// https://developer-docs.amazon.com/sp-api/docs/website-authorization-workflow

const LWA_TOKEN = "https://api.amazon.com/auth/o2/token";

async function lwaToken(body: Record<string, string>) {
  const response = await fetch(LWA_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, client_id: env("AMAZON_LWA_CLIENT_ID")!, client_secret: env("AMAZON_LWA_CLIENT_SECRET")! }),
  });
  return readJson(response, "A Amazon recusou a autorização.");
}

const amazon: Provider = {
  configured: () => Boolean(env("AMAZON_SP_APP_ID") && env("AMAZON_LWA_CLIENT_ID") && env("AMAZON_LWA_CLIENT_SECRET")),
  buildAuthUrl({ state }) {
    const query = new URLSearchParams({ application_id: env("AMAZON_SP_APP_ID")!, state, redirect_uri: callbackUrl("amazon") });
    // Enquanto o app não for publicado, a Amazon exige version=beta.
    if (env("AMAZON_SP_DRAFT") === "true") query.set("version", "beta");
    return `https://sellercentral.amazon.com.br/apps/authorize/consent?${query}`;
  },
  async exchange({ params }) {
    const code = requireParam(params, "spapi_oauth_code", "A Amazon não confirmou a autorização.");
    const sellerId = requireParam(params, "selling_partner_id", "A Amazon não informou qual conta foi autorizada.");
    const token = await lwaToken({ grant_type: "authorization_code", code, redirect_uri: callbackUrl("amazon") });
    const accessToken = String(token["access_token"] ?? "");
    if (!accessToken) throw new Error("A Amazon não devolveu a autorização da conta.");
    return {
      externalAccountId: sellerId,
      accountName: `Amazon ${sellerId}`,
      accessToken,
      refreshToken: token["refresh_token"] ? String(token["refresh_token"]) : null,
      tokenExpiresAt: inSeconds(token["expires_in"]),
      refreshTokenExpiresAt: null,
      scopes: null,
      metadata: { marketplace: "A2Q3Y263D00KWC" },
    };
  },
  async refresh(refreshToken) {
    const token = await lwaToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    return {
      accessToken: String(token["access_token"]),
      refreshToken,
      tokenExpiresAt: inSeconds(token["expires_in"]),
      refreshTokenExpiresAt: null,
      scopes: null,
    };
  },
};

// ---------------------------------------------------------------- Magalu
// https://developers.magalu.com (ID Magalu, OAuth 2.0)

const MAGALU_ID = "https://id.magalu.com";

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function magaluToken(body: Record<string, string>) {
  const response = await fetch(`${MAGALU_ID}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ ...body, client_id: env("MAGALU_CLIENT_ID"), client_secret: env("MAGALU_CLIENT_SECRET") }),
  });
  return readJson(response, "O Magalu recusou a autorização.");
}

const magalu: Provider = {
  configured: () => Boolean(env("MAGALU_CLIENT_ID") && env("MAGALU_CLIENT_SECRET") && env("MAGALU_SCOPES")),
  buildAuthUrl({ state }) {
    const query = new URLSearchParams({
      client_id: env("MAGALU_CLIENT_ID")!,
      redirect_uri: callbackUrl("magalu"),
      scope: env("MAGALU_SCOPES")!,
      response_type: "code",
      choose_tenants: "true",
      state,
    });
    return `${MAGALU_ID}/login?${query}`;
  },
  async exchange({ params }) {
    const code = requireParam(params, "code", "O Magalu não confirmou a autorização.");
    const token = await magaluToken({ grant_type: "authorization_code", code, redirect_uri: callbackUrl("magalu") });
    const accessToken = String(token["access_token"] ?? "");
    if (!accessToken) throw new Error("O Magalu não devolveu a autorização da conta.");
    const claims = decodeJwtPayload(accessToken);
    const tenant = String(claims["tenant"] ?? claims["sub"] ?? "");
    if (!tenant) throw new Error("O Magalu não informou qual conta foi autorizada.");
    return {
      externalAccountId: tenant,
      accountName: claims["name"] ? String(claims["name"]) : "Conta Magalu",
      accessToken,
      refreshToken: token["refresh_token"] ? String(token["refresh_token"]) : null,
      tokenExpiresAt: inSeconds(token["expires_in"]),
      refreshTokenExpiresAt: null,
      scopes: token["scope"] ? String(token["scope"]) : null,
      metadata: {},
    };
  },
  async refresh(refreshToken) {
    const token = await magaluToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    return {
      accessToken: String(token["access_token"]),
      refreshToken: token["refresh_token"] ? String(token["refresh_token"]) : refreshToken,
      tokenExpiresAt: inSeconds(token["expires_in"]),
      refreshTokenExpiresAt: null,
      scopes: token["scope"] ? String(token["scope"]) : null,
    };
  },
};

const providers: Record<ConnectProviderId, Provider> = {
  "mercado-livre": mercadoLivre,
  shopify,
  "tiktok-shop": tiktokShop,
  amazon,
  magalu,
};

export function getProvider(id: ConnectProviderId) {
  return providers[id];
}

export function configuredProviders(): Record<ConnectProviderId, boolean> {
  return Object.fromEntries(Object.entries(providers).map(([id, p]) => [id, p.configured()])) as Record<ConnectProviderId, boolean>;
}

export function createConnectState() {
  const raw = randomBytes(32).toString("hex");
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { raw, hash: hashConnectState(raw), codeVerifier, codeChallenge };
}

export function hashConnectState(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

// ---------------------------------------------------------------- Tokens sempre válidos

type ConnectionRow = {
  id: string;
  provider: ConnectProviderId;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  metadata: Record<string, unknown> | null;
};

/**
 * Devolve um token válido da conexão, renovando antes de vencer.
 * As próximas etapas (publicar, pedidos, etiquetas) usam esta função.
 */
export async function freshMarketplaceToken(db: SupabaseClient, connectionId: string) {
  const { data, error } = await db
    .from("marketplace_connections")
    .select("id, provider, access_token, refresh_token, token_expires_at, metadata")
    .eq("id", connectionId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) throw new Error("Conexão do marketplace não encontrada.");
  const row = data as ConnectionRow;
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : Infinity;
  if (expiresAt - Date.now() > 5 * 60 * 1000) return row.access_token;
  const provider = providers[row.provider];
  if (!provider.refresh || !row.refresh_token) return row.access_token;
  try {
    const next = await provider.refresh(row.refresh_token, row.metadata ?? {});
    await db.from("marketplace_connections").update({
      access_token: next.accessToken,
      refresh_token: next.refreshToken,
      token_expires_at: next.tokenExpiresAt,
      refresh_token_expires_at: next.refreshTokenExpiresAt,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    return next.accessToken;
  } catch (error) {
    await db.from("marketplace_connections").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", row.id);
    throw new Error(`A autorização da conta expirou. Conecte de novo. (${error instanceof Error ? error.message : "erro"})`);
  }
}
