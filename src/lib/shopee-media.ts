import { supabase } from "@/integrations/supabase/client";

const BUCKET = "shopee-media";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const VIDEO_TYPES = new Set(["video/mp4"]);
const IMAGE_LIMIT = 2 * 1024 * 1024;
const VIDEO_LIMIT = 50 * 1024 * 1024;

export type UploadedShopeeMedia = {
  kind: "image" | "video";
  url: string;
};

function safeExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "video/mp4") return "mp4";
  return "bin";
}

/** `adjustedCopy` marks a PAS re-encoded catalogue photo, so it is never mistaken for a new photo the user added. */
export async function uploadShopeeMedia(file: File, productId: string, options: { adjustedCopy?: boolean } = {}): Promise<UploadedShopeeMedia> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Entre na sua conta para enviar arquivos.");

  const kind = IMAGE_TYPES.has(file.type) ? "image" : VIDEO_TYPES.has(file.type) ? "video" : null;
  if (!kind) throw new Error("Envie uma foto JPG/PNG ou um vídeo MP4.");
  if (kind === "image" && file.size > IMAGE_LIMIT) throw new Error("Cada foto pode ter no máximo 2 MB.");
  if (kind === "video" && file.size > VIDEO_LIMIT) throw new Error("O vídeo pode ter no máximo 50 MB.");

  const prefix = options.adjustedCopy ? "adjusted" : kind;
  const path = `${userData.user.id}/${productId}/${prefix}-${crypto.randomUUID()}.${safeExtension(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Não foi possível enviar ${kind === "image" ? "a foto" : "o vídeo"}.`);

  const { data, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (signError || !data?.signedUrl) throw new Error("Não foi possível preparar o arquivo enviado.");
  return { kind, url: data.signedUrl };
}