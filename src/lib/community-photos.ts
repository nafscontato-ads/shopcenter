import { normalizeProductImages } from "@/lib/product-images";

export type CommunityListingRow = { product_id: string; user_id: string; images: string[] | null; updated_at: string; description?: string | null };
export type CommunityGallery = { productId: string; images: string[]; newPhotos: number; contributors: number; updatedAt: string; description: string | null };

/** A customer description counts once it has real content and differs from the catalogue text. */
const MIN_DESCRIPTION = 40;
const normalizeText = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

/** Photos the PAS itself re-encoded from a catalogue photo (resize/compress) are not new photos. */
export function isAdjustedCatalogCopy(url: string) {
  return /\/adjusted-[^/?]+(\?|$)/.test(url);
}

const MAX_GALLERY = 9;

/**
 * Owner-only view: every active catalogue product where someone (owner or
 * customer) saved or published a listing with at least one photo that is not
 * already in the catalogue. The gallery keeps the catalogue cover first, then
 * every new photo from every contributor (newest first), then the remaining
 * catalogue photos, capped at Shopee's 9. The title stays the catalogue's;
 * the newest customer-written description (different from the catalogue's)
 * is offered too, and a new description alone is enough to list the product.
 */
export function pickCommunityGalleries(rows: CommunityListingRow[], catalogImages: Map<string, string[]>, catalogDescriptions: Map<string, string | null> = new Map()): CommunityGallery[] {
  const found = new Map<string, { fresh: string[]; updatedAt: string; users: Set<string>; description: string | null }>();
  const sorted = [...rows].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  for (const row of sorted) {
    const catalog = catalogImages.get(row.product_id);
    if (!catalog) continue;
    const known = new Set(catalog);
    const fresh = normalizeProductImages(null, row.images ?? []).filter((url) => !known.has(url) && !isAdjustedCatalogCopy(url));
    const text = normalizeText(row.description);
    const newText = text.length >= MIN_DESCRIPTION && text !== normalizeText(catalogDescriptions.get(row.product_id)) ? (row.description ?? "").trim() : null;
    if (fresh.length === 0 && !newText) continue;
    const current = found.get(row.product_id) ?? { fresh: [], updatedAt: row.updated_at, users: new Set<string>(), description: null };
    current.users.add(row.user_id);
    if (!current.description && newText) current.description = newText;
    for (const url of fresh) if (!current.fresh.includes(url)) current.fresh.push(url);
    found.set(row.product_id, current);
  }
  return [...found.entries()]
    .map(([productId, v]) => {
      const catalog = catalogImages.get(productId) ?? [];
      const images = normalizeProductImages(catalog.slice(0, 1), [...v.fresh, ...catalog.slice(1)], MAX_GALLERY);
      return { productId, images, newPhotos: v.fresh.length, contributors: v.users.size, updatedAt: v.updatedAt, description: v.description };
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
