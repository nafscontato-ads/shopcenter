import { describe, expect, test } from "bun:test";

import { keepNonEmpty } from "../src/lib/sales-resilience";

describe("saldo do dashboard nunca zera por falha de internet", () => {
  test("uma resposta vazia mantém a lista anterior de produtos", () => {
    const previous = [{ id: "a", price: 10 }];
    expect(keepNonEmpty([], previous)).toBe(previous);
    expect(keepNonEmpty(undefined, previous)).toBe(previous);
  });

  test("uma resposta nova com produtos substitui a anterior (saldo não congela)", () => {
    const next = [{ id: "b", price: 20 }];
    expect(keepNonEmpty(next, [{ id: "a", price: 10 }])).toBe(next);
  });
});
