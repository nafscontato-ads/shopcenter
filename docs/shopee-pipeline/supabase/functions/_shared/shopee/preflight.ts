// =============================================================================
// PAS · PREFLIGHT — monta o add_item perfeito ou explica por que não dá
// -----------------------------------------------------------------------------
// Roda ANTES de chamar a Shopee. Lê as regras da categoria direto da API
// (get_item_limit + get_attribute_tree), preenche tudo o que dá para
// preencher e devolve:
//   ok=true  → payload pronto para v2.product.add_item
//   ok=false → lista de bloqueios com mensagem para o aluno e dica para o admin
// Com dryRun=true não sobe nada (serve para a checagem do catálogo).
// =============================================================================
import type { ShopeeCaller } from "./client.ts";
import type { AiFn, CatalogProduct, GtinRule, Issue, PreflightResult, ResolvedAttribute } from "./types.ts";
import { type AttrNode, resolveAttributes } from "./attributes.ts";
import { isValidGtin, normalizeGtin, parseGtinRule, resolveGtin } from "./gtin.ts";
import { resolveSizeChart } from "./sizeChart.ts";
import { uploadProductImages } from "./images.ts";
import { recommendCategories, resolveBrand } from "./category.ts";
import { findSsp, type SspMatch } from "./ssp.ts";
import { cleanTitle, fixDescription } from "./text.ts";

export interface PreflightOptions {
  dryRun?: boolean;
  /** Puxa dados do Produto Padrão da Shopee (SSP). Padrão: true. */
  useSsp?: boolean;
  ai?: AiFn;
  /** Troca a categoria do catálogo pela recomendada quando ela resolve os bloqueios. Padrão: true. */
  autoCategory?: boolean;
  /** Canais de envio já escolhidos pelo SaaS. Se ausente, usa os canais ativos da loja. */
  logisticInfo?: Array<Record<string, unknown>>;
  /** Image IDs já enviados (evita subir de novo ao repetir). */
  imageIds?: string[];
}

// ---------- cache em memória (vale enquanto a Edge Function estiver quente) ----------
const TTL = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}
export function clearPreflightCache() {
  cache.clear();
}

// ---------- leituras da API ----------
export function getItemLimitRaw(call: ShopeeCaller, categoryId: number) {
  return cached(`limit:${categoryId}`, () => call<any>("/api/v2/product/get_item_limit", { query: { category_id: categoryId }, raw: true }));
}

export function getAttributeTree(call: ShopeeCaller, categoryId: number): Promise<AttrNode[]> {
  return cached(`tree:${categoryId}`, async () => {
    try {
      const r = await call<any>("/api/v2/product/get_attribute_tree", { query: { category_id_list: String(categoryId), language: "pt-BR" } });
      const entry = (r?.list ?? []).find((x: any) => Number(x?.category_id) === categoryId) ?? r?.list?.[0];
      return (entry?.attribute_tree ?? []) as AttrNode[];
    } catch {
      // Fallback para a API antiga (get_attributes), convertendo o formato
      const r = await call<any>("/api/v2/product/get_attributes", { query: { category_id: categoryId, language: "pt-br" } });
      return (r?.attribute_list ?? []).map(legacyToTree);
    }
  });
}

const LEGACY_INPUT: Record<string, number> = { DROP_DOWN: 1, COMBO_BOX: 2, TEXT_FILED: 3, MULTIPLE_SELECT: 4, MULTIPLE_SELECT_COMBO_BOX: 5 };
const LEGACY_VALID: Record<string, number> = { INT_TYPE: 1, STRING_TYPE: 2, ENUM_TYPE: 2, FLOAT_TYPE: 3, DATE_TYPE: 4, TIMESTAMP_TYPE: 4 };
function legacyToTree(a: any): AttrNode {
  return {
    attribute_id: Number(a.attribute_id),
    mandatory: Boolean(a.is_mandatory),
    name: a.original_attribute_name,
    multi_lang: a.display_attribute_name ? [{ language: "pt-BR", value: a.display_attribute_name }] : [],
    attribute_info: {
      input_type: LEGACY_INPUT[a.input_type] ?? 3,
      input_validation_type: LEGACY_VALID[a.input_validation_type] ?? 0,
      format_type: a.format_type === "QUANTITATIVE" ? 2 : 1,
      attribute_unit_list: a.attribute_unit ?? a.unit_list ?? [],
      max_value_count: a.max_input_value_number ?? 1,
    },
    attribute_value_list: (a.attribute_value_list ?? []).map((v: any) => ({
      value_id: Number(v.value_id),
      name: v.original_value_name,
      value_unit: v.value_unit,
      multi_lang: v.display_value_name ? [{ language: "pt-BR", value: v.display_value_name }] : [],
    })),
  };
}

