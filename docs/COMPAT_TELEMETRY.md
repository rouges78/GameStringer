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
| Sender + queue + opt-in gate + one-time opt-in prompt | `lib/compat-telemetry.ts` |
| Hooks (hero engines: Ren'Py, Hendrix, RPG Maker, …) | `lib/hero-job-tracking.ts` (`done`/`fail`/`setStage`) |
| Hooks (universal fast path) | `components/game-detail-client.tsx` (`startAutoTranslate`) |
| Boot confirmation banner + community badge | `components/game-detail/compat-card.tsx` |
| Library card badge (batched fetch, 1 query per screen) | `components/compat-badge.tsx` + `fetchCompatSummaryBatched` |
| Opt-in toggle (Community tab) | `app/settings/page.tsx` → `settings.privacy.compatTelemetry` |
| Schema + RLS + view | `supabase/migrations/20260713_compat_reports.sql` |
| Server-side anti-abuse (trigger) | `supabase/migrations/20260713_compat_reports_abuse_guard.sql` |
| Public web page (search + filters, 12 languages) | `docs/sito/compatibilita.html` (nav link in `index.html` / `site-v2-i18n.js`) |
| i18n | namespace `compat` (19 keys, 12 locales) |

## Opt-in prompt (one-time)

`maybeOfferCompatOptIn()` fires after the first successful run when telemetry
is OFF and the prompt was never shown (`gs-compat-optin-prompted` flag). If the
user accepts, the setting is enabled + persisted to disk, the just-finished
run is reported retroactively and the boot confirmation is armed — the first
contribution isn't lost. Declining never re-prompts (the toggle stays in
Settings → Community).

## Server-side anti-abuse

A `BEFORE INSERT` trigger (`compat_reports_guard`) drops abusive rows
**silently** (so client queues never get stuck): duplicate
`(run_id, step, result)` triples; more than 60 rows/hour per client IP; more
than 10 distinct runs per game per 24h per IP (later steps of an existing run,
like the boot confirmation, always pass). The IP comes from PostgREST's
`x-forwarded-for` header and is stored only as an md5 hash in `ip_hash`, which
is never exposed (no SELECT policy; the view doesn't select it).

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

## Public web page

`docs/sito/compatibilita.html` — self-contained static page (same style and
`gs_site_lang` language mechanism as the rest of the site) that reads the
`compat_game_summary` view via PostgREST with the public anon key. Search by
game, filter by target language / engine, sort by tested/success/recent;
per-language chips on each card. Deployed automatically with the site
(deploy-site.yml) on push. All feature milestones are complete — future ideas
go through ROADMAP.md.
