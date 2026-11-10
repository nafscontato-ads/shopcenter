import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ShopeeOrderDetail } from "@/lib/fulfillment.server";

async function db(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

function toDetail(order: Record<string, unknown>): ShopeeOrderDetail {
  return { order_sn: String(order["order_sn"]), order_status: String(order["order_status"] ?? ""), item_list: Array.isArray(order["item_list"]) ? order["item_list"] : [] };
}

/** Fetches details of the given orders of one shop, saves them in shopee_orders and ingests them. */
async function pullOrders(userId: string, connectionId: string, orderSns: string[]) {
  if (!orderSns.length) return { created: 0, updated: 0 };
  const { withFreshConnection } = await import("@/lib/shopee.functions");
  const shopee = await import("@/lib/shopee.server");
  const { ingestOrders } = await import("@/lib/fulfillment.server");
  const client = await db();
  const details: Record<string, unknown>[] = [];
  await withFreshConnection(userId, connectionId, async (connection) => {
    const credentials = { shopId: Number(connection.shop_id), accessToken: connection.access_token };
    for (let index = 0; index < orderSns.length; index += 50) {
      const result = await shopee.getShopeeOrderDetails(credentials, orderSns.slice(index, index + 50));
      const list = (result["response"] as Record<string, unknown> | undefined)?.["order_list"];
      if (Array.isArray(list)) details.push(...(list as Record<string, unknown>[]));
    }
  });
  if (details.length) {
    await client.from("shopee_orders").upsert(details.map((order) => ({
      user_id: userId, connection_id: connectionId, order_sn: String(order["order_sn"]), status: String(order["order_status"] ?? "UNKNOWN"),
      total_amount: Number(order["total_amount"] ?? 0), currency: String(order["currency"] ?? "BRL"), buyer_label: order["buyer_username"] ? String(order["buyer_username"]) : null,
      items: Array.isArray(order["item_list"]) ? order["item_list"] : [], created_time: order["create_time"] ? new Date(Number(order["create_time"]) * 1000).toISOString() : null,
      updated_time: order["update_time"] ? new Date(Number(order["update_time"]) * 1000).toISOString() : null, synced_at: new Date().toISOString(),
    })), { onConflict: "connection_id,order_sn" });
  }
  return ingestOrders(userId, connectionId, details.map(toDetail));
}

/**
 * One pass of the fulfillment worker: for every shop with automatic fulfillment on, read the
 * orders of the last 3 days from Shopee and ingest them; then retry funding waiting orders.
 * Called by a cron (VPS crontab or any scheduler) every 5 minutes.
 */
export async function runFulfillmentTick(maxShops = 50) {
  const client = await db();
  const { data: shops } = await client.from("shopee_shop_connections").select("id, user_id").eq("status", "active").eq("auto_fulfillment", true).order("last_synced_at", { ascending: true, nullsFirst: true }).limit(maxShops);
  const shopee = await import("@/lib/shopee.server");
  const { withFreshConnection } = await import("@/lib/shopee.functions");
  const { fundWaitingOrders } = await import("@/lib/fulfillment.server");
  const now = Math.floor(Date.now() / 1000);
  const report: Array<{ connectionId: string; orders: number; created: number; updated: number; incomplete?: boolean; error?: string }> = [];
  for (const shop of shops ?? []) {
    const userId = String(shop["user_id"]);
    const connectionId = String(shop["id"]);
    try {
      const sns: string[] = [];
      let incomplete = false;
      await withFreshConnection(userId, connectionId, async (connection) => {
        const credentials = { shopId: Number(connection.shop_id), accessToken: connection.access_token };
        let cursor = "";
        // Page until Shopee says there is no more (500 pages = 25k orders in 3 days is the safety stop).
        for (let page = 0; ; page += 1) {
          const result = await shopee.getShopeeOrderList(credentials, now - 3 * 24 * 60 * 60, now, cursor);
          const response = result["response"] as Record<string, unknown> | undefined;
          for (const item of Array.isArray(response?.["order_list"]) ? (response["order_list"] as Record<string, unknown>[]) : []) sns.push(String(item["order_sn"]));
          const next = String(response?.["next_cursor"] ?? "");
          if (!response?.["more"]) break;
          if (!next || next === cursor || page >= 499) { incomplete = true; break; }
          cursor = next;
        }
      });
      const result = await pullOrders(userId, connectionId, [...new Set(sns)]);
      await fundWaitingOrders(userId);
      await client.from("shopee_shop_connections").update({ last_synced_at: new Date().toISOString() }).eq("id", connectionId);
      if (incomplete) console.warn("fulfillment tick: order list incomplete", connectionId);
      report.push({ connectionId, orders: sns.length, ...result, ...(incomplete ? { incomplete } : {}) });
    } catch (error) {
      report.push({ connectionId, orders: 0, created: 0, updated: 0, error: error instanceof Error ? error.message : "erro" });
    }
  }
  return report;
}

/** Shopee push signature: HMAC-SHA256(partner_key, `${url}|${body}`) in the Authorization header. */
export function validShopeePush(url: string, body: string, authorization: string, partnerKey: string) {
  if (!authorization || !partnerKey) return false;
  const expected = Buffer.from(createHmac("sha256", partnerKey).update(`${url}|${body}`).digest("hex"));
  const actual = Buffer.from(authorization.trim());
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Order status push (code 3): pull that order right away instead of waiting for the cron. */
export async function handleShopeePush(payload: Record<string, unknown>) {
  if (Number(payload["code"]) !== 3) return { ignored: true };
  const shopId = Number(payload["shop_id"]);
  const data = (payload["data"] ?? {}) as Record<string, unknown>;
  const orderSn = String(data["ordersn"] ?? data["order_sn"] ?? "");
  if (!shopId || !orderSn) return { ignored: true };
  const client = await db();
  const { data: shop } = await client.from("shopee_shop_connections").select("id, user_id").eq("shop_id", shopId).eq("status", "active").eq("auto_fulfillment", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!shop) return { ignored: true };
  return pullOrders(String(shop["user_id"]), String(shop["id"]), [orderSn]);
}
