# CLAUDE.md

Project conventions for AI coding agents. Behavioral guidelines (Karpathy) live in the global `~/.claude/CLAUDE.md`.

## Project

GameStringer — Next.js + Tauri (Rust) desktop app. Prisma + Supabase for data, Vitest + Playwright for tests, i18n enforced via custom script.

## Build & test

- Dev: `npm run dev` (unified dev with profiles) · simple: `npm run dev:simple`
- Tauri dev: `npm run tauri:dev` · Tauri build: `npm run tauri:build`
- Build web: `npm run build`
- Tests: `npm test` (Vitest) · e2e: `npm run test:e2e` (Playwright) · sharded: `npm run test:safe`
- Typecheck: `npm run typecheck` · Lint: `npm run lint`
- i18n check (no hardcoded strings): `npm run i18n:check`
- Prisma generate runs on postinstall

## Versioning & release

- Managed via `npm run version:*` (version-manager.js) — don't bump versions by hand
- Release: `npm run ship` (dry run: `npm run ship:dry`)

## Notes

- Port management is scripted (`scripts/port-manager.js`, dev on 3002) — don't hardcode ports.
- Native module in `native/` built with node-gyp (`npm run build:native`).
