-- Solicitações de reembolso reais (antes era só uma simulação que não salvava nada).
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol text NOT NULL UNIQUE,
  name text NOT NULL,
  cpf text NOT NULL,
  email text NOT NULL,
  phone text,
  purchase_date date NOT NULL,
  reason text NOT NULL,
  details text,
  payment_method text NOT NULL CHECK (payment_method IN ('pix', 'card')),
  status text NOT NULL DEFAULT 'em_analise' CHECK (status IN ('em_analise', 'aprovado', 'recusado', 'pago')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
-- Ninguém lê ou grava direto pelo navegador: tudo passa pelo servidor (service_role).
REVOKE ALL ON public.refund_requests FROM anon, authenticated;
GRANT ALL ON public.refund_requests TO service_role;
CREATE INDEX IF NOT EXISTS refund_requests_created_idx ON public.refund_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS refund_requests_cpf_idx ON public.refund_requests (cpf);
