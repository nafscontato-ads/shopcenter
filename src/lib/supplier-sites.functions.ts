import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin.functions";
import {
  getSupplierSite,
  leafSections,
  PRESTASHOP_PAGE_SIZE,
  prestashopSections,
  toPrestashopRow,
  type PrestashopProduct,
  SUPPLIER_MAX_OFFSET,
  SUPPLIER_PAGE_SIZE,
  type StoreProduct,
  type SupplierProductRow,
  type SupplierSite,
  toSupplierProductRow,
} from "@/lib/supplier-sites";

const STORE_HEADERS = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (PAS catalogue import)" };

function requireSite(id: string) {
  const site = getSupplierSite(id);
  if (!site) throw new Error("Fornecedor não encontrado.");
  return site;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Lists every leaf section of the supplier store, so the import can walk all tabs. */
export const listSupplierSections = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { siteId: string }) => z.object({ siteId: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const site = requireSite(data.siteId);
    if (site.platform === "prestashop") {
      const sitemap = await fetch(`${site.storeUrl}/sitemap/category.xml`, { headers: { ...STORE_HEADERS, Accept: "application/xml" } });
      if (!sitemap.ok) throw new Error(`A loja do fornecedor não respondeu (${sitemap.status}).`);
      return prestashopSections(site, await sitemap.text());
    }
    const response = await fetch(`${site.apiUrl}/api/catalog_system/pub/category/tree/4`, { headers: STORE_HEADERS });
    if (!response.ok) throw new Error(`A loja do fornecedor não respondeu (${response.status}).`);
    return leafSections((await response.json()) as never);
  });

async function saveRows(list: SupplierProductRow[]) {
  // A listing page can repeat one product (one entry per variation); save it once.
  const rows = Array.from(new Map(list.map((row) => [row.external_id, row])).values());
  if (rows.length === 0) return;
  const db = await admin();
  const { error } = await db
    .from("supplier_site_products")
    .upsert(rows.map((row) => ({ ...row, imported_at: new Date().toISOString() })), { onConflict: "source,external_id" });
  if (error) throw new Error(error.message);
}

/** One PrestaShop category page (100 products), read from the store's own listing JSON. */
async function importPrestashopPage(site: SupplierSite, categoryUrl: string, from: number) {
  if (!categoryUrl.startsWith(`${site.storeUrl}/`)) throw new Error("Seção inválida.");
  const page = Math.floor(from / PRESTASHOP_PAGE_SIZE) + 1;
  const url = `${categoryUrl}?resultsPerPage=${PRESTASHOP_PAGE_SIZE}&page=${page}`;
  const load = () => fetch(url, { headers: { ...STORE_HEADERS, "X-Requested-With": "XMLHttpRequest" } });
  let response = await load();
  // The store's protection sometimes refuses a burst; one calm retry recovers most pages.
  if (!response.ok) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    response = await load();
  }
  if (!response.ok) throw new Error(`A loja do fornecedor não respondeu (${response.status}).`);
  const body = (await response.json()) as { products?: PrestashopProduct[]; pagination?: { total_items?: number; pages_count?: number } };
  const rows = (body.products ?? []).map((product) => toPrestashopRow(site, product)).filter((row) => row !== null);
  await saveRows(rows);
  const pages = Number(body.pagination?.pages_count ?? 0);
  return { saved: rows.length, total: Number(body.pagination?.total_items ?? 0), nextFrom: page < pages ? page * PRESTASHOP_PAGE_SIZE : null };
}

/** Imports one page (up to 50 products) of one section and saves it. */
export const importSupplierPage = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { siteId: string; filter: string; from: number }) =>
    z
      .object({
        siteId: z.string().min(1),
        filter: z.string().min(1).max(500),
        from: z.number().int().min(0).max(100_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const site = requireSite(data.siteId);
    if (site.platform === "prestashop") return importPrestashopPage(site, data.filter, data.from);
    if (!/^C:\/(\d+\/)+$/.test(data.filter) || data.from > SUPPLIER_MAX_OFFSET) throw new Error("Seção inválida.");
    const params = new URLSearchParams({
      fq: data.filter,
      _from: String(data.from),
      _to: String(Math.min(data.from + SUPPLIER_PAGE_SIZE - 1, SUPPLIER_MAX_OFFSET)),
      O: "OrderByNameASC",
    });
    const response = await fetch(`${site.apiUrl}/api/catalog_system/pub/products/search?${params}`, { headers: STORE_HEADERS });
    if (!response.ok && response.status !== 206) {
      throw new Error(`A loja do fornecedor não respondeu (${response.status}).`);
    }
    const total = Number(response.headers.get("resources")?.split("/")[1] ?? 0);
    const products = (await response.json()) as StoreProduct[];
    const rows = products.map((product) => toSupplierProductRow(site, product)).filter((row) => row !== null);
    if (rows.length > 0) {
      const db = await admin();
      const { error } = await db
        .from("supplier_site_products")
        .upsert(rows.map((row) => ({ ...row, imported_at: new Date().toISOString() })), { onConflict: "source,external_id" });
      if (error) throw new Error(error.message);
    }
    const next = data.from + SUPPLIER_PAGE_SIZE;
    const done = products.length < SUPPLIER_PAGE_SIZE || next >= Math.min(total, SUPPLIER_MAX_OFFSET);
    return { saved: rows.length, total, nextFrom: done ? null : next };
  });

/** Searches the imported supplier products by name, brand or barcode. */
export const searchSupplierProducts = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { siteId: string; query: string; offset: number; onlyAvailable: boolean }) =>
    z
      .object({
        siteId: z.string().min(1),
        query: z.string().max(120),
        offset: z.number().int().min(0),
        onlyAvailable: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const site = requireSite(data.siteId);
    const db = await admin();
    let request = db
      .from("supplier_site_products")
      .select("id, title, brand, category, price, list_price, available, image_url, url, ean, imported_at", { count: "exact" })
      .eq("source", site.id)
      .order("title")
      .range(data.offset, data.offset + 47);
    if (data.onlyAvailable) request = request.eq("available", true);
    const words = data.query
      .replace(/[%,()*]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6);
    for (const word of words) {
      request = /^\d{8,14}$/.test(word)
        ? request.eq("ean", word)
        : request.or(`title.ilike.%${word}%,brand.ilike.%${word}%,category.ilike.%${word}%`);
    }
    const { data: rows, count, error } = await request;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0 };
  });

/** Copies the supplier's imported products into the PAS catalogue (adds new, refreshes prices, hides unavailable). */
export const publishSupplierCatalog = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { siteId: string }) => z.object({ siteId: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const site = requireSite(data.siteId);
    const db = await admin();
    const { data: result, error } = await db.rpc("pas_sync_supplier_catalog", { _source: site.id });
    if (error) throw new Error(error.message);
    return result as { active: number; hidden: number };
  });
