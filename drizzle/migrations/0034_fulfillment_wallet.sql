-- Automatic order fulfillment: a paid Shopee order of a catalogue product is debited from the
-- seller's wallet (product cost + platform fee) and handed to the product's supplier, who
-- prints the Shopee label from the supplier panel and ships. See src/lib/fulfillment.ts.

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  name text NOT NULL,
  whatsapp text,
  email text,
  pix_key text,
  -- supplier_source values (products.supplier_source) whose products this supplier ships.
  sources text[] NOT NULL DEFAULT '{}',
  -- sha256 of the secret panel link token; the raw token is shown to the owner once.
  panel_token_hash text UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers admin read" ON public.suppliers FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
GRANT SELECT ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS products_supplier_id_idx ON public.products (supplier_id) WHERE supplier_id IS NOT NULL;
COMMENT ON COLUMN public.products.supplier_id IS 'Supplier that ships this product for automatic fulfillment; falls back to suppliers.sources by supplier_source.';

ALTER TABLE public.shopee_shop_connections ADD COLUMN IF NOT EXISTS auto_fulfillment boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.seller_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  -- Platform-funded advance the seller may go negative by (possibility 2/4 in the plan). 0 = pure prepaid.
  credit_limit numeric(12,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (balance >= -credit_limit)
);
ALTER TABLE public.seller_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet read" ON public.seller_wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
GRANT SELECT ON public.seller_wallets TO authenticated;
GRANT ALL ON public.seller_wallets TO service_role;

CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount <> 0),
  kind text NOT NULL CHECK (kind IN ('recharge', 'order_debit', 'order_refund', 'adjustment')),
  reference text,
  note text,
  balance_after numeric(12,2) NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- A recharge reference (payment id) and an order debit/refund can only be booked once.
CREATE UNIQUE INDEX IF NOT EXISTS wallet_ledger_once_idx ON public.wallet_ledger (kind, reference) WHERE reference IS NOT NULL AND kind <> 'adjustment';
CREATE INDEX IF NOT EXISTS wallet_ledger_user_idx ON public.wallet_ledger (user_id, created_at DESC);
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger read" ON public.wallet_ledger FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
GRANT SELECT ON public.wallet_ledger TO authenticated;
GRANT ALL ON public.wallet_ledger TO service_role;

CREATE TABLE IF NOT EXISTS public.fulfillment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.shopee_shop_connections(id) ON DELETE CASCADE,
  order_sn text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN (
    'unmatched',        -- items are not catalogue products with a supplier: seller ships himself
    'needs_attention',  -- items from more than one supplier (one Shopee label cannot be split)
    'awaiting_funds',   -- wallet balance + credit limit does not cover the debit yet
    'queued',           -- paid; waiting for the supplier to print the label and ship
    'shipped',          -- supplier marked it shipped / Shopee reports it shipped
    'cancelled'         -- buyer/Shopee cancelled; any debit was refunded
  )),
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  goods_cost numeric(12,2) NOT NULL DEFAULT 0,
  platform_fee numeric(12,2) NOT NULL DEFAULT 0,
  debited_amount numeric(12,2) NOT NULL DEFAULT 0,
  shopee_status text,
  tracking_number text,
  last_error text,
  label_downloaded_at timestamptz,
  shipped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, order_sn)
);
CREATE INDEX IF NOT EXISTS fulfillment_orders_user_idx ON public.fulfillment_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fulfillment_orders_supplier_idx ON public.fulfillment_orders (supplier_id, status, created_at);
CREATE INDEX IF NOT EXISTS fulfillment_orders_waiting_idx ON public.fulfillment_orders (user_id) WHERE status = 'awaiting_funds';
ALTER TABLE public.fulfillment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fulfillment read" ON public.fulfillment_orders FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
GRANT SELECT ON public.fulfillment_orders TO authenticated;
GRANT ALL ON public.fulfillment_orders TO service_role;

-- Books one wallet movement atomically. Returns the new balance, or NULL when a debit would pass
-- the credit limit (nothing is booked then). Duplicate (kind, reference) bookings are ignored.
CREATE OR REPLACE FUNCTION public.wallet_book(_user uuid, _amount numeric, _kind text, _reference text, _note text, _actor uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.seller_wallets%ROWTYPE;
  _new numeric(12,2);
BEGIN
  INSERT INTO public.seller_wallets (user_id) VALUES (_user) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.seller_wallets WHERE user_id = _user FOR UPDATE;
  IF _reference IS NOT NULL AND _kind <> 'adjustment' AND EXISTS (
    SELECT 1 FROM public.wallet_ledger WHERE kind = _kind AND reference = _reference
  ) THEN
    RETURN w.balance;
  END IF;
  _new := w.balance + _amount;
  IF _amount < 0 AND _new < -w.credit_limit THEN
    RETURN NULL;
  END IF;
  UPDATE public.seller_wallets SET balance = _new, updated_at = now() WHERE user_id = _user;
  INSERT INTO public.wallet_ledger (user_id, amount, kind, reference, note, balance_after, created_by)
  VALUES (_user, _amount, _kind, _reference, _note, _new, _actor);
  RETURN _new;
END;
$$;
REVOKE ALL ON FUNCTION public.wallet_book(uuid, numeric, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_book(uuid, numeric, text, text, text, uuid) TO service_role;
