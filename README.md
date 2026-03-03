<p align="center">
  <img src="public/logo.png" alt="GameStringer Logo" width="200" />
</p>

<h1 align="center">🎮 GameStringer</h1>

<p align="center">
  <strong>The Ultimate Open Source Suite for Video Game Localization with AI</strong><br>
  Translate any video game into any language with neural AI
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.4.1-blue" alt="Version" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/license-Source--Available-green" alt="License" />
  <img src="https://img.shields.io/badge/Tauri-2.0-24C8DB" alt="Tauri" />
  <img src="https://img.shields.io/badge/Next.js-15-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/Rust-🦀-orange" alt="Rust" />
</p>

<p align="center">
  <a href="https://buymeacoffee.com/gamestringer">
    <img src="https://img.shields.io/badge/☕_Buy_Me_a_Coffee-FFDD00?logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" />
  </a>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-download">Download</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-supported-engines">Engines</a> •
  <a href="#-support">Support</a>
</p>

---

## ✨ Features

### 🤖 Neural AI Translation

- **18+ AI Providers**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, Cohere, DeepL, Ollama (local), LM Studio, **Qwen 3**, **NLLB-200**, and more
- **Context-Aware**: Understands game genre, character voice, and tone
- **Translation Memory**: Reuse previous translations for consistency
- **Glossary Support**: Define custom terms for your project

### 🌐 NEW: Community Hub (v1.0.7)

- **GitHub Discussions** integration for community support
- **Share translations** with other users
- **Browse community patches** for popular games

### 🔔 NEW: Update Notifications (v1.0.9)

- **Animated headers** with breathing gradient effect
- **Smart notifications** with sound alerts for updates
- **One-click update** from notification bell

### 🌏 NEW: Asian Language Support (v1.0.6)

- **Qwen 3**: Dedicated provider for Chinese/Japanese/Korean via Ollama
- **NLLB-200**: 200 languages support including Thai, Vietnamese, Hindi, Arabic
- **Generic Ollama**: Use any installed model for translation

### 🎤 NEW: Voice Clone Studio (v1.0.5)

- **AI voice cloning** with ElevenLabs and OpenAI TTS
- **Text-to-speech** with multiple voices and presets
- **VR Text Overlay** for spatial subtitles in VR games

### 🎬 Subtitle Translator Pro

- **Complete parser** for SRT, VTT, ASS/SSA formats
- **Real-time preview** with QA validation
- **Multi-format export** with preserved timing

### 🎮 Retro ROM Tools

- **8 consoles** supported (NES, SNES, GB, GBC, GBA, Genesis, PSX, N64)
- **Table file** (.TBL) parser/generator
- **Font injection** for accented characters

### 🔌 NEW: Public API v1 (v1.0.4)

- `POST /api/v1/translate` - Single translation
- `POST /api/v1/batch` - Batch translation (max 100)
- `GET /api/v1/languages` - 20 supported languages
- `GET /api/v1/health` - Health check

### 🎮 Game Engine Support

| Engine | Support | Method |
|--------|---------|--------|
| **Unity** | ✅ Full | BepInEx + XUnity.AutoTranslator |
| **Unreal Engine** | ✅ Full | UnrealLocres integration |
| **Godot** | ✅ Full | Native .translation files |
| **RPG Maker** | ✅ Full | MV/MZ JSON, VX/Ace via Trans |
| **Ren'Py** | ✅ Full | Native .rpy parsing |
| **GameMaker** | ⚡ Partial | UndertaleModTool |
| **Telltale** | ✅ Full | .langdb/.dlog support |
| **Wolf RPG** | ✅ Full | WolfTrans integration |
| **Kirikiri** | ✅ Full | .ks/.scn parsing |

### 📚 Library Integration

- **Steam**: Auto-detect 600+ games with Family Sharing support
- **Epic Games**: Via Legendary CLI
- **GOG Galaxy**: Native integration
- **Origin/EA**: Registry detection
- **Ubisoft Connect**: Full support
- **Amazon Games**: Full support
- **itch.io**: Indie games support

### 🛠️ Pro Tools

- **Batch Translation**: Translate entire games with one click
- **OCR Translator**: Extract text from retro games (8-bit, 16-bit, DOS)
- **Voice Pipeline**: Speech-to-text → Translation → Text-to-speech
- **Real-time Overlay**: See translations while playing
- **Multi-LLM Compare**: Compare translations from multiple AI providers
- **Context Crawler**: AI game context extraction for better translations
- **Translation Fixer**: Auto-fix markup tags in translations
- **Community Hub**: Share and download translation memories

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

## 📥 Download

### Windows

