-- Crash / error reporting (opt-in, default OFF — settings.privacy.crashReports).
--
-- Same privacy & abuse model as compat_reports:
-- - insert-only for anon/authenticated (no select/update/delete policies);
-- - messages and stacks are SANITIZED client-side (paths → basenames, no
--   tokens/emails/query strings) and size-capped here as a second line;
-- - client IP stored only as md5 hash by the trigger, never exposed;
-- - abusive rows dropped SILENTLY so client queues never get stuck.
--
-- `signature` is a stable client-side hash of (category | top app frame |
-- normalized message) used to group occurrences of the same defect.

create table if not exists public.crash_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  signature text not null,
  category text not null,
  area text not null check (area in ('window', 'promise', 'react-widget', 'react-app', 'pipeline', 'other')),
  message text,
  stack text,
  engine text,
  game_key text,
  app_version text,
  os text check (os is null or os in ('windows', 'macos', 'linux')),
  contributor_id uuid references auth.users (id) on delete set null,
  ip_hash text,
  constraint crash_reports_signature_len check (char_length(signature) <= 64),
  constraint crash_reports_category_len check (char_length(category) <= 40),
  constraint crash_reports_message_len check (message is null or char_length(message) <= 300),
  constraint crash_reports_stack_len check (stack is null or char_length(stack) <= 2000),
  constraint crash_reports_engine_len check (engine is null or char_length(engine) <= 60),
  constraint crash_reports_game_key_len check (game_key is null or char_length(game_key) <= 120),
  constraint crash_reports_version_len check (app_version is null or char_length(app_version) <= 20)
);

create index if not exists crash_reports_signature_idx on public.crash_reports (signature, created_at desc);
create index if not exists crash_reports_ip_idx on public.crash_reports (ip_hash, created_at desc);

alter table public.crash_reports enable row level security;

drop policy if exists crash_reports_insert on public.crash_reports;
create policy crash_reports_insert on public.crash_reports
  for insert to anon, authenticated
  with check (contributor_id is null or contributor_id = auth.uid());

create or replace function public.crash_reports_guard()
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

  if new.ip_hash is not null then
    -- Dedup: stessa firma dallo stesso IP entro 1 ora → skip silenzioso.
    if exists (
      select 1 from public.crash_reports r
      where r.ip_hash = new.ip_hash
        and r.signature = new.signature
        and r.created_at > now() - interval '1 hour'
    ) then
      return null;
    end if;

    -- Burst: max 30 crash/ora per IP.
    select count(*) into recent_count
    from public.crash_reports r
    where r.ip_hash = new.ip_hash
      and r.created_at > now() - interval '1 hour';
    if recent_count >= 30 then
      return null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists crash_reports_guard_trg on public.crash_reports;
create trigger crash_reports_guard_trg
  before insert on public.crash_reports
  for each row execute function public.crash_reports_guard();

-- Vista di triage per lo sviluppatore (non esposta: nessun grant ad anon).
create or replace view public.crash_signatures as
select
  signature,
  max(category) as category,
  max(area) as area,
  count(*)::int as occurrences,
  count(distinct ip_hash)::int as affected_ips,
  min(created_at) as first_seen,
  max(created_at) as last_seen,
  (array_agg(app_version order by created_at desc) filter (where app_version is not null))[1] as last_version,
  (array_agg(message order by created_at desc) filter (where message is not null))[1] as sample_message
from public.crash_reports
group by signature;

revoke all on public.crash_signatures from anon, authenticated;
