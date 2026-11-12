/**
 * Supplier spreadsheet import (pure logic, no I/O). Admins upload a CSV the supplier (or DepDrop)
 * exported; each row becomes a staging row in `supplier_site_products` with the supplier's slug as
 * source, and `pas_sync_supplier_catalog` turns them into catalogue products with supplier_cost.
 */

export type CatalogRow = {
  externalId: string;
  title: string;
  cost: number;
  imageUrl: string | null;
  images: string[];
  category: string | null;
  brand: string | null;
  description: string | null;
  url: string | null;
  ean: string | null;
  available: boolean;
};

/** Splits CSV text (comma or semicolon, quoted fields, CRLF) into rows of cells; blank lines stay so line numbers match. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i]!;
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const HEADERS: Record<keyof Omit<CatalogRow, "available"> | "stock", string[]> = {
  externalId: ["sku", "codigo", "cod", "codigo sku", "referencia", "ref", "id", "id produto", "codigo produto"],
  title: ["nome", "produto", "nome do produto", "titulo", "title", "name"],
  cost: ["custo", "preco de custo", "preco custo", "custo dropshipping", "preco dropshipping", "preco drop", "preco", "valor", "cost", "price", "preco de venda ao seller"],
  imageUrl: ["imagem", "imagem principal", "foto", "foto principal", "url imagem", "image", "image url"],
  images: ["imagens", "fotos", "galeria", "imagens adicionais", "images"],
  category: ["categoria", "category"],
  brand: ["marca", "brand"],
  description: ["descricao", "description", "descricao completa"],
  url: ["link", "url", "link do produto"],
  ean: ["ean", "gtin", "codigo de barras"],
  stock: ["estoque", "stock", "quantidade", "qtd"],
};

/** Reads a Brazilian or plain number ("R$ 1.234,56", "1234.56", "39,9"). */
export function parseMoney(raw: string): number | null {
  const value = raw.replace(/[^\d,.-]/g, "");
  if (!value) return null;
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

const httpUrl = (value: string) => (/^https?:\/\/\S+$/i.test(value.trim()) ? value.trim() : null);

export type CatalogParse = { rows: CatalogRow[]; skipped: { line: number; reason: string }[]; missingColumns: string[] };

/** Turns the spreadsheet into catalogue rows; a row without SKU/name or a valid cost is skipped with its line number. */
export function readCatalog(text: string): CatalogParse {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], skipped: [], missingColumns: ["planilha vazia"] };
  const header = table[0]!.map(plain);
  const column = (key: keyof typeof HEADERS) => {
    for (const name of HEADERS[key]) {
      const index = header.indexOf(name);
      if (index >= 0) return index;
    }
    return -1;
  };
  const index = Object.fromEntries((Object.keys(HEADERS) as (keyof typeof HEADERS)[]).map((key) => [key, column(key)])) as Record<keyof typeof HEADERS, number>;
  const missingColumns = (["title", "cost"] as const).filter((key) => index[key] < 0).map((key) => (key === "title" ? "nome" : "custo"));
  if (missingColumns.length) return { rows: [], skipped: [], missingColumns };
  const rows: CatalogRow[] = [];
  const skipped: CatalogParse["skipped"] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((cells, offset) => {
    const line = offset + 2;
    if (!cells.some((value) => value.trim() !== "")) return;
    const get = (key: keyof typeof HEADERS) => (index[key] >= 0 ? (cells[index[key]] ?? "").trim() : "");
    const title = get("title").slice(0, 200);
    const cost = parseMoney(get("cost"));
    const externalId = (get("externalId") || plain(title).replace(/ /g, "-")).slice(0, 120);
    if (!title) { skipped.push({ line, reason: "sem nome" }); return; }
    if (cost == null || cost <= 0) { skipped.push({ line, reason: "custo inválido" }); return; }
    if (seen.has(externalId)) { skipped.push({ line, reason: `SKU repetido (${externalId})` }); return; }
    seen.add(externalId);
    const gallery = get("images").split(/[|\s,;]+/).map(httpUrl).filter((url): url is string => Boolean(url));
    const imageUrl = httpUrl(get("imageUrl")) ?? gallery[0] ?? null;
    const stockRaw = get("stock");
    const stock = stockRaw ? Number(stockRaw.replace(/\D/g, "")) : null;
    rows.push({
      externalId,
      title,
      cost,
      imageUrl,
      images: [...new Set([imageUrl, ...gallery].filter((url): url is string => Boolean(url)))].slice(0, 9),
      category: get("category") || null,
      brand: get("brand") || null,
      description: get("description") || null,
      url: httpUrl(get("url")),
      ean: get("ean").replace(/\D/g, "") || null,
      available: stock == null || stock > 0,
    });
  });
  return { rows, skipped, missingColumns: [] };
}
