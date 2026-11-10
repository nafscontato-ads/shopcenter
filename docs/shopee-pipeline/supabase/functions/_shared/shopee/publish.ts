// =============================================================================
// PAS · PUBLISH — publicação idempotente (sem duplicado, com retomada)
// -----------------------------------------------------------------------------
// Por que dava "This product duplicates another in your shop":
//   1) add_item criava o anúncio, mas um passo seguinte (variações, timeout)
//      falhava → o SaaS marcava "Recusado" → o aluno clicava de novo → a
//      Shopee recusava como duplicado (a Progressiva Pink Plus tentou 13x).
//   2) Duplo clique / duas abas publicando o mesmo produto ao mesmo tempo.
// Aqui:
//   - trava por (loja, produto) enquanto publica;
//   - item_sku fixo PAS-<id> para achar o anúncio depois;
//   - antes de criar, procura se já existe (SKU e título) e só vincula;
//   - add_item nunca é repetido às cegas: se der timeout, procura antes;
//   - variações esperam o tempo que a Shopee pede (≥5 s) e são retomadas
//     na próxima tentativa, sem criar outro anúncio.
// =============================================================================
import { ShopeeApiError, type ShopeeCaller, sleep } from "./client.ts";
import type { AiFn, CatalogProduct, Issue, PublicationStore, PublishResult } from "./types.ts";
import { getItemLimitRaw, preflight, type PreflightOptions } from "./preflight.ts";
import { parseGtinRule, resolveGtin } from "./gtin.ts";
import { translateShopeeError } from "./errors.ts";
import { cleanTitle, normalize } from "./text.ts";

const ALIVE = new Set(["NORMAL", "UNLIST", "REVIEWING"]);

export async function itemInfo(call: ShopeeCaller, itemId: number): Promise<{ status: string; categoryId: number } | null> {
  try {
    const r = await call<any>("/api/v2/product/get_item_base_info", { query: { item_id_list: String(itemId) } });
    const it = r?.item_list?.[0];
    return it ? { status: String(it.item_status), categoryId: Number(it.category_id) } : null;
  } catch {
    return null;
  }
}

/** Procura o anúncio na loja pelo SKU do PAS e, se não achar, pelo(s) título(s) exato(s). */
export async function findExistingItem(call: ShopeeCaller, sku: string, titles: string[]): Promise<number | null> {
  const statuses = ["NORMAL", "UNLIST", "REVIEWING"];
  try {
    const bySku = await call<any>("/api/v2/product/search_item", { query: { item_sku: sku, page_size: 10, item_status: statuses } });
    const id = bySku?.item_id_list?.[0];
    if (id) return Number(id);
  } catch { /* segue para o título */ }
  const wanted = [...new Set(titles.map((t) => normalize(t)).filter(Boolean))];
  for (const title of [...new Set(titles.filter(Boolean))]) {
    try {
      const byName = await call<any>("/api/v2/product/search_item", {
        query: { item_name: title.slice(0, 120), page_size: 20, item_status: statuses },
      });
      const ids: number[] = (byName?.item_id_list ?? []).map(Number).slice(0, 20);
      if (!ids.length) continue;
      const info = await call<any>("/api/v2/product/get_item_base_info", { query: { item_id_list: ids.join(",") } });
      const hit = (info?.item_list ?? []).find((it: any) => wanted.includes(normalize(it?.item_name)) && ALIVE.has(it?.item_status));
      if (hit) return Number(hit.item_id);
    } catch { /* tenta o próximo título */ }
  }
  return null;
}

/** Espera entre add_item e init_tier_variation (a Shopee pede ≥5 s). Ajustável só em teste. */
let VARIATION_WAITS = [6000, 8000, 15000];
export function __setVariationWaitsForTests(waits: number[]) {
  VARIATION_WAITS = waits;
}

