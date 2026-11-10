CREATE OR REPLACE FUNCTION public.owns_shopee_shop(_shop_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shopee_shop_connections
    WHERE shop_id = _shop_id AND user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.owns_shopee_shop(bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.owns_shopee_shop(bigint) TO authenticated;

DROP POLICY IF EXISTS "Usuarios leem publicacoes das proprias lojas" ON public.shopee_publications;
CREATE POLICY "Usuarios leem publicacoes das proprias lojas" ON public.shopee_publications
  FOR SELECT TO authenticated
  USING (public.owns_shopee_shop(shop_id));