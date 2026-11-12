import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireActiveUser } from "@/lib/access-control";
import { requireAdmin } from "@/lib/admin.functions";
import type { FulfillmentLine, FulfillmentStatus } from "@/lib/fulfillment";

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export type MyFulfillmentOrder = {
  id: string; orderSn: string; status: FulfillmentStatus; lines: FulfillmentLine[]; goodsCost: number; fee: number;
  debited: number; lastError: string | null; trackingNumber: string | null; createdAt: string; supplierName: string | null;
};

/* ---------------------------------- Seller ---------------------------------- */

export const getMyFulfillment = createServerFn({ method: "GET" })
  .middleware([requireActiveUser])
  .handler(async ({ context }) => {
    const client = context.supabase as unknown as SupabaseClient;
    const [wallet, ledger, orders, shops] = await Promise.all([
      (await admin()).from("seller_wallets").select("balance, credit_limit, asaas_customer_id").eq("user_id", context.userId).maybeSingle(),
      client.from("wallet_ledger").select("id, amount, kind, note, balance_after, created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(50),
      client.from("fulfillment_orders").select("id, order_sn, status, lines, goods_cost, platform_fee, debited_amount, last_error, tracking_number, created_at, supplier_id").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(200),
      context.supabase.from("shopee_shop_connections").select("id, shop_name, shop_id, status").eq("user_id", context.userId).eq("status", "active"),
    ]);
    const supplierIds = [...new Set((orders.data ?? []).map((row) => row["supplier_id"]).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    if (supplierIds.length) {
      const { data } = await (await admin()).from("suppliers").select("id, name").in("id", supplierIds);
      for (const row of data ?? []) names.set(String(row["id"]), String(row["name"]));
    }
    const { data: autoRows } = await (await admin()).from("shopee_shop_connections").select("id, auto_fulfillment").eq("user_id", context.userId);
    const auto = new Map((autoRows ?? []).map((row) => [String(row["id"]), Boolean(row["auto_fulfillment"])]));
    const pending = (orders.data ?? []).filter((row) => row["status"] === "awaiting_funds").reduce((sum, row) => sum + Number(row["goods_cost"]) + Number(row["platform_fee"]), 0);
    return {
      balance: Number(wallet.data?.["balance"] ?? 0),
      creditLimit: Number(wallet.data?.["credit_limit"] ?? 0),
      pendingAmount: Math.round(pending * 100) / 100,
      pixKey: process.env["FULFILLMENT_PIX_KEY"] ?? null,
      pixAutomatic: Boolean(process.env["ASAAS_API_KEY"] || process.env["MP_ACCESS_TOKEN"]),
      // Asaas needs the seller's CPF/CNPJ once, on the first recharge.
      pixNeedsDocument: Boolean(process.env["ASAAS_API_KEY"]) && !wallet.data?.["asaas_customer_id"],
      shippedCount: (orders.data ?? []).filter((row) => row["status"] === "shipped").length,
      shops: (shops.data ?? []).map((shop) => ({ id: shop.id, name: shop.shop_name ?? `Loja ${shop.shop_id}`, autoFulfillment: auto.get(shop.id) ?? false })),
      ledger: (ledger.data ?? []).map((row) => ({ id: String(row["id"]), amount: Number(row["amount"]), kind: String(row["kind"]), note: (row["note"] as string | null) ?? null, balanceAfter: Number(row["balance_after"]), at: String(row["created_at"]) })),
      orders: (orders.data ?? []).map((row): MyFulfillmentOrder => ({
        id: String(row["id"]), orderSn: String(row["order_sn"]), status: row["status"] as FulfillmentStatus, lines: row["lines"] as FulfillmentLine[],
        goodsCost: Number(row["goods_cost"]), fee: Number(row["platform_fee"]), debited: Number(row["debited_amount"]), lastError: (row["last_error"] as string | null) ?? null,
        trackingNumber: (row["tracking_number"] as string | null) ?? null, createdAt: String(row["created_at"]), supplierName: row["supplier_id"] ? names.get(String(row["supplier_id"])) ?? null : null,
      })),
    };
  });

export const setAutoFulfillment = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ connectionId: z.string().uuid(), enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (await admin()).from("shopee_shop_connections").update({ auto_fulfillment: data.enabled }).eq("id", data.connectionId).eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível salvar o envio automático.");
    return { ok: true };
  });

/** Pays waiting orders with the current balance (after a recharge). */
export const payWaitingOrders = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .handler(async ({ context }) => {
    const { fundWaitingOrders } = await import("@/lib/fulfillment.server");
    return { paid: await fundWaitingOrders(context.userId) };
  });

/* --------------------------------- Supplier --------------------------------- */
// Suppliers have no account: they use a secret panel link (hashed in suppliers.panel_token_hash).

const tokenInput = z.object({ token: z.string().min(20).max(80) });

export const getSupplierPanel = createServerFn({ method: "POST" })
  .validator((input: unknown) => tokenInput.parse(input))
  .handler(async ({ data }) => {
    const { supplierByToken, supplierQueue } = await import("@/lib/fulfillment.server");
    const supplier = await supplierByToken(data.token);
    return { supplier: { name: supplier.name }, orders: await supplierQueue(supplier.id) };
  });

export const getSupplierLabel = createServerFn({ method: "POST" })
  .validator((input: unknown) => tokenInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supplierByToken, supplierOrder, markLabel } = await import("@/lib/fulfillment.server");
    const supplier = await supplierByToken(data.token);
    const order = await supplierOrder(supplier.id, data.id);
    if (order.status !== "queued") return { ok: false as const, message: order.status === "shipped" ? "Este pedido já foi enviado." : "Este pedido não está liberado para envio." };
    const client = await admin();
    const { data: shopOrder } = await client.from("shopee_orders").select("status").eq("connection_id", order.connection_id).eq("order_sn", order.order_sn).maybeSingle();
    const { generateShopeeLabel } = await import("@/lib/shopee.functions");
    const result = await generateShopeeLabel({
      userId: order.user_id, connectionId: order.connection_id, orderSn: order.order_sn, status: String(shopOrder?.["status"] ?? "READY_TO_SHIP"), dropoffOnly: true,
      saveStatus: async (status) => {
        await client.from("shopee_orders").update({ status }).eq("connection_id", order.connection_id).eq("order_sn", order.order_sn);
        const { isCancelledStatus, refundOrder } = await import("@/lib/fulfillment.server");
        if (isCancelledStatus(status)) {
          await refundOrder(order.user_id, order.id);
          await client.from("fulfillment_orders").update({ status: "cancelled", shopee_status: status, updated_at: new Date().toISOString() }).eq("id", order.id);
        }
      },
    });
    if (result.ok) await markLabel(order.id, result.trackingNumber);
    return result;
  });

