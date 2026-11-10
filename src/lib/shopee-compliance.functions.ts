import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Json } from "@/integrations/supabase/types";

import { requireActiveUser } from "@/lib/access-control";
import { requireAdmin } from "@/lib/admin.functions";
import { parseShopeeProductDetails, readShopeeReference, type ShopeeReference } from "@/lib/shopee-reference";
import { ANATEL_PATTERN, LOCAL_DOCUMENT_BLOCKS, digitsOnly, documentBlockers, isGs1Gtin, parseIssues, type ComplianceStatus } from "@/lib/shopee-compliance";

const optionalText = (max: number) => z.string().trim().max(max).nullable().transform((value) => value || null);

const complianceInput = z.object({
  productId: z.string().uuid(),
  gtin: z.string().nullable().transform((value) => digitsOnly(value) || null)
    .refine((value) => value === null || isGs1Gtin(value), "Código de barras inválido: confira os 8, 12, 13 ou 14 dígitos impressos na embalagem."),
  hasRadio: z.boolean().nullable(),
  anatelRegistrationId: z.string().trim().nullable().transform((value) => value || null)
    .refine((value) => value === null || ANATEL_PATTERN.test(value), "A homologação ANATEL deve ter o formato 00000-00-00000."),
  anatelManufacturer: optionalText(200),
  anatelModel: optionalText(200),
  anvisaCode: optionalText(80),
  inmetroCode: optionalText(80),
  partNumber: optionalText(120),
  sizeChartImageUrl: z.string().url().nullable(),
  sizeChartTemplateName: optionalText(120),
  shopeeCategoryId: z.number().int().positive().nullable(),
});

export type ProductCompliance = {
  productId: string;
  gtin: string | null;
  hasRadio: boolean | null;
  anatelRegistrationId: string | null;
  anatelManufacturer: string | null;
  anatelModel: string | null;
  anvisaCode: string | null;
  inmetroCode: string | null;
  partNumber: string | null;
  sizeChartImageUrl: string | null;
  sizeChartTemplateName: string | null;
  shopeeCategoryId: number | null;
  publishStatus: ComplianceStatus;
  blockers: ReturnType<typeof parseIssues>;
  warnings: ReturnType<typeof parseIssues>;
  checkedAt: string | null;
  reference: ShopeeReference | null;
};

type ComplianceRecord = {
  product_id: string; gtin: string | null; has_radio: boolean | null; anatel_registration_id: string | null; anatel_manufacturer: string | null;
  anatel_model: string | null; anvisa_code: string | null; inmetro_code: string | null; part_number: string | null; size_chart_image_url: string | null;
  size_chart_template_name: string | null; shopee_category_id: number | null; publish_status: string; blockers: unknown; warnings: unknown; checked_at: string | null; shopee_reference?: unknown;
};

function toCompliance(productId: string, row: ComplianceRecord | null): ProductCompliance {
  return {
    productId,
    gtin: row?.gtin ?? null,
    hasRadio: row?.has_radio ?? null,
    anatelRegistrationId: row?.anatel_registration_id ?? null,
    anatelManufacturer: row?.anatel_manufacturer ?? null,
    anatelModel: row?.anatel_model ?? null,
    anvisaCode: row?.anvisa_code ?? null,
    inmetroCode: row?.inmetro_code ?? null,
    partNumber: row?.part_number ?? null,
    sizeChartImageUrl: row?.size_chart_image_url ?? null,
    sizeChartTemplateName: row?.size_chart_template_name ?? null,
    shopeeCategoryId: row?.shopee_category_id == null ? null : Number(row.shopee_category_id),
    publishStatus: (row?.publish_status as ComplianceStatus | undefined) ?? "unchecked",
    blockers: parseIssues(row?.blockers),
    warnings: parseIssues(row?.warnings),
    checkedAt: row?.checked_at ?? null,
    reference: readShopeeReference(row?.shopee_reference),
  };
}

export const getProductCompliance = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: unknown) => z.object({ productId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("catalog_product_compliance").select("*").eq("product_id", data.productId).maybeSingle();
    if (error) throw new Error("Não foi possível ler as exigências deste produto.");
    return toCompliance(data.productId, row as ComplianceRecord | null);
  });

export const saveProductCompliance = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: unknown) => complianceInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("catalog_product_compliance").upsert({
      product_id: data.productId,
      gtin: data.gtin,
      has_radio: data.hasRadio,
      anatel_registration_id: data.anatelRegistrationId,
      anatel_manufacturer: data.anatelManufacturer,
      anatel_model: data.anatelModel,
      anvisa_code: data.anvisaCode,
      inmetro_code: data.inmetroCode,
      part_number: data.partNumber,
      size_chart_image_url: data.sizeChartImageUrl,
      size_chart_template_name: data.sizeChartTemplateName,
      shopee_category_id: data.shopeeCategoryId,
    }, { onConflict: "product_id" }).select("*").single();
    if (error) throw new Error("Não foi possível salvar as exigências deste produto.");
    await supabaseAdmin.from("admin_logs").insert({ admin_user_id: context.userId, admin_email: context.admin.email, action: "admin_updated_product_compliance", entity_type: "product", entity_id: data.productId, metadata: {} });
    return toCompliance(data.productId, row as ComplianceRecord);
  });

