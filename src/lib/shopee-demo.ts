import type { SalesEvent } from "@/lib/sales-history";
/** Shared reports accept synthetic events only, never real orders or buyers. */
export function demoShopeeOrders(events: SalesEvent[]) {
  return events.filter((event) => event.source === "simulation").map((event) => ({ id: event.id, code: event.id.toUpperCase(), productId: event.productId, product: event.productName, quantity: event.quantity, total: event.gross, at: event.at }));
}

export type DemoShopOrder = {
  id: string;
  order_sn: string;
  status: string;
  total_amount: number;
  currency: "BRL";
  buyer_label: null;
  items: [];
  created_time: string;
  synced_at: string;
  productId: string;
  productName: string;
  productImage: string | null;
  quantity: number;
  demo: true;
};

/** Average number of synthetic history events per day (one sale every 5 s – 10 min). */
const EST_DAY_EVENTS = 286;
const DAILY_MIN = 43;
const DAILY_SPREAD = 7; // 43–49 target, capped → 40–49 orders per full day

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function dailyDemoOrderTarget(dayKey: string) {
  return DAILY_MIN + (hash(`orders:${dayKey}`) % DAILY_SPREAD);
}

/** Status follows the order's age: recent ones are pending/ready, older ones are almost all completed. */
export function demoOrderStatus(ageHours: number, roll: number) {
  if (ageHours < 3) return roll < 30 ? "UNPAID" : "READY_TO_SHIP";
  if (ageHours < 24) return roll < 45 ? "READY_TO_SHIP" : roll < 70 ? "PROCESSED" : "SHIPPED";
  if (roll < 3) return "CANCELLED";
  if (ageHours < 72) return roll < 55 ? "SHIPPED" : roll < 80 ? "TO_CONFIRM_RECEIVE" : "COMPLETED";
  if (ageHours < 144) return roll < 25 ? "TO_CONFIRM_RECEIVE" : "COMPLETED";
  return "COMPLETED";
}

const SN_CHARS = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function orderSn(dayKey: string, id: string) {
  let h = hash(`sn:${id}`);
  let h2 = hash(`sn2:${id}`);
  let tail = "";
  for (let i = 0; i < 8; i++) {
    const source = i < 4 ? h : h2;
    tail += SN_CHARS[source % SN_CHARS.length];
    if (i < 4) h = Math.floor(h / SN_CHARS.length); else h2 = Math.floor(h2 / SN_CHARS.length);
  }
  return `${dayKey.slice(2, 4)}${dayKey.slice(5, 7)}${dayKey.slice(8, 10)}${tail}`;
}

/**
 * Demonstration shop orders: a stable 40–49 per day picked from the synthetic history (never real orders or buyers).
 * Today's list grows as the day goes on and never reshuffles, because picks depend only on each event's slot.
 */
export function demoShopOrders(events: SalesEvent[], now = Date.now(), priceOf?: (productId: string) => number | undefined): DemoShopOrder[] {
  const picked = new Map<string, SalesEvent>();
  const bucketGross = new Map<string, number>();
  for (const event of events) {
    if (event.source !== "simulation") continue;
    const index = Number(/-(\d+)$/.exec(event.id)?.[1] ?? Number.NaN);
    if (!Number.isFinite(index)) continue;
    const target = dailyDemoOrderTarget(event.dateKey);
    const bucket = Math.floor((index * target) / EST_DAY_EVENTS);
    if (bucket >= target) continue;
    const key = `${event.dateKey}:${bucket}`;
    bucketGross.set(key, (bucketGross.get(key) ?? 0) + event.gross);
    const current = picked.get(key);
    if (!current || current.at > event.at) picked.set(key, event);
  }
  const orders: DemoShopOrder[] = [];
  for (const [key, event] of picked) {
    const quantity = hash(`qty:${event.id}`) % 100 < 15 ? 2 : 1;
    const unit = priceOf?.(event.productId);
    const total = unit && unit > 0 ? unit * quantity : bucketGross.get(key) ?? event.gross;
    const ageHours = Math.max(0, (now - new Date(event.at).getTime()) / 3_600_000);
    orders.push({
      id: `demo-${event.id}`,
      order_sn: orderSn(event.dateKey, event.id),
      status: demoOrderStatus(ageHours, hash(`status:${event.id}`) % 100),
      total_amount: Math.round(total * 100) / 100,
      currency: "BRL",
      buyer_label: null,
      items: [],
      created_time: event.at,
      synced_at: event.at,
      productId: event.productId,
      productName: event.productName,
      productImage: event.productImage,
      quantity,
      demo: true,
    });
  }
  return orders.sort((a, b) => b.created_time.localeCompare(a.created_time));
}

/**
 * One simulated Minipreço sale kept at the top of the demonstration shop (owner request),
 * always "pronto para envio" so the supplier buy link and WhatsApp button can be tried.
 */
export function miniprecoDemoOrder(product: { id: string; name: string; image: string | null; price: number; promoPrice?: number | null }, now = Date.now()): DemoShopOrder {
  const at = new Date(now - 7 * 60_000).toISOString();
  return {
    id: "demo-minipreco-pinned",
    order_sn: "2611039MPRC01",
    status: "READY_TO_SHIP",
    total_amount: Math.round((product.promoPrice ?? product.price) * 100) / 100,
    currency: "BRL",
    buyer_label: null,
    items: [],
    created_time: at,
    synced_at: at,
    productId: product.id,
    productName: product.name,
    productImage: product.image,
    quantity: 1,
    demo: true,
  };
}
