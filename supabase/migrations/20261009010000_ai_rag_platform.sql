-- Phase B–L : IA, BYOK, quotas, sources, RAG, agent, admin

-- ── Plans & quotas ──
create table public.billing_plans (
  id text primary key,
  label text not null,
  daily_request_limit int not null default 50,
  monthly_request_limit int not null default 500,
  daily_token_limit bigint not null default 100000,
  monthly_token_limit bigint not null default 1000000,
  max_output_tokens int not null default 4096,
  max_request_bytes int not null default 65536,
  monthly_cost_cap_cents int,
  created_at timestamptz not null default now()
);

insert into public.billing_plans (id, label) values
  ('free', 'Gratuit'),
  ('standard', 'Standard')
on conflict do nothing;

create table public.user_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_id text not null references public.billing_plans (id) default 'free',
  updated_at timestamptz not null default now()
);

create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  period_type text not null check (period_type in ('day', 'month')),
  period_key text not null,
  requests_count int not null default 0,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  tool_calls int not null default 0,
  estimated_cost_cents int not null default 0,
  primary key (user_id, period_type, period_key)
);

create table public.llm_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  billing_mode text not null check (billing_mode in ('central', 'byok')),
  provider_id text not null,
  model_id text not null,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  latency_ms int,
  success boolean not null default true,
  error_code text,
  created_at timestamptz not null default now()
);

-- ── Fournisseurs & modèles (config publique, pas de secrets) ──
create table public.llm_providers (
  id text primary key,
  label text not null,
  console_url text not null,
  enabled boolean not null default true,
  supports_tools boolean not null default false,
  supports_streaming boolean not null default true
);

insert into public.llm_providers (id, label, console_url, supports_tools) values
  ('openai', 'OpenAI', 'https://platform.openai.com/api-keys', true),
  ('anthropic', 'Anthropic Claude', 'https://console.anthropic.com/', true),
  ('google', 'Google Gemini', 'https://aistudio.google.com/apikey', true),
  ('xai', 'xAI Grok', 'https://console.x.ai/', true),
  ('openrouter', 'OpenRouter', 'https://openrouter.ai/settings/keys', true),
  ('mistral', 'Mistral AI', 'https://console.mistral.ai/', true)
on conflict do nothing;

create table public.llm_models (
  id text primary key,
  provider_id text not null references public.llm_providers (id) on delete cascade,
  label text not null,
  context_window int,
  enabled boolean not null default true,
  supports_tools boolean not null default false,
  embedding_model boolean not null default false,
  embedding_dimensions int
);

-- Modèles indicatifs — à valider côté admin avant prod
insert into public.llm_models (id, provider_id, label, context_window, supports_tools) values
  ('gpt-4o-mini', 'openai', 'GPT-4o mini', 128000, true),
  ('claude-sonnet-4-20250514', 'anthropic', 'Claude Sonnet', 200000, true),
  ('gemini-2.0-flash', 'google', 'Gemini 2.0 Flash', 1000000, true),
  ('grok-2-latest', 'xai', 'Grok 2', 131072, false),
  ('openai/gpt-4o-mini', 'openrouter', 'OpenRouter GPT-4o mini', 128000, true),
  ('mistral-small-latest', 'mistral', 'Mistral Small', 128000, true)
on conflict do nothing;

insert into public.llm_models (id, provider_id, label, embedding_model, embedding_dimensions) values
  ('text-embedding-3-small', 'openai', 'Embedding 3 Small', true, 1536)
on conflict do nothing;

create table public.central_ai_config (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  default_provider_id text references public.llm_providers (id),
  default_model_id text references public.llm_models (id),
  updated_at timestamptz not null default now()
);

insert into public.central_ai_config (id, enabled) values (1, false) on conflict do nothing;

-- ── Préférences IA utilisateur ──
create table public.user_ai_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mode text not null default 'central' check (mode in ('central', 'byok')),
  default_provider_id text references public.llm_providers (id),
  default_model_id text references public.llm_models (id),
  updated_at timestamptz not null default now()
);

create table public.byok_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id text not null references public.llm_providers (id),
  key_hint text not null,
  ciphertext text not null,
  iv text not null,
  key_version text not null default 'v1',
  last_tested_at timestamptz,
  last_test_ok boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider_id)
);

