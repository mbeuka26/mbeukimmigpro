-- Colonnes attendues par ensureSaasProfile (kit Hub) — compat display_name existant

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists phone text;

update public.profiles
set full_name = coalesce(nullif(trim(full_name), ''), nullif(trim(display_name), ''))
where full_name is null or trim(full_name) = '';

update public.profiles p
set email = coalesce(nullif(trim(p.email), ''), nullif(trim(p.hub_email), ''), u.email)
from auth.users u
where p.id = u.id
  and (p.email is null or trim(p.email) = '');

comment on column public.profiles.email is 'Miroir email connexion (Hub) — autorité identité : Hub Central';
comment on column public.profiles.full_name is 'Nom affiché ; display_name conservé pour compatibilité legacy';
comment on column public.profiles.phone is 'Téléphone saisi à l''inscription Hub';
