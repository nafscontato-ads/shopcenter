import { expect, test } from "bun:test";
import { productNameKey, uniqueByName } from "../src/lib/product-name-key";

test("ignora maiúsculas, acentos e espaços", () => {
  expect(productNameKey("  Árvore de Natal  Decorada com Luzes LED")).toBe(productNameKey("arvore de natal decorada com luzes led"));
});

test("mantém só a primeira árvore com o mesmo nome", () => {
  const list = [
    { id: "a", name: "Árvore de Natal Decorada com Luzes LED" },
    { id: "b", name: "Arvore de Natal decorada com luzes LED" },
    { id: "c", name: "Pisca-pisca 100 LEDs" },
    { id: "c", name: "Pisca-pisca 100 LEDs" },
  ];
  expect(uniqueByName(list).map((p) => p.id)).toEqual(["a", "c"]);
});
