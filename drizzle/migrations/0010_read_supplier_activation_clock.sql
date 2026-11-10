CREATE OR REPLACE FUNCTION public.read_supplier_activation() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.supplier_activation_sessions;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 SELECT * INTO s FROM public.supplier_activation_sessions WHERE user_id = auth.uid() AND supplier_id = 'shopee-place';
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN to_jsonb(s) || jsonb_build_object('server_now', now());
END; $$;
REVOKE ALL ON FUNCTION public.read_supplier_activation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_supplier_activation() TO authenticated;