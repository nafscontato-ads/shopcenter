CREATE TABLE public.user_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_limit integer NOT NULL DEFAULT 25,
  unlimited boolean NOT NULL DEFAULT false,
  unlimited_until timestamptz,
  trial_days integer NOT NULL DEFAULT 8,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  blocked boolean NOT NULL DEFAULT false,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_limits TO authenticated;
GRANT ALL ON public.user_limits TO service_role;
ALTER TABLE public.user_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_limits_read_own_or_admin" ON public.user_limits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER user_limits_updated BEFORE UPDATE ON public.user_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.platform_recharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'lovable',
  description text,
  amount_brl numeric(12,2) NOT NULL DEFAULT 0,
  credits integer NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_recharges TO authenticated;
GRANT ALL ON public.platform_recharges TO service_role;
ALTER TABLE public.platform_recharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_recharges_admin_read" ON public.platform_recharges
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX platform_recharges_occurred_idx ON public.platform_recharges (occurred_at DESC);

INSERT INTO public.user_limits (user_id, purchased_at, created_at)
SELECT id, created_at, created_at FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_limits (user_id, purchased_at)
  VALUES (NEW.id, now())
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.admin_users
  SET user_id = NEW.id, updated_at = now()
  WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;

  RETURN NEW;
END;
$function$;