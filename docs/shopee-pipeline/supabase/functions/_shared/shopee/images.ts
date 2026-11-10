// =============================================================================
// PAS · Fotos: baixa, valida, converte e sobe para a Shopee (media_space)
// -----------------------------------------------------------------------------
// Causa do erro "Uma ou mais imagens não atendem aos requisitos da Shopee":
// WEBP/AVIF/GIF, foto pequena, arquivo gigante, proporção torta ou link morto.
// Aqui toda foto passa por checagem; se precisar, é convertida para JPG
// 1000x1000 com fundo branco (via wsrv.nl, serviço público de imagem) e só
// então vai para v2.media_space.upload_image. Foto que não tem conserto é
// descartada sem derrubar o anúncio.
// =============================================================================
import { ShopeeApiError, type ShopeeCaller } from "./client.ts";
import type { Issue } from "./types.ts";

export interface ImageCheck {
  url: string;
  ok: boolean;
  format: "jpeg" | "png" | "gif" | "webp" | "avif" | "heic" | "unknown";
  width?: number;
  height?: number;
  bytes?: number;
  reason?: string;
}

const MAX_BYTES = 9.5 * 1024 * 1024; // limite da API é 10 MB
const MIN_SIDE = 500;
const CONVERTER = "https://wsrv.nl/";

export function sniffFormat(b: Uint8Array): ImageCheck["format"] {
  if (b.length < 12) return "unknown";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  const ascii = (s: number, e: number) => String.fromCharCode(...b.slice(s, e));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand.startsWith("avi")) return "avif";
    if (brand.startsWith("hei") || brand.startsWith("mif")) return "heic";
  }
  return "unknown";
}

export function readDimensions(b: Uint8Array, format: ImageCheck["format"]): { width: number; height: number } | null {
  if (format === "png" && b.length >= 24) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  if (format === "jpeg") {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 0xff) {
        i++; // byte de preenchimento
        continue;
      }
      const len = (b[i + 2] << 8) + b[i + 3];
      // SOF0..SOF15 exceto DHT(C4), JPG(C8), DAC(CC)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: (b[i + 5] << 8) + b[i + 6], width: (b[i + 7] << 8) + b[i + 8] };
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      i += 2 + len;
    }
  }
  return null;
}

async function download(url: string, timeoutMs = 20_000): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "image/jpeg,image/png;q=0.9,image/*;q=0.5", "User-Agent": "PAS-Publisher/1.0" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 25 * 1024 * 1024) throw new Error("arquivo maior que 25 MB");
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

export function inspect(url: string, bytes: Uint8Array): ImageCheck {
  const format = sniffFormat(bytes);
  const dims = readDimensions(bytes, format);
  const check: ImageCheck = { url, ok: false, format, bytes: bytes.byteLength, ...(dims ?? {}) };
  if (format !== "jpeg" && format !== "png") return { ...check, reason: `formato ${format}` };
  if (bytes.byteLength > MAX_BYTES) return { ...check, reason: "arquivo grande demais" };
  if (!dims) return { ...check, reason: "dimensões ilegíveis" };
  if (Math.min(dims.width, dims.height) < MIN_SIDE) return { ...check, reason: `pequena (${dims.width}x${dims.height})` };
  const ratio = dims.width / dims.height;
  if (ratio < 0.5 || ratio > 2) return { ...check, reason: `proporção ${dims.width}x${dims.height}` };
  return { ...check, ok: true };
}

/** Converte qualquer foto em JPG quadrado 1000x1000 com fundo branco. */
export function converterUrl(url: string, size = 1000): string {
  const u = new URL(CONVERTER);
  u.searchParams.set("url", url);
  u.searchParams.set("w", String(size));
  u.searchParams.set("h", String(size));
  u.searchParams.set("fit", "contain");
  u.searchParams.set("cbg", "ffffff");
  u.searchParams.set("bg", "ffffff");
  u.searchParams.set("output", "jpg");
  u.searchParams.set("q", "88");
  return u.toString();
}

