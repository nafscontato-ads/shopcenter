import { expect, test } from "bun:test";
import { SalesHistoryStore, HISTORY_SEED, type HistoryProduct } from "../src/lib/sales-history";
import { demoShopOrders } from "../src/lib/shopee-demo";

const products: HistoryProduct[] = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `Produto ${i}`, image: null, price: 30 + i, commission: 10 }));
const days = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-10", "2026-09-20", "2026-10-01"];

test("loja de demonstração tem entre 40 e 50 pedidos por dia completo", () => {
  const store = new SalesHistoryStore(products, HISTORY_SEED);
  for (const day of days) {
    const count = demoShopOrders(store.eventsForDay(day), Date.parse("2026-10-30T12:00:00-03:00")).length;
    expect(count).toBeGreaterThanOrEqual(40);
    expect(count).toBeLessThanOrEqual(50);
  }
});

test("pedidos antigos ficam quase todos concluídos e os recentes pendentes", () => {
  const store = new SalesHistoryStore(products, HISTORY_SEED);
  const old = demoShopOrders(store.eventsForDay("2026-09-01"), Date.parse("2026-10-30T12:00:00-03:00"));
  const completed = old.filter((order) => order.status === "COMPLETED").length;
  expect(completed / old.length).toBeGreaterThan(0.9);
  const recent = demoShopOrders(store.eventsForDay("2026-09-01"), Date.parse("2026-09-01T23:59:59-03:00"));
  expect(recent.some((order) => ["UNPAID", "READY_TO_SHIP", "PROCESSED"].includes(order.status))).toBe(true);
});

test("pedidos de demonstração nunca incluem compradores nem pedidos reais", () => {
  const store = new SalesHistoryStore(products, HISTORY_SEED);
  const first = store.eventsForDay("2026-09-01")[0]!;
  const real = { ...first, id: "private-order-1", source: "shopee", buyer: "private-buyer" };
  const rows = demoShopOrders([first, real as unknown as typeof first]);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.buyer_label).toBeNull();
  expect(JSON.stringify(rows)).not.toContain("private-buyer");
});
