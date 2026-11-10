-- Owner view "Publicar do Shop Center": only listings that may carry new photos or a new
-- description, prefiltered in the database so the app no longer downloads every listing.
CREATE OR REPLACE FUNCTION public.pas_community_listing_candidates()
RETURNS TABLE (
  product_id uuid,
  user_id uuid,
  images text[],
  updated_at timestamptz,
  description text,
  primary_image text,
  gallery_images text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH listing AS (
    SELECT l.product_id, l.user_id, l.images, l.updated_at, l.description,
           p.primary_image, p.gallery_images, p.description AS catalog_description,
           regexp_replace(btrim(coalesce(l.description, '')), '\s+', ' ', 'g') AS text_norm
    FROM public.shopee_listings l
    JOIN public.products p ON p.id = l.product_id AND p.status = 'active'
  )
  SELECT x.product_id, x.user_id, x.images, x.updated_at,
         CASE WHEN length(x.text_norm) >= 40
                AND x.text_norm <> regexp_replace(btrim(coalesce(x.catalog_description, '')), '\s+', ' ', 'g')
              THEN x.description END,
         x.primary_image, x.gallery_images
  FROM listing x
  WHERE EXISTS (
          SELECT 1 FROM unnest(coalesce(x.images, ARRAY[]::text[])) AS img(url)
          WHERE btrim(img.url) ~* '^https?://'
            AND btrim(img.url) !~ '/adjusted-[^/?]+(\?|$)'
            AND btrim(img.url) IS DISTINCT FROM btrim(coalesce(x.primary_image, ''))
            AND NOT (btrim(img.url) = ANY (coalesce(x.gallery_images, ARRAY[]::text[])))
        )
     OR (length(x.text_norm) >= 40
         AND x.text_norm <> regexp_replace(btrim(coalesce(x.catalog_description, '')), '\s+', ' ', 'g'))
  ORDER BY x.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.pas_community_listing_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pas_community_listing_candidates() TO service_role;