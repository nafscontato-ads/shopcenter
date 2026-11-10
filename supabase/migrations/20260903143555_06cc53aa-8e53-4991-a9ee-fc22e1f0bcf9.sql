CREATE TABLE public.influencers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  type text not null default 'feminino',
  source text not null default 'scratch',
  apparent_age text,
  main_niche text,
  secondary_niches text[] default '{}',
  personality_traits text[] default '{}',
  skin_tone text,
  hair_color text,
  hair_length text,
  hair_texture text,
  hair_style text,
  eye_color text,
  face_shape text,
  eyebrow_style text,
  lip_style text,
  nose_style text,
  body_type text,
  height_type text,
  facial_features text[] default '{}',
  expression text,
  hand_shape text,
  nail_style text,
  nail_color text,
  hand_accessories text[] default '{}',
  makeup_style text,
  clothing_style text,
  clothing_items text[] default '{}',
  accessories text[] default '{}',
  color_palette text,
  photography_style text,
  default_scene text,
  custom_scene text,
  lighting text,
  time_of_day text,
  pov_mode boolean not null default false,
  preservation_level text,
  keep_face boolean not null default true,
  keep_hair boolean not null default true,
  character_dna jsonb default '{}'::jsonb,
  character_prompt text,
  negative_prompt text,
  source_image_url text,
  identity_image_url text,
  identity_reference_urls text[] default '{}',
  model_used text,
  quality_mode text default 'standard',
  generation_metadata jsonb default '{}'::jsonb,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencers TO anon;
GRANT ALL ON public.influencers TO service_role;

ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their influencers"
  ON public.influencers FOR ALL TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Guests manage unowned influencers"
  ON public.influencers FOR ALL TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_influencers_updated_at
BEFORE UPDATE ON public.influencers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Read influencer images"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'influencers');

CREATE POLICY "Upload influencer images"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'influencers');