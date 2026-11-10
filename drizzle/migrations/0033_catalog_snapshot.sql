-- Ready-made copy of the public catalogue text, so opening Catálogos/Integração reads one row
-- instead of rebuilding ~10k products. Any product change marks it outdated.
CREATE TABLE IF NOT EXISTS public.catalog_snapshot (
  id text PRIMARY KEY DEFAULT 'main',
  body text,
  built_at timestamptz,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.catalog_snapshot TO service_role;
ALTER TABLE public.catalog_snapshot ENABLE ROW LEVEL SECURITY;
-- No policies: only the server (service role) reads or writes it.

CREATE OR REPLACE FUNCTION public.pas_mark_catalog_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.catalog_snapshot (id, changed_at) VALUES ('main', now())
  ON CONFLICT (id) DO UPDATE SET changed_at = now();
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.pas_mark_catalog_changed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS products_catalog_changed ON public.products;
CREATE TRIGGER products_catalog_changed
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH STATEMENT EXECUTE FUNCTION public.pas_mark_catalog_changed();