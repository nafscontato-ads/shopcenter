-- Public "Seja fornecedor" page: a supplier fills in its data, PIX key and (optionally) its product
-- spreadsheet; an admin approves it in /admin/envios, which creates the supplier and imports the catalogue.
-- See src/routes/seja-fornecedor.tsx and src/lib/supplier-applications.functions.ts.

CREATE TABLE IF NOT EXISTS public.supplier_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  document text NOT NULL,
  contact_name text NOT NULL,
  whatsapp text NOT NULL,
  email text NOT NULL,
  city text,
  uf text,
  niche text,
  instagram text,
  accepts_shopee_label boolean NOT NULL,
  ships_within_days integer NOT NULL DEFAULT 1,
  payout_mode text NOT NULL CHECK (payout_mode IN ('on_ship', 'after_delivery')),
  pix_key text NOT NULL,
  pix_key_type text CHECK (pix_key_type IS NULL OR pix_key_type IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP')),
  catalog_csv text,
  catalog_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS supplier_applications_status_idx ON public.supplier_applications (status, created_at DESC);
ALTER TABLE public.supplier_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier applications admin read" ON public.supplier_applications FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
GRANT SELECT ON public.supplier_applications TO authenticated;
GRANT ALL ON public.supplier_applications TO service_role;

-- How the supplier wants to be paid: right after posting (default) or after the buyer receives it.
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS payout_mode text NOT NULL DEFAULT 'on_ship'
  CHECK (payout_mode IN ('on_ship', 'after_delivery'));

-- Same claim as 0036, now honouring suppliers.payout_mode.
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
  _mode text;
BEGIN
  SELECT payout_mode INTO _mode FROM public.suppliers WHERE id = _supplier FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.supplier_payouts WHERE supplier_id = _supplier AND payout_day = _day) THEN
    RETURN NULL;
  END IF;
  SELECT array_agg(id) INTO _ids FROM (
    SELECT id FROM public.fulfillment_orders
    WHERE supplier_id = _supplier AND status = 'shipped' AND payout_id IS NULL AND debited_amount > 0
      AND shipped_at < now() - interval '12 hours'
      -- 'after_delivery' suppliers are paid only once Shopee reports the buyer received the order.
      AND (_mode = 'on_ship' OR EXISTS (
        SELECT 1 FROM public.shopee_orders s
        WHERE s.connection_id = fulfillment_orders.connection_id AND s.order_sn = fulfillment_orders.order_sn
          AND s.status IN ('TO_CONFIRM_RECEIVE', 'COMPLETED')
      ))
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
