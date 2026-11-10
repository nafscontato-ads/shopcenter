import { uploadShopeeMedia } from "@/lib/shopee-media";

const MIN_SIDE = 500;
const MAX_SIDE = 1600;
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Shopee rejects photos under 500×500px, above 2 MB or not JPG/PNG. Fix them in
 * the browser by fitting the original (never cropping) on a white square.
 */
export async function prepareShopeeImageBlob(blob: Blob): Promise<Blob | null> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const okType = blob.type === "image/jpeg" || blob.type === "image/png";
  if (okType && width >= MIN_SIDE && height >= MIN_SIDE && blob.size <= MAX_BYTES) { bitmap.close(); return null; }
  const side = Math.min(MAX_SIDE, Math.max(MIN_SIDE, width, height));
  const scale = Math.min(side / width, side / height);
  const drawWidth = Math.round(width * scale);
  const drawHeight = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); return null; }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, side, side);
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, Math.round((side - drawWidth) / 2), Math.round((side - drawHeight) / 2), drawWidth, drawHeight);
  bitmap.close();
  for (const quality of [0.9, 0.8, 0.7, 0.6]) {
    const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (result && result.size <= MAX_BYTES) return result;
  }
  return null;
}

export async function prepareShopeeImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const prepared = await prepareShopeeImageBlob(file).catch(() => null);
  return prepared ? new File([prepared], "foto-shopee.jpg", { type: "image/jpeg" }) : file;
}

/** Returns the same list with every out-of-spec photo replaced by an adjusted copy. */
export async function prepareShopeeImageUrls(urls: string[], productId: string) {
  let changed = 0;
  const result: string[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) { result.push(url); continue; }
      const blob = await response.blob();
      const prepared = await prepareShopeeImageBlob(blob);
      if (!prepared) { result.push(url); continue; }
      const uploaded = await uploadShopeeMedia(new File([prepared], "foto-shopee.jpg", { type: "image/jpeg" }), productId, { adjustedCopy: true });
      result.push(uploaded.url);
      changed += 1;
    } catch {
      result.push(url);
    }
  }
  return { images: result, changed };
}
