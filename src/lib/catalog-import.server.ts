import type { SupabaseClient } from "@supabase/supabase-js";

import { readCatalog } from "@/lib/catalog-import";

/**
 * Saves a supplier spreadsheet as staging rows (source = supplier slug), hides rows that left the
 * spreadsheet and runs pas_sync_supplier_catalog so the products appear in the catalogue.
 */
export async function importSupplierCatalog(client: SupabaseClient, supplierId: string, csv: string) {
  const parsed = readCatalog(csv);
  if (parsed.missingColumns.length) throw new Error(`A planilha precisa das colunas: ${parsed.missingColumns.join(", ")}.`);
  if (!parsed.rows.length) throw new Error("Nenhum produto válido na planilha.");
  if (parsed.rows.length > 20_000) throw new Error("Máximo de 20.000 produtos por planilha.");
  const { data: supplier } = await client.from("suppliers").select("id, slug, sources").eq("id", supplierId).maybeSingle();
  if (!supplier) throw new Error("Fornecedor não encontrado.");
  const source = String(supplier["slug"]);
  const now = new Date().toISOString();
  for (let start = 0; start < parsed.rows.length; start += 500) {
    const chunk = parsed.rows.slice(start, start + 500).map((row) => ({
      source,
      external_id: row.externalId,
      sku_id: row.externalId,
      title: row.title,
      brand: row.brand,
      category: row.category,
      price: row.cost,
      list_price: null,
      available: row.available,
      image_url: row.imageUrl,
      images: row.images,
      url: row.url ?? `fornecedor:${source}:${row.externalId}`,
      ean: row.ean,
      description: row.description,
      imported_at: now,
    }));
    const { error } = await client.from("supplier_site_products").upsert(chunk, { onConflict: "source,external_id" });
    if (error) throw new Error(`Falha ao salvar a planilha (linha ~${start + 2}): ${error.message}`);
  }
  // Rows of this supplier that are no longer in the spreadsheet become unavailable (hidden by the sync).
  const keep = new Set(parsed.rows.map((row) => row.externalId));
  const { data: staged } = await client.from("supplier_site_products").select("external_id").eq("source", source).eq("available", true).limit(50_000);
  const gone = (staged ?? []).map((row) => String(row["external_id"])).filter((id) => !keep.has(id));
  for (let start = 0; start < gone.length; start += 500) {
    await client.from("supplier_site_products").update({ available: false }).eq("source", source).in("external_id", gone.slice(start, start + 500));
  }
  const { data: sync, error: syncError } = await client.rpc("pas_sync_supplier_catalog", { _source: source });
  if (syncError) throw new Error(`Planilha salva, mas o catálogo não atualizou: ${syncError.message}`);
  const sources = (supplier["sources"] as string[] | null) ?? [];
  if (!sources.includes(source)) await client.from("suppliers").update({ sources: [...sources, source], updated_at: now }).eq("id", supplierId);
  const result = (sync ?? {}) as { active?: number; hidden?: number };
  return {
    imported: parsed.rows.length,
    active: Number(result.active ?? 0),
    hidden: Number(result.hidden ?? 0),
    withoutImage: parsed.rows.filter((row) => !row.imageUrl).length,
    skipped: parsed.skipped.slice(0, 20),
    skippedCount: parsed.skipped.length,
  };
}
