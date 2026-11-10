import { expect, test } from "bun:test";
import { SalesHistoryStore, HISTORY_SEED, type HistoryProduct } from "../src/lib/sales-history";
import { demoShopeeOrders } from "../src/lib/shopee-demo";
const products: HistoryProduct[] = [{ id: "demo-product", name: "Produto exemplo", image: null, price: 50, commission: 20 }];
test("proprietário e parceiro recebem resultados demonstrativos iguais", () => {
  const owner = new SalesHistoryStore(products, HISTORY_SEED).eventsForDay("2026-01-02");
  const partner = new SalesHistoryStore(products, HISTORY_SEED).eventsForDay("2026-01-02");
  expect(owner.length).toBeGreaterThan(0);
  expect(demoShopeeOrders(owner)).toEqual(demoShopeeOrders(partner));
});
test("demonstração exclui pedidos reais e compradores", () => {
  const first = new SalesHistoryStore(products, HISTORY_SEED).eventsForDay("2026-01-02")[0];
  if (!first) throw new Error("Missing fixture");
  const real = { ...first, id: "private-order", source: "shopee", buyer: "private-buyer" };
  const rows = demoShopeeOrders([first, real as unknown as typeof first]);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.id).toBe(first.id);
  expect(JSON.stringify(rows)).not.toContain("private-buyer");
  expect(JSON.stringify(rows)).not.toContain("private-order");
});
