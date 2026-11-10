-- 1. Dono obrigatório em influencers
UPDATE public.influencers SET user_id = (SELECT user_id FROM public.admin_users WHERE user_id IS NOT NULL ORDER BY created_at LIMIT 1) WHERE user_id IS NULL;
DELETE FROM public.influencers WHERE user_id IS NULL;
ALTER TABLE public.influencers ALTER COLUMN user_id SET NOT NULL;
DROP POLICY IF EXISTS "Guests manage unowned influencers" ON public.influencers;
DROP POLICY IF EXISTS "Owners manage their influencers" ON public.influencers;
CREATE POLICY "Owners manage their influencers" ON public.influencers FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read influencers" ON public.influencers FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- 2. Studio: dono obrigatório
UPDATE public.studio_projects SET user_id = (SELECT user_id FROM public.admin_users WHERE user_id IS NOT NULL ORDER BY created_at LIMIT 1) WHERE user_id IS NULL;
UPDATE public.studio_scenes SET user_id = (SELECT user_id FROM public.admin_users WHERE user_id IS NOT NULL ORDER BY created_at LIMIT 1) WHERE user_id IS NULL;
UPDATE public.studio_generations SET user_id = (SELECT user_id FROM public.admin_users WHERE user_id IS NOT NULL ORDER BY created_at LIMIT 1) WHERE user_id IS NULL;
DELETE FROM public.studio_generations WHERE user_id IS NULL;
DELETE FROM public.studio_projects WHERE user_id IS NULL;
DELETE FROM public.studio_scenes WHERE user_id IS NULL;

-- 3. Ocorrências / saúde da plataforma
CREATE TABLE public.app_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  route text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.app_errors TO authenticated;
GRANT ALL ON public.app_errors TO service_role;
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read app errors" ON public.app_errors FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users report their errors" ON public.app_errors FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE INDEX app_errors_created_idx ON public.app_errors (created_at DESC);
CREATE INDEX app_errors_open_idx ON public.app_errors (resolved, created_at DESC);