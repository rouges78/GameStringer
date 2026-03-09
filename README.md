<p align="center">
  <img src="public/logo.png" alt="GameStringer Logo" width="180" />
</p>

<h1 align="center">GameStringer</h1>

<p align="center">
  <strong>Desktop app that translates video games into any language using AI.</strong><br>
  Pick a game from your library, choose a language, click translate — done.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.4.2-blue" alt="Version" />
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
  <a href="#-supported-game-engines">Engines</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-build-from-source">Build</a>
</p>

<p align="center">
  <a href="README_IT.md">🇮🇹 Leggi in Italiano</a>
</p>

---

## 🎮 What is GameStringer?

GameStringer is a **desktop application** (Windows & Linux) that lets you translate video games that don't have your language.

Most games store their text in files — JSON, XML, CSV, .locres, .rpy, and many other formats. GameStringer **scans your game folder**, finds those files, sends the text through an **AI translation provider** of your choice (OpenAI, Gemini, DeepSeek, Ollama, etc.), and **patches the translated text back** into the game. One click, no technical knowledge needed.

For **Unity games** that lock text inside compiled assets, GameStringer **automatically installs BepInEx + XUnity.AutoTranslator** — no manual setup required.

**It's not a machine translation website.** It's a full pipeline: detect game → extract text → translate with AI → quality check → patch back → play.

---

## 📥 Download