-- ── Sources & collecte ──
create table public.kb_sources (
  id uuid primary key default gen_random_uuid(),
  country_code text,
  authority text not null,
  program_code text,
  procedure_type text,
  language text not null default 'fr',
  category text,
  canonical_url text not null unique,
  check_frequency_hours int not null default 168,
  trust_tier text not null default 'official' check (trust_tier in ('official', 'partner', 'review')),
  approved_for_rag boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.kb_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.kb_sources (id) on delete cascade,
  content_hash text not null,
  raw_storage_path text,
  http_status int,
  etag text,
  last_modified text,
  collected_at timestamptz not null default now(),
  status text not null default 'collected' check (status in (
    'never_collected', 'collected', 'unchanged', 'changed', 'extract_failed',
    'inaccessible', 'pending_validation', 'obsolete', 'removed'
  )),
  error_message text
);

create table public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.kb_sources (id) on delete cascade,
  snapshot_id uuid references public.kb_source_snapshots (id) on delete set null,
  title text not null default '',
  canonical_url text not null,
  country_code text,
  program_code text,
  language text,
  content_type text not null default 'text/html',
  validation_status text not null default 'pending' check (validation_status in (
    'pending', 'approved', 'rejected', 'needs_review'
  )),
  content_fingerprint text not null,
  collected_at timestamptz not null default now(),
  verified_at timestamptz,
  embedding_model_id text references public.llm_models (id),
  unique (source_id, content_fingerprint)
);

create table public.kb_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.kb_documents (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  token_estimate int,
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (to_tsvector('simple', content)) stored,
  unique (document_id, chunk_index)
);

create table public.kb_chunk_embeddings (
  chunk_id uuid primary key references public.kb_document_chunks (id) on delete cascade,
  model_id text not null references public.llm_models (id),
  embedding vector(1536) not null
);

create index kb_chunks_search_idx on public.kb_document_chunks using gin (search_vector);
create index kb_chunks_embedding_idx on public.kb_chunk_embeddings using hnsw (embedding vector_cosine_ops);

create table public.crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.kb_sources (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  attempts int not null default 0,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

-- ── Projets : tâches ──
create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.immigration_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  due_date date,
  created_at timestamptz not null default now()
);

-- ── Documents privés ──
create table public.user_private_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.immigration_projects (id) on delete set null,
  storage_path text not null,
  filename text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

-- ── Conversations & agent ──
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.immigration_projects (id) on delete set null,
  title text,
  created_at timestamptz not null default now()
);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  citations jsonb,
  created_at timestamptz not null default now()
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  steps int not null default 0,
  tool_calls int not null default 0,
  status text not null,
  result jsonb,
  created_at timestamptz not null default now()
);

-- ── RLS ──
alter table public.billing_plans enable row level security;
alter table public.user_plans enable row level security;
alter table public.usage_counters enable row level security;
alter table public.llm_usage_logs enable row level security;
alter table public.llm_providers enable row level security;
alter table public.llm_models enable row level security;
alter table public.central_ai_config enable row level security;
alter table public.user_ai_settings enable row level security;
alter table public.byok_credentials enable row level security;
alter table public.kb_sources enable row level security;
alter table public.kb_source_snapshots enable row level security;
alter table public.kb_documents enable row level security;
alter table public.kb_document_chunks enable row level security;
alter table public.kb_chunk_embeddings enable row level security;
alter table public.crawl_jobs enable row level security;
alter table public.project_tasks enable row level security;
alter table public.user_private_documents enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.agent_runs enable row level security;

create policy billing_plans_read on public.billing_plans for select to authenticated using (true);
create policy llm_providers_read on public.llm_providers for select to authenticated using (enabled = true);
create policy llm_models_read on public.llm_models for select to authenticated using (enabled = true);

create policy user_plans_own on public.user_plans for select to authenticated using (user_id = auth.uid());
create policy usage_own on public.usage_counters for select to authenticated using (user_id = auth.uid());
create policy usage_logs_own on public.llm_usage_logs for select to authenticated using (user_id = auth.uid());

create policy user_ai_settings_own on public.user_ai_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy byok_own on public.byok_credentials
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy kb_docs_read on public.kb_documents
  for select to authenticated using (validation_status = 'approved');