Download the latest release from [GitHub Releases](https://github.com/rouges78/GameStringer/releases):

- **GameStringer-Setup.exe** - Installer (recommended)
- **GameStringer-Portable.zip** - Portable version

### Linux

Download the latest release from [GitHub Releases](https://github.com/rouges78/GameStringer/releases):

- **GameStringer.deb** - Debian/Ubuntu package
- **GameStringer.AppImage** - Universal AppImage (recommended)

#### Linux Dependencies

```bash
# Debian/Ubuntu
sudo apt install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

# Fedora
sudo dnf install webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel

# Arch Linux
sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3 librsvg
```

> **Note**: On Linux, Windows-only features (DLL injection, anti-cheat detection, screen capture OCR, registry-based store detection) are not available. Game library detection uses filesystem paths instead of the Windows registry.

### Requirements

- **Windows**: Windows 10/11 (64-bit)
- **Linux**: Ubuntu 22.04+ / Fedora 38+ / Arch (64-bit, WebKitGTK 4.1)
- 4GB RAM minimum (8GB+ for local AI)
- 500MB disk space

---

## 🚀 Quick Start

1. **Download and install** GameStringer
2. **Launch the app** and create a profile
3. **Connect your stores** (Steam auto-detects, others optional)
4. **Select a game** from your library
5. **Click Translate** and choose target language
6. **Apply the patch** with one click

Done! Your game is now translated. 🎉

---

## 🔧 Configuration

### AI Providers

GameStringer supports multiple AI providers. Configure your preferred one in Settings:

| Provider | API Key Required | Free Tier |
|----------|-----------------|------------|
| Ollama | ❌ No (local) | ✅ Unlimited |
| LM Studio | ❌ No (local) | ✅ Unlimited |
| Gemini | ✅ Yes | ✅ Free tier available |
| DeepSeek | ✅ Yes | ✅ Very cheap |
| Groq | ✅ Yes | ✅ 14,400 req/day free |
| Mistral | ✅ Yes | ✅ Free tier available |
| OpenAI | ✅ Yes | ❌ Paid only |
| Claude | ✅ Yes | ❌ Paid only |
| DeepL | ✅ Yes | ✅ 500k chars/month |
| MyMemory | ❌ No | ✅ 1000 words/day |

**Recommended for beginners**: Use **Ollama** (free, runs locally) or **Gemini** (free tier).

---

## 🎯 Supported Engines

### Unity Games (Automatic)

GameStringer automatically installs BepInEx + XUnity.AutoTranslator:

- Extracts all game text
- Translates with your chosen AI
- Creates translation files
- No manual patching required

### Unreal Engine

Uses UnrealLocres for .locres file manipulation:

- Automatic text extraction
- Preserves formatting
- One-click patch creation

### RPG Maker MV/MZ

Direct JSON translation:

- Maps, Events, Actors, Items
- System messages
- Plugin compatibility

### Retro Games (OCR)

For games without extractable text:

- Capture screenshots
- AI-powered OCR (Tesseract.js)
- Real-time overlay translation

---

## 🛠️ Build from Source

### Prerequisites

- Node.js 18+
- Rust 1.70+
- pnpm or npm
- **Linux only**: WebKitGTK 4.1 dev libraries (see Linux Dependencies above)

### Steps

```bash
# Clone the repository
git clone https://github.com/rouges78/GameStringer.git
cd GameStringer

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run tauri:build
```

---

## 💖 Support

If GameStringer helped you enjoy games in your language, consider supporting the project:

<p align="center">
  <a href="https://buymeacoffee.com/gamestringer">
    <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support-FFDD00?logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" />
  </a>
  <a href="https://ko-fi.com/gamestringer">
    <img src="https://img.shields.io/badge/Ko--fi-Support%20Me-FF5E5B?logo=ko-fi&logoColor=white" alt="Ko-fi" />
  </a>
  <a href="https://github.com/sponsors/rouges78">
    <img src="https://img.shields.io/badge/GitHub%20Sponsors-Sponsor-EA4AAA?logo=github-sponsors&logoColor=white" alt="GitHub Sponsors" />
  </a>
</p>

---

## 📜 License

GameStringer is released under a **Source-Available License**.

- ✅ Free for personal use
- ✅ Free for personal modifications
- ❌ Commercial use requires permission
- ❌ Redistribution of modified versions requires permission

See [LICENSE](LICENSE) for full details.

---

## 🙏 Credits

- **XUnity.AutoTranslator** - Unity translation framework
- **BepInEx** - Unity modding framework
- **Tesseract.js** - OCR engine
- **Tauri** - Desktop app framework

---

<p align="center">
  Made with ❤️ for gamers who want to play in their own language
</p>

<p align="center">
  <strong>GameStringer v1.4.2</strong><br>
  © 2025-2026 GameStringer Team
</p>
