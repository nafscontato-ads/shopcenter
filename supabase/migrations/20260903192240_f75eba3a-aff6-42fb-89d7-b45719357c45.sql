-- Normaliza categoria vazia
UPDATE public.products SET category = 'Outros'
WHERE category IS NULL OR btrim(category) = '';

-- Calcula um score viral a partir de vendas e comissão para os produtos importados
UPDATE public.products
SET viral_score = LEAST(99, GREATEST(35, ROUND(ln(GREATEST(sold_count,0) + 1) * 9 + COALESCE(commission,0))::int))
WHERE viral_score IS NULL OR viral_score = 0;

-- Rótulo de avaliações a partir da quantidade vendida
UPDATE public.products
SET reviews_label = CASE
  WHEN sold_count >= 1000 THEN round(sold_count/1000.0, 1)::text || ' mil vendidos'
  WHEN sold_count > 0 THEN sold_count::text || ' vendidos'
  ELSE 'Novo'
END
WHERE reviews_label IS NULL OR btrim(reviews_label) = '';

-- Todos os produtos ativos entram na simulação de vendas do dashboard
INSERT INTO public.simulation_product_settings (product_id, enabled, weight, priority)
SELECT p.id, true, 1, 'normal'
FROM public.products p
WHERE p.status = 'active'
ON CONFLICT (product_id) DO NOTHING;