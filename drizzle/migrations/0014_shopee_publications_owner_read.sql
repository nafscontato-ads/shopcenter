CREATE POLICY "Usuarios leem publicacoes das proprias lojas" ON public.shopee_publications
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shopee_shop_connections c
    WHERE c.shop_id = shopee_publications.shop_id AND c.user_id = auth.uid()
  ));
GRANT SELECT ON public.shopee_publications TO authenticated;