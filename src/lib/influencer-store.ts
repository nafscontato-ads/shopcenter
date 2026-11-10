import { supabase } from "@/integrations/supabase/client";

import type { CharacterDNA, InfluencerCatalogRow, InfluencerRow } from "./character-dna";

const TABLE = "influencers";

// The generated Database types are refreshed asynchronously; keep the client
// untyped for this table so the app compiles right after the migration.
const db = () => (supabase as unknown as { from: (t: string) => any }).from(TABLE);

export type SaveInfluencerInput = CharacterDNA & {
  character_prompt: string;
  negative_prompt: string;
  identity_image_url: string;
  identity_reference_urls: string[];
  source_image_url?: string | null;
  model_used: string;
  quality_mode: string;
  generation_metadata?: Record<string, unknown>;
};

const columns = [
  "name",
  "type",
  "source",
  "apparent_age",
  "main_niche",
  "secondary_niches",
  "personality_traits",
  "skin_tone",
  "hair_color",
  "hair_length",
  "hair_texture",
  "hair_style",
  "eye_color",
  "face_shape",
  "eyebrow_style",
  "lip_style",
  "nose_style",
  "body_type",
  "height_type",
  "facial_features",
  "expression",
  "hand_shape",
  "nail_style",
  "nail_color",
  "hand_accessories",
  "makeup_style",
  "clothing_style",
  "clothing_items",
  "accessories",
  "color_palette",
  "photography_style",
  "default_scene",
  "custom_scene",
  "lighting",
  "time_of_day",
  "pov_mode",
  "preservation_level",
  "keep_face",
  "keep_hair",
  "character_prompt",
  "negative_prompt",
  "source_image_url",
  "identity_image_url",
  "identity_reference_urls",
  "model_used",
  "quality_mode",
  "generation_metadata",
] as const;

export async function listInfluencers(): Promise<InfluencerRow[]> {
  const { data, error } = await db().select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as InfluencerRow[];
}

export async function listInfluencerCatalog(): Promise<InfluencerCatalogRow[]> {
  const catalog = (supabase as unknown as { from: (t: string) => any }).from("influencer_catalog");
  const { data, error } = await catalog.select("*").eq("is_active", true).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as InfluencerCatalogRow[];
}

export async function saveCatalogInfluencer(item: InfluencerCatalogRow): Promise<InfluencerRow> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Entre na sua conta para salvar um influenciador.");

  const payload = {
    user_id: userId,
    catalog_source_id: item.id,
    name: item.name,
    type: item.type,
    source: "image",
    main_niche: "Afiliados Shopee",
    photography_style: "UGC / Smartphone",
    preservation_level: "Muito fiel",
    keep_face: true,
    keep_hair: true,
    pov_mode: false,
    character_dna: {
      name: item.name,
      type: item.type,
      source: "image",
      main_niche: "Afiliados Shopee",
      photography_style: "UGC / Smartphone",
      preservation_level: "Muito fiel",
      keep_face: true,
      keep_hair: true,
      pov_mode: false,
    },
    character_prompt: item.character_prompt,
    negative_prompt: item.negative_prompt,
    source_image_url: item.image_url,
    identity_image_url: item.image_url,
    identity_reference_urls: item.reference_urls.length ? item.reference_urls : [item.image_url],
    model_used: "catalog-reference",
    quality_mode: "reference",
    generation_metadata: { catalog_source_id: item.id },
  };
  const { data, error } = await db().insert(payload).select().single();
  if (error) {
    if (error.code === "23505") throw new Error("Este influenciador já está salvo na sua conta.");
    throw new Error(error.message);
  }
  return data as InfluencerRow;
}

export async function getInfluencer(id: string): Promise<InfluencerRow | null> {
  const { data, error } = await db().select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as InfluencerRow | null;
}

export async function saveInfluencer(input: SaveInfluencerInput): Promise<InfluencerRow> {
  const { data: session } = await supabase.auth.getSession();
  const payload: Record<string, unknown> = {
    user_id: session.session?.user.id ?? null,
    character_dna: input as unknown as Record<string, unknown>,
  };
  for (const key of columns) {
    const value = (input as Record<string, unknown>)[key];
    if (value !== undefined) payload[key] = value;
  }
  const { data, error } = await db().insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as InfluencerRow;
}

export async function deleteInfluencer(id: string) {
  const { error } = await db().delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function duplicateInfluencer(row: InfluencerRow): Promise<InfluencerRow> {
  const clone: Record<string, unknown> = { ...row };
  delete clone['id'];
  delete clone['created_at'];
  delete clone['updated_at'];
  clone['name'] = `${row.name} (cópia)`;
  clone['usage_count'] = 0;
  const { data, error } = await db().insert(clone).select().single();
  if (error) throw new Error(error.message);
  return data as InfluencerRow;
}

export async function uploadReferenceImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `references/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("influencers").upload(path, file, {
    contentType: file.type || "image/jpeg",
  });
  if (error) throw new Error(error.message);
  const { data, error: signErr } = await supabase.storage
    .from("influencers")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (signErr || !data?.signedUrl) throw new Error("Não foi possível gerar o link da imagem.");
  return data.signedUrl;
}
