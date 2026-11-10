/**
 * Shop Center only has the producer area now. The old affiliate pages
 * (Influenciadores, Studio de Conteúdo, Divulgar no Facebook) are retired and
 * their addresses send people to the producer area.
 */
export const RETIRED_AFFILIATE_PATHS = ["/influencer", "/studio", "/facebook"];

export function isRetiredAffiliatePath(pathname: string) {
  return RETIRED_AFFILIATE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