Get the latest release from **[GitHub Releases](https://github.com/rouges78/GameStringer/releases)**:

| Platform | File | Notes |
|----------|------|-------|
| **Windows** | `GameStringer-Setup.exe` | Installer (recommended) |
| **Windows** | `GameStringer-Portable.zip` | No install needed |
| **Linux** | `GameStringer.AppImage` | Universal (recommended) |
| **Linux** | `GameStringer.deb` | Debian / Ubuntu |

**Requirements:** Windows 10+ or Linux (Ubuntu 22.04+, Fedora 38+), 4 GB RAM (8 GB+ for local AI), 500 MB disk.

---

## 🚀 How it works

1. **Install** GameStringer and launch it
2. **Your game library loads automatically** — Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io
3. **Pick a game** and click **"Translate"**
4. **Choose your language** and AI provider
5. GameStringer scans the game files, translates everything, and generates a patch
6. **Apply the patch** — your game is now in your language

That's it. No command line, no manual file editing, no modding experience needed.

---

## 🎯 Supported Game Engines

| Engine | Support | How it works |
|--------|---------|--------------|
| **Unity** | ✅ Full | Auto-installs BepInEx + XUnity.AutoTranslator |
| **Unreal Engine** | ✅ Full | .locres extraction and patching |
| **Godot** | ✅ Full | Native .translation files |
| **RPG Maker** | ✅ Full | MV/MZ JSON, VX/Ace via Trans |
| **Ren'Py** | ✅ Full | Native .rpy script parsing |
| **GameMaker** | ⚡ Partial | Via UndertaleModTool |
| **Telltale** | ✅ Full | .langdb / .dlog support |
| **Wolf RPG** | ✅ Full | WolfTrans integration |
| **Kirikiri** | ✅ Full | .ks / .scn parsing |

> **Unity games** get special treatment: if no translatable files are found, GameStringer detects it's a Unity game and offers to **automatically install BepInEx + XUnity.AutoTranslator** with one click. Just launch the game once after install, then re-scan — all text becomes translatable.
>
> ⚠️ **Anti-Cheat Warning**: BepInEx (DLL injection) can trigger anti-cheat systems (EAC, BattlEye, Vanguard). GameStringer includes anti-cheat detection and will warn you. **Only use on single-player / offline games.**

---

## ✨ Features

### AI Translation

- **18+ providers**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, DeepL, Ollama (local), LM Studio, Qwen 3, NLLB-200, and more
- **Context-aware**: understands game genre, character voice, tone
- **Translation Memory & Glossary**: consistency across the project
- **Multi-LLM Compare**: run multiple providers in parallel, pick the best result
- **Quality gates**: automatic QA scoring on every translated string

### Game Library

- **Auto-detect**: Steam (with Family Sharing), Epic, GOG Galaxy, Origin/EA, Ubisoft Connect, Amazon Games, itch.io
- **600+ games** recognized from installed libraries
- **Game cards** with cover art, metadata, and one-click translate

### Translation Tools

- **One-Click Translate**: scan → translate → patch in a single flow
- **Batch Translation**: translate entire games at once
- **Vision LLM**: use in-game screenshots for context-aware translation (Ollama, Gemini, GPT-4o)
- **Subtitle Translator**: SRT, VTT, ASS/SSA with timing preservation
- **OCR Translator**: extract text from retro games (8-bit, 16-bit, DOS presets)
- **Voice Pipeline**: speech-to-text → translate → text-to-speech
- **Real-time Overlay**: see translations while playing

### Advanced

- **Lore Assistant**: RAG chat that knows the game's lore and dialogues
- **Character Voice Profiles**: define personality, tone, speech patterns per character
- **Translation Confidence Heatmap**: visual quality overview of all translations
- **Auto-Hook Scanner**: process memory scanning (Windows)
- **Community Hub**: share and download translation memories
- **Public API v1**: REST endpoints for integration (`/api/v1/translate`, `/api/v1/batch`)

### App

- **11 languages UI**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL
- **Signed auto-updates**: one-click update from the app
- **System Monitor**: real-time VRAM/RAM usage
- **Profiles**: multiple user profiles with recovery keys
- **Cross-platform**: Windows & Linux with native builds

---

## 🔧 AI Providers

| Provider | API Key | Free Tier |
|----------|---------|-----------|
| Ollama | No (local) | ✅ Unlimited |
| LM Studio | No (local) | ✅ Unlimited |
| Gemini | Yes | ✅ Free tier |
| DeepSeek | Yes | ✅ Very cheap |
| Groq | Yes | ✅ 14,400 req/day |
| Mistral | Yes | ✅ Free tier |
| OpenAI | Yes | Paid |
| Claude | Yes | Paid |
| DeepL | Yes | ✅ 500k chars/month |
| MyMemory | No | ✅ 1000 words/day |

**Recommended to start**: **Ollama** (free, local) or **Gemini** (free tier, cloud).

---

## � Documentation

User guides in 11 languages:

| | | |
|---|---|---|
| �🇹 [Italiano](docs/GUIDA_UTENTE.md) | 🇬🇧 [English](docs/USER_GUIDE_EN.md) | 🇪🇸 [Español](docs/USER_GUIDE_ES.md) |
| 🇫🇷 [Français](docs/USER_GUIDE_FR.md) | 🇩🇪 [Deutsch](docs/USER_GUIDE_DE.md) | 🇯🇵 [日本語](docs/USER_GUIDE_JA.md) |
| 🇨🇳 [中文](docs/USER_GUIDE_ZH.md) | 🇰🇷 [한국어](docs/USER_GUIDE_KO.md) | 🇧🇷 [Português](docs/USER_GUIDE_PT.md) |
| 🇷🇺 [Русский](docs/USER_GUIDE_RU.md) | 🇵🇱 [Polski](docs/USER_GUIDE_PL.md) | |

---

## 🛠️ Build from Source

**Prerequisites**: Node.js 18+, Rust 1.70+, npm. On Linux also: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.

```bash
git clone https://github.com/rouges78/GameStringer.git
cd GameStringer
npm install
npm run dev          # development
npm run tauri:build  # production build
```text

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

**Source-Available License** — the source code is public and you can build it yourself, but it is not OSI-approved "Open Source".

- ✅ Free for personal use
- ✅ Free to inspect, build, and modify for yourself
- ❌ Commercial use requires written permission
- ❌ Redistribution of modified versions requires written permission

See [LICENSE](LICENSE) for details. Questions? Open a [Discussion](https://github.com/rouges78/GameStringer/discussions).

---

## 🙏 Credits

- **[BepInEx](https://github.com/BepInEx/BepInEx)** — Unity modding framework (BepInEx Team)
- **[XUnity.AutoTranslator](https://github.com/bbepis/XUnity.AutoTranslator)** — Unity translation framework (bbepis)
- **[Tauri](https://tauri.app)** — Desktop app framework
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** — OCR engine

---

<p align="center">
  Made with ❤️ for gamers who want to play in their own language<br>
  <strong>GameStringer v1.4.2</strong> · © 2025-2026 GameStringer Team
</p>
