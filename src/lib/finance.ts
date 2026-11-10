/** Promotion fee charged per paid sale of a promoted listing (owner decision). */
export const PROMOTION_FEE_BRL = 2;
/** Recharge limits in the Financeiro tab (owner decision). */
export const RECHARGE_MIN_BRL = 50;
export const RECHARGE_MAX_BRL = 500;

/** Shopee order states that count as a sale. */
const PAID_STATUSES = new Set(["READY_TO_SHIP", "PROCESSED", "SHIPPED", "TO_CONFIRM_RECEIVE", "COMPLETED"]);

export function isValidRecharge(amount: number) {
  return Number.isFinite(amount) && amount >= RECHARGE_MIN_BRL && amount <= RECHARGE_MAX_BRL;
}

export type PromotedListing = { shopee_item_id: number | null; promoted: boolean; promoted_at: string | null; title: string };
export type FinanceOrder = { order_sn: string; status: string; items: unknown; created_time: string | null };
export type PromotionCharge = { orderSn: string; itemName: string; at: string; amount: number };

/** One fee per order line of a promoted item, only for sales made after the promotion was turned on. */
export function promotionCharges(listings: PromotedListing[], orders: FinanceOrder[]): PromotionCharge[] {
  const since = new Map<string, number>();
  for (const listing of listings) {
    if (!listing.promoted || !listing.promoted_at || !listing.shopee_item_id) continue;
    since.set(String(listing.shopee_item_id), new Date(listing.promoted_at).getTime());
  }
  const charges: PromotionCharge[] = [];
  for (const order of orders) {
    if (!PAID_STATUSES.has(order.status) || !order.created_time) continue;
    const at = new Date(order.created_time).getTime();
    const items = Array.isArray(order.items) ? (order.items as Record<string, unknown>[]) : [];
    for (const item of items) {
      const start = since.get(String(Math.round(Number(item["item_id"] ?? 0))));
      if (start === undefined || at < start) continue;
      charges.push({ orderSn: order.order_sn, itemName: String(item["item_name"] ?? "Produto"), at: order.created_time, amount: PROMOTION_FEE_BRL });
    }
  }
  return charges.sort((a, b) => b.at.localeCompare(a.at));
}
