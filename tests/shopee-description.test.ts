import { describe, expect, test } from "bun:test";
import { resolveShopeeDescription } from "../src/lib/shopee-description";

describe("saved Shopee descriptions", () => {
  test("keeps the student's saved description verbatim before catalogue text", () => {
    expect(resolveShopeeDescription("  Minha descrição\noriginal  ", "Catálogo atualizado")).toBe("  Minha descrição\noriginal  ");
  });
  test("blank drafts fall back to the catalogue", () => {
    expect(resolveShopeeDescription(" \n ", "Descrição geral")).toBe("Descrição geral");
  });
  test("empty saves preserve previous text before catalogue fallback", () => {
    expect(resolveShopeeDescription("", "Texto salvo", "Texto geral")).toBe("Texto salvo");
    expect(resolveShopeeDescription(undefined, null, "Texto geral")).toBe("Texto geral");
  });
  test("an intentional nonempty edit takes precedence", () => {
    expect(resolveShopeeDescription("Nova descrição", "Texto salvo")).toBe("Nova descrição");
    expect(resolveShopeeDescription(null, " ")).toBe("");
  });
});