DROP FUNCTION IF EXISTS public.claim_black_slot(text, text);
DROP FUNCTION IF EXISTS public.activate_my_black_coupon(integer);
DROP FUNCTION IF EXISTS public.save_my_black_coupon(text, integer);
DROP FUNCTION IF EXISTS public.my_black_coupon();
DROP FUNCTION IF EXISTS public.can_issue_black_coupon();
DROP INDEX IF EXISTS public.coupon_offers_owner_unique;
COMMENT ON COLUMN public.coupon_offers.owner_user_id IS 'DEPRECATED: Black Friday coupon feature removed by the owner';