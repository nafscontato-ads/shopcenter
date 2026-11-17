-- Asaas as PIX provider: wallet recharges through Asaas and an automatic daily PIX payout to each
-- supplier for the orders it shipped. See src/lib/pix.server.ts and src/lib/payouts.server.ts.

-- Asaas customer of the seller (created on the first recharge with the seller's CPF/CNPJ).
ALTER TABLE public.seller_wallets ADD COLUMN IF NOT EXISTS asaas_customer_id text;

-- Suppliers paid directly by PIX (auto_payout) instead of inside another platform (e.g. DepDrop).
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS auto_payout boolean NOT NULL DEFAULT false;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS pix_key_type text
  CHECK (pix_key_type IS NULL OR pix_key_type IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'));

CREATE TABLE IF NOT EXISTS public.supplier_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  order_count integer NOT NULL,
  -- São Paulo calendar day the payout belongs to: at most one payout per supplier per day.
  payout_day date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'done', 'failed')),
  provider text NOT NULL DEFAULT 'asaas',
  provider_transfer_id text UNIQUE,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, payout_day)
);
ALTER TABLE public.supplier_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts admin read" ON public.supplier_payouts FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
GRANT SELECT ON public.supplier_payouts TO authenticated;
GRANT ALL ON public.supplier_payouts TO service_role;

ALTER TABLE public.fulfillment_orders ADD COLUMN IF NOT EXISTS payout_id uuid REFERENCES public.supplier_payouts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS fulfillment_orders_unpaid_idx ON public.fulfillment_orders (supplier_id) WHERE status = 'shipped' AND payout_id IS NULL;

-- Claims today's payout for one supplier: every debited order shipped more than 12 hours ago and not yet paid out is tied to a
-- new payout row in one transaction, so two workers can never pay the same order twice.
-- Returns the payout id, or NULL when there is nothing to pay or today's payout already exists.
CREATE OR REPLACE FUNCTION public.supplier_payout_claim(_supplier uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _day date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _id uuid;
  _amount numeric(12,2);
  _count integer;
  _ids uuid[];
BEGIN
  PERFORM 1 FROM public.suppliers WHERE id = _supplier FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.supplier_payouts WHERE supplier_id = _supplier AND payout_day = _day) THEN
    RETURN NULL;
  END IF;
  SELECT array_agg(id) INTO _ids FROM (
    SELECT id FROM public.fulfillment_orders
    WHERE supplier_id = _supplier AND status = 'shipped' AND payout_id IS NULL AND debited_amount > 0
      AND shipped_at < now() - interval '12 hours'
    FOR UPDATE
  ) locked;
  IF _ids IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT coalesce(sum(goods_cost), 0), count(*) INTO _amount, _count FROM public.fulfillment_orders WHERE id = ANY (_ids);
  IF _amount <= 0 THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.supplier_payouts (supplier_id, amount, order_count, payout_day)
    VALUES (_supplier, _amount, _count, _day) RETURNING id INTO _id;
  UPDATE public.fulfillment_orders SET payout_id = _id, updated_at = now() WHERE id = ANY (_ids);
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.supplier_payout_claim(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_payout_claim(uuid) TO service_role;
