<p align="center">
  <img src="public/logo.png" alt="GameStringer Logo" width="180" />
</p>

<h1 align="center">GameStringer</h1>

<p align="center">
  <strong>Desktop app that translates video games into any language using AI.</strong><br>
  Pick a game from your library, choose a language, click translate — done.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.6.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/license-Source--Available-green" alt="License" />
  <img src="https://img.shields.io/badge/Tauri_2-24C8DB?logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/Next.js_15-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Rust-orange?logo=rust&logoColor=white" alt="Rust" />
</p>

<p align="center">
  <a href="#-what-is-gamestringer">What is it</a> ·
  <a href="#-download">Download</a> ·
  <a href="#-how-it-works">How it works</a> ·
  <a href="#-the-prediction-tool-pt">P.T.</a> ·
  <a href="#-supported-game-engines">Engines</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-build-from-source">Build</a>
</p>

<p align="center">
  <strong>🌍 Read in your language:</strong><br>
  <a href="README_IT.md">🇮🇹 Italiano</a> ·
  <a href="README_ES.md">🇪🇸 Español</a> ·
  <a href="README_FR.md">🇫🇷 Français</a> ·
  <a href="README_DE.md">🇩🇪 Deutsch</a> ·
  <a href="README_PT.md">🇧🇷 Português</a> ·
  <a href="README_JA.md">🇯🇵 日本語</a> ·
  <a href="README_ZH.md">🇨🇳 中文</a> ·
  <a href="README_KO.md">🇰🇷 한국어</a> ·
  <a href="README_RU.md">🇷🇺 Русский</a> ·
  <a href="README_PL.md">🇵🇱 Polski</a>
</p>

---

## Demo

<p align="center">
  <img src="docs/demo/demo-library.gif" alt="GameStringer Library Demo" width="720" />
</p>

<p align="center">
  <em>🎮 Game Library — auto-detect Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io</em>
</p>

<p align="center">
  <img src="docs/demo/demo-translator.gif" alt="GameStringer AI Translator Demo" width="720" />
</p>

<p align="center">
  <em>🤖 AI Translator — 20+ providers, Quality Badges 0-100, Translation Memory</em>
</p>

<p align="center">
  <img src="docs/demo/demo-patcher.gif" alt="GameStringer Game Patcher Demo" width="720" />
</p>

<p align="center">
  <em>🔧 One-Click Patcher — BepInEx, XUnity, UnrealLocres, Bethesda BSA/BA2, CRI CPK, auto-backup</em>
</p>

<p align="center">
  <img src="docs/demo/demo-chat.gif" alt="GameStringer Community Chat Demo" width="720" />
</p>

<p align="center">
  <em>💬 Community Chat — Supabase Realtime, custom rooms, online presence</em>
</p>

<p align="center">
  <img src="docs/demo/demo-tray.gif" alt="GameStringer Tray Icon Demo" width="480" />
</p>

<p align="center">
  <em>🖥️ System Tray — quick actions, live Ollama status, tools submenu</em>
</p>

---

## 🎮 What is GameStringer?

GameStringer is a **desktop application** (Windows & Linux) that lets you translate video games that don't have your language.

Most games store their text in files — JSON, XML, CSV, `.locres`, `.rpy`, BSA/BA2, CPK, Unity Localization StringTables, and many other formats. GameStringer **scans your game folder**, finds those files, sends the text through an **AI translation provider** of your choice (OpenAI, Claude, Gemini, DeepSeek, Ollama, 20+ more), and **patches the translated text back** into the game. One click, no technical knowledge needed.

For **Unity games** that lock text inside compiled assets, GameStringer **automatically installs BepInEx + XUnity.AutoTranslator** — no manual setup. For **Bethesda games** (Skyrim, Fallout, Starfield) it parses BSA/BA2/ESP natively. For **CRI Middleware games** (Persona, Yakuza) it handles CPK/CRILAYLA/MSG/BMD. For **Unreal Engine** it edits `.locres` directly.

**It's not a machine translation website.** It's a full pipeline: **analyze with P.T. → detect engine → extract text → translate with AI → quality check → patch back → play.**

---

## 📥 Download

