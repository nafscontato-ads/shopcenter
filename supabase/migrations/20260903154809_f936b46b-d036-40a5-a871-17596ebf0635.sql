CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  status text NOT NULL DEFAULT 'active',
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TYPE public.admin_role AS ENUM ('super_admin', 'admin', 'editor', 'support', 'analyst');

CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  role public.admin_role NOT NULL DEFAULT 'admin',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_role_of(_user_id uuid)
RETURNS public.admin_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.admin_users WHERE user_id = _user_id AND is_active = true LIMIT 1;
$$;

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "admin_users self read" ON public.admin_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.admin_users
  SET user_id = NEW.id, updated_at = now()
  WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  promo_price numeric(12,2),
  commission numeric(6,2) NOT NULL DEFAULT 0,
  category text,
  subcategory text,
  brand text,
  sku text,
  url text,
  primary_image text,
  gallery_images text[] NOT NULL DEFAULT '{}',
  viral_score integer NOT NULL DEFAULT 0,
  rating numeric(3,2),
  reviews_label text,
  sold_count integer NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_status_idx ON public.products(status);
CREATE INDEX products_category_idx ON public.products(category);
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public read" ON public.products FOR SELECT TO anon, authenticated
  USING (status = 'active' OR public.is_admin(auth.uid()));

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  final_amount numeric(12,2) NOT NULL DEFAULT 0,
  coupon_code text,
  status text NOT NULL DEFAULT 'pending',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_created_idx ON public.sales(created_at DESC);
GRANT SELECT ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales owner or admin read" ON public.sales FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  start_at timestamptz,
  end_at timestamptz,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  minimum_order_value numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons owner or admin" ON public.coupons FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.coupon_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupon_usage TO authenticated;
GRANT ALL ON public.coupon_usage TO service_role;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupon usage owner or admin" ON public.coupon_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'general',
  description text,
  discount_type text DEFAULT 'percent',
  discount_value numeric(12,2) DEFAULT 0,
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  banner_url text,
  start_at timestamptz,
  end_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promotions TO anon, authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotions read active" ON public.promotions FOR SELECT TO anon, authenticated
  USING (status = 'active' OR public.is_admin(auth.uid()));

CREATE TABLE public.promotion_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  UNIQUE (promotion_id, product_id)
);
GRANT SELECT ON public.promotion_products TO anon, authenticated;
GRANT ALL ON public.promotion_products TO service_role;
ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotion products read" ON public.promotion_products FOR SELECT TO anon, authenticated
  USING (true);

CREATE TABLE public.creator_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid REFERENCES public.promotions(id) ON DELETE CASCADE,
  creator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  influencer_id uuid,
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  commission numeric(6,2) DEFAULT 0,
  start_at timestamptz,
  end_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.creator_promotions TO authenticated;
GRANT ALL ON public.creator_promotions TO service_role;
ALTER TABLE public.creator_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creator promotions read" ON public.creator_promotions FOR SELECT TO authenticated
  USING (creator_user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.launches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  start_at timestamptz,
  end_at timestamptz,
  goal numeric(12,2),
  banner_url text,
  landing_url text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.launches TO anon, authenticated;
GRANT ALL ON public.launches TO service_role;
ALTER TABLE public.launches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "launches read" ON public.launches FOR SELECT TO anon, authenticated
  USING (status IN ('active', 'scheduled') OR public.is_admin(auth.uid()));

CREATE TABLE public.launch_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id uuid NOT NULL REFERENCES public.launches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  UNIQUE (launch_id, product_id)
);
GRANT SELECT ON public.launch_products TO anon, authenticated;
GRANT ALL ON public.launch_products TO service_role;
ALTER TABLE public.launch_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "launch products read" ON public.launch_products FOR SELECT TO anon, authenticated
  USING (true);

CREATE TABLE public.automatic_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  interval_minutes integer NOT NULL DEFAULT 60,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  start_at timestamptz,
  end_at timestamptz,
  status text NOT NULL DEFAULT 'inactive',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.automatic_sales TO service_role;
ALTER TABLE public.automatic_sales ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.product_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid,
  filename text,
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  warning_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_import_jobs TO authenticated;
GRANT ALL ON public.product_import_jobs TO service_role;
ALTER TABLE public.product_import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import jobs admin read" ON public.product_import_jobs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE public.product_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.product_import_jobs(id) ON DELETE CASCADE,
  row_number integer NOT NULL DEFAULT 0,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  product_id uuid,
  status text NOT NULL DEFAULT 'pending',
  error text
);
GRANT SELECT ON public.product_import_rows TO authenticated;
GRANT ALL ON public.product_import_rows TO service_role;
ALTER TABLE public.product_import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import rows admin read" ON public.product_import_rows FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid,
  admin_email text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_logs_created_idx ON public.admin_logs(created_at DESC);
GRANT SELECT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs admin read" ON public.admin_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE public.admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings admin read" ON public.admin_settings FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

INSERT INTO public.admin_settings (key, value) VALUES
  ('general', '{"platform_name":"PAS","support_email":null}'::jsonb),
  ('ai', '{"image_provider":"lovable-ai","video_provider":null,"default_image_model":"google/gemini-3-pro-image-preview","default_video_model":null,"quality":"high","monthly_generation_limit":null}'::jsonb);

CREATE TRIGGER products_updated BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER admin_users_updated BEFORE UPDATE ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER coupons_updated BEFORE UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER promotions_updated BEFORE UPDATE ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER launches_updated BEFORE UPDATE ON public.launches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.products (name, price, commission, rating, reviews_label, category, viral_score, status, tags) VALUES
  ('Capa Anti-Impacto Transparente com Proteção de Câmera', 34.90, 25, 4.9, '13 mil', 'Acessórios de Celular', 98, 'active', ARRAY['viral']),
  ('Suporte Celular Veicular Magnético Reforçado', 29.90, 26, 4.8, '11 mil', 'Automotivo', 96, 'active', ARRAY['viral']),
  ('Película de Vidro 3D Kit 2 Unidades', 24.90, 27, 4.9, '11 mil', 'Acessórios de Celular', 95, 'active', ARRAY['viral']),
  ('Kit Faixas Elásticas de Resistência 5 Peças', 39.90, 25, 4.7, '7,3 mil', 'Fitness e Suplementos', 93, 'active', ARRAY['viral']),
  ('Fone Bluetooth TWS Pro 5.3', 79.90, 24, 4.8, '22 mil', 'Eletrônicos', 92, 'active', ARRAY['viral']),
  ('Kit Skincare Vitamina C', 59.90, 28, 4.9, '9,1 mil', 'Beleza e Cuidados', 91, 'active', ARRAY['viral']),
  ('Organizador de Geladeira 6 Peças', 44.90, 22, 4.7, '5,6 mil', 'Casa e Cozinha', 84, 'active', '{}'),
  ('Kit Chaves de Precisão 115 em 1', 79.90, 20, 4.8, '4,2 mil', 'Ferramentas', 80, 'active', '{}');