async function getRecommendedAttributes(call: ShopeeCaller, title: string, categoryId: number, coverImageId?: string): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  try {
    const r = await call<any>("/api/v2/product/get_recommend_attribute", {
      query: { item_name: title, category_id: categoryId, ...(coverImageId && !coverImageId.startsWith("dry-run") ? { cover_image_id: coverImageId } : {}) },
      retries: 0,
    });
    for (const a of r?.attribute_list ?? []) {
      out.set(Number(a.attribute_id), (a.attribute_value_list ?? []).map((v: any) => Number(v.value_id)).filter(Boolean));
    }
  } catch { /* recomendação é opcional */ }
  return out;
}

/** Canais de envio ativos da loja (por loja: não entra no cache global). */
async function getShopLogistics(call: ShopeeCaller): Promise<Array<Record<string, unknown>>> {
  const r = await call<any>("/api/v2/logistics/get_channel_list");
  return (r?.logistics_channel_list ?? [])
    .filter((c: any) => c?.enabled && !c?.mask_channel_id && String(c?.fee_type ?? "").toUpperCase() !== "SIZE_SELECTION")
    .map((c: any) => ({ logistic_id: Number(c.logistics_channel_id), enabled: true }));
}

// ---------- avaliação de uma categoria (sem subir nada) ----------
interface CategoryEval {
  categoryId: number;
  limitRaw: any;
  gtinRule: GtinRule;
  gtinValue?: string;
  attributeList: Array<{ attribute_id: number; attribute_value_list: unknown[] }>;
  resolved: ResolvedAttribute[];
  brand: { brand_id: number; original_brand_name: string };
  blockers: Issue[];
  warnings: Issue[];
}