Get the latest release from **[GitHub Releases](https://github.com/rouges78/GameStringer/releases)**:

| Platform | File | Notes |
|----------|------|-------|
| **Windows** | `GameStringer-Setup.exe` | Installer (recommended) |
| **Windows** | `GameStringer-Portable.zip` | No install needed |
| **Linux** | `GameStringer.AppImage` | Universal (recommended) |
| **Linux** | `GameStringer.deb` | Debian / Ubuntu |

**Requirements:** Windows 10+ or Linux (Ubuntu 22.04+, Fedora 38+), 4 GB RAM (8 GB+ for local AI), 500 MB disk. Releases are **code-signed** and **auto-updated** via Tauri Updater.

---

## 🚀 How it works

1. **Install** GameStringer and launch it
2. **Your game library loads automatically** — Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io (800+ games detected in seconds)
3. **Pick a game** → optionally run **P.T. (Prediction Tool)** to see difficulty, estimated time, best LLM chain
4. Click **"String it!"** — GameStringer scans, extracts, translates, and patches automatically
5. **Play in your language** — backups are always created before patching

That's it. No command line, no manual file editing, no modding experience needed.

---

## 🧠 The Prediction Tool (P.T.)

> **The most powerful feature in GameStringer.** Don't start a translation blind — analyze first.

P.T. is a deep analysis engine that runs *before* any translation. It scans your game folder, detects the engine, estimates the volume of translatable text, and tells you:

- **Difficulty Score 0–100** — combined weight of string volume, engine complexity, DRM, encoding, linguistic challenges
- **Estimated time** across **18 LLM models** — Ollama (Gemma 4, Qwen 3, Llama), OpenAI GPT-4/4o, Claude 3.5, Gemini, DeepL, DeepSeek, Groq
- **5 recommended LLM chains**: Local (privacy), Cloud (quality), Hybrid (balanced), Budget, Premium — each with cost and quality score
- **DRM detection**: Denuvo, VMProtect, Steam DRM, EAC, BattlEye — warns before you try
- **Encoding analysis**: Shift-JIS, UTF-8, UTF-16, Big5, EUC-KR detected per-file
- **Translation complexity**: honorifics, gender agreement, RTL, ruby/furigana, CJK-specific handling
- **Confidence score** and **workflow plan** — the exact steps that will run when you click "String it!"
- **Export report** (JSON + Markdown) for sharing or archiving

### P.T.Rank — Quick Ranking

After running P.T. on multiple games, open **P.T.Rank** to see all analyzed titles sorted by difficulty. Perfect for planning your translation queue: start from the easy wins, save the 800k-string RPGs for last.

### Dry Run Scanner

Don't want to analyze one game at a time? Run **Dry Run** from the Library page to scan your **entire Steam library (800+ games) in batch**, with **zero file modification**. You get a JSON report categorizing every game as **Ready** (engine supported + strings extractable), **Errors** (manifest issues / DRM blocker), or **Unsupported** (unknown engine / no text). Progress is real-time, and no backup is needed because nothing gets touched.

### String it! Smart Gate

The **"String it!"** button on the game detail page is smart: if the game has already been analyzed by P.T. within the last 24h, it launches the translation wizard directly. Otherwise it suggests running P.T. first (with a one-click "Run P.T. first" / "String it! anyway" choice). No more wasted runs on games that turn out to be DRM-locked or 5-minute affairs.

---

## 🎯 Supported Game Engines

GameStringer supports **20+ engines** with varying levels of depth:

| Engine | Support | How it works |
|--------|---------|--------------|
| **Unity** | ✅ Full | Auto-installs BepInEx + XUnity.AutoTranslator + Unity Localization Package pipeline (StringTable, SharedTableData, Addressables, Smart Strings) |
| **Unreal Engine** | ✅ Full | `.locres` extraction and patching with UnrealLocres |
| **Unreal _P.pak** | ✅ Full | Mod packaging as `<GameStringer>_P.pak` loaded via Paks folder |
| **Godot** | ✅ Full | Native `.translation` file support |
| **RPG Maker** | ✅ Full | MV/MZ JSON, VX/Ace via Trans, XP via RMXP |
| **Ren'Py** | ✅ Full | Native `.rpy` script parsing with dialogue detection |
| **GameMaker** | ⚡ Partial | Via UndertaleModTool integration |
| **Telltale** | ✅ Full | `.langdb` / `.dlog` support |
| **Wolf RPG** | ✅ Full | WolfTrans integration |
| **Kirikiri** | ✅ Full | `.ks` / `.scn` parsing |
| **TyranoScript** | ✅ Full | Fast-path extractor with JSON patching |
| **Electron** | ✅ Full | ASAR unpacking + i18n JSON detection |
| **Bethesda (Skyrim/Fallout/Oblivion/Starfield)** | ✅ **NEW v1.6.0** | BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1) parser, STRINGS/DLSTRINGS/ILSTRINGS |
| **CRI Middleware (Persona/Yakuza/Tales of/Dragon Ball)** | ✅ **NEW v1.6.0** | CPK + CRILAYLA + MSG/BMD/FTD with Shift-JIS/UTF-8/UTF-16 auto-detection |
| **Visionaire Studio** | ✅ Full | Daedalic adventures (Deponia, Edna, etc.) |
| **Danganronpa WAD** | ✅ Full | WAD archive parser + STX dialogue patching |

> **Unity games** get special treatment: if no translatable files are found, GameStringer detects it's a Unity game and offers to **automatically install BepInEx + XUnity.AutoTranslator** with one click. Just launch the game once after install, then re-scan — all text becomes translatable.
>
> ⚠️ **Anti-Cheat Warning**: BepInEx (DLL injection) can trigger anti-cheat systems (EAC, BattlEye, Vanguard). GameStringer includes anti-cheat detection and will warn you. **Only use on single-player / offline games.** P.T. detects DRM before any modification.

---

## ✨ Features

### 🤖 AI Translation

- **20+ providers**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, DeepL, Ollama (local), LM Studio, TranslateGemma, HY-MT, Qwen 3, NLLB-200, Cerebras, Together AI, Fireworks, OpenRouter, Cohere, Lingva, MyMemory
- **Context-aware**: understands game genre, character voice, tone, narrative vs UI vs dialogue
- **Translation Memory & Glossary**: consistency across the project with auto-glossary extraction
- **Multi-LLM Compare**: run multiple providers in parallel, pick the best result per string
- **Quality gates**: automatic QA scoring on every translated string (0-100) with ContentTypeBadge
- **Vision LLM Translator**: uses in-game screenshots for context (Ollama, Gemini, GPT-4o)
- **Live Quality Preview**: see quality scores in real-time during batch translation
- **RTL support**: automatic direction detection and `dir` attribute handling

### 🧠 P.T. — Prediction Tool (v1.6.0)

- **Difficulty Score 0-100** with weighted factors (volume, engine, DRM, encoding, complexity)
- **Time estimates for 18 LLM models** including Gemma 4 (27B MoE A4B / E4B / E2B)
- **5 LLM chains** (Local / Cloud / Hybrid / Budget / Premium) with cost and quality estimates
- **DRM / Anti-Cheat detection** (Denuvo, VMProtect, Steam DRM, EAC, BattlEye, Vanguard)
- **Encoding analysis** per-file (Shift-JIS, UTF-8/16, Big5, EUC-KR)
- **Translation complexity analysis** (honorifics, gender, CJK, ruby, RTL)
- **P.T.Rank / Quick Ranking** — sort all analyzed games by difficulty
- **Dry Run Scanner** — batch scan of entire Steam library (800+ games) without modification
- **Workflow Orchestrator** — real execution engine with universal fast path for 6+ engines and real-time progress
- **Prediction cache** (24h) — instant re-open of previously analyzed games
- **Export report** (JSON + Markdown) for sharing and archiving

### 📚 Game Library

- **Auto-detect**: Steam (with Family Sharing), Epic, GOG Galaxy, Origin/EA, Ubisoft Connect, Amazon Games, itch.io
- **800+ games** recognized from installed libraries in seconds
- **Game cards** with cover art, metadata, engine badge, VR badge, install status
- **Hover quick actions**: String it!, Batch, Community, P.T. — all one click
- **Game Update Tracker**: detects when Steam updates a translated game (via `buildid`), verifies patch integrity (BepInEx files, `_P.pak` presence), warns if re-patching is needed
- **"Stop monitoring"** button to untrack a specific game

### 🔧 Translation Tools

- **One-Click Translate** ("String it!"): scan → translate → patch in a single flow
- **Batch Translation**: translate entire games or folders at once
- **Subtitle Translator**: SRT, VTT, ASS/SSA with timing preservation
- **OCR Translator**: extract text from retro games (8-bit, 16-bit, DOS presets) with real Tauri Tesseract backend
- **Voice Pipeline**: speech-to-text → translate → text-to-speech
- **Real-time Overlay**: see translations while playing via VR/screen overlay
- **Auto-Translate Review**: "Translate all untranslated" button with progress bar
- **Lore Assistant**: RAG chat that knows the game's lore and dialogues
- **Character Voice Profiles**: define personality, tone, speech patterns per character
- **Translation Confidence Heatmap**: visual quality overview of all translations

### 🎮 Game Engine Patchers

- **Unity**: BepInEx + XUnity.AutoTranslator auto-installer, Unity Localization Package (StringTable, SharedTableData, Addressables catalog, Smart Strings validator)
- **Unreal Engine**: `.locres` extraction + `_P.pak` mod packaging
- **Bethesda Engine Patcher** (NEW v1.6.0): Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield — BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1)
- **CRI Middleware Patcher** (NEW v1.6.0): Persona 5 Royal, Yakuza, Tales of, Dragon Ball — CPK + CRILAYLA + MSG/BMD/FTD
- **Ren'Py**, **RPG Maker**, **Godot**, **GameMaker**, **Kirikiri**, **Wolf RPG**, **Telltale**, **Visionaire**, **Danganronpa WAD** — all with native parsers
- **Wizard Stepper**: shared multi-step UI for all patchers
- **Universal PO Export** (gettext `.po`) for every patcher with project/language/source/engine metadata
- **Auto-backup**: before every patch, with one-click restore

### 🔌 Advanced

- **Auto-Hook Scanner**: process memory scanning (Windows WinAPI) for hardcoded strings
- **System Monitor**: real-time VRAM/RAM usage for local LLM planning
- **Ollama Setup Wizard**: step-by-step local AI installation
- **Ollama Manager**: auto-discovery of models from the ollama.com registry + auto-refresh on focus/navigation
- **Debug Console**: integrated console with log intercept
- **Plugin System**: design doc for third-party plugins (see `PLUGIN_SYSTEM.md`)
- **Community Hub**: share and download translation memories + GitHub Discussions integration
- **Public API v1**: REST endpoints for integration (`/api/v1/translate`, `/api/v1/batch`)

### 💬 Community Chat

- **Real-time chat** with other translators via Supabase Realtime
- **4 default rooms**: General, Translations, Feedback & Bugs, Announcements
- **Custom rooms**: create rooms for specific games or projects
- **Auto-Bridge Auth**: your GameStringer profile auto-syncs to Supabase — zero extra login
- **Online presence**: see who's online in each room
- **Reply / edit / delete** messages with RLS-enforced ownership
- **Expandable drawer widget** in the bottom-right corner

### ♿ Accessibility (v1.6.0)

- **WCAG 2.1 AA sweep** — `aria-label` on icon buttons, semantic `CardTitle` headings, `focus-visible` on all primitives, skip-to-content link, `main` landmark, Italian `sr-only` helpers
- **`prefers-reduced-motion`** respected throughout animations
- **`forced-colors`** (Windows High Contrast Mode) respected
- **11-language UI**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL
- **RTL layout** support with automatic direction detection

### 🎨 Design System (v1.6.0)

- **Card variants** via `cva`: default, muted, highlight, success, error, warning
- **Button sizes** including `xs` and `icon-sm`
- **Text utilities**: `text-micro` (9px), `text-2xs` (10px) — no more arbitrary Tailwind
- **Radix UI unified**: migrated 37 files from `@radix-ui/react-*` to `radix-ui`, 27 packages removed
- **Optimized bundle**: `optimizePackageImports` for radix-ui, framer-motion, recharts, cmdk

### 🖥️ App

- **Signed auto-updates**: one-click update from the app via Tauri Updater
- **Profiles**: multiple user profiles with recovery keys
- **Global Hotkeys**: `Ctrl+Shift+T` OCR, `Ctrl+Shift+Q` Quick Translate, `Ctrl+Alt+O` Overlay, `Alt+T` XUnity toggle
- **System Tray**: quick actions, live Ollama status, tools submenu
- **Cross-platform**: Windows & Linux with native builds
- **Windows tray fix**: prevents console flash loop on child process spawn

---

## 🔧 AI Providers

| Provider | API Key | Free Tier | Best for |
|----------|---------|-----------|----------|
| **Ollama** | No (local) | ✅ Unlimited | Privacy, offline |
| **LM Studio** | No (local) | ✅ Unlimited | Privacy, GGUF models |
| **TranslateGemma** | No (Ollama) | ✅ Unlimited — 55 languages, Google | **Recommended start** |
| **HY-MT1.5** | No (Ollama) | ✅ Unlimited — ~1GB RAM, Tencent | Low-RAM machines |
| **Qwen 3** | No (Ollama) | ✅ Unlimited — multilingual | CJK languages |
| **Gemma 4** | No (Ollama) | ✅ Unlimited — 27B MoE A4B/E4B/E2B | Quality local |
| **Gemini** | Yes | ✅ Free tier (15 RPM) | **Recommended cloud** |
| **DeepSeek** | Yes | ✅ $0.14/1M input | Budget cloud |
| **Groq** | Yes | ✅ 14,400 req/day | Speed |
| **Mistral** | Yes | ✅ Free tier | EU cloud |
| **OpenAI** | Yes | Paid | GPT-4o quality |
| **Claude** | Yes | Paid | Nuance, long context |
| **DeepL** | Yes | ✅ 500k chars/month | European languages |
| **MyMemory** | No | ✅ Unlimited | Fallback |
| **Lingva** | No | ✅ Unlimited | Google MT mirror |
| **Cerebras** | Yes | ✅ Free tier | Speed |
| **Together AI** | Yes | ✅ $25 free credit | Open models |
| **Fireworks** | Yes | ✅ Free tier | Open models |
| **OpenRouter** | Yes | ✅ Free models | Model variety |
| **NLLB-200** | Yes | ✅ 200 languages | Rare languages |
| **Cohere** | Yes | ✅ Free trial | RAG |

**Recommended to start**: **TranslateGemma** via Ollama (free, local, 55 languages) or **Gemini** (free tier, cloud). Low RAM: **HY-MT1.5** (~1GB). Best quality: **Claude 3.5** or **GPT-4o**. Best CJK: **Qwen 3**.

---

## 📖 Documentation

### User Guides (11 languages)

| | | |
|---|---|---|
| 🇮🇹 [Italiano](docs/GUIDA_UTENTE.md) | 🇬🇧 [English](docs/USER_GUIDE_EN.md) | 🇪🇸 [Español](docs/USER_GUIDE_ES.md) |
| 🇫🇷 [Français](docs/USER_GUIDE_FR.md) | 🇩🇪 [Deutsch](docs/USER_GUIDE_DE.md) | 🇯🇵 [日本語](docs/USER_GUIDE_JA.md) |
| 🇨🇳 [中文](docs/USER_GUIDE_ZH.md) | 🇰🇷 [한국어](docs/USER_GUIDE_KO.md) | 🇧🇷 [Português](docs/USER_GUIDE_PT.md) |
| 🇷🇺 [Русский](docs/USER_GUIDE_RU.md) | 🇵🇱 [Polski](docs/USER_GUIDE_PL.md) | |

### Project Docs

- **[CHANGELOG.md](CHANGELOG.md)** — full version history
- **[docs/VERSIONING.md](docs/VERSIONING.md)** — versioning policy
- **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** — current roadmap
- **[PLUGIN_SYSTEM.md](PLUGIN_SYSTEM.md)** — plugin architecture design
- **[LICENSE](LICENSE)** — Source-Available License v1.1

---

## 🛠️ Build from Source

**Prerequisites**: Node.js 18+, Rust 1.70+, npm. On Linux also: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.

```bash
git clone https://github.com/rouges78/GameStringer.git
cd GameStringer
npm install
npm run dev          # development
npm run tauri:build  # production build
```

Rust backend: `cd src-tauri && cargo check` to verify the Tauri commands compile on your platform.

---

## 💖 Support

If GameStringer helped you play games in your language:

<p align="center">
  <a href="https://buymeacoffee.com/gamestringer">
    <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" />
  </a>
  <a href="https://ko-fi.com/gamestringer">
    <img src="https://img.shields.io/badge/Ko--fi-FF5E5B?logo=ko-fi&logoColor=white" alt="Ko-fi" />
  </a>
  <a href="https://github.com/sponsors/rouges78">
    <img src="https://img.shields.io/badge/GitHub%20Sponsors-EA4AAA?logo=github-sponsors&logoColor=white" alt="GitHub Sponsors" />
  </a>
</p>

---

## 📜 License

**Source-Available License v1.1** — the source code is public and you can build it yourself, but it is not OSI-approved "Open Source".

- ✅ Free for personal use
- ✅ Free to inspect, build, and modify for yourself
- ❌ Commercial use requires written permission
- ❌ Redistribution of modified versions requires written permission

See [LICENSE](LICENSE) for details. Questions? Open a [Discussion](https://github.com/rouges78/GameStringer/discussions).

---

## 🙏 Credits

- **[BepInEx](https://github.com/BepInEx/BepInEx)** — Unity modding framework (BepInEx Team)
- **[XUnity.AutoTranslator](https://github.com/bbepis/XUnity.AutoTranslator)** — Unity translation framework (bbepis)
- **[UnrealLocres](https://github.com/akintos/UnrealLocres)** — Unreal `.locres` parser (akintos)
- **[UndertaleModTool](https://github.com/krzys-h/UndertaleModTool)** — GameMaker modding (krzys-h)
- **[Tauri](https://tauri.app)** — Desktop app framework
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** — OCR engine
- **[Ollama](https://ollama.com)** — Local LLM runtime
- **[Supabase](https://supabase.com)** — Realtime backend for Community Chat

---

<p align="center">
  Made with ❤️ for gamers who want to play in their own language<br>
  <strong>GameStringer v1.6.0</strong> · © 2025-2026 GameStringer Team
</p>
