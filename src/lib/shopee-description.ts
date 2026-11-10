/** Prefer saved text verbatim; blank values must never mask or erase it. */
export function resolveShopeeDescription(...descriptions: (string | null | undefined)[]): string {
  return descriptions.find((description) => typeof description === "string" && description.trim().length > 0) ?? "";
}