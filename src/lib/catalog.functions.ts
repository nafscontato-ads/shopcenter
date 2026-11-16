import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { isOwnerAccount, isPartnerOrOwner, requireActiveUser } from "@/lib/access-control";

import type { Product } from "@/lib/pas-data";
import { normalizeProductImages } from "@/lib/product-images";
import { encodeCatalog, type CatalogWire } from "@/lib/catalog-wire";
import { productNameKey, uniqueByName } from "@/lib/product-name-key";
import { CATALOG_SUPPLIER_SOURCES, OWNER_LIVE_PRODUCT_NAME_PATTERNS, PARTNER_CATALOG_LIMIT, RETIRED_SUPPLIER_SOURCES } from "@/lib/supplier-directory";

const LIST_COLUMNS =
  "id, name, price, promo_price, commission, rating, reviews_label, category, subcategory, brand, sku, viral_score, primary_image, gallery_images, video_url, url, sold_count, supplier_source, supplier_cost";
const PAGE = 1000;

/**
 * Which products the shared catalogue holds. Saved copies built under other rules are rebuilt,
 * so changing the rules (e.g. the 16/11 supplier change) takes effect on the next deploy.
 */
const CATALOG_RULES = "novos-fornecedores-2026-11-16-click-shop";

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

type Row = Record<string, unknown>;

function usable(p: Row) {
  const gallery = (p["gallery_images"] as string[] | null) ?? [];
  const hasImage = Boolean(p["primary_image"]) || gallery.length > 0;
  const price = Number(p["price"]);
  const promo = p["promo_price"] == null ? null : Number(p["promo_price"]);
  return hasImage && ((promo != null && promo > 0) || price > 0);
}

function toProduct(p: Row): Product {
  const images = normalizeProductImages(p["primary_image"] as string | null, p["gallery_images"] as string[] | null);
  return {
    id: p["id"] as string,
    name: p["name"] as string,
    price: Number(p["price"]),
    promoPrice: p["promo_price"] == null ? null : Number(p["promo_price"]),
    commission: Number(p["commission"]),
    rating: Number(p["rating"] ?? 0),
    reviews: (p["reviews_label"] as string | null) ?? "—",
    category: (p["category"] as string | null) ?? "Outros",
    brand: (p["brand"] as string | null) ?? null,
    // Descriptions are loaded on demand (getCatalogProductDetails) to keep the catalogue light.
    description: null,
    subcategory: (p["subcategory"] as string | null) ?? null,
    sku: (p["sku"] as string | null) ?? null,
    images,
    videoUrl: (p["video_url"] as string | null) ?? null,
    viral: Number(p["viral_score"]) >= 80,
    score: Number(p["viral_score"]),
    image: images[0] ?? null,
    url: (p["url"] as string | null) ?? null,
    soldCount: Number(p["sold_count"] ?? 0),
    supplierSource: (p["supplier_source"] as string | null) ?? null,
    supplierCost: p["supplier_cost"] == null ? null : Number(p["supplier_cost"]),
  };
}

/** Full active catalogue used inside PAS (Produtos, Studio, Facebook, Shopee). */
// The shared catalogue is identical for every visitor, so each server instance keeps the
// ready text for a few minutes instead of re-reading ~10k rows per screen open (this load
// was the main cause of database overload). Only the finished text is shared between
// requests: an in-flight load is never awaited by another request, which edge runtimes cancel.
const CATALOG_TTL_MS = 3 * 60_000; // in-memory layer on top of the database copy (catalog_snapshot)
const PAGE_CONCURRENCY = 3;
let catalogCache: { text: string; at: number } | null = null;

