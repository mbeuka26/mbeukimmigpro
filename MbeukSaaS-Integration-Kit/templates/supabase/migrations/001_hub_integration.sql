-- ============================================================================
-- MBEUK HUB INTEGRATION — champs de corrélation et cache d'accès
-- Hub Central reste l'autorité ; ces colonnes servent au cache et à l'audit local.
-- ============================================================================

-- Profils : lien compte SaaS ↔ compte Hub
alter table public.profiles
  add column if not exists hub_user_id text,
  add column if not exists hub_email text,
  add column if not exists hub_product_id uuid;

create index if not exists idx_profiles_hub_user on public.profiles(hub_user_id);

-- Subscriptions : cache synchronisé depuis Hub
alter table public.subscriptions
  add column if not exists hub_license_id text,
  add column if not exists hub_access_type text,
  add column if not exists hub_last_sync_at timestamptz;

-- Statuts entitlement Hub (none = pas de licence, pending = paiement en cours)
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('trial','active','expired','blocked','none','pending'));

-- Étendre les événements license_history pour Hub
alter table public.license_history drop constraint if exists license_history_event_check;

-- Données déjà insérées par les Edge Functions avant cette migration (hub_register, hub_login, etc.)
update public.license_history
set
  details = coalesce(details, '{}'::jsonb) || jsonb_build_object('legacy_event', event),
  event = 'hub_sync'
where event not in (
  'trial_started','trial_expired','activated','renewed','expired','revoked',
  'hub_sync','hub_sync_pending','hub_denied','checkout_started',
  'hub_register','hub_login','hub_me_refresh'
);

alter table public.license_history add constraint license_history_event_check
  check (event in (
    'trial_started','trial_expired','activated','renewed','expired','revoked',
    'hub_sync','hub_sync_pending','hub_denied','checkout_started',
    'hub_register','hub_login','hub_me_refresh'
  ));

-- Attribution affiliée (session checkout, idempotence légère)
create table if not exists public.hub_affiliate_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  link_ref text,
  manual_code text,
  resolved_code text,
  created_at timestamptz not null default now()
);
create index if not exists idx_hub_affiliate_user on public.hub_affiliate_sessions(user_id);

alter table public.hub_affiliate_sessions enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'hub_affiliate_sessions' and policyname = 'hub_affiliate_own'
  ) then
    create policy hub_affiliate_own on public.hub_affiliate_sessions
      for select using (auth.uid() = user_id);
  end if;
end $$;

comment on column public.subscriptions.hub_license_id is 'Référence cache — autorité : Hub Central';
comment on column public.subscriptions.hub_last_sync_at is 'Dernière synchronisation validateLicense/sync Hub';
