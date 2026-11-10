-- Precomputed whitespace-normalized description fingerprints so the owner's
-- "Publicar do Shop Center" prefilter compares short keys instead of long texts.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description_key text
  GENERATED ALWAYS AS (md5(regexp_replace(btrim(coalesce(description, '')), '\s+', ' ', 'g'))) STORED;

ALTER TABLE public.shopee_listings
  ADD COLUMN IF NOT EXISTS description_key text
  GENERATED ALWAYS AS (md5(regexp_replace(btrim(coalesce(description, '')), '\s+', ' ', 'g'))) STORED;

ALTER TABLE public.shopee_listings
  ADD COLUMN IF NOT EXISTS description_len integer
  GENERATED ALWAYS AS (length(regexp_replace(btrim(coalesce(description, '')), '\s+', ' ', 'g'))) STORED;

DROP FUNCTION IF EXISTS public.pas_community_listing_candidates();

-- One call, one JSON array (no 1000-row page limit): listings that may carry new photos
-- or a new description, with their catalogue photos. Exact selection happens in the app.
CREATE OR REPLACE FUNCTION public.pas_community_listing_candidates()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'product_id', x.product_id,
           'user_id', x.user_id,
           'images', x.images,
           'updated_at', x.updated_at,
           'description', CASE WHEN x.new_text THEN x.description END,
           'primary_image', x.primary_image,
           'gallery_images', x.gallery_images
         ) ORDER BY x.updated_at DESC), '[]'::jsonb)
  FROM (
    SELECT l.product_id, l.user_id, l.images, l.updated_at, l.description,
           p.primary_image, p.gallery_images,
           (l.description_len >= 40 AND l.description_key <> p.description_key) AS new_text
    FROM public.shopee_listings l
    JOIN public.products p ON p.id = l.product_id AND p.status = 'active'
  ) x
  WHERE x.new_text
     OR EXISTS (
          SELECT 1 FROM unnest(coalesce(x.images, ARRAY[]::text[])) AS img(url)
          WHERE btrim(img.url) ~* '^https?://'
            AND btrim(img.url) !~ '/adjusted-[^/?]+(\?|$)'
            AND btrim(img.url) IS DISTINCT FROM btrim(coalesce(x.primary_image, ''))
            AND NOT (btrim(img.url) = ANY (coalesce(x.gallery_images, ARRAY[]::text[])))
        );
$$;

REVOKE ALL ON FUNCTION public.pas_community_listing_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pas_community_listing_candidates() TO service_role;