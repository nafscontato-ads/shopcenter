import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { isOwnerAccount, requireActiveUser } from "@/lib/access-control";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { normalizeProductImages } from "@/lib/product-images";
import type { Product } from "@/lib/pas-data";
import { leafShopeeCategories, programmedShopeeStock, suggestShopeeCategory, type ShopeeCategoryOption } from "@/lib/shopee-product-defaults";
import { buildVariationPayload, extractExplicitProductOptions, findShopeeModelByTier, matchRowsToRemoteModels, normalizeVariationStocks, record, remoteVariationState, sameListingTitle, shopeeAttributeSchema, shopeeVariationSchema } from "@/lib/shopee-publishing";
import { availableSizeChart, availableSubmissionAttributes } from "@/lib/shopee-submission";
import { requireShopeeDescription, shopeeOrderWindows } from "@/lib/shopee-sync";
import { resolveShopeeDescription } from "@/lib/shopee-description";
import { readShopeeReference } from "@/lib/shopee-reference";
import { LOCAL_DOCUMENT_BLOCKS } from "@/lib/shopee-compliance";
import { customerMessage, documentBlockers, parseIssues, type ComplianceIssue, type PublishOutcomeStatus } from "@/lib/shopee-compliance";
import { requireAdmin } from "@/lib/admin.functions";
import { pickCommunityGalleries, type CommunityGallery, type CommunityListingRow } from "@/lib/community-photos";
import sizeChartAsset from "@/assets/tabela-de-medidas.jpg.asset.json";

const OWNER_SIZE_CHART_URL = `https://sistemapas.online${sizeChartAsset.url}`;

type ListingRow = Database["public"]["Tables"]["shopee_listings"]["Row"];
type ListingInsert = Database["public"]["Tables"]["shopee_listings"]["Insert"];
type SafeListing = Omit<ListingRow, "request_payload" | "response_payload" | "connection_id" | "user_id" | "shopee_image_ids" | "description_key" | "description_len">;

const OWNER_DEMO_SHOP = {
  name: "CHICABONITA_1",
  url: "https://shopee.com.br/Progressiva-Sem-formol-Org%C3%A2nica-Profissional-1-Litro-i.1123896287.22997365622?extraParams=%7B%22display_model_id%22%3A159553609036%2C%22model_selection_logic%22%3A3%7D",
} as const;

const listingInput = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid(),
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().max(3000),
  price: z.number().positive().max(1_000_000),
  stock: z.number().int().min(0).max(999_999),
  // Catalogue names are often reused as SKU; Shopee caps it at 100 characters.
  sku: z.string().transform((value) => value.trim().slice(0, 100).trim()).nullable(),
  condition: z.enum(["NEW", "USED"]),
  categoryId: z.number().int().positive().nullable(),
  categoryName: z.string().trim().max(200).nullable(),
  weight: z.number().positive().max(1000).nullable(),
  packageLength: z.number().positive().max(10_000).nullable(),
  packageWidth: z.number().positive().max(10_000).nullable(),
  packageHeight: z.number().positive().max(10_000).nullable(),
  images: z.array(z.string().url()).min(1).max(9),
  videoUrl: z.string().url().nullable(),
  sizeChartUrl: z.string().url().nullable().default(null),
  isMaxAd: z.boolean().default(false),
  promoted: z.boolean().default(false),
  attributes: z.array(shopeeAttributeSchema).max(100),
  variations: z.array(shopeeVariationSchema).max(50),
  logistics: z.array(z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(100),
  connectionId: z.string().uuid().optional(),
});

const remoteItemUpdateInput = z.object({
  itemId: z.number().int().positive(),
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().max(3000),
  price: z.number().positive().max(1_000_000),
  stock: z.number().int().min(0).max(999_999),
});

const supplierPhotosInput = z.object({
  productId: z.string().uuid(),
});

const galleryAnalysisSchema = z.object({
  recommendedCover: z.number().int().min(1),
  recommendedOrder: z.array(z.number().int().min(1)).max(9),
  duplicatePositions: z.array(z.number().int().min(1)).max(9),
  lowQualityPositions: z.array(z.number().int().min(1)).max(9),
  summary: z.string().max(500),
});

type ConnectionCredentials = {
  id: string;
  shop_id: number;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
};

type FreshConnectionOptions = {
  forceRefresh?: boolean;
  staleAccessToken?: string;
};

const BRAZIL_CORREIOS_CHANNEL = {
  logistics_channel_id: 90003,
  logistics_channel_name: "Correios",
  enabled: true,
};

async function getFreshConnection(userId: string, connectionId?: string, options: FreshConnectionOptions = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: connection, error } = await supabaseAdmin
    .from("shopee_shop_connections")
    .select("id, shop_id, access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .match(connectionId ? { id: connectionId } : {})
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !connection) throw new Error("Conecte sua loja Shopee antes de continuar.");
  const current = connection as ConnectionCredentials;
  const expiresAt = new Date(current.token_expires_at).getTime();
  const tokenIsFresh = Number.isFinite(expiresAt) && expiresAt > Date.now() + 5 * 60 * 1000;
  if (!options.forceRefresh && tokenIsFresh) return current;
  // Another request may already have refreshed this connection. Reuse its
  // token instead of rotating the same refresh token twice.
  if (options.forceRefresh && options.staleAccessToken && current.access_token !== options.staleAccessToken) return current;

  const { isShopeeAuthorizationError, readShopeeTokenPayload, refreshShopeeToken } = await import("@/lib/shopee.server");
  let refreshed: Record<string, unknown>;
  try {
    refreshed = await refreshShopeeToken(current.refresh_token, Number(current.shop_id));
  } catch (refreshError) {
    // A concurrent request can rotate the refresh token first. Re-read the
    // row and use that newer authorization before asking the customer to reconnect.
    const { data: latest } = await supabaseAdmin
      .from("shopee_shop_connections")
      .select("id, shop_id, access_token, refresh_token, token_expires_at")
      .eq("id", current.id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (latest && latest.access_token !== current.access_token) return latest as ConnectionCredentials;
    const message = refreshError instanceof Error ? refreshError.message : "";
    if (isShopeeAuthorizationError(message)) {
      throw new Error("A Shopee recusou a renovação desta loja. Autorize a conexão novamente.");
    }
    throw refreshError;
  }
  const token = readShopeeTokenPayload(refreshed);
  const accessToken = token.accessToken;
  const refreshToken = token.refreshToken || current.refresh_token;
  const expiresIn = token.expiresIn;
  if (!accessToken) throw new Error("A autorização da loja expirou. Reconecte sua Shopee.");
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const { error: updateError } = await supabaseAdmin.from("shopee_shop_connections").update({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expires_at: tokenExpiresAt,
    status: "active",
  }).eq("id", current.id).eq("user_id", userId);
  if (updateError) throw new Error("Não foi possível renovar a conexão da loja.");
  return { ...current, access_token: accessToken, refresh_token: refreshToken, token_expires_at: tokenExpiresAt };
}

async function withFreshConnection<T>(
  userId: string,
  connectionId: string | undefined,
  operation: (connection: ConnectionCredentials) => Promise<T>,
) {
  const connection = await getFreshConnection(userId, connectionId);
  try {
    return await operation(connection);
  } catch (error) {
    const { ShopeeAuthorizationError } = await import("@/lib/shopee.server");
    if (!(error instanceof ShopeeAuthorizationError)) throw error;
    const renewed = await getFreshConnection(userId, connection.id, {
      forceRefresh: true,
      staleAccessToken: connection.access_token,
    });
    return operation(renewed);
  }
}

/** Longer than any real publication; afterwards a "publishing" listing is treated as interrupted. */
const STALE_PUBLISHING_MS = 10 * 60_000;
const INTERRUPTED_PUBLISH_MESSAGE = "A publicação foi interrompida antes de terminar. Abra o produto e clique em Publicar de novo.";

