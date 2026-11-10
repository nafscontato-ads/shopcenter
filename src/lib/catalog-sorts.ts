import type { Product } from "@/lib/pas-data";

/**
 * Supplier cost shown on catalogue cards: the supplier website price when known
 * (owner decision), otherwise 65% of the catalogue (promo) price.
 */
export function supplierCost(p: Pick<Product, "price" | "promoPrice" | "supplierCost">) {
  if (p.supplierCost != null && p.supplierCost > 0) return p.supplierCost;
  const base = p.promoPrice ?? p.price;
  return Math.round(base * 0.65 * 100) / 100;
}

/** Display-only sales figure for top products (owner decision): stable per product, 300 to 988. */
export function topSalesCount(productId: string) {
  let h = 2166136261;
  for (let i = 0; i < productId.length; i++) { h ^= productId.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 300 + ((h >>> 0) % 689);
}

/** How many products get the top badge. */
export const TOP_PRODUCTS_COUNT = 50;

/** Share of the top list reserved for products that still have few catalogue photos. */
const FEW_PHOTOS = 2;
const FEW_PHOTOS_SHARE = 0.7;

function seededHash(seed: string, id: string) {
  let h = 2166136261;
  const value = `${seed}:${id}`;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Top products (owner decision): a different, varied set per customer and per day, so customers add photos and
 * descriptions to as many different products as possible. Most picks are products with few catalogue photos;
 * the rest are any photographed product. Without a seed (signed out), the highest viral scores are used.
 */
export function topProductIds(products: Pick<Product, "id" | "score" | "images" | "image">[], seed?: string | null) {
  if (!seed) return new Set([...products].sort((a, b) => b.score - a.score).slice(0, TOP_PRODUCTS_COUNT).map((p) => p.id));
  const withPhoto = products.filter((p) => p.image || p.images?.length);
  const shuffled = [...withPhoto].sort((a, b) => seededHash(seed, a.id) - seededHash(seed, b.id));
  const few = shuffled.filter((p) => (p.images?.length ?? (p.image ? 1 : 0)) <= FEW_PHOTOS);
  const chosen = new Set(few.slice(0, Math.round(TOP_PRODUCTS_COUNT * FEW_PHOTOS_SHARE)).map((p) => p.id));
  for (const product of shuffled) {
    if (chosen.size >= TOP_PRODUCTS_COUNT) break;
    chosen.add(product.id);
  }
  return chosen;
}

/** Seed for the per-customer top list: changes every day in São Paulo time. */
export function topProductsSeed(userId: string | null | undefined, now = new Date()) {
  if (!userId) return null;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  return `${userId}:${day}`;
}
