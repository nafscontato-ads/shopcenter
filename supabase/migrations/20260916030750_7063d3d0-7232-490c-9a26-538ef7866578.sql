CREATE OR REPLACE FUNCTION public.enforce_partner_coupon_checkout()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  target_partner public.partner_profiles%ROWTYPE;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT * INTO target_partner
    FROM public.partner_profiles
    WHERE id = NEW.partner_id;

    IF NOT FOUND OR target_partner.status <> 'active' THEN
      RAISE EXCEPTION 'O parceiro precisa estar ativo antes de ativar o cupom.';
    END IF;

    IF NULLIF(trim(target_partner.checkout_lifetime_url), '') IS NULL
       OR NULLIF(trim(target_partner.checkout_monthly_url), '') IS NULL THEN
      RAISE EXCEPTION 'Cadastre os dois links de checkout antes de ativar o cupom.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS partner_coupons_partner_unique
ON public.partner_coupons (partner_id);

CREATE TRIGGER enforce_partner_coupon_checkout_trigger
BEFORE INSERT OR UPDATE OF partner_id, status
ON public.partner_coupons
FOR EACH ROW
EXECUTE FUNCTION public.enforce_partner_coupon_checkout();