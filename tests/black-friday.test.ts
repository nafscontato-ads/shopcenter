import { expect, test } from "bun:test";
import { BLACK_FRIDAY_FREE_SUPPLIER_IDS, offerDeadlineLabel } from "../src/lib/black-friday";
import { supplierDirectory } from "../src/lib/supplier-directory";

test("em 31/10 a oferta aparece disponível até 1/11", () => {
  expect(offerDeadlineLabel(new Date("2026-10-31T15:00:00Z"))).toBe("1/11");
});

test("em 1/11 passa a mostrar até 2/11", () => {
  expect(offerDeadlineLabel(new Date("2026-11-01T15:00:00Z"))).toBe("2/11");
});

test("usa o horário de São Paulo: 23h de 31/10 ainda mostra 1/11", () => {
  // 02:00 UTC de 1/11 = 23:00 de 31/10 em São Paulo
  expect(offerDeadlineLabel(new Date("2026-11-01T02:00:00Z"))).toBe("1/11");
});

test("virada de mês: 30/11 mostra 1/12", () => {
  expect(offerDeadlineLabel(new Date("2026-11-30T15:00:00Z"))).toBe("1/12");
});

test("os 2 fornecedores incluídos são o Minipreço e a 25 de Março, gratuitos", () => {
  for (const id of BLACK_FRIDAY_FREE_SUPPLIER_IDS) {
    const supplier = supplierDirectory.find((s) => s.id === id);
    expect(supplier?.unlocked).toBe(true);
  }
});
