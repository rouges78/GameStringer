# API Reference — GameStringer

> **What this is.** The interface between GameStringer's frontend and its
> backend, and there is only one: **Tauri commands** called through `invoke()`.
> The `/api/*` HTTP routes are no longer working endpoints — why, below.

## Why this document used to describe REST endpoints

GameStringer started as a Next.js application with real API routes. That is
where `GET /api/games`, `POST /api/translate` and thirty others came from, and
that is what this document described.

Then the desktop package moved to `output: 'export'` (17/05/2026, see
`next.config.js`). A static export **produces no server routes**, so inside the
Tauri package those endpoints simply stopped existing. For a while the document
described two modes — "real in web/dev, absent on desktop" — and for a while
that was true.

It is not true any more. **All 33 routes under `app/api/` have been gutted to
stubs** and answer `501 { "error": "not_available_in_desktop" }` in every mode,
`npm run dev` included. The original code lives in git history; the files remain
only so the static build does not trip over their absence.

So there are not two interfaces. There is one.

## The real interface: `invoke()`

The frontend talks to the Rust backend through the wrapper in
[`lib/tauri-api.ts`](../lib/tauri-api.ts), **not** by importing
`@tauri-apps/api` directly:

```ts
import { invoke } from '@/lib/tauri-api';

const games  = await invoke<Game[]>('get_games_fast');
const status = await invoke<UnrealLocStatus>('get_unreal_localization_status', {
  gamePath: game.installPath,
});
```

Three things the wrapper does that are worth knowing:

- **Outside Tauri it throws immediately**, instead of failing obscurely later.
  `isTauri()` is exported from the same module for code that needs to branch.
- **Argument names convert themselves**: `gamePath` in JS arrives as `game_path`
  in Rust. Do not normalise them by hand.
- **Logs mask secrets** (`password`, `api_key`, `token`…) and summarise large
  results, so an array of 2000 games does not land in the console in full.

### Errors

A Rust command returning `Result<T, String>` becomes a promise: `Ok` resolves it,
`Err` rejects it with that string as the message. There are no HTTP status codes
and no rate limiting — this is an in-process call.

```ts
try {
  await invoke('set_pak_aes_key', { gamePath, key });
} catch (e) {
  // e is the string the Rust command put inside Err(...)
  toast.error(String(e));
}
```

## Which commands exist

**864 registered commands**, 405 of them actually called from the frontend. A
hand-written list here would be wrong within a week, so there isn't one: the
authoritative source is the code.

```bash
# The complete, always-true list
grep -A 900 "invoke_handler" src-tauri/src/main.rs

# Check that every frontend invoke() has a command behind it
npm run tauri:check-cmds
```

`tauri:check-cmds` also runs in CI as a blocking gate: invoke a command that does
not exist and the build says so.

### The main families

Each module under `src-tauri/src/commands/` exposes a coherent group. The
largest, by number of registered commands:

| Module | Commands | What it covers |
|---|---:|---|
| `notifications` | 86 | Notification system and event queues |
| `steam_enhanced` | 38 | Steam library, metadata, enrichment |
| `steam` | 29 | Steam install detection and paths |
| `danganronpa_patcher` | 27 | Dedicated patcher (WAD, STX) |
| `profiles` | 24 | User profiles, authentication, encryption |
| `utilities` | 16 | Settings, paths, supporting services |
| `glossary` | 16 | Glossaries and terminology memory |
| `epic` | 16 | Epic Games integration |
| `backup` | 16 | Backup and restore |

For per-engine coverage — which patchers exist, how many commands and tests each
has — see [`ENGINE-COVERAGE.md`](ENGINE-COVERAGE.md).

## What about the `/api/` routes?

They stay as stubs and should be left alone. The project rule is **zero
`fetch('/api/')` in new code**: every remaining call is to be migrated to
`invoke()`.

The endpoint-by-endpoint map, classifying what replaces what, is in
[`API_MIGRATION_MAP.md`](API_MIGRATION_MAP.md); the plan is in
[`fetch-api-migration-plan.md`](fetch-api-migration-plan.md).

This includes `app/api/v1/` — what the document called the "Public API v1",
meant for running the app as a server. Its four routes (`health`, `languages`,
`translate`, `batch`) are stubs too. If an external HTTP API is ever needed, it
is something to design, not to revive.

## Testing a command

You do not need cURL, you need the app. The quickest way is the developer
console of the Tauri window, where `invoke` is reachable because
`withGlobalTauri` is on:

```js
await window.__TAURI__.core.invoke('get_unreal_localization_status', {
  gamePath: 'C:/…/steamapps/common/GameName'
});
```

For commands with real logic, though, the Rust tests are worth more: `cargo test
--manifest-path src-tauri/Cargo.toml --lib` covers 1542 cases and needs no game
installed.
