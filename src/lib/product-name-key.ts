/**
 * Same-product key from the name: case, accents and spacing ignored. The retired suppliers
 * (and owner-exclusive copies) sometimes hold the same product twice under different ids;
 * lists shown to partners keep only the first one so no replica appears.
 */
export function productNameKey(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Keeps the first product of each name (and of each id), in order. */
export function uniqueByName<T extends { id: string; name: string }>(products: T[], seen: Set<string> = new Set()): T[] {
  const result: T[] = [];
  for (const product of products) {
    const key = productNameKey(product.name);
    if (seen.has(product.id) || seen.has(key)) continue;
    seen.add(product.id);
    seen.add(key);
    result.push(product);
  }
  return result;
}
