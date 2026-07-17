-- Quality benchmark telemetry ("the leaderboard of translation providers").
-- Opt-in, insert-only samples of the QA score (0-100) already computed per run,
-- tagged by provider + source/target language + game genre.
--
-- Powers two things:
--   1. A public benchmark ("for IT->JA on JRPG, provider X scores best").
--   2. Data-driven Auto-Select on the client (chain reordering).
--
-- Privacy model mirrors compat_reports: no paths, no game names, no free text.
-- A single translation run emits a handful of samples (one per compared
-- provider), each with its own client-generated sample_id for dedup.
-- contributor_id is set only when logged into the community (nullable).

create table if not exists public.benchmark_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sample_id uuid not null,             -- client-generated, for idempotent dedup
  provider text not null,
  source_lang text,
  target_lang text,
  genre text,                          -- jrpg | visualnovel | rpg | ... | any
  qa_score integer not null check (qa_score between 0 and 100),
  engine text,                         -- optional context (renpy, unity, ...)
  app_version text,
  os text check (os is null or os in ('windows', 'macos', 'linux')),
  contributor_id uuid references auth.users (id) on delete set null,
  ip_hash text,                        -- set by the guard trigger, never exposed
  -- size guardrails (anon-writable table)
  constraint benchmark_provider_len check (char_length(provider) <= 40),
  constraint benchmark_langs_len check (
    (source_lang is null or char_length(source_lang) <= 10)
    and (target_lang is null or char_length(target_lang) <= 10)
  ),
  constraint benchmark_genre_len check (genre is null or char_length(genre) <= 30),
  constraint benchmark_engine_len check (engine is null or char_length(engine) <= 60),
  constraint benchmark_version_len check (app_version is null or char_length(app_version) <= 20)
);

create index if not exists benchmark_reports_pair_idx
  on public.benchmark_reports (target_lang, source_lang, genre, provider);
create index if not exists benchmark_reports_sample_idx on public.benchmark_reports (sample_id);
create index if not exists benchmark_reports_ip_idx on public.benchmark_reports (ip_hash, created_at desc);

alter table public.benchmark_reports enable row level security;

-- Insert-only for everyone (anon included). contributor_id can only be your own
-- auth uid or null.
drop policy if exists benchmark_reports_insert on public.benchmark_reports;
create policy benchmark_reports_insert on public.benchmark_reports
  for insert to anon, authenticated
  with check (contributor_id is null or contributor_id = auth.uid());

-- No select/update/delete on the base table: raw rows stay private, public
-- reads go through the aggregate view (owner bypasses RLS).

-- ── Anti-abuse guard ───────────────────────────────────────
-- 1. DEDUP  — a sample_id is stored once, ever (idempotent client retries).
-- 2. BURST  — max 300 rows/hour per client IP (a run emits only a few).
-- Violations are dropped SILENTLY (RETURN NULL) so the offline queue clears.
create or replace function public.benchmark_reports_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hdrs json;
  ip text;
  recent_count int;
begin
  begin
    hdrs := current_setting('request.headers', true)::json;
    ip := nullif(trim(split_part(coalesce(hdrs ->> 'x-forwarded-for', ''), ',', 1)), '');
  exception when others then
    ip := null;
  end;
  new.ip_hash := case when ip is null then null else md5(ip) end;

  -- 1. Dedup by sample_id.
  if exists (select 1 from public.benchmark_reports r where r.sample_id = new.sample_id) then
    return null;
  end if;

  -- 2. Burst limit per IP.
  if new.ip_hash is not null then
    select count(*) into recent_count
    from public.benchmark_reports r
    where r.ip_hash = new.ip_hash
      and r.created_at > now() - interval '1 hour';
    if recent_count >= 300 then
      return null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists benchmark_reports_guard_trg on public.benchmark_reports;
create trigger benchmark_reports_guard_trg
  before insert on public.benchmark_reports
  for each row execute function public.benchmark_reports_guard();

-- ── Public aggregate view ──────────────────────────────────
-- One row per (provider, source_lang, target_lang, genre): sample count and
-- average/stddev of the QA score. The client applies its own confidence
-- lower-bound ranking on top of this.
create or replace view public.benchmark_provider_summary as
select
  provider,
  source_lang,
  target_lang,
  coalesce(genre, 'any') as genre,
  count(*)::int as samples,
  round(avg(qa_score)::numeric, 1) as avg_score,
  round(coalesce(stddev_samp(qa_score), 0)::numeric, 1) as stddev_score,
  min(qa_score)::int as min_score,
  max(qa_score)::int as max_score,
  count(distinct contributor_id) filter (where contributor_id is not null)::int as known_contributors,
  max(created_at) as last_report_at
from public.benchmark_reports
group by provider, source_lang, target_lang, coalesce(genre, 'any');

grant select on public.benchmark_provider_summary to anon, authenticated;