async function evaluateCategory(
  call: ShopeeCaller,
  product: CatalogProduct,
  categoryId: number,
  title: string,
  description: string,
  coverImageId: string | undefined,
  ai: AiFn | undefined,
): Promise<CategoryEval> {
  const [limitRaw, tree, recommendation] = await Promise.all([
    getItemLimitRaw(call, categoryId),
    getAttributeTree(call, categoryId),
    getRecommendedAttributes(call, title, categoryId, coverImageId),
  ]);
  const limit = limitRaw?.response ?? limitRaw ?? {};
  const blockers: Issue[] = [];
  const warnings: Issue[] = [];

  const attrs = await resolveAttributes(tree, { product, title, description, recommendation, ai, call });
  blockers.push(...attrs.blockers);
  warnings.push(...attrs.warnings);

  const gtinRule = parseGtinRule(limitRaw);
  const gtin = resolveGtin(gtinRule, product.gtin);
  if (gtin.blocker) blockers.push(gtin.blocker);
  if (gtin.warning) warnings.push(gtin.warning);
  if (gtinRule === "mandatory" && product.variations?.models?.length) {
    const bad = product.variations.models.filter((m) => !isValidGtin(normalizeGtin(m.gtin)));
    if (bad.length) {
      blockers.push({
        level: "blocker",
        code: "GTIN_REQUIRED",
        message: "Nesta categoria cada variação precisa do seu código de barras (EAN) real.",
        adminHint: `Variações sem EAN válido: ${bad.map((m) => m.sku ?? m.tierIndex.join("-")).join(", ")}`,
      });
    }
  }

  const sc = await resolveSizeChart(call, categoryId, limit?.size_chart_limit, product, { dryRun: true });
  if (sc.blocker) blockers.push(sc.blocker);
  if (sc.warning) warnings.push(sc.warning);

  const brand = await resolveBrand(call, categoryId, product.brand);
  if (!brand.found && product.brand) {
    warnings.push({
      level: "warning",
      code: "BRAND_NOT_FOUND",
      message: `A marca "${product.brand}" não está cadastrada na Shopee para esta categoria; o anúncio sai como "Sem marca".`,
      adminHint: "Se a marca for oficial, peça o cadastro dela pela Central do Vendedor (Marcas).",
    });
  }

  const price = limit?.price_limit;
  if (price && (product.price < (price.min_limit ?? 0) || (price.max_limit && product.price > price.max_limit))) {
    blockers.push({
      level: "blocker",
      code: "PRICE_OUT_OF_RANGE",
      message: `Preço fora do permitido pela Shopee nesta categoria (R$ ${price.min_limit} a R$ ${price.max_limit}).`,
    });
  }
  const stock = limit?.stock_limit;
  if (stock && product.stock < (stock.min_limit ?? 0)) {
    blockers.push({ level: "blocker", code: "STOCK_OUT_OF_RANGE", message: "Estoque abaixo do mínimo exigido pela Shopee." });
  }
  if (limit?.dimension_limit?.dimension_mandatory && !product.dimensionsCm) {
    blockers.push({
      level: "blocker",
      code: "DIMENSION_MISSING",
      message: "Faltam as medidas da embalagem (C x L x A) no catálogo.",
      adminHint: "Cadastre comprimento, largura e altura da embalagem em cm.",
    });
  }

  return {
    categoryId,
    limitRaw,
    gtinRule,
    gtinValue: gtin.value,
    attributeList: attrs.attribute_list,
    resolved: attrs.resolved,
    brand: brand.brand,
    blockers,
    warnings,
  };
}

