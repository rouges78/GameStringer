-- Anti-abuse guard for compat_reports (opt-in compatibility telemetry).
--
-- The table is anon-writable by design, so a BEFORE INSERT trigger enforces:
-- 1. DEDUP    — a (run_id, step, result) triple is stored once, ever.
-- 2. BURST    — max 60 rows/hour per client IP.
-- 3. INFLATE  — max 10 distinct runs per game per 24h per client IP (later
--               steps of an already-counted run, e.g. the boot confirmation,
--               are always allowed).
--
-- Violations are dropped SILENTLY (RETURN NULL): the client treats the insert
-- as successful, so its offline queue never gets stuck retrying rejected rows.
--
-- The client IP comes from PostgREST's request.headers (x-forwarded-for) and
-- is stored only as an md5 hash, in a column that is never exposed: the base
-- table has no SELECT policy and compat_game_summary does not select it.

alter table public.compat_reports add column if not exists ip_hash text;

create index if not exists compat_reports_ip_idx
  on public.compat_reports (ip_hash, created_at desc);

create or replace function public.compat_reports_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hdrs json;
  ip text;
  recent_count int;
  runs_today int;
begin
  -- Client IP (best-effort): first hop of x-forwarded-for from PostgREST.
  begin
    hdrs := current_setting('request.headers', true)::json;
    ip := nullif(trim(split_part(coalesce(hdrs ->> 'x-forwarded-for', ''), ',', 1)), '');
  exception when others then
    ip := null;
  end;
  -- Never trust a client-provided value for this column.
  new.ip_hash := case when ip is null then null else md5(ip) end;

  -- 1. Dedup: the same (run_id, step, result) is stored once, ever.
  if exists (
    select 1 from public.compat_reports r
    where r.run_id = new.run_id and r.step = new.step and r.result = new.result
  ) then
    return null;
  end if;

  if new.ip_hash is not null then
    -- 2. Burst limit: max 60 rows/hour per IP.
    select count(*) into recent_count
    from public.compat_reports r
    where r.ip_hash = new.ip_hash
      and r.created_at > now() - interval '1 hour';
    if recent_count >= 60 then
      return null;
    end if;

    -- 3. Inflation cap: max 10 distinct runs per game per 24h per IP.
    --    Rows belonging to an already-stored run always pass (boot follow-up).
    if not exists (
      select 1 from public.compat_reports r where r.run_id = new.run_id
    ) then
      select count(distinct r.run_id) into runs_today
      from public.compat_reports r
      where r.ip_hash = new.ip_hash
        and r.game_key = new.game_key
        and r.created_at > now() - interval '24 hours';
      if runs_today >= 10 then
        return null;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists compat_reports_guard_trg on public.compat_reports;
create trigger compat_reports_guard_trg
  before insert on public.compat_reports
  for each row execute function public.compat_reports_guard();
