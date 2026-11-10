create table if not exists public.sales_months (
  month date primary key,
  gross_brl numeric(14,2) not null default 0,
  commission_brl numeric(14,2) not null default 0,
  items integer not null default 0,
  views bigint not null default 0,
  clicks bigint not null default 0,
  is_current boolean not null default false,
  data_source text not null default 'simulation',
  created_at timestamptz not null default now()
);
grant select on public.sales_months to authenticated, anon;
grant all on public.sales_months to service_role;
alter table public.sales_months enable row level security;
create policy "sales_months readable" on public.sales_months for select to authenticated, anon using (true);
create policy "sales_months admin write" on public.sales_months for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table if not exists public.sales_month_products (
  id uuid primary key default gen_random_uuid(),
  month date not null references public.sales_months(month) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 0,
  unit_price numeric(12,2) not null default 0,
  gross_brl numeric(14,2) not null default 0,
  commission_brl numeric(14,2) not null default 0,
  unique (month, product_id)
);
grant select on public.sales_month_products to authenticated, anon;
grant all on public.sales_month_products to service_role;
alter table public.sales_month_products enable row level security;
create policy "sales_month_products readable" on public.sales_month_products for select to authenticated, anon using (true);
create policy "sales_month_products admin write" on public.sales_month_products for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table if not exists public.simulation_settings (
  id text primary key default 'default',
  enabled boolean not null default true,
  mode text not null default 'automatic',
  precise_mode boolean not null default false,
  interval_min_seconds integer not null default 180,
  interval_max_seconds integer not null default 300,
  exact_interval_seconds integer not null default 300,
  daily_sales_limit integer,
  daily_revenue_target numeric(14,2),
  daily_commission_target numeric(14,2),
  distribution_mode text not null default 'weight',
  quantity_mode text not null default 'random',
  quantity_min integer not null default 1,
  quantity_max integer not null default 3,
  quantity_weights jsonb not null default '{"1":90,"2":8,"3":2}'::jsonb,
  use_custom_price boolean not null default false,
  custom_price_min numeric(12,2),
  custom_price_max numeric(12,2),
  use_custom_commission boolean not null default false,
  custom_commission_type text not null default 'percent',
  custom_commission_value numeric(12,2),
  notifications_enabled boolean not null default true,
  notification_position text not null default 'left',
  notification_title text not null default 'NOVA VENDA',
  notification_duration_seconds integer not null default 5,
  notification_animation text not null default 'normal',
  notification_fields jsonb not null default '{"image":true,"name":true,"price":true,"commission":true,"quantity":true,"time":true}'::jsonb,
  max_notifications integer not null default 5,
  chart_updates_enabled boolean not null default true,
  metrics_enabled jsonb not null default '{"revenue":true,"commission":true,"items":true,"views":true,"clicks":true}'::jsonb,
  traffic_simulation_enabled boolean not null default true,
  views_per_sale_min integer not null default 300,
  views_per_sale_max integer not null default 1200,
  clicks_per_sale_min integer not null default 10,
  clicks_per_sale_max integer not null default 80,
  global_cooldown_seconds integer not null default 600,
  allow_repeat boolean not null default false,
  schedule_enabled boolean not null default false,
  schedule_start_date date,
  schedule_end_date date,
  schedule_start_time time not null default '08:00',
  schedule_end_time time not null default '23:30',
  weekdays integer[] not null default '{0,1,2,3,4,5,6}',
  timezone text not null default 'America/Sao_Paulo',
  daily_reset boolean not null default true,
  forced_next_product_id uuid references public.products(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
grant select on public.simulation_settings to authenticated, anon;
grant all on public.simulation_settings to service_role;
alter table public.simulation_settings enable row level security;
create policy "simulation_settings readable" on public.simulation_settings for select to authenticated, anon using (true);
create policy "simulation_settings admin write" on public.simulation_settings for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
insert into public.simulation_settings (id) values ('default') on conflict do nothing;

create table if not exists public.simulation_product_settings (
  product_id uuid primary key references public.products(id) on delete cascade,
  enabled boolean not null default true,
  weight integer not null default 5,
  priority text not null default 'normal',
  custom_interval_min_seconds integer,
  custom_interval_max_seconds integer,
  quantity_min integer,
  quantity_max integer,
  allow_repeat boolean not null default true,
  cooldown_seconds integer,
  custom_price numeric(12,2),
  custom_commission numeric(12,2),
  updated_at timestamptz not null default now()
);
grant select on public.simulation_product_settings to authenticated, anon;
grant all on public.simulation_product_settings to service_role;
alter table public.simulation_product_settings enable row level security;
create policy "simulation_product_settings readable" on public.simulation_product_settings for select to authenticated, anon using (true);
create policy "simulation_product_settings admin write" on public.simulation_product_settings for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
insert into public.simulation_product_settings (product_id, enabled, weight)
select id, true, 5 from public.products on conflict do nothing;

create table if not exists public.simulation_sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_image text,
  quantity integer not null default 1,
  unit_price numeric(12,2) not null default 0,
  gross_value numeric(14,2) not null default 0,
  commission_value numeric(14,2) not null default 0,
  views_delta integer not null default 0,
  clicks_delta integer not null default 0,
  simulated boolean not null default true,
  origin text not null default 'engine',
  created_at timestamptz not null default now()
);
create index if not exists simulation_sales_created_idx on public.simulation_sales (created_at desc);
grant select on public.simulation_sales to authenticated, anon;
grant all on public.simulation_sales to service_role;
alter table public.simulation_sales enable row level security;
create policy "simulation_sales readable" on public.simulation_sales for select to authenticated, anon using (true);
create policy "simulation_sales admin write" on public.simulation_sales for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

insert into public.sales_months (month, gross_brl, commission_brl, items, views, clicks, is_current) values
('2026-01-01',143871.10,17891.00,2639,1842000,112300,false),
('2026-02-01',151240.00,18720.00,2775,1938000,119600,false),
('2026-03-01',167890.00,20850.00,3098,2115000,131400,false),
('2026-04-01',181430.00,22590.00,3357,2297000,143900,false),
('2026-05-01',196780.00,24410.00,3621,2476000,156800,false),
('2026-06-01',214560.00,26680.00,3946,2679000,171200,false),
('2026-07-01',231950.00,28870.00,4268,2904000,188500,false),
('2026-08-01',248730.00,30980.00,4577,3128000,205700,false),
('2026-09-01',18750.00,2330.00,345,286000,22400,true)
on conflict (month) do nothing;

-- Dados de demonstração: só entram os produtos que existem no banco (num banco novo, nenhum).
insert into public.sales_month_products (month, product_id, quantity, unit_price, gross_brl, commission_brl)
select v.month::date, v.product_id::uuid, v.quantity, v.unit_price, v.gross_brl, v.commission_brl from (values
('2026-01-01','69292c8d-5591-460c-ba1f-32a195324e2c',67,34.90,2338.30,584.58),
('2026-01-01','f49e560f-b0fb-45f2-a0cf-304b92d871b3',320,24.90,7968.00,2151.36),
('2026-01-01','80c3f914-2afb-4282-ae1e-2f98bd9a733c',355,29.90,10614.50,2759.77),
('2026-01-01','19378326-b99a-4f86-bba0-a5c9c66bddb8',338,39.90,13486.20,3371.55),
('2026-01-01','252b6a7d-1db6-4f5c-8be0-b6eefe8afb87',237,59.90,14196.30,3974.96),
('2026-01-01','66e56a21-3188-48da-b6da-94f4a55974bf',296,44.90,13290.40,2923.89),
('2026-01-01','45ce6faf-afb8-4ba7-a74f-a4f1951b3151',683,79.90,54571.70,13097.21),
('2026-01-01','20516dbe-ac55-47dc-87d3-0f2628c12e6f',343,79.90,27405.70,5481.14),
('2026-02-01','69292c8d-5591-460c-ba1f-32a195324e2c',504,34.90,17589.60,4397.40),
('2026-02-01','f49e560f-b0fb-45f2-a0cf-304b92d871b3',56,24.90,1394.40,376.49),
('2026-02-01','80c3f914-2afb-4282-ae1e-2f98bd9a733c',292,29.90,8730.80,2270.01),
('2026-02-01','19378326-b99a-4f86-bba0-a5c9c66bddb8',345,39.90,13765.50,3441.38),
('2026-02-01','252b6a7d-1db6-4f5c-8be0-b6eefe8afb87',223,59.90,13357.70,3740.16),
('2026-02-01','66e56a21-3188-48da-b6da-94f4a55974bf',339,44.90,15221.10,3348.64),
('2026-02-01','45ce6faf-afb8-4ba7-a74f-a4f1951b3151',700,79.90,55932.50,13423.80),
('2026-02-01','20516dbe-ac55-47dc-87d3-0f2628c12e6f',316,79.90,25248.40,5049.68),
('2026-03-01','69292c8d-5591-460c-ba1f-32a195324e2c',598,34.90,20870.20,5217.55),
('2026-03-01','f49e560f-b0fb-45f2-a0cf-304b92d871b3',35,24.90,871.50,235.30),
('2026-03-01','80c3f914-2afb-4282-ae1e-2f98bd9a733c',385,29.90,11511.50,2992.99),
('2026-03-01','19378326-b99a-4f86-bba0-a5c9c66bddb8',413,39.90,16478.70,4119.68),
('2026-03-01','252b6a7d-1db6-4f5c-8be0-b6eefe8afb87',248,59.90,14855.20,4159.46),
('2026-03-01','66e56a21-3188-48da-b6da-94f4a55974bf',288,44.90,12931.20,2844.86),
('2026-03-01','45ce6faf-afb8-4ba7-a74f-a4f1951b3151',785,79.90,62726.30,15054.31),
('2026-03-01','20516dbe-ac55-47dc-87d3-0f2628c12e6f',346,79.90,27645.40,5529.08),
('2026-04-01','69292c8d-5591-460c-ba1f-32a195324e2c',532,34.90,18566.80,4641.70),
('2026-04-01','f49e560f-b0fb-45f2-a0cf-304b92d871b3',382,24.90,9511.80,2568.19),
('2026-04-01','80c3f914-2afb-4282-ae1e-2f98bd9a733c',356,29.90,10644.40,2767.54),
('2026-04-01','19378326-b99a-4f86-bba0-a5c9c66bddb8',82,39.90,3271.80,817.95),
('2026-04-01','252b6a7d-1db6-4f5c-8be0-b6eefe8afb87',305,59.90,18269.50,5115.46),
('2026-04-01','66e56a21-3188-48da-b6da-94f4a55974bf',419,44.90,18813.10,4138.88),
('2026-04-01','45ce6faf-afb8-4ba7-a74f-a4f1951b3151',813,79.90,64959.40,15590.26),
('2026-04-01','20516dbe-ac55-47dc-87d3-0f2628c12e6f',468,79.90,37393.20,7478.64),
('2026-05-01','69292c8d-5591-460c-ba1f-32a195324e2c',198,34.90,6910.20,1727.55),
('2026-05-01','f49e560f-b0fb-45f2-a0cf-304b92d871b3',435,24.90,10831.50,2924.50),
('2026-05-01','80c3f914-2afb-4282-ae1e-2f98bd9a733c',409,29.90,12229.10,3179.57),
('2026-05-01','19378326-b99a-4f86-bba0-a5c9c66bddb8',420,39.90,16758.00,4189.50),
('2026-05-01','252b6a7d-1db6-4f5c-8be0-b6eefe8afb87',358,59.90,21444.20,6004.38),
('2026-05-01','66e56a21-3188-48da-b6da-94f4a55974bf',437,44.90,19621.30,4316.69),
('2026-05-01','45ce6faf-afb8-4ba7-a74f-a4f1951b3151',886,79.90,70793.50,16990.44),
('2026-05-01','20516dbe-ac55-47dc-87d3-0f2628c12e6f',478,79.90,38192.20,7638.44),
('2026-06-01','69292c8d-5591-460c-ba1f-32a195324e2c',653,34.90,22789.70,5697.42),
('2026-06-01','f49e560f-b0fb-45f2-a0cf-304b92d871b3',449,24.90,11180.10,3018.63),
('2026-06-01','80c3f914-2afb-4282-ae1e-2f98bd9a733c',102,29.90,3049.80,792.95),
('2026-06-01','19378326-b99a-4f86-bba0-a5c9c66bddb8',461,39.90,18393.90,4598.48),
('2026-06-01','252b6a7d-1db6-4f5c-8be0-b6eefe8afb87',396,59.90,23720.40,6641.71),
('2026-06-01','66e56a21-3188-48da-b6da-94f4a55974bf',434,44.90,19486.60,4287.05),
('2026-06-01','45ce6faf-afb8-4ba7-a74f-a4f1951b3151',940,79.90,75110.60,18026.54),
('2026-06-01','20516dbe-ac55-47dc-87d3-0f2628c12e6f',511,79.90,40828.90,8165.78),
('2026-07-01','69292c8d-5591-460c-ba1f-32a195324e2c',802,34.90,27989.80,6997.45),
('2026-07-01','f49e560f-b0fb-45f2-a0cf-304b92d871b3',148,24.90,3685.20,995.00),
('2026-07-01','80c3f914-2afb-4282-ae1e-2f98bd9a733c',421,29.90,12587.90,3272.85),
('2026-07-01','19378326-b99a-4f86-bba0-a5c9c66bddb8',491,39.90,19590.90,4897.72),
('2026-07-01','252b6a7d-1db6-4f5c-8be0-b6eefe8afb87',418,59.90,25038.20,7010.70),
('2026-07-01','66e56a21-3188-48da-b6da-94f4a55974bf',451,44.90,20249.90,4454.98),
('2026-07-01','45ce6faf-afb8-4ba7-a74f-a4f1951b3151',1016,79.90,81180.20,19483.25),
('2026-07-01','20516dbe-ac55-47dc-87d3-0f2628c12e6f',521,79.90,41627.90,8325.58),
('2026-08-01','69292c8d-5591-460c-ba1f-32a195324e2c',207,34.90,7224.30,1806.08),
('2026-08-01','f49e560f-b0fb-45f2-a0cf-304b92d871b3',572,24.90,14242.80,3845.56),
('2026-08-01','80c3f914-2afb-4282-ae1e-2f98bd9a733c',598,29.90,17880.20,4648.85),
('2026-08-01','19378326-b99a-4f86-bba0-a5c9c66bddb8',556,39.90,22184.40,5546.10),
('2026-08-01','252b6a7d-1db6-4f5c-8be0-b6eefe8afb87',363,59.90,21743.70,6088.24),
('2026-08-01','66e56a21-3188-48da-b6da-94f4a55974bf',480,44.90,21552.00,4741.44),
('2026-08-01','45ce6faf-afb8-4ba7-a74f-a4f1951b3151',1157,79.90,92447.00,22187.28),
('2026-08-01','20516dbe-ac55-47dc-87d3-0f2628c12e6f',644,79.90,51455.60,10291.12),
('2026-09-01','69292c8d-5591-460c-ba1f-32a195324e2c',55,34.90,1919.50,479.88),
('2026-09-01','f49e560f-b0fb-45f2-a0cf-304b92d871b3',40,24.90,996.00,268.92),
('2026-09-01','80c3f914-2afb-4282-ae1e-2f98bd9a733c',9,29.90,269.10,69.97),
('2026-09-01','19378326-b99a-4f86-bba0-a5c9c66bddb8',42,39.90,1675.80,418.95),
('2026-09-01','252b6a7d-1db6-4f5c-8be0-b6eefe8afb87',36,59.90,2156.40,603.79),
('2026-09-01','66e56a21-3188-48da-b6da-94f4a55974bf',37,44.90,1661.30,365.49),
('2026-09-01','45ce6faf-afb8-4ba7-a74f-a4f1951b3151',79,79.90,6316.60,1515.98),
('2026-09-01','20516dbe-ac55-47dc-87d3-0f2628c12e6f',47,79.90,3755.30,751.06)
) as v(month, product_id, quantity, unit_price, gross_brl, commission_brl)
where exists (select 1 from public.products p where p.id = v.product_id::uuid)
on conflict (month, product_id) do nothing;