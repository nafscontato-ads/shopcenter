import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  classifyMissingRequirements,
  complianceFactsText,
  complianceStatus,
  documentBlockers,
  parseGtinRule,
  type ComplianceFacts,
  type ComplianceIssue,
} from "@/lib/shopee-compliance";
import { suggestShopeeCategory, type ShopeeCategoryOption } from "@/lib/shopee-product-defaults";
import { mergeReferenceAttributes, readShopeeReference, referenceAttributes, referenceCategoryCandidates, referenceFactsText } from "@/lib/shopee-reference";
import type { ShopeeAttribute } from "@/lib/shopee-publishing";
import { fillMandatoryAttributes } from "@/lib/shopee-requirements.server";
import { availableSubmissionAttributes } from "@/lib/shopee-submission";

type ShopeeServer = typeof import("@/lib/shopee.server");
type Credentials = { shopId: number; accessToken: string };
export type ComplianceRow = ComplianceFacts & { product_id: string; publish_status: string; blockers: Json | null; warnings: Json | null; checked_at: string | null; shopee_reference?: Json | null };

export async function readCompliance(productId: string): Promise<ComplianceRow | null> {
  const { data } = await supabaseAdmin.from("catalog_product_compliance").select("*").eq("product_id", productId).maybeSingle();
  return (data as ComplianceRow | null) ?? null;
}

export async function isActiveAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("admin_users").select("id").eq("user_id", userId).eq("is_active", true).maybeSingle();
  return Boolean(data);
}

/** Atomic per shop+product lock (3 minutes) so a double click cannot create two listings. */
export async function lockPublication(shopId: number, productId: string) {
  const { data, error } = await supabaseAdmin.rpc("pas_lock_publication", { p_shop_id: shopId, p_product_id: productId });
  if (error) throw new Error("Não foi possível reservar a publicação deste produto. Tente novamente.");
  return data === true;
}

export async function savePublication(input: { shopId: number; productId: string; status: "publishing" | "created" | "partial" | "published" | "blocked" | "failed"; itemId?: number | null; lastError?: string | null; blockers?: ComplianceIssue[] | null }) {
  await supabaseAdmin.from("shopee_publications").upsert({
    shop_id: input.shopId,
    product_id: input.productId,
    status: input.status,
    item_id: input.itemId ?? null,
    last_error: input.lastError ?? null,
    blockers: (input.blockers ?? null) as Json,
    updated_at: new Date().toISOString(),
  }, { onConflict: "shop_id,product_id" });
}

export async function saveComplianceCheck(productId: string, result: { blockers: ComplianceIssue[]; warnings: ComplianceIssue[]; attributes: ShopeeAttribute[]; categoryId: number | null }) {
  await supabaseAdmin.from("catalog_product_compliance").upsert({
    product_id: productId,
    publish_status: complianceStatus(result.blockers, result.warnings),
    blockers: result.blockers as unknown as Json,
    warnings: result.warnings as unknown as Json,
    shopee_attributes: result.attributes as unknown as Json,
    suggested_category_id: result.categoryId,
    checked_at: new Date().toISOString(),
  }, { onConflict: "product_id" });
}

/**
 * Category order: admin override, supplier's official category, Shopee's own
 * recommendation for the title, then local family matching. Never an
 * unrelated leaf to dodge requirements.
 */
