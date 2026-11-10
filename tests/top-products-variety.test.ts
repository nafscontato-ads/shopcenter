import { expect, test } from "bun:test";
import { TOP_PRODUCTS_COUNT, topProductIds, topProductsSeed } from "../src/lib/catalog-sorts";

const products = Array.from({ length: 2000 }, (_, i) => ({
  id: `p${i}`,
  score: i % 100,
  image: `https://img.test/${i}.jpg`,
  images: Array.from({ length: i % 3 === 0 ? 5 : 1 }, (_, k) => `https://img.test/${i}-${k}.jpg`),
}));

test("cada cliente recebe 50 top produtos diferentes", () => {
  const a = topProductIds(products, topProductsSeed("cliente-a", new Date("2026-10-30T15:00:00Z")));
  const b = topProductIds(products, topProductsSeed("cliente-b", new Date("2026-10-30T15:00:00Z")));
  expect(a.size).toBe(TOP_PRODUCTS_COUNT);
  expect(b.size).toBe(TOP_PRODUCTS_COUNT);
  const shared = [...a].filter((id) => b.has(id)).length;
  expect(shared).toBeLessThan(10);
});

test("a lista do mesmo cliente fica igual no mesmo dia e muda no dia seguinte", () => {
  const morning = topProductIds(products, topProductsSeed("cliente-a", new Date("2026-10-30T12:00:00Z")));
  const evening = topProductIds(products, topProductsSeed("cliente-a", new Date("2026-10-30T22:00:00Z")));
  const tomorrow = topProductIds(products, topProductsSeed("cliente-a", new Date("2026-10-31T12:00:00Z")));
  expect([...morning]).toEqual([...evening]);
  expect([...morning].filter((id) => tomorrow.has(id)).length).toBeLessThan(10);
});

test("a maior parte dos top produtos tem poucas fotos no catálogo", () => {
  const ids = topProductIds(products, topProductsSeed("cliente-a"));
  const byId = new Map(products.map((p) => [p.id, p]));
  const few = [...ids].filter((id) => byId.get(id)!.images.length <= 2).length;
  expect(few).toBeGreaterThanOrEqual(35);
});
