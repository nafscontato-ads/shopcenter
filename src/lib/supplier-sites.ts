/**
 * Supplier websites whose public catalogue is imported into the owner-only
 * test area. Prices are copied exactly as shown on the site (owner decision).
 */
export type SupplierSite = {
  id: string;
  name: string;
  /** Letter shown to sellers so each supplier is easy to tell apart (Fornecedor A, B...). */
  letter: string;
  /** Public storefront, used for links the buyer opens. */
  storeUrl: string;
  /** Public catalogue endpoint of the store platform. */
  apiUrl: string;
  /** Store platform, which decides how the public catalogue is read. */
  platform: "vtex" | "prestashop";
  /** Supplier contact number as shown to sellers. */
  phone?: string;
  /** Same number in WhatsApp format (country code + digits only). */
  whatsapp?: string;
};

export const supplierSites: SupplierSite[] = [
  {
    id: "minipreco",
    name: "Minipreço",
    letter: "A",
    storeUrl: "https://www.minipreco.com.br",
    apiUrl: "https://minipreco.vtexcommercestable.com.br",
    platform: "vtex",
    // No phone/WhatsApp on purpose: students must not contact the supplier directly (owner decision 2026-11-13).
  },
  {
    id: "25demarco",
    name: "25 de Março Online",
    letter: "B",
    storeUrl: "https://www.25demarcoonline.com.br",
    apiUrl: "https://www.25demarcoonline.com.br",
    platform: "prestashop",
  },
];

export function getSupplierSite(id: string) {
  return supplierSites.find((site) => site.id === id) ?? null;
}

/** WhatsApp chat with the supplier, pre-filled with the order to buy; null when no number is saved. */
export function supplierWhatsAppUrl(id: string | null | undefined, order?: { orderSn: string; product: string; quantity: number; productUrl?: string | null }) {
  const site = id ? getSupplierSite(id) : null;
  if (!site?.whatsapp) return null;
  const text = order
    ? [`Olá, ${site.name}! Quero fazer um pedido:`, `${order.quantity}× ${order.product}`, order.productUrl ? `Link: ${order.productUrl}` : null, `Pedido Shopee: ${order.orderSn}`, "Vou enviar a etiqueta da Shopee para o envio."].filter(Boolean).join("\n")
    : `Olá, ${site.name}!`;
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
}

/** "Fornecedor A · Minipreço" for a product's supplier source. */
export function supplierSiteLabel(id: string | null | undefined) {
  const site = id ? getSupplierSite(id) : null;
  return site ? `Fornecedor ${site.letter} · ${site.name}` : "Fornecedor";
}

/** Maximum page size accepted by the store platform search. */
export const SUPPLIER_PAGE_SIZE = 50;
/** The store platform refuses offsets beyond this value. */
export const SUPPLIER_MAX_OFFSET = 2500;

type CategoryNode = { id: number; name: string; hasChildren?: boolean; children?: CategoryNode[] };

/** `filter` is the store search filter, which needs the full id path (C:/77/73/). */
export type SupplierSection = { filter: string; path: string };

/** Flattens the store category tree into its leaf sections. */
export function leafSections(tree: CategoryNode[], parents: string[] = [], ids: number[] = []): SupplierSection[] {
  return tree.flatMap((node) => {
    const path = [...parents, node.name.trim()];
    const idPath = [...ids, node.id];
    if (node.children && node.children.length > 0) return leafSections(node.children, path, idPath);
    return [{ filter: `C:/${idPath.join("/")}/`, path: path.join(" / ") }];
  });
}

type StoreOffer = { Price?: number; ListPrice?: number; AvailableQuantity?: number };
type StoreItem = {
  itemId?: string;
  ean?: string;
  images?: Array<{ imageUrl?: string }>;
  sellers?: Array<{ commertialOffer?: StoreOffer }>;
};
export type StoreProduct = {
  productId?: string;
  productName?: string;
  brand?: string;
  linkText?: string;
  categories?: string[];
  description?: string;
  items?: StoreItem[];
};

