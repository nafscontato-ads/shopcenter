-- Só quem comprou (webhook da Applyfy) entra no sistema.
create table if not exists public.purchase_access (
  email text primary key check (email = lower(email)),
  status text not null default 'active' check (status in ('active', 'revoked')),
  offer text,
  source text not null default 'applyfy',
  last_event text,
  purchased_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.purchase_access enable row level security;
-- Sem políticas: só o servidor (service_role) lê e grava.

create table if not exists public.purchase_webhook_events (
  id bigint generated always as identity primary key,
  source text not null default 'applyfy',
  email text,
  event text,
  result text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
alter table public.purchase_webhook_events enable row level security;

-- Os 192 alunos já existentes contam como compradores.
insert into public.purchase_access (email, source, last_event)
select lower(email), 'migracao', 'conta_existente' from public.profiles
where email is not null and status = 'active'
on conflict (email) do nothing;

-- Conta nova nasce liberada só se o e-mail comprou (ou é admin); senão fica pendente.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  allowed boolean;
begin
  allowed := exists (select 1 from public.purchase_access pa where pa.email = lower(new.email) and pa.status = 'active')
          or exists (select 1 from public.admin_users au where lower(au.email) = lower(new.email) and au.is_active);

  insert into public.profiles (id, email, full_name, avatar_url, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    case when allowed then 'active' else 'pending' end
  )
  on conflict (id) do nothing;

  insert into public.user_limits (user_id, purchased_at)
  values (new.id, now())
  on conflict (user_id) do nothing;

  update public.admin_users
  set user_id = new.id, updated_at = now()
  where lower(email) = lower(new.email) and user_id is null;

  return new;
end;
$$;

-- O próprio aluno não pode mudar o status dele (antes dava para se autoliberar).
create or replace function public.guard_profile_status()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status is distinct from old.status
     and auth.uid() is not null
     and not public.is_admin(auth.uid()) then
    new.status := old.status;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_status on public.profiles;
create trigger profiles_guard_status before update on public.profiles
for each row execute function public.guard_profile_status();
