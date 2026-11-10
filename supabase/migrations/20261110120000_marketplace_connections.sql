-- Conexões oficiais (OAuth) com Mercado Livre, Shopify, TikTok Shop, Amazon e Magalu.
-- Tokens só são lidos pelo servidor (service role). RLS ligado e sem políticas:
-- nenhum aluno lê token pelo navegador.

create table if not exists public.marketplace_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('mercado-livre','shopify','tiktok-shop','amazon','magalu')),
  external_account_id text not null,
  account_name text,
  access_token text not null default '',
  refresh_token text,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scopes text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','expired','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_account_id)
);
create index if not exists marketplace_connections_user_idx on public.marketplace_connections (user_id, provider, status);
alter table public.marketplace_connections enable row level security;

create table if not exists public.marketplace_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  state_hash text not null unique,
  code_verifier text,
  shop_domain text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.marketplace_oauth_states enable row level security;

create table if not exists public.marketplace_notifications (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  topic text not null,
  resource text not null,
  external_account_id text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists marketplace_notifications_pending_idx on public.marketplace_notifications (provider, received_at) where processed_at is null;
alter table public.marketplace_notifications enable row level security;