export type SupplierProductRow = {
  source: string;
  external_id: string;
  sku_id: string | null;
  title: string;
  brand: string | null;
  category: string | null;
  price: number | null;
  list_price: number | null;
  available: boolean;
  image_url: string | null;
  images: string[];
  url: string;
  ean: string | null;
  description: string | null;
};

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", bull: "•", ndash: "–", mdash: "—", hellip: "…",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", deg: "°", middot: "·", ordm: "º", ordf: "ª", reg: "®", copy: "©",
  times: "×", iquest: "¿", iexcl: "¡", lrm: "", rlm: "", zwj: "", zwnj: "", shy: "", euro: "€", sup2: "²", sup3: "³", frac12: "½",
};
const ACCENTS: Record<string, string> = { acute: "\u0301", grave: "\u0300", circ: "\u0302", tilde: "\u0303", uml: "\u0308", cedil: "\u0327", ring: "\u030A" };

/** Decodes the HTML entities stores put in product text (&ccedil; → ç, &#233; → é). */
export function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    if (code in NAMED_ENTITIES) return NAMED_ENTITIES[code]!;
    const accent = /^([a-z])(acute|grave|circ|tilde|uml|cedil|ring)$/i.exec(code);
    if (accent) return `${accent[1]}${ACCENTS[accent[2]!.toLowerCase()]}`.normalize("NFC");
    if (/^oslash$/i.test(code)) return code[0] === "O" ? "Ø" : "ø";
    return match;
  });
}

function cleanText(value: string | undefined | null) {
  const text = decodeEntities((value ?? "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  return text || null;
}

/** Converts one store product into the row saved in PAS, or null when unusable. */
export function toSupplierProductRow(site: SupplierSite, product: StoreProduct): SupplierProductRow | null {
  const title = product.productName?.trim();
  if (!product.productId || !title || !product.linkText) return null;
  const item = product.items?.find((entry) => (entry.sellers?.[0]?.commertialOffer?.AvailableQuantity ?? 0) > 0) ?? product.items?.[0];
  const offer = item?.sellers?.[0]?.commertialOffer;
  const price = typeof offer?.Price === "number" && offer.Price > 0 ? offer.Price : null;
  const listPrice = typeof offer?.ListPrice === "number" && offer.ListPrice > 0 ? offer.ListPrice : null;
  const images = (item?.images ?? []).map((image) => image.imageUrl ?? "").filter(Boolean).slice(0, 9);
  const category = product.categories?.[0]?.split("/").filter(Boolean).join(" / ") || null;
  const sku = item?.itemId ?? null;
  return {
    source: site.id,
    external_id: product.productId,
    sku_id: sku,
    title,
    brand: product.brand?.trim() || null,
    category,
    price,
    list_price: listPrice,
    available: price !== null && (offer?.AvailableQuantity ?? 0) > 0,
    image_url: images[0] ?? null,
    images,
    url: `${site.storeUrl}/${product.linkText}/p${sku ? `?skuId=${sku}` : ""}`,
    ean: item?.ean?.trim() || null,
    description: cleanText(product.description)?.slice(0, 5000) ?? null,
  };
}

/* ------------------------------ PrestaShop stores ----------------------------- */

/** Products per category page accepted by PrestaShop listings. */
export const PRESTASHOP_PAGE_SIZE = 100;

/** PAS category for each top-level 25 de Março section (first URL segment). */
const PRESTASHOP_CATEGORIES: Record<string, string> = {
  "atacado-de-brinquedos-para-revenda": "Brinquedos",
  "inflaveis-piscina-brinquedos": "Brinquedos",
  "beleza-no-atacado": "Beleza",
  "bolsas-femininas-atacado": "Bolsas e Mochilas",
  "malas-e-mochilas-atacado": "Bolsas e Mochilas",
  "necessaire-bolsa-termica-no-atacado": "Bolsas e Mochilas",
  "carteiras-femininas-atacado": "Carteiras",
  "carteiras-masculinas-atacado": "Carteiras",
  "chaveiro-no-atacado-para-revenda": "Acessórios",
  "guarda-chuva-no-atacado-para-revenda": "Acessórios",
  "eletrodomesticos-no-atacado-para-revenda": "Eletrodomésticos",
  "eletronicos-no-atacado-para-revenda": "Eletrônicos",
  "enfeites-de-natal-atacado": "Sazonal",
  "produtos-de-halloween-atacado": "Sazonal",
  "tudo-para-a-copa": "Sazonal",
  "ferramentas-no-atacado-para-revenda": "Ferramentas",
  "papelaria-e-material-escolar-no-atacado-revenda": "Papelaria",
  "produtos-religiosos-no-atacado-para-revenda": "Decoração",
  "roupas-no-atacado": "Vestuário",
  "utensilios-domesticos-para-revenda": "Utilidades Domésticas",
  "caixa-fechada": "Caixa Fechada",
};

/** Category pages listed in the store sitemap (each is crawled; duplicates merge on save). */
export function prestashopSections(site: SupplierSite, sitemapXml: string): SupplierSection[] {
  const urls = Array.from(sitemapXml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^\]<\s]+)/g), (match) => match[1]!);
  return Array.from(new Set(urls))
    .filter((url) => url.startsWith(`${site.storeUrl}/`))
    .map((url) => {
      const segments = url.slice(site.storeUrl.length + 1).split("/").filter(Boolean);
      const top = PRESTASHOP_CATEGORIES[segments[0] ?? ""] ?? "Outros";
      const rest = segments.slice(1).map((part) => part.replace(/-/g, " "));
      return { filter: url, path: [top, ...rest].join(" / ") };
    });
}

