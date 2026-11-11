import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { record } from "@/lib/shopee-publishing";

const SHOPEE_BASE_URL = "https://openplatform.shopee.com.br";
const SHOPEE_SANDBOX_URL = "https://openplatform.sandbox.test-stable.shopee.sg";
/** Domínio público do site (ex.: https://shopcenter.cloud). Precisa estar cadastrado no app da Shopee. */
export const PUBLIC_SITE_URL = (process.env["PUBLIC_SITE_URL"] || "https://sistemapas.online").replace(/\/+$/, "");
export const SHOPEE_CALLBACK_URL = `${PUBLIC_SITE_URL}/api/public/shopee/callback`;
/** Quantas lojas Shopee ativas um mesmo usuário pode conectar. */
export const MAX_SHOPEE_STORES_PER_USER = 3;

type ShopCredentials = {
  shopId: number;
  accessToken: string;
};

export class ShopeeAuthorizationError extends Error {
  constructor(message = "A autorização da loja precisa ser renovada.") {
    super(message);
    this.name = "ShopeeAuthorizationError";
  }
}

export type ShopeeTokenPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  merchantId: number | null;
};

function partnerConfig() {
  const partnerId = Number(process.env["SHOPEE_PARTNER_ID"]);
  const partnerKey = process.env["SHOPEE_PARTNER_KEY"];
  if (!Number.isInteger(partnerId) || partnerId <= 0 || !partnerKey) return null;
  return { partnerId, partnerKey };
}

function authUrl(baseUrl: string, state: string) {
  const config = partnerConfig();
  if (!config) return null;
  const path = "/api/v2/shop/auth_partner";
  const timestamp = unixTime();
  const redirect = `${SHOPEE_CALLBACK_URL}?state=${encodeURIComponent(state)}`;
  const sign = signature(`${config.partnerId}${path}${timestamp}`, config.partnerKey);
  const query = new URLSearchParams({
    partner_id: String(config.partnerId),
    timestamp: String(timestamp),
    sign,
    redirect,
  });
  return `${baseUrl}${path}?${query}`;
}

export function isShopeeConfigured() {
  return partnerConfig() !== null;
}

function unixTime() {
  return Math.floor(Date.now() / 1000);
}

function signature(base: string, key: string) {
  return createHmac("sha256", key).update(base).digest("hex");
}

export function createOAuthState() {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: createHash("sha256").update(raw).digest("hex") };
}

