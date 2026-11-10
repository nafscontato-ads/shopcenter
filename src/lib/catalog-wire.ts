import type { Product } from "@/lib/pas-data";

/**
 * Compact transport for the full catalogue: rows as tuples and image URLs with
 * their shared host/folder prefix stored once. Keeps ~10k products light.
 */
export type CatalogWire = { prefixes: string[]; rows: WireRow[] };

type WireRow = [
  id: string,
  name: string,
  price: number,
  promoPrice: number | null,
  commission: number,
  rating: number,
  reviews: string,
  category: string,
  subcategory: string | null,
  brand: string | null,
  sku: string | null,
  score: number,
  images: string[],
  videoUrl: string | null,
  url: string | null,
  soldCount: number,
  supplierSource: string | null,
  supplierCost: number | null,
];

function splitUrl(url: string) {
  const cut = url.lastIndexOf("/ids/");
  const at = cut >= 0 ? cut + 5 : url.lastIndexOf("/") + 1;
  return [url.slice(0, at), url.slice(at)] as const;
}

export function encodeCatalog(products: Product[]): CatalogWire {
  const prefixes: string[] = [];
  const index = new Map<string, number>();
  const image = (url: string) => {
    const [prefix, rest] = splitUrl(url);
    let i = index.get(prefix);
    if (i === undefined) {
      i = prefixes.push(prefix) - 1;
      index.set(prefix, i);
    }
    return `${i}|${rest}`;
  };
  return {
    prefixes,
    rows: products.map((p) => [
      p.id, p.name, p.price, p.promoPrice, p.commission, p.rating, p.reviews, p.category, p.subcategory, p.brand, p.sku,
      p.score, p.images.map(image), p.videoUrl, p.url, p.soldCount, p.supplierSource ?? null, p.supplierCost ?? null,
    ]),
  };
}

export function decodeCatalog(wire: CatalogWire): Product[] {
  const image = (value: string) => {
    const bar = value.indexOf("|");
    return `${wire.prefixes[Number(value.slice(0, bar))] ?? ""}${value.slice(bar + 1)}`;
  };
  return wire.rows.map(([id, name, price, promoPrice, commission, rating, reviews, category, subcategory, brand, sku, score, images, videoUrl, url, soldCount, supplierSource, supplierCost]) => {
    const full = images.map(image);
    return {
      id, name, price, promoPrice, commission, rating, reviews, category, subcategory, brand, sku, score,
      images: full, image: full[0] ?? null, videoUrl, url, soldCount, supplierSource, supplierCost,
      viral: score >= 80,
      description: null,
    };
  });
}