export const markSupplierShipped = createServerFn({ method: "POST" })
  .validator((input: unknown) => tokenInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supplierByToken, supplierOrder, markShipped } = await import("@/lib/fulfillment.server");
    const supplier = await supplierByToken(data.token);
    await supplierOrder(supplier.id, data.id);
    return { ok: await markShipped(data.id) };
  });

/* ----------------------------------- Admin ---------------------------------- */

/** Confirms a PIX received outside the system and credits the seller's wallet (pays waiting orders). */
export const adminCreditWallet = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: unknown) => z.object({ userId: z.string().uuid(), amount: z.number().positive().max(50000), reference: z.string().trim().min(3).max(120), note: z.string().max(200).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { bookWallet, fundWaitingOrders } = await import("@/lib/fulfillment.server");
    const balance = await bookWallet(data.userId, data.amount, "recharge", data.reference, data.note ?? "Recarga PIX confirmada", context.userId);
    const paid = await fundWaitingOrders(data.userId);
    return { balance, paid };
  });

export const adminSetCreditLimit = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: unknown) => z.object({ userId: z.string().uuid(), creditLimit: z.number().min(0).max(20000) }).parse(input))
  .handler(async ({ data }) => {
    const client = await admin();
    await client.from("seller_wallets").upsert({ user_id: data.userId }, { onConflict: "user_id", ignoreDuplicates: true });
    // A manual limit replaces the automatic reputation limit for this seller.
    const { error } = await client.from("seller_wallets").update({ credit_limit: data.creditLimit, credit_override: data.creditLimit, updated_at: new Date().toISOString() }).eq("user_id", data.userId);
    if (error) throw new Error("Não foi possível alterar o limite (o saldo atual pode estar abaixo do novo limite).");
    const { fundWaitingOrders } = await import("@/lib/fulfillment.server");
    return { paid: await fundWaitingOrders(data.userId) };
  });

