ALTER TABLE public.shopee_listings
ADD COLUMN IF NOT EXISTS is_max_ad boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.shopee_listings.is_max_ad IS 'Controls whether the PAS price calculation includes the estimated 16 percent Shopee MAX fee; it does not activate a paid Shopee Ads campaign.';