function cleanListing(row: ListingRow): SafeListing {
  return {
    id: row.id,
    product_id: row.product_id,
    shopee_item_id: row.shopee_item_id,
    status: row.status,
    status_detail: row.status_detail,
    title: row.title,
    description: row.description,
    price: row.price,
    stock: row.stock,
    sku: row.sku,
    condition: row.condition,
    category_id: row.category_id,
    category_name: row.category_name,
    attributes: row.attributes,
    variations: row.variations,
    logistics: row.logistics,
    weight: row.weight,
    package_length: row.package_length,
    package_width: row.package_width,
    package_height: row.package_height,
    images: row.images,
    video_url: row.video_url,
    size_chart_url: row.size_chart_url,
    is_max_ad: row.is_max_ad,
    promoted: row.promoted,
    promoted_at: row.promoted_at,
    shopee_link: row.shopee_link,
    last_synced_at: row.last_synced_at,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Status of products the owner added for their own account only; RLS lets only the admin owner read them. */
const OWNER_EXCLUSIVE_STATUS = "owner_exclusive";

/** Owner-approved partner accounts that also see the community-photo products (still must be an active partner). */
const COMMUNITY_PHOTO_PARTNER_EMAILS = new Set(["naftalyads@gmail.com"]);

/** Owner (and owner-approved partners): active catalogue products where anyone saved or published new photos or a new description. */
type CandidateRow = CommunityListingRow & { primary_image: string | null; gallery_images: string[] | null };
// The owner's "Publicar do Shop Center" list is the same for every allowed caller, so each
// server instance keeps it for a minute. Only plain data is shared between requests.
const COMMUNITY_TTL_MS = 60_000;
let communityCache: { items: CommunityGallery[]; at: number } | null = null;

/** One database call returns only listings that may hold new photos or a new description. */
async function communityGalleries(db: SupabaseClient<Database>): Promise<CommunityGallery[]> {
  if (communityCache && Date.now() - communityCache.at < COMMUNITY_TTL_MS) return communityCache.items;
  const { data, error } = await db.rpc("pas_community_listing_candidates");
  if (error) throw new Error("Não foi possível carregar os produtos com fotos.");
  const rows = (Array.isArray(data) ? data : []) as unknown as CandidateRow[];
  const catalogImages = new Map<string, string[]>();
  for (const row of rows) {
    if (!catalogImages.has(row.product_id)) catalogImages.set(row.product_id, normalizeProductImages(row.primary_image, row.gallery_images));
  }
  // The database already returns a description only when it differs from the catalogue's.
  const items = pickCommunityGalleries(rows, catalogImages);
  communityCache = { items, at: Date.now() };
  return items;
}

export const listCommunityPhotoProducts = createServerFn({ method: "GET" })
  .middleware([requireActiveUser])
  .handler(async ({ context }) => {
    const authenticatedEmail = typeof context.claims["email"] === "string" ? context.claims["email"].trim().toLowerCase() : "";
    const denied = { owner: false, items: [] as CommunityGallery[], pinned: [] as Product[] };
    const isOwner = await isOwnerAccount(context.supabase, context.userId);
    if (!isOwner) {
      if (!authenticatedEmail || !COMMUNITY_PHOTO_PARTNER_EMAILS.has(authenticatedEmail)) return denied;
      const { data: partnerRow } = await context.supabase.from("partner_profiles").select("status").eq("user_id", context.userId).maybeSingle();
      if (partnerRow?.status !== "active" && partnerRow?.status !== "approved") return denied;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const items = await communityGalleries(supabaseAdmin);
    // Products the owner added only for their own account: never in the shared catalogue, always first in Publicar do PAS.
    let pinned: Product[] = [];
    if (isOwner) {
      const { data: exclusive } = await supabaseAdmin
        .from("products")
        .select("id, name, description, price, promo_price, commission, rating, reviews_label, category, subcategory, brand, sku, viral_score, primary_image, gallery_images, video_url, url, sold_count, supplier_source, supplier_cost")
        .eq("status", OWNER_EXCLUSIVE_STATUS)
        .order("created_at", { ascending: false });
      pinned = (exclusive ?? []).map((row) => {
        const images = normalizeProductImages(row.primary_image, row.gallery_images, 9);
        return {
          id: row.id, name: row.name, price: Number(row.price), promoPrice: row.promo_price == null ? null : Number(row.promo_price),
          commission: Number(row.commission), rating: Number(row.rating ?? 0), reviews: row.reviews_label ?? "—",
          category: row.category ?? "Outros", subcategory: row.subcategory, brand: row.brand, sku: row.sku,
          description: row.description, images, image: images[0] ?? null, videoUrl: row.video_url, url: row.url,
          viral: Number(row.viral_score) >= 80, score: Number(row.viral_score), soldCount: Number(row.sold_count ?? 0),
          supplierSource: row.supplier_source, supplierCost: row.supplier_cost == null ? null : Number(row.supplier_cost),
        } satisfies Product;
      });
    }
    return { owner: true, items, pinned };
  });


export type SupplierOrderLine = { itemId: string; name: string; quantity: number; image: string | null; supplierUrl: string | null; supplierSource: string | null };

/** Links each sold Shopee item to the PAS product it was published from, and to that product's supplier page. */
async function supplierOrderLines(
  db: SupabaseClient<Database>,
  orders: { id: string; items: unknown }[],
  listings: { product_id: string; shopee_item_id: number | null }[],
) {
  const productByItem = new Map(listings.filter((row) => row.shopee_item_id).map((row) => [String(row.shopee_item_id), row.product_id]));
  const productIds = Array.from(new Set(Array.from(productByItem.values())));
  const { data: rows } = productIds.length
    ? await db.from("products").select("id, supplier_source, supplier_url").in("id", productIds.slice(0, 1000))
    : { data: [] };
  const supplierByProduct = new Map((rows ?? []).map((row) => [row.id, row]));
  const result = new Map<string, SupplierOrderLine[]>();
  for (const order of orders) {
    const items = Array.isArray(order.items) ? (order.items as Record<string, unknown>[]) : [];
    result.set(order.id, items.map((item) => {
      const itemId = String(Math.round(Number(item["item_id"] ?? 0)));
      const productId = productByItem.get(itemId);
      const supplier = productId ? supplierByProduct.get(productId) : undefined;
      const image = (item["image_info"] as { image_url?: string } | undefined)?.image_url ?? null;
      return {
        itemId,
        name: String(item["item_name"] ?? "Produto"),
        quantity: Number(item["model_quantity_purchased"] ?? 1),
        image,
        supplierUrl: supplier?.supplier_url ?? null,
        supplierSource: supplier?.supplier_source ?? null,
      };
    }));
  }
  return result;
}

export const getShopeeWorkspace = createServerFn({ method: "GET" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ connectionId: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const isOwner = await isOwnerAccount(context.supabase, context.userId);
    const { data: partnerRow } = isOwner ? { data: null } : await context.supabase.from("partner_profiles").select("status").eq("user_id", context.userId).maybeSingle();
    const isPartner = partnerRow?.status === "active" || partnerRow?.status === "approved";
    const ownerDemoShop = isOwner || isPartner ? OWNER_DEMO_SHOP : null;
    const { inspectShopeeCredentials } = await import("@/lib/shopee.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: connections, error: connectionError }, { data: listings, error: listingsError }, { data: logs }] = await Promise.all([
      supabaseAdmin
        .from("shopee_shop_connections")
        .select("id, shop_id, merchant_id, region, shop_name, status, token_expires_at, updated_at, last_synced_at, low_stock_threshold, sync_prices, sync_stock, alert_low_stock, pause_when_out_of_stock")
        .eq("user_id", context.userId)
        .eq("status", "active")
        .order("updated_at", { ascending: false }),
      context.supabase
        .from("shopee_listings")
        .select("id, product_id, shopee_item_id, status, status_detail, title, description, price, stock, sku, condition, category_id, category_name, attributes, variations, logistics, weight, package_length, package_width, package_height, images, video_url, size_chart_url, is_max_ad, promoted, promoted_at, shopee_link, last_synced_at, published_at, created_at, updated_at")
        .order("updated_at", { ascending: false }),
      context.supabase.from("shopee_sync_logs").select("id, connection_id, operation, status, processed_count, changed_count, error_count, message, started_at, finished_at").order("created_at", { ascending: false }).limit(30),
    ]);
    if (connectionError) {
      console.error("[shopee-workspace] lojas:", connectionError.message, connectionError.details ?? "");
      throw new Error(`Lojas: ${connectionError.message}`);
    }
    if (listingsError) throw new Error(listingsError.message);
    // A publish request that died midway (closed tab, timeout) leaves "publishing" forever; release it so the seller can retry.
    const staleBefore = Date.now() - STALE_PUBLISHING_MS;
    const stale = (listings ?? []).filter((row) => row.status === "publishing" && new Date(row.updated_at).getTime() < staleBefore);
    if (stale.length) {
      await context.supabase.from("shopee_listings").update({ status: "failed", status_detail: INTERRUPTED_PUBLISH_MESSAGE }).in("id", stale.map((row) => row.id)).eq("status", "publishing");
      for (const row of stale) { row.status = "failed"; row.status_detail = INTERRUPTED_PUBLISH_MESSAGE; }
    }
    const connection = (connections ?? []).find((item) => item.id === data.connectionId) ?? connections?.[0] ?? null;
    const credentialStatus = connection ? "production" : (await inspectShopeeCredentials()).status;
    // Orders are read per selected shop, so other shops' orders never use up the limit.
    const { data: connectionOrders } = connection
      ? await context.supabase.from("shopee_orders").select("id, connection_id, order_sn, status, total_amount, currency, buyer_label, items, created_time, updated_time, completed_time, synced_at").eq("connection_id", connection.id).order("created_time", { ascending: false }).limit(2000)
      : { data: [] };
    const shopOrders = connectionOrders ?? [];
    const orderLines = await supplierOrderLines(supabaseAdmin, shopOrders, listings ?? []);
    return {
      configured: credentialStatus === "production",
      credentialStatus,
      connection: connection ?? null,
      connections: connections ?? [],
      ownerDemoShop,
      listings: (listings ?? []).map((row) => cleanListing(row as ListingRow)),
      orders: shopOrders.map((order) => ({ ...order, lines: orderLines.get(order.id) ?? [] })),
      logs: (logs ?? []).filter((log) => !connection || log.connection_id === connection.id),
    };
  });

export const beginShopeeConnection = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .handler(async ({ context }) => {
    const { buildShopeeAuthUrl, createOAuthState, inspectShopeeCredentials, MAX_SHOPEE_STORES_PER_USER } = await import("@/lib/shopee.server");
    {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { count } = await supabaseAdmin.from("shopee_shop_connections").select("id", { count: "exact", head: true }).eq("user_id", context.userId).eq("status", "active");
      if ((count ?? 0) >= MAX_SHOPEE_STORES_PER_USER) {
        throw new Error(`Você já conectou ${MAX_SHOPEE_STORES_PER_USER} lojas Shopee, o limite por conta. Desconecte uma para conectar outra.`);
      }
    }
    const credentials = await inspectShopeeCredentials();
    if (credentials.status === "sandbox") {
      throw new Error("Este aplicativo Shopee ainda está no ambiente de testes. Ative as credenciais de produção para conectar lojas reais.");
    }
    if (credentials.status !== "production") {
      throw new Error("A Shopee ainda não reconhece este aplicativo no ambiente de produção. Confira a aprovação e as credenciais oficiais.");
    }
    const state = createOAuthState();
    const url = buildShopeeAuthUrl(state.raw);
    if (!url) throw new Error("A conexão oficial está aguardando as credenciais do aplicativo Shopee.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("shopee_oauth_states").insert({
      user_id: context.userId,
      state_hash: state.hash,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error("Não foi possível iniciar a conexão com a Shopee.");
    return { url };
  });

export const getShopeePublishingOptions = createServerFn({ method: "GET" })
  .middleware([requireActiveUser])
  .validator((input) => z.object({ categoryId: z.number().int().positive().optional(), connectionId: z.string().uuid().optional(), attributesOnly: z.boolean().optional(), productTitle: z.string().max(200).optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    return withFreshConnection(context.userId, data.connectionId, async (connection) => {
      const shopee = await import("@/lib/shopee.server");
      const credentials = { shopId: Number(connection.shop_id), accessToken: connection.access_token };
      if (data.attributesOnly && data.categoryId) {
        const result = await shopee.getShopeeAttributes(credentials, data.categoryId);
        return { categories: {} as Json, logistics: {} as Json, attributes: (result["response"] as Json | undefined) ?? {}, attributeError: null as string | null };
      }
    // Categories and logistics are independent shop-wide options. Do not make
    // them depend on category attributes: some categories reject the attribute
    // endpoint and used to blank the shipping selector as a side effect.
    const [categoriesResult, logisticsResult, recommendedIds] = await Promise.all([
      shopee.getShopeeCategories(credentials),
      shopee.getShopeeLogistics(credentials).catch(() => ({
        response: {
          logistics_channel_list: [BRAZIL_CORREIOS_CHANNEL],
          fallback: true,
        },
      })),
      data.productTitle ? shopee.getShopeeCategoryRecommendation(credentials, data.productTitle) : Promise.resolve([]),
    ]);
    let attributes: Json = {};
    let attributeError: string | null = null;
    if (data.categoryId) {
      try {
        const attributesResult = await shopee.getShopeeAttributes(credentials, data.categoryId);
        attributes = (attributesResult["response"] as Json | undefined) ?? {};
      } catch (error) {
        // Attribute support differs by category and must not prevent loading
        // the category and shipping channels required by the editor.
        attributeError = error instanceof Error ? error.message : "Não foi possível consultar as características desta categoria.";
      }
    }
      return {
        categories: (categoriesResult["response"] as Json | undefined) ?? {},
        logistics: (logisticsResult["response"] as Json | undefined) ?? {},
        attributes,
        attributeError,
        recommendedCategoryIds: (recommendedIds as number[]) ?? [],
      };
    });
  });

/** Auto-fills mandatory category data and returns only what still needs real supplier input. */
export const getShopeeCategoryRequirements = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({
    categoryId: z.number().int().positive(),
    productId: z.string().uuid(),
    connectionId: z.string().uuid().optional(),
    title: z.string().max(200).default(""),
    description: z.string().max(5000).default(""),
    images: z.array(z.string().url()).max(9).default([]),
    attributes: z.array(shopeeAttributeSchema).max(100).default([]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: product } = await context.supabase.from("products").select("name, description, brand").eq("id", data.productId).maybeSingle();
    return withFreshConnection(context.userId, data.connectionId, async (connection) => {
      const shopee = await import("@/lib/shopee.server");
      const { fillMandatoryAttributes, detectSizeChartImage } = await import("@/lib/shopee-requirements.server");
      const credentials = { shopId: Number(connection.shop_id), accessToken: connection.access_token };
      const [attributeResult, rules] = await Promise.all([
        shopee.getShopeeAttributes(credentials, data.categoryId),
        shopee.getShopeeCategoryRules(credentials, data.categoryId),
      ]);
      const filled = await fillMandatoryAttributes(attributeResult["response"], { name: product?.name ?? data.title, description: `${data.description}\n${product?.description ?? ""}`, brand: product?.brand ?? null }, data.attributes);
      const suggestedSizeChart = rules.sizeChartRequired ? await detectSizeChartImage(data.images) : null;
      return {
        attributes: filled.attributes,
        missing: filled.missing,
        sizeChartRequired: rules.sizeChartRequired,
        suggestedSizeChart,
      };
    });
  });

export const getSupplierProductOptions = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => supplierPhotosInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: product, error } = await context.supabase.from("products")
      .select("name, description, url").eq("id", data.productId).in("status", ["active", OWNER_EXCLUSIVE_STATUS]).maybeSingle();
    if (error || !product) throw new Error("Produto não encontrado no catálogo.");
    const explicit = extractExplicitProductOptions(`${product.name}\n${product.description ?? ""}`);
    if (product.url) {
      try {
        const { getOfficialShopeeProductOptions } = await import("@/lib/shopee.server");
        const result = await getOfficialShopeeProductOptions(product.url);
        if (result?.rows.length) return { ...explicit, ...result, source: "Página oficial do fornecedor", warning: null as string | null };
      } catch { /* Report missing supplier data instead of inventing variations. */ }
    }
    return { ...explicit, rows: [], categoryId: null, source: "Cadastro do catálogo", warning: "O fornecedor não disponibilizou uma grade completa. Confira as opções e o estoque com ele antes de publicar." };
  });

export const getSupplierProductPhotos = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => supplierPhotosInput.parse(input))
  .handler(async ({ data, context }) => {
    // supplier_url não é legível pelo aluno direto no banco; lê no servidor com a mesma regra de antes.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isOwner = await isOwnerAccount(context.supabase, context.userId);
    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("primary_image, gallery_images, url, supplier_source, supplier_url")
      .eq("id", data.productId)
      .in("status", isOwner ? ["active", OWNER_EXCLUSIVE_STATUS] : ["active"])
      .maybeSingle();
    if (error || !product) throw new Error("Produto não encontrado no catálogo.");

    const stored = normalizeProductImages(product.primary_image, product.gallery_images, 9);
    const { getSupplierSite, productPagePhotos } = await import("@/lib/supplier-sites");
    const supplier = product.supplier_source ? getSupplierSite(product.supplier_source) : null;
    if (supplier?.platform === "prestashop" && product.supplier_url?.startsWith(supplier.storeUrl)) {
      try {
        const page = await fetch(product.supplier_url, { headers: { "User-Agent": "Mozilla/5.0 (PAS catalogue import)", Accept: "text/html" } });
        const photos = page.ok ? productPagePhotos(await page.text()) : [];
        const images = normalizeProductImages(null, [...stored, ...photos], 9);
        return { images, found: Math.max(0, images.length - new Set(stored).size) };
      } catch {
        return { images: [...new Set(stored)].slice(0, 9), found: 0 };
      }
    }
    const source = product.url;
    if (!source) return { images: [...new Set(stored)].slice(0, 9), found: 0 };
    try {
      const { getOfficialShopeeProductImages } = await import("@/lib/shopee.server");
      const images = await getOfficialShopeeProductImages(source, stored);
      return { images, found: Math.max(0, images.length - new Set(stored).size) };
    } catch {
      return { images: [...new Set(stored)].slice(0, 9), found: 0 };
    }
  });

