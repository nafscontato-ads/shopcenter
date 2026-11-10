ALTER TABLE public.partner_profiles
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS brand_logo text,
  ADD COLUMN IF NOT EXISTS brand_color text,
  ADD COLUMN IF NOT EXISTS sidebar_side text NOT NULL DEFAULT 'left';
ALTER TABLE public.partner_profiles
  ADD CONSTRAINT partner_brand_name_len CHECK (brand_name IS NULL OR char_length(brand_name) BETWEEN 1 AND 40),
  ADD CONSTRAINT partner_brand_logo_len CHECK (brand_logo IS NULL OR (char_length(brand_logo) <= 400000 AND brand_logo LIKE 'data:image/%')),
  ADD CONSTRAINT partner_brand_color_fmt CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9a-fA-F]{6}$'),
  ADD CONSTRAINT partner_sidebar_side_val CHECK (sidebar_side IN ('left','right'));

CREATE OR REPLACE FUNCTION public.resolve_partner_branding(_slug text)
RETURNS TABLE(brand_name text, brand_logo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  select p.brand_name, p.brand_logo from public.partner_profiles p
  where p.slug = lower(_slug) and p.status in ('active','approved') limit 1
$$;
GRANT EXECUTE ON FUNCTION public.resolve_partner_branding(text) TO anon, authenticated;