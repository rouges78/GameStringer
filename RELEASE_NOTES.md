# 🎮 GameStringer v1.8.0

> **Release Date**: April 9, 2026
> **Type**: Live Translation Overlay + Hub Marketplace + Translation Memory Network + AI Dubbing Pipeline + Plugin System

---

## 👁️ Live Translation Overlay

Real-time game translation via a transparent on-screen overlay:

- **Hotkey `Ctrl+Alt+O`** to toggle the overlay on/off
- Pipeline: screen capture → multi-engine OCR (Tesseract / OneOCR / PaddleOCR) → AI translation (Groq / Cerebras for speed) → gaming-style overlay
- **Diff detection**: skips unchanged text between frames — no wasted API calls
- **Translation cache**: instant replay of previously seen text
- Designed for minimal performance impact during gameplay

## 🏪 Hub Marketplace

Community translation pack marketplace with 1-click install:

- Supabase backend with 10 tables (packs, reviews, comments, followers, moderation)
- **User profiles** with reputation system
- Status workflow: `draft` → `published` → `verified` → `featured`
- Browse, search, review, and install community translation packs

## 🌐 Translation Memory Network

Federated Translation Memory sharing across the community:

- High-quality translations (confidence > 0.8) auto-contributed to a global pool (**opt-in, privacy-first**)
- Source text **hashed** for privacy — no raw strings leave your machine
- Auto-integrated into the `translateWithFallback()` pipeline
- Game-scoped entries to avoid cross-contamination between titles

## 🎬 AI Dubbing Pipeline

Full 7-step dubbing pipeline — from raw audio to lip-synced dubbed output:

1. **Scan audio** files in the game
2. **Whisper STT** — speech-to-text transcription
3. **AI translation** of the transcript
4. **TTS synthesis** with character voices (OpenAI / ElevenLabs / Azure)
5. **Duration matching** — speed adjustment to fit original timing
6. **Audio patching** with automatic backup of originals
7. **Rhubarb lip sync** + subtitle generation (SRT / VTT / ASS)

- 16 character archetypes for distinct voice profiles
- Pause / resume / abort support for long-running pipelines

## 🧩 Plugin System

Community-created game engine patchers via a `PatcherPlugin` interface:

- Full lifecycle: `detect` → `extract` → `patch` → `verify` → `restore`
- **Template generator** for quick plugin scaffolding
- No Rust compilation needed — plugins run via **sandboxed JavaScript eval**
- Distributed as `.gsplugin` packages

## 🔒 Security Hardening

- **CSP rinforzata**: removed `unsafe-eval`, restricted `img-src` / `connect-src` to specific domains
- **XSS fix**: removed `dangerouslySetInnerHTML` in intelligent search
- **AES-256-GCM** encrypted API key storage (Rust backend + TypeScript client)
- **CSRF protection**: Origin validation + `X-GS-Client` header
- **Zod input validation** on 4 API routes
- **Rate limiting**: global middleware, per-route configurable
- All **42/42 API routes** use `withErrorHandler`

## 🏗️ Architecture & Code Quality

- CI pipeline: added `frontend-checks` job (tsc, eslint, vitest, npm audit)
- ESLint config: `no-console`, `no-explicit-any`, `no-unused-vars` rules
- **71 new unit tests** (api-schemas, middleware, translation modules)
- **18 modules** extracted from 3 monolithic files (-1841 lines total)
- 1197/1203 `console.*` calls migrated to structured `clientLogger` / `logger` (99.5%)
- 893 catch clauses typed with `: unknown`
- 25+ TypeScript `any` types eliminated
- Removed duplicate deps: react-hot-toast, vdf (-42 packages)

---

## 📥 Downloads

| File | Description |
|------|-------------|
| `GameStringer-1.8.0-Setup.exe` | Windows Installer (recommended) |
| `GameStringer-1.8.0-Portable.zip` | Portable version (no install) |
| `checksums-sha256.txt` | SHA256 checksums for verification |

### System Requirements

- Windows 10/11 (64-bit)
- 4GB RAM (8GB+ recommended for local AI)
- 500MB disk space

---

## 🔧 Installation

### Setup (Recommended)

1. Download `GameStringer-1.8.0-Setup.exe`
2. Run the installer
3. Follow the installation wizard
4. Launch GameStringer from Start Menu

### Portable

1. Download `GameStringer-1.8.0-Portable.zip`
2. Extract to any folder
3. Run `GameStringer.exe`

---

## 📖 Documentation

User guides available in 11 languages:

| Language | Guide |
|----------|-------|
| Italian | [GUIDA_UTENTE.md](docs/GUIDA_UTENTE.md) |
| English | [USER_GUIDE_EN.md](docs/USER_GUIDE_EN.md) |
| Spanish | [USER_GUIDE_ES.md](docs/USER_GUIDE_ES.md) |
| French | [USER_GUIDE_FR.md](docs/USER_GUIDE_FR.md) |
| German | [USER_GUIDE_DE.md](docs/USER_GUIDE_DE.md) |
| Japanese | [USER_GUIDE_JA.md](docs/USER_GUIDE_JA.md) |
| Chinese | [USER_GUIDE_ZH.md](docs/USER_GUIDE_ZH.md) |
| Korean | [USER_GUIDE_KO.md](docs/USER_GUIDE_KO.md) |
| Portuguese | [USER_GUIDE_PT.md](docs/USER_GUIDE_PT.md) |
| Russian | [USER_GUIDE_RU.md](docs/USER_GUIDE_RU.md) |
| Polish | [USER_GUIDE_PL.md](docs/USER_GUIDE_PL.md) |

---

---

# 🎮 GameStringer v1.7.0

> **Release Date**: April 8, 2026
> **Type**: AI Intelligence + Professional Localization + Voice Dubbing + Lip Sync

---

## 🧠 Auto-Select Engine

The new **Auto** chain preset intelligently picks the best AI translation provider based on your target language and game genre:

- **European languages** (IT, DE, FR, ES, PT, NL, PL, RU) → DeepL first, then Claude
- **CJK languages** (ZH, JA, KO) → Claude/Anthropic first (scores 4.82-4.92 in benchmarks)
- **RPG/Adventure** games → Creative LLMs (Anthropic, OpenAI) get priority
- **Action/Strategy** games → DeepL for technical accuracy
- **Quality tracking**: learns from provider success/failure rates per language and reorders automatically

## 📊 Gridly CSV Export/Import

Professional localization workflow compatibility:

- Multi-language column format: `string_id | source_en | target_it | target_de | ...`
- Compatible with **Gridly**, **Lokalise**, and **Crowdin**
- Auto-detect delimiter (comma, semicolon, tab) and language columns
- UTF-8 BOM for Excel compatibility
- Bidirectional conversion between single-target and multi-language formats

## 🎙️ Duration Matching (Voice Dubbing)

Keep dubbed audio in sync with the original:

- **Two-pass synthesis**: generate → measure → adjust speed → regenerate
- Automatic speed adjustment (0.5x - 2.0x) to match original audio duration
- Web Audio API for precise duration measurement
- UI toggle in Voice Translator with original vs. synthesized duration comparison
- Batch support with per-dialogue target duration

## 👄 Lip Sync (Rhubarb Integration)

Generate mouth animation data from audio for game dubbing:

- **Rhubarb Lip Sync** integration (open source, must be in PATH)
- 9 viseme shapes (A-X): closed, open, rounded, puckered, teeth, tongue, idle
- **Interactive timeline** with color-coded viseme bars and real-time playback sync
- **Unity export**: blend shape keyframes compatible with Oculus LipSync
- **Unreal export**: FaceFX phoneme data for MetaHuman
- Raw export: JSON, XML, TSV
- Statistics: cue count, average duration, speech/silence ratio
- Phonetic (fast) and data-based (accurate) recognizers

## 🎬 Video Extractor Improvements

- Direct "Video" button on game detail page (desktop + mobile)
- "Choose from Library" game picker dropdown
- Auto-scan when arriving from game detail
- "Game Card" back-link to return to game detail

---

# 🎮 GameStringer v1.6.0

> **Release Date**: April 4, 2026
> **Type**: Game Engine Patchers + Accessibility + Design System

---

## 🏰 Bethesda Engine Patcher (v1.6.0)

Native support for the classic Bethesda titles, end to end:

- **Supported games**: Skyrim LE/SE/AE, Fallout 3, Fallout: New Vegas, Fallout 4, Oblivion, Starfield
- **BSA archives**: parser for versions 103, 104, 105
- **BA2 archives**: both `GNRL` and `DX10` variants
- **STRINGS / DLSTRINGS / ILSTRINGS**: full extraction with stable ID mapping
- **ESP / ESM plugins**: parser with extraction of translatable fields (`FULL`, `DESC`, `NAM1`)
- **Export**: PO (gettext), CSV, and patched STRINGS files

## 🎵 CRI Middleware Patcher (v1.6.0)

Native support for games built on CRI Middleware — used by Atlus, Sega, Bandai Namco and many Japanese studios:

- **Supported games**: Persona 5 Royal, Yakuza series, Tales of series, Dragon Ball titles, and other CRI-based games
- **CPK archives**: parser with big-endian `@UTF` tables
- **CRILAYLA decompression**: bit-level LZ implementation
- **Text formats**: MSG / BMD / FTD (Persona), plus generic JSON/XML
- **Encoding detection**: automatic Shift-JIS / UTF-8 / UTF-16 detection

## 🎯 Unity Localization Package Pipeline (v1.6.0)

First-class support for the modern Unity Localization Package (StringTable + Addressables):

