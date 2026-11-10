ALTER TABLE public.coupon_offers ADD COLUMN IF NOT EXISTS owner_user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS coupon_offers_owner_unique ON public.coupon_offers(owner_user_id) WHERE owner_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.can_issue_black_coupon()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (SELECT 1 FROM public.partner_profiles WHERE user_id = auth.uid() AND status IN ('approved', 'active'))
  );
$$;

CREATE OR REPLACE FUNCTION public.my_black_coupon()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE o public.coupon_offers%ROWTYPE; used integer;
BEGIN
  IF NOT public.can_issue_black_coupon() THEN RAISE EXCEPTION 'Área exclusiva para parceiros.'; END IF;
  SELECT * INTO o FROM public.coupon_offers WHERE owner_user_id = auth.uid();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO used FROM public.coupon_slot_claims WHERE code = o.code;
  RETURN jsonb_build_object('code', o.code, 'total_slots', o.total_slots, 'claimed_slots', LEAST(o.total_slots, used), 'is_active', o.is_active);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_my_black_coupon(_code text, _slots integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE o public.coupon_offers%ROWTYPE; c text := upper(trim(_code)); used integer := 0;
BEGIN
  IF NOT public.can_issue_black_coupon() THEN RAISE EXCEPTION 'Área exclusiva para parceiros.'; END IF;
  IF c !~ '^[A-Z0-9]{4,20}$' THEN RAISE EXCEPTION 'Use de 4 a 20 letras ou números, sem espaços.'; END IF;
  IF c = 'BLACK' THEN RAISE EXCEPTION 'O cupom BLACK é o cupom público. Escolha outro nome.'; END IF;
  IF _slots IS NULL OR _slots < 1 OR _slots > 10 THEN RAISE EXCEPTION 'Escolha de 1 a 10 usos.'; END IF;

  SELECT * INTO o FROM public.coupon_offers WHERE owner_user_id = auth.uid() FOR UPDATE;
  IF FOUND THEN
    SELECT count(*) INTO used FROM public.coupon_slot_claims WHERE code = o.code;
    IF _slots < used THEN RAISE EXCEPTION 'Este cupom já foi usado % vezes.', used; END IF;
    IF o.code <> c THEN
      IF used > 0 THEN RAISE EXCEPTION 'O nome não pode mudar depois do primeiro uso.'; END IF;
      IF EXISTS (SELECT 1 FROM public.coupon_offers WHERE upper(code) = c) THEN RAISE EXCEPTION 'Este código já está em uso. Escolha outro.'; END IF;
      UPDATE public.coupon_offers SET code = c, total_slots = _slots, is_active = true WHERE code = o.code;
    ELSE
      UPDATE public.coupon_offers SET total_slots = _slots, is_active = true WHERE code = o.code;
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.coupon_offers WHERE upper(code) = c) THEN RAISE EXCEPTION 'Este código já está em uso. Escolha outro.'; END IF;
    INSERT INTO public.coupon_offers (code, total_slots, is_active, owner_user_id) VALUES (c, _slots, true, auth.uid());
  END IF;
  RETURN public.my_black_coupon();
END;
$$;

REVOKE ALL ON FUNCTION public.can_issue_black_coupon() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_black_coupon() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_my_black_coupon(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_issue_black_coupon() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_black_coupon() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_my_black_coupon(text, integer) TO authenticated;