// =============================================================================
// PAS · Cliente assinado da Shopee Open Platform v2 (Deno / Supabase Edge)
// -----------------------------------------------------------------------------
// - Assina toda chamada com HMAC-SHA256 (partner_id + path + timestamp
//   [+ access_token + shop_id]).
// - Repete sozinho quando a Shopee devolve 429/5xx ou erro de "busy/server".
// - Se o SaaS já tiver um helper próprio de chamada, ele pode ser usado no
//   lugar deste: basta respeitar a assinatura `ShopeeCaller`.
// =============================================================================

export const SHOPEE_BR_BASE_URL = "https://openplatform.shopee.com.br";
export const SHOPEE_GLOBAL_BASE_URL = "https://partner.shopeemobile.com";

export interface ShopeeAuth {
  partnerId: number;
  partnerKey: string;
  shopId: number;
  accessToken: string;
  /** Padrão: host do Brasil. */
  baseUrl?: string;
}

export interface ShopeeRequestOptions {
  method?: "GET" | "POST";
  /** Arrays viram parâmetros repetidos (?a=1&a=2). Para lista com vírgula, mande string "1,2". */
  query?: Record<string, string | number | boolean | Array<string | number> | null | undefined>;
  /** Corpo JSON (POST). */
  body?: unknown;
  /** Corpo multipart (upload de imagem). */
  form?: FormData;
  /** "shop" (padrão) assina com access_token + shop_id; "public" só com partner. */
  signAs?: "shop" | "public";
  retries?: number;
  timeoutMs?: number;
  /** true = devolve o JSON inteiro ({ error, message, response, ... }) em vez de só `response`. */
  raw?: boolean;
}

export type ShopeeCaller = <T = any>(path: string, opts?: ShopeeRequestOptions) => Promise<T>;

export class ShopeeApiError extends Error {
  constructor(
    public path: string,
    public code: string,
    message: string,
    public requestId?: string,
    public httpStatus?: number,
    public raw?: unknown,
  ) {
    super(message || code);
    this.name = "ShopeeApiError";
  }
}

const RETRYABLE_CODE = /busy|server|timeout|too_many|rate|system|internal|inner|network/i;

async function hmacSha256Hex(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Monta a URL assinada (exportado para testes). */
export async function buildSignedUrl(
  auth: ShopeeAuth,
  apiPath: string,
  query: ShopeeRequestOptions["query"],
  signAs: "shop" | "public",
  timestamp = Math.floor(Date.now() / 1000),
): Promise<URL> {
  const base = (auth.baseUrl ?? SHOPEE_BR_BASE_URL).replace(/\/+$/, "");
  const fullPath = apiPath.startsWith("/api/v2/") ? apiPath : `/api/v2/${apiPath.replace(/^\/+/, "")}`;
  const baseString = signAs === "shop"
    ? `${auth.partnerId}${fullPath}${timestamp}${auth.accessToken}${auth.shopId}`
    : `${auth.partnerId}${fullPath}${timestamp}`;
  const sign = await hmacSha256Hex(auth.partnerKey, baseString);

  const url = new URL(base + fullPath);
  url.searchParams.set("partner_id", String(auth.partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign);
  if (signAs === "shop") {
    url.searchParams.set("access_token", auth.accessToken);
    url.searchParams.set("shop_id", String(auth.shopId));
  }
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, String(item)));
    else url.searchParams.set(k, String(v));
  }
  return url;
}

export function createShopeeClient(auth: ShopeeAuth): ShopeeCaller {
  return async function call<T = any>(apiPath: string, opts: ShopeeRequestOptions = {}): Promise<T> {
    const method = opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET");
    const maxRetries = opts.retries ?? 2;
    const signAs = opts.signAs ?? "shop";
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) await sleep(800 * attempt * attempt);
      const url = await buildSignedUrl(auth, apiPath, opts.query, signAs);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          signal: controller.signal,
          headers: opts.form ? undefined : { "Content-Type": "application/json" },
          body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
        });
      } catch (err) {
        clearTimeout(timer);
        lastError = new ShopeeApiError(apiPath, "network_error", String(err));
        continue; // falha de rede: tenta de novo
      }
      clearTimeout(timer);

      let json: any = null;
      const text = await res.text();
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (res.status === 429 || res.status >= 500) {
        lastError = new ShopeeApiError(apiPath, `http_${res.status}`, text.slice(0, 300), json?.request_id, res.status, json);
        continue;
      }

      const code: string = json?.error ?? "";
      if (code) {
        const err = new ShopeeApiError(apiPath, code, json?.message ?? "", json?.request_id, res.status, json);
        if (RETRYABLE_CODE.test(code) && attempt < maxRetries) {
          lastError = err;
          continue;
        }
        throw err;
      }
      if (!res.ok) {
        throw new ShopeeApiError(apiPath, `http_${res.status}`, text.slice(0, 300), json?.request_id, res.status, json);
      }
      // A Shopee devolve { error, message, warning, request_id, response }
      if (opts.raw) return json as T;
      return (json?.response ?? json) as T;
    }
    throw lastError ?? new ShopeeApiError(apiPath, "unknown", "Falha desconhecida");
  };
}