async function loadCatalogText(): Promise<string> {
  const db = await publicClient();
  const { count, error: countError } = await db.from("products").select("id", { count: "exact", head: true }).eq("status", "active").in("supplier_source", CATALOG_SUPPLIER_SOURCES);
  if (countError) throw new Error(countError.message);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const pageRows: Row[][] = new Array(pages);
  for (let start = 0; start < pages; start += PAGE_CONCURRENCY) {
    const batch = Array.from({ length: Math.min(PAGE_CONCURRENCY, pages - start) }, (_, offset) => start + offset);
    const results = await Promise.all(
      batch.map((index) =>
        db
          .from("products")
          .select(LIST_COLUMNS)
          .eq("status", "active")
          .in("supplier_source", CATALOG_SUPPLIER_SOURCES)
          .order("viral_score", { ascending: false })
          .order("id")
          .range(index * PAGE, index * PAGE + PAGE - 1),
      ),
    );
    results.forEach((result, i) => {
      if (result.error) throw new Error(result.error.message);
      pageRows[batch[i]!] = (result.data ?? []) as Row[];
    });
  }
  const rows = pageRows.flat();
  // Plain JSON text: much smaller than the default structured serialization for ~10k rows.
  // `rules` comes first so a saved copy's rules can be checked without parsing ~10k rows.
  return JSON.stringify({ rules: CATALOG_RULES, ...encodeCatalog(rows.filter(usable).map(toProduct)) } satisfies CatalogWire);
}

/**
 * Ready copy kept in the database (`catalog_snapshot`): one row read instead of rebuilding
 * ~10k products. Any product change stamps `changed_at`; a copy built before that is rebuilt.
 */
async function snapshotCatalogText(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: snapshot } = await supabaseAdmin.from("catalog_snapshot").select("body, built_at, changed_at").eq("id", "main").maybeSingle();
  const sameRules = Boolean(snapshot?.body?.startsWith(`{"rules":${JSON.stringify(CATALOG_RULES)},`));
  if (snapshot?.body && sameRules && snapshot.built_at && Date.parse(snapshot.built_at) > Date.parse(snapshot.changed_at)) return snapshot.body;
  const startedAt = new Date().toISOString();
  const text = await loadCatalogText();
  // built_at is the start time, so a change made during the rebuild still marks this copy outdated.
  if (snapshot) await supabaseAdmin.from("catalog_snapshot").update({ body: text, built_at: startedAt }).eq("id", "main");
  else await supabaseAdmin.from("catalog_snapshot").insert({ id: "main", body: text, built_at: startedAt, changed_at: new Date(0).toISOString() });
  return text;
}

export const listCatalog = createServerFn({ method: "GET" }).handler(async (): Promise<string> => {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.text;
  const text = await snapshotCatalogText().catch(() => loadCatalogText());
  catalogCache = { text, at: Date.now() };
  return text;
});

/** Small preview for the public sales pages: a few top products plus the catalogue size. */
// Every public page view used to run these two queries; a short per-instance copy keeps the sales page fast.
let previewCache: { value: { products: Product[]; total: number }; at: number } | null = null;

export const listCatalogPreview = createServerFn({ method: "GET" }).handler(async (): Promise<{ products: Product[]; total: number }> => {
  if (previewCache && Date.now() - previewCache.at < CATALOG_TTL_MS) return previewCache.value;
  const db = await publicClient();
  const [{ data, error }, { count }] = await Promise.all([
    db.from("products").select(LIST_COLUMNS).eq("status", "active").in("supplier_source", CATALOG_SUPPLIER_SOURCES).not("primary_image", "is", null).order("viral_score", { ascending: false }).order("id").limit(12),
    db.from("products").select("id", { count: "exact", head: true }).eq("status", "active").in("supplier_source", CATALOG_SUPPLIER_SOURCES).not("primary_image", "is", null),
  ]);
  if (error) throw new Error(error.message);
  const value = { products: ((data ?? []) as Row[]).filter(usable).map(toProduct), total: count ?? 0 };
  previewCache = { value, at: Date.now() };
  return value;
});

/** Long text of one catalogue product, loaded only when a product is opened. */
export const getCatalogProductDetails = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const db = await publicClient();
    const { data: row, error } = await db.from("products").select("description").eq("id", data.id).eq("status", "active").maybeSingle();
    if (error) throw new Error(error.message);
    return { description: (row?.description as string | null) ?? null };
  });

