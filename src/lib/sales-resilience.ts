/**
 * Keeps the sales dashboard from dropping to zero when the internet fails:
 * the last good access check and product list are remembered in the browser
 * and reused until a fresh answer arrives. The simulated history keeps
 * advancing with the clock, so the balance never freezes either.
 */
import type { SalesAccess } from "@/lib/sales-access.functions";

const ACCESS_PREFIX = "pas:sales-access:";
export const bootstrapCacheKey = (userId: string) => `sales-bootstrap:${userId}`;

/** Never swap a known product list for an empty one (an empty answer zeros every total). */
export function keepNonEmpty<T>(next: T[] | undefined | null, previous: T[]): T[] {
  if (next && next.length > 0) return next;
  return previous.length > 0 ? previous : next ?? [];
}

export function readCachedAccess(userId: string): SalesAccess | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACCESS_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SalesAccess;
    return parsed && typeof parsed.allowed === "boolean" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCachedAccess(userId: string, access: SalesAccess) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCESS_PREFIX + userId, JSON.stringify(access));
  } catch {
    /* storage cheio — ignora */
  }
}