export const adminListSuppliers = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const client = await admin();
    const { data } = await client.from("suppliers").select("id, slug, name, whatsapp, email, pix_key, pix_key_type, auto_payout, sources, active, panel_token_hash").order("name");
    const { data: queued } = await client.from("fulfillment_orders").select("supplier_id, status").in("status", ["queued", "needs_attention", "awaiting_funds"]);
    const counts = new Map<string, number>();
    for (const row of queued ?? []) if (row["status"] === "queued" && row["supplier_id"]) counts.set(String(row["supplier_id"]), (counts.get(String(row["supplier_id"])) ?? 0) + 1);
    const { data: payouts } = await client.from("supplier_payouts").select("id, supplier_id, amount, order_count, payout_day, status, last_error").order("created_at", { ascending: false }).limit(30);
    const { data: attention } = await client.from("fulfillment_orders").select("id, order_sn, status, last_error, user_id, created_at").in("status", ["needs_attention", "awaiting_funds"]).order("created_at", { ascending: false }).limit(100);
    return {
      suppliers: (data ?? []).map((row) => ({ id: String(row["id"]), slug: String(row["slug"]), name: String(row["name"]), whatsapp: (row["whatsapp"] as string | null) ?? null, email: (row["email"] as string | null) ?? null, pixKey: (row["pix_key"] as string | null) ?? null, pixKeyType: (row["pix_key_type"] as string | null) ?? null, autoPayout: Boolean(row["auto_payout"]), sources: (row["sources"] as string[]) ?? [], active: Boolean(row["active"]), hasPanel: Boolean(row["panel_token_hash"]), queued: counts.get(String(row["id"])) ?? 0 })),
      payouts: (payouts ?? []).map((row) => ({ id: String(row["id"]), supplierId: String(row["supplier_id"]), amount: Number(row["amount"]), orders: Number(row["order_count"]), day: String(row["payout_day"]), status: String(row["status"]), lastError: (row["last_error"] as string | null) ?? null })),
      payoutsEnabled: Boolean(process.env["ASAAS_API_KEY"]) && process.env["SUPPLIER_PAYOUTS"] !== "off",
      attention: (attention ?? []).map((row) => ({ id: String(row["id"]), orderSn: String(row["order_sn"]), status: String(row["status"]), lastError: (row["last_error"] as string | null) ?? null, userId: String(row["user_id"]), at: String(row["created_at"]) })),
    };
  });

/** Creates or updates a supplier. `rotateToken` returns a new panel link once (only its hash is kept). */
export const adminSaveSupplier = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: unknown) => z.object({
    id: z.string().uuid().optional(), slug: z.string().regex(/^[a-z0-9-]{2,40}$/), name: z.string().trim().min(2).max(80),
    whatsapp: z.string().max(20).optional(), email: z.string().email().max(120).optional().or(z.literal("")), pixKey: z.string().max(120).optional(),
    pixKeyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"]).nullable().optional(), autoPayout: z.boolean().optional(),
    sources: z.array(z.string().max(60)).max(20), active: z.boolean(), rotateToken: z.boolean().optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const { newPanelToken } = await import("@/lib/fulfillment.server");
    const { pixKeyInfo } = await import("@/lib/fulfillment");
    const pix = data.pixKey ? pixKeyInfo(data.pixKey) : null;
    if (data.pixKey && !pix) throw new Error("Chave PIX inválida. Use CPF, CNPJ, e-mail, celular com +55 ou chave aleatória.");
    if (data.autoPayout && !pix) throw new Error("Para o repasse automático, informe a chave PIX do fornecedor.");
    const token = data.rotateToken || !data.id ? newPanelToken() : null;
    const row = {
      slug: data.slug, name: data.name, whatsapp: data.whatsapp || null, email: data.email || null, pix_key: data.pixKeyType && data.pixKey ? data.pixKey.trim() : pix?.key ?? null, pix_key_type: data.pixKeyType ?? pix?.type ?? null, auto_payout: Boolean(data.autoPayout),
      sources: data.sources, active: data.active, updated_at: new Date().toISOString(), ...(token ? { panel_token_hash: token.hash } : {}),
    };
    const client = await admin();
    const query = data.id ? client.from("suppliers").update(row).eq("id", data.id).select("id").single() : client.from("suppliers").insert(row).select("id").single();
    const { data: saved, error } = await query;
    if (error || !saved) throw new Error("Não foi possível salvar o fornecedor (o identificador pode já existir).");
    return { id: String(saved["id"]), panelToken: token?.raw ?? null };
  });

/* ------------------------------- PIX recharge ------------------------------- */

