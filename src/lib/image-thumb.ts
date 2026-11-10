/**
 * Smaller display copies of supplier product photos for lists and grids.
 * Only for showing on screen: publishing and editing keep the original URL.
 * - Minipreço (VTEX): `/arquivos/ids/<id>/` → `/arquivos/ids/<id>-<w>-<h>/`
 * - 25 de Março (PrestaShop): `-large_default.jpg` → `-home_default.jpg` (≈305px)
 * Any other URL is returned unchanged.
 */
export function thumbUrl(url: string | null | undefined, size = 300): string {
  if (!url) return "";
  const vtex = url.match(/^(https:\/\/[^/]+\.vtex(?:img\.com\.br|assets\.com)\/arquivos\/ids\/)(\d+)(?:-\d+-\d+)?(\/.*)$/);
  if (vtex) return `${vtex[1]}${vtex[2]}-${size}-${size}${vtex[3]}`;
  if (/-large_default\.(jpe?g|png|webp)(\?.*)?$/i.test(url) && size <= 320) return url.replace(/-large_default\./i, "-home_default.");
  return url;
}