export async function uploadImageBytes(
  call: ShopeeCaller,
  bytes: Uint8Array,
  format: "jpeg" | "png",
  scene: "normal" | "desc" = "normal",
): Promise<string> {
  const form = () => {
    const fd = new FormData();
    fd.append("image", new Blob([new Uint8Array(bytes)], { type: format === "png" ? "image/png" : "image/jpeg" }), format === "png" ? "image.png" : "image.jpg");
    fd.append("scene", scene);
    return fd;
  };
  const pick = (r: any): string | undefined =>
    r?.image_info?.image_id ?? r?.image_info_list?.find((x: any) => x?.image_info?.image_id)?.image_info?.image_id;
  try {
    const r = await call<any>("/api/v2/media_space/upload_image", { method: "POST", form: form(), timeoutMs: 60_000 });
    const id = pick(r);
    if (id) return id;
    const err = r?.image_info_list?.find((x: any) => x?.error);
    throw new ShopeeApiError("/api/v2/media_space/upload_image", err?.error ?? "no_image_id", err?.message ?? "Shopee não devolveu image_id");
  } catch (e) {
    // Algumas contas exigem assinatura "pública" neste endpoint.
    if (e instanceof ShopeeApiError && /sign|auth|permission|shop_id/i.test(`${e.code} ${e.message}`)) {
      const r = await call<any>("/api/v2/media_space/upload_image", { method: "POST", form: form(), signAs: "public", timeoutMs: 60_000 });
      const id = pick(r);
      if (id) return id;
    }
    throw e;
  }
}

/** Prepara uma foto: devolve bytes prontos (originais ou convertidos). */
export async function prepareImage(url: string): Promise<{ bytes: Uint8Array; format: "jpeg" | "png"; converted: boolean; check: ImageCheck }> {
  let original: Uint8Array | null = null;
  let check: ImageCheck = { url, ok: false, format: "unknown", reason: "não baixou" };
  try {
    original = await download(url);
    check = inspect(url, original);
    if (check.ok) return { bytes: original, format: check.format as "jpeg" | "png", converted: false, check };
  } catch (e) {
    check = { url, ok: false, format: "unknown", reason: `download falhou: ${String(e)}` };
  }
  // Conserta via conversor
  const converted = await download(converterUrl(url), 30_000);
  const c2 = inspect(url, converted);
  if (!c2.ok) throw new Error(`não foi possível converter (${c2.reason ?? check.reason})`);
  return { bytes: converted, format: c2.format as "jpeg" | "png", converted: true, check };
}

/** Sobe as fotos do produto. Nunca derruba o anúncio por uma foto ruim. */
export async function uploadProductImages(
  call: ShopeeCaller,
  urls: string[],
  opts: { max?: number; dryRun?: boolean } = {},
): Promise<{ imageIds: string[]; checks: ImageCheck[]; warnings: Issue[]; blockers: Issue[] }> {
  const max = opts.max ?? 9;
  const unique = [...new Set(urls.map((u) => u?.trim()).filter(Boolean))] as string[];
  const imageIds: string[] = [];
  const checks: ImageCheck[] = [];
  const warnings: Issue[] = [];

  for (const url of unique) {
    if (imageIds.length >= max) break;
    try {
      const prepared = await prepareImage(url);
      checks.push(prepared.check);
      if (prepared.converted) {
        warnings.push({
          level: "info",
          code: "IMAGE_CONVERTED",
          message: "Uma foto foi ajustada automaticamente para o padrão da Shopee.",
          adminHint: `${url} → JPG 1000x1000 (${prepared.check.reason ?? "fora do padrão"})`,
        });
      }
      if (opts.dryRun) {
        imageIds.push(`dry-run:${imageIds.length}`);
        continue;
      }
      imageIds.push(await uploadImageBytes(call, prepared.bytes, prepared.format));
    } catch (e) {
      warnings.push({
        level: "warning",
        code: "IMAGE_SKIPPED",
        message: "Uma foto do catálogo estava quebrada e foi ignorada.",
        adminHint: `${url}: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  const blockers: Issue[] = imageIds.length
    ? []
    : [{
      level: "blocker",
      code: "NO_VALID_IMAGES",
      message: "Nenhuma foto deste produto pôde ser usada (links quebrados ou formato inválido).",
      adminHint: "Troque as fotos do produto no catálogo por links diretos de JPG/PNG (mín. 500x500).",
    }];
  return { imageIds, checks, warnings, blockers };
}
