const HTTP_URL = /^https?:\/\//i;

export function parseProductImageList(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,;|]+/)
      : [];

  const normalized: string[] = [];
  for (const entry of values) {
    if (typeof entry !== "string") continue;
    const url = entry.trim();
    if (!HTTP_URL.test(url) || normalized.includes(url)) continue;
    normalized.push(url);
  }
  return normalized;
}

export function normalizeProductImages(primary: unknown, gallery: unknown, limit?: number): string[] {
  const images = [...new Set([...parseProductImageList(primary), ...parseProductImageList(gallery)])];
  return typeof limit === "number" ? images.slice(0, limit) : images;
}

export function splitProductImages(images: unknown) {
  const normalized = parseProductImageList(images);
  return { primaryImage: normalized[0] ?? null, galleryImages: normalized.slice(1) };
}