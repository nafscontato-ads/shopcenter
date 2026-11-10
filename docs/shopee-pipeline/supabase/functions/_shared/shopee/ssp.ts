// =============================================================================
// PAS · Produto Padrão da Shopee (SSP) — "puxa" os dados oficiais do produto
// -----------------------------------------------------------------------------
// v2.product.search_ssp_list (por título e por imagem) + v2.product.get_ssp_detail
// devolvem o cadastro oficial do produto na Shopee: categoria, características
// (atributos com IDs), marca e variações. O PAS usa isso para preencher o
// anúncio do aluno e, quando o match é forte, vincula o item ao SSP
// (ssp_id + cssp_id no add_item). Tudo pela API oficial, sem raspar site.
// =============================================================================
import type { ShopeeCaller } from "./client.ts";
import type { CatalogProduct } from "./types.ts";
import { normalize } from "./text.ts";

export interface SspAttribute {
  attribute_id: number;
  value_id?: number;
  value?: string;
  name: string;
  regulated: boolean;
}

export interface SspMatch {
  sspId: number;
  csspId?: number;
  title: string;
  categoryId?: number;
  brand?: { brand_id: number; original_brand_name: string };
  attributes: SspAttribute[];
  similarity: number;
  /** Achado pela imagem E pelo título (ou título quase idêntico + mesma marca). */
  strong: boolean;
}

const STOP = new Set([
  "de", "da", "do", "das", "dos", "com", "para", "pra", "e", "a", "o", "as", "os", "em", "no", "na", "kit", "un",
  "unidade", "unidades", "original", "novo", "nova", "promocao", "envio", "imediato", "premium", "top", "super",
]);

function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((t) => t.length > 1 && !STOP.has(t)));
}

export function titleSimilarity(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  // Dice: tolera título do catálogo com palavras extras de SEO
  return (2 * inter) / (A.size + B.size);
}

const REGULATED_NAME = /radiofrequencia|radio frequency|contem bluetooth|registration id|id de registro|homologa|anatel|anvisa|notificacao|item code|codigo do item|inmetro|registro/;

function toAttributes(list: any[] | undefined): SspAttribute[] {
  const out: SspAttribute[] = [];
  for (const a of list ?? []) {
    const id = Number(a?.attr_id);
    if (!id) continue;
    const name = String(a?.attr_display_name ?? a?.attr_name ?? id);
    const regulated = REGULATED_NAME.test(normalize(`${a?.attr_name ?? ""} ${a?.attr_display_name ?? ""}`));
    for (const v of a?.attr_val_info ?? []) {
      const vid = Number(v?.attr_val_id ?? 0);
      const custom = String(v?.custom_value ?? "").trim();
      if (vid > 0) out.push({ attribute_id: id, value_id: vid, name, regulated });
      else if (custom) out.push({ attribute_id: id, value: custom, name, regulated });
    }
  }
  return out;
}

async function search(call: ShopeeCaller, body: Record<string, unknown>): Promise<any[]> {
  try {
    const r = await call<any>("/api/v2/product/search_ssp_list", { method: "POST", body, retries: 0 });
    return r?.ssp_list ?? [];
  } catch {
    return []; // SSP indisponível para a loja/categoria: segue sem
  }
}

export async function findSsp(call: ShopeeCaller, product: CatalogProduct, coverImageId?: string): Promise<SspMatch | null> {
  const title = product.title.slice(0, 120);
  const byTitle = normalize(title).length >= 3 ? await search(call, { title }) : [];
  const byImage = coverImageId && !coverImageId.startsWith("dry-run") ? await search(call, { image_id_list: [coverImageId] }) : [];
  const imageIds = new Set(byImage.map((s) => Number(s?.ssp_id)));
  const brandN = normalize(product.brand);

  let best: { s: any; sim: number; strong: boolean; score: number } | null = null;
  for (const s of [...byTitle, ...byImage]) {
    const sim = titleSimilarity(product.title, String(s?.title ?? ""));
    const sameBrand = Boolean(brandN) && normalize(s?.brand?.display_name) === brandN;
    const both = imageIds.has(Number(s?.ssp_id)) && byTitle.some((t) => Number(t?.ssp_id) === Number(s?.ssp_id));
    const strong = (both && sim >= 0.35) || (sim >= 0.8 && (sameBrand || !brandN));
    const score = sim + (both ? 0.3 : 0) + (sameBrand ? 0.15 : 0);
    if (!best || score > best.score) best = { s, sim, strong, score };
  }
  if (!best || (!best.strong && best.sim < 0.6)) return null;

  // Detalhe completo (atributos podem vir incompletos na busca)
  let info = best.s;
  try {
    const d = await call<any>("/api/v2/product/get_ssp_detail", { query: { ssp_id: Number(best.s.ssp_id) }, retries: 0 });
    if (d?.ssp_info) info = d.ssp_info;
  } catch { /* usa o resultado da busca */ }

  const cssps: any[] = info?.cssps ?? [];
  const cssp = cssps.length <= 1
    ? cssps[0]
    : [...cssps].sort((a, b) => titleSimilarity(product.title, b?.title ?? "") - titleSimilarity(product.title, a?.title ?? ""))[0];
  const path: any[] = info?.category_path ?? [];
  const leaf = path.length ? Number(path[path.length - 1]?.category_id) : undefined;
  const brandId = Number(cssp?.brand_id ?? info?.brand?.brand_id ?? 0);
  const brandName = String(cssp?.brand_name ?? info?.brand?.display_name ?? "");

  // atributos do CSSP (país) têm prioridade sobre os do SSP global
  const attrs = toAttributes(cssp?.attributes?.length ? cssp.attributes : info?.attributes);
  return {
    sspId: Number(info?.ssp_id ?? best.s.ssp_id),
    csspId: cssp?.cssp_id ? Number(cssp.cssp_id) : undefined,
    title: String(info?.title ?? best.s.title ?? ""),
    categoryId: leaf || undefined,
    brand: brandId ? { brand_id: brandId, original_brand_name: brandName || "NoBrand" } : undefined,
    attributes: attrs,
    similarity: best.sim,
    strong: best.strong,
  };
}
