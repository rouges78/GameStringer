-- In-app feedback (bug / idea / other) — insert-only, privacy-first.
--
-- PROPOSED migration: NOT applied automatically. Review + run in the Supabase
-- SQL editor (or via CLI) when ready. Mirrors the privacy & abuse model of
-- compat_reports / crash_reports / benchmark_reports:
--   - insert-only for anon/authenticated (no select/update/delete policies);
--   - free-text `message` is size-capped here as a second line of defence;
--   - `context` is a small jsonb blob (app version, platform, current route,
--     best-effort gameId) — the client attaches NO paths/tokens/personal data;
--   - client IP stored only as an md5 hash by the guard trigger, never exposed;
--   - abusive rows dropped SILENTLY so the client never blocks on send.
--
-- The app inserts rows fail-open: if the backend is missing/misconfigured the
-- widget falls back to clipboard + mailto, so this table is purely additive.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null check (category in ('bug', 'idea', 'other')),
  message text not null,
  context jsonb not null default '{}'::jsonb,
  app_version text,
  os text check (os is null or os in ('windows', 'macos', 'linux')),
  contributor_id uuid references auth.users (id) on delete set null,
  ip_hash text,                        -- set by the guard trigger, never exposed
  -- size guardrails (anon-writable table)
  constraint feedback_message_len check (char_length(message) between 1 and 4000),
  constraint feedback_version_len check (app_version is null or char_length(app_version) <= 20),
  constraint feedback_context_size check (pg_column_size(context) <= 8192)
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_category_idx on public.feedback (category, created_at desc);
create index if not exists feedback_ip_idx on public.feedback (ip_hash, created_at desc);

alter table public.feedback enable row level security;

-- Insert-only for everyone (anon included). contributor_id can only be your own
-- auth uid or null. No select/update/delete: raw rows stay private.
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert to anon, authenticated
  with check (contributor_id is null or contributor_id = auth.uid());

-- ── Anti-abuse guard ───────────────────────────────────────
-- BURST — max 20 submissions/hour per client IP. Violations dropped SILENTLY
-- (RETURN NULL) so the widget's send never hangs.
create or replace function public.feedback_guard()
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
    select count(*) into recent_count
    from public.feedback r
    where r.ip_hash = new.ip_hash
      and r.created_at > now() - interval '1 hour';
    if recent_count >= 20 then
      return null;
    end if;
  end if;

  return new;
end;
$$;

-- The guard reads/writes the table it protects; keep EXECUTE off the public
-- roles (consistent with 20260723120749_harden_trigger_guard_execute.sql).
revoke all on function public.feedback_guard() from anon, authenticated;

drop trigger if exists feedback_guard_trg on public.feedback;
create trigger feedback_guard_trg
  before insert on public.feedback
  for each row execute function public.feedback_guard();