export const analyzeShopeeGallery = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ images: z.array(z.string().url()).min(1).max(9) }).parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("A análise com IA não está disponível agora.");
    const images = normalizeProductImages(null, data.images, 9);
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3.8-flash", messages: [{ role: "user", content: [
        { type: "text", text: `Analise estas ${images.length} fotos reais de um único produto para um anúncio Shopee. Apenas sugira melhor capa, ordem, duplicadas e fotos fracas. Não invente nem substitua imagens. Responda somente JSON {"recommendedCover":1,"recommendedOrder":[1],"duplicatePositions":[],"lowQualityPositions":[],"summary":"..."}. Use posições de 1 a ${images.length}.` },
        ...images.map((imageUrl) => ({ type: "image_url", image_url: { url: imageUrl } })),
      ] }] }),
    });
    if (!response.ok) throw new Error("A IA não conseguiu analisar estas fotos agora.");
    const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const match = (result.choices?.[0]?.message?.content ?? "").match(/\{[\s\S]*\}/);
    if (!match) throw new Error("A IA não retornou uma análise válida.");
    const parsed = galleryAnalysisSchema.parse(JSON.parse(match[0]));
    const validPositions = new Set(images.map((_, index) => index + 1));
    const order = parsed.recommendedOrder.filter((position) => validPositions.has(position));
    return {
      ...parsed,
      recommendedCover: validPositions.has(parsed.recommendedCover) ? parsed.recommendedCover : 1,
      recommendedOrder: [...order, ...[...validPositions].filter((position) => !order.includes(position))],
      duplicatePositions: parsed.duplicatePositions.filter((position) => validPositions.has(position)),
      lowQualityPositions: parsed.lowQualityPositions.filter((position) => validPositions.has(position)),
    };
  });

export const validateShopeeGallery = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ images: z.array(z.string().url()).min(1).max(9) }).parse(input))
  .handler(async ({ data }) => {
    const { validateShopeeImage } = await import("@/lib/shopee.server");
    const images = normalizeProductImages(null, data.images, 9);
    const results = [];
    for (const image of images) results.push(await validateShopeeImage(image));
    return { results, valid: results.filter((result) => result.valid).length, invalid: results.filter((result) => !result.valid).length };
  });

export const listMyShopeeProducts = createServerFn({ method: "GET" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ connectionId: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    return withFreshConnection(context.userId, data.connectionId, async (connection) => {
      const shopee = await import("@/lib/shopee.server");
      const credentials = { shopId: Number(connection.shop_id), accessToken: connection.access_token };
    const summaries: Record<string, unknown>[] = [];
    let offset = 0;
    for (let page = 0; page < 10; page += 1) {
      const result = await shopee.getShopeeItemList(credentials, offset);
      const response = result["response"] as Record<string, unknown> | undefined;
      const items = Array.isArray(response?.["item"]) ? response["item"] as Record<string, unknown>[] : [];
      summaries.push(...items);
      if (!response?.["has_next_page"] || items.length === 0) break;
      offset = Number(response["next_offset"] ?? offset + items.length);
    }
    const itemIds = summaries.map((item) => Number(item["item_id"])).filter((id) => Number.isInteger(id) && id > 0);
    const details: Record<string, unknown>[] = [];
    for (let index = 0; index < itemIds.length; index += 50) {
      const result = await shopee.getShopeeItemBaseInfo(credentials, itemIds.slice(index, index + 50));
      const response = result["response"] as Record<string, unknown> | undefined;
      if (Array.isArray(response?.["item_list"])) details.push(...response["item_list"] as Record<string, unknown>[]);
    }
      return details.map((item) => {
      const image = item["image"] as Record<string, unknown> | undefined;
      const prices = Array.isArray(item["price_info"]) ? item["price_info"] as Record<string, unknown>[] : [];
      const stockInfo = item["stock_info_v2"] as Record<string, unknown> | undefined;
      const summary = stockInfo?.["summary_info"] as Record<string, unknown> | undefined;
      return {
        itemId: Number(item["item_id"]),
        title: String(item["item_name"] ?? "Produto sem título"),
        description: String(item["description"] ?? ""),
        images: Array.isArray(image?.["image_url_list"]) ? image["image_url_list"].map(String) : [],
        price: Number(prices[0]?.["current_price"] ?? prices[0]?.["original_price"] ?? 0),
        stock: Number(summary?.["total_available_stock"] ?? 0),
        status: String(item["item_status"] ?? "UNKNOWN"),
        categoryId: Number(item["category_id"] ?? 0),
        sku: String(item["item_sku"] ?? ""),
        updatedAt: Number(item["update_time"] ?? 0),
        shopeeLink: `https://shopee.com.br/product/${connection.shop_id}/${Number(item["item_id"])}`,
      };
      });
    });
  });

