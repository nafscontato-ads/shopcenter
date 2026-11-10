import { readAttributeDefinitions, validateCategoryAttributes, type ShopeeAttribute } from "@/lib/shopee-publishing";

/** Send only valid known values; absent requirements are decided by Shopee, not invented locally. */
export function availableSubmissionAttributes(response: unknown, attributes: ShopeeAttribute[]) {
  let available = attributes;
  for (let pass = 0; pass < 10; pass += 1) {
    const definitions = readAttributeDefinitions(response, available);
    const next = available.filter((attribute) => {
      const definition = definitions.find((field) => field.id === attribute.attribute_id);
      if (!definition) return false;
      try {
        validateCategoryAttributes([{ ...definition, required: false }], [attribute]);
        return true;
      } catch {
        return false;
      }
    });
    if (JSON.stringify(next) === JSON.stringify(available)) return next;
    available = next;
  }
  return available;
}

/** Missing/failed charts never prevent submitting the item to Shopee for acceptance. */
export async function availableSizeChart(
  savedUrl: string | null,
  images: string[],
  detect: (images: string[]) => Promise<string | null>,
  upload: (url: string) => Promise<string | null>,
) {
  try {
    const url = savedUrl || await detect(images);
    if (!url) return null;
    const id = await upload(url);
    return id ? { url, info: { size_chart: id } } : null;
  } catch {
    return null;
  }
}