create policy kb_chunks_read on public.kb_document_chunks
  for select to authenticated using (
    exists (
      select 1 from public.kb_documents d
      where d.id = document_id and d.validation_status = 'approved'
    )
  );

create policy projects_tasks_own on public.project_tasks
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy private_docs_own on public.user_private_documents
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy conversations_own on public.conversations
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy messages_own on public.conversation_messages
  for all to authenticated using (
    exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );

create policy agent_runs_own on public.agent_runs
  for select to authenticated using (user_id = auth.uid());

-- Admin : lecture sources / jobs via service role uniquement (pas de policy anon)

-- Quota atomique (central uniquement)
create or replace function public.reserve_central_quota(p_user_id uuid, p_tokens_estimate int default 1000)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.billing_plans;
  v_day_key text := to_char(now() at time zone 'utc', 'YYYY-MM-DD');
  v_month_key text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_day usage_counters;
  v_month usage_counters;
begin
  select bp.* into v_plan
  from user_plans up
  join billing_plans bp on bp.id = up.plan_id
  where up.user_id = p_user_id;

  if v_plan is null then
    select * into v_plan from billing_plans where id = 'free';
    insert into user_plans (user_id, plan_id) values (p_user_id, 'free') on conflict do nothing;
  end if;

  insert into usage_counters (user_id, period_type, period_key, requests_count)
  values (p_user_id, 'day', v_day_key, 0)
  on conflict do nothing;
  insert into usage_counters (user_id, period_type, period_key, requests_count)
  values (p_user_id, 'month', v_month_key, 0)
  on conflict do nothing;

  select * into v_day from usage_counters where user_id = p_user_id and period_type = 'day' and period_key = v_day_key for update;
  select * into v_month from usage_counters where user_id = p_user_id and period_type = 'month' and period_key = v_month_key for update;

  if v_day.requests_count >= v_plan.daily_request_limit then return false; end if;
  if v_month.requests_count >= v_plan.monthly_request_limit then return false; end if;
  if v_day.tokens_in + p_tokens_estimate > v_plan.daily_token_limit then return false; end if;
  if v_month.tokens_in + p_tokens_estimate > v_plan.monthly_token_limit then return false; end if;

  update usage_counters set requests_count = requests_count + 1 where user_id = p_user_id and period_type = 'day' and period_key = v_day_key;
  update usage_counters set requests_count = requests_count + 1 where user_id = p_user_id and period_type = 'month' and period_key = v_month_key;
  return true;
end;
$$;

create or replace function public.record_token_usage(
  p_user_id uuid, p_tokens_in int, p_tokens_out int, p_cost_cents int default 0
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_key text := to_char(now() at time zone 'utc', 'YYYY-MM-DD');
  v_month_key text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
  update usage_counters set tokens_in = tokens_in + p_tokens_in, tokens_out = tokens_out + p_tokens_out,
    estimated_cost_cents = estimated_cost_cents + coalesce(p_cost_cents, 0)
  where user_id = p_user_id and period_type = 'day' and period_key = v_day_key;
  update usage_counters set tokens_in = tokens_in + p_tokens_in, tokens_out = tokens_out + p_tokens_out,
    estimated_cost_cents = estimated_cost_cents + coalesce(p_cost_cents, 0)
  where user_id = p_user_id and period_type = 'month' and period_key = v_month_key;
end;
$$;

revoke all on function public.reserve_central_quota from public;
revoke all on function public.record_token_usage from public;

-- Trigger auth.users → profiles + user_plans + user_ai_settings
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.user_plans (user_id, plan_id) values (new.id, 'free') on conflict do nothing;
  insert into public.user_ai_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sources officielles initiales (catalogue uniquement, contenu à collecter)
insert into public.kb_sources (country_code, authority, program_code, procedure_type, language, category, canonical_url, approved_for_rag, enabled)
values
  ('FR', 'Administration française', 'general', 'information', 'fr', 'portal', 'https://www.immigration.interieur.gouv.fr/', false, true),
  ('CA', 'Gouvernement du Canada', 'immigration', 'information', 'en', 'portal', 'https://www.canada.ca/en/immigration-refugees-citizenship.html', false, true)
on conflict (canonical_url) do nothing;
