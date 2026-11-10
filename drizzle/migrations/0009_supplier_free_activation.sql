CREATE TABLE public.supplier_activation_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 supplier_id text NOT NULL DEFAULT 'shopee-place' CHECK (supplier_id = 'shopee-place'),
 started_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
 completed_at timestamptz,
 UNIQUE(user_id, supplier_id)
);
GRANT SELECT ON public.supplier_activation_sessions TO authenticated;
GRANT ALL ON public.supplier_activation_sessions TO service_role;
ALTER TABLE public.supplier_activation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own supplier activation" ON public.supplier_activation_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.begin_supplier_activation() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.supplier_activation_sessions; p public.profiles;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
 IF NOT FOUND OR p.status NOT IN ('active', 'pending') THEN RAISE EXCEPTION 'Acesso bloqueado. Contate o suporte.'; END IF;
 SELECT * INTO s FROM public.supplier_activation_sessions WHERE user_id = auth.uid() AND supplier_id = 'shopee-place' FOR UPDATE;
 IF NOT FOUND THEN
  INSERT INTO public.supplier_activation_sessions(user_id) VALUES (auth.uid()) RETURNING * INTO s;
 ELSIF s.completed_at IS NULL AND s.expires_at <= now() THEN
  UPDATE public.supplier_activation_sessions SET started_at = now(), expires_at = now() + interval '5 minutes' WHERE id = s.id RETURNING * INTO s;
 END IF;
 RETURN to_jsonb(s) || jsonb_build_object('server_now', now());
END; $$;
CREATE OR REPLACE FUNCTION public.complete_supplier_activation(session_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.supplier_activation_sessions; p public.profiles;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
 IF NOT FOUND OR p.status NOT IN ('active', 'pending') THEN RAISE EXCEPTION 'Acesso bloqueado. Contate o suporte.'; END IF;
 SELECT * INTO s FROM public.supplier_activation_sessions WHERE id = session_id AND user_id = auth.uid() AND supplier_id = 'shopee-place' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ativação não encontrada'; END IF;
 IF s.completed_at IS NULL THEN
  IF s.expires_at <= now() THEN RAISE EXCEPTION 'O prazo desta condição terminou.'; END IF;
  UPDATE public.profiles SET status = 'active' WHERE id = auth.uid();
  UPDATE public.supplier_activation_sessions SET completed_at = now() WHERE id = s.id RETURNING * INTO s;
 END IF;
 RETURN to_jsonb(s) || jsonb_build_object('server_now', now());
END; $$;
REVOKE ALL ON FUNCTION public.begin_supplier_activation() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_supplier_activation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_supplier_activation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_supplier_activation(uuid) TO authenticated;