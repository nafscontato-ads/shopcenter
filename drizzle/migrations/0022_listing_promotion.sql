ALTER TABLE public.shopee_listings
  ADD COLUMN promoted boolean NOT NULL DEFAULT false,
  ADD COLUMN promoted_at timestamptz;

COMMENT ON COLUMN public.shopee_listings.promoted IS 'Seller turned on "Promover anúncio"; each paid sale of this item after promoted_at adds the promotion fee shown in Financeiro.';
COMMENT ON COLUMN public.shopee_listings.is_max_ad IS 'DEPRECATED: the 16% MAX estimate was replaced by promoted / promoted_at.';