// ---------- preflight completo ----------
export async function preflight(
  call: ShopeeCaller,
  product: CatalogProduct,
  opts: PreflightOptions = {},
): Promise<PreflightResult> {
  const blockers: Issue[] = [];
  const warnings: Issue[] = [];

  // Título/descrição limpos (limites finos aplicados depois da categoria)
  const t0 = cleanTitle(product.title, 1, 120);
  let title = t0.title;

  // 1. Fotos (precisa da capa para recomendação de categoria/atributos)
  let imageIds = opts.imageIds ?? [];
  if (!imageIds.length) {
    const up = await uploadProductImages(call, product.images ?? [], { max: 9, dryRun: opts.dryRun });
    imageIds = up.imageIds;
    warnings.push(...up.warnings);
    blockers.push(...up.blockers);
  }
  const cover = imageIds[0];

  // 1b. Produto Padrão da Shopee (SSP): puxa categoria, características e marca oficiais
  let ssp: SspMatch | null = null;
  if (opts.useSsp !== false) {
    ssp = await findSsp(call, product, cover);
    if (ssp) {
      const fromCatalog = new Set((product.shopeeAttributes ?? []).map((a) => a.attribute_id));
      const sspAttrs = ssp.attributes
        .filter((a) => !fromCatalog.has(a.attribute_id) && (!a.regulated || ssp!.strong))
        .map((a) => ({ attribute_id: a.attribute_id, value_id: a.value_id, value: a.value, source: "ssp" as const }));
      product = { ...product, shopeeAttributes: [...(product.shopeeAttributes ?? []), ...sspAttrs] };
      warnings.push({
        level: "info",
        code: "ATTRIBUTE_AUTOFILLED",
        message: `Dados puxados do produto oficial da Shopee: "${ssp.title}".`,
        adminHint: `SSP ${ssp.sspId}${ssp.csspId ? ` / CSSP ${ssp.csspId}` : ""} · similaridade ${ssp.similarity.toFixed(2)} · ${ssp.strong ? "match forte (vincula o anúncio)" : "match parcial (só sugestões não regulatórias)"}`,
      });
    }
  }

  // 2. Categoria: produto oficial (SSP) x catálogo x recomendação da Shopee
  const recommended = await recommendCategories(call, title, cover);
  const candidates: number[] = [];
  if (ssp?.categoryId) candidates.push(ssp.categoryId);
  if (product.categoryId && !candidates.includes(Number(product.categoryId))) candidates.push(Number(product.categoryId));
  for (const c of recommended) if (!candidates.includes(c)) candidates.push(c);
  if (!candidates.length) {
    blockers.push({
      level: "blocker",
      code: "CATEGORY_MISSING",
      message: "Produto sem categoria da Shopee no catálogo.",
      adminHint: "Defina a categoria (folha) da Shopee para este produto.",
    });
    return { ok: false, categoryId: null, payload: null, blockers, warnings, resolvedAttributes: [], gtinRule: "unknown" };
  }

  const descBase = fixDescription(product.description, title, product.attributes ?? null).description;
  let chosen = await evaluateCategory(call, product, candidates[0], title, descBase, cover, opts.ai);
  const autoCategory = opts.autoCategory ?? true;
  if (chosen.blockers.length && autoCategory) {
    for (const alt of candidates.slice(1, 3)) {
      const ev = await evaluateCategory(call, product, alt, title, descBase, cover, opts.ai);
      if (ev.blockers.length < chosen.blockers.length) {
        warnings.push({
          level: "warning",
          code: "CATEGORY_CHANGED",
          message: "A categoria do produto foi ajustada para a recomendada pela Shopee.",
          adminHint: `Categoria ${chosen.categoryId} → ${alt}. Atualize no catálogo para não depender do ajuste automático.`,
        });
        chosen = ev;
        if (!ev.blockers.length) break;
      }
    }
  } else if (product.categoryId && recommended.length && !recommended.includes(Number(product.categoryId))) {
    warnings.push({
      level: "info",
      code: "CATEGORY_SUSPECT",
      message: "A categoria do catálogo é diferente da sugerida pela Shopee.",
      adminHint: `Catálogo: ${product.categoryId}; Shopee sugere: ${recommended.join(", ")}`,
    });
  }
  blockers.push(...chosen.blockers);
  warnings.push(...chosen.warnings);

  // 3. Limites da categoria: título, descrição, fotos
  const limit = chosen.limitRaw?.response ?? chosen.limitRaw ?? {};
  const nameLim = limit?.item_name_length_limit ?? {};
  const t1 = cleanTitle(product.title, nameLim.min_limit ?? 1, nameLim.max_limit ?? 120);
  title = t1.title;
  if (t1.changed) warnings.push({ level: "info", code: "TITLE_FIXED", message: "Título ajustado (emojis/símbolos removidos e tamanho dentro do limite)." });
  const descLim = limit?.item_description_length_limit ?? {};
  const d = fixDescription(product.description, title, product.attributes ?? null, descLim.min_limit ?? 100, descLim.max_limit ?? 3000);
  if (d.changed && (product.description ?? "").length < (descLim.min_limit ?? 100)) {
    warnings.push({ level: "info", code: "DESCRIPTION_FIXED", message: "Descrição completada para atingir o mínimo da Shopee." });
  }
  const maxImages = limit?.item_image_count_limit?.max_limit ?? 9;
  imageIds = imageIds.slice(0, maxImages);

  // 4. Peso (recomendação da Shopee se faltar)
  let weight = product.weightKg ?? null;
  if (!weight || weight <= 0) {
    try {
      const r = await call<any>("/api/v2/product/get_weight_recommendation", {
        method: "POST",
        body: {
          item_name: title,
          cover_image_id: cover && !cover.startsWith("dry-run") ? cover : "",
          category_id: chosen.categoryId,
          attribute_list: chosen.attributeList,
          brand_id: chosen.brand.brand_id,
          description_type: "normal",
          description: d.description,
        },
        retries: 0,
      });
      const range: number[] = r?.normal_weight_range ?? [];
      if (range.length) weight = Number(((range[0] + (range[1] ?? range[0])) / 2).toFixed(3));
    } catch { /* sem recomendação */ }
    if (weight) {
      warnings.push({ level: "warning", code: "WEIGHT_MISSING", message: `Peso estimado pela Shopee: ${weight} kg.`, adminHint: "Cadastre o peso real com embalagem no catálogo." });
    } else {
      blockers.push({ level: "blocker", code: "WEIGHT_MISSING", message: "Falta o peso do produto no catálogo.", adminHint: "Cadastre o peso com embalagem (kg)." });
    }
  }

  // 5. Envio
  let logistic = opts.logisticInfo;
  if (!logistic?.length) {
    try {
      logistic = await getShopLogistics(call);
    } catch {
      logistic = [];
    }
  }
  if (!logistic.length && !opts.dryRun) {
    blockers.push({
      level: "blocker",
      code: "SHOPEE_ERROR",
      message: "Sua loja não tem nenhum método de envio ativo.",
      adminHint: "Ative um canal de envio na Central do Vendedor → Configurações de envio.",
    });
  }

  // 6. Tabela de medidas de verdade (sobe a imagem só agora, na categoria final)
  let sizeChartInfo: Record<string, unknown> | undefined;
  if (!opts.dryRun) {
    const sc = await resolveSizeChart(call, chosen.categoryId, limit?.size_chart_limit, product, { dryRun: false });
    if (sc.sizeChartInfo) sizeChartInfo = sc.sizeChartInfo;
    if (sc.blocker && !blockers.some((b) => b.code === "SIZE_CHART_MISSING")) blockers.push(sc.blocker);
  } else {
    const sc = await resolveSizeChart(call, chosen.categoryId, limit?.size_chart_limit, product, { dryRun: true });
    if (sc.sizeChartInfo) sizeChartInfo = sc.sizeChartInfo;
  }

  const payload: Record<string, unknown> = {
    original_price: Math.round(product.price * 100) / 100,
    description: d.description,
    weight: weight ?? 0,
    item_name: title,
    item_status: "NORMAL",
    ...(product.dimensionsCm
      ? {
        dimension: {
          package_length: Math.max(1, Math.round(product.dimensionsCm.length)),
          package_width: Math.max(1, Math.round(product.dimensionsCm.width)),
          package_height: Math.max(1, Math.round(product.dimensionsCm.height)),
        },
      }
      : {}),
    logistic_info: logistic,
    attribute_list: chosen.attributeList,
    category_id: chosen.categoryId,
    image: { image_id_list: imageIds },
    item_sku: `PAS-${product.id}`.slice(0, 100),
    condition: product.condition ?? "NEW",
    brand: chosen.brand.brand_id === 0 && ssp?.brand && ssp.categoryId === chosen.categoryId ? ssp.brand : chosen.brand,
    // vínculo com o produto oficial (só com match forte, mesma categoria e sem variações)
    ...(ssp?.strong && ssp.csspId && ssp.categoryId === chosen.categoryId && !product.variations?.models?.length
      ? { ssp_id: ssp.sspId, cssp_id: ssp.csspId }
      : {}),
    seller_stock: [{ stock: Math.max(0, Math.floor(product.stock)) }],
    ...(chosen.gtinValue !== undefined ? { gtin_code: chosen.gtinValue } : {}),
    ...(sizeChartInfo ? { size_chart_info: sizeChartInfo } : {}),
  };

  // dedupe de mensagens iguais
  const uniq = (list: Issue[]) => {
    const seen = new Set<string>();
    return list.filter((i) => {
      const k = `${i.code}|${i.attribute?.id ?? ""}|${i.message}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const finalBlockers = uniq(blockers);
  return {
    ok: finalBlockers.length === 0,
    categoryId: chosen.categoryId,
    payload: finalBlockers.length ? null : payload,
    blockers: finalBlockers,
    warnings: uniq(warnings),
    resolvedAttributes: chosen.resolved,
    gtinRule: chosen.gtinRule,
  };
}
