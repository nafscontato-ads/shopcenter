CREATE TABLE public.supplier_site_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  external_id text NOT NULL,
  sku_id text,
  title text NOT NULL,
  brand text,
  category text,
  price numeric(12,2),
  list_price numeric(12,2),
  available boolean NOT NULL DEFAULT true,
  image_url text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  url text NOT NULL,
  ean text,
  description text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);
GRANT ALL ON public.supplier_site_products TO service_role;
ALTER TABLE public.supplier_site_products ENABLE ROW LEVEL SECURITY;
CREATE INDEX supplier_site_products_source_title_idx ON public.supplier_site_products (source, lower(title));
COMMENT ON TABLE public.supplier_site_products IS 'Owner-only test catalogue imported from supplier websites; read and written only by admin server functions.';