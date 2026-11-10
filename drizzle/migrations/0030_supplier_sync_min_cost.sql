CREATE OR REPLACE FUNCTION public.pas_sync_supplier_catalog(_source text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _upserted integer;
  _hidden integer;
  _cheap integer;
  -- Owner rule: products costing less than this are kept out of the catalogue,
  -- unless a customer already saved or published them.
  _min_cost constant numeric := 8;
BEGIN
  INSERT INTO public.products AS p (
    name, description, price, promo_price, commission, category, subcategory, brand, sku,
    primary_image, gallery_images, viral_score, sold_count, tags, status,
    supplier_source, supplier_external_id, supplier_url, supplier_cost
  )
  SELECT
    s.title,
    s.description,
    round(s.price / 0.65, 2),
    NULL,
    26,
    public.pas_supplier_category(s.category),
    nullif(split_part(s.category, ' / ', 2), ''),
    s.brand,
    s.sku_id,
    s.image_url,
    ARRAY(SELECT jsonb_array_elements_text(s.images)),
    60 + least(39, greatest(0, CASE WHEN s.list_price > s.price THEN round((1 - s.price / s.list_price) * 100)::int ELSE 0 END)),
    0,
    ARRAY[]::text[],
    'active',
    s.source, s.external_id, s.url, s.price
  FROM public.supplier_site_products s
  WHERE s.source = _source AND s.available AND s.price IS NOT NULL AND s.image_url IS NOT NULL
  ON CONFLICT (supplier_source, supplier_external_id) WHERE supplier_source IS NOT NULL
  DO UPDATE SET
    name = excluded.name,
    description = coalesce(excluded.description, p.description),
    price = excluded.price,
    category = excluded.category,
    subcategory = excluded.subcategory,
    brand = excluded.brand,
    sku = excluded.sku,
    primary_image = excluded.primary_image,
    gallery_images = excluded.gallery_images,
    viral_score = excluded.viral_score,
    status = 'active',
    supplier_url = excluded.supplier_url,
    supplier_cost = excluded.supplier_cost,
    updated_at = now();
  GET DIAGNOSTICS _upserted = ROW_COUNT;

  UPDATE public.products p
  SET status = 'inactive', updated_at = now()
  WHERE p.supplier_source = _source AND p.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.supplier_site_products s
      WHERE s.source = _source AND s.external_id = p.supplier_external_id
        AND s.available AND s.price IS NOT NULL AND s.image_url IS NOT NULL
    );
  GET DIAGNOSTICS _hidden = ROW_COUNT;

  UPDATE public.products p
  SET status = 'inactive', updated_at = now()
  WHERE p.supplier_source = _source AND p.status = 'active'
    AND p.supplier_cost < _min_cost
    AND NOT EXISTS (SELECT 1 FROM public.saved_products sp WHERE sp.product_id::text = p.id::text)
    AND NOT EXISTS (SELECT 1 FROM public.shopee_listings sl WHERE sl.product_id::text = p.id::text);
  GET DIAGNOSTICS _cheap = ROW_COUNT;

  RETURN jsonb_build_object('active', _upserted - _cheap, 'hidden', _hidden + _cheap);
END;
$function$;