- **parse_addressables_catalog**: read the Addressables `catalog.json`
- **detect_string_tables_in_folder** / **extract_string_table**: find and extract StringTable + SharedTableData from UnityFS bundles
- **parse_smart_string**: tokenizer for Smart Strings (`{variable}`, `{0:format}`)
- **validate_smart_string_translation**: ensure token preservation in translations
- **build_patched_bundle**: rebuild bundles with translated text
- Multi-step wizard UI with live Smart Strings validation and translation preview

## 📤 Universal PO Export

Every patcher now exports to the industry-standard **gettext PO format** with full metadata (project name, language, source language, game engine, generator). Works on Bethesda, CRI, Unity, Unreal, Godot, RPG Maker, Ren'Py, Wolf RPG, Danganronpa, Telltale.

## ♿ Accessibility Pass

A thorough a11y sweep across the entire app:

- **aria-label** on icon-only buttons and interactive controls throughout the app
- **Semantic headings**: `CardTitle` renders `h2`/`h3` where the card is a true region heading
- **focus-visible**: keyboard focus affordances on Dialog, Sheet, Button and many components
- **Skip to content**: keyboard users can jump past the sidebar
- **Landmark**: `<main>` with `role="main"` and stable `id`
- **Italian sr-only**: accessible labels localized
- **prefers-reduced-motion**: OS setting respected — animations reduced to 0.01ms
- **forced-colors**: Windows High Contrast mode support

## 🎨 Design System

- **Card variants** via `cva`: `default`, `muted`, `highlight`, `success`, `error`, `warning`
- **Button sizes**: new `xs` and `icon-sm` for denser UIs
- **Text utilities**: `text-micro` (9px) and `text-2xs` (10px) replace inline arbitrary classes across 87 files
- **Wizard Stepper** shared component for multi-step patcher flows

## 👁️ OCR Image Processor

OCR now uses the real Tauri **Tesseract** backend (replaces the earlier in-memory stub).

## 🪟 Windows Tray Fix

Fixed a regression that caused console windows to flash in a loop when the app was minimised to tray — `system_monitor.rs` polled `nvidia-smi` / `wmic` / `powershell` every 5–10s without `CREATE_NO_WINDOW`. New shared helper `process_util::no_window_command()` routes **all** Windows child process spawns through a safe path.

---

## 📥 Downloads

| File | Description |
|------|-------------|
| `GameStringer-1.6.0-Setup.exe` | Windows Installer (recommended) |
| `GameStringer-1.6.0-Portable.zip` | Portable version (no install) |
| `checksums-sha256.txt` | SHA256 checksums for verification |

### System Requirements

- Windows 10/11 (64-bit)
- 4GB RAM (8GB+ recommended for local AI)
- 500MB disk space

---

## 🔧 Installation

### Setup (Recommended)

1. Download `GameStringer-1.6.0-Setup.exe`
2. Run the installer
3. Follow the installation wizard
4. Launch GameStringer from Start Menu

### Portable

1. Download `GameStringer-1.6.0-Portable.zip`
2. Extract to any folder
3. Run `GameStringer.exe`

---

## 📖 Documentation

User guides available in 11 languages:

| Language | Guide |
|----------|-------|
| 🇮🇹 Italian | [GUIDA_UTENTE.md](docs/GUIDA_UTENTE.md) |
| 🇬🇧 English | [USER_GUIDE_EN.md](docs/USER_GUIDE_EN.md) |
| 🇪🇸 Spanish | [USER_GUIDE_ES.md](docs/USER_GUIDE_ES.md) |
| 🇫🇷 French | [USER_GUIDE_FR.md](docs/USER_GUIDE_FR.md) |
| 🇩🇪 German | [USER_GUIDE_DE.md](docs/USER_GUIDE_DE.md) |
| 🇯🇵 Japanese | [USER_GUIDE_JA.md](docs/USER_GUIDE_JA.md) |
| 🇨🇳 Chinese | [USER_GUIDE_ZH.md](docs/USER_GUIDE_ZH.md) |
| 🇰🇷 Korean | [USER_GUIDE_KO.md](docs/USER_GUIDE_KO.md) |
| 🇧🇷 Portuguese | [USER_GUIDE_PT.md](docs/USER_GUIDE_PT.md) |
| 🇷🇺 Russian | [USER_GUIDE_RU.md](docs/USER_GUIDE_RU.md) |
| 🇵🇱 Polish | [USER_GUIDE_PL.md](docs/USER_GUIDE_PL.md) |

---

## 💖 Support

If GameStringer helped you enjoy games in your language:

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20Me-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/gamestringer)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-Sponsor-EA4AAA?logo=github-sponsors&logoColor=white)](https://github.com/sponsors/rouges78)

---

**Full Changelog**: <https://github.com/rouges78/GameStringer/compare/v1.5.0...v1.6.0>
