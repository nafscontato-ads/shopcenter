ALTER TABLE public.products
  ADD COLUMN supplier_source text,
  ADD COLUMN supplier_external_id text,
  ADD COLUMN supplier_url text,
  ADD COLUMN supplier_cost numeric(12,2);

CREATE UNIQUE INDEX products_supplier_ref_idx
  ON public.products (supplier_source, supplier_external_id)
  WHERE supplier_source IS NOT NULL;

COMMENT ON COLUMN public.products.supplier_source IS 'Supplier website the product was imported from (see src/lib/supplier-sites.ts); null for legacy catalogue products.';
COMMENT ON COLUMN public.products.supplier_url IS 'Purchase page on the supplier website, opened from the seller orders list.';
COMMENT ON COLUMN public.products.supplier_cost IS 'Price shown on the supplier website, used as the product cost.';

CREATE OR REPLACE FUNCTION public.pas_supplier_category(_path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE split_part(coalesce(_path, ''), ' / ', 1)
    WHEN '' THEN 'Outros'
    WHEN 'cameba' THEN 'Cama, Mesa e Banho'
    WHEN 'Pet e Lazer2' THEN 'Pet e Lazer'
    WHEN 'Caderno2' THEN 'Papelaria'
    WHEN 'Eletronico' THEN 'Eletrônicos'
    WHEN 'Eletrodomésticos novos' THEN 'Eletrodomésticos'
    WHEN 'Outlet' THEN 'Eletrodomésticos'
    WHEN 'Carros' THEN 'Automotivo'
    WHEN 'Cadeira De Praia' THEN 'Bricolagem'
    ELSE split_part(_path, ' / ', 1)
  END
$$;

-- Copies one supplier's imported products into the PAS catalogue (insert or refresh),
-- and hides that supplier's products that are no longer sellable.
CREATE OR REPLACE FUNCTION public.pas_sync_supplier_catalog(_source text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _upserted integer;
  _hidden integer;
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

  RETURN jsonb_build_object('active', _upserted, 'hidden', _hidden);
END;
$$;

REVOKE ALL ON FUNCTION public.pas_sync_supplier_catalog(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pas_sync_supplier_catalog(text) TO service_role;