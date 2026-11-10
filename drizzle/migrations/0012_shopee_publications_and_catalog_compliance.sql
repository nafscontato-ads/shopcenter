-- =============================================================================
-- PAS · Publicação Shopee sem erro
--   1) shopee_publications      → histórico por (loja, produto): trava contra
--                                  duplo clique, guarda item_id, retoma variações
--   2) catalog_product_compliance → dados que a Shopee exige por produto
--                                  (EAN, ANATEL, ANVISA, tabela de medidas…)
--                                  + resultado da checagem do catálogo
-- Tabelas novas e separadas: não altera nenhuma tabela existente.
-- =============================================================================

-- 1) Histórico de publicação --------------------------------------------------
create table if not exists public.shopee_publications (
  shop_id     bigint      not null,
  product_id  text        not null,
  item_id     bigint,
  status      text        not null default 'publishing'
              check (status in ('publishing','created','partial','published','blocked','failed')),
  last_error  text,
  blockers    jsonb,
  attempts    integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (shop_id, product_id)
);
create index if not exists shopee_publications_item_idx on public.shopee_publications (shop_id, item_id);
create index if not exists shopee_publications_status_idx on public.shopee_publications (status);

alter table public.shopee_publications enable row level security;
-- As Edge Functions usam service_role (ignoram RLS).
-- ADAPTAR: para o front do aluno ler o status, crie uma policy ligando shop_id
-- à tabela de lojas do usuário, por exemplo:
-- create policy "aluno lê publicações da própria loja" on public.shopee_publications
--   for select using (exists (select 1 from public.shopee_shops s
--                             where s.shop_id = shopee_publications.shop_id and s.user_id = auth.uid()));

-- Trava atômica: só uma publicação por (loja, produto) a cada 3 minutos.
create or replace function public.pas_lock_publication(p_shop_id bigint, p_product_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  insert into public.shopee_publications as sp (shop_id, product_id, status, attempts, updated_at)
  values (p_shop_id, p_product_id, 'publishing', 1, now())
  on conflict (shop_id, product_id) do update
    set status = 'publishing',
        attempts = sp.attempts + 1,
        updated_at = now()
    where sp.status <> 'publishing'
       or sp.updated_at < now() - interval '3 minutes'
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;
revoke all on function public.pas_lock_publication(bigint, text) from public, anon, authenticated;

-- 2) Dados de compliance do catálogo -------------------------------------------
create table if not exists public.catalog_product_compliance (
  product_id               text primary key,
  -- dados REAIS do produto (vêm do fornecedor/embalagem/certificado)
  gtin                     text,
  has_radio                boolean, -- tem Bluetooth/Wi-Fi/RF? (regra ANATEL Shopee 20/10/2026)
  anatel_registration_id   text,   -- 00000-00-00000
  anatel_manufacturer      text,   -- igual ao certificado ANATEL
  anatel_model             text,   -- igual ao certificado ANATEL
  anvisa_code              text,
  inmetro_code             text,
  part_number              text,
  manufacturer             text,
  model                    text,
  size_chart_image_url     text,
  size_chart_template_name text,
  shopee_category_id       bigint, -- sobrescreve a categoria do produto
  -- resultado da checagem automática
  shopee_attributes        jsonb,  -- cache dos atributos resolvidos
  suggested_category_id    bigint,
  publish_status           text not null default 'unchecked'
                           check (publish_status in ('unchecked','ok','warning','blocked')),
  blockers                 jsonb,
  warnings                 jsonb,
  checked_at               timestamptz,
  data_updated_at          timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint gtin_digits check (gtin is null or gtin ~ '^[0-9]{8}$|^[0-9]{12,14}$'),
  constraint anatel_format check (anatel_registration_id is null or anatel_registration_id ~ '^[0-9]{5}-[0-9]{2}-[0-9]{5}$')
);
create index if not exists catalog_product_compliance_status_idx on public.catalog_product_compliance (publish_status);

-- data_updated_at só muda quando um DADO do produto muda (não quando a checagem grava)
create or replace function public.pas_compliance_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    -- linha criada só pela checagem (sem dado nenhum) não "suja" o produto
    if coalesce(new.gtin, new.has_radio::text, new.anatel_registration_id, new.anatel_manufacturer, new.anatel_model, new.anvisa_code,
                new.inmetro_code, new.part_number, new.manufacturer, new.model, new.size_chart_image_url,
                new.size_chart_template_name, new.shopee_category_id::text) is null then
      new.data_updated_at := 'epoch'::timestamptz;
    else
      new.data_updated_at := now();
    end if;
  elsif (new.gtin, new.has_radio, new.anatel_registration_id, new.anatel_manufacturer, new.anatel_model, new.anvisa_code,
         new.inmetro_code, new.part_number, new.manufacturer, new.model, new.size_chart_image_url,
         new.size_chart_template_name, new.shopee_category_id)
     is distinct from
        (old.gtin, old.has_radio, old.anatel_registration_id, old.anatel_manufacturer, old.anatel_model, old.anvisa_code,
         old.inmetro_code, old.part_number, old.manufacturer, old.model, old.size_chart_image_url,
         old.size_chart_template_name, old.shopee_category_id) then
    new.data_updated_at := now();
    new.publish_status := 'unchecked';
  end if;
  return new;
end;
$$;

drop trigger if exists pas_compliance_touch on public.catalog_product_compliance;
create trigger pas_compliance_touch
before insert or update on public.catalog_product_compliance
for each row execute function public.pas_compliance_touch();

alter table public.catalog_product_compliance enable row level security;
-- Leitura liberada para usuários logados (o aluno vê se o produto está publicável).
drop policy if exists "logados leem compliance" on public.catalog_product_compliance;
create policy "logados leem compliance" on public.catalog_product_compliance
  for select to authenticated using (true);
-- ADAPTAR: escrita só para admin. Exemplo com tabela user_roles(user_id, role):
-- create policy "admin edita compliance" on public.catalog_product_compliance
--   for all to authenticated
--   using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'))
--   with check (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'));