/** Supplier purchase pages for a handful of catalogue products (orders list). */
export const getSupplierLinks = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .inputValidator((input: { ids: string[] }) => z.object({ ids: z.array(z.string().uuid()).max(300) }).parse(input))
  .handler(async ({ data }) => {
    if (!data.ids.length) return {} as Record<string, { url: string; source: string }>;
    // Link do fornecedor é o que o aluno paga para ter: só servidor + aluno liberado.
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await db.from("products").select("id, supplier_source, supplier_url").in("id", data.ids).eq("status", "active").not("supplier_url", "is", null);
    if (error) throw new Error(error.message);
    return Object.fromEntries((rows ?? []).map((row) => [row.id as string, { url: row.supplier_url as string, source: row.supplier_source as string }]));
  });

/**
 * Owner only: products of the retired suppliers that the owner keeps for the lives
 * (the Christmas tree, owner decision 2026-11-16). Never part of the shared catalogue;
 * every other account gets an empty list.
 */
export const listOwnerLiveProducts = createServerFn({ method: "GET" })
  .middleware([requireActiveUser])
  .handler(async ({ context }): Promise<Product[]> => {
    if (!(await isOwnerAccount(context.supabase, context.userId))) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("products")
      .select(LIST_COLUMNS)
      .eq("status", "active")
      .in("supplier_source", RETIRED_SUPPLIER_SOURCES)
      .or(OWNER_LIVE_PRODUCT_NAME_PATTERNS.map((pattern) => `name.ilike.${pattern}`).join(","))
      .order("viral_score", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    // One copy per name: skip names the owner already has as an owner-exclusive product (pinned in Integração).
    const { data: exclusive } = await supabaseAdmin.from("products").select("name").eq("status", "owner_exclusive");
    const seen = new Set((exclusive ?? []).map((row) => productNameKey(row.name)));
    return uniqueByName(((data ?? []) as unknown as Row[]).filter(usable).map(toProduct), seen);
  });

// The partner catalogue is the same for every partner, so each server instance keeps the ready text for a while.
let partnerCatalogCache: { text: string; at: number } | null = null;

/**
 * Partners and owner only: the retired suppliers' products with photos (up to PARTNER_CATALOG_LIMIT,
 * best first, one per name), added to Catálogos for them. Customers keep only the shared catalogue.
 * Returns catalogue wire text; an empty catalogue for everyone else.
 */
export const listPartnerCatalog = createServerFn({ method: "GET" })
  .middleware([requireActiveUser])
  .handler(async ({ context }): Promise<string> => {
    if (!(await isPartnerOrOwner(context.supabase, context.userId))) return JSON.stringify(encodeCatalog([]) satisfies CatalogWire);
    if (partnerCatalogCache && Date.now() - partnerCatalogCache.at < CATALOG_TTL_MS) return partnerCatalogCache.text;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // A few extra rows cover products dropped as unusable or as same-name replicas.
    const wanted = Math.ceil(PARTNER_CATALOG_LIMIT * 1.2);
    const pages = Math.ceil(wanted / PAGE);
    const results = await Promise.all(
      Array.from({ length: pages }, (_, index) =>
        supabaseAdmin
          .from("products")
          .select(LIST_COLUMNS)
          .eq("status", "active")
          .in("supplier_source", RETIRED_SUPPLIER_SOURCES)
          .not("primary_image", "is", null)
          .order("viral_score", { ascending: false })
          .order("id")
          .range(index * PAGE, Math.min(index * PAGE + PAGE, wanted) - 1),
      ),
    );
    const rows: Row[] = [];
    for (const result of results) {
      if (result.error) throw new Error(result.error.message);
      rows.push(...((result.data ?? []) as unknown as Row[]));
    }
    const products = uniqueByName(rows.filter(usable).map(toProduct)).slice(0, PARTNER_CATALOG_LIMIT);
    const text = JSON.stringify(encodeCatalog(products) satisfies CatalogWire);
    partnerCatalogCache = { text, at: Date.now() };
    return text;
  });
