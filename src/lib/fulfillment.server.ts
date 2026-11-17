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
    ? await client.from("products").select("id, name, sku, supplier_id, supplier_source, supplier_cost, supplier_url").in("id", productIds)
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
  if (data === "paid") await alertAdminsNewOrder(fulfillmentId).catch(() => undefined);
  return data === "paid";
}

const panelBase = () => (process.env["PUBLIC_SITE_URL"] || "https://shopcenter.cloud").replace(/\/+$/, "");
const brl = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

/** E-mails the admins (FULFILLMENT_ALERT_EMAIL, comma separated) that a supplier must get a Pix before shipping. */
export async function alertAdminsNewOrder(fulfillmentId: string) {
  const to = (process.env["FULFILLMENT_ALERT_EMAIL"] ?? "").split(",");
  if (!to.some((item) => item.trim())) return;
  const client = await db();
  const { data: order } = await client.from("fulfillment_orders").select("order_sn, goods_cost, lines, supplier_id").eq("id", fulfillmentId).maybeSingle();
  if (!order?.["supplier_id"]) return;
  const { data: supplier } = await client.from("suppliers").select("name").eq("id", order["supplier_id"]).maybeSingle();
  const { sendMail, mailLayout, escapeHtml } = await import("@/lib/mail.server");
  const items = (order["lines"] as FulfillmentLine[]).map((line) => `<li>${line.quantity}x ${escapeHtml(line.name)}</li>`).join("");
  const name = escapeHtml(String(supplier?.["name"] ?? "fornecedor"));
  await sendMail(to, `Pagar ${supplier?.["name"] ?? "fornecedor"}: pedido ${order["order_sn"]} (${brl(Number(order["goods_cost"]))})`, mailLayout(
    "Pedido pago pelo aluno: falta o Pix do fornecedor",
    `<p>O pedido <b>${escapeHtml(String(order["order_sn"]))}</b> é de <b>${name}</b>. O aluno já pagou pela carteira.</p><ul>${items}</ul><p>Custo a pagar ao fornecedor: <b>${brl(Number(order["goods_cost"]))}</b>.</p><p>Abra <a href="${panelBase()}/admin/envios">Admin › Envio automático</a>, faça o Pix e clique em <b>Já paguei este Pix</b>. Só então o fornecedor consegue gerar a etiqueta.</p>`,
  ));
}

/** Admin: marks the listed orders (and credits) of one supplier as paid by Pix and tells the supplier by e-mail. */
export async function markSupplierPaid(supplierId: string, orderIds: string[], creditIds: string[], note: string | null) {
  const client = await db();
  const now = new Date().toISOString();
  const { data: paid } = orderIds.length
    ? await client.from("fulfillment_orders").update({ supplier_paid_at: now, supplier_paid_note: note, updated_at: now })
      .eq("supplier_id", supplierId).in("id", orderIds).eq("status", "queued").is("supplier_paid_at", null).select("id, order_sn, goods_cost")
    : { data: [] };
  if (creditIds.length) {
    await client.from("fulfillment_orders").update({ supplier_credit_at: now, updated_at: now })
      .eq("supplier_id", supplierId).in("id", creditIds).eq("status", "cancelled").not("supplier_paid_at", "is", null).is("supplier_credit_at", null);
  }
  const rows = paid ?? [];
  if (rows.length) {
    const { data: supplier } = await client.from("suppliers").select("name, email").eq("id", supplierId).maybeSingle();
    const email = supplier?.["email"] as string | null;
    if (email) {
      const { sendMail, mailLayout, escapeHtml } = await import("@/lib/mail.server");
      const total = rows.reduce((sum, row) => sum + Number(row["goods_cost"]), 0);
      const list = rows.map((row) => `<li>${escapeHtml(String(row["order_sn"]))} · ${brl(Number(row["goods_cost"]))}</li>`).join("");
      await sendMail([email], `Pix enviado: ${rows.length} pedido(s) liberado(s) para envio`, mailLayout(
        "Pix enviado, pode despachar",
        `<p>O Shop Center pagou ${brl(total)} referente aos pedidos abaixo:</p><ul>${list}</ul><p>Abra o seu painel de expedição (o link que você recebeu), clique em <b>Gerar etiqueta</b>, imprima, cole no pacote e poste num ponto de entrega. Depois clique em <b>Marcar como enviado</b>.</p>`,
      ));
    }
  }
  return { paid: rows.length };
}

export type SupplierPayable = {
  supplierId: string; name: string; pixKey: string | null; pixKeyType: string | null; whatsapp: string | null;
  orders: { id: string; orderSn: string; goodsCost: number; createdAt: string; lines: FulfillmentLine[] }[];
  credits: { id: string; orderSn: string; goodsCost: number }[];
  total: number;
};

