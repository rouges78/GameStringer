-- ─────────────────────────────────────────────────────────────────────────────
-- Demote unproven patch successes in the public compatibility view.
--
-- WHY (found 2026-08-13, roadmap entry [compat-strings-total-zero]):
-- every client up to and including v1.16.0 reports strings_total = 0 on the
-- fast path, because the TS side declares `totalStrings` on a Rust struct
-- (WorkflowExecutionResult) that never had the field — `undefined || 0` = 0,
-- always. Worse, the `result` it reports derives from success_rate, which is
-- the fraction of workflow STAGES completed, not of strings written. Net
-- effect: a run that translated nothing can reach the public database as
-- 'success'. 12 out of 12 reports had strings_total = 0.
--
-- WHAT THIS CHANGES — exactly one thing, the public aggregation:
--   * ok_runs no longer counts a patch-level 'success' with no evidence
--     (strings_total NULL or 0). It still counts:
--       - every boot-level 'success': that is the USER's thumbs-up in the
--         post-boot banner — human attestation, stronger than any counter.
--         The view keeps one row per run (the furthest step), so a run whose
--         unproven patch success was later confirmed at boot is counted via
--         its boot row: boot redeems patch, by construction.
--       - patch-level 'success' with strings_total > 0 (real evidence).
--   * a new trailing column `unproven_ok_runs` exposes how many runs claim
--     success without evidence, so the site can honestly say "awaiting
--     confirmation" instead of silently inflating ok_runs.
--
-- WHAT THIS DELIBERATELY DOES NOT DO:
--   * no DELETE, no UPDATE on compat_reports: old rows are indeterminate, not
--     false. Runtime-only runs (BepInEx/XUnity) legitimately write 0 strings
--     and old clients never sent the information needed to tell them apart
--     from silent failures. Pending boot checks (30-day TTL) may still turn
--     any of these rows into the best-attested row of the table.
--   * no CHECK constraint on the base table: it would silently reject inserts
--     from old clients (telemetry is fail-open), losing data instead of
--     qualifying it.
--
-- Rollback: re-run the view definition from 20260713145841_compat_reports.sql.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.compat_game_summary as
with latest as (
  -- one row per run: the furthest step reached (boot > patch > ... > scan)
  select distinct on (run_id)
    run_id, game_key, game_app_id, game_name, engine, step, result,
    strings_total,
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
  -- 'success' counts only when attested: by the user at boot, or by a real
  -- string counter at patch. An unproven patch success is NOT an ok_run.
  count(*) filter (
    where result = 'success' and (
      step = 'boot'
      or (step = 'patch' and coalesce(strings_total, 0) > 0)
    )
  )::int as ok_runs,
  count(*) filter (where step = 'boot' and result = 'success')::int as boot_ok_runs,
  count(*) filter (where step = 'boot' and result = 'failure')::int as boot_fail_runs,
  count(distinct contributor_id) filter (where contributor_id is not null)::int as known_testers,
  max(created_at) as last_report_at,
  (array_agg(app_version order by created_at desc) filter (where app_version is not null))[1] as last_app_version,
  -- New, appended last (create-or-replace requires append-only columns):
  -- success claims still waiting for their proof. Kept visible on purpose.
  count(*) filter (
    where step = 'patch' and result = 'success' and coalesce(strings_total, 0) = 0
  )::int as unproven_ok_runs
from latest
group by game_key, target_lang;

grant select on public.compat_game_summary to anon, authenticated;