/**
 * Counters for the Central do Vendedor that orders cannot answer: how many of the
 * shop's listings Shopee itself reports as banned. Read live, never stored or estimated;
 * null means Shopee did not answer, so the screen shows a dash instead of a zero.
 */
export const getShopeeListingCounters = createServerFn({ method: "GET" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ connectionId: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    return withFreshConnection(context.userId, data.connectionId, async (connection) => {
      const shopee = await import("@/lib/shopee.server");
      const credentials = { shopId: Number(connection.shop_id), accessToken: connection.access_token };
      const total = async (status: string) => {
        try {
          const result = await shopee.getShopeeItemList(credentials, 0, status, 1);
          const value = Number(record(result["response"])["total_count"]);
          return Number.isFinite(value) ? value : 0;
        } catch (error) {
          const { ShopeeAuthorizationError } = await import("@/lib/shopee.server");
          if (error instanceof ShopeeAuthorizationError) throw error;
          return null;
        }
      };
      const [banned, active, unlisted] = await Promise.all([total("BANNED"), total("NORMAL"), total("UNLIST")]);
      // Names and photos of up to 50 banned listings, so the seller sees which ones the counter means.
      let bannedItems: { itemId: number; name: string; image: string | null }[] = [];
      if (banned) {
        try {
          const list = await shopee.getShopeeItemList(credentials, 0, "BANNED", 50);
          const ids = (Array.isArray(record(list["response"])["item"]) ? record(list["response"])["item"] as Record<string, unknown>[] : [])
            .map((item) => Number(item["item_id"])).filter((id) => Number.isInteger(id) && id > 0);
          if (ids.length) {
            const info = await shopee.getShopeeItemBaseInfo(credentials, ids);
            const rows = record(info["response"])["item_list"];
            bannedItems = (Array.isArray(rows) ? rows as Record<string, unknown>[] : []).map((item) => {
              const urls = record(item["image"])["image_url_list"];
              return { itemId: Number(item["item_id"]), name: String(item["item_name"] ?? "Produto"), image: Array.isArray(urls) && urls[0] ? String(urls[0]) : null };
            });
          }
        } catch (error) {
          const { ShopeeAuthorizationError } = await import("@/lib/shopee.server");
          if (error instanceof ShopeeAuthorizationError) throw error;
        }
      }
      return { banned, active, unlisted, bannedItems, checkedAt: new Date().toISOString() };
    });
  });

export const updateMyShopeeProduct = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input) => remoteItemUpdateInput.extend({ connectionId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    requireShopeeDescription(data.description);
    return withFreshConnection(context.userId, data.connectionId, async (connection) => {
      const shopee = await import("@/lib/shopee.server");
      const credentials = { shopId: Number(connection.shop_id), accessToken: connection.access_token };
      await shopee.updateShopeeItem(credentials, {
        item_id: data.itemId,
        item_name: data.title,
        description: data.description,
      });
      await Promise.all([
        shopee.updateShopeePrice(credentials, { item_id: data.itemId, price_list: [{ model_id: 0, original_price: data.price }] }),
        shopee.updateShopeeStock(credentials, { item_id: data.itemId, stock_list: [{ model_id: 0, seller_stock: [{ stock: data.stock }] }] }),
      ]);
      return { ok: true };
    });
  });

export const syncShopeeStore = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ connectionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const currentConnection = await getFreshConnection(context.userId, data.connectionId);
    const connection = await getFreshConnection(context.userId, currentConnection.id, {
      forceRefresh: true,
      staleAccessToken: currentConnection.access_token,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const shopee = await import("@/lib/shopee.server");
    const credentials = { shopId: Number(connection.shop_id), accessToken: connection.access_token };
    const startedAt = new Date().toISOString();
    const { data: log } = await supabaseAdmin.from("shopee_sync_logs").insert({ user_id: context.userId, connection_id: connection.id, operation: "full_sync", status: "running", started_at: startedAt }).select("id").single();
    try {
      const shopResult = await shopee.getShopeeShopInfo(credentials);
      const shopResponse = shopResult["response"] as Record<string, unknown> | undefined;
      const productsResult = await shopee.getShopeeItemList(credentials, 0);
      const productsResponse = productsResult["response"] as Record<string, unknown> | undefined;
      const productItems = Array.isArray(productsResponse?.["item"]) ? productsResponse["item"] as Record<string, unknown>[] : [];
      const now = Math.floor(Date.now() / 1000);
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
      const orderSns: string[] = [];
      let orderWarning: string | null = null;
      try {
        const seenOrders = new Set<string>();
        for (const window of shopeeOrderWindows(thirtyDaysAgo, now)) {
          let cursor = "";
          for (let page = 0; page < 10; page += 1) {
            const orderResult = await shopee.getShopeeOrderList(credentials, window.from, window.to, cursor);
            const response = orderResult["response"] as Record<string, unknown> | undefined;
            const list = Array.isArray(response?.["order_list"]) ? response["order_list"] as Record<string, unknown>[] : [];
            for (const item of list) {
              const sn = String(item["order_sn"] ?? "");
              if (sn && !seenOrders.has(sn)) { seenOrders.add(sn); orderSns.push(sn); }
            }
            if (!response?.["more"]) break;
            const nextCursor = String(response["next_cursor"] ?? "");
            if (!nextCursor || nextCursor === cursor || page === 9) {
              orderWarning = "Há mais pedidos disponíveis. A sincronização deste período ficou incompleta.";
              break;
            }
            cursor = nextCursor;
          }
        }
        for (let index = 0; index < orderSns.length; index += 50) {
          const detailsResult = await shopee.getShopeeOrderDetails(credentials, orderSns.slice(index, index + 50));
          const response = detailsResult["response"] as Record<string, unknown> | undefined;
          const details = Array.isArray(response?.["order_list"]) ? response["order_list"] as Record<string, unknown>[] : [];
          if (details.length) {
            const { error: orderSaveError } = await supabaseAdmin.from("shopee_orders").upsert(details.map((order) => ({
              user_id: context.userId, connection_id: connection.id, order_sn: String(order["order_sn"]), status: String(order["order_status"] ?? "UNKNOWN"),
              total_amount: Number(order["total_amount"] ?? 0), currency: String(order["currency"] ?? "BRL"), buyer_label: order["buyer_username"] ? String(order["buyer_username"]) : null,
              items: (Array.isArray(order["item_list"]) ? order["item_list"] : []) as Json, created_time: order["create_time"] ? new Date(Number(order["create_time"]) * 1000).toISOString() : null,
              updated_time: order["update_time"] ? new Date(Number(order["update_time"]) * 1000).toISOString() : null, completed_time: order["complete_time"] ? new Date(Number(order["complete_time"]) * 1000).toISOString() : null,
              raw_summary: { pay_time: order["pay_time"] ?? null } as Json, synced_at: new Date().toISOString(),
            })), { onConflict: "connection_id,order_sn" });
            if (orderSaveError) throw new Error("A Shopee retornou os pedidos, mas o Shop Center não conseguiu salvá-los. Tente sincronizar novamente.");
          }
        }
      } catch (error) {
        orderWarning = error instanceof Error ? error.message : "Pedidos indisponíveis para este aplicativo.";
      }
      const finishedAt = new Date().toISOString();
      const shopName = String(shopResponse?.["shop_name"] ?? shopResult["shop_name"] ?? "").trim();
      await supabaseAdmin.from("shopee_shop_connections").update({ ...(shopName ? { shop_name: shopName } : {}), last_synced_at: finishedAt }).eq("id", connection.id).eq("user_id", context.userId);
      if (log) await supabaseAdmin.from("shopee_sync_logs").update({ status: orderWarning ? "partial" : "success", processed_count: productItems.length + orderSns.length, changed_count: orderSns.length, error_count: orderWarning ? 1 : 0, message: orderWarning ?? "Sincronização concluída.", finished_at: finishedAt }).eq("id", log.id);
      return { products: productItems.length, orders: orderSns.length, warning: orderWarning };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível sincronizar a loja.";
      if (log) await supabaseAdmin.from("shopee_sync_logs").update({ status: "failed", error_count: 1, message, finished_at: new Date().toISOString() }).eq("id", log.id);
      throw new Error(message);
    }
  });

export const disconnectShopeeStore = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ connectionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("shopee_shop_connections").update({ status: "disconnected", access_token: "revoked", refresh_token: "revoked" }).eq("id", data.connectionId).eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível desconectar a loja.");
    return { ok: true };
  });

export const updateShopeeAutomation = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ connectionId: z.string().uuid(), lowStockThreshold: z.number().int().min(0).max(999999), alertLowStock: z.boolean(), syncPrices: z.boolean(), syncStock: z.boolean(), pauseWhenOutOfStock: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("shopee_shop_connections").update({ low_stock_threshold: data.lowStockThreshold, alert_low_stock: data.alertLowStock, sync_prices: data.syncPrices, sync_stock: data.syncStock, pause_when_out_of_stock: data.pauseWhenOutOfStock }).eq("id", data.connectionId).eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível salvar as automações.");
    return { ok: true };
  });

export const archiveShopeeProduct = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ connectionId: z.string().uuid(), itemId: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    const connection = await getFreshConnection(context.userId, data.connectionId);
    const { unlistShopeeItem } = await import("@/lib/shopee.server");
    await unlistShopeeItem({ shopId: Number(connection.shop_id), accessToken: connection.access_token }, data.itemId);
    return { ok: true };
  });