/** What each supplier must receive by Pix now: paid-by-student orders not yet paid to the supplier, minus credits. */
export async function supplierPayables(): Promise<SupplierPayable[]> {
  const client = await db();
  const [{ data: orders }, { data: credits }, { data: suppliers }] = await Promise.all([
    client.from("fulfillment_orders").select("id, order_sn, goods_cost, created_at, lines, supplier_id").eq("status", "queued").is("supplier_paid_at", null).order("created_at").limit(500),
    // Cancelled after the supplier was paid and before shipping: discounted from the next Pix.
    client.from("fulfillment_orders").select("id, order_sn, goods_cost, supplier_id").eq("status", "cancelled").not("supplier_paid_at", "is", null).is("supplier_credit_at", null).is("shipped_at", null).limit(500),
    client.from("suppliers").select("id, name, pix_key, pix_key_type, whatsapp"),
  ]);
  const result = new Map<string, SupplierPayable>();
  const entry = (id: string) => {
    if (!result.has(id)) {
      const s = (suppliers ?? []).find((row) => String(row["id"]) === id);
      result.set(id, { supplierId: id, name: String(s?.["name"] ?? "fornecedor"), pixKey: (s?.["pix_key"] as string | null) ?? null, pixKeyType: (s?.["pix_key_type"] as string | null) ?? null, whatsapp: (s?.["whatsapp"] as string | null) ?? null, orders: [], credits: [], total: 0 });
    }
    return result.get(id)!;
  };
  for (const row of orders ?? []) {
    if (!row["supplier_id"]) continue;
    entry(String(row["supplier_id"])).orders.push({ id: String(row["id"]), orderSn: String(row["order_sn"]), goodsCost: Number(row["goods_cost"]), createdAt: String(row["created_at"]), lines: row["lines"] as FulfillmentLine[] });
  }
  for (const row of credits ?? []) {
    if (!row["supplier_id"]) continue;
    entry(String(row["supplier_id"])).credits.push({ id: String(row["id"]), orderSn: String(row["order_sn"]), goodsCost: Number(row["goods_cost"]) });
  }
  for (const item of result.values()) {
    const total = item.orders.reduce((sum, o) => sum + o.goodsCost, 0) - item.credits.reduce((sum, c) => sum + c.goodsCost, 0);
    item.total = Math.round(total * 100) / 100;
  }
  return [...result.values()].filter((item) => item.orders.length);
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
  // Envio bônus usado no pedido volta para o pacote (só uma vez).
  if (order) await client.rpc("fulfillment_bonus_return", { _id: fulfillmentId });
}

export type SupplierRow = { id: string; name: string; slug: string; whatsapp: string | null; user_id?: string | null };

export async function supplierByToken(token: string): Promise<SupplierRow> {
  if (!token || token.length < 20) throw new Error("Link do painel inválido.");
  const client = await db();
  const { data } = await client.from("suppliers").select("id, name, slug, whatsapp, active, user_id").eq("panel_token_hash", hashPanelToken(token)).maybeSingle();
  if (!data || !data["active"]) throw new Error("Link do painel inválido ou desativado. Peça um novo ao Shop Center.");
  return data as unknown as SupplierRow;
}

/** The active supplier whose Shop Center login is this user, if any. */
export async function supplierByUser(userId: string): Promise<SupplierRow | null> {
  const client = await db();
  const { data } = await client.from("suppliers").select("id, name, slug, whatsapp, active, user_id").eq("user_id", userId).eq("active", true).maybeSingle();
  return (data as unknown as SupplierRow | null) ?? null;
}

export async function linkSupplierUser(supplierId: string, userId: string) {
  const client = await db();
  const { data: other } = await client.from("suppliers").select("id").eq("user_id", userId).neq("id", supplierId).maybeSingle();
  if (other) throw new Error("Esta conta já está ligada a outro fornecedor.");
  const { error } = await client.from("suppliers").update({ user_id: userId, updated_at: new Date().toISOString() }).eq("id", supplierId);
  if (error) throw new Error("Não foi possível ligar a conta agora. Tente de novo.");
}

export type SupplierQueueItem = {
  id: string; orderSn: string; status: FulfillmentStatus; lines: FulfillmentLine[]; createdAt: string; labelDownloadedAt: string | null;
  trackingNumber: string | null; goodsCost: number; paidAt: string | null; shippedAt: string | null; credited: boolean;
};

/** Orders of the last 31 days that reached this supplier (paid by the student), for the panel and its daily numbers. */
export async function supplierQueue(supplierId: string): Promise<SupplierQueueItem[]> {
  const client = await db();
  const since = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await client.from("fulfillment_orders").select("id, order_sn, status, lines, created_at, label_downloaded_at, tracking_number, goods_cost, supplier_paid_at, supplier_credit_at, shipped_at")
    .eq("supplier_id", supplierId).in("status", ["queued", "shipped", "cancelled"]).gte("created_at", since).order("created_at", { ascending: true }).limit(1000);
  return (data ?? [])
    // A cancelled order matters to the supplier only when it had already been paid to them.
    .filter((row) => row["status"] !== "cancelled" || row["supplier_paid_at"])
    .map((row) => ({
      id: String(row["id"]), orderSn: String(row["order_sn"]), status: row["status"] as FulfillmentStatus, lines: row["lines"] as FulfillmentLine[],
      createdAt: String(row["created_at"]), labelDownloadedAt: (row["label_downloaded_at"] as string | null) ?? null, trackingNumber: (row["tracking_number"] as string | null) ?? null,
      goodsCost: Number(row["goods_cost"] ?? 0), paidAt: (row["supplier_paid_at"] as string | null) ?? null, shippedAt: (row["shipped_at"] as string | null) ?? null, credited: Boolean(row["supplier_credit_at"]),
    }));
}

/** Loads a queued order of this supplier with the seller and shop that own it. */
export async function supplierOrder(supplierId: string, fulfillmentId: string) {
  const client = await db();
  const { data } = await client.from("fulfillment_orders").select("id, user_id, connection_id, order_sn, status, supplier_paid_at").eq("id", fulfillmentId).eq("supplier_id", supplierId).maybeSingle();
  if (!data) throw new Error("Pedido não encontrado no seu painel.");
  return data as { id: string; user_id: string; connection_id: string; order_sn: string; status: FulfillmentStatus; supplier_paid_at: string | null };
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