/**
 * Admin pastes the "details" block of the supplier's Shopee page. The parsed
 * category, characteristics and description become catalogue facts used by
 * every customer who publishes this product. An empty text removes them.
 */
export const saveShopeeReference = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: unknown) => z.object({ productId: z.string().uuid(), text: z.string().max(30_000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const parsed = data.text.trim() ? parseShopeeProductDetails(data.text) : null;
    if (data.text.trim() && !parsed) throw new Error("Não encontrei categoria, características nem descrição nesse texto. Copie a parte \"Detalhes do produto\" da página da Shopee.");
    const reference = parsed ? { ...parsed, savedAt: new Date().toISOString() } : null;
    const { data: row, error } = await supabaseAdmin.from("catalog_product_compliance")
      // New facts invalidate the last check, so an old document block cannot stop the next publication.
      .upsert({ product_id: data.productId, shopee_reference: reference as unknown as Json, data_updated_at: new Date().toISOString(), publish_status: "unchecked", blockers: [] as unknown as Json }, { onConflict: "product_id" })
      .select("*").single();
    if (error) throw new Error("Não foi possível salvar os dados da Shopee deste produto.");
    // The pasted description only fills a catalogue product that has none; existing text is never replaced.
    let descriptionFilled = false;
    if (reference?.description) {
      const { data: product } = await supabaseAdmin.from("products").select("description").eq("id", data.productId).maybeSingle();
      if (product && !String(product.description ?? "").trim()) {
        const { error: updateError } = await supabaseAdmin.from("products").update({ description: reference.description }).eq("id", data.productId);
        descriptionFilled = !updateError;
      }
    }
    await supabaseAdmin.from("admin_logs").insert({ admin_user_id: context.userId, admin_email: context.admin.email, action: "admin_saved_shopee_reference", entity_type: "product", entity_id: data.productId, metadata: { fields: reference?.fields.length ?? 0, categoryPath: reference?.categoryPath ?? [] } });
    return { compliance: toCompliance(data.productId, row as ComplianceRecord), descriptionFilled };
  });

/** Admin report: every catalogue product with its last Shopee check. */
export const listComplianceReport = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: products }, { data: rows }] = await Promise.all([
      supabaseAdmin.from("products").select("id, name, status").order("created_at", { ascending: true }).order("id").limit(2000),
      supabaseAdmin.from("catalog_product_compliance").select("product_id, publish_status, blockers, warnings, checked_at").limit(2000),
    ]);
    const byId = new Map((rows ?? []).map((row) => [row.product_id, row]));
    return (products ?? []).map((product) => {
      const row = byId.get(product.id);
      return {
        productId: product.id,
        name: product.name,
        productStatus: product.status,
        publishStatus: (row?.publish_status as ComplianceStatus | undefined) ?? "unchecked",
        blockers: parseIssues(row?.blockers),
        warnings: parseIssues(row?.warnings),
        checkedAt: row?.checked_at ?? null,
      };
    });
  });

/** Customer view: products Shopee cannot accept right now because a document is missing. */
export const listUnavailableProducts = createServerFn({ method: "GET" })
  .middleware([requireActiveUser])
  .handler(async ({ context }) => {
    if (!LOCAL_DOCUMENT_BLOCKS) return [] as Array<{ productId: string; messages: string[] }>;
    const { data } = await context.supabase.from("catalog_product_compliance").select("product_id, blockers").eq("publish_status", "blocked").limit(2000);
    return (data ?? []).flatMap((row) => {
      const blockers = documentBlockers(parseIssues(row.blockers));
      return blockers.length ? [{ productId: row.product_id, messages: blockers.map((issue) => issue.message) }] : [];
    });
  });

/** Publication history of the customer's own shop (lock, item id, last outcome). */
export const listShopeePublications = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ connectionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Connection rows hold tokens and are server-only; read just the shop id for the caller's own connection.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: connection } = await supabaseAdmin.from("shopee_shop_connections").select("shop_id").eq("id", data.connectionId).eq("user_id", context.userId).maybeSingle();
    if (!connection) return [];
    const { data: rows } = await context.supabase.from("shopee_publications").select("product_id, status, item_id, updated_at").eq("shop_id", connection.shop_id).limit(2000);
    return (rows ?? []).map((row) => ({ productId: row.product_id, status: row.status, itemId: row.item_id == null ? null : Number(row.item_id), updatedAt: row.updated_at }));
  });