export const improveShopeeCopy = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ title: z.string().min(3).max(120), description: z.string().max(3000), facts: z.string().max(4000), mode: z.enum(["title", "description", "both"]) }).parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("A otimização com IA não está disponível agora.");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "openai/gpt-5.6-sol", messages: [{ role: "user", content: `Otimize um anúncio Shopee em português. Use SOMENTE os fatos fornecidos; não invente materiais, medidas, benefícios ou garantias. Responda apenas JSON {"title":"...","description":"...","suggestions":["..."]}. Modo: ${data.mode}. Título atual: ${data.title}. Descrição atual: ${data.description}. Fatos confirmados: ${data.facts}` }] }) });
    if (!response.ok) throw new Error("Não foi possível otimizar o anúncio agora.");
    const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = result.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("A IA não retornou sugestões válidas.");
    return z.object({ title: z.string().max(120), description: z.string().max(3000), suggestions: z.array(z.string()).max(8) }).parse(JSON.parse(match[0]));
  });

export const saveShopeeDraft = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input) => listingInput.parse(input))
  .handler(async ({ data, context }) => {
    let description = data.description;
    if (!description.trim()) {
      if (data.id) {
        const { data: previous, error } = await context.supabase.from("shopee_listings")
          .select("description, product_id").eq("id", data.id).eq("user_id", context.userId).single();
        if (error || !previous) throw new Error("Não foi possível recuperar a descrição salva. Tente novamente.");
        if (previous.product_id !== data.productId) throw new Error("O rascunho pertence a outro produto.");
        description = resolveShopeeDescription(previous.description);
      }
      if (!description.trim()) {
        const { data: product, error } = await context.supabase.from("products").select("description").eq("id", data.productId).single();
        if (error) throw new Error("Não foi possível recuperar a descrição do catálogo. Tente novamente.");
        description = resolveShopeeDescription(product?.description);
      }
    }
    data.variations = normalizeVariationStocks(data.variations, data.stock);
    const activeVariations = data.variations.filter((row) => row.active);
    const stock = activeVariations.length ? activeVariations.reduce((sum, row) => sum + row.stock, 0) : programmedShopeeStock(data.productId);
    const { data: previous } = data.id
      ? await context.supabase.from("shopee_listings").select("promoted_at").eq("id", data.id).eq("user_id", context.userId).maybeSingle()
      : { data: null };
    const payload: ListingInsert = {
      promoted: data.promoted,
      // Fees only count sales after the seller turned promotion on.
      promoted_at: data.promoted ? (previous?.promoted_at ?? new Date().toISOString()) : null,
      user_id: context.userId,
      product_id: data.productId,
      title: data.title,
      description,
      price: data.price,
      stock,
      sku: data.sku,
      condition: data.condition,
      category_id: data.categoryId,
      category_name: data.categoryName,
      weight: data.weight,
      package_length: data.packageLength,
      package_width: data.packageWidth,
      package_height: data.packageHeight,
      images: normalizeProductImages(null, data.images, 9),
      video_url: data.videoUrl,
      size_chart_url: data.sizeChartUrl,
      is_max_ad: data.isMaxAd,
      attributes: data.attributes as Json,
      variations: data.variations as Json,
      logistics: data.logistics as Json,
      status: "draft",
      status_detail: null,
      connection_id: data.connectionId ?? null,
    };
    const query = data.id
      ? context.supabase.from("shopee_listings").update(payload).eq("id", data.id).eq("user_id", context.userId)
      : context.supabase.from("shopee_listings").insert(payload);
    const { data: listing, error } = await query.select().single();
    if (error) throw new Error(error.message);
    return cleanListing(listing as ListingRow);
  });

type ShopeeServer = typeof import("@/lib/shopee.server");

/** The shop item this product already occupies: an earlier PAS listing first, then a matching title. */
async function findExistingShopeeItem(
  shopee: ShopeeServer,
  credentials: { shopId: number; accessToken: string },
  input: { userId: string; listingId: string; productId: string; connectionId: string; title: string; supabase: { from: (table: "shopee_listings") => any } },
) {
  const alive = async (ids: number[]) => {
    if (!ids.length) return [] as Record<string, unknown>[];
    const result = await shopee.getShopeeItemBaseInfo(credentials, ids.slice(0, 50));
    const list = record(result["response"])["item_list"];
    return (Array.isArray(list) ? list as Record<string, unknown>[] : []).filter((item) => !["DELETED", "BANNED"].includes(String(item["item_status"] ?? "").toUpperCase()));
  };
  const { data: previous } = await input.supabase.from("shopee_listings").select("shopee_item_id")
    .eq("user_id", input.userId).eq("product_id", input.productId).eq("connection_id", input.connectionId).neq("id", input.listingId).not("shopee_item_id", "is", null);
  const previousIds = [...new Set(((previous ?? []) as Array<{ shopee_item_id: number | string | null }>).map((row) => Number(row.shopee_item_id)).filter((id) => id > 0))];
  const known = await alive(previousIds);
  if (known[0]) return Number(known[0]["item_id"]);
  let offset = 0;
  for (let page = 0; page < 10; page += 1) {
    const result = await shopee.getShopeeItemList(credentials, offset);
    const response = record(result["response"]);
    const items = Array.isArray(response["item"]) ? response["item"] as Record<string, unknown>[] : [];
    const match = (await alive(items.map((item) => Number(item["item_id"])).filter((id) => id > 0))).find((item) => sameListingTitle(String(item["item_name"] ?? ""), input.title));
    if (match) return Number(match["item_id"]);
    if (!response["has_next_page"] || items.length === 0) break;
    offset = Number(response["next_offset"] ?? offset + items.length);
  }
  return null;
}

/** Shopee answers this when a saved item id was deleted or never existed in the shop. */
function isMissingShopeeItemError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /correct product id|item(?:_id)?\s+(?:does\s+)?not\s+(?:exist|found)|product\s+(?:does\s+)?not\s+(?:exist|found)|item\s+has\s+been\s+deleted/i.test(message);
}

export type PublishOutcome = {
  status: PublishOutcomeStatus;
  message: string;
  blockers: Array<{ code: string; message: string; adminHint?: string }>;
  listing: SafeListing | null;
  itemId: number | null;
  isAdmin: boolean;
};