async function initVariations(call: ShopeeCaller, itemId: number, product: CatalogProduct, gtinRule: Parameters<typeof resolveGtin>[0]) {
  const v = product.variations!;
  const body = {
    item_id: itemId,
    tier_variation: v.tiers.map((t) => ({ name: t.name.slice(0, 20), option_list: t.options.map((o) => ({ option: o.slice(0, 50) })) })),
    model: v.models.map((m) => {
      const g = resolveGtin(gtinRule, m.gtin, "modelo");
      return {
        tier_index: m.tierIndex,
        original_price: Math.round(m.price * 100) / 100,
        ...(m.sku ? { model_sku: m.sku.slice(0, 100) } : {}),
        seller_stock: [{ stock: Math.max(0, Math.floor(m.stock)) }],
        ...(g.value !== undefined ? { gtin_code: g.value } : {}),
      };
    }),
  };
  // A Shopee pede ≥5 s entre criar o item e criar as variações.
  let last: unknown;
  for (const w of VARIATION_WAITS) {
    await sleep(w);
    try {
      await call("/api/v2/product/init_tier_variation", { method: "POST", body, retries: 0 });
      return;
    } catch (e) {
      last = e;
      // já tem variação (tentativa anterior concluiu): considera ok
      if (e instanceof ShopeeApiError && /already|exist|tier.*init/i.test(`${e.code} ${e.message}`)) return;
    }
  }
  throw last;
}

export interface PublishOptions extends PreflightOptions {
  shopId: number;
  store: PublicationStore;
  ai?: AiFn;
}