export function hashOAuthState(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function safeStateMatch(raw: string, expectedHash: string) {
  const actual = Buffer.from(hashOAuthState(raw), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Endereço mundial da Shopee. O login de autorização passa por ele quando o endereço do Brasil ainda
// não recebeu uma mudança feita no painel (ex.: troca do domínio de redirecionamento).
const SHOPEE_GLOBAL_URL = "https://partner.shopeemobile.com";
let authBaseUrl = SHOPEE_BASE_URL;

export function buildShopeeAuthUrl(state: string) {
  return authUrl(authBaseUrl, state);
}

async function inspectAuthUrl(baseUrl: string) {
  const url = authUrl(baseUrl, "pas-credential-check");
  if (!url) return { accepted: false, error: "not_configured" };
  const response = await fetch(url, { redirect: "manual" });
  if (response.status >= 300 && response.status < 400) return { accepted: true, error: null };
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { accepted: false, error: String(result["error"] ?? "unknown") };
}

/** Diagnóstico sem segredos: o que a Shopee responde ao link de autorização montado com as credenciais do servidor. */
export async function diagnoseShopeeAuth() {
  const config = partnerConfig();
  if (!config) return "credenciais faltando";
  const key = process.env["SHOPEE_PARTNER_KEY"] ?? "";
  const shape = `partner_id ${config.partnerId}; chave com ${key.length} caracteres${/\s/.test(key) ? ", TEM ESPAÇO" : ""}${/^[\x21-\x7e]+$/.test(key) ? "" : ", TEM CARACTERE INVÁLIDO"}${key.startsWith("shpk") ? ", começa com shpk" : ""}; redirect ${SHOPEE_CALLBACK_URL}`;
  const url = authUrl(SHOPEE_BASE_URL, "pas-credential-check");
  const response = await fetch(url!, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  const body = response.status >= 300 && response.status < 400 ? "redireciona (aceito)" : (await response.text()).slice(0, 300);
  let global = "";
  if (!body.startsWith("redireciona")) {
    const other = await fetch(authUrl(SHOPEE_GLOBAL_URL, "pas-credential-check")!, { redirect: "manual", signal: AbortSignal.timeout(15_000) }).catch(() => null);
    global = `; endereço mundial: ${other ? (other.status >= 300 && other.status < 400 ? "redireciona (aceito)" : `HTTP ${other.status} ${(await other.text()).slice(0, 160)}`) : "sem resposta"}`;
  }
  return `${shape}; HTTP ${response.status}; ${body}${global}`;
}

export async function inspectShopeeCredentials() {
  if (!partnerConfig()) return { status: "not_configured" as const };
  const production = await inspectAuthUrl(SHOPEE_BASE_URL);
  if (production.accepted) {
    authBaseUrl = SHOPEE_BASE_URL;
    return { status: "production" as const };
  }
  if (production.error === "error_param") {
    const global = await inspectAuthUrl(SHOPEE_GLOBAL_URL).catch(() => ({ accepted: false, error: "unreachable" }));
    if (global.accepted) {
      authBaseUrl = SHOPEE_GLOBAL_URL;
      return { status: "production" as const };
    }
  }
  if (production.error === "invalid_partner_id") {
    const sandbox = await inspectAuthUrl(SHOPEE_SANDBOX_URL);
    if (sandbox.accepted) return { status: "sandbox" as const };
  }
  return { status: "invalid" as const };
}

async function publicShopeePost(path: string, body: Record<string, unknown>, baseUrl = SHOPEE_BASE_URL) {
  const config = partnerConfig();
  if (!config) throw new Error("A integração oficial da Shopee ainda não foi ativada.");
  const timestamp = unixTime();
  const sign = signature(`${config.partnerId}${path}${timestamp}`, config.partnerKey);
  const query = new URLSearchParams({
    partner_id: String(config.partnerId),
    timestamp: String(timestamp),
    sign,
  });
  const response = await fetch(`${baseUrl}${path}?${query}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ partner_id: config.partnerId, ...body }),
  });
  const result = (await response.json()) as Record<string, unknown>;
  if (!response.ok || result["error"]) {
    throw new Error(String(result["message"] || result["error"] || "A Shopee recusou a solicitação."));
  }
  return result;
}

export async function exchangeShopeeCode(code: string, shopId: number) {
  try {
    return await publicShopeePost("/api/v2/auth/token/get", { code, shop_id: shopId });
  } catch (error) {
    // Autorização feita pelo endereço mundial: o código é trocado por lá.
    return await publicShopeePost("/api/v2/auth/token/get", { code, shop_id: shopId }, SHOPEE_GLOBAL_URL).catch(() => { throw error; });
  }
}

export function readShopeeTokenPayload(result: Record<string, unknown>): ShopeeTokenPayload {
  // Auth endpoints return token fields at the root. Keep the nested response
  // fallback for regional Shopee responses that wrap the same payload.
  const nested = result["response"];
  const payload = nested && typeof nested === "object"
    ? nested as Record<string, unknown>
    : result;
  const rawExpiresIn = Number(payload["expire_in"] ?? 14_400);
  const rawMerchantId = payload["merchant_id"] == null ? null : Number(payload["merchant_id"]);
  return {
    accessToken: String(payload["access_token"] ?? ""),
    refreshToken: String(payload["refresh_token"] ?? ""),
    expiresIn: Number.isFinite(rawExpiresIn) && rawExpiresIn > 0 ? rawExpiresIn : 14_400,
    merchantId: rawMerchantId !== null && Number.isFinite(rawMerchantId) ? rawMerchantId : null,
  };
}

async function signedShopRequest(
  path: string,
  credentials: ShopCredentials,
  options: { method?: "GET" | "POST"; body?: Record<string, unknown>; form?: FormData; query?: Record<string, string | number>; rawErrors?: boolean } = {},
) {
  const config = partnerConfig();
  if (!config) throw new Error("A integração oficial da Shopee ainda não foi ativada.");
  const timestamp = unixTime();
  const sign = signature(
    `${config.partnerId}${path}${timestamp}${credentials.accessToken}${credentials.shopId}`,
    config.partnerKey,
  );
  const query = new URLSearchParams({
    partner_id: String(config.partnerId),
    timestamp: String(timestamp),
    sign,
    access_token: credentials.accessToken,
    shop_id: String(credentials.shopId),
  });
  for (const [key, value] of Object.entries(options.query ?? {})) query.set(key, String(value));
  const request = async () => {
    const response = await fetch(`${SHOPEE_BASE_URL}${path}?${query}`, {
      method: options.method ?? "POST",
      headers: options.form ? new Headers() : { "content-type": "application/json" },
      body: options.form
        ? (options.form as unknown as BodyInit)
        : options.body
          ? JSON.stringify(options.body)
          : null,
    });
    const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { response, result };
  };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { response, result } = await request();
    const providerError = String(result["error"] ?? "");
    const retryable = response.status === 429 || response.status >= 500 || /too_many|timeout|system_error/i.test(providerError);
    if (response.ok && !providerError) return result;
    if (!retryable || attempt === 2 || options.form) {
      // Batch endpoints answer "all failed, please check result list": the real reason is per item.
      const response_ = result["response"] as Record<string, unknown> | undefined;
      const itemReasons = (Array.isArray(response_?.["result_list"]) ? response_["result_list"] as Record<string, unknown>[] : [])
        .map((item) => String(item["fail_message"] || item["fail_error"] || "")).filter(Boolean);
      const providerMessage = itemReasons.length ? Array.from(new Set(itemReasons)).join("; ") : String(result["message"] ?? "");
      if (isShopeeAuthorizationError(providerError, providerMessage)) {
        throw new ShopeeAuthorizationError();
      }
      if (itemReasons.length) console.warn(`[shopee] ${path} item failures: ${providerMessage}`);
      throw new Error(options.rawErrors ? `${providerMessage || providerError || "A Shopee recusou a solicitação."}` : humanizeShopeeError(providerError, providerMessage));
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
  }
  throw new Error("A Shopee está temporariamente indisponível. Tente novamente em instantes.");
}

function humanizeShopeeError(code: string, message: string) {
  const raw = `${code} ${message}`.toLowerCase();
  if (raw.includes("seller registration")) return "Publicação bloqueada pela Shopee: conclua o cadastro desta loja na Central do Vendedor (seller.shopee.com.br), incluindo as pendências de verificação. Depois tente novamente no Shop Center. Reconectar a loja não resolve esse bloqueio.";
  if (raw.includes("kyc")) return "A Shopee bloqueou a publicação porque a verificação de identidade da loja ainda não foi aprovada. Conclua as pendências na Central do Vendedor e aguarde a aprovação.";
  if (raw.includes("gtin")) return `Nesta categoria a Shopee exige o código de barras (EAN/GTIN) real do produto. (Shopee: ${message || code})`;
  if (raw.includes("description") && raw.includes("required")) return "Preencha a descrição do produto antes de publicar na Shopee.";
  if (raw.includes("100011") || raw.includes("issellerwarehouse") || raw.includes("available channels to seller")) {
    return "A Shopee não conseguiu consultar os canais da loja agora. O envio pelos Correios continuará disponível no Shop Center.";
  }
  if (raw.includes("size chart") || raw.includes("size_chart")) return "A Shopee exige a tabela de medidas deste produto nesta categoria.";
  if (raw.includes("brand")) return "A marca é obrigatória para esta categoria. Informe a marca ou use Sem marca.";
  if (/anatel|homolog|registration/.test(raw) && /manufacturer|fabricante|model|modelo|match/.test(raw)) return `A Shopee informou que o fabricante e o modelo não batem com o certificado ANATEL deste produto. (Shopee: ${message || code})`;
  if (raw.includes("attribute")) return `A Shopee pediu uma característica que este produto ainda não tem no catálogo. (Shopee: ${message || code})`;
  if (raw.includes("category")) return `A Shopee não aceitou a categoria escolhida automaticamente para este produto. (Shopee: ${message || code})`;
  if (raw.includes("no permission")) return "A Shopee não liberou esta operação para a loja. Confira as permissões na Central do Vendedor antes de tentar novamente.";
  if (raw.includes("status is abnormal")) return "A Shopee suspendeu ou bloqueou este anúncio (status anormal), por isso ele não pode ser editado. Veja o motivo na Central do Vendedor, em Meus Produtos > Violações, e corrija por lá.";
  if (raw.includes("shipping channel") || raw.includes("logistic")) return "A loja não tem nenhum canal de envio ativo na Shopee. Ative pelo menos um em Central do Vendedor > Configurações de envio e tente novamente.";
  if (raw.includes("duplicates another")) return "Já existe um produto igual nesta loja. Abra o anúncio existente para atualizar em vez de criar uma cópia.";
  if (raw.includes("image")) return "Uma ou mais imagens não atendem aos requisitos da Shopee.";
  if (raw.includes("too_many") || raw.includes("rate")) return "A Shopee recebeu muitas solicitações. Aguarde alguns instantes e tente novamente.";
  return message || code || "A Shopee recusou a solicitação. Revise os dados e tente novamente.";
}

export function isShopeeAuthorizationError(code: string, message = "") {
  const raw = `${code} ${message}`.toLowerCase();
  return [
    "invalid_access_token",
    "invalid access token",
    "access_token_expired",
    "access token expired",
    "token_expired",
    "token has expired",
    "error_auth",
    "invalid refresh token",
    "invalid_refresh_token",
  ].some((marker) => raw.includes(marker));
}

export async function refreshShopeeToken(refreshToken: string, shopId: number) {
  return publicShopeePost("/api/v2/auth/access_token/get", { refresh_token: refreshToken, shop_id: shopId });
}

export async function getShopeeCategories(credentials: ShopCredentials) {
  return signedShopRequest("/api/v2/product/get_category", credentials, {
    method: "GET",
    query: { language: "pt-BR" },
  });
}

/** Shopee's own category recommendation for a product title (read-only). */
export async function getShopeeCategoryRecommendation(credentials: ShopCredentials, itemName: string) {
  try {
    const result = await signedShopRequest("/api/v2/product/category_recommend", credentials, {
      method: "GET",
      query: { item_name: itemName.slice(0, 120) },
    });
    const ids = record(result["response"])["category_id"];
    return Array.isArray(ids) ? ids.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
  } catch {
    return [];
  }
}

export async function getShopeeLogistics(credentials: ShopCredentials) {
  return signedShopRequest("/api/v2/logistics/get_channel_list", credentials, { method: "GET" });
}

/** Category rules such as mandatory size charts; never fatal for the editor. */
export async function getShopeeCategoryRules(credentials: ShopCredentials, categoryId: number) {
  try {
    const result = await signedShopRequest("/api/v2/product/get_item_limit", credentials, { method: "GET", query: { category_id: categoryId } });
    const response = record(result["response"]);
    const sizeChart = record(response["size_chart_limit"]);
    const gtinRule = String(record(response["gtin_limit"])["gtin_validation_rule"] ?? response["gtin_validation_rule"] ?? "");
    return { sizeChartRequired: sizeChart["size_chart_mandatory"] === true, sizeChartImage: sizeChart["support_image_size_chart"] !== false, sizeChartTemplate: sizeChart["support_template_size_chart"] !== false, gtinRule };
  } catch {
    return { sizeChartRequired: false, sizeChartImage: true, sizeChartTemplate: false, gtinRule: "" };
  }
}

/** Size chart templates already created in the shop for a category (id + name). */
export async function getShopeeSizeChartTemplates(credentials: ShopCredentials, categoryId: number) {
  const templates: Array<{ id: number; name: string }> = [];
  let cursor = "";
  for (let page = 0; page < 5; page += 1) {
    const result = await signedShopRequest("/api/v2/product/get_size_chart_list", credentials, { method: "GET", query: { category_id: categoryId, page_size: 50, ...(cursor ? { cursor } : {}) } });
    const response = record(result["response"]);
    const list = Array.isArray(response["size_chart_list"]) ? response["size_chart_list"] as Record<string, unknown>[] : [];
    for (const item of list) {
      const id = Number(item["size_chart_id"]);
      if (id) templates.push({ id, name: String(item["size_chart_name"] ?? item["name"] ?? "") });
    }
    cursor = String(response["next_cursor"] ?? "");
    if (!cursor) break;
  }
  for (const template of templates.slice(0, 20)) {
    if (template.name) continue;
    try {
      const detail = await signedShopRequest("/api/v2/product/get_size_chart_detail", credentials, { method: "GET", query: { size_chart_id: template.id } });
      template.name = String(record(detail["response"])["size_chart_name"] ?? "");
    } catch { /* unnamed template */ }
  }
  return templates;
}

export async function getShopeeAttributes(credentials: ShopCredentials, categoryId: number) {
  const result = await signedShopRequest("/api/v2/product/get_attribute_tree", credentials, {
    method: "GET",
    query: { category_id_list: String(categoryId), language: "pt-BR" },
  });
  const response = record(result["response"]);
  const list = response["list"];
  const category = Array.isArray(list) ? list.find((entry) => Number(record(entry)["category_id"]) === categoryId) : null;
  const tree = record(category)["attribute_tree"];
  if (!Array.isArray(tree)) throw new Error("A Shopee não retornou as características desta categoria. Recarregue antes de publicar.");
  if (record(category)["warning"]) throw new Error("A Shopee não disponibilizou os requisitos deste produto agora. Tente novamente em alguns minutos.");
  return { ...result, response: { attribute_tree: tree } };
}

export async function getShopeeBrands(credentials: ShopCredentials, categoryId: number, offset = 0) {
  return signedShopRequest("/api/v2/product/get_brand_list", credentials, {
    method: "GET",
    query: { category_id: categoryId, offset, page_size: 100, status: 1 },
  });
}

export async function getShopeeItemList(credentials: ShopCredentials, offset = 0) {
  return signedShopRequest("/api/v2/product/get_item_list", credentials, {
    method: "GET",
    query: { offset, page_size: 50, item_status: "NORMAL" },
  });
}

export async function getShopeeItemBaseInfo(credentials: ShopCredentials, itemIds: number[]) {
  return signedShopRequest("/api/v2/product/get_item_base_info", credentials, {
    method: "GET",
    query: { item_id_list: itemIds.join(","), need_tax_info: "false", need_complaint_policy: "false" },
  });
}

export async function getShopeeModelList(credentials: ShopCredentials, itemId: number) {
  return signedShopRequest("/api/v2/product/get_model_list", credentials, {
    method: "GET",
    query: { item_id: itemId },
  });
}

export async function initShopeeVariations(credentials: ShopCredentials, body: Record<string, unknown>) {
  return signedShopRequest("/api/v2/product/init_tier_variation", credentials, { body });
}

/** Read only structured product data from public official pages, never unrelated image/option snippets. */
export async function getOfficialShopeeProductOptions(source: string) {
  let url = new URL(source);
  let html = "";
  for (let hop = 0; hop < 5; hop += 1) {
    if (url.protocol !== "https:" || !OFFICIAL_SHOPEE_HOSTS.has(url.hostname.toLowerCase())) throw new Error("Use um link oficial do produto Shopee.");
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8_000), headers: { accept: "text/html", "accept-language": "pt-BR" } });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      url = new URL(location, url); continue;
    }
    if (!response.ok) throw new Error("O fornecedor não disponibilizou as opções deste produto agora.");
    html = (await response.text()).slice(0, 2_000_000);
    const redirect = url.hostname === "s.shopee.com.br" ? html.match(/httpUrl\s*:\s*["']([^"']+)["']/i)?.[1] : null;
    if (redirect) { url = new URL(redirect.replaceAll("\\u002F", "/").replaceAll("\\u0026", "&").replaceAll("\\/", "/").replaceAll("&amp;", "&")); continue; }
    break;
  }
  const productId = url.pathname.match(/(?:-i\.\d+\.|\/product\/\d+\/|\/product_offer\/)(\d+)/)?.[1];
  if (!productId) return null;
  const blobs: unknown[] = [];
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const content = (match[1] ?? "").trim();
    const json = content.startsWith("{") ? content : content.match(/(?:window\.)?__INITIAL_STATE__\s*=\s*([\s\S]*?);?$/)?.[1]?.replace(/;$/, "");
    if (!json) continue;
    try { blobs.push(JSON.parse(json)); } catch { /* Non-JSON scripts aren't executed. */ }
  }
  const queue = [...blobs];
  for (let visited = 0; queue.length && visited < 20_000; visited += 1) {
    const value = queue.shift();
    if (Array.isArray(value)) { queue.push(...value); continue; }
    const item = record(value);
    if (String(item["itemid"] ?? item["item_id"] ?? "") === productId) {
      const tiers = item["tier_variations"] ?? item["tier_variation"];
      const models = item["models"] ?? item["model"];
      if (Array.isArray(tiers) && tiers.length <= 2 && Array.isArray(models)) {
        const rows = models.flatMap((model) => {
          const row = record(model); const ext = record(row["extinfo"]);
          const indexes = row["tier_index"] ?? ext["tier_index"];
          if (!Array.isArray(indexes) || indexes.length !== tiers.length) return [];
          const names = tiers.map((tier) => String(record(tier)["name"] ?? ""));
          const values = tiers.map((tier, index) => {
            const options = record(tier)["options"] ?? record(tier)["option_list"];
            if (!Array.isArray(options)) return "";
            const option = options[Number(indexes[index])];
            return typeof option === "string" ? option : String(record(option)["option"] ?? "");
          });
          if (names.some((name) => !name || name.length > 20) || values.some((option) => !option || option.length > 20)) return [];
          return [{ name1: names[0] ?? "Opção", name2: names[1] ?? null, option1: values[0] ?? "", option2: values[1] ?? null, sku: "", stock: 0, confirmed: false }];
        });
        const regulatoryFacts: string[] = [];
        const inspect: unknown[] = [item];
        for (let index = 0; index < inspect.length && index < 2_000; index += 1) {
          const candidate = inspect[index];
          if (Array.isArray(candidate)) { inspect.push(...candidate); continue; }
          const object = record(candidate);
          for (const [key, entry] of Object.entries(object)) {
            if (/(?:gtin|ean|barcode|bar_code|anvisa)/i.test(key) && ["string", "number"].includes(typeof entry)) regulatoryFacts.push(`${key}: ${String(entry)}`);
            if (entry && typeof entry === "object") inspect.push(entry);
          }
        }
        return { categoryId: Number(item["catid"] ?? item["category_id"]) || null, rows: rows.slice(0, 50), regulatoryFacts: regulatoryFacts.join("\n").slice(0, 2_000) };
      }
    }
    queue.push(...Object.values(item).filter((entry) => entry && typeof entry === "object"));
  }
  return null;
}

export async function getShopeeShopInfo(credentials: ShopCredentials) {
  return signedShopRequest("/api/v2/shop/get_shop_info", credentials, { method: "GET" });
}

export async function getShopeeOrderList(credentials: ShopCredentials, timeFrom: number, timeTo: number, cursor = "") {
  return signedShopRequest("/api/v2/order/get_order_list", credentials, {
    method: "GET",
    query: { time_range_field: "create_time", time_from: timeFrom, time_to: timeTo, page_size: 50, cursor },
  });
}

/** Package and carrier state of one order; decides whether Shopee already lets the label print. */
export async function getShopeeOrderPackage(credentials: ShopCredentials, orderSn: string) {
  return signedShopRequest("/api/v2/order/get_order_detail", credentials, {
    method: "GET",
    query: { order_sn_list: orderSn, response_optional_fields: "package_list,shipping_carrier,checkout_shipping_carrier,order_status,fulfillment_flag,pickup_done_time" },
    rawErrors: true,
  });
}

export async function getShopeeOrderDetails(credentials: ShopCredentials, orderSns: string[]) {
  return signedShopRequest("/api/v2/order/get_order_detail", credentials, {
    method: "GET",
    query: { order_sn_list: orderSns.join(","), response_optional_fields: "buyer_user_id,buyer_username,item_list,total_amount,create_time,update_time,pay_time" },
  });
}

export async function unlistShopeeItem(credentials: ShopCredentials, itemId: number) {
  return signedShopRequest("/api/v2/product/unlist_item", credentials, {
    body: { item_list: [{ item_id: itemId, unlist: true }] },
  });
}

function readJpegDimensions(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1] ?? 0;
    const length = ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0);
    if (length < 2) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: ((bytes[offset + 5] ?? 0) << 8) + (bytes[offset + 6] ?? 0), width: ((bytes[offset + 7] ?? 0) << 8) + (bytes[offset + 8] ?? 0) };
    }
    offset += 2 + length;
  }
  return null;
}

async function loadShopeeImage(imageUrl: string) {
  const originalUrl = new URL(imageUrl);
  const isShopeeImage = originalUrl.hostname.endsWith("img.susercontent.com");
  const uploadUrl = new URL(originalUrl);
  // Catalog images from Shopee's CDN are commonly delivered as WebP. The
  // Open Platform media endpoint only accepts JPEG/PNG, even when the file is
  // named .jpg, so request the CDN's JPEG rendition before uploading it.
  if (isShopeeImage && /\.webp$/i.test(uploadUrl.pathname)) {
    uploadUrl.pathname = uploadUrl.pathname.replace(/\.webp$/i, ".jpg");
  }
  const { fetchPublicUrl } = await import("@/lib/safe-fetch");
  const response = await fetchPublicUrl(uploadUrl, {
    headers: { accept: "image/jpeg,image/png;q=0.9" },
  });
  if (!response.ok) throw new Error("Não foi possível carregar uma das imagens do catálogo.");
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const declaredType = ((response.headers.get("content-type") ?? "").split(";").at(0) ?? "").toLowerCase();
  const signature = bytes.slice(0, 8);
  const [first = 0, second = 0, third = 0, fourth = 0] = signature;
  const isJpeg = first === 0xff && second === 0xd8 && third === 0xff;
  const isPng = first === 0x89 && second === 0x50 && third === 0x4e && fourth === 0x47;
  if (!isJpeg && !isPng) {
    throw new Error("A imagem do catálogo está em um formato não aceito pela Shopee. Use JPG ou PNG.");
  }
  if (buffer.byteLength > 2 * 1024 * 1024) {
    throw new Error("Uma imagem ultrapassa o limite de 2 MB da Shopee.");
  }
  const dimensions = isPng && bytes.length >= 24
    ? { width: ((bytes[16] ?? 0) << 24) + ((bytes[17] ?? 0) << 16) + ((bytes[18] ?? 0) << 8) + (bytes[19] ?? 0), height: ((bytes[20] ?? 0) << 24) + ((bytes[21] ?? 0) << 16) + ((bytes[22] ?? 0) << 8) + (bytes[23] ?? 0) }
    : readJpegDimensions(bytes);
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) throw new Error("Não foi possível confirmar a resolução da imagem.");
  if (dimensions.width < 500 || dimensions.height < 500) throw new Error(`A imagem possui ${dimensions.width}×${dimensions.height}px; use pelo menos 500×500px.`);
  const contentType = isPng ? "image/png" : "image/jpeg";
  const filename = isPng ? "product.png" : "product.jpg";
  return { buffer, contentType, declaredType, filename, dimensions };
}

export async function validateShopeeImage(imageUrl: string) {
  try {
    const image = await loadShopeeImage(imageUrl);
    return { url: imageUrl, valid: true as const, width: image.dimensions.width, height: image.dimensions.height, reason: null };
  } catch (error) {
    return { url: imageUrl, valid: false as const, width: null, height: null, reason: error instanceof Error ? error.message : "Imagem inválida." };
  }
}

export async function uploadShopeeImage(credentials: ShopCredentials, imageUrl: string) {
  const { buffer, contentType, declaredType, filename } = await loadShopeeImage(imageUrl);
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const form = new FormData();
      form.set("image", new Blob([buffer], { type: declaredType === contentType ? declaredType : contentType }), filename);
      return await signedShopRequest("/api/v2/media_space/upload_image", credentials, { form });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 350));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("A Shopee recusou a imagem após três tentativas.");
}

const OFFICIAL_SHOPEE_HOSTS = new Set(["shopee.com.br", "www.shopee.com.br", "s.shopee.com.br", "affiliate.shopee.com.br"]);

function normalizeShopeeImageUrl(value: string) {
  const decoded = value
    .replaceAll("\\u002F", "/")
    .replaceAll("\\/", "/")
    .replaceAll("&amp;", "&")
    .replace(/[),}\]]+$/, "");
  try {
    const parsed = new URL(decoded);
    if (!parsed.hostname.endsWith("img.susercontent.com")) return null;
    parsed.search = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function getOfficialShopeeProductImages(source: string, stored: string[]) {
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
  } catch {
    return [...new Set(stored)].slice(0, 9);
  }
  if (!OFFICIAL_SHOPEE_HOSTS.has(sourceUrl.hostname.toLowerCase())) return [...new Set(stored)].slice(0, 9);

  let response = await fetch(sourceUrl, {
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "pt-BR,pt;q=0.9",
      "user-agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36",
    },
  });
  if (!response.ok) throw new Error("A página oficial do produto não respondeu agora.");
  let html = await response.text();
  let finalUrl = new URL(response.url);
  // Shopee short links currently answer with an HTML interstitial instead of
  // an HTTP redirect. Resolve its official httpUrl before inspecting images.
  if (finalUrl.hostname.toLowerCase() === "s.shopee.com.br") {
    const redirectMatch = html.match(/httpUrl\s*:\s*["']([^"']+)["']/i);
    const redirectValue = redirectMatch?.[1]
      ?.replaceAll("\\u002F", "/")
      .replaceAll("\\u0026", "&")
      .replaceAll("\\/", "/")
      .replaceAll("&amp;", "&");
    if (redirectValue) {
      const redirectUrl = new URL(redirectValue);
      if (OFFICIAL_SHOPEE_HOSTS.has(redirectUrl.hostname.toLowerCase())) {
        response = await fetch(redirectUrl, {
          redirect: "follow",
          headers: {
            accept: "text/html,application/xhtml+xml",
            "accept-language": "pt-BR,pt;q=0.9",
            "user-agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36",
          },
        });
        if (response.ok) {
          html = await response.text();
          finalUrl = new URL(response.url);
        }
      }
    }
  }
  if (!OFFICIAL_SHOPEE_HOSTS.has(finalUrl.hostname.toLowerCase())) throw new Error("O link do produto não abriu uma página oficial da Shopee.");

  const decodedHtml = html.replaceAll("\\u002F", "/").replaceAll("\\u0026", "&").replaceAll("\\/", "/");
  const fullUrls = Array.from(decodedHtml.matchAll(/https:\/\/[^"'\s<>]+?\.img\.susercontent\.com\/[^"'\s<>]+/gi))
    .map((match) => match[0] ?? "");
  const imageIds = Array.from(decodedHtml.matchAll(/["'](?:image|image_id|display_image)["']\s*:\s*["']([a-zA-Z0-9_-]{20,})["']/gi))
    .map((match) => match[1] ? `https://down-br.img.susercontent.com/file/${match[1]}` : "");
  const imageLists = Array.from(decodedHtml.matchAll(/["'](?:images|image_list)["']\s*:\s*\[([^\]]+)\]/gi))
    .flatMap((match) => Array.from((match[1] ?? "").matchAll(/["']([a-zA-Z0-9_-]{20,})["']/g)))
    .map((match) => match[1] ? `https://down-br.img.susercontent.com/file/${match[1]}` : "");
  const official = [...fullUrls, ...imageIds, ...imageLists]
    .map(normalizeShopeeImageUrl)
    .filter((url): url is string => Boolean(url));
  return [...new Set([...stored, ...official])].slice(0, 9);
}

export async function addShopeeItem(credentials: ShopCredentials, body: Record<string, unknown>) {
  return signedShopRequest("/api/v2/product/add_item", credentials, { body });
}

export async function updateShopeeItem(credentials: ShopCredentials, body: Record<string, unknown>) {
  return signedShopRequest("/api/v2/product/update_item", credentials, { body });
}

export async function updateShopeePrice(credentials: ShopCredentials, body: Record<string, unknown>) {
  return signedShopRequest("/api/v2/product/update_price", credentials, { body });
}

export async function updateShopeeStock(credentials: ShopCredentials, body: Record<string, unknown>) {
  return signedShopRequest("/api/v2/product/update_stock", credentials, { body });
}
/* --------------------------------- Shipping --------------------------------- */

function signedShopUrl(path: string, credentials: ShopCredentials) {
  const config = partnerConfig();
  if (!config) throw new Error("A integração oficial da Shopee ainda não foi ativada.");
  const timestamp = unixTime();
  const sign = signature(`${config.partnerId}${path}${timestamp}${credentials.accessToken}${credentials.shopId}`, config.partnerKey);
  const query = new URLSearchParams({ partner_id: String(config.partnerId), timestamp: String(timestamp), sign, access_token: credentials.accessToken, shop_id: String(credentials.shopId) });
  return `${SHOPEE_BASE_URL}${path}?${query}`;
}

export async function getShopeeShippingParameter(credentials: ShopCredentials, orderSn: string) {
  return signedShopRequest("/api/v2/logistics/get_shipping_parameter", credentials, { method: "GET", query: { order_sn: orderSn }, rawErrors: true });
}

export async function shipShopeeOrder(credentials: ShopCredentials, body: Record<string, unknown>) {
  return signedShopRequest("/api/v2/logistics/ship_order", credentials, { body, rawErrors: true });
}

export async function getShopeeTrackingNumber(credentials: ShopCredentials, orderSn: string) {
  return signedShopRequest("/api/v2/logistics/get_tracking_number", credentials, { method: "GET", query: { order_sn: orderSn }, rawErrors: true });
}

export async function getShopeeShippingDocumentParameter(credentials: ShopCredentials, orderSn: string) {
  return signedShopRequest("/api/v2/logistics/get_shipping_document_parameter", credentials, { body: { order_list: [{ order_sn: orderSn }] }, rawErrors: true });
}

export async function createShopeeShippingDocument(credentials: ShopCredentials, order: { order_sn: string; tracking_number: string; shipping_document_type: string }) {
  return signedShopRequest("/api/v2/logistics/create_shipping_document", credentials, { body: { order_list: [order] }, rawErrors: true });
}

export async function getShopeeShippingDocumentResult(credentials: ShopCredentials, orderSn: string, documentType: string) {
  return signedShopRequest("/api/v2/logistics/get_shipping_document_result", credentials, { body: { order_list: [{ order_sn: orderSn, shipping_document_type: documentType }] }, rawErrors: true });
}

/** The label file itself (PDF). Shopee answers JSON only when something went wrong. */
export async function downloadShopeeShippingDocument(credentials: ShopCredentials, orderSn: string, documentType: string) {
  const response = await fetch(signedShopUrl("/api/v2/logistics/download_shipping_document", credentials), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ shipping_document_type: documentType, order_list: [{ order_sn: orderSn }] }),
  });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || type.includes("json")) {
    const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const code = String(result["error"] ?? "");
    if (isShopeeAuthorizationError(code, String(result["message"] ?? ""))) throw new ShopeeAuthorizationError();
    throw new Error(String(result["message"] || code || `A Shopee não entregou a etiqueta (${response.status}).`));
  }
  return new Uint8Array(await response.arrayBuffer());
}