export const publishShopeeListing = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input) => z.object({ listingId: z.string().uuid(), connectionId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }): Promise<PublishOutcome> => {
    const { data: listing, error: listingError } = await context.supabase
      .from("shopee_listings")
      .select("*")
      .eq("id", data.listingId)
      .eq("user_id", context.userId)
      .single();
    if (listingError || !listing) throw new Error("Rascunho não encontrado.");
    requireShopeeDescription(listing.description);
    if (listing.connection_id && data.connectionId && listing.connection_id !== data.connectionId) throw new Error("Este rascunho pertence a outra loja. Abra a loja original para publicar.");
    const connection = await getFreshConnection(context.userId, data.connectionId ?? listing.connection_id ?? undefined);
    const logistics = Array.isArray(listing.logistics) ? listing.logistics : [];
    let attributes = z.array(shopeeAttributeSchema).parse(Array.isArray(listing.attributes) ? listing.attributes : []);
    const variationRows = z.array(shopeeVariationSchema).parse(Array.isArray(listing.variations) ? listing.variations : []);
    let variationBody = buildVariationPayload(variationRows);
    // "00" is Shopee's official "item without GTIN" declaration; the real code can be added after publishing.
    let gtinCode = "00";
    let remoteVariationNote = "";
    const complianceServer = await import("@/lib/shopee-compliance.server");
    const isAdmin = await complianceServer.isActiveAdmin(context.userId);
    const shopId = Number(connection.shop_id);
    const outcome = (status: PublishOutcomeStatus, message: string, extra: { blockers?: ComplianceIssue[]; listing?: SafeListing | null; itemId?: number | null } = {}): PublishOutcome => ({
      status,
      message: isAdmin ? message : customerMessage(message),
      blockers: (extra.blockers ?? []).map((issue) => ({ code: issue.code, message: issue.message, ...(isAdmin && issue.adminHint ? { adminHint: issue.adminHint } : {}) })),
      listing: extra.listing ?? null,
      itemId: extra.itemId ?? null,
      isAdmin,
    });
    // One publication per shop+product at a time: a double click returns "in progress".
    if (!(await complianceServer.lockPublication(shopId, listing.product_id))) return outcome("in_progress", "Esse produto já está sendo publicado.");
    let savedItemId = listing.shopee_item_id == null ? null : Number(listing.shopee_item_id);
    const compliance = await complianceServer.readCompliance(listing.product_id);
    // The owner removed every local block: products are always sent and Shopee decides.
    const storedBlockers: ComplianceIssue[] = LOCAL_DOCUMENT_BLOCKS && compliance?.publish_status === "blocked" ? documentBlockers(parseIssues(compliance.blockers)) : [];
    if (storedBlockers.length) {
      await complianceServer.savePublication({ shopId, productId: listing.product_id, status: "blocked", itemId: savedItemId, blockers: storedBlockers });
      return outcome("blocked", "Este produto está indisponível na Shopee no momento.", { blockers: storedBlockers, itemId: savedItemId });
    }
    await context.supabase.from("shopee_listings").update({ status: "publishing", status_detail: "Validando categoria e dados obrigatórios." }).eq("id", listing.id);
    let publishStage = "validação dos dados";
    try {
      const shopee = await import("@/lib/shopee.server");
      const credentials = { shopId, accessToken: connection.access_token };
      const categoryResult = await shopee.getShopeeCategories(credentials);
      const categoryList = record(categoryResult["response"])["category_list"];
      const categories = leafShopeeCategories(Array.isArray(categoryList) ? categoryList as ShopeeCategoryOption[] : []);
      const { data: categoryFacts } = await context.supabase.from("products").select("name, description, category, subcategory, url").eq("id", listing.product_id).maybeSingle();
      // Never select unrelated categories to bypass Shopee requirements.
      const { category, supplierRegulatoryFacts } = await complianceServer.resolveShopeeCategory(shopee, credentials, {
        categories,
        overrideId: compliance?.shopee_category_id ?? null, referencePath: readShopeeReference(compliance?.shopee_reference)?.categoryPath ?? null,
        supplierUrl: !listing.shopee_item_id ? categoryFacts?.url ?? null : null,
        name: categoryFacts?.name ?? listing.title,
        title: listing.title,
        category: categoryFacts?.category ?? null,
        subcategory: categoryFacts?.subcategory ?? null,
        currentId: listing.category_id,
      });
      if (!category?.category_id) throw new Error("Não foi possível identificar automaticamente uma categoria adequada para este produto.");
      if (listing.category_id !== category.category_id) attributes = [];
      listing.category_id = category.category_id;
      listing.category_name = category.category_path ?? category.display_category_name ?? category.original_category_name ?? "";
      listing.weight = listing.weight || 0.3;
      // Re-check the shop's channels every time: a saved channel may have been switched off since.
      let channels: unknown[] | null = null;
      try {
        const channelsResult = await shopee.getShopeeLogistics(credentials);
        const channelsResponse = record(channelsResult["response"]);
        const list = channelsResponse["logistics_channel_list"] ?? channelsResponse["logistic_channel_list"];
        channels = Array.isArray(list) ? list : null;
      } catch (error) {
        if (logistics.length === 0) throw error;
      }
      if (channels) {
        const enabledIds = channels.filter((entry) => record(entry)["enabled"] !== false).map((entry) => Number(record(entry)["logistics_channel_id"] ?? record(entry)["logistic_id"])).filter((id) => id > 0);
        const kept = logistics.filter((entry) => enabledIds.includes(Number(record(entry)["logistic_id"])));
        logistics.splice(0, logistics.length, ...(kept.length ? kept : enabledIds.slice(0, 1).map((id) => ({ logistic_id: id, enabled: true }))));
      }
      if (logistics.length === 0) throw new Error("A loja não tem nenhum canal de envio ativo na Shopee. Ative pelo menos um em Central do Vendedor > Configurações de envio e tente novamente.");
      await context.supabase.from("shopee_listings").update({ category_id: listing.category_id, category_name: listing.category_name, weight: listing.weight, logistics: logistics as Json }).eq("id", listing.id).eq("user_id", context.userId);
      const { detectSizeChartImage } = await import("@/lib/shopee-requirements.server");
      const { data: facts } = await context.supabase.from("products").select("name, description, brand").eq("id", listing.product_id).maybeSingle();
      const evaluation = await complianceServer.evaluateRequirements(shopee, credentials, {
        categoryId: Number(listing.category_id),
        product: { name: facts?.name ?? listing.title, description: `${listing.description}\n${facts?.description ?? ""}\n${supplierRegulatoryFacts}`, brand: facts?.brand ?? null },
        compliance,
        existing: attributes,
        images: normalizeProductImages(null, listing.images, 6),
      });
      const rules = evaluation.rules;
      // Only missing documents stop the listing; every other gap is sent and Shopee decides.
      attributes = evaluation.attributes;
      gtinCode = evaluation.gtin ?? "00";
      await complianceServer.saveComplianceCheck(listing.product_id, { ...evaluation, categoryId: Number(listing.category_id) });
      await context.supabase.from("shopee_listings").update({ attributes: attributes as Json }).eq("id", listing.id).eq("user_id", context.userId);
      if (LOCAL_DOCUMENT_BLOCKS && evaluation.documentBlockers.length) {
        const detail = `Indisponível na Shopee no momento: ${evaluation.documentBlockers.map((issue) => issue.message).join(" ")}`;
        await context.supabase.from("shopee_listings").update({ status: "draft", status_detail: detail }).eq("id", listing.id).eq("user_id", context.userId);
        await complianceServer.savePublication({ shopId, productId: listing.product_id, status: "blocked", itemId: savedItemId, blockers: evaluation.documentBlockers });
        return outcome("blocked", "Este produto está indisponível na Shopee no momento.", { blockers: evaluation.documentBlockers, itemId: savedItemId });
      }
      let currentModelResult: Record<string, unknown> | null = null;
      if (listing.shopee_item_id) {
        try {
          currentModelResult = await shopee.getShopeeModelList(credentials, Number(listing.shopee_item_id));
        } catch (error) {
          // The saved item no longer exists in this shop (deleted in Seller Center):
          // forget the stale reference and create the listing again.
          if (!isMissingShopeeItemError(error)) throw error;
          listing.shopee_item_id = null;
          await context.supabase.from("shopee_listings").update({ shopee_item_id: null, shopee_link: null }).eq("id", listing.id).eq("user_id", context.userId);
        }
      }
      // Existing remote combinations are never deleted: a different local
      // structure only updates the combinations that match by option name.
      let { currentModels, currentTiers, hasRemoteVariations, sameRemoteShape, keepRemoteVariations } = remoteVariationState(currentModelResult, variationBody?.tier_variation);
      const { data: catalogProduct } = await context.supabase
        .from("products")
        .select("brand, url, primary_image, gallery_images")
        .eq("id", listing.product_id)
        .maybeSingle();
      const programmedStock = programmedShopeeStock(listing.product_id);
      const catalogBrand = typeof catalogProduct?.brand === "string" ? catalogProduct.brand.trim() : "";
      let brand = { brand_id: 0, original_brand_name: catalogBrand || "No Brand" };
      if (catalogBrand) {
        try {
          const brandResult = await shopee.getShopeeBrands(credentials, Number(listing.category_id));
          const brandResponse = brandResult["response"] as Record<string, unknown> | undefined;
          const brandList = Array.isArray(brandResponse?.["brand_list"])
            ? brandResponse["brand_list"] as Record<string, unknown>[]
            : [];
          const normalizedBrand = catalogBrand.toLocaleLowerCase("pt-BR");
          const matchedBrand = brandList.find((item) => String(item["original_brand_name"] ?? item["display_brand_name"] ?? "").trim().toLocaleLowerCase("pt-BR") === normalizedBrand);
          if (matchedBrand) {
            brand = {
              brand_id: Number(matchedBrand["brand_id"] ?? 0),
              original_brand_name: String(matchedBrand["original_brand_name"] ?? matchedBrand["display_brand_name"] ?? catalogBrand),
            };
          }
        } catch {
          // A valid custom brand name or Shopee's official "No Brand" value
          // can still be submitted when the category has no brand catalogue.
        }
      }
      const selectedChannelIds = logistics
        .map((entry) => entry && typeof entry === "object" ? Number((entry as Record<string, unknown>)["logistic_id"] ?? 0) : 0)
        .filter((id) => id > 0);
      if (selectedChannelIds.length === 0) {
        throw new Error("Selecione pelo menos um canal de envio antes de publicar.");
      }
      // Publish exactly the gallery the user selected (already resized in the
      // browser). Re-adding catalogue photos used to bring back rejected ones.
      const selectedImages = normalizeProductImages(null, listing.images, 9);
      const uniqueImages = selectedImages.length
        ? selectedImages
        : normalizeProductImages(null, [catalogProduct?.primary_image, ...((catalogProduct?.gallery_images as string[] | null) ?? [])], 9);
      if (uniqueImages.length === 0) {
        throw new Error("Este produto não possui nenhuma foto disponível para publicar. Envie uma foto pela galeria do aparelho.");
      }
      const imageIds: string[] = [];
      const acceptedImages: string[] = [];
      const imageErrors: string[] = [];
      publishStage = "envio das imagens";
      for (const [index, imageUrl] of uniqueImages.entries()) {
        try {
          const uploaded = await shopee.uploadShopeeImage(credentials, imageUrl);
          const response = uploaded["response"] as Record<string, unknown> | undefined;
          const imageId = response?.["image_info"] && typeof response["image_info"] === "object"
            ? String((response["image_info"] as Record<string, unknown>)["image_id"] ?? "")
            : "";
          if (!imageId) throw new Error("A Shopee não devolveu o código da imagem.");
          imageIds.push(imageId);
          acceptedImages.push(imageUrl);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "imagem recusada";
          imageErrors.push(`Foto ${index + 1}: ${reason}`);
        }
      }
      if (imageIds.length === 0) {
        throw new Error(`A Shopee não aceitou nenhuma das ${uniqueImages.length} fotos. Abra o editor novamente para ajustar as fotos automaticamente. ${imageErrors.at(0) ?? ""}`.trim());
      }
      const builtVariations = buildVariationPayload(variationRows, Object.fromEntries(acceptedImages.map((url, index) => [url, imageIds[index] ?? ""])));
      variationBody = builtVariations ? { ...builtVariations, model: builtVariations.model.map((model) => ({ ...model, gtin_code: gtinCode })) } : builtVariations;
      // Rejected photos are dropped instead of blocking the whole listing.
      await context.supabase.from("shopee_listings").update({ images: acceptedImages }).eq("id", listing.id).eq("user_id", context.userId);
      let sizeChartInfo: { size_chart?: string; size_chart_id?: number } | undefined;
      const template = rules.sizeChartRequired && rules.sizeChartTemplate && compliance?.size_chart_template_name
        ? await complianceServer.pickSizeChartTemplate(shopee, credentials, Number(listing.category_id), compliance.size_chart_template_name)
        : null;
      if (template) sizeChartInfo = { size_chart_id: template.id };
      else if (rules.sizeChartRequired) {
        const uploadChart = async (url: string) => {
          const acceptedIndex = acceptedImages.indexOf(url);
          if (acceptedIndex >= 0) return imageIds[acceptedIndex] ?? null;
          const uploaded = await shopee.uploadShopeeImage(credentials, url);
          return String(record(record(uploaded["response"])["image_info"])["image_id"] ?? "") || null;
        };
        // Catalogue chart first, then the listing's own, then the owner's standard chart.
        const chart = (compliance?.size_chart_image_url ? await availableSizeChart(compliance.size_chart_image_url, [], async () => null, uploadChart) : null)
          ?? await availableSizeChart(listing.size_chart_url, uniqueImages, detectSizeChartImage, uploadChart)
          ?? await availableSizeChart(OWNER_SIZE_CHART_URL, [], async () => null, uploadChart);
        if (chart) {
          sizeChartInfo = chart.info;
          if (!listing.size_chart_url) await context.supabase.from("shopee_listings").update({ size_chart_url: chart.url }).eq("id", listing.id).eq("user_id", context.userId);
        }
      }
      const baseBody = {
        item_name: listing.title,
        description: listing.description,
        item_sku: listing.sku ? listing.sku.slice(0, 100) : undefined,
        category_id: Number(listing.category_id),
        original_price: Number(listing.price),
        normal_stock: variationBody ? 0 : programmedStock,
        seller_stock: [{ stock: variationBody ? 0 : programmedStock }],
        image: { image_id_list: imageIds },
        brand,
        weight: Number(listing.weight),
        dimension: listing.package_length && listing.package_width && listing.package_height ? {
          package_length: Number(listing.package_length),
          package_width: Number(listing.package_width),
          package_height: Number(listing.package_height),
        } : undefined,
        logistic_info: logistics,
        attribute_list: attributes,
        condition: listing.condition,
        gtin_code: gtinCode,
        ...(sizeChartInfo ? { size_chart_info: sizeChartInfo } : {}),
      };
      let response: Record<string, unknown>;
      let itemId = listing.shopee_item_id == null ? null : Number(listing.shopee_item_id);
      publishStage = itemId ? "atualização do anúncio" : "criação do anúncio";
      if (itemId) {
        const { original_price: _price, normal_stock: _stock, seller_stock: _sellerStock, ...updateBody } = baseBody;
        response = await shopee.updateShopeeItem(credentials, { ...updateBody, item_id: itemId });
        if (!hasRemoteVariations && !variationBody) await Promise.all([
          shopee.updateShopeePrice(credentials, { item_id: itemId, price_list: [{ model_id: 0, original_price: Number(listing.price) }] }),
          shopee.updateShopeeStock(credentials, { item_id: itemId, stock_list: [{ model_id: 0, seller_stock: [{ stock: programmedStock }] }] }),
        ]);
      } else {
        try {
          response = await shopee.addShopeeItem(credentials, baseBody);
          const responseData = response["response"] as Record<string, unknown> | undefined;
          itemId = Number(responseData?.["item_id"] ?? 0) || null;
        } catch (error) {
          // Shopee refuses a copy of a product already in the shop: link and update that item instead.
          if (!(error instanceof Error) || !error.message.startsWith("Já existe um produto igual")) throw error;
          publishStage = "vínculo com o anúncio que já existe na loja";
          const existingId = await findExistingShopeeItem(shopee, credentials, { userId: context.userId, listingId: listing.id, productId: listing.product_id, connectionId: connection.id, title: listing.title, supabase: context.supabase });
          if (!existingId) throw error;
          itemId = existingId;
          ({ currentModels, currentTiers, hasRemoteVariations, sameRemoteShape, keepRemoteVariations } = remoteVariationState(await shopee.getShopeeModelList(credentials, itemId), variationBody?.tier_variation));
          publishStage = "atualização do anúncio que já existia";
          const { original_price: _price, normal_stock: _stock, seller_stock: _sellerStock, ...updateBody } = baseBody;
          response = await shopee.updateShopeeItem(credentials, { ...updateBody, item_id: itemId });
          if (!hasRemoteVariations && !variationBody) await Promise.all([
            shopee.updateShopeePrice(credentials, { item_id: itemId, price_list: [{ model_id: 0, original_price: Number(listing.price) }] }),
            shopee.updateShopeeStock(credentials, { item_id: itemId, stock_list: [{ model_id: 0, seller_stock: [{ stock: programmedStock }] }] }),
          ]);
          remoteVariationNote += " O produto já existia na loja e o anúncio existente foi atualizado.";
        }
      }
      if (!itemId) throw new Error("A Shopee não devolveu o código do anúncio.");
      // Persist immediately: a later variation/verification failure must not create a duplicate on retry.
      const { error: itemSaveError } = await context.supabase.from("shopee_listings").update({ shopee_item_id: itemId, connection_id: connection.id, shopee_link: `https://shopee.com.br/product/${connection.shop_id}/${itemId}` }).eq("id", listing.id).eq("user_id", context.userId);
      if (itemSaveError) throw new Error(`A Shopee criou o anúncio ${itemId}, mas o Shop Center não conseguiu salvar a referência. Não republique; sincronize a loja.`);
      savedItemId = itemId;
      // Keep the row "publishing" (still locked) while variations finish; only the item ID is recorded now.
      await complianceServer.savePublication({ shopId, productId: listing.product_id, status: "publishing", itemId });
      if (variationBody && !hasRemoteVariations) {
        publishStage = "criação das variações";
        await shopee.initShopeeVariations(credentials, { item_id: itemId, ...variationBody });
      } else if (variationBody && sameRemoteShape && Array.isArray(currentModels)) {
        publishStage = "atualização dos preços e estoques das variações";
        const modelUpdates = variationBody.model.map((model) => {
          const remote = findShopeeModelByTier(currentModels, model.tier_index);
          const modelId = Number(record(remote)["model_id"]);
          if (!modelId) throw new Error("Uma combinação não existe no anúncio da Shopee. Sincronize antes de atualizar.");
          return { modelId, ...model };
        });
        await shopee.updateShopeePrice(credentials, { item_id: itemId, price_list: modelUpdates.map((model) => ({ model_id: model.modelId, original_price: model.original_price })) });
        await shopee.updateShopeeStock(credentials, { item_id: itemId, stock_list: modelUpdates.map((model) => ({ model_id: model.modelId, seller_stock: model.seller_stock })) });
      } else if (keepRemoteVariations && Array.isArray(currentModels) && Array.isArray(currentTiers)) {
        publishStage = "atualização das variações existentes";
        const matched = matchRowsToRemoteModels(variationRows.filter((row) => row.active), currentTiers, currentModels);
        if (matched.length) {
          await shopee.updateShopeePrice(credentials, { item_id: itemId, price_list: matched.map(({ row, modelId }) => ({ model_id: modelId, original_price: row.price })) });
          await shopee.updateShopeeStock(credentials, { item_id: itemId, stock_list: matched.map(({ row, modelId }) => ({ model_id: modelId, seller_stock: [{ stock: row.stock }] })) });
          const byRow = new Map(matched.map(({ row, modelId }) => [row, modelId]));
          await context.supabase.from("shopee_listings").update({ variations: variationRows.map((row) => byRow.has(row) ? { ...row, model_id: byRow.get(row) ?? row.model_id, status: "published" as const } : row) as Json }).eq("id", listing.id).eq("user_id", context.userId);
        }
        remoteVariationNote = " As variações que já estavam na Shopee foram mantidas.";
      }
      if (variationBody && !keepRemoteVariations) {
        publishStage = "confirmação das variações";
        let models: unknown[] = [];
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const modelsResult = await shopee.getShopeeModelList(credentials, itemId);
          const receivedModels = record(modelsResult["response"])["model"];
          models = Array.isArray(receivedModels) ? receivedModels : [];
          const complete = variationBody.model.every((expected) => Boolean(findShopeeModelByTier(models, expected.tier_index)));
          if (complete) break;
          if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
        if (variationBody.model.some((expected) => !findShopeeModelByTier(models, expected.tier_index))) throw new Error("A Shopee ainda está processando as variações. O anúncio foi preservado; aguarde alguns instantes e tente novamente.");
        const publishedVariations = variationRows.map((row) => {
          if (!row.active) return row;
          const options1 = [...new Set(variationRows.filter((item) => item.active).map((item) => item.option1))];
          const options2 = [...new Set(variationRows.filter((item) => item.active).map((item) => item.option2).filter((value): value is string => Boolean(value)))];
          const tierIndex = [options1.indexOf(row.option1), ...(row.name2 ? [options2.indexOf(row.option2 ?? "")] : [])];
          const remote = findShopeeModelByTier(models, tierIndex);
          const modelId = Number(record(remote)["model_id"]);
          return { ...row, model_id: modelId || row.model_id, status: modelId ? "published" as const : "failed" as const };
        });
        await context.supabase.from("shopee_listings").update({ variations: publishedVariations as Json }).eq("id", listing.id).eq("user_id", context.userId);
      }
      const verification = await shopee.getShopeeItemBaseInfo(credentials, [itemId]);
      publishStage = "confirmação final do anúncio";
      const verificationResponse = verification["response"] as Record<string, unknown> | undefined;
      const verifiedItems = Array.isArray(verificationResponse?.["item_list"])
        ? verificationResponse["item_list"] as Record<string, unknown>[]
        : [];
      const verifiedItem = verifiedItems.find((item) => Number(item["item_id"]) === itemId);
      if (!verifiedItem) throw new Error("A Shopee recebeu o anúncio, mas ainda não confirmou a publicação. Tente sincronizar em instantes.");
      const remoteStatus = String(verifiedItem["item_status"] ?? "UNKNOWN").toUpperCase();
      const published = remoteStatus === "NORMAL";
      const rejected = ["BANNED", "DELETED"].includes(remoteStatus);
      const shopeeLink = `https://shopee.com.br/product/${connection.shop_id}/${itemId}`;
      const { data: saved, error } = await context.supabase.from("shopee_listings").update({
        connection_id: connection.id,
        stock: variationRows.some((row) => row.active) ? variationRows.filter((row) => row.active).reduce((sum, row) => sum + row.stock, 0) : programmedStock,
        shopee_item_id: itemId,
        status: published ? "published" : rejected ? "rejected" : "reviewing",
        status_detail: published
          ? `Publicado e confirmado na Shopee.${remoteVariationNote}`
          : rejected
            ? `A Shopee retornou o status ${remoteStatus}.`
            : `Recebido pela Shopee com status ${remoteStatus}.`,
        shopee_image_ids: imageIds,
        shopee_link: shopeeLink,
        request_payload: { ...baseBody, ...(variationBody ?? {}) } as Json,
        response_payload: response as Json,
        last_synced_at: new Date().toISOString(),
        published_at: listing.published_at ?? new Date().toISOString(),
      }).eq("id", listing.id).select().single();
      if (error) throw new Error(error.message);
      await complianceServer.savePublication({ shopId, productId: listing.product_id, status: rejected ? "failed" : "published", itemId, lastError: rejected ? `Status ${remoteStatus}` : null });
      if (rejected) return outcome("failed", `A Shopee retornou o status ${remoteStatus} para este anúncio. Veja o motivo na Central do Vendedor, em Meus Produtos.`, { listing: cleanListing(saved as ListingRow), itemId });
      const message = published
        ? `${listing.shopee_item_id ? "Anúncio atualizado e confirmado na Shopee." : "Produto publicado e confirmado na Shopee."}${remoteVariationNote}`
        : "A Shopee recebeu o anúncio e está analisando. O status será atualizado na sincronização.";
      return outcome("published", message, { listing: cleanListing(saved as ListingRow), itemId });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Não foi possível publicar na Shopee.";
      const message = `Falha na etapa de ${publishStage}: ${reason}`;
      const partial = savedItemId != null && /varia/i.test(publishStage);
      await context.supabase.from("shopee_listings").update({ status: "failed", status_detail: partial ? "Anúncio criado. Falta concluir as variações." : message }).eq("id", listing.id);
      await complianceServer.savePublication({ shopId, productId: listing.product_id, status: partial ? "partial" : "failed", itemId: savedItemId, lastError: message });
      if (partial) return outcome("partial", "Anúncio criado. Falta concluir as variações: clique em publicar de novo em alguns minutos.", { itemId: savedItemId });
      return outcome("failed", message, { itemId: savedItemId });
    }
  });
