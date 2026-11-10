CREATE TABLE public.influencer_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'feminino',
  image_url text NOT NULL,
  reference_urls text[] NOT NULL DEFAULT '{}',
  character_prompt text NOT NULL,
  negative_prompt text NOT NULL DEFAULT '',
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT influencer_catalog_sort_order_key UNIQUE (sort_order)
);

GRANT SELECT ON public.influencer_catalog TO authenticated;
GRANT ALL ON public.influencer_catalog TO service_role;

ALTER TABLE public.influencer_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read active influencer catalog"
ON public.influencer_catalog
FOR SELECT
TO authenticated
USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage influencer catalog"
ON public.influencer_catalog
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_influencer_catalog_updated_at
BEFORE UPDATE ON public.influencer_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.influencers
ADD COLUMN catalog_source_id uuid REFERENCES public.influencer_catalog(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX influencers_user_catalog_source_unique
ON public.influencers (user_id, catalog_source_id)
WHERE catalog_source_id IS NOT NULL;

COMMENT ON COLUMN public.influencers.catalog_source_id IS 'Catálogo compartilhado de origem; impede salvar a mesma opção duas vezes por conta.';