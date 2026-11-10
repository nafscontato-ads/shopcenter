DROP TRIGGER IF EXISTS enforce_influencer_limit_trigger ON public.influencers;

ALTER TABLE public.user_limits ALTER COLUMN unlimited SET DEFAULT true;

COMMENT ON FUNCTION public.enforce_influencer_limit() IS 'DEPRECATED: saving influencers is unlimited; trigger removed on 2026-09-23.';
COMMENT ON COLUMN public.user_limits.daily_limit IS 'DEPRECATED: generation is unlimited; retained for backward compatibility and usage reporting.';