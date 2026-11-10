import { createServerFn } from "@tanstack/react-start";

import { requireActiveUser } from "@/lib/access-control";
import { promotionCharges } from "@/lib/finance";

/** Balance and statement for the Financeiro tab. Recharges are not collected yet, so none are credited. */
export const getFinanceSummary = createServerFn({ method: "GET" })
  .middleware([requireActiveUser])
  .handler(async ({ context }) => {
    const [{ data: listings, error: listingsError }, { data: orders, error: ordersError }] = await Promise.all([
      context.supabase.from("shopee_listings").select("shopee_item_id, promoted, promoted_at, title").eq("user_id", context.userId).eq("promoted", true),
      context.supabase.from("shopee_orders").select("order_sn, status, items, created_time").eq("user_id", context.userId).order("created_time", { ascending: false }).limit(1000),
    ]);
    if (listingsError) throw new Error(listingsError.message);
    if (ordersError) throw new Error(ordersError.message);
    const charges = promotionCharges(listings ?? [], orders ?? []);
    const totalCharges = charges.reduce((sum, charge) => sum + charge.amount, 0);
    const recharged = 0;
    return { recharged, totalCharges, balance: recharged - totalCharges, promotedListings: (listings ?? []).length, charges: charges.slice(0, 200) };
  });