export async function resolveShopeeCategory(shopee: ShopeeServer, credentials: Credentials, input: {
  categories: ShopeeCategoryOption[];
  overrideId?: number | null;
  /** Breadcrumb pasted from the supplier's Shopee page. */
  referencePath?: string[] | null;
  supplierUrl?: string | null;
  name: string;
  title: string;
  category: string | null;
  subcategory: string | null;
  currentId?: number | null;
}) {
  const byId = (id: number | null | undefined) => (id ? input.categories.find((entry) => entry.category_id === id) : undefined);
  let supplierRegulatoryFacts = "";
  const override = byId(input.overrideId);
  if (override) return { category: override, supplierRegulatoryFacts };
  // The supplier's own breadcrumb: pick the leaf inside it (the page often stops one level above the leaf).
  const candidates = referenceCategoryCandidates(input.referencePath ?? [], input.categories);
  if (candidates.length === 1) return { category: candidates[0] ?? null, supplierRegulatoryFacts };
  if (candidates.length > 1) {
    for (const title of [...new Set([input.name, input.title])]) {
      const ids = await shopee.getShopeeCategoryRecommendation(credentials, title).catch(() => [] as number[]);
      const inside = ids.map((id) => candidates.find((entry) => entry.category_id === id)).find(Boolean);
      if (inside) return { category: inside, supplierRegulatoryFacts };
    }
    const local = suggestShopeeCategory({ name: input.name, category: input.category, subcategory: input.subcategory }, candidates);
    if (local) return { category: local, supplierRegulatoryFacts };
    const current = candidates.find((entry) => entry.category_id === input.currentId);
    if (current) return { category: current, supplierRegulatoryFacts };
  }
  let supplierCategoryId: number | null = null;
  if (input.supplierUrl) {
    try {
      const supplierProduct = await shopee.getOfficialShopeeProductOptions(input.supplierUrl);
      supplierCategoryId = supplierProduct?.categoryId ?? null;
      supplierRegulatoryFacts = supplierProduct?.regulatoryFacts ?? "";
    } catch { /* Match catalogue facts below. */ }
  }
  const supplier = byId(supplierCategoryId);
  if (supplier) return { category: supplier, supplierRegulatoryFacts };
  let recommendedIds: number[] = [];
  for (const title of [...new Set([input.name, input.title])]) {
    recommendedIds = await shopee.getShopeeCategoryRecommendation(credentials, title);
    if (recommendedIds.some((id) => byId(id))) break;
  }
  const recommended = recommendedIds.map((id) => byId(id)).find(Boolean);
  const category = recommended
    ?? suggestShopeeCategory({ name: input.name, category: input.category, subcategory: input.subcategory }, input.categories)
    ?? byId(input.currentId);
  return { category: category ?? null, supplierRegulatoryFacts };
}

/** Fill the category attributes from catalogue facts and report which missing documents block the listing. */
export async function evaluateRequirements(shopee: ShopeeServer, credentials: Credentials, input: {
  categoryId: number;
  product: { name: string; description: string; brand: string | null };
  compliance: (ComplianceFacts & { shopee_reference?: unknown }) | null;
  existing: ShopeeAttribute[];
  images: string[];
  ai?: boolean;
}) {
  const [attributeResult, rules] = await Promise.all([
    shopee.getShopeeAttributes(credentials, input.categoryId).catch(() => null),
    shopee.getShopeeCategoryRules(credentials, input.categoryId),
  ]);
  const factsText = complianceFactsText(input.compliance);
  // Details pasted from the supplier's Shopee page answer the matching characteristics first.
  const reference = readShopeeReference(input.compliance?.shopee_reference);
  const existing = attributeResult ? mergeReferenceAttributes(input.existing, referenceAttributes(attributeResult["response"], reference)) : input.existing;
  const filled = await fillMandatoryAttributes(
    attributeResult?.["response"],
    { name: input.product.name, description: `${factsText}\n${referenceFactsText(reference)}\n${input.product.description}`, brand: input.product.brand },
    existing,
    input.images,
    { model: input.compliance?.anatel_model || input.compliance?.model || null, partNumber: input.compliance?.part_number ?? null, hasRadio: input.compliance?.has_radio ?? null },
    { ai: input.ai ?? true },
  );
  const attributes = attributeResult ? availableSubmissionAttributes(attributeResult["response"], filled.attributes) : input.existing;
  const gtinRule = parseGtinRule(rules.gtinRule);
  const { blockers, warnings } = classifyMissingRequirements(filled.missing.map((field) => ({ id: field.id, name: field.name })), { gtinRule, gtin: filled.gtin, categoryId: input.categoryId });
  if (!attributeResult) warnings.push({ level: "warning", code: "ATTRIBUTE_UNRESOLVED", message: "A Shopee não mostrou as características desta categoria agora; o produto segue com os dados disponíveis." });
  return { attributes, gtin: filled.gtin, gtinRule, rules, blockers, warnings, documentBlockers: documentBlockers(blockers) };
}

/** A size chart template that already exists in the shop and matches the catalogue's template name. */
export async function pickSizeChartTemplate(shopee: ShopeeServer, credentials: Credentials, categoryId: number, wanted: string) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const target = normalize(wanted);
  if (!target) return null;
  try {
    const templates = await shopee.getShopeeSizeChartTemplates(credentials, categoryId);
    return templates.find((item) => normalize(item.name) === target) ?? templates.find((item) => normalize(item.name).includes(target)) ?? null;
  } catch {
    return null;
  }
}
