import { describe, expect, it } from 'bun:test';
import { getSupplierSite, leafSections, supplierWhatsAppUrl, toSupplierProductRow } from '@/lib/supplier-sites';

const site = getSupplierSite('minipreco')!;

const product = {
  productId: '25572',
  productName: 'Edredom Blend Queen Comfort Plush',
  brand: 'ALTENBURG',
  linkText: '19261857-edredom-blend-queen',
  categories: ['/cameba/Cama/Edredom/', '/cameba/Cama/'],
  description: '<p>Macio&nbsp;e quente</p>',
  items: [
    { itemId: '1', ean: '789', images: [{ imageUrl: 'https://img/a.jpg' }], sellers: [{ commertialOffer: { Price: 0, ListPrice: 0, AvailableQuantity: 0 } }] },
    { itemId: '20769', ean: '7891', images: [{ imageUrl: 'https://img/b.jpg' }], sellers: [{ commertialOffer: { Price: 119.99, ListPrice: 249.9, AvailableQuantity: 5 } }] },
  ],
};

describe('supplier site import', () => {
  it('uses the price shown on the supplier site as the product cost', () => {
    const row = toSupplierProductRow(site, product)!;
    expect(row.price).toBe(119.99);
    expect(row.list_price).toBe(249.9);
    expect(row.available).toBe(true);
  });

  it('links each product to its purchase page on the supplier store', () => {
    expect(toSupplierProductRow(site, product)!.url).toBe('https://www.minipreco.com.br/19261857-edredom-blend-queen/p?skuId=20769');
  });

  it('marks products without stock as unavailable', () => {
    const row = toSupplierProductRow(site, { ...product, items: [product.items[0]!] })!;
    expect(row.available).toBe(false);
    expect(row.price).toBeNull();
  });

  it('walks every tab of the store down to its last level', () => {
    const sections = leafSections([
      { id: 77, name: 'cameba', children: [{ id: 73, name: 'Cama', children: [] }, { id: 80, name: 'Mesa', children: [{ id: 81, name: 'Toalhas' }] }] },
      { id: 14, name: 'Bricolagem' },
    ]);
    expect(sections).toEqual([
      { filter: 'C:/77/73/', path: 'cameba / Cama' },
      { filter: 'C:/77/80/81/', path: 'cameba / Mesa / Toalhas' },
      { filter: 'C:/14/', path: 'Bricolagem' },
    ]);
  });
});

import { decodeCatalog, encodeCatalog } from "../src/lib/catalog-wire";
import { supplierCost } from "../src/lib/catalog-sorts";
import { supplierSiteLabel } from "../src/lib/supplier-sites";
import type { Product } from "../src/lib/pas-data";

describe("supplier products in the PAS catalogue", () => {
  const product: Product = {
    id: "p1", name: "Edredom", price: 153.85, promoPrice: null, commission: 26, rating: 0, reviews: "—", category: "Cama, Mesa e Banho",
    viral: false, score: 60, image: "https://minipreco.vteximg.com.br/arquivos/ids/1/a.jpg?v=1", url: null, soldCount: 0, brand: null,
    description: null, subcategory: null, sku: null, images: ["https://minipreco.vteximg.com.br/arquivos/ids/1/a.jpg?v=1", "https://minipreco.vteximg.com.br/arquivos/ids/2/b.jpg"],
    videoUrl: null, supplierSource: "minipreco", supplierCost: 100,
  };

  it("uses the supplier website price as the cost", () => {
    expect(supplierCost(product)).toBe(100);
  });

  it("names Minipreço as Fornecedor A", () => {
    expect(supplierSiteLabel("minipreco")).toBe("Fornecedor A · Minipreço");
  });

  it("keeps every product field through the compact catalogue transport", () => {
    expect(decodeCatalog(encodeCatalog([product]))).toEqual([product]);
  });
});

import { prestashopSections, toPrestashopRow } from "../src/lib/supplier-sites";

describe("Fornecedor B (25 de Março Online)", () => {
  const b = getSupplierSite("25demarco")!;

  it("is labelled Fornecedor B", () => {
    expect(supplierSiteLabel("25demarco")).toBe("Fornecedor B · 25 de Março Online");
  });

  it("uses the site price as cost, the large photo and the clean product link", () => {
    const row = toPrestashopRow(b, {
      id_product: 140577, name: "Kit Mini Blocos", price_amount: 11.99, regular_price_amount: 20, category_name: "Blocos de Montar",
      canonical_url: "https://www.25demarcoonline.com.br/atacado-de-brinquedos-para-revenda/blocos/kit-mini-blocos#/2-tamanho-u",
      cover: { bySize: { large_default: { url: "https://cdn/x-large_default.jpg" } } },
    })!;
    expect(row.price).toBe(11.99);
    expect(row.category).toBe("Brinquedos / Blocos de Montar");
    expect(row.images).toEqual(["https://cdn/x-large_default.jpg"]);
    expect(row.url).toBe("https://www.25demarcoonline.com.br/atacado-de-brinquedos-para-revenda/blocos/kit-mini-blocos");
  });

  it("reads every category page from the store sitemap", () => {
    const xml = "<urlset><url><loc><![CDATA[https://www.25demarcoonline.com.br/roupas-no-atacado]]></loc></url><url><loc><![CDATA[https://outra.com/x]]></loc></url></urlset>";
    expect(prestashopSections(b, xml)).toEqual([{ filter: "https://www.25demarcoonline.com.br/roupas-no-atacado", path: "Vestuário" }]);
  });
});

import { productPagePhotos } from "../src/lib/supplier-sites";

describe("Fornecedor B product photos", () => {
  it("reads every photo from the product page, in large size", () => {
    const html = '<script type="application/ld+json">{"@type":"Product","image":"https://cdn/1-home_default.jpg","offers":{"image":["https://cdn/1-large_default.jpg","https://cdn/2-large_default.jpg"]}}</script>';
    expect(productPagePhotos(html)).toEqual(["https://cdn/1-large_default.jpg", "https://cdn/2-large_default.jpg"]);
  });
});

import { decodeEntities } from "../src/lib/supplier-sites";

describe("supplier product text", () => {
  it("turns store HTML codes into normal letters", () => {
    expect(decodeEntities("Flex&iacute;vel &ccedil;&atilde;o &Eacute; 5&deg; &#233; &amp; &bull;")).toBe("Flexível ção É 5° é & •");
  });
});

it("Minipreço WhatsApp opens 41 9222-7822 with the order written", () => {
  const url = supplierWhatsAppUrl("minipreco", { orderSn: "ABC123", product: "Pote", quantity: 2, productUrl: "https://www.minipreco.com.br/pote/p" })!;
  expect(url.startsWith("https://wa.me/554192227822?text=")).toBe(true);
  const text = decodeURIComponent(url.split("text=")[1]!);
  expect(text).toContain("2× Pote");
  expect(text).toContain("ABC123");
});

it("25 de Março has no WhatsApp saved yet", () => {
  expect(supplierWhatsAppUrl("25demarco")).toBeNull();
});
