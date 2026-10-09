-- Mbeuk Hub integration (kit v1.8) — après schéma MbeukImmig de base

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade unique,
  plan text not null default 'none',
  status text not null default 'none',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  expires_at timestamptz,
  max_devices int not null default 2,
  hub_license_id text,
  hub_access_type text,
  hub_last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('trial','active','expired','blocked','none','pending'));

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  access_type text,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists public.license_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  event text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists hub_user_id text,
  add column if not exists hub_email text,
  add column if not exists hub_product_id uuid,
  add column if not exists business_role text,
  add column if not exists business_permissions jsonb default '{}'::jsonb,
  add column if not exists business_preferences jsonb default '{}'::jsonb;

create unique index if not exists uq_profiles_hub_user_id
  on public.profiles (hub_user_id) where hub_user_id is not null;

create index if not exists idx_profiles_hub_user on public.profiles (hub_user_id);

alter table public.license_history drop constraint if exists license_history_event_check;
alter table public.license_history add constraint license_history_event_check
  check (event in (
    'trial_started','trial_expired','activated','renewed','expired','revoked',
    'hub_sync','hub_sync_pending','hub_denied','checkout_started',
    'hub_register','hub_login','hub_me_refresh'
  ));

create table if not exists public.hub_affiliate_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  link_ref text,
  manual_code text,
  resolved_code text,
  created_at timestamptz not null default now()
);

create index if not exists idx_hub_affiliate_user on public.hub_affiliate_sessions (user_id);

alter table public.subscriptions enable row level security;
alter table public.licenses enable row level security;
alter table public.license_history enable row level security;
alter table public.hub_affiliate_sessions enable row level security;

create policy subscriptions_own on public.subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy license_history_own on public.license_history
  for select to authenticated using (user_id = auth.uid());

create policy hub_affiliate_own on public.hub_affiliate_sessions
  for select to authenticated using (user_id = auth.uid());

comment on table public.subscriptions is 'Cache entitlement synchronisé depuis Hub — pas source de vérité commerciale.';