export type PrestashopProduct = {
  id_product?: number | string;
  name?: string;
  canonical_url?: string;
  url?: string;
  category_name?: string;
  manufacturer_name?: string | null;
  reference?: string;
  description_short?: string;
  price_amount?: number;
  regular_price_amount?: number;
  cover?: { bySize?: Record<string, { url?: string }>; large?: { url?: string } } | null;
};

/** Converts one PrestaShop listing product into the row saved in PAS, or null when unusable. */
export function toPrestashopRow(site: SupplierSite, product: PrestashopProduct): SupplierProductRow | null {
  const title = product.name?.trim();
  const url = (product.canonical_url || product.url || "").split("#")[0] ?? "";
  if (!product.id_product || !title || !url.startsWith(site.storeUrl)) return null;
  const top = PRESTASHOP_CATEGORIES[url.slice(site.storeUrl.length + 1).split("/")[0] ?? ""] ?? "Outros";
  const price = typeof product.price_amount === "number" && product.price_amount > 0 ? product.price_amount : null;
  const listPrice = typeof product.regular_price_amount === "number" && product.regular_price_amount > 0 ? product.regular_price_amount : null;
  const image = product.cover?.bySize?.["large_default"]?.url ?? product.cover?.large?.url ?? null;
  return {
    source: site.id,
    external_id: String(product.id_product),
    sku_id: product.reference?.trim() || null,
    title,
    brand: product.manufacturer_name?.trim() || null,
    category: [top, product.category_name?.trim()].filter(Boolean).join(" / "),
    price,
    list_price: listPrice,
    available: price !== null,
    image_url: image,
    images: image ? [image] : [],
    url,
    ean: null,
    description: cleanText(product.description_short)?.slice(0, 5000) ?? null,
  };
}

/** Every product photo listed in a store page's structured data (schema.org Product). */
export function productPagePhotos(html: string): string[] {
  const photos: string[] = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(match[1]!) as { "@type"?: string; image?: unknown; offers?: { image?: unknown } };
      if (data["@type"] !== "Product") continue;
      for (const value of [data.offers?.image, data.image]) {
        for (const url of Array.isArray(value) ? value : [value]) {
          if (typeof url === "string" && /^https:\/\//.test(url)) photos.push(url.replace(/-home_default\./, "-large_default."));
        }
      }
    } catch {
      // Ignore malformed blocks; other blocks may still describe the product.
    }
  }
  return Array.from(new Set(photos)).slice(0, 9);
}