/** Shops connected by the signed-in admin; one of them is the reference shop for catalogue checks. */
export const listAdminShopeeShops = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("shopee_shop_connections").select("id, shop_id, shop_name")
      .eq("user_id", context.userId).eq("status", "active").order("updated_at", { ascending: false });
    return (data ?? []).map((shop) => ({ id: shop.id, shopId: Number(shop.shop_id), name: shop.shop_name || `Loja ${shop.shop_id}` }));
  });

/**
 * Dry-run of the publishing requirements against the admin's reference shop.
 * Nothing is published; results are stored in the catalogue compliance table.
 */
export const checkShopeeCatalog = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: unknown) => z.object({
    connectionId: z.string().uuid(),
    productIds: z.array(z.string().uuid()).max(20).optional(),
    offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(6).default(4),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const complianceServer = await import("@/lib/shopee-compliance.server");
    const connection = await getFreshConnection(context.userId, data.connectionId);
    const shopee = await import("@/lib/shopee.server");
    const credentials = { shopId: Number(connection.shop_id), accessToken: connection.access_token };
    let query = supabaseAdmin.from("products").select("id, name, description, brand, category, subcategory, url, primary_image, gallery_images");
    query = data.productIds?.length ? query.in("id", data.productIds) : query.order("created_at", { ascending: true }).order("id").range(data.offset, data.offset + data.limit - 1);
    const { data: rows, error } = await query;
    if (error) throw new Error("Não foi possível ler o catálogo.");
    const categoryResult = rows?.length ? await shopee.getShopeeCategories(credentials) : null;
    const categoryList = record(categoryResult?.["response"])["category_list"];
    const categories = leafShopeeCategories(Array.isArray(categoryList) ? categoryList as ShopeeCategoryOption[] : []);
    const results: Array<{ productId: string; name: string; status: string; blockers: ComplianceIssue[]; warnings: ComplianceIssue[]; error?: string }> = [];
    for (const row of rows ?? []) {
      try {
        const compliance = await complianceServer.readCompliance(row.id);
        const { category, supplierRegulatoryFacts } = await complianceServer.resolveShopeeCategory(shopee, credentials, {
          categories,
          overrideId: compliance?.shopee_category_id ?? null, referencePath: readShopeeReference(compliance?.shopee_reference)?.categoryPath ?? null,
          supplierUrl: row.url,
          name: row.name,
          title: row.name,
          category: row.category,
          subcategory: row.subcategory,
        });
        if (!category?.category_id) {
          const warning: ComplianceIssue = { level: "warning", code: "CATEGORY_MISSING", message: "Não foi possível identificar a categoria Shopee deste produto.", adminHint: "Informe a Categoria Shopee na aba Shopee / Exigências." };
          await complianceServer.saveComplianceCheck(row.id, { blockers: [], warnings: [warning], attributes: [], categoryId: null });
          results.push({ productId: row.id, name: row.name, status: "warning", blockers: [], warnings: [warning] });
          continue;
        }
        const evaluation = await complianceServer.evaluateRequirements(shopee, credentials, {
          categoryId: Number(category.category_id),
          product: { name: row.name, description: `${row.description ?? ""}\n${supplierRegulatoryFacts}`, brand: row.brand },
          compliance,
          existing: [],
          images: normalizeProductImages(row.primary_image, row.gallery_images, 6),
          ai: false,
        });
        await complianceServer.saveComplianceCheck(row.id, { ...evaluation, categoryId: Number(category.category_id) });
        const status = evaluation.documentBlockers.length ? "blocked" : evaluation.warnings.length || evaluation.blockers.length ? "warning" : "ok";
        results.push({ productId: row.id, name: row.name, status, blockers: evaluation.blockers, warnings: evaluation.warnings });
      } catch (checkError) {
        results.push({ productId: row.id, name: row.name, status: "error", blockers: [], warnings: [], error: checkError instanceof Error ? checkError.message : "Falha na checagem." });
      }
    }
    return { checked: rows?.length ?? 0, nextOffset: data.offset + (rows?.length ?? 0), results };
  });

