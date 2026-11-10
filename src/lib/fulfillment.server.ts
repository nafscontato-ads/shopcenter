import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CANCELLED_STATUSES,
  SHIPPABLE_STATUSES,
  planFulfillment,
  reactToShopeeStatus,
  resolveLines,
  type FulfillmentLine,
  type FulfillmentStatus,
  type ListingLink,
  type ProductLink,
  type ShopeeOrderItem,
  type SupplierLink,
} from "@/lib/fulfillment";

/** The new fulfillment tables are not in the generated types yet; use an untyped admin client. */
async function db(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export type ShopeeOrderDetail = { order_sn: string; order_status: string; item_list: ShopeeOrderItem[] };

export function hashPanelToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newPanelToken() {
  const raw = randomBytes(24).toString("base64url");
  return { raw, hash: hashPanelToken(raw) };
}

/** Books a wallet movement; returns the new balance or null when a debit passes the credit limit. */
export async function bookWallet(userId: string, amount: number, kind: "recharge" | "order_debit" | "order_refund" | "adjustment", reference: string | null, note: string | null, actor: string | null) {
  const client = await db();
  const { data, error } = await client.rpc("wallet_book", { _user: userId, _amount: amount, _kind: kind, _reference: reference, _note: note, _actor: actor });
  if (error) throw new Error("Não foi possível movimentar a carteira. Tente de novo.");
  return data == null ? null : Number(data);
}

/**
 * Registers paid orders of one shop for fulfillment and reacts to status changes of known ones.
 * Safe to call repeatedly with the same orders (sync, cron and Shopee push all call it).
 */
export async function ingestOrders(userId: string, connectionId: string, orders: ShopeeOrderDetail[]) {
  if (!orders.length) return { created: 0, updated: 0 };
  const client = await db();
  const { data: connection } = await client.from("shopee_shop_connections").select("auto_fulfillment").eq("id", connectionId).eq("user_id", userId).maybeSingle();
  const auto = Boolean(connection?.["auto_fulfillment"]);

  const sns = orders.map((order) => order.order_sn);
  const { data: existingRows } = await client.from("fulfillment_orders").select("id, order_sn, status").eq("connection_id", connectionId).in("order_sn", sns);
  const existing = new Map((existingRows ?? []).map((row) => [String(row["order_sn"]), row as { id: string; status: FulfillmentStatus }]));

  let updated = 0;
  for (const order of orders) {
    const known = existing.get(order.order_sn);
    if (!known) continue;
    const next = reactToShopeeStatus(known.status, order.order_status);
    if (!next) continue;
    if (next.refund) await refundOrder(userId, known.id);
    await client.from("fulfillment_orders").update({ status: next.status, shopee_status: order.order_status, ...(next.status === "shipped" ? { shipped_at: new Date().toISOString() } : {}), updated_at: new Date().toISOString() }).eq("id", known.id);
    updated += 1;
  }

  if (!auto) return { created: 0, updated };
  const fresh = orders.filter((order) => !existing.has(order.order_sn) && SHIPPABLE_STATUSES.has(order.order_status));
  if (!fresh.length) return { created: 0, updated };

  const itemIds = [...new Set(fresh.flatMap((order) => order.item_list.map((item) => Math.round(Number(item.item_id ?? 0)))).filter(Boolean))];
  const { data: listings } = await client.from("shopee_listings").select("shopee_item_id, product_id").eq("user_id", userId).in("shopee_item_id", itemIds);
  const productIds = [...new Set((listings ?? []).map((row) => String(row["product_id"])))];
  const { data: products } = productIds.length
    ? await client.from("products").select("id, name, supplier_id, supplier_source, supplier_cost, supplier_url").in("id", productIds)
    : { data: [] };
  const { data: suppliers } = await client.from("suppliers").select("id, sources, active");

  let created = 0;
  for (const order of fresh) {
    const lines = resolveLines(order.item_list, (listings ?? []) as ListingLink[], (products ?? []) as ProductLink[], (suppliers ?? []) as SupplierLink[]);
    const plan = planFulfillment(lines);
    const row = {
      user_id: userId,
      connection_id: connectionId,
      order_sn: order.order_sn,
      shopee_status: order.order_status,
      lines,
      supplier_id: plan.status === "ready" ? plan.supplierId : null,
      goods_cost: plan.status === "ready" ? plan.goodsCost : 0,
      platform_fee: plan.status === "ready" ? plan.fee : 0,
      status: plan.status === "ready" ? "awaiting_funds" : plan.status,
      last_error: plan.status === "ready" ? null : plan.reason,
    };
    const { data: inserted, error } = await client.from("fulfillment_orders").upsert(row, { onConflict: "connection_id,order_sn", ignoreDuplicates: true }).select("id").maybeSingle();
    if (error || !inserted) continue;
    created += 1;
    if (plan.status === "ready") await fundOrder(userId, String(inserted["id"]));
  }
  return { created, updated };
}

/** Debits one waiting order. Returns true when it was paid and handed to the supplier. */
export async function fundOrder(userId: string, fulfillmentId: string) {
  const client = await db();
  const { data: owned } = await client.from("fulfillment_orders").select("id").eq("id", fulfillmentId).eq("user_id", userId).maybeSingle();
  if (!owned) return false;
  // Lock, debit and status change happen in one SQL transaction (fulfillment_debit).
  const { data, error } = await client.rpc("fulfillment_debit", { _id: fulfillmentId });
  if (error) throw new Error("Não foi possível pagar o pedido com a carteira. Tente de novo.");
  return data === "paid";
}

/**
 * Raises the automatic credit limit as the seller's delivered orders grow (never lowers it, so a
 * negative balance always stays inside the limit). An admin override replaces the automatic value.
 */
export async function refreshCreditLimit(userId: string) {
  const client = await db();
  const { reputationCredit } = await import("@/lib/fulfillment");
  const { count } = await client.from("fulfillment_orders").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "shipped");
  const credit = reputationCredit(count ?? 0);
  await client.from("seller_wallets").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  await client.from("seller_wallets").update({ credit_limit: credit, updated_at: new Date().toISOString() }).eq("user_id", userId).is("credit_override", null).lt("credit_limit", credit);
  return { shipped: count ?? 0, credit };
}

