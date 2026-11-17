import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin.functions";

/**
 * "Seja fornecedor": public supplier sign-up. Applications wait in supplier_applications until an
 * admin approves them in /admin/envios; approving creates the supplier and imports its spreadsheet.
 */

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

const applicationSchema = z.object({
  company: z.string().trim().min(2).max(120),
  document: z.string().trim().min(11).max(20),
  contactName: z.string().trim().min(3).max(100),
  whatsapp: z.string().trim().min(10).max(20),
  email: z.string().trim().email().max(120),
  city: z.string().trim().max(80).optional(),
  uf: z.string().trim().max(2).optional(),
  niche: z.string().trim().max(120).optional(),
  instagram: z.string().trim().max(80).optional(),
  acceptsShopeeLabel: z.boolean(),
  shipsWithinDays: z.number().int().min(1).max(5),
  payoutMode: z.enum(["on_ship", "after_delivery"]),
  pixKey: z.string().trim().min(5).max(120),
  catalogCsv: z.string().max(6_000_000).optional(),
  // Honeypot: real people never see or fill this field.
  website: z.string().max(0).optional(),
});

export type SupplierApplicationInput = z.infer<typeof applicationSchema>;

export const submitSupplierApplication = createServerFn({ method: "POST" })
  .validator((input: unknown) => applicationSchema.parse(input))
  .handler(async ({ data }) => {
    const { normalizeCpfCnpj, pixKeyInfo } = await import("@/lib/fulfillment");
    const document = normalizeCpfCnpj(data.document);
    if (!document) throw new Error("CNPJ ou CPF inválido. Confira os números.");
    const pix = pixKeyInfo(data.pixKey);
    if (!pix) throw new Error("Chave PIX inválida. Use CNPJ, CPF, e-mail, celular com DDD ou chave aleatória.");
    const whatsapp = data.whatsapp.replace(/\D/g, "");
    if (whatsapp.length < 10 || whatsapp.length > 13) throw new Error("WhatsApp inválido. Use DDD + número.");
    let catalogRows = 0;
    if (data.catalogCsv?.trim()) {
      const { readCatalog } = await import("@/lib/catalog-import");
      const parsed = readCatalog(data.catalogCsv);
      if (parsed.missingColumns.length) throw new Error(`A planilha precisa das colunas: ${parsed.missingColumns.join(", ")}.`);
      catalogRows = parsed.rows.length;
      if (!catalogRows) throw new Error("A planilha não tem nenhum produto válido (precisa de nome e custo).");
    }
    const client = await admin();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await client.from("supplier_applications").select("id", { count: "exact", head: true }).eq("document", document).gte("created_at", since);
    if ((count ?? 0) >= 3) throw new Error("Já recebemos seu cadastro. Nossa equipe vai falar com você pelo WhatsApp.");
    const { error } = await client.from("supplier_applications").insert({
      company: data.company,
      document,
      contact_name: data.contactName,
      whatsapp: whatsapp.startsWith("55") ? whatsapp : `55${whatsapp}`,
      email: data.email.toLowerCase(),
      city: data.city || null,
      uf: data.uf ? data.uf.toUpperCase() : null,
      niche: data.niche || null,
      instagram: data.instagram || null,
      accepts_shopee_label: data.acceptsShopeeLabel,
      ships_within_days: data.shipsWithinDays,
      payout_mode: data.payoutMode,
      pix_key: pix.key,
      pix_key_type: pix.type,
      catalog_csv: data.catalogCsv?.trim() ? data.catalogCsv : null,
      catalog_rows: catalogRows,
    });
    if (error) throw new Error("Não foi possível enviar seu cadastro agora. Tente de novo em alguns minutos.");
    return { ok: true, catalogRows };
  });

export const adminListSupplierApplications = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { data } = await (await admin())
      .from("supplier_applications")
      .select("id, company, document, contact_name, whatsapp, email, city, uf, niche, instagram, accepts_shopee_label, ships_within_days, payout_mode, pix_key, pix_key_type, catalog_rows, status, supplier_id, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((row) => ({
      id: String(row["id"]),
      company: String(row["company"]),
      document: String(row["document"]),
      contactName: String(row["contact_name"]),
      whatsapp: String(row["whatsapp"]),
      email: String(row["email"]),
      place: [row["city"], row["uf"]].filter(Boolean).join("/") || null,
      niche: (row["niche"] as string | null) ?? null,
      instagram: (row["instagram"] as string | null) ?? null,
      acceptsShopeeLabel: Boolean(row["accepts_shopee_label"]),
      shipsWithinDays: Number(row["ships_within_days"]),
      payoutMode: String(row["payout_mode"]) as "on_ship" | "after_delivery",
      pixKey: String(row["pix_key"]),
      catalogRows: Number(row["catalog_rows"]),
      status: String(row["status"]) as "pending" | "approved" | "rejected",
      createdAt: String(row["created_at"]),
    }));
  });

const slugify = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "fornecedor";

/** Approve: creates the supplier (repasse automático ligado) and imports the spreadsheet sent with the application. */
export const adminDecideSupplierApplication = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: unknown) => z.object({ id: z.string().uuid(), approve: z.boolean(), note: z.string().max(300).optional() }).parse(input))
  .handler(async ({ data }) => {
    const client = await admin();
    const { data: app } = await client.from("supplier_applications").select("*").eq("id", data.id).maybeSingle();
    if (!app || app["status"] !== "pending") throw new Error("Esse cadastro já foi analisado.");
    const decidedAt = new Date().toISOString();
    if (!data.approve) {
      await client.from("supplier_applications").update({ status: "rejected", admin_note: data.note ?? null, decided_at: decidedAt }).eq("id", data.id);
      return { approved: false as const };
    }
    const base = slugify(String(app["company"]));
    let slug = base;
    for (let n = 2; n < 50; n += 1) {
      const { data: taken } = await client.from("suppliers").select("id").eq("slug", slug).maybeSingle();
      if (!taken) break;
      slug = `${base}-${n}`;
    }
    const { newPanelToken } = await import("@/lib/fulfillment.server");
    const token = newPanelToken();
    const { data: supplier, error } = await client
      .from("suppliers")
      .insert({
        slug,
        name: String(app["company"]),
        whatsapp: String(app["whatsapp"]),
        email: String(app["email"]),
        pix_key: String(app["pix_key"]),
        pix_key_type: (app["pix_key_type"] as string | null) ?? null,
        payout_mode: String(app["payout_mode"]),
        auto_payout: true,
        sources: [slug],
        active: true,
        panel_token_hash: token.hash,
      })
      .select("id")
      .single();
    if (error || !supplier) throw new Error(`Não foi possível criar o fornecedor: ${error?.message ?? "erro desconhecido"}`);
    const supplierId = String(supplier["id"]);
    await client.from("supplier_applications").update({ status: "approved", supplier_id: supplierId, admin_note: data.note ?? null, decided_at: decidedAt }).eq("id", data.id);
    let imported: number | null = null;
    let importError: string | null = null;
    if (app["catalog_csv"]) {
      try {
        const { importSupplierCatalog } = await import("@/lib/catalog-import.server");
        imported = (await importSupplierCatalog(client, supplierId, String(app["catalog_csv"]))).active;
      } catch (error) {
        importError = error instanceof Error ? error.message : String(error);
      }
    }
    return { approved: true as const, supplierId, slug, imported, importError, panelToken: token.raw, whatsapp: String(app["whatsapp"]) };
  });
