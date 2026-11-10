import { describe, expect, test } from "bun:test";
import { requireShopeeDescription, shopeeOrderWindows } from "../src/lib/shopee-sync";

describe("pedidos Shopee", () => {
  test("cobre 30 dias com janelas menores que 15 dias e sem lacunas", () => {
    const to = 1_800_000_000;
    const from = to - 30 * 86400;
    const windows = shopeeOrderWindows(from, to);
    expect(windows[0]?.from).toBe(from);
    expect(windows.at(-1)?.to).toBe(to);
    windows.forEach((window, index) => {
      expect(window.to - window.from).toBeLessThan(15 * 86400);
      expect(window.to).toBeGreaterThan(window.from);
      if (index > 0) expect(window.from).toBe(windows[index - 1]?.to);
    });
  });
  test("rejeita períodos invertidos ou vazios", () => {
    expect(() => shopeeOrderWindows(5, 5)).toThrow();
    expect(() => shopeeOrderWindows(10, 5)).toThrow();
  });
});
test("bloqueia descrição vazia sem inventar conteúdo", () => {
  expect(() => requireShopeeDescription("  ")).toThrow("descrição");
  expect(requireShopeeDescription(" Produto real ")).toBe("Produto real");
});