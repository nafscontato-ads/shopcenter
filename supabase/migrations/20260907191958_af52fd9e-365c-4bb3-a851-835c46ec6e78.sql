CREATE TABLE public.coupon_offers (
  code text PRIMARY KEY,
  total_slots integer NOT NULL DEFAULT 10 CHECK (total_slots > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupon_offers TO anon, authenticated;
GRANT ALL ON public.coupon_offers TO service_role;
ALTER TABLE public.coupon_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupon_offers public read" ON public.coupon_offers FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.coupon_slot_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL REFERENCES public.coupon_offers(code) ON DELETE CASCADE,
  claim_key text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, claim_key)
);
GRANT SELECT ON public.coupon_slot_claims TO authenticated;
GRANT ALL ON public.coupon_slot_claims TO service_role;
ALTER TABLE public.coupon_slot_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupon_slot_claims admin read" ON public.coupon_slot_claims FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

INSERT INTO public.coupon_offers (code, total_slots) VALUES ('AFILIADO10', 10);

CREATE OR REPLACE FUNCTION public.get_coupon_offer(_code text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'code', o.code,
    'total_slots', o.total_slots,
    'claimed_slots', LEAST(o.total_slots, (SELECT count(*) FROM public.coupon_slot_claims c WHERE c.code = o.code)),
    'is_active', o.is_active
  )
  FROM public.coupon_offers o
  WHERE upper(o.code) = upper(trim(_code))
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.claim_coupon_slot(_code text, _claim_key text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.coupon_offers%ROWTYPE;
  used integer;
BEGIN
  SELECT * INTO o FROM public.coupon_offers WHERE upper(code) = upper(trim(_code)) FOR UPDATE;
  IF NOT FOUND OR NOT o.is_active THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unavailable');
  END IF;

  IF EXISTS (SELECT 1 FROM public.coupon_slot_claims WHERE code = o.code AND claim_key = _claim_key) THEN
    SELECT count(*) INTO used FROM public.coupon_slot_claims WHERE code = o.code;
    RETURN jsonb_build_object('ok', true, 'already', true, 'code', o.code,
      'total_slots', o.total_slots, 'claimed_slots', LEAST(o.total_slots, used));
  END IF;

  SELECT count(*) INTO used FROM public.coupon_slot_claims WHERE code = o.code;
  IF used >= o.total_slots THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sold_out', 'code', o.code,
      'total_slots', o.total_slots, 'claimed_slots', o.total_slots);
  END IF;

  INSERT INTO public.coupon_slot_claims (code, claim_key, user_id)
  VALUES (o.code, _claim_key, auth.uid());

  SELECT count(*) INTO used FROM public.coupon_slot_claims WHERE code = o.code;
  RETURN jsonb_build_object('ok', true, 'already', false, 'code', o.code,
    'total_slots', o.total_slots, 'claimed_slots', LEAST(o.total_slots, used));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_coupon_offer(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_coupon_slot(text, text) TO anon, authenticated;