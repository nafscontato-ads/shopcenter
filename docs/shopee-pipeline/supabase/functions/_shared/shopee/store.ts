// =============================================================================
// PAS · Persistência (Supabase): histórico de publicação + dados de compliance
// =============================================================================
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import type { CatalogProduct, PublicationRecord, PublicationStore } from "./types.ts";

export function supabasePublicationStore(sb: SupabaseClient): PublicationStore {
  return {
    async get(shopId, productId) {
      const { data, error } = await sb
        .from("shopee_publications")
        .select("shop_id, product_id, item_id, status, last_error, blockers, updated_at")
        .eq("shop_id", shopId)
        .eq("product_id", productId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        shopId: Number(data.shop_id),
        productId: String(data.product_id),
        itemId: data.item_id ? Number(data.item_id) : null,
        status: data.status,
        lastError: data.last_error,
        blockers: data.blockers,
        updatedAt: data.updated_at,
      } as PublicationRecord;
    },
    async lock(shopId, productId) {
      const { data, error } = await sb.rpc("pas_lock_publication", { p_shop_id: shopId, p_product_id: productId });
      if (error) throw error;
      return data === true;
    },
    async save(rec) {
      const { error } = await sb.from("shopee_publications").upsert(
        {
          shop_id: rec.shopId,
          product_id: rec.productId,
          item_id: rec.itemId ?? null,
          status: rec.status,
          last_error: rec.lastError ?? null,
          blockers: rec.blockers ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "shop_id,product_id" },
      );
      if (error) throw error;
    },
  };
}

/** Linha de catalog_product_compliance → campos do CatalogProduct. */
export function applyCompliance(product: CatalogProduct, c: Record<string, any> | null | undefined): CatalogProduct {
  if (!c) return product;
  return {
    ...product,
    gtin: c.gtin ?? product.gtin ?? null,
    manufacturer: c.manufacturer ?? product.manufacturer ?? null,
    model: c.model ?? product.model ?? null,
    categoryId: c.shopee_category_id ? Number(c.shopee_category_id) : product.categoryId ?? null,
    shopeeAttributes: Array.isArray(c.shopee_attributes) ? c.shopee_attributes : product.shopeeAttributes ?? null,
    regulatory: {
      hasRadio: typeof c.has_radio === "boolean" ? c.has_radio : product.regulatory?.hasRadio ?? null,
      anatelRegistrationId: c.anatel_registration_id ?? product.regulatory?.anatelRegistrationId ?? null,
      anatelManufacturer: c.anatel_manufacturer ?? product.regulatory?.anatelManufacturer ?? null,
      anatelModel: c.anatel_model ?? product.regulatory?.anatelModel ?? null,
      anvisaCode: c.anvisa_code ?? product.regulatory?.anvisaCode ?? null,
      inmetroCode: c.inmetro_code ?? product.regulatory?.inmetroCode ?? null,
      partNumber: c.part_number ?? product.regulatory?.partNumber ?? null,
    },
    sizeChart: {
      imageUrl: c.size_chart_image_url ?? product.sizeChart?.imageUrl ?? null,
      templateName: c.size_chart_template_name ?? product.sizeChart?.templateName ?? null,
    },
  };
}

/** Converte uma linha da tabela de produtos (nomes de coluna variam) para CatalogProduct. */
export function rowToCatalogProduct(row: Record<string, any>): CatalogProduct {
  const pick = (...keys: string[]) => {
    for (const k of keys) if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
    return undefined;
  };
  const imagesRaw = pick("images", "image_urls", "imagens", "fotos", "photos", "image_url", "imagem", "thumbnail");
  const images: string[] = Array.isArray(imagesRaw)
    ? imagesRaw.map((x: any) => (typeof x === "string" ? x : x?.url ?? x?.src)).filter(Boolean)
    : typeof imagesRaw === "string"
    ? (imagesRaw.trim().startsWith("[") ? JSON.parse(imagesRaw) : imagesRaw.split(/[\n,;]\s*(?=https?:)/))
    : [];
  const num = (v: any) => (v === undefined || v === null || v === "" ? null : Number(String(v).replace(",", ".")));
  const L = num(pick("length", "comprimento", "package_length")), W = num(pick("width", "largura", "package_width")), H = num(pick("height", "altura", "package_height"));
  return {
    id: String(pick("id", "product_id")),
    sku: pick("sku", "supplier_sku", "codigo") ?? null,
    title: String(pick("title", "name", "nome", "titulo", "product_name") ?? ""),
    description: pick("description", "descricao", "descrição") ?? null,
    brand: pick("brand", "marca") ?? null,
    categoryId: num(pick("shopee_category_id", "category_id", "categoria_shopee_id")),
    price: num(pick("price", "sale_price", "preco", "preço", "suggested_price")) ?? 0,
    stock: num(pick("stock", "estoque", "quantity")) ?? 0,
    weightKg: num(pick("weight", "weight_kg", "peso")),
    dimensionsCm: L && W && H ? { length: L, width: W, height: H } : null,
    images,
    gtin: pick("gtin", "ean", "barcode") ?? null,
    attributes: pick("attributes", "caracteristicas", "specs") ?? null,
    variations: pick("variations", "variacoes") ?? null,
  };
}
