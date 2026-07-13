# Corpus di fixture per engine

Mini-giochi/cataloghi **realistici e minuscoli**, uno per formato/engine, usati
come **regression suite**: ogni parser viene verificato ad ogni commit
(vitest → CI), mai più regressioni silenziose sui patcher.

## Struttura

| Cartella | Engine/Formato | Testata da |
|---|---|---|
| `formats/` | PO, XLIFF, RESX, .strings, JSON, INI, .properties, CSV | `__tests__/engines/file-formats.test.ts` → `lib/file-parsers.ts` |
| `subtitles/` | SRT, VTT, ASS | `__tests__/engines/subtitles.test.ts` → `lib/subtitle-parser.ts` |
| `unreal/` | `.locres` v0 (binario) | `__tests__/engines/unreal-locres.test.ts` → `lib/patchers/unreal-pak-parser.ts` |
| `fonts/` | TTF subset reali (DejaVuSans via fonttools): `latin-only`, `latin-cyr-el` | `__tests__/engines/font-coverage.test.ts` → `lib/font-coverage.ts` |
| `godot/test.pck` | Godot PCK v2 (Godot 4.3, directory in-line) | **Rust** `src-tauri/tests/engine_fixtures.rs` → `godot_patcher::scan_godot_pck` |
| `unreal/Game_v2.locres` | Unreal `.locres` v2 (string array condivisa) | **Rust** `engine_fixtures.rs` → `unreal_localization::parse_locres_file` |
| `danganronpa/test.stx` | Danganronpa STX (tabella UTF-16LE) | **Rust** `engine_fixtures.rs` → `danganronpa_patcher::parse_stx_file` |
| `cri/test.cpk` | CRI CPK (tabelle @UTF big-endian: header + TOC, file MSG non compresso) | **Rust** `engine_fixtures.rs` → `cri_patcher::list_cpk_contents` / `extract_text_files_from_cpk` / `parse_cri_text_file` |
| `bethesda/Skyrim_English.STRINGS` / `.DLSTRINGS` | String table Bethesda (zstring / size-prefixed) | **Rust** `engine_fixtures.rs` → `bethesda_patcher::extract_strings_file` |
| `bethesda/test.bsa` | BSA v104 (folder record + bzstring + name block) | **Rust** `engine_fixtures.rs` → `bethesda_patcher::list_bsa_contents` |
| `renpy/` | Ren'Py `.rpy` | integrità in `fixture-corpus.test.ts` (parsing lato Rust) |
| `rpgmaker-mv/` | RPG Maker MV (System/Actors/Map001.json) | idem |
| `tyrano/` | TyranoScript `.ks` | idem |
| `kirikiri/` | Kirikiri `.ks` | idem |

## Note

- `unreal/Game.locres` è stato generato **indipendentemente** dal parser TS
  (script Python che segue il formato Unreal legacy v0: magic `0x0E14DA7A`,
  FString ASCII con null terminator). Serve a *congelare* il formato: un
  cambiamento incompatibile a `parseLocres`/`buildLocres` fallisce qui anche
  se il round-trip interno continuasse a passare.
- Le fixture `renpy/`, `rpgmaker-mv/`, `tyrano/`, `kirikiri/` sono parsate
  lato **Rust** (`src-tauri`): il test vitest ne garantisce solo l'integrità.
- **Harness Rust** (`src-tauri/tests/engine_fixtures.rs`): consuma le stesse
  fixture da questo path (stabile per contratto) esercitando i parser Rust veri
  — Godot `.pck`, Unreal `.locres` v0/v2, Danganronpa STX, RPG Maker MV JSON.
  Le fixture binarie (`godot/test.pck`, `unreal/Game_v2.locres`,
  `danganronpa/test.stx`) sono state generate replicando il formato letto dal
  parser e validate contro la logica reale prima del commit.
  Gira in CI (runner con GTK); localmente: `cd src-tauri && cargo test --test engine_fixtures`.
  Copertura attuale: Godot `.pck`, Unreal `.locres` v0/v2, Danganronpa STX,
  RPG Maker MV, **CRI CPK** (@UTF header+TOC, file non compresso),
  **Bethesda** STRINGS/DLSTRINGS + BSA v104.
  TODO residui: file CRILAYLA-compresso dentro il CPK (serve un compressore
  o un blob reale), BA2 (Fallout 4/Starfield) ed ESP/ESM.

## Aggiungere un engine

1. Crea `__tests__/fixtures/engines/<engine>/` con il file minimo *realistico*
   (struttura vera del gioco, 2–4 stringhe con placeholder/accenti).
2. Se il parser è TS puro: aggiungi un test estrai→traduci→riscrivi→verifica
   in `__tests__/engines/`.
3. In ogni caso: aggiungi il file alla lista di `fixture-corpus.test.ts`.