/** Tries to pay every waiting order of a seller, oldest first (after a recharge). */
export async function fundWaitingOrders(userId: string) {
  await refreshCreditLimit(userId);
  const client = await db();
  const { data } = await client.from("fulfillment_orders").select("id").eq("user_id", userId).eq("status", "awaiting_funds").order("created_at", { ascending: true }).limit(200);
  let paid = 0;
  for (const row of data ?? []) {
    if (await fundOrder(userId, String(row["id"]))) paid += 1;
    else break;
  }
  return paid;
}

export async function refundOrder(userId: string, fulfillmentId: string) {
  const client = await db();
  const { data: order } = await client.from("fulfillment_orders").select("order_sn, debited_amount").eq("id", fulfillmentId).eq("user_id", userId).maybeSingle();
  const amount = Number(order?.["debited_amount"] ?? 0);
  if (amount > 0) await bookWallet(userId, amount, "order_refund", `fulfillment:${fulfillmentId}`, `Estorno ${order?.["order_sn"]}`, null);
}

export type SupplierRow = { id: string; name: string; slug: string; whatsapp: string | null };

export async function supplierByToken(token: string): Promise<SupplierRow> {
  if (!token || token.length < 20) throw new Error("Link do painel inválido.");
  const client = await db();
  const { data } = await client.from("suppliers").select("id, name, slug, whatsapp, active").eq("panel_token_hash", hashPanelToken(token)).maybeSingle();
  if (!data || !data["active"]) throw new Error("Link do painel inválido ou desativado. Peça um novo ao Shop Center.");
  return data as unknown as SupplierRow;
}

export type SupplierQueueItem = { id: string; orderSn: string; status: FulfillmentStatus; lines: FulfillmentLine[]; createdAt: string; labelDownloadedAt: string | null; trackingNumber: string | null };

export async function supplierQueue(supplierId: string): Promise<SupplierQueueItem[]> {
  const client = await db();
  const since = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await client.from("fulfillment_orders").select("id, order_sn, status, lines, created_at, label_downloaded_at, tracking_number")
    .eq("supplier_id", supplierId).in("status", ["queued", "shipped"]).gte("created_at", since).order("created_at", { ascending: true }).limit(300);
  return (data ?? []).map((row) => ({
    id: String(row["id"]), orderSn: String(row["order_sn"]), status: row["status"] as FulfillmentStatus, lines: row["lines"] as FulfillmentLine[],
    createdAt: String(row["created_at"]), labelDownloadedAt: (row["label_downloaded_at"] as string | null) ?? null, trackingNumber: (row["tracking_number"] as string | null) ?? null,
  }));
}

/** Loads a queued order of this supplier with the seller and shop that own it. */
export async function supplierOrder(supplierId: string, fulfillmentId: string) {
  const client = await db();
  const { data } = await client.from("fulfillment_orders").select("id, user_id, connection_id, order_sn, status").eq("id", fulfillmentId).eq("supplier_id", supplierId).maybeSingle();
  if (!data) throw new Error("Pedido não encontrado no seu painel.");
  return data as { id: string; user_id: string; connection_id: string; order_sn: string; status: FulfillmentStatus };
}

export async function markLabel(fulfillmentId: string, trackingNumber: string) {
  const client = await db();
  await client.from("fulfillment_orders").update({ label_downloaded_at: new Date().toISOString(), tracking_number: trackingNumber, updated_at: new Date().toISOString() }).eq("id", fulfillmentId);
}

export async function markShipped(fulfillmentId: string) {
  const client = await db();
  const { data } = await client.from("fulfillment_orders").update({ status: "shipped", shipped_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", fulfillmentId).eq("status", "queued").select("id, user_id").maybeSingle();
  if (data) await refreshCreditLimit(String(data["user_id"]));
  return Boolean(data);
}

export function isCancelledStatus(status: string) {
  return CANCELLED_STATUSES.has(status);
}
