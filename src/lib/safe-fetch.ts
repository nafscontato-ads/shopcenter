/**
 * Server-side downloads of user-supplied image addresses. Only public web
 * addresses are allowed: no IP literals, local/internal host names, custom
 * ports or embedded credentials, and every redirect hop is re-checked. This
 * stops image tools from being pointed at private services (SSRF).
 */

const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".intranet"];
const MAX_REDIRECTS = 3;

function isIpLiteral(hostname: string) {
  if (hostname.startsWith("[") || hostname.includes(":")) return true; // IPv6
  if (/^\d+$/.test(hostname)) return true; // decimal-encoded IPv4
  if (/^0x[0-9a-f]+$/i.test(hostname)) return true; // hex-encoded IPv4
  return /^[\d.]+$/.test(hostname) || /^(\d+|0x[0-9a-f]+)(\.(\d+|0x[0-9a-f]+)){1,3}$/i.test(hostname);
}

/** Returns the parsed URL when it points to a public web host, otherwise null. */
export function publicHttpUrl(value: string | URL): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "443" && url.port !== "80") return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || !host.includes(".")) return null;
  if (host === "localhost" || isIpLiteral(host)) return null;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return null;
  if (host === "metadata.google.internal" || host.startsWith("metadata.")) return null;
  return url;
}

/** fetch() for a user-supplied public address; follows at most a few redirects, each re-validated. */
export async function fetchPublicUrl(value: string | URL, init: RequestInit = {}): Promise<Response> {
  let url = publicHttpUrl(value);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!url) throw new Error("Endereço de imagem não permitido.");
    const response = await fetch(url, { ...init, redirect: "manual" });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    url = publicHttpUrl(new URL(location, url));
  }
  throw new Error("A imagem redirecionou vezes demais.");
}
