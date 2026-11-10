CREATE TABLE public.shopee_shop_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id bigint NOT NULL,
  merchant_id bigint,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  refresh_token_expires_at timestamptz,
  region text NOT NULL DEFAULT 'BR',
  shop_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'disconnected', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, shop_id)
);
GRANT ALL ON public.shopee_shop_connections TO service_role;
ALTER TABLE public.shopee_shop_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.shopee_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.shopee_oauth_states TO service_role;
ALTER TABLE public.shopee_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.shopee_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  connection_id uuid REFERENCES public.shopee_shop_connections(id) ON DELETE SET NULL,
  shopee_item_id bigint,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'publishing', 'reviewing', 'published', 'rejected', 'failed', 'unlisted', 'deleted')),
  status_detail text,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(12,2) NOT NULL CHECK (price > 0),
  stock integer NOT NULL DEFAULT 1 CHECK (stock >= 0),
  sku text,
  condition text NOT NULL DEFAULT 'NEW' CHECK (condition IN ('NEW', 'USED')),
  category_id bigint,
  category_name text,
  attributes jsonb NOT NULL DEFAULT '[]'::jsonb,
  variations jsonb NOT NULL DEFAULT '[]'::jsonb,
  logistics jsonb NOT NULL DEFAULT '[]'::jsonb,
  weight numeric(10,3),
  package_length numeric(10,2),
  package_width numeric(10,2),
  package_height numeric(10,2),
  images text[] NOT NULL DEFAULT '{}',
  shopee_image_ids text[] NOT NULL DEFAULT '{}',
  shopee_link text,
  request_payload jsonb,
  response_payload jsonb,
  last_synced_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopee_listings TO authenticated;
GRANT ALL ON public.shopee_listings TO service_role;
ALTER TABLE public.shopee_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own Shopee listings"
ON public.shopee_listings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX shopee_connections_user_idx ON public.shopee_shop_connections(user_id);
CREATE INDEX shopee_oauth_states_user_expiry_idx ON public.shopee_oauth_states(user_id, expires_at);
CREATE INDEX shopee_listings_user_created_idx ON public.shopee_listings(user_id, created_at DESC);
CREATE INDEX shopee_listings_product_idx ON public.shopee_listings(product_id);

CREATE TRIGGER update_shopee_shop_connections_updated_at
BEFORE UPDATE ON public.shopee_shop_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shopee_listings_updated_at
BEFORE UPDATE ON public.shopee_listings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();