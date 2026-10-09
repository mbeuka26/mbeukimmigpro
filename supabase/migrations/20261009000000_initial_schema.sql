-- MbeukImmig Pro — schéma initial (Auth Supabase requis)
-- Pas de données fictives métier ; tables vides à l'installation.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- Profil étendu (1:1 avec auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('disclaimer_immigration', 'privacy_policy', 'terms')),
  version text not null,
  acknowledged_at timestamptz not null default now(),
  unique (user_id, kind, version)
);

create table public.immigration_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  destination_country_code text not null check (char_length(destination_country_code) = 2),
  pathway_code text,
  profile_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.eligibility_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.immigration_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  country_code text not null,
  pathway_code text not null,
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  rules_version text not null,
  created_at timestamptz not null default now()
);

-- Corpus public (admin alimente ; pas de RAG auto dans cette migration)
create table public.guide_sections (
  id uuid primary key default gen_random_uuid(),
  country_code text,
  slug text not null unique,
  title text not null,
  body_md text not null default '',
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create index guide_sections_country_idx on public.guide_sections (country_code);
create index immigration_projects_user_idx on public.immigration_projects (user_id);

alter table public.profiles enable row level security;
alter table public.legal_acknowledgments enable row level security;
alter table public.immigration_projects enable row level security;
alter table public.eligibility_runs enable row level security;
alter table public.guide_sections enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy legal_own on public.legal_acknowledgments
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy projects_own on public.immigration_projects
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy eligibility_own on public.eligibility_runs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy guide_public_read on public.guide_sections
  for select to authenticated using (published = true);

-- Trigger profil à la création utilisateur (service role / dashboard SQL à activer côté projet)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

-- À attacher manuellement après validation : on auth.users
