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
      client.from("seller_wallets").select("balance, credit_limit").eq("user_id", context.userId).maybeSingle(),
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
      pixAutomatic: Boolean(process.env["MP_ACCESS_TOKEN"]),
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
    const { data } = await client.from("suppliers").select("id, slug, name, whatsapp, email, pix_key, sources, active, panel_token_hash").order("name");
    const { data: queued } = await client.from("fulfillment_orders").select("supplier_id, status").in("status", ["queued", "needs_attention", "awaiting_funds"]);
    const counts = new Map<string, number>();
    for (const row of queued ?? []) if (row["status"] === "queued" && row["supplier_id"]) counts.set(String(row["supplier_id"]), (counts.get(String(row["supplier_id"])) ?? 0) + 1);
    const { data: attention } = await client.from("fulfillment_orders").select("id, order_sn, status, last_error, user_id, created_at").in("status", ["needs_attention", "awaiting_funds"]).order("created_at", { ascending: false }).limit(100);
    return {
      suppliers: (data ?? []).map((row) => ({ id: String(row["id"]), slug: String(row["slug"]), name: String(row["name"]), whatsapp: (row["whatsapp"] as string | null) ?? null, email: (row["email"] as string | null) ?? null, pixKey: (row["pix_key"] as string | null) ?? null, sources: (row["sources"] as string[]) ?? [], active: Boolean(row["active"]), hasPanel: Boolean(row["panel_token_hash"]), queued: counts.get(String(row["id"])) ?? 0 })),
      attention: (attention ?? []).map((row) => ({ id: String(row["id"]), orderSn: String(row["order_sn"]), status: String(row["status"]), lastError: (row["last_error"] as string | null) ?? null, userId: String(row["user_id"]), at: String(row["created_at"]) })),
    };
  });

/** Creates or updates a supplier. `rotateToken` returns a new panel link once (only its hash is kept). */
export const adminSaveSupplier = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: unknown) => z.object({
    id: z.string().uuid().optional(), slug: z.string().regex(/^[a-z0-9-]{2,40}$/), name: z.string().trim().min(2).max(80),
    whatsapp: z.string().max(20).optional(), email: z.string().email().max(120).optional().or(z.literal("")), pixKey: z.string().max(120).optional(),
    sources: z.array(z.string().max(60)).max(20), active: z.boolean(), rotateToken: z.boolean().optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const { newPanelToken } = await import("@/lib/fulfillment.server");
    const token = data.rotateToken || !data.id ? newPanelToken() : null;
    const row = {
      slug: data.slug, name: data.name, whatsapp: data.whatsapp || null, email: data.email || null, pix_key: data.pixKey || null,
      sources: data.sources, active: data.active, updated_at: new Date().toISOString(), ...(token ? { panel_token_hash: token.hash } : {}),
    };
    const client = await admin();
    const query = data.id ? client.from("suppliers").update(row).eq("id", data.id).select("id").single() : client.from("suppliers").insert(row).select("id").single();
    const { data: saved, error } = await query;
    if (error || !saved) throw new Error("Não foi possível salvar o fornecedor (o identificador pode já existir).");
    return { id: String(saved["id"]), panelToken: token?.raw ?? null };
  });

/* ------------------------------- PIX recharge ------------------------------- */

/** Creates a PIX charge; the wallet is credited by itself when Mercado Pago confirms it. */
export const createPixRecharge = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator((input: unknown) => z.object({ amount: z.number() }).parse(input))
  .handler(async ({ data, context }) => {
    const { isValidPixRecharge, PIX_RECHARGE_MAX_BRL, PIX_RECHARGE_MIN_BRL } = await import("@/lib/fulfillment");
    if (!isValidPixRecharge(data.amount)) throw new Error(`Escolha um valor entre R$ ${PIX_RECHARGE_MIN_BRL} e R$ ${PIX_RECHARGE_MAX_BRL}.`);
    const client = await admin();
    const { data: user } = await client.auth.admin.getUserById(context.userId);
    const email = user?.user?.email;
    if (!email) throw new Error("Sua conta não tem e-mail cadastrado para o PIX.");
    const { data: row, error } = await client.from("wallet_recharges").insert({ user_id: context.userId, amount: data.amount }).select("id").single();
    if (error || !row) throw new Error("Não foi possível iniciar a recarga. Tente de novo.");
    const { createPixCharge } = await import("@/lib/pix.server");
    const base = process.env["PUBLIC_SITE_URL"];
    try {
      const charge = await createPixCharge({ rechargeId: String(row["id"]), amount: data.amount, email, notificationUrl: base ? `${base.replace(/\/$/, "")}/api/public/pagamentos/mercadopago` : null });
      await client.from("wallet_recharges").update({ provider_payment_id: charge.paymentId, qr_code: charge.qrCode, qr_code_base64: charge.qrCodeBase64, ticket_url: charge.ticketUrl, updated_at: new Date().toISOString() }).eq("id", row["id"]);
      return { id: String(row["id"]), amount: data.amount, ...charge };
    } catch (failure) {
      await client.from("wallet_recharges").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", row["id"]);
      throw failure;
    }
  });

/** Polled by the recharge screen: settles the PIX as soon as Mercado Pago confirms it (backup for the webhook). */
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
