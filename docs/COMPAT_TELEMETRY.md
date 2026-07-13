# Compatibility Telemetry — the "ProtonDB of translations"

> Opt-in (default **OFF**) telemetry that automatically reports the outcome of
> each translation run per game/engine/step, building a public community
> compatibility database: *"this game works in 94% of runs, tested by N users"*.

## Data flow

```
translation run ──> reportCompatStep()  ──> Supabase compat_reports (insert-only, RLS)
                     │  (opt-in gate, fail-open,                │
                     │   offline queue in localStorage)          ▼
game detail page <── fetchCompatSummary() <── compat_game_summary (aggregated view)
```

## Pieces

| Piece | Where |
|---|---|
| Sender + queue + opt-in gate | `lib/compat-telemetry.ts` |
| Hooks (hero engines: Ren'Py, Hendrix, RPG Maker, …) | `lib/hero-job-tracking.ts` (`done`/`fail`/`setStage`) |
| Hooks (universal fast path) | `components/game-detail-client.tsx` (`startAutoTranslate`) |
| Boot confirmation banner + community badge | `components/game-detail/compat-card.tsx` |
| Opt-in toggle (Community tab) | `app/settings/page.tsx` → `settings.privacy.compatTelemetry` |
| Schema + RLS + view | `supabase/migrations/20260713_compat_reports.sql` |
| i18n | namespace `compat` (14 keys, 12 locales) |

## The model

- A **run** = one translation attempt, identified by a client-generated
  `run_id`. Steps: `scan → detect → extract → translate → patch → boot`.
- Automatic rows are sent at run end (success/partial at `patch`, or failure at
  the step reached). The **boot** row is user-confirmed: after a successful
  patch the game page shows a small banner — *"does the game start with the
  translation?"* 👍/👎/skip.
- Aggregation (`compat_game_summary`) takes the **furthest step per run**,
  grouped by `game_key` + `target_lang`. `game_key` is the Steam AppID when
  available, else a normalized name slug (`g:<slug>`), so reports from
  different users converge on the same game.

## Privacy (mirrors the TM Network model)

- **No file paths, no raw error messages** — errors are reduced to a short
  category code (`drm`, `no_strings`, `encoding`, `network`, …) by
  `classifyCompatError()`.
- `contributor_id` only when the user is signed in to the community, else null.
- Insert-only table: no select policy on raw rows; public reads go through the
  aggregated view only.
- Everything is skipped unless `settings.privacy.compatTelemetry === true`.

## Failure behavior

Telemetry must never break a run: every call is `void reportCompatStep(...)`,
errors are swallowed and rows are parked in a localStorage queue
(`gs-compat-queue`, cap 50) retried on the next report.

## Next steps (see ROADMAP.md)

Public web page on gamestringer.ai, one-time opt-in prompt after the first
successful translation, library card badges, server-side anti-abuse.
