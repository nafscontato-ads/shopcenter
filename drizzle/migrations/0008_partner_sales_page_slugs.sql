ALTER TABLE public.partner_profiles
ADD COLUMN slug text;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS position
  FROM public.partner_profiles
)
UPDATE public.partner_profiles AS partner
SET slug = numbered.position::text
FROM numbered
WHERE partner.id = numbered.id
  AND partner.slug IS NULL;

ALTER TABLE public.partner_profiles
ADD CONSTRAINT partner_profiles_slug_format
CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') NOT VALID;

CREATE UNIQUE INDEX partner_profiles_slug_unique
ON public.partner_profiles (lower(slug))
WHERE slug IS NOT NULL;

COMMENT ON COLUMN public.partner_profiles.slug IS 'Public sales-page slug used at /fornecedor/:slug.';
COMMENT ON TABLE public.partner_coupons IS 'DEPRECATED for partner sales pages: replaced by partner_profiles.slug; retained for historical records.';

CREATE OR REPLACE FUNCTION public.resolve_partner_by_slug(_slug text)
RETURNS TABLE(
  slug text,
  partner_name text,
  checkout_lifetime_url text,
  checkout_monthly_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.slug,
    p.name,
    p.checkout_lifetime_url,
    p.checkout_monthly_url
  FROM public.partner_profiles AS p
  WHERE lower(p.slug) = lower(trim(_slug))
    AND p.status = 'active'
    AND NULLIF(trim(p.checkout_lifetime_url), '') IS NOT NULL
    AND NULLIF(trim(p.checkout_monthly_url), '') IS NOT NULL
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_partner_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_partner_by_slug(text) TO anon, authenticated, service_role;