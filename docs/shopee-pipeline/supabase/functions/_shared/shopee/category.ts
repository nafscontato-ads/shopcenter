// =============================================================================
// PAS · Categoria e marca
// -----------------------------------------------------------------------------
// Categoria errada gera erro "fantasma": o "Pro Oil Reflections Óleo 100ml"
// (óleo de cabelo) caiu em autopeças e a Shopee pediu "Auto-Part Number";
// a "Forma de Silicone para Air Fryer" caiu em eletroportátil e a Shopee
// pediu GTIN. O preflight compara a categoria do catálogo com a recomendação
// da Shopee (v2.product.category_recommend) e escolhe a que não tem bloqueio.
// =============================================================================
import type { ShopeeCaller } from "./client.ts";
import { normalize } from "./text.ts";

export async function recommendCategories(call: ShopeeCaller, itemName: string, coverImageId?: string): Promise<number[]> {
  try {
    const r = await call<any>("/api/v2/product/category_recommend", {
      query: { item_name: itemName.slice(0, 120), ...(coverImageId && !coverImageId.startsWith("dry-run") ? { product_cover_image: coverImageId } : {}) },
    });
    return (r?.category_id ?? []).map(Number).filter(Boolean);
  } catch {
    return [];
  }
}

const brandCache = new Map<number, Array<{ brand_id: number; name: string }>>();
const brandMandatory = new Map<number, boolean>();

async function loadBrands(call: ShopeeCaller, categoryId: number): Promise<Array<{ brand_id: number; name: string }>> {
  if (brandCache.has(categoryId)) return brandCache.get(categoryId)!;
  const all: Array<{ brand_id: number; name: string }> = [];
  let offset = 0;
  for (let page = 0; page < 30; page++) {
    const r = await call<any>("/api/v2/product/get_brand_list", {
      query: { offset, page_size: 100, category_id: categoryId, status: 1, language: "pt-br" },
    });
    if (page === 0) brandMandatory.set(categoryId, Boolean(r?.is_mandatory));
    for (const b of r?.brand_list ?? []) {
      all.push({ brand_id: Number(b.brand_id), name: String(b.original_brand_name ?? b.display_brand_name ?? "") });
    }
    if (!r?.has_next_page) break;
    offset = Number(r?.next_offset ?? offset + 100);
  }
  brandCache.set(categoryId, all);
  return all;
}

const GENERIC_BRAND = /^(sem marca|generic[oa]?|gen[eé]ric[oa]|no ?brand|nobrand|n\/a|outros?|importad[oa])$/i;

export async function resolveBrand(
  call: ShopeeCaller,
  categoryId: number,
  brand: string | null | undefined,
): Promise<{ brand: { brand_id: number; original_brand_name: string }; found: boolean; mandatory: boolean }> {
  const noBrand = { brand_id: 0, original_brand_name: "NoBrand" };
  const name = (brand ?? "").trim();
  let list: Array<{ brand_id: number; name: string }> = [];
  try {
    list = await loadBrands(call, categoryId);
  } catch {
    return { brand: noBrand, found: !name, mandatory: false };
  }
  const mandatory = brandMandatory.get(categoryId) ?? false;
  if (!name || GENERIC_BRAND.test(name)) return { brand: noBrand, found: true, mandatory };
  const n = normalize(name);
  const hit = list.find((b) => normalize(b.name) === n) ?? list.find((b) => normalize(b.name).replace(/ /g, "") === n.replace(/ /g, ""));
  if (hit) return { brand: { brand_id: hit.brand_id, original_brand_name: hit.name }, found: true, mandatory };
  return { brand: noBrand, found: false, mandatory };
}