export async function publishProduct(call: ShopeeCaller, product: CatalogProduct, opts: PublishOptions): Promise<PublishResult> {
  const { store, shopId } = opts;
  const sku = `PAS-${product.id}`.slice(0, 100);
  const title = cleanTitle(product.title).title;
  const warnings: Issue[] = [];

  // 0. Histórico: já publicado ou parcialmente publicado?
  const prev = await store.get(shopId, product.id);
  if (prev?.itemId) {
    const info = await itemInfo(call, prev.itemId);
    if (info && ALIVE.has(info.status)) {
      if (prev.status === "published") {
        return { status: "already_published", itemId: prev.itemId, blockers: [], warnings, message: "Esse produto já está publicado na sua loja." };
      }
      if ((prev.status === "created" || prev.status === "partial") && product.variations?.models?.length) {
        // retoma só as variações
        try {
          const gtinRule = parseGtinRule(await getItemLimitRaw(call, info.categoryId));
          await initVariations(call, prev.itemId, product, gtinRule);
          await store.save({ shopId, productId: product.id, itemId: prev.itemId, status: "published", lastError: null, blockers: null });
          return { status: "published", itemId: prev.itemId, blockers: [], warnings, message: "Publicação concluída (variações finalizadas)." };
        } catch (e) {
          const issue = translateShopeeError(e instanceof Error ? e.message : String(e));
          await store.save({ shopId, productId: product.id, itemId: prev.itemId, status: "partial", lastError: issue.adminHint ?? issue.message });
          return { status: "partial", itemId: prev.itemId, blockers: [issue], warnings, message: "O anúncio foi criado, mas as variações ainda não entraram. Tente de novo em alguns minutos — não será criado outro anúncio." };
        }
      }
      if (prev.status === "created") {
        await store.save({ shopId, productId: product.id, itemId: prev.itemId, status: "published", lastError: null });
        return { status: "already_published", itemId: prev.itemId, blockers: [], warnings, message: "Esse produto já está publicado na sua loja." };
      }
    }
  }

  // 1. Trava contra duplo clique
  const locked = await store.lock(shopId, product.id);
  if (!locked) {
    return {
      status: "in_progress",
      blockers: [],
      warnings,
      message: "Esse produto já está sendo publicado. Aguarde alguns segundos e atualize a página.",
    };
  }

  try {
    // 2. Já existe na loja? (inclusive criado por versões antigas do PAS)
    const existing = await findExistingItem(call, sku, [title, product.title]);
    if (existing) {
      await store.save({ shopId, productId: product.id, itemId: existing, status: "published", lastError: null, blockers: null });
      return { status: "already_published", itemId: existing, blockers: [], warnings, message: "Esse produto já estava na sua loja — vinculamos o anúncio existente." };
    }

    // 3. Preflight completo (sobe fotos e tabela de medidas)
    const pf = await preflight(call, product, { ...opts, dryRun: false });
    warnings.push(...pf.warnings);
    if (!pf.ok || !pf.payload) {
      await store.save({ shopId, productId: product.id, status: "blocked", blockers: pf.blockers, lastError: pf.blockers.map((b) => b.code).join(",") });
      return {
        status: "blocked",
        blockers: pf.blockers,
        warnings,
        message: pf.blockers[0]?.message ?? "Produto com dados incompletos no catálogo.",
      };
    }

    // 4. add_item — sem retry automático (retry às cegas = duplicado)
    let itemId: number | null = null;
    try {
      try {
        const r = await call<any>("/api/v2/product/add_item", { method: "POST", body: pf.payload, retries: 0, timeoutMs: 60_000 });
        itemId = Number(r?.item_id) || null;
      } catch (e) {
        // Vínculo com produto oficial recusado (erro de validação, item NÃO criado): tenta sem o vínculo
        if (e instanceof ShopeeApiError && pf.payload.ssp_id && /ssp/i.test(`${e.code} ${e.message}`) && !/network|timeout|http_5/i.test(e.code)) {
          const { ssp_id: _s, cssp_id: _c, ...semVinculo } = pf.payload;
          const r = await call<any>("/api/v2/product/add_item", { method: "POST", body: semVinculo, retries: 0, timeoutMs: 60_000 });
          itemId = Number(r?.item_id) || null;
        } else {
          throw e;
        }
      }
    } catch (e) {
      const raw = e instanceof ShopeeApiError ? `${e.code}: ${e.message}` : String(e);
      // timeout/rede/duplicado: o item pode ter sido criado — procura antes de desistir
      await sleep(3000);
      itemId = await findExistingItem(call, sku, [String(pf.payload.item_name ?? title), product.title]);
      if (!itemId) {
        const issue = translateShopeeError(raw);
        await store.save({ shopId, productId: product.id, status: "failed", blockers: [issue], lastError: raw });
        return { status: "failed", blockers: [issue], warnings, message: issue.message };
      }
    }
    if (!itemId) {
      const issue = translateShopeeError("add_item sem item_id");
      await store.save({ shopId, productId: product.id, status: "failed", blockers: [issue], lastError: "add_item sem item_id" });
      return { status: "failed", blockers: [issue], warnings, message: issue.message };
    }
    await store.save({ shopId, productId: product.id, itemId, status: "created", lastError: null, blockers: null });

    // 5. Variações (com espera e retomada)
    if (product.variations?.models?.length) {
      try {
        await initVariations(call, itemId, product, pf.gtinRule);
      } catch (e) {
        const issue = translateShopeeError(e instanceof Error ? e.message : String(e));
        await store.save({ shopId, productId: product.id, itemId, status: "partial", lastError: issue.adminHint ?? issue.message });
        return {
          status: "partial",
          itemId,
          blockers: [{ ...issue, code: "VARIATION_PENDING" }],
          warnings,
          message: "O anúncio foi criado, mas as variações ainda não entraram. Clique em publicar de novo em alguns minutos — o PAS só completa o que falta.",
        };
      }
    }

    await store.save({ shopId, productId: product.id, itemId, status: "published", lastError: null, blockers: null });
    return { status: "published", itemId, blockers: [], warnings, message: "Produto publicado na sua loja Shopee!" };
  } catch (e) {
    const issue = translateShopeeError(e instanceof Error ? e.message : String(e));
    await store.save({ shopId, productId: product.id, status: "failed", blockers: [issue], lastError: String(e) });
    return { status: "failed", blockers: [issue], warnings, message: issue.message };
  }
}
