-- "Arranque Rápido": envios bônus comprados na Applyfy (upsell 5 envios / downsell 3 envios).
-- Cada envio bônus paga até per_order_cap (R$ 30) de um pedido; o que passar sai do saldo normal.
-- Não é saldo: não entra em seller_wallets.balance, não pode ser sacado e vence em expires_at.

CREATE TABLE IF NOT EXISTS public.wallet_bonus_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,                                              -- e-mail do comprador (minúsculo)
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,         -- preenchido quando a conta existe
  source text NOT NULL DEFAULT 'applyfy',
  reference text NOT NULL UNIQUE,                                   -- id da transação: webhook repetido não duplica
  label text NOT NULL,
  orders_total integer NOT NULL CHECK (orders_total > 0),
  orders_used integer NOT NULL DEFAULT 0,
  per_order_cap numeric(12,2) NOT NULL DEFAULT 30 CHECK (per_order_cap > 0),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (orders_used >= 0 AND orders_used <= orders_total)
);
CREATE INDEX IF NOT EXISTS wallet_bonus_grants_user_idx ON public.wallet_bonus_grants (user_id, expires_at);
CREATE INDEX IF NOT EXISTS wallet_bonus_grants_unclaimed_idx ON public.wallet_bonus_grants (lower(email)) WHERE user_id IS NULL;
ALTER TABLE public.wallet_bonus_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own bonus read" ON public.wallet_bonus_grants;
CREATE POLICY "own bonus read" ON public.wallet_bonus_grants FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
GRANT SELECT ON public.wallet_bonus_grants TO authenticated;
GRANT ALL ON public.wallet_bonus_grants TO service_role;

ALTER TABLE public.fulfillment_orders ADD COLUMN IF NOT EXISTS bonus_grant_id uuid REFERENCES public.wallet_bonus_grants(id) ON DELETE SET NULL;
ALTER TABLE public.fulfillment_orders ADD COLUMN IF NOT EXISTS bonus_amount numeric(12,2) NOT NULL DEFAULT 0;

-- Liga ao usuário os envios bônus comprados com o e-mail dele antes de a conta existir.
CREATE OR REPLACE FUNCTION public.wallet_bonus_claim(_user uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _n integer;
BEGIN
  SELECT lower(email) INTO _email FROM auth.users WHERE id = _user;
  IF _email IS NULL THEN RETURN 0; END IF;
  UPDATE public.wallet_bonus_grants SET user_id = _user WHERE user_id IS NULL AND lower(email) = _email;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.wallet_bonus_claim(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_bonus_claim(uuid) TO service_role;

-- Igual à 0034, mas usa primeiro um envio bônus válido (o que vence antes): ele cobre até o teto
-- e só a diferença sai do saldo. Sem saldo para a diferença, nada é consumido.
CREATE OR REPLACE FUNCTION public.fulfillment_debit(_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.fulfillment_orders%ROWTYPE;
  g public.wallet_bonus_grants%ROWTYPE;
  _total numeric(12,2);
  _bonus numeric(12,2) := 0;
  _cash numeric(12,2);
  _balance numeric;
BEGIN
  SELECT * INTO o FROM public.fulfillment_orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR o.status <> 'awaiting_funds' THEN
    RETURN 'skipped';
  END IF;
  _total := o.goods_cost + o.platform_fee;

  PERFORM public.wallet_bonus_claim(o.user_id);
  SELECT * INTO g FROM public.wallet_bonus_grants
    WHERE user_id = o.user_id AND orders_used < orders_total AND expires_at > now()
    ORDER BY expires_at, created_at
    LIMIT 1
    FOR UPDATE;
  IF FOUND THEN
    _bonus := least(_total, g.per_order_cap);
  END IF;
  _cash := _total - _bonus;

  IF _cash > 0 THEN
    _balance := public.wallet_book(o.user_id, -_cash, 'order_debit', 'fulfillment:' || _id::text, 'Pedido ' || o.order_sn, NULL);
    IF _balance IS NULL THEN
      UPDATE public.fulfillment_orders
        SET last_error = 'Saldo insuficiente: este pedido precisa de R$ ' || to_char(_cash, 'FM999990.00') || '. Recarregue a carteira.', updated_at = now()
        WHERE id = _id;
      RETURN 'insufficient';
    END IF;
  END IF;

  IF _bonus > 0 THEN
    UPDATE public.wallet_bonus_grants SET orders_used = orders_used + 1 WHERE id = g.id;
  END IF;
  UPDATE public.fulfillment_orders
    SET status = 'queued', debited_amount = _cash, bonus_grant_id = CASE WHEN _bonus > 0 THEN g.id END, bonus_amount = _bonus,
        last_error = NULL, updated_at = now()
    WHERE id = _id;
  RETURN 'paid';
END;
$$;
REVOKE ALL ON FUNCTION public.fulfillment_debit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfillment_debit(uuid) TO service_role;

-- Pedido cancelado: devolve o envio bônus usado (uma vez só).
CREATE OR REPLACE FUNCTION public.fulfillment_bonus_return(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _grant uuid;
BEGIN
  UPDATE public.fulfillment_orders o SET bonus_grant_id = NULL, bonus_amount = 0, updated_at = now()
    FROM (SELECT id, bonus_grant_id FROM public.fulfillment_orders WHERE id = _id AND bonus_grant_id IS NOT NULL FOR UPDATE) old
    WHERE o.id = old.id
    RETURNING old.bonus_grant_id INTO _grant;
  IF _grant IS NULL THEN RETURN false; END IF;
  UPDATE public.wallet_bonus_grants SET orders_used = greatest(orders_used - 1, 0) WHERE id = _grant;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.fulfillment_bonus_return(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfillment_bonus_return(uuid) TO service_role;
