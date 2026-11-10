import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-media";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const VIDEO_TYPES = new Set(["video/mp4"]);
const IMAGE_LIMIT = 2 * 1024 * 1024;
const VIDEO_LIMIT = 50 * 1024 * 1024;

export type CatalogMediaKind = "image" | "video";

function fileExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "video/mp4") return "mp4";
  return "bin";
}

export function validateCatalogMedia(file: File, kind: CatalogMediaKind) {
  if (kind === "image" && !IMAGE_TYPES.has(file.type)) throw new Error("Envie fotos JPG ou PNG.");
  if (kind === "video" && !VIDEO_TYPES.has(file.type)) throw new Error("Envie um vídeo MP4.");
  if (kind === "image" && file.size > IMAGE_LIMIT) throw new Error("Cada foto pode ter no máximo 2 MB.");
  if (kind === "video" && file.size > VIDEO_LIMIT) throw new Error("O vídeo pode ter no máximo 50 MB.");
}

export async function uploadCatalogMedia(file: File, productKey: string, kind: CatalogMediaKind) {
  validateCatalogMedia(file, kind);
  const path = `${productKey}/${kind}-${crypto.randomUUID()}.${fileExtension(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Não foi possível enviar ${kind === "image" ? "a foto" : "o vídeo"}.`);

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (signError || !data?.signedUrl) throw new Error("Não foi possível preparar o arquivo enviado.");
  return data.signedUrl;
}