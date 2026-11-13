-- Painel de reembolsos: de qual lado (Lucena | Cauã) o pedido aparece quando o suporte escolhe à mão.
-- Vazio = o painel deduz pela venda (link do Cauã com ?code=dy4ki0h = Cauã; link oficial = Lucena).
ALTER TABLE public.refund_requests ADD COLUMN IF NOT EXISTS seller text CHECK (seller IN ('lucena', 'caua'));
