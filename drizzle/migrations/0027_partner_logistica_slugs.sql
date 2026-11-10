ALTER TABLE public.partner_profiles ADD COLUMN IF NOT EXISTS legacy_slugs text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.partner_profiles_slug_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    PERFORM pg_advisory_xact_lock(hashtext('partner_profiles_slug'));
    SELECT coalesce(max((substring(p.slug from '^logistica-([0-9]+)$'))::integer), 0) + 1
      INTO n
      FROM public.partner_profiles p
     WHERE p.slug ~ '^logistica-[0-9]+$';
    NEW.slug := 'logistica-' || lpad(n::text, 2, '0');
  ELSE
    NEW.slug := lower(btrim(NEW.slug));
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND OLD.slug IS DISTINCT FROM NEW.slug THEN
    NEW.legacy_slugs := array_append(array_remove(coalesce(NEW.legacy_slugs, '{}'), OLD.slug), OLD.slug);
  END IF;
  NEW.legacy_slugs := array_remove(coalesce(NEW.legacy_slugs, '{}'), NEW.slug);
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.partner_profiles_slug_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS partner_profiles_slug_guard ON public.partner_profiles;
CREATE TRIGGER partner_profiles_slug_guard
BEFORE INSERT OR UPDATE OF slug ON public.partner_profiles
FOR EACH ROW EXECUTE FUNCTION public.partner_profiles_slug_guard();

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.partner_profiles
)
UPDATE public.partner_profiles p
   SET slug = 'logistica-' || lpad(o.rn::text, 2, '0')
  FROM ordered o
 WHERE o.id = p.id;

CREATE OR REPLACE FUNCTION public.resolve_partner_legacy_slug(_slug text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.slug
  FROM public.partner_profiles p
  WHERE lower(btrim(_slug)) = ANY (p.legacy_slugs)
    AND p.status = 'active'
    AND p.slug IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.partner_profiles c WHERE lower(c.slug) = lower(btrim(_slug))
    )
  ORDER BY p.updated_at DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_partner_legacy_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_partner_legacy_slug(text) TO anon, authenticated, service_role;