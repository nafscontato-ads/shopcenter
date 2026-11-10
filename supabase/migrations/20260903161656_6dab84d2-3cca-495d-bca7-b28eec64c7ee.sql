-- ============ AI COST RATES ============
CREATE TABLE public.ai_cost_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'image',
  provider TEXT NOT NULL DEFAULT 'lovable',
  model TEXT,
  unit TEXT NOT NULL DEFAULT 'geracao',
  cost_usd NUMERIC(12,5) NOT NULL DEFAULT 0,
  cost_brl NUMERIC(12,4) NOT NULL DEFAULT 0,
  price_brl NUMERIC(12,4) NOT NULL DEFAULT 0,
  credits INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_cost_rates TO authenticated;
GRANT ALL ON public.ai_cost_rates TO service_role;

ALTER TABLE public.ai_cost_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_cost_rates_admin_all" ON public.ai_cost_rates
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER ai_cost_rates_updated BEFORE UPDATE ON public.ai_cost_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CREDIT PACKS ============
CREATE TABLE public.credit_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  credits INTEGER NOT NULL DEFAULT 0,
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  price_brl NUMERIC(12,2) NOT NULL DEFAULT 0,
  highlight BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_packs TO authenticated;
GRANT ALL ON public.credit_packs TO service_role;

ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_packs_read_active" ON public.credit_packs
  FOR SELECT TO authenticated
  USING (is_active OR public.is_admin(auth.uid()));

CREATE POLICY "credit_packs_admin_write" ON public.credit_packs
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER credit_packs_updated BEFORE UPDATE ON public.credit_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AI USAGE EVENTS ============
CREATE TABLE public.ai_usage_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rate_key TEXT,
  kind TEXT NOT NULL DEFAULT 'image',
  provider TEXT,
  model TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  credits INTEGER NOT NULL DEFAULT 0,
  cost_brl NUMERIC(12,4) NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,5) NOT NULL DEFAULT 0,
  reference_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX ai_usage_events_created_idx ON public.ai_usage_events (created_at DESC);
CREATE INDEX ai_usage_events_user_idx ON public.ai_usage_events (user_id);

GRANT SELECT, INSERT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_events_read_own_or_admin" ON public.ai_usage_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "ai_usage_events_insert_own" ON public.ai_usage_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============ SEED: TABELA DE CUSTOS ============
INSERT INTO public.ai_cost_rates (key, label, kind, provider, model, unit, cost_usd, cost_brl, price_brl, credits, notes) VALUES
  ('influencer_image', 'Imagem de influencer (identidade)', 'image', 'lovable', 'google/gemini-2.5-flash-image', 'imagem', 0.03000, 0.1650, 0.9900, 3, 'Geração do rosto/identidade do influencer'),
  ('influencer_variation', 'Variação de imagem do influencer', 'image', 'lovable', 'google/gemini-2.5-flash-image', 'imagem', 0.03000, 0.1650, 0.7900, 2, 'Nova pose ou cenário mantendo a identidade'),
  ('studio_master_frame', 'Master frame do Studio', 'image', 'lovable', 'google/gemini-2.5-flash-image', 'imagem', 0.03000, 0.1650, 0.9900, 3, 'Primeiro frame usado como base do vídeo'),
  ('studio_refine', 'Refinamento de imagem', 'image', 'lovable', 'google/gemini-2.5-flash-image', 'imagem', 0.03000, 0.1650, 0.5900, 2, 'Ajuste de imagem já gerada'),
  ('studio_script', 'Roteiro e prompts (texto)', 'text', 'lovable', 'openai/gpt-5-mini', '1k tokens', 0.00200, 0.0110, 0.1900, 1, 'Roteiro do AI Director'),
  ('studio_video', 'Vídeo do Studio (por 8s)', 'video', 'externo', 'veo-3', 'vídeo 8s', 0.40000, 2.2000, 9.9000, 20, 'Custo estimado de provedor externo de vídeo'),
  ('studio_audio', 'Voz / narração', 'audio', 'externo', 'tts', 'minuto', 0.01500, 0.0825, 0.4900, 1, 'Narração da cena')
ON CONFLICT (key) DO NOTHING;

-- ============ SEED: PACOTES DE RECARGA ============
INSERT INTO public.credit_packs (name, description, credits, bonus_credits, price_brl, highlight, sort_order) VALUES
  ('Recarga Start', 'Para testar a plataforma', 100, 0, 29.90, false, 1),
  ('Recarga Plus', 'Melhor custo por crédito para quem publica toda semana', 300, 40, 79.90, true, 2),
  ('Recarga Pro', 'Volume alto de conteúdo', 800, 150, 179.90, false, 3),
  ('Recarga Agência', 'Para quem atende vários afiliados', 2000, 500, 399.90, false, 4);

-- ============ CONFIGURAÇÕES ============
INSERT INTO public.admin_settings (key, value) VALUES
  ('usd_brl_rate', '{"rate": 5.50}'::jsonb),
  ('credit_price_brl', '{"value": 0.30}'::jsonb)
ON CONFLICT (key) DO NOTHING;