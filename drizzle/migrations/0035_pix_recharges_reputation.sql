-- Automatic PIX recharges (Mercado Pago) and credit that grows with delivered orders.

CREATE TABLE IF NOT EXISTS public.wallet_recharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_payment_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'failed')),
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_recharges_user_idx ON public.wallet_recharges (user_id, created_at DESC);
ALTER TABLE public.wallet_recharges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recharges read" ON public.wallet_recharges FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
GRANT SELECT ON public.wallet_recharges TO authenticated;
GRANT ALL ON public.wallet_recharges TO service_role;

-- Admin-set limit that replaces the automatic reputation limit; NULL = automatic.
ALTER TABLE public.seller_wallets ADD COLUMN IF NOT EXISTS credit_override numeric(12,2) CHECK (credit_override IS NULL OR credit_override >= 0);
