# Stato del Progetto GameStringer

> **Versione corrente: v1.14.0** · Ultimo rilascio: 14/07/2026
>
> Questa intestazione è aggiornata **automaticamente** da `npm run ship`
> (`scripts/release-all.js` → `bumpProjectStatus`). Non modificarla a mano.

## Cos'è

Suite desktop (Tauri 2 + Next.js 15 + Rust) per la localizzazione di
videogiochi con AI: libreria auto-rilevata da 10 store, analisi predittiva
(P.T.), estrazione/patch per 20+ engine, traduzione con 20+ provider AI,
Translation Memory con retrieval semantico (RAG locale), reflection
self-correcting, QA score per stringa, overlay OCR live, Patch Hub community.
UI in 12 lingue.

## Dove guardare

| Documento | Contenuto |
|---|---|
| [CHANGELOG.md](../CHANGELOG.md) | Storia completa delle versioni (fonte di verità) |
| [ROADMAP.md](../ROADMAP.md) | Cose da fare, prioritizzate P0/P1/P2 |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Architettura, directory map, pattern, gotcha |
| [GUIDA_UTENTE.md](GUIDA_UTENTE.md) | Guida utente (12 lingue in `docs/`) |
| [VERSIONING.md](VERSIONING.md) | Politica di versioning e processo di release |

## Capacità principali (stato attuale)

- **Pipeline**: scan → P.T. → detect engine → extract → translate (AI + TM +
  glossario + contesto semantico) → reflection → QA 0–100 → patch (con backup) → play.
- **Engine**: Unity (BepInEx/XUnity + Localization Package), Unreal (.locres,
  `_P.pak`), Godot, RPG Maker, Ren'Py, Bethesda (BSA/BA2/ESP), CRI (CPK/MSG/BMD),
  Telltale, Kirikiri, TyranoScript, Wolf RPG, Visionaire, Danganronpa, Electron, altri.
- **Qualità AI**: reflection selettiva, TM semantica (embeddings Ollama,
  IndexedDB), lore assistant RAG, vision-context (VLM), Multi-LLM compare,
  Auto-Select provider per lingua/genere.
- **Community**: Patch Hub (.gspack), TM Network federata, chat realtime,
  feed news di settore in home.

## Debito noto / caveat

- **CSP con `unsafe-eval`** (audit H12): i 2 test in `__tests__/middleware.test.ts`
  codificano lo stato desiderato e restano `skip` finché la CSP non sarà
  ristretta senza rompere la WebView Tauri.
- **UI Translation Memory**: 2 suite in `__tests__/translation-memory/` sono
  `describe.skip` perché il componente React non esiste ancora (c'è solo il
  singleton `lib/translation-memory.ts`).
- **Tool UE runtime**: marcato SPERIMENTALE (vedi issue #52); DLL non bundlata.
- **GameMaker**: supporto parziale (via UndertaleModTool).

## Salute del codice

- Test unit/integration: **verdi** (vitest, ~40 file / 600 test; gli skip sono
  i debiti documentati qui sopra, non fallimenti).
- Gate CI: `tsc --noEmit`, ESLint, vitest, npm audit, parità i18n
  (`__tests__/lib/i18n-locale-integrity.test.ts`).
- Release: `npm run ship` orchestra bump, changelog (12 lingue), README/guide,
  sito, tag e build multi-OS via `release.yml`.
