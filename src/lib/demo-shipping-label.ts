export type DemoLabelSale = { demo: true; productName: string; quantity: number };

/** Local demonstration only: no address, carrier barcode, tracking or Shopee request. */
export async function createDemoShippingLabel(sale: DemoLabelSale): Promise<Uint8Array> {
  if (sale.demo !== true) throw new Error("A etiqueta de teste aceita somente vendas simuladas.");
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([283.46, 425.2]);
  const text = (value: string, y: number, size = 11, strong = false) => page.drawText(value, { x: 18, y, size, font: strong ? bold : font });
  text("ETIQUETA DEMONSTRATIVA", 392, 15, true);
  text("SEM VALIDADE PARA POSTAGEM", 371, 12, true);
  text("Shop Center - venda simulada", 337, 12, true);
  text("Pedido: TESTE-MINIPRECO", 315);
  text("Fornecedor: Minipreço", 294);
  text(`Quantidade: ${sale.quantity}`, 273);
  // Standard PDF fonts cannot encode emoji or arbitrary unicode supplier titles.
  const name = sale.productName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, " ").slice(0, 150);
  const words = name.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, 10) > 245 && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  lines.slice(0, 5).forEach((value, index) => text(value, 245 - index * 15, 10));
  text("DESTINATARIO DE TESTE", 136, 11, true);
  text("Nenhum comprador ou endereco real.", 115, 10);
  text("Sem rastreio. Sem codigo de transporte.", 74, 10);
  text("Nao enviar ao fornecedor nem postar.", 54, 10, true);
  return pdf.save();
}