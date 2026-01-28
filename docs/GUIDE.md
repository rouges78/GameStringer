# 📚 GameStringer Complete Guide

> **Version**: 1.0.6  
> **Last Updated**: January 28, 2026

---

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [First Launch & Profile Setup](#first-launch--profile-setup)
4. [Dashboard Overview](#dashboard-overview)
5. [Library Management](#library-management)
6. [Translation Tools](#translation-tools)
7. [AI Providers Configuration](#ai-providers-configuration)
8. [Game Engine Support](#game-engine-support)
9. [Patcher & Mod Injection](#patcher--mod-injection)
10. [Community Hub](#community-hub)
11. [Advanced Features](#advanced-features)
12. [Troubleshooting](#troubleshooting)
13. [FAQ](#faq)

---

## Introduction

**GameStringer** is a free, AI-powered game localization tool that allows you to translate your favorite games into any language using neural AI technology.

### Key Features

- **18+ AI Providers**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, Cohere, DeepL, Ollama, LM Studio, **Qwen 3**, **NLLB-200**, and more
- **Multi-Engine Support**: Unity, Unreal Engine, Godot, RPG Maker, Ren'Py, GameMaker, Telltale, Wolf RPG, Kirikiri
- **Store Integration**: Steam, Epic Games, GOG, Origin, Ubisoft Connect, Battle.net, itch.io
- **Professional Tools**: OCR Translator, Voice Pipeline, Real-time Overlay, Translation Memory
- **NEW v1.0.5**: Voice Clone Studio, VR Text Overlay, Quality Gates, Player Feedback
- **NEW v1.0.6**: Qwen 3 (Asian languages), NLLB-200 (200 languages), bug fixes

---

## Installation

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Windows 10 (64-bit) | Windows 11 (64-bit) |
| RAM | 4 GB | 8 GB |
| Storage | 500 MB | 1 GB |
| Internet | Required for AI translation | Broadband recommended |

### Installation Steps

1. **Download** the latest release from [GitHub Releases](https://github.com/rouges78/GameStringer/releases)
2. **Choose your version**:
   - `GameStringer-Setup.exe` - Standard installer (recommended)
   - `GameStringer-Portable.zip` - Portable version (no installation)
3. **Run the installer** and follow the on-screen instructions
4. **Launch GameStringer** from the Start menu or desktop shortcut

---

## First Launch & Profile Setup

### Creating Your Profile

1. On first launch, you'll see the **Profile Selector** screen
2. Click **"Create New Profile"**
3. Enter your profile name and password
4. Your profile stores:
   - AI provider settings
   - Translation preferences
   - Game library cache
   - Translation memory

### Profile Security

- Profiles are stored locally on your computer
- Passwords are hashed (not stored in plain text)
- You can export/import profiles for backup

---

## Dashboard Overview

The dashboard is your command center with quick access to all features.

### Main Sections

| Section | Description |
|---------|-------------|
| **Recent Activity** | Your latest translations and actions |
| **Quick Actions** | One-click access to Library, Translate, Patcher, Community |
| **Stats** | Total games, translations, active patches |

### Quick Links

- **Batch** - Queue multiple files for translation
- **Projects** - Manage translation projects
- **Statistics** - View detailed translation stats
- **Settings** - Configure app preferences

---

## Library Management

### Automatic Game Detection

GameStringer automatically detects games from:

- **Steam** - Full library + Family Sharing support
- **Epic Games** - Via Legendary CLI
- **GOG Galaxy** - Native integration
- **Origin/EA** - Registry detection
- **Ubisoft Connect** - Full support
- **Amazon Games** - Full support
- **itch.io** - Indie game support

### Manual Game Addition

1. Click **"Add Game"** button
2. Browse to your game's installation folder
3. GameStringer will detect the engine and available files

### Game Details

Click any game to see:

- **Engine detected** (Unity, Unreal, etc.)
- **Available translations**
- **Recommended translation method**
- **Screenshot gallery**

---

## Translation Tools

### AI Translator

The main translation interface with:

1. **Source Selection** - Choose files or folders to translate
2. **Language Selection** - Pick source and target languages
3. **AI Provider** - Select your preferred AI
4. **Context Settings** - Game genre, character voice, formality

### Neural Translator Pro

Advanced features:

- **Multi-file batch processing**
- **Translation memory integration**
- **Glossary support**
- **Quality scoring**

### Multi-LLM Comparison

Compare translations from multiple AI providers:

1. Enter your text
2. Select 3+ AI providers
3. Get parallel translations
4. Auto-select best result based on consensus

### OCR Translator

For retro games without extractable text:

1. Capture screenshot
2. OCR extracts text (Tesseract.js)
3. Translate extracted text
4. View with overlay

### Voice Pipeline

Speech-to-text → Translation → Text-to-speech:

1. Record or upload audio
2. Whisper transcribes to text
3. AI translates text
4. TTS generates translated audio

---

## AI Providers Configuration

### Free Options

| Provider | API Key | Limits |
|----------|---------|--------|
| **Ollama** | ❌ No (local) | Unlimited |
| **LM Studio** | ❌ No (local) | Unlimited |
| **Gemini** | ✅ Yes | Free tier available |
| **Groq** | ✅ Yes | Free tier available |
| **Mistral** | ✅ Yes | Free tier available |
| **MyMemory** | ❌ No | 1000 words/day |

### Paid Options

| Provider | Quality | Speed | Cost |
|----------|---------|-------|------|
| **OpenAI GPT-4** | ⭐⭐⭐⭐⭐ | Fast | $$$ |
| **Claude 3** | ⭐⭐⭐⭐⭐ | Fast | $$$ |
| **DeepL** | ⭐⭐⭐⭐ | Very Fast | $$ |
| **DeepSeek** | ⭐⭐⭐⭐ | Fast | $ |

### Setup Instructions

1. Go to **Settings** → **AI Providers**
2. Click on the provider you want to configure
3. Enter your API key
4. Test the connection
5. Set as default (optional)

### Local AI Setup (Ollama)

1. Download [Ollama](https://ollama.ai)
2. Install and run `ollama serve`
3. Pull a model: `ollama pull llama2` or `ollama pull mistral`
4. In GameStringer, Ollama will be auto-detected

---

## Game Engine Support

### Unity Games (Automatic)

GameStringer handles Unity games automatically:

1. **Detects Unity version** from `globalgamemanagers`
2. **Installs BepInEx** (mod framework)
3. **Installs XUnity.AutoTranslator** (translation hook)
4. **Extracts all game text**
5. **Translates with your chosen AI**
6. **Creates translation files**

No manual patching required!

### Unreal Engine

Uses UnrealLocres for `.locres` file manipulation:

1. Select your UE game
2. GameStringer extracts text from localization files
3. Translate
4. One-click patch creation

### Godot

Native support for Godot projects:

- `.translation` files
- `.tres` resources
- `.tscn` scenes

### RPG Maker

| Version | Method |
|---------|--------|
| MV/MZ | Direct JSON translation |
| VX/Ace | Via RPG Maker Trans tool |

### Ren'Py

Direct `.rpy` file parsing:

- Dialogue extraction
- Character name detection
- Preserve formatting

### Telltale Games

Support for `.langdb` and `.dlog` files:

- The Wolf Among Us
- The Walking Dead series
- Batman series

---

## Patcher & Mod Injection

### Unity Patcher

1. Select a Unity game
2. Click **"Patch"**
3. GameStringer will:
   - Backup original files
   - Install BepInEx
   - Install XUnity.AutoTranslator
   - Apply your translations

### Universal Injector

For games without native support:

1. Select game executable
2. Choose injection method
3. Configure hooks
4. Apply translation overlay

### Backup & Restore

All patches include automatic backup:

- **Backup** created before patching
- **Restore** with one click
- **Verify** installation status

---

## Community Hub

### Translation Packs

Browse and download community translations:

1. Go to **Community** tab
2. Search for your game
3. Filter by language, rating, date
4. Download with one click

### Sharing Your Translations

1. Complete a translation project
2. Click **"Share to Community"**
3. Add description and tags
4. Upload

### Translation Memory

Reuse previous translations:

- Automatic matching
- Fuzzy matching for similar strings
- Import/export TM files

---

## Advanced Features

### Context Crawler

AI-powered game context extraction:

1. Provide game name or description
2. AI analyzes genre, setting, characters
3. Context improves translation quality

### Translation Fixer

Automatic markup repair:

- Fix broken HTML/XML tags
- Preserve placeholder variables
- Correct encoding issues

### Subtitle Overlay

Real-time translation display:

- Customizable position
- Font and color options
- Opacity control
- Multi-line support

### Character Voice Profiles

Define character-specific translation styles:

- **Preset profiles**: Pirate, Noble, Child, Robot, etc.
- **Custom profiles**: Create your own
- **Per-character settings**: Formality, vocabulary, speech patterns

---

## Troubleshooting

### Common Issues

#### "Steam games not detected"

1. Make sure Steam is installed and logged in
2. Go to **Settings** → **Store Connections** → **Steam**
3. Enter your Steam API key and Steam ID
4. Click **Refresh Library**

#### "Translation failed"

1. Check your internet connection
2. Verify API key is correct
3. Check if provider has rate limits
4. Try a different AI provider

#### "Patch not working"

1. Make sure game is not running
2. Run GameStringer as Administrator
3. Check antivirus isn't blocking files
4. Try manual backup restore and re-patch

#### "OCR not accurate"

1. Use higher resolution screenshots
2. Try different OCR presets (8-bit, 16-bit, DOS)
3. Adjust contrast and threshold settings
4. Consider manual correction

### Log Files

Logs are stored in:
```
%APPDATA%\GameStringer\logs\
```

Include logs when reporting issues.

---

## FAQ

### Is GameStringer free?

**Yes!** GameStringer is free for personal use. Commercial use requires a license.

### Does it work offline?

**Partially.** You can:
- ✅ Browse your library
- ✅ Use local AI (Ollama, LM Studio)
- ✅ Apply cached translations
- ❌ Use cloud AI providers

### Is it safe to use?

**Yes.** GameStringer:
- Only modifies game files with your permission
- Creates automatic backups
- Doesn't modify game executables
- Doesn't access online game accounts

### Will I get banned for using translations?

**Unlikely.** GameStringer:
- Only translates text (no cheats)
- Doesn't modify game behavior
- Works like any other mod

However, always check each game's EULA.

### Which games work best?

Games with these engines work best:
- ✅ Unity (automatic)
- ✅ Unreal Engine
- ✅ RPG Maker MV/MZ
- ✅ Ren'Py
- ✅ Godot

### How can I support the project?

- ⭐ Star the [GitHub repository](https://github.com/rouges78/GameStringer)
- ☕ [Buy me a coffee](https://ko-fi.com/gamestringer)
- 💜 [Become a sponsor](https://github.com/sponsors/rouges78)
- 🐛 Report bugs and suggest features

---

## Support

- **GitHub Issues**: [Report bugs](https://github.com/rouges78/GameStringer/issues)
- **Ko-fi**: [Support the project](https://ko-fi.com/gamestringer)
- **GitHub Sponsors**: [Become a sponsor](https://github.com/sponsors/rouges78)

---

<p align="center">
  <strong>GameStringer v1.0.6</strong><br>
  Made with ❤️ for gamers who want to play in their language
</p>
