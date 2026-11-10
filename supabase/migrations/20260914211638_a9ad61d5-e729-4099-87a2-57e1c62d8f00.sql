CREATE POLICY "No direct access to Shopee connection secrets"
ON public.shopee_shop_connections
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "No direct access to Shopee OAuth states"
ON public.shopee_oauth_states
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);