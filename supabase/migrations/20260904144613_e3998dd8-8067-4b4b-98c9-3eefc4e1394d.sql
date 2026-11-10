CREATE TABLE public.facebook_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  facebook_url TEXT NOT NULL,
  image_url TEXT,
  members_count TEXT,
  heat TEXT NOT NULL DEFAULT 'Alta',
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.facebook_groups TO anon;
GRANT SELECT ON public.facebook_groups TO authenticated;
GRANT ALL ON public.facebook_groups TO service_role;
ALTER TABLE public.facebook_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active groups" ON public.facebook_groups FOR SELECT USING (is_active);

CREATE TABLE public.product_copies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_copies_product_idx ON public.product_copies(product_id);
GRANT SELECT ON public.product_copies TO anon;
GRANT SELECT ON public.product_copies TO authenticated;
GRANT ALL ON public.product_copies TO service_role;
ALTER TABLE public.product_copies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view product copies" ON public.product_copies FOR SELECT USING (true);

INSERT INTO public.facebook_groups (name, facebook_url, members_count, heat, position) VALUES
('Achadinhos Shopee Brasil', 'https://www.facebook.com/search/groups/?q=achadinhos%20shopee%20brasil', '412 mil', 'Alta', 1),
('Promoções e Cupons Shopee', 'https://www.facebook.com/search/groups/?q=promo%C3%A7%C3%B5es%20e%20cupons%20shopee', '287 mil', 'Alta', 2),
('Ofertas do Dia — Casa e Cozinha', 'https://www.facebook.com/search/groups/?q=ofertas%20casa%20e%20cozinha', '132 mil', 'Média', 3),
('Tech Barato Brasil', 'https://www.facebook.com/search/groups/?q=tech%20barato%20brasil', '96 mil', 'Média', 4),
('Beleza e Cuidados em Promoção', 'https://www.facebook.com/search/groups/?q=beleza%20promo%C3%A7%C3%A3o%20shopee', '74 mil', 'Média', 5),
('Achados Fitness e Suplementos', 'https://www.facebook.com/search/groups/?q=achados%20fitness%20shopee', '58 mil', 'Alta', 6);