import { expect, test } from "bun:test";
import { PDFDocument } from "pdf-lib";
import { createDemoShippingLabel, type DemoLabelSale } from "../src/lib/demo-shipping-label";

test("venda simulada gera PDF local de etiqueta 100 por 150 mm", async () => {
  const bytes = await createDemoShippingLabel({ demo: true, productName: "Cortina Minipreço 🎄", quantity: 1 });
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(283.46);
  expect(pdf.getPage(0).getHeight()).toBeCloseTo(425.2);
});

test("etiqueta demonstrativa recusa pedidos que não são simulação", async () => {
  const real = { demo: false, productName: "Produto", quantity: 1 } as unknown as DemoLabelSale;
  await expect(createDemoShippingLabel(real)).rejects.toThrow("somente vendas simuladas");
});