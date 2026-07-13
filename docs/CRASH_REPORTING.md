# Crash Reporting — opt-in anonymous error reports

> Opt-in (default **OFF** — `settings.privacy.crashReports`, Settings →
> Community → Privacy & telemetry). When enabled, real-world failures become
> actionable issues instead of dying silently on the user's PC.

## What gets captured

| Source | Area tag | Hook |
|---|---|---|
| Uncaught window errors | `window` | `installGlobalCrashHandlers()` (installed by `SettingsBootGate`) |
| Unhandled promise rejections | `promise` | same |
| React ErrorBoundary / WidgetErrorBoundary | `react-widget` | `components/error-boundary.tsx` |
| AppErrorBoundary (fatal) | `react-app` | same |
| Translation pipeline failures | `pipeline` | `hero-job-tracking.fail()` + universal fast path catch |

Each report: stable `signature` (groups occurrences of the same defect),
error `category` (same classifier as compat telemetry: drm, network,
encoding, …), sanitized `message` (≤300) and reduced `stack` (first 12 app
frames, ≤2000), engine/game_key when known, app version, OS.

## Privacy guarantees

`sanitizeCrashText()` strips everything identifying before anything leaves
the machine: Windows/POSIX paths → `<path>/basename`, emails → `<email>`,
API keys/tokens/JWTs → `<token>`/`<jwt>`, URL query strings and credentials,
long hex blobs. Covered by regression tests in
`__tests__/lib/crash-reporter.test.ts`. `contributor_id` only when signed in
to the community, else null.

## Abuse & noise control

- Client: same signature max 3×/session; offline queue (`gs-crash-queue`,
  cap 30) retried later; fail-open everywhere (reporting never worsens a crash).
- Server (`crash_reports_guard` trigger, silent drops): same signature from
  the same IP max 1×/hour; max 30 reports/hour per IP. IP stored only as md5
  in `ip_hash`, never exposed (insert-only RLS, no select policy).

## Triage (developer)

The `crash_signatures` view (not granted to anon/authenticated — dashboard
only) groups reports per signature with occurrences, affected IPs, first/last
seen, last version and a sample message:

```sql
select * from crash_signatures order by occurrences desc limit 50;
```

## Files

`lib/crash-reporter.ts` · `supabase/migrations/20260713_crash_reports.sql` ·
toggle in `app/settings/page.tsx` (i18n namespace `crash`, 12 locales) ·
tests in `__tests__/lib/crash-reporter.test.ts`.
