CREATE OR REPLACE FUNCTION public.activate_my_black_coupon(_slots integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE o public.coupon_offers%ROWTYPE; used integer := 0;
BEGIN
  IF NOT public.can_issue_black_coupon() THEN RAISE EXCEPTION 'Área exclusiva para parceiros.'; END IF;
  IF _slots IS NULL OR _slots < 1 OR _slots > 10 THEN RAISE EXCEPTION 'Escolha de 1 a 10 usos.'; END IF;
  SELECT * INTO o FROM public.coupon_offers WHERE owner_user_id = auth.uid() FOR UPDATE;
  IF FOUND THEN
    SELECT count(*) INTO used FROM public.coupon_slot_claims WHERE code = o.code;
    IF _slots < used THEN RAISE EXCEPTION 'O cupom já foi usado % vezes.', used; END IF;
    UPDATE public.coupon_offers SET total_slots = _slots, is_active = true WHERE code = o.code;
  ELSE
    INSERT INTO public.coupon_offers (code, total_slots, is_active, owner_user_id)
    VALUES ('BLACK-' || upper(substr(md5(auth.uid()::text), 1, 10)), _slots, true, auth.uid());
  END IF;
  RETURN public.my_black_coupon();
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_black_slot(_slug text, _claim_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE p public.partner_profiles%ROWTYPE; o public.coupon_offers%ROWTYPE;
BEGIN
  IF _claim_key IS NULL OR length(_claim_key) < 6 OR length(_claim_key) > 80 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unavailable');
  END IF;
  SELECT * INTO p FROM public.partner_profiles
  WHERE lower(slug) = lower(trim(coalesce(_slug, ''))) AND status IN ('approved', 'active') LIMIT 1;
  IF NOT FOUND OR p.user_id IS NULL THEN RETURN jsonb_build_object('ok', true, 'limited', false); END IF;
  SELECT * INTO o FROM public.coupon_offers WHERE owner_user_id = p.user_id AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'limited', false); END IF;
  RETURN public.claim_coupon_slot(o.code, _claim_key) || jsonb_build_object('limited', true);
END;
$$;

REVOKE ALL ON FUNCTION public.activate_my_black_coupon(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_my_black_coupon(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_black_slot(text, text) TO anon, authenticated;