<p align="center">
  <img src="public/logo.png" alt="GameStringer Logo" width="120" />
</p>

<h1 align="center">🎮 GameStringer</h1>

<p align="center">
  <strong>Free AI-powered game localization tool</strong><br>
  Translate your favorite games into any language with neural AI
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.2-blue" alt="Version" />
  <img src="https://img.shields.io/badge/platform-Windows-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/license-Source--Available-green" alt="License" />
  <img src="https://img.shields.io/badge/Tauri-2.0-24C8DB" alt="Tauri" />
  <img src="https://img.shields.io/badge/Next.js-15-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/Rust-🦀-orange" alt="Rust" />
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-download">Download</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-supported-engines">Engines</a> •
  <a href="#-screenshots">Screenshots</a> •
  <a href="#-support">Support</a>
</p>

---

## ✨ Features

### 🤖 Neural AI Translation

- **15+ AI Providers**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, Cohere, DeepL, Ollama (local), LM Studio, and more
- **Context-aware**: Understands game genre, character voice, and tone
- **Translation Memory**: Reuse previous translations for consistency
- **Glossary Support**: Define custom terms for your project

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

### 📚 Library Integration

- **Steam**: Auto-detect 600+ games with Family Sharing support
- **Epic Games**: Via Legendary CLI
- **GOG Galaxy**: Native integration
- **Origin/EA**: Registry detection
- **Ubisoft Connect**: Full support
- **Amazon Games**: Full support
- **itch.io**: Indie games support

### 🛠️ Pro Tools

- **Batch Translation**: Translate entire games in one click
- **OCR Translator**: Extract text from retro games (8-bit, 16-bit, DOS)
- **Voice Pipeline**: Speech-to-text → Translate → Text-to-speech
- **Real-time Overlay**: See translations while playing
- **Multi-LLM Compare**: Compare translations from multiple AI providers
- **Context Crawler**: AI-powered game context extraction for better translations
- **Translation Fixer**: Auto-fix broken markup tags in translations
- **Community Hub**: Share and download translation memories
- **Universal Injector**: Inject mods into any game engine

---

## 📥 Download

### Windows

Download the latest release from [GitHub Releases](https://github.com/rouges78/GameStringer/releases):

- **GameStringer-Setup.exe** - Installer (recommended)
- **GameStringer-Portable.zip** - Portable version

### Requirements

- Windows 10/11 (64-bit)
- 4GB RAM minimum
- 500MB disk space

---

## 🚀 Quick Start

1. **Download and install** GameStringer
2. **Launch the app** and create a profile
3. **Connect your stores** (Steam auto-detects, others optional)
4. **Select a game** from your library
5. **Click Translate** and choose your target language
6. **Apply the patch** with one click

That's it! Your game is now translated. 🎉

---

## 🔧 Configuration

### AI Providers

GameStringer supports multiple AI providers. Configure your preferred one in Settings:

| Provider | API Key Required | Free Tier |
|----------|-----------------|----------|
| Ollama | ❌ No (local) | ✅ Unlimited |
| LM Studio | ❌ No (local) | ✅ Unlimited |
| Gemini | ✅ Yes | ✅ Free tier available |
| DeepSeek | ✅ Yes | ✅ Very affordable |
| OpenAI | ✅ Yes | ❌ Paid only |
| Claude | ✅ Yes | ❌ Paid only |
| Mistral | ✅ Yes | ✅ Free tier available |
| Groq | ✅ Yes | ✅ Free tier available |
| DeepL | ✅ Yes | ✅ Free tier (500k chars/month) |
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

- Screenshot capture
- AI-powered OCR (Tesseract.js)
- Real-time overlay translation

---

## 📸 Screenshots

<p align="center">
  <img src="screenshots/dashboard.png" alt="Dashboard" width="45%" />
  <img src="screenshots/translator.png" alt="Translator" width="45%" />
</p>

<p align="center">
  <img src="screenshots/library.png" alt="Library" width="45%" />
  <img src="screenshots/patcher.png" alt="Patcher" width="45%" />
</p>

---

## 🛠️ Build from Source

### Prerequisites

- Node.js 18+
- Rust 1.70+
- pnpm or npm

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

### Project Structure

```
GameStringer/
├── app/                    # Next.js pages (43 routes)
│   ├── editor/            # Translation editor
│   ├── heatmap/           # Confidence heatmap
│   ├── ai-review/         # AI review agent
│   └── ...
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── tools/            # Tool-specific UIs
│   └── layout/           # Layout components
├── lib/                   # Core libraries
│   ├── translation-confidence.ts  # Heatmap metrics
│   ├── emotion-analyzer.ts        # Emotion detection
│   ├── translation-memory.ts      # TM system
│   └── project-manager.ts         # Project files
├── src-tauri/            # Rust backend
│   └── src/
│       ├── commands/     # Tauri commands
│       └── profiles/     # User profiles
└── __tests__/            # Vitest tests
```

### Available Scripts

```bash
npm run dev              # Start dev server with profiles
npm run dev:simple       # Start Next.js only
npm run test             # Run tests (Vitest)
npm run test:ui          # Run tests with UI
npm run lint             # ESLint
npm run tauri:build      # Build desktop app
```

### Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Tauri 2.0, Rust
- **Database**: SQLite (via Tauri)
- **Testing**: Vitest, Testing Library
- **AI**: OpenAI, Anthropic, Google, local LLMs (Ollama)

---

## 💖 Support

If GameStringer helped you enjoy games in your language, consider supporting the project:

<p align="center">
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

- ✅ Free to use for personal purposes
- ✅ Free to modify for personal use
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
  Made with ❤️ for gamers who want to play in their language
</p>

<p align="center">
  <strong>GameStringer v1.0.2</strong><br>
  © 2025-2026 GameStringer Team
</p>
