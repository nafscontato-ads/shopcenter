-- 1) Remove os produtos de demonstração (sem foto e sem link)
DELETE FROM public.sales_month_products
WHERE product_id IN (SELECT id FROM public.products WHERE primary_image IS NULL AND url IS NULL);

DELETE FROM public.simulation_product_settings
WHERE product_id IN (SELECT id FROM public.products WHERE primary_image IS NULL AND url IS NULL);

DELETE FROM public.products WHERE primary_image IS NULL AND url IS NULL;

-- 2) Reconstrói a quebra por produto de cada mês usando produtos reais com foto
DELETE FROM public.sales_month_products;

WITH top AS (
  SELECT id, name, price, commission,
         row_number() OVER (ORDER BY sold_count DESC, viral_score DESC, name) AS rn
  FROM public.products
  WHERE status = 'active' AND primary_image IS NOT NULL AND price > 0
  LIMIT 12
),
w AS (
  SELECT t.*, (13 - t.rn)::numeric AS weight, (SELECT sum(13 - rn)::numeric FROM top) AS total_weight
  FROM top t
),
calc AS (
  SELECT m.month, w.id AS product_id, w.price, w.commission,
         GREATEST(1, ROUND((m.gross_brl * (w.weight / w.total_weight)) / w.price))::int AS quantity
  FROM public.sales_months m CROSS JOIN w
)
INSERT INTO public.sales_month_products (month, product_id, quantity, unit_price, gross_brl, commission_brl)
SELECT month, product_id, quantity, price,
       ROUND(quantity * price, 2),
       ROUND(quantity * price * commission / 100.0, 2)
FROM calc;