-- Pedidos de reembolso e chargebacks abertos direto na Applyfy entram no painel do suporte.
-- Cada aviso do webhook (purchase_webhook_events) de REFUND_* ou CHARGEBACK_* vira/atualiza uma linha
-- em refund_requests (uma por reembolso/chargeback da Applyfy). Nada aqui mexe em acesso de aluno.
ALTER TABLE public.refund_requests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'site' CHECK (source IN ('site', 'applyfy', 'chargeback')),
  ADD COLUMN IF NOT EXISTS external_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS applyfy_event text,
  ADD COLUMN IF NOT EXISTS applyfy_state text,
  ADD COLUMN IF NOT EXISTS applyfy_amount numeric,
  ADD COLUMN IF NOT EXISTS applyfy_rejected_reason text,
  ADD COLUMN IF NOT EXISTS applyfy_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.refund_from_applyfy_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  obj jsonb;
  kind text;
  ev text := split_part(coalesce(NEW.event, ''), ' ', 1);
  cli jsonb := coalesce(NEW.payload->'client', '{}'::jsonb);
  tx jsonb := coalesce(NEW.payload->'transaction', '{}'::jsonb);
  reason_txt text;
  upd timestamptz;
BEGIN
  IF ev LIKE 'REFUND\_%' AND NEW.payload ? 'refund' THEN obj := NEW.payload->'refund'; kind := 'applyfy';
  ELSIF ev LIKE 'CHARGEBACK\_%' AND NEW.payload ? 'chargeback' THEN obj := NEW.payload->'chargeback'; kind := 'chargeback';
  ELSE RETURN NEW; END IF;
  IF coalesce(obj->>'id', '') = '' THEN RETURN NEW; END IF;

  reason_txt := CASE WHEN kind = 'chargeback' THEN 'Chargeback no cartão' ELSE
    CASE obj->>'reason'
      WHEN 'PRODUCT_NOT_RECEIVED' THEN 'Produto não recebido'
      WHEN 'PRODUCT_DIFFERENT_THAN_ADVERTISED' THEN 'Produto diferente do anunciado'
      WHEN 'CUSTOMER_SERVICE_ISSUE' THEN 'Problema no atendimento'
      WHEN 'REGRET' THEN 'Desistência da compra'
      WHEN 'DUPLICATE_PURCHASE' THEN 'Compra duplicada'
      ELSE 'Outro motivo' END END;
  upd := coalesce((obj->>'updatedAt')::timestamptz, NEW.received_at, now());

  INSERT INTO public.refund_requests AS r (
    protocol, name, cpf, email, phone, purchase_date, reason, details, payment_method, status,
    source, external_id, applyfy_event, applyfy_state, applyfy_amount, applyfy_rejected_reason, applyfy_updated_at, created_at, updated_at)
  VALUES (
    CASE WHEN kind = 'chargeback' THEN 'CB-' ELSE 'AP-' END || upper(right(obj->>'id', 8)),
    coalesce(nullif(cli->>'name', ''), coalesce(NEW.email, 'Sem nome')),
    regexp_replace(coalesce(cli->>'cpf', ''), '\D', '', 'g'),
    lower(coalesce(nullif(cli->>'email', ''), NEW.email, '')),
    nullif(regexp_replace(coalesce(cli->>'phone', ''), '\D', '', 'g'), ''),
    coalesce((tx->>'createdAt')::timestamptz, (obj->>'transactionDate')::timestamptz, NEW.received_at)::date,
    reason_txt,
    nullif(obj->>'description', ''),
    CASE WHEN tx->>'paymentMethod' = 'PIX' THEN 'pix' ELSE 'card' END,
    -- Se a Applyfy já devolveu o dinheiro, o suporte não precisa fazer nada: entra como Pago.
    CASE WHEN ev = 'REFUND_COMPLETED' OR (kind = 'applyfy' AND obj->>'status' = 'COMPLETED') THEN 'pago' ELSE 'em_analise' END,
    kind,
    kind || ':' || (obj->>'id'),
    ev,
    obj->>'status',
    coalesce((obj->>'amountRequested')::numeric, (obj->>'amount')::numeric),
    nullif(obj->>'rejectedReason', ''),
    upd,
    coalesce((obj->>'createdAt')::timestamptz, NEW.received_at, now()),
    now())
  ON CONFLICT (external_id) DO UPDATE SET
    applyfy_event = EXCLUDED.applyfy_event,
    applyfy_state = EXCLUDED.applyfy_state,
    applyfy_amount = coalesce(EXCLUDED.applyfy_amount, r.applyfy_amount),
    applyfy_rejected_reason = coalesce(EXCLUDED.applyfy_rejected_reason, r.applyfy_rejected_reason),
    details = coalesce(r.details, EXCLUDED.details),
    applyfy_updated_at = EXCLUDED.applyfy_updated_at,
    status = CASE WHEN EXCLUDED.status = 'pago' AND r.status <> 'pago' THEN 'pago' ELSE r.status END,
    updated_at = now()
  WHERE r.applyfy_updated_at IS NULL OR EXCLUDED.applyfy_updated_at >= r.applyfy_updated_at;
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Nunca derruba o webhook: no pior caso o pedido só não aparece no painel.
  RAISE WARNING 'refund_from_applyfy_event: %', SQLERRM;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.refund_from_applyfy_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS refund_from_applyfy_event ON public.purchase_webhook_events;
CREATE TRIGGER refund_from_applyfy_event AFTER INSERT ON public.purchase_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.refund_from_applyfy_event();

-- Traz os avisos que já chegaram (na ordem em que chegaram).
CREATE TEMP TABLE tmp_refund_replay (LIKE public.purchase_webhook_events) ON COMMIT DROP;
CREATE TRIGGER replay AFTER INSERT ON tmp_refund_replay FOR EACH ROW EXECUTE FUNCTION public.refund_from_applyfy_event();
INSERT INTO tmp_refund_replay SELECT * FROM public.purchase_webhook_events WHERE event LIKE 'REFUND%' OR event LIKE 'CHARGEBACK%' ORDER BY received_at;
