-- ============================================================================
-- CLARIFICATION ARCHITECTURALE — Hub = identité/commerce, SaaS = métier
-- ============================================================================

-- Identité Hub : un hub_user_id par compte produit
create unique index if not exists uq_profiles_hub_user_id
  on public.profiles(hub_user_id)
  where hub_user_id is not null;

-- Événements auth Hub
alter table public.license_history drop constraint if exists license_history_event_check;

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

-- Métadonnées métier SaaS (conservées localement, jamais autorité identité)
comment on table public.profiles is
  'Profil métier SaaS — références locales. Autorité identité : Hub Central (hub_user_id).';
comment on table public.licenses is
  'LEGACY — ne plus utiliser comme autorité licence. Hub Central décide. Cache/audit uniquement.';
comment on table public.subscriptions is
  'Cache entitlement synchronisé depuis Hub — pas source de vérité commerciale.';

-- Champs métier optionnels (rôles, préférences — exemples documentés)
alter table public.profiles
  add column if not exists business_role text,
  add column if not exists business_permissions jsonb default '{}'::jsonb,
  add column if not exists business_preferences jsonb default '{}'::jsonb;

comment on column public.profiles.business_role is 'Rôle métier SaaS — supervisé localement, pas par Hub';
comment on column public.profiles.business_permissions is 'Permissions métier SaaS';
comment on column public.profiles.business_preferences is 'Préférences métier SaaS';