/**
 * "Organizar envio + etiqueta": arranges shipment when Shopee allows it without invented data,
 * then returns the official label (PDF, base64). Only the seller's own synced orders are accepted.
 */
export const getShopeeShippingLabel = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ connectionId: z.string().uuid(), orderSn: z.string().trim().min(5).max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase.from("shopee_orders").select("order_sn, status").eq("connection_id", data.connectionId).eq("order_sn", data.orderSn).maybeSingle();
    if (!order) throw new Error("Pedido não encontrado nesta loja. Sincronize os pedidos e tente de novo.");
    const { LABEL_STATUSES, labelBlock, labelErrorMessage, labelType, planShipment } = await import("@/lib/shopee-shipping");
    if (!LABEL_STATUSES.has(order.status)) throw new Error("A etiqueta só fica disponível para pedidos pagos que ainda não foram enviados.");
    return withFreshConnection(context.userId, data.connectionId, async (connection) => {
      const shopee = await import("@/lib/shopee.server");
      const credentials = { shopId: Number(connection.shop_id), accessToken: connection.access_token };
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      // Shopee's own current state wins over our last sync (the buyer may have cancelled since).
      const live = await shopee.getShopeeOrderPackage(credentials, data.orderSn).catch(() => null);
      const block = live ? labelBlock(live) : null;
      if (block) {
        if (block.status) await context.supabase.from("shopee_orders").update({ status: block.status }).eq("connection_id", data.connectionId).eq("order_sn", data.orderSn);
        return { ok: false as const, message: block.message };
      }

      let arranged = order.status !== "READY_TO_SHIP";
      if (!arranged) {
        const plan = planShipment(data.orderSn, await shopee.getShopeeShippingParameter(credentials, data.orderSn));
        if (plan.kind === "manual") return { ok: false as const, message: plan.reason };
        try {
          await shopee.shipShopeeOrder(credentials, plan.body);
        } catch (error) {
          // Already arranged elsewhere (Seller Center): continue to the label.
          if (!/already|shipped|processed|arranged/i.test(error instanceof Error ? error.message : "")) throw error;
        }
        arranged = true;
        await context.supabase.from("shopee_orders").update({ status: "PROCESSED" }).eq("connection_id", data.connectionId).eq("order_sn", data.orderSn);
      }

      let trackingNumber = "";
      for (let attempt = 0; attempt < 6 && !trackingNumber; attempt += 1) {
        if (attempt) await wait(1500);
        const tracking = await shopee.getShopeeTrackingNumber(credentials, data.orderSn).catch(() => ({}));
        trackingNumber = String(((tracking as Record<string, unknown>)["response"] as Record<string, unknown> | undefined)?.["tracking_number"] ?? "");
      }
      if (!trackingNumber) return { ok: false as const, pending: true, message: "Envio organizado. A Shopee ainda está gerando o rastreio; tente baixar a etiqueta em 1 minuto." };

      const documentType = labelType(await shopee.getShopeeShippingDocumentParameter(credentials, data.orderSn));
      try {
        await shopee.createShopeeShippingDocument(credentials, { order_sn: data.orderSn, tracking_number: trackingNumber, shipping_document_type: documentType });
      } catch (error) {
        const raw = error instanceof Error ? error.message : "";
        // Creating twice is harmless; keep going to the download.
        if (!/already|exist|ready/i.test(raw)) return { ok: false as const, message: labelErrorMessage(raw) };
      }
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (attempt) await wait(1500);
        const result = await shopee.getShopeeShippingDocumentResult(credentials, data.orderSn, documentType);
        const first = ((result["response"] as Record<string, unknown> | undefined)?.["result_list"] as Record<string, unknown>[] | undefined)?.[0];
        const status = String(first?.["status"] ?? "");
        if (status === "FAILED") return { ok: false as const, message: "A Shopee não conseguiu gerar a etiqueta deste pedido. Tente pela Central do Vendedor." };
        if (status !== "READY") continue;
        const pdf = await shopee.downloadShopeeShippingDocument(credentials, data.orderSn, documentType);
        let binary = "";
        for (let i = 0; i < pdf.length; i += 0x8000) binary += String.fromCharCode(...pdf.subarray(i, i + 0x8000));
        return { ok: true as const, trackingNumber, fileName: `etiqueta-shopee-${data.orderSn}.pdf`, pdfBase64: btoa(binary) };
      }
      return { ok: false as const, pending: true, message: "Envio organizado. A etiqueta ainda está sendo gerada pela Shopee; tente baixar de novo em 1 minuto." };
    });
  });
