import { supabase } from "@/integrations/supabase/client";

const db = (table: string) => (supabase as unknown as { from: (t: string) => any }).from(table);

export type StudioProjectRow = {
  id: string;
  name: string;
  influencer_id: string | null;
  product_id: string | null;
  product_data: Record<string, unknown> | null;
  scene_data: Record<string, unknown> | null;
  style: string | null;
  style_dna: Record<string, unknown> | null;
  camera_settings: Record<string, unknown> | null;
  lighting_settings: Record<string, unknown> | null;
  audio_settings: Record<string, unknown> | null;
  dialogue: string | null;
  duration: number | null;
  aspect_ratio: string | null;
  quality: string | null;
  image_prompt: string | null;
  video_prompt: string | null;
  audio_prompt: string | null;
  negative_prompt: string | null;
  flow_recipe: Record<string, unknown> | null;
  master_frame_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type StudioGenerationRow = {
  id: string;
  project_id: string | null;
  kind: string;
  url: string | null;
  prompt: string | null;
  model: string | null;
  favorite: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function saveProject(input: Partial<StudioProjectRow> & { name: string }) {
  const { data, error } = await db("studio_projects").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data as StudioProjectRow;
}

export async function updateProject(id: string, patch: Partial<StudioProjectRow>) {
  const { data, error } = await db("studio_projects").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as StudioProjectRow;
}

export async function listProjects(limit = 30) {
  const { data, error } = await db("studio_projects")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as StudioProjectRow[];
}

export async function deleteProject(id: string) {
  const { error } = await db("studio_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function saveGeneration(input: Partial<StudioGenerationRow>) {
  const { data, error } = await db("studio_generations").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data as StudioGenerationRow;
}

export async function listGenerations(limit = 40) {
  const { data, error } = await db("studio_generations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as StudioGenerationRow[];
}

export async function toggleFavorite(id: string, favorite: boolean) {
  const { error } = await db("studio_generations").update({ favorite }).eq("id", id);
  if (error) throw new Error(error.message);
}
