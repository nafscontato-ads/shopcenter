CREATE TABLE public.partner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  checkout_lifetime_url text,
  checkout_monthly_url text,
  notes text,
  activated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.partner_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partner_profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  theme_id text,
  banner_image text,
  background_image text,
  primary_color text,
  secondary_color text,
  headline text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX partner_coupons_code_key ON public.partner_coupons (upper(code));
CREATE INDEX partner_coupons_partner_idx ON public.partner_coupons (partner_id);

GRANT ALL ON public.partner_profiles TO service_role;
GRANT ALL ON public.partner_coupons TO service_role;
GRANT SELECT ON public.partner_profiles TO authenticated;
GRANT SELECT ON public.partner_coupons TO authenticated;

ALTER TABLE public.partner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e o próprio parceiro leem o parceiro"
  ON public.partner_profiles FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Admins e o próprio parceiro leem o cupom"
  ON public.partner_coupons FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.partner_profiles p
      WHERE p.id = partner_coupons.partner_id AND p.user_id = auth.uid()
    )
  );

CREATE TRIGGER partner_profiles_updated
  BEFORE UPDATE ON public.partner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER partner_coupons_updated
  BEFORE UPDATE ON public.partner_coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.admin_settings (key, value)
VALUES ('pricing', jsonb_build_object(
  'lifetime_regular_price', 600.00,
  'monthly_regular_price', 300.00,
  'partner_lifetime_price', 295.00,
  'partner_monthly_price', 159.90,
  'default_lifetime_checkout_url', '',
  'default_monthly_checkout_url', ''
))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_public_pricing()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.admin_settings WHERE key = 'pricing'
$$;

CREATE OR REPLACE FUNCTION public.resolve_partner_coupon(_code text)
RETURNS TABLE (
  code text,
  partner_name text,
  checkout_lifetime_url text,
  checkout_monthly_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT upper(c.code), p.name, p.checkout_lifetime_url, p.checkout_monthly_url
  FROM public.partner_coupons c
  JOIN public.partner_profiles p ON p.id = c.partner_id
  WHERE upper(c.code) = upper(trim(_code))
    AND c.status = 'active'
    AND p.status = 'active'
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_pricing() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_partner_coupon(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_pricing() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_partner_coupon(text) TO anon, authenticated;