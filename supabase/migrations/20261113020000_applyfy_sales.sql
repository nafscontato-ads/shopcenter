-- Vendas do Shop Center (Applyfy) do Cauã e do Lucena, importadas da exportação, para o painel do suporte.
-- Os dados (pessoais) foram inseridos direto no banco; nunca entram neste repositório público.
CREATE TABLE IF NOT EXISTS public.applyfy_sales (
  order_id text PRIMARY KEY,
  seller text NOT NULL CHECK (seller IN ('lucena', 'caua')),
  name text,
  email text,
  phone text,
  cpf text,
  offer_code text,
  amount numeric,
  method text,
  installments int,
  paid_at timestamptz,
  affiliate_code text,
  source text NOT NULL DEFAULT 'exportacao',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.applyfy_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.applyfy_sales FROM anon, authenticated;
GRANT ALL ON public.applyfy_sales TO service_role;
CREATE INDEX IF NOT EXISTS applyfy_sales_email_idx ON public.applyfy_sales (lower(email));
CREATE INDEX IF NOT EXISTS applyfy_sales_cpf_idx ON public.applyfy_sales (cpf);
