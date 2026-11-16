-- Envio automático "de fábrica" em toda loja e fornecedor pago ANTES de enviar (decisão do dono, 16/11/2026).
-- O aluno paga o pedido pela carteira; o admin faz o Pix ao fornecedor (Mercado Pago ou banco) e marca
-- "Já paguei este Pix"; só então o painel do fornecedor libera a etiqueta.

ALTER TABLE public.shopee_shop_connections ALTER COLUMN auto_fulfillment SET DEFAULT true;
UPDATE public.shopee_shop_connections SET auto_fulfillment = true WHERE auto_fulfillment IS DISTINCT FROM true;

ALTER TABLE public.fulfillment_orders ADD COLUMN IF NOT EXISTS supplier_paid_at timestamptz;
ALTER TABLE public.fulfillment_orders ADD COLUMN IF NOT EXISTS supplier_paid_note text;
-- Pedido cancelado depois do Pix ao fornecedor: o valor é descontado do próximo Pix (marcado aqui quando descontado).
ALTER TABLE public.fulfillment_orders ADD COLUMN IF NOT EXISTS supplier_credit_at timestamptz;
CREATE INDEX IF NOT EXISTS fulfillment_orders_supplier_unpaid_idx ON public.fulfillment_orders (supplier_id) WHERE status = 'queued' AND supplier_paid_at IS NULL;
