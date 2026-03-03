# 📖 GameStringer - Complete User Guide

## Table of Contents

1. [Overview](#overview)
2. [First Launch and Profiles](#first-launch-and-profiles)
3. [Library and Game Details](#library-and-game-details)
4. [Neural Translator Pro](#neural-translator-pro)
5. [Translation Wizard](#translation-wizard)
6. [Translation Bridge](#translation-bridge)
7. [Subtitle Translator Pro](#subtitle-translator-pro)
8. [Retro ROM Tools](#retro-rom-tools)
9. [Public API v1](#public-api-v1)
10. [Voice Clone Studio](#voice-clone-studio) *(NEW v1.0.5)*
11. [VR Text Overlay](#vr-text-overlay) *(NEW v1.0.5)*
12. [Quality Gates](#quality-gates) *(NEW v1.0.5)*
13. [Player Feedback](#player-feedback) *(NEW v1.0.5)*
14. [New AI Providers v1.0.6](#new-ai-providers-v106) *(NEW v1.0.6)*
15. [Community Hub v1.0.7](#community-hub-v107) *(NEW v1.0.7)*
16. [UI Improvements v1.0.9](#ui-improvements-v109) *(NEW v1.0.9)*
17. [Danganronpa Auto-Translator](#danganronpa-auto-translator) *(NEW v1.1.0)*
18. [Patch Export](#patch-export)
19. [Apply to Game](#apply-to-game)
20. [Backup Management](#backup-management)
21. [Translation Editor](#translation-editor)
22. [Activity History](#activity-history)
23. [Dictionaries](#dictionaries)
24. [Troubleshooting](#troubleshooting)

---

## Overview

GameStringer is an advanced system for automatic and manual video game translation. It supports:


- **Game engines**: Unity, Unreal Engine, RPG Maker, Ren'Py, Godot, Telltale, Wolf RPG, Kirikiri and others
- **File formats**: CSV, JSON, XML, PO/POT, YAML, TXT, SRT, VTT, ASS/SSA and others
- **AI Providers**: Claude, Gemini, GPT, DeepSeek, Mistral, Groq, Ollama, **Qwen 3**, **NLLB-200** (18+ providers)
- **Languages**: 200+ supported languages (with NLLB-200)
- **Multilingual UI**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL (11 languages)
- **Gaming Stores**: Steam, Epic Games, GOG, Origin, Battle.net, Ubisoft, itch.io, Amazon Games
- **NEW v1.0.5**: Voice Clone Studio, VR Text Overlay, Quality Gates, Player Feedback
- **NEW v1.0.6**: Qwen 3 (Asian languages), NLLB-200 (200 languages), bug fixes
- **NEW v1.0.7**: Community Hub, GitHub Discussions, License v1.1
- **NEW v1.0.8**: Update download fix
- **NEW v1.0.9**: Animated headers, update notifications, UI polish
- **NEW v1.4.0**: Unified Radix UI, per-row Quality Badges, RTL support, generic Ollama, TypeScript cleanup
- **NEW v1.4.1**: Complete GOG Galaxy, improved dashboard, game Info tab, AI provider fixes, cross-platform Linux build

---

## First Launch and Profiles

### Creating a Profile

On first launch, GameStringer requires creating a user profile:


1. **Click "Create Profile"** on the initial screen
2. **Enter a name** for the profile (e.g., "MyName")
3. **Set a password** (minimum 6 characters)
4. **Click "Create"** to confirm

### Login

To access an existing profile:


1. **Select the profile** from the list
2. **Enter the password**
3. **(Optional)** Check "Remember password" for automatic login
4. **Click "Login"**

### Profile Management

- **Switch profile**: Click profile icon top right → "Switch profile"
- **Logout**: Click profile icon → "Logout"
- **Profile settings**: Go to Settings → Profile

---

## Library and Game Details

### Library

The Library shows all your games synced from Steam, Epic Games, GOG and other stores.

- **Refresh**: Reload the game list
- **Shared**: Show/hide Family Sharing games
- **Filters**: Filter by platform, installation status, engine

### Game Detail Page

Click on a game to open the detail page with **3:1** layout:

#### Main Column (75%)

- **Screenshot Gallery**: Grid up to 12 clickable screenshots (lightbox)
- **Quick Info**: Engine, file count, installation path, DLC
- **File/Translations/Patch Tabs**:
  - **Files**: Translatable files found with "Neural Translator" button
  - **Translations**: Active translations for this game
  - **Patch**: Install/remove patches for Unity, Unreal, RPG Maker

#### Right Sidebar (25%)

- **Game Info**: Developer, publisher, release date, genres, supported languages
- **Actions**: Translate Game, Scan Files
- **HowLongToBeat**: Estimated time to complete the game

#### Translation Recommendation

At the bottom of the page, the system analyzes the game and suggests the **best translation method**:

| Method | When to use |
|--------|-------------|
| **Live Unity** | Unity games with BepInEx + XUnity |
| **File Translation** | Localization files found (JSON, CSV, etc.) |
| **OCR Overlay** | No files found, real-time visual translation |

---

## Neural Translator Pro

### How to Translate a File

1. **Select a game** from the Steam library or upload manually
2. **Load the file** to translate (drag & drop or browse)
3. **Configure options**:
   - **Source language**: the original language (e.g., English)
   - **Target language**: the destination language (e.g., Italian)
   - **AI Provider**: Claude (recommended), Gemini or GPT
   - **API Key**: enter your API key for the chosen provider
4. **Start translation** by clicking "Start Translation"
5. **Monitor progress** in the progress bar

### Advanced Options

| Option | Description |
|--------|-------------|
| **Quality Checks** | Automatic quality verification (numbers, formatting, etc.) |
| **Translation Memory** | Reuse previous translations to speed up |
| **Batch Size** | Number of strings translated in parallel (default: 10) |

### Estimated Costs

The system shows a cost estimate before starting:

- **Claude**: ~$0.003 per 1K tokens
- **Gemini**: ~$0.0005 per 1K tokens (cheaper)
- **GPT-4**: ~$0.01 per 1K tokens

---

## Translation Wizard

The Translation Wizard is a guided procedure to automatically translate game files.

### How to Use the Wizard

1. **Go to Translator** → click "Translation Wizard"
2. **Select the game** from the library or enter the path manually
3. **Scan files**: the wizard automatically finds translatable files
4. **Select files** to translate (you can select multiple)
5. **Configure options**:
   - Source and destination language
   - AI Provider
   - Quality options
6. **Start batch translation**
7. **Monitor progress** in the progress bar

### Auto-Detected Formats

| Extension | Type |
|-----------|------|
| `.json` | JSON localization |
| `.csv` | Text tables |
| `.xml` | XML configurations |
| `.po/.pot` | Gettext (Linux standard) |
| `.txt` | Plain text |
| `.yaml` | YAML config |

---

## Translation Bridge

Translation Bridge allows translating Unity games **in real-time** during gameplay.

### Requirements

- Unity game (Mono or IL2CPP)
- BepInEx installed
- XUnity.AutoTranslator plugin

### How to Configure

1. **Go to Translation Bridge** in the menu
2. **Select the Unity game** from the list
3. **Install BepInEx** (automatic if not present)
4. **Configure XUnity.AutoTranslator**:
   - Destination language
   - Translation endpoint
5. **Launch the game** - translations will appear automatically

### Operating Modes

- **Local cache**: Translations saved for reuse
- **Live translation**: New strings translated on the fly
- **Fallback**: If offline, uses only cache

---

## Subtitle Translator Pro

> NEW in v1.0.4

Subtitle Translator Pro allows translating subtitles in various formats.

### Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| **SubRip** | .srt | Most common format |
| **WebVTT** | .vtt | Web standard |
| **ASS/SSA** | .ass/.ssa | Advanced subtitles with styles |

### How to Use

1. **Go to Subtitle Translator** in the menu
2. **Load the subtitle file** (drag & drop or browse)
3. **Select source and destination language**
4. **Real-time preview** of translations
5. **Export** in the desired format

### Features

- **QA Validation**: Automatic timing and formatting check
- **Synchronized preview**: See translations with original timing
- **Multi-format export**: Convert between SRT, VTT, ASS

---

## Retro ROM Tools

> NEW in v1.0.4

Tools to translate retro games on ROMs.

### Supported Consoles

| Console | Abbreviation |
|---------|--------------|
| Nintendo Entertainment System | NES |
| Super Nintendo | SNES |
| Game Boy | GB |
| Game Boy Color | GBC |
| Game Boy Advance | GBA |
| Sega Genesis/Mega Drive | Genesis |
| PlayStation 1 | PSX |
| Nintendo 64 | N64 |

### Features (2)

- **Table File Parser**: Reads and generates .TBL files for character mapping
- **Font Injection**: Injects fonts with accented characters
- **Integrated Hex Editor**: Direct ROM modification

### How to Use (2)

1. **Go to Retro ROM Tools** in the menu
2. **Load the ROM** of the game
3. **Load or generate** the Table File (.TBL)
4. **Extract text** from the ROM
5. **Translate** with AI or manually
6. **Inject** translations into the ROM

---

## Public API v1

> NEW in v1.0.4

GameStringer exposes a REST API for external integrations.

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/translate` | Single string translation |
| `POST` | `/api/v1/batch` | Batch translation (max 100 strings) |
| `GET` | `/api/v1/languages` | List of 20 supported languages |
| `GET` | `/api/v1/health` | Service health check |

### Request Example

```json
POST /api/v1/translate
{
  "text": "Hello, world!",
  "source": "en",
  "target": "it",
  "provider": "gemini"
}
```

### Response Example

```json
{
  "translation": "Ciao, mondo!",
  "source": "en",
  "target": "it",
  "provider": "gemini",
  "tokens": 12
}
```

### CI/CD Usage

The API is ideal for integrating GameStringer into automated build pipelines.

---

## Voice Clone Studio

> NEW in v1.0.5

Clone voices with AI for automatic game dubbing.

### Supported Providers

| Provider | Type | Quality |
|----------|------|---------|
| **ElevenLabs** | Cloud | ⭐⭐⭐⭐⭐ Excellent |
| **OpenAI TTS** | Cloud | ⭐⭐⭐⭐ Very good |

### Voice Presets

- 🎭 **Narrator**: Calm and authoritative voice
- ⚔️ **Hero**: Brave and determined voice
- 😈 **Villain**: Threatening and deep voice
- 👶 **Child**: Young and cheerful voice
- 🤖 **Robot**: Synthetic and metallic voice
- 👻 **Whisper**: Low and mysterious voice

### How to Use (3)

1. **Go to Voice Clone** in the menu
2. **Enter the text** to convert to audio
3. **Select the provider** (ElevenLabs or OpenAI)
4. **Choose the voice preset**
5. **Generate audio** and download the MP3/WAV file

---

## VR Text Overlay

> NEW in v1.0.5

3D spatial subtitles for VR games.

### Supported Headsets

| Headset | Support |
|---------|---------|
| **Oculus Quest/Rift** | ✅ Complete |
| **SteamVR** (Valve Index, HTC Vive) | ✅ Complete |
| **Windows Mixed Reality** | ✅ Complete |

### Position Presets

- **Center** - In front of the player
- **Bottom** - At the bottom (classic subtitle)
- **Top** - At the top (notifications)
- **Follow Head** - Follows gaze

### How to Use (4)

1. **Go to VR Overlay** in the menu
2. **Detect headset** automatically
3. **Configure position** and text size
4. **Start overlay** before launching the VR game
5. Subtitles will appear in 3D space

---

## Quality Gates

> NEW in v1.0.5

Automatic translation quality control system.

### Automatic Checks

| Check | Description |
|-------|-------------|
| **Placeholder** | Verifies {0}, {1}, %s, etc. |
| **Numbers** | Numbers preserved correctly |
| **HTML Tags** | `<color>`, `<b>`, etc. intact |
| **Length** | Translation not too long/short |
| **Punctuation** | Consistency with original |

### Confidence Levels

| Level | Score | Color |
|-------|-------|-------|
| 🔴 Critical | < 40% | Red |
| 🟠 Low | 40-59% | Orange |
| 🟡 Medium | 60-74% | Yellow |
| 🟢 High | 75-89% | Green |
| 💚 Perfect | 90-100% | Dark green |

### How to Use (5)

1. **Go to Quality Gates** in the menu
2. **Load translations** (JSON, CSV, or paste)
3. **Analyze** each string automatically
4. **Filter** by confidence level
5. **Export report** in JSON

---

## Player Feedback

> NEW in v1.0.5

Collect and manage player feedback on translations.

### Feedback Categories

- 📝 **Wrong translation** - Incorrect meaning
- 🔤 **Grammar error** - Grammar/spelling
- 🎭 **Inappropriate tone** - Wrong linguistic register
- ❓ **Unclear** - Confusing translation
- ✨ **Suggestion** - Improvement proposal

### Rating System

⭐⭐⭐⭐⭐ 1-5 star rating for each translation

### Feedback States

| State | Description |
|-------|-------------|
| 🆕 New | Just received |
| 👀 In review | Under analysis |
| ✅ Resolved | Corrected |
| ❌ Rejected | Not applicable |

### How to Use (6)

1. **Go to Player Feedback** in the menu
2. **View received feedback**
3. **Filter** by category, state, rating
4. **Update feedback status**
5. **Export** to CSV for analysis

---

## New AI Providers v1.0.6

> NEW in v1.0.6

### Qwen 3 - Asian Languages

Provider optimized for Chinese, Japanese and Korean.

| Model | Parameters | RAM Required |
|-------|------------|--------------|
| `qwen3:4b` | 4B | 4GB |
| `qwen3:8b` | 8B | 8GB |
| `qwen3:14b` | 14B | 16GB |
| `qwen3:32b` | 32B | 32GB |



``bash
ollama pull qwen3:14b
```

**Optimized languages**: 中文 (Chinese), 日本語 (Japanese), 한국어 (Korean)

### NLLB-200 - 200 Languages

Meta AI provider with support for 200 languages, including rare ones.



Thai, Vietnamese, Hindi, Arabic
- Swahili, Indonesian, Turkish
- Ukrainian, Bengali, Tamil

**Configuration**:


1. Go to **Settings → API Keys**
2. Enter **HuggingFace API Key** (free)
3. Select **NLLB-200** as provider

### Generic Ollama

Use any Ollama-installed model for translations.



`llama3.2` - Good quality/speed balance
- `mistral` - Great for European languages
- `gemma2` - Fast and lightweight

---

## Community Hub v1.0.7

> NEW in v1.0.7

Centralized hub for the GameStringer community.

### GitHub Discussions

Direct access to community discussions:


- **Announcements**: Official news and updates
- **Q&A**: Questions and answers from the community
- **Ideas**: Proposals for new features
- **Showcase**: Community projects and translations

### How to Access

1. **Go to Community Hub** in the sidebar
2. **Browse** discussion categories
3. **Participate** directly on GitHub

### License v1.1

- **YouTubers/Streamers**: OK with attribution
- **Non-commercial forks**: Allowed
- **Commercial use**: Requires authorization

---

## UI Improvements v1.0.9

> NEW in v1.0.9

Aesthetic and functional interface updates.

### Animated Headers

All translation pages now have headers with:


- **"Breathing" effect**: Gradient that expands/contracts smoothly (12s)
- **Deep shadows**: shadow-xl with blue tint
- **Uniform gradient**: Sky → Blue → Cyan

### Update Notifications

The **bell** in the navbar now handles updates:

| State | Behavior |
|-------|----------|
| 🔔 Gray | No notifications |
| 🔔 Yellow | Unread notifications |
| 🔔 Green + pulse | Update available! |



**Sound**: Two melodic tones when detecting update
- **Green badge**: Animated download icon
- **Click**: Opens popup with changelog
- **Download button**: Opens download page

### Sidebar Menu

- **Sub-item hover**: Dark green color (emerald-600)
- **Visual consistency**: Unified style

### Login Screen

- **Version under logo**: Shows v1.0.9 under the logo
- **Footer**: Witty tagline instead of copyright

---

## Danganronpa Auto-Translator

> NEW in v1.1.0

Automatic translation system for Danganronpa series games.

### Supported Games

| Game | Detection | PAK Types |
|------|-----------|-----------|
| **Danganronpa: Trigger Happy Havoc** | DR1_us.exe | Text, Script, Font |
| **Danganronpa 2: Goodbye Despair** | DR2_us.exe | Text, Script, Font |
| **Danganronpa Another Episode** | game.exe | Text, Script |

### PAK File Types

| Type | Files | Content |
|------|-------|---------|
| **Type 1 - Text** | 00_System.pak, 26_Menu.pak, 49_Novel.pak | Direct text strings |
| **Type 2 - Script** | script_pak_*.pak, novel_*.pak | .LIN dialogue scripts |
| **Type 3 - Font** | bin_special_font_l.pak | Nested PAK (fonts) |
| **Texture** | Various | PNG images |

### How to Use (7)

1. **Select Danganronpa** from your library
2. **Click "Auto-Translate"** in the Translation Recommendation section
3. **API Key Check**: System verifies your configured API key
4. **Cost Estimate**: See estimated cost before proceeding
5. **Automatic Extraction**: PAK files are extracted natively (Rust)
6. **AI Translation**: Strings translated in batches
7. **Output**: Translated .PO and .TSV files ready for DRAT

### Cost Estimation

Before translation starts, you'll see:

| Provider | Cost per 1M tokens | Example (10K strings) |
|----------|-------------------|----------------------|
| **Gemini** | $0.075 | ~$0.15 |
| **Claude** | $3.00 | ~$6.00 |
| **GPT-4** | $10.00 | ~$20.00 |
| **DeepSeek** | $0.14 | ~$0.28 |

### Rate Limit Handling

The system automatically handles API rate limits:


- **429 Error**: Waits 20 seconds, then retries
- **Batch Delay**: 2 second pause between batches
- **Progress Updates**: Shows "⏳ Rate limit, waiting 20s..."

### Output Files

After translation, files are saved to:

```
[GamePath]/GameStringer_Translation/
├── originals.json      # Extracted original strings
├── translations.json   # Translated strings
├── dialogues.po        # Gettext format for DRAT
└── translations.tsv    # Tab-separated for spreadsheets
```

### Applying Translations

Use **DRAT (Danganronpa Another Tool)** to repack:


1. Download DRAT from [GitHub](https://github.com/Liquid-S/Danganronpa-Another-Tool)
2. Open the translated .PO file in DRAT
3. Repack into PAK format
4. Copy PAK files to game folder

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "API Key Missing" | Go to Settings → configure Gemini/OpenAI key |
| "Rate Limit" | Wait or use different API key |
| "No strings found" | Game may use unsupported PAK type |
| "Extraction failed" | Check file permissions, run as admin |

---

## Patch Export

The Unity Patcher automatically installs BepInEx and XUnity.AutoTranslator on Unity games.

### How to Use (8)

1. **Go to Unity Patcher** in the sidebar
2. **Select a Unity game** from the list (green "Unity" badge)
3. **Choose the destination language** (e.g., Italian)
4. **Choose the mode**:
   - **Capture only**: Capture text for manual translation
   - **Google Translate**: Automatic in-game translation
   - **DeepL**: Higher quality automatic translation
5. **Click "Install patch"**
6. **Launch the game** - press `ALT+T` to open XUnity menu

### Translation Badge

After installation, you'll see a badge indicating the status:

| Badge | Meaning |
|-------|---------|
| 🥈 Silver | XUnity with auto-translate active (Google/DeepL) |
| 🥉 Bronze | Text capture only (manual translation) |

### Activity Tracking

Every installed patch is recorded in **Recent Activity** on the Dashboard with:

- Game name
- Chosen translation mode
- Target language

---

## Activity History

The activity history tracks all operations performed.

### Access

Go to **Activity History** in the sidebar.

### Recorded Activity Types

| Icon | Type | Description |
|------|------|-------------|
| 🌐 | Translation | Completed translations |
| 🔧 | Patch | Created/applied patches |
| ♻️ | SteamSync | Steam synchronizations |
| ➕ | GameAdded | Added games |
| 🎮 | GameLaunched | Launched games |
| 👤 | ProfileCreated | Created profiles |
| ⚙️ | SettingsChanged | Modified settings |

### Available Filters

- **By type**: Filter by activity category
- **By date**: Select time range
- **By game**: Show only activities for a specific game

---

## Patch Export

After completing a translation, you can export a package ready for distribution.

### "Export Patch" Button

Creates a ZIP file on your **Desktop** containing:

```
📦 GameName_en_patch.zip
├── 📁 translated/          # Translated files ready to use
│   └── translated_file.csv
├── 📁 backup/               # Original file backups
│   └── original_file.csv
├── 📁 xunity/               # XUnity.AutoTranslator format
│   └── AutoTranslator/
│       └── Translation/
│           └── en/
│               └── _Translations.txt
├── 📄 README.txt            # Installation instructions
└── 📄 metadata.json         # Translation information
```

### XUnity.AutoTranslator Format

The XUnity format is compatible with:

- **Unity games** with BepInEx + XUnity.AutoTranslator
- Format: `original_text=translated_text`

---

## Apply to Game

### "Apply to game" Button

Installs the translation **directly into the game** automatically:


1. **Detects the engine** of the game (Unity, Unreal, etc.)
2. **Checks compatibility** with available patchers
3. **Installs the patcher** if needed (e.g., BepInEx for Unity)
4. **Copies translated files** to the correct folder
5. **Configures the game** to load translations

### Supported Engines

| Engine | Patcher | Status |
|--------|---------|--------|
| Unity (Mono) | BepInEx + XUnity.AutoTranslator | ✅ Automatic |
| Unity (IL2CPP) | BepInEx IL2CPP | ⚠️ Partial |
| Unreal Engine | - | 🔧 Manual |
| RPG Maker | - | ✅ Direct replacement |
| Ren'Py | - | ✅ Direct replacement |

### What Happens to Original Files?

**Original files are ALWAYS preserved!**

1. Before overwriting, an automatic backup is created
2. Backups are saved in `.gamestringer_backups/` in the game folder
3. Backup name includes timestamp: `20241228_001500_filename.csv`

---

## Backup Management

### Where to Find Backups

Backups are saved in two places:


1. **In the game folder**: `[game_folder]/.gamestringer_backups/`
2. **In the exported ZIP package**: `backup/` folder

### How to Restore a Backup



Go to the **Backup** section of the app
2. Select the file to restore
3. Click **Restore**



Find the backup file in `.gamestringer_backups/`
2. Copy the file to the original location
3. Rename by removing the timestamp

---

## Translation Editor

The Editor allows manual translation editing.

### Hierarchical Structure

```
📁 Games
├── 📁 Decarnation
│   ├── 📄 dialogues.csv (897 strings)
│   └── 📄 items.csv (123 strings)
└── 📁 Other Game
    └── 📄 texts.json (456 strings)
```

### Features (3)

- **Search**: find strings by text
- **Filters**: show only incomplete translations, with errors, etc.
- **AI suggestions**: request new translations for individual strings
- **Auto-save**: changes are saved to the dictionary

---

## Dictionaries

Dictionaries save translations for each game.

### How They Work

1. Each game has its own separate dictionary
2. Translations are saved automatically
3. Reused to speed up future translations
4. Exportable in various formats (JSON, CSV, TMX)

### Dictionary Location

```
%APPDATA%/GameStringer/dictionaries/
├── 1672310_decarnation.json
├── 123456_other_game.json
└── ...
```

---

## Troubleshooting

### Translation is slow

- **Cause**: Too many strings or slow provider
- **Solution**: Increase batch size or use Gemini (faster)

### API Key Error

- **Cause**: Invalid or expired API key
- **Solution**: Verify the key on the provider's website

### Patcher won't install

- **Cause**: Antivirus blocking BepInEx
- **Solution**: Add exception for the game folder

### File not recognized

- **Cause**: Unsupported file format
- **Solution**: Convert to CSV or JSON

### Translation with formatting errors

- **Cause**: AI modified variables or tags
- **Solution**: Enable "Quality Checks" to detect automatically

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save current translation |
| `Ctrl + Z` | Undo change |
| `Ctrl + F` | Search in file |
| `Esc` | Close dialog/panel |

---

## Support

- **GitHub**: [github.com/rouges78/GameStringer](https://github.com/rouges78/GameStringer)
- **Issues**: Report bugs or request features
- **Wiki**: Detailed technical documentation

---

## What's New in v1.4.0

### Unified Radix UI

The UI library has been migrated from individual `@radix-ui/react-*` packages to the unified `radix-ui` package:


- **37 components migrated** with simplified imports
- **27 packages removed** from dependencies, lighter bundle
- No visual changes — same UI, fewer dependencies

### Quality Badges in Translator Pro

Each translated row now shows visual quality indicators:


- **QualityScoreBadge**: score 0-100 with colors (🟢 ≥80, 🟡 ≥60, 🔴 <60)
- **ContentTypeBadge**: classifies content type (UI, Dialogue, Narrative, System, Tutorial, etc.)
- **Live Preview**: during batch translation, last 3 translated rows appear with real-time score
- **Detail Table**: in results page, up to 200 rows with source, translation, type, and quality

### RTL Support

- Automatic text direction detection for RTL languages (Arabic, Hebrew)
- `dir` attribute dynamically applied to the HTML document
- Works with the existing i18n system

### Generic Ollama Models

- New `translateWithOllamaGeneric` provider to use any Ollama model
- PROVIDER_MAP with automatic model mapping
- Chain presets with automatic fallback between providers

### Bundle Optimization

- `optimizePackageImports` updated with `radix-ui`, `framer-motion`, `recharts`, `cmdk`, `react-hook-form`
- Zero TypeScript errors in source files

---

## What's New in v1.4.1

### Complete GOG Galaxy Support

- **GOG Galaxy 2.0 library reading**: reads owned games from local SQLite database
- **Covers and descriptions via GOG API**: automatic image and detail fetching
- **Merge with installed games**: combines registry data with Galaxy database
- **Store and download links**: Store page with direct GOG Galaxy links

### Improved Dashboard

- **Connected Stores at top**: stores are now side-by-side with the last opened game
- **Store badges with real counts**: shows actual game count per store
- **Last game placeholder**: elegant display when no game has been opened

### Enhanced Game Detail

- **Info Tab**: system requirements, Metacritic score, store links, DLC list in sidebar
- **GOG covers**: automatic fallback for GOG game covers
- **GOG descriptions**: full description fetch via GOG API

### AI Provider Fixes

- **Free providers never permanently blocked**: MyMemory, Lingva use cooldown (30s) instead of permanent block
- **Steam Wishlist**: new IWishlistService endpoint with legacy fallback

### Performance

- **sessionStorage cache**: instant navigation back from game detail to library
- **Batch cover save**: cover saving with debounce (2s) to avoid race conditions
- **SteamGridDB fetch dedup**: avoids duplicate requests in StrictMode

### Cross-Platform Build

- **Node.js build script**: `build-tauri-cross.js` replaces PowerShell-only script
- **Linux support**: GitHub Actions workflow now builds for Linux (.deb, .AppImage)
- **Windows**: installer (.msi, .exe NSIS) and portable version (.zip)

### Documentation

- **11 user guides**: markdown lint fixes (MD029, MD024, MD032, MD036, MD040, MD022, MD031)
- **Corrected index numbering**: ordered index without numbering gaps

---

## What's New in v1.4.2

### Vision LLM Translator

- **Context-aware translation**: use in-game screenshots for visual context during translation
- **3 supported providers**: Ollama (local), Gemini 2.0 Flash, OpenAI GPT-4o
- **Upload or capture**: load an image or capture the screen for AI context
- **Dedicated page**: `/vision-translator` with integrated sidebar

### Advanced AI Tools

- **Lore Assistant**: RAG chat for exploring game lore and dialogues
- **Auto-Hook Scanner**: process memory scanning with WinAPI (`winapi` crate)
- **System Monitor**: real-time VRAM/RAM monitoring (Rust backend)
- **Ollama Setup Wizard**: step-by-step local AI installation guide
- **Debug Console**: built-in debug console with log interception
- **Plugin System**: design doc `PLUGIN_SYSTEM.md` for future extensions

### Community Hub

- **GitHub Discussions**: 12 discussions created across Announcements, General, Ideas, Q&A, Show and tell, Polls
- **Public REST API fetch**: Community Hub now loads discussions without requiring a GitHub token
- **Sidebar renamed**: "Workshop" → "Steam Workshop" for clarity

### Translation Provider Fix

- **Ollama cooldown**: network errors now use 30s cooldown instead of permanent block
- **Lingva 404**: auto-truncation for texts >500 chars to prevent URL overflow
- **Auto-Translate Review**: new "Translate all untranslated" button with progress bar and stop
- **Tutorial querySelector**: fix SyntaxError with `:contains()` selectors (not standard CSS)
- **Update Bell**: fix wrong version in popup (hardcoded fallback removed)

### CI/CD and Security

- **Tauri Signing Key**: configured for automatic signed `latest.json` generation in releases
- **GitHub Secrets**: `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` configured
- **Workflow release.yml**: updated with signing variables for both jobs (Windows + Linux)

---

*GameStringer v1.4.2 - Guide updated 03/03/2026*
