-- Compatibility telemetry ("ProtonDB of translations")
-- Opt-in, insert-only reports of pipeline outcomes per game/engine/step.
-- Privacy model mirrors shared_tm: no paths, no free-text errors, contributor_id
-- only when the user is logged into the community (nullable).
--
-- A "run" (run_id, client-generated uuid) can produce multiple rows:
-- automatic step outcomes during the pipeline + an optional later 'boot'
-- confirmation from the user. Aggregation takes the furthest step per run.

create table if not exists public.compat_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_id uuid not null,
  game_key text not null,            -- AppID as text when available, else normalized name/path key
  game_app_id integer,               -- Steam AppID (null for other stores / manual games)
  game_name text not null,
  store text,                        -- steam | epic | gog | manual | ...
  build_id text,                     -- Steam buildid at report time (translation may break on update)
  engine text,
  step text not null check (step in ('scan', 'detect', 'extract', 'translate', 'patch', 'boot')),
  result text not null check (result in ('success', 'partial', 'failure')),
  strings_total integer check (strings_total is null or strings_total >= 0),
  strings_translated integer check (strings_translated is null or strings_translated >= 0),
  source_lang text,
  target_lang text,
  provider text,
  app_version text,
  os text check (os is null or os in ('windows', 'macos', 'linux')),
  error_category text,               -- sanitized short code (drm, encoding, no_strings, network, ...), NEVER raw messages
  contributor_id uuid references auth.users (id) on delete set null,
  -- size guardrails (anon-writable table)
  constraint compat_reports_game_key_len check (char_length(game_key) <= 120),
  constraint compat_reports_game_name_len check (char_length(game_name) <= 200),
  constraint compat_reports_store_len check (store is null or char_length(store) <= 30),
  constraint compat_reports_build_len check (build_id is null or char_length(build_id) <= 40),
  constraint compat_reports_engine_len check (engine is null or char_length(engine) <= 60),
  constraint compat_reports_langs_len check (
    (source_lang is null or char_length(source_lang) <= 10)
    and (target_lang is null or char_length(target_lang) <= 10)
  ),
  constraint compat_reports_provider_len check (provider is null or char_length(provider) <= 40),
  constraint compat_reports_version_len check (app_version is null or char_length(app_version) <= 20),
  constraint compat_reports_error_len check (error_category is null or char_length(error_category) <= 40)
);

create index if not exists compat_reports_game_key_idx on public.compat_reports (game_key, created_at desc);
create index if not exists compat_reports_run_idx on public.compat_reports (run_id);

alter table public.compat_reports enable row level security;

-- Insert-only for everyone (anon included). contributor_id can only be your own
-- auth uid or null — nobody can impersonate another tester.
drop policy if exists compat_reports_insert on public.compat_reports;
create policy compat_reports_insert on public.compat_reports
  for insert to anon, authenticated
  with check (contributor_id is null or contributor_id = auth.uid());

-- No select/update/delete policies on the base table: raw rows stay private.
-- Public reads go through the aggregate view below (owner bypasses RLS).

create or replace view public.compat_game_summary as
with latest as (
  -- one row per run: the furthest step reached (boot > patch > ... > scan)
  select distinct on (run_id)
    run_id, game_key, game_app_id, game_name, engine, step, result,
    target_lang, app_version, created_at, contributor_id
  from public.compat_reports
  order by run_id,
    case step
      when 'boot' then 6 when 'patch' then 5 when 'translate' then 4
      when 'extract' then 3 when 'detect' then 2 else 1
    end desc,
    created_at desc
)
select
  game_key,
  target_lang,
  max(game_app_id) as game_app_id,
  (array_agg(game_name order by created_at desc))[1] as game_name,
  (array_agg(engine order by created_at desc) filter (where engine is not null))[1] as engine,
  count(*)::int as runs,
  count(*) filter (where result = 'success' and step in ('patch', 'boot'))::int as ok_runs,
  count(*) filter (where step = 'boot' and result = 'success')::int as boot_ok_runs,
  count(*) filter (where step = 'boot' and result = 'failure')::int as boot_fail_runs,
  count(distinct contributor_id) filter (where contributor_id is not null)::int as known_testers,
  max(created_at) as last_report_at,
  (array_agg(app_version order by created_at desc) filter (where app_version is not null))[1] as last_app_version
from latest
group by game_key, target_lang;

grant select on public.compat_game_summary to anon, authenticated;
