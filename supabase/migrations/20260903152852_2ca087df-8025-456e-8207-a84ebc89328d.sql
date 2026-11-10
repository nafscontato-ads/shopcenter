CREATE TABLE public.studio_scenes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_scenes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_scenes TO anon;
GRANT ALL ON public.studio_scenes TO service_role;
ALTER TABLE public.studio_scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scenes owner or anon" ON public.studio_scenes FOR ALL
  USING (user_id IS NULL OR user_id = auth.uid())
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE TABLE public.studio_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  influencer_id UUID,
  product_id TEXT,
  product_data JSONB,
  scene_id UUID,
  scene_data JSONB,
  style TEXT,
  style_dna JSONB,
  camera_settings JSONB,
  lighting_settings JSONB,
  audio_settings JSONB,
  dialogue TEXT,
  duration INTEGER,
  aspect_ratio TEXT,
  quality TEXT,
  image_prompt TEXT,
  video_prompt TEXT,
  audio_prompt TEXT,
  negative_prompt TEXT,
  flow_recipe JSONB,
  master_frame_url TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_projects TO anon;
GRANT ALL ON public.studio_projects TO service_role;
ALTER TABLE public.studio_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects owner or anon" ON public.studio_projects FOR ALL
  USING (user_id IS NULL OR user_id = auth.uid())
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE TABLE public.studio_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  project_id UUID REFERENCES public.studio_projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'image',
  url TEXT,
  prompt TEXT,
  model TEXT,
  favorite BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_generations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_generations TO anon;
GRANT ALL ON public.studio_generations TO service_role;
ALTER TABLE public.studio_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "generations owner or anon" ON public.studio_generations FOR ALL
  USING (user_id IS NULL OR user_id = auth.uid())
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_studio_projects_updated_at BEFORE UPDATE ON public.studio_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();