-- products / promotions / launches: split anon vs authenticated policies
DROP POLICY "products public read" ON public.products;
CREATE POLICY "products anon read active" ON public.products FOR SELECT TO anon
  USING (status = 'active');
CREATE POLICY "products auth read" ON public.products FOR SELECT TO authenticated
  USING (status = 'active' OR public.is_admin(auth.uid()));

DROP POLICY "promotions read active" ON public.promotions;
CREATE POLICY "promotions anon read active" ON public.promotions FOR SELECT TO anon
  USING (status = 'active');
CREATE POLICY "promotions auth read" ON public.promotions FOR SELECT TO authenticated
  USING (status = 'active' OR public.is_admin(auth.uid()));

DROP POLICY "launches read" ON public.launches;
CREATE POLICY "launches anon read" ON public.launches FOR SELECT TO anon
  USING (status IN ('active','scheduled'));
CREATE POLICY "launches auth read" ON public.launches FOR SELECT TO authenticated
  USING (status IN ('active','scheduled') OR public.is_admin(auth.uid()));

-- automatic_sales: explicit admin-only read
GRANT SELECT ON public.automatic_sales TO authenticated;
CREATE POLICY "automatic sales admin read" ON public.automatic_sales FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_role_of(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_role_of(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;