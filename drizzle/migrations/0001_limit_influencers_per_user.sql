CREATE OR REPLACE FUNCTION public.enforce_influencer_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  influencer_count integer;
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'É necessário entrar na conta para criar um influenciador.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  SELECT count(*)
  INTO influencer_count
  FROM public.influencers
  WHERE user_id = NEW.user_id;

  IF influencer_count >= 3 THEN
    RAISE EXCEPTION 'Você já atingiu o limite de 3 influenciadores. Conclua a etapa 5 do roadmap para liberar mais.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_influencer_limit_trigger
BEFORE INSERT ON public.influencers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_influencer_limit();