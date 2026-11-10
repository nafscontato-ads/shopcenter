ALTER TABLE public.shopee_shop_connections
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0 AND low_stock_threshold <= 999999),
  ADD COLUMN IF NOT EXISTS sync_prices boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_low_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pause_when_out_of_stock boolean NOT NULL DEFAULT false;

CREATE TABLE public.shopee_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.shopee_shop_connections(id) ON DELETE CASCADE,
  order_sn text NOT NULL,
  status text NOT NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  buyer_label text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_time timestamptz,
  updated_time timestamptz,
  completed_time timestamptz,
  raw_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, order_sn)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopee_orders TO authenticated;
GRANT ALL ON public.shopee_orders TO service_role;
ALTER TABLE public.shopee_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own Shopee orders"
ON public.shopee_orders FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.shopee_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.shopee_shop_connections(id) ON DELETE CASCADE,
  operation text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  processed_count integer NOT NULL DEFAULT 0,
  changed_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shopee_sync_logs TO authenticated;
GRANT ALL ON public.shopee_sync_logs TO service_role;
ALTER TABLE public.shopee_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own Shopee sync logs"
ON public.shopee_sync_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX shopee_orders_user_connection_idx ON public.shopee_orders(user_id, connection_id, updated_time DESC);
CREATE INDEX shopee_orders_status_idx ON public.shopee_orders(connection_id, status);
CREATE INDEX shopee_sync_logs_user_connection_idx ON public.shopee_sync_logs(user_id, connection_id, created_at DESC);

CREATE TRIGGER update_shopee_orders_updated_at
BEFORE UPDATE ON public.shopee_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();