-- Simulation/dashboard data: signed-in accounts only (was readable by anyone on the internet).
DROP POLICY IF EXISTS "simulation_settings readable" ON public.simulation_settings;
CREATE POLICY "simulation_settings signed-in read" ON public.simulation_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "simulation_product_settings readable" ON public.simulation_product_settings;
CREATE POLICY "simulation_product_settings signed-in read" ON public.simulation_product_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "sales_months readable" ON public.sales_months;
CREATE POLICY "sales_months signed-in read" ON public.sales_months FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "sales_month_products readable" ON public.sales_month_products;
CREATE POLICY "sales_month_products signed-in read" ON public.sales_month_products FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
-- Generated simulated sales are only read by the admin tools.
DROP POLICY IF EXISTS "simulation_sales readable" ON public.simulation_sales;
REVOKE SELECT ON public.simulation_settings, public.simulation_product_settings, public.sales_months, public.sales_month_products, public.simulation_sales FROM anon;

-- Coupons, launches and promotions are no longer shown publicly; admins only (coupon RPCs keep working).
DROP POLICY IF EXISTS "coupon_offers public read" ON public.coupon_offers;
CREATE POLICY "coupon_offers admin read" ON public.coupon_offers FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "launch products read" ON public.launch_products;
CREATE POLICY "launch products admin read" ON public.launch_products FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "promotion products read" ON public.promotion_products;
CREATE POLICY "promotion products admin read" ON public.promotion_products FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
REVOKE SELECT ON public.coupon_offers, public.launch_products, public.promotion_products FROM anon;

-- Facebook copies: signed-in accounts only.
DROP POLICY IF EXISTS "Anyone can view product copies" ON public.product_copies;
CREATE POLICY "Signed-in users view product copies" ON public.product_copies FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.product_copies FROM anon;
GRANT SELECT ON public.product_copies, public.simulation_settings, public.simulation_product_settings, public.sales_months, public.sales_month_products TO authenticated;