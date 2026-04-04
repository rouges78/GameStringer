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