/** Creates a PIX charge (Asaas or Mercado Pago); the wallet is credited by itself when the payment is confirmed. */
export const createPixRecharge = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ amount: z.number(), document: z.string().max(20).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { isValidPixRecharge, normalizeCpfCnpj, PIX_RECHARGE_MAX_BRL, PIX_RECHARGE_MIN_BRL } = await import("@/lib/fulfillment");
    if (!isValidPixRecharge(data.amount)) throw new Error(`Escolha um valor entre R$ ${PIX_RECHARGE_MIN_BRL} e R$ ${PIX_RECHARGE_MAX_BRL}.`);
    const document = data.document ? normalizeCpfCnpj(data.document) : null;
    if (data.document && !document) throw new Error("CPF ou CNPJ inválido. Confira os números.");
    const client = await admin();
    const { data: user } = await client.auth.admin.getUserById(context.userId);
    const email = user?.user?.email;
    if (!email) throw new Error("Sua conta não tem e-mail cadastrado para o PIX.");
    const { createPixCharge, hasAsaasCustomer, pixProvider } = await import("@/lib/pix.server");
    const provider = pixProvider();
    if (!provider) throw new Error("A recarga por PIX ainda não está ativada. Fale com o suporte.");
    if (provider === "asaas" && !document && !(await hasAsaasCustomer(context.userId))) throw new Error("Informe seu CPF ou CNPJ para gerar o PIX.");
    const meta = (user?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const name = String(meta["full_name"] ?? meta["name"] ?? email.split("@")[0]).slice(0, 80);
    const { data: row, error } = await client.from("wallet_recharges").insert({ user_id: context.userId, amount: data.amount, provider }).select("id").single();
    if (error || !row) throw new Error("Não foi possível iniciar a recarga. Tente de novo.");
    try {
      const charge = await createPixCharge({ rechargeId: String(row["id"]), amount: data.amount, userId: context.userId, name, email, document, siteUrl: process.env["PUBLIC_SITE_URL"] ?? null });
      await client.from("wallet_recharges").update({ provider_payment_id: charge.paymentId, qr_code: charge.qrCode, qr_code_base64: charge.qrCodeBase64, ticket_url: charge.ticketUrl, updated_at: new Date().toISOString() }).eq("id", row["id"]);
      return { id: String(row["id"]), amount: data.amount, ...charge };
    } catch (failure) {
      await client.from("wallet_recharges").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", row["id"]);
      throw failure;
    }
  });

/** Polled by the recharge screen: settles the PIX as soon as the provider confirms it (backup for the webhook). */
export const checkPixRecharge = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const client = await admin();
    const { data: row } = await client.from("wallet_recharges").select("status, provider_payment_id").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!row) throw new Error("Recarga não encontrada.");
    if (row["status"] !== "pending" || !row["provider_payment_id"]) return { status: String(row["status"]) };
    const { settleRecharge } = await import("@/lib/pix.server");
    return settleRecharge(String(row["provider_payment_id"]));
  });

/** Admin: puts a failed supplier payout's orders back in the queue (after fixing the PIX key or checking Asaas). */
export const adminReleasePayout = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { releaseFailedPayout } = await import("@/lib/payouts.server");
    await releaseFailedPayout(data.id);
    return { ok: true };
  });

/* ----------------------------- Catalogue import ----------------------------- */

/**
 * Admin: imports a supplier spreadsheet (CSV) into the catalogue under that supplier. Rows are staged in
 * supplier_site_products with the supplier slug as source, then pas_sync_supplier_catalog creates or
 * refreshes the products (keyed by source + SKU, so re-importing updates instead of duplicating).
 */
export const adminImportCatalog = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: unknown) => z.object({ supplierId: z.string().uuid(), csv: z.string().min(10).max(12_000_000) }).parse(input))
  .handler(async ({ data }) => {
    const { readCatalog } = await import("@/lib/catalog-import");
    const parsed = readCatalog(data.csv);
    if (parsed.missingColumns.length) throw new Error(`A planilha precisa das colunas: ${parsed.missingColumns.join(", ")}.`);
    if (!parsed.rows.length) throw new Error("Nenhum produto válido na planilha.");
    if (parsed.rows.length > 20_000) throw new Error("Máximo de 20.000 produtos por planilha.");
    const client = await admin();
    const { data: supplier } = await client.from("suppliers").select("id, slug, sources").eq("id", data.supplierId).maybeSingle();
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
    if (!sources.includes(source)) await client.from("suppliers").update({ sources: [...sources, source], updated_at: now }).eq("id", data.supplierId);
    const result = (sync ?? {}) as { active?: number; hidden?: number };
    return {
      imported: parsed.rows.length,
      active: Number(result.active ?? 0),
      hidden: Number(result.hidden ?? 0),
      withoutImage: parsed.rows.filter((row) => !row.imageUrl).length,
      skipped: parsed.skipped.slice(0, 20),
      skippedCount: parsed.skipped.length,
    };
  });
