# 📖 GameStringer - Полное руководство пользователя

## Содержание

1. [Обзор](#обзор)
2. [Первый запуск и профили](#первый-запуск-и-профили)
3. [Библиотека и детали игры](#библиотека-и-детали-игры)
4. [Neural Translator Pro](#neural-translator-pro)
5. [Translation Wizard](#translation-wizard)
6. [Translation Bridge](#translation-bridge)
7. [Subtitle Translator Pro](#subtitle-translator-pro)
8. [Retro ROM Tools](#retro-rom-tools)
9. [Публичный API v1](#публичный-api-v1)
10. [Voice Clone Studio](#voice-clone-studio) *(НОВОЕ v1.0.5)*
11. [VR Text Overlay](#vr-text-overlay) *(НОВОЕ v1.0.5)*
12. [Quality Gates](#quality-gates) *(НОВОЕ v1.0.5)*
13. [Player Feedback](#player-feedback) *(НОВОЕ v1.0.5)*
14. [Новые AI-провайдеры v1.0.6](#новые-ai-провайдеры-v106) *(НОВОЕ v1.0.6)*
15. [Community Hub v1.0.7](#community-hub-v107) *(НОВОЕ v1.0.7)*
16. [Улучшения UI v1.0.9](#улучшения-ui-v109) *(НОВОЕ v1.0.9)*
17. [Danganronpa Авто-переводчик](#danganronpa-авто-переводчик) *(НОВОЕ v1.1.0)*
18. [Экспорт патча](#экспорт-патча)
19. [Применить к игре](#применить-к-игре)
20. [Управление резервными копиями](#управление-резервными-копиями)
21. [Редактор переводов](#редактор-переводов)
22. [История активности](#история-активности)
23. [Словари](#словари)
24. [Устранение неполадок](#устранение-неполадок)
25. [Глоссарий](#глоссарий)
26. [Context Harvester](#context-harvester)
27. [Память переводов](#память-переводов)
28. [OCR-переводчик](#ocr-переводчик)
29. [AI-проверка](#ai-проверка)
30. [AI-пайплайн](#ai-пайплайн)
31. [Переводчик эмоций](#переводчик-эмоций)
32. [Культурная адаптация](#культурная-адаптация)
33. [Тепловая карта надёжности](#тепловая-карта-надёжности)
34. [Управление блогом](#управление-блогом)
35. [Ren'Py Patcher](#renpy-patcher)
36. [RPG Maker Patcher](#rpg-maker-patcher)
37. [Wolf RPG Patcher](#wolf-rpg-patcher)
38. [Danganronpa Patcher](#danganronpa-patcher)
39. [Сравнение нескольких LLM](#сравнение-нескольких-llm) *(НОВОЕ)*
40. [Оценка качества в реальном времени](#оценка-качества-в-реальном-времени) *(НОВОЕ)*
41. [Голосовые профили персонажей](#голосовые-профили-персонажей) *(НОВОЕ)*
42. [Конвейер голосового перевода](#конвейер-голосового-перевода) *(НОВОЕ)*
43. [OCR Мульти-движок](#ocr-мульти-движок) *(НОВОЕ)*
44. [Ретро-игры OCR](#ретро-игры-ocr) *(НОВОЕ)*
45. [Адаптивный MT](#адаптивный-mt) *(НОВОЕ)*
46. [Пакетный переводчик папок](#пакетный-переводчик-папок) *(НОВОЕ)*
47. [Офлайн-переводчик](#офлайн-переводчик) *(НОВОЕ)*
48. [Переводчик манги/комиксов](#переводчик-мангикомиксов) *(НОВОЕ)*
49. [Переводчик текстур](#переводчик-текстур) *(НОВОЕ)*
50. [Авто-глоссарий](#авто-глоссарий) *(НОВОЕ)*

---

## Обзор

GameStringer — это продвинутая система для автоматического и ручного перевода видеоигр. Поддерживает:

- **Игровые движки**: Unity, Unreal Engine, RPG Maker, Ren'Py, Godot, Telltale, Wolf RPG, Kirikiri и другие
- **Форматы файлов**: CSV, JSON, XML, PO/POT, YAML, TXT, SRT, VTT, ASS/SSA и другие
- **AI-провайдеры**: Claude, Gemini, GPT, DeepSeek, Mistral, Groq, Ollama, **Qwen 3**, **NLLB-200** (18+ провайдеров)
- **Языки**: 200+ поддерживаемых языков (с NLLB-200)
- **Многоязычный интерфейс**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL (11 языков)
- **Игровые магазины**: Steam, Epic Games, GOG, Origin, Battle.net, Ubisoft, itch.io, Amazon Games
- **НОВОЕ v1.0.5**: Voice Clone Studio, VR Text Overlay, Quality Gates, Player Feedback
- **НОВОЕ v1.0.6**: Qwen 3 (азиатские языки), NLLB-200 (200 языков), исправления
- **НОВОЕ v1.0.7**: Community Hub, GitHub Discussions, Лицензия v1.1
- **НОВОЕ v1.0.8**: Исправление загрузки обновлений
- **НОВОЕ v1.0.9**: Анимированные заголовки, уведомления об обновлениях, улучшения UI
- **НОВОЕ v1.4.0**: Унифицированный Radix UI, Quality Badges по строкам, поддержка RTL, универсальный Ollama, очистка TypeScript
- **НОВОЕ v1.4.1**: Полная GOG Galaxy, улучшенная панель, вкладка Инфо, исправления AI-провайдеров, сборка Linux

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
```text

### Response Example

```json
{
  "translation": "Ciao, mondo!",
  "source": "en",
  "target": "it",
  "provider": "gemini",
  "tokens": 12
}
```text

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

```text

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

```text

[GamePath]/GameStringer_Translation/
├── originals.json      # Extracted original strings
├── translations.json   # Translated strings
├── dialogues.po        # Gettext format for DRAT
└── translations.tsv    # Tab-separated for spreadsheets

```text

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

```text

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

```text

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

```text

📁 Games
├── 📁 Decarnation
│   ├── 📄 dialogues.csv (897 strings)
│   └── 📄 items.csv (123 strings)
└── 📁 Other Game
    └── 📄 texts.json (456 strings)

```text

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

```text

%APPDATA%/GameStringer/dictionaries/
├── 1672310_decarnation.json
├── 123456_other_game.json
└── ...

```text

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

## Глоссарий

Глоссарий управляет пользовательскими словарями терминологии для каждой игры, обеспечивая согласованность переводов.

### Функции

- **Уровни терминов**:
  - 🔴 **Locked** — термин всегда переводится идентично (имена собственные, заклинания, места)
  - 🟡 **Synced** — согласованный перевод, адаптируемый к контексту
  - 🟢 **Flexible** — свободный перевод
- **Категории**: персонаж, место, предмет, навык, квест, UI, система, лор, существо, фракция
- **Автоизвлечение**: анализ AI для предложения терминов
- **Проверка согласованности**: проверяет единообразный перевод во всех файлах
- **Импорт/Экспорт**: CSV и JSON для обмена глоссариями между играми

### Как использовать

1. Перейдите в **Расширенные инструменты → Глоссарий**
2. Выберите игру из списка
3. Добавьте термины вручную или используйте **«Извлечь термины»** для предложений AI
4. Установите уровень для каждого термина
5. Глоссарий применяется автоматически при переводах

---

## Context Harvester

Анализирует текстовые строки, классифицирует их и обогащает контекстом перед переводом AI, улучшая качество.

### Функции

- **Автоматическая классификация**: определяет тип экрана (меню, диалог, нарратив, обучение, система)
- **Распознавание говорящего**: определяет кто говорит и тип тона (формальный, разговорный, агрессивный)
- **Контекстные метаданные**: каждая строка получает жанр игры, тип контента и тон
- **Сохранение harvest**: извлечённые контексты сохраняются и используются повторно
- **Пакетная обработка**: анализирует целые файлы за одну операцию

### Как использовать

1. Перейдите в **Расширенные инструменты → Context Harvester**
2. Вставьте строки или загрузите файл
3. Нажмите **«Анализировать»** для классификации каждой строки
4. Скачайте результат JSON для использования как входных данных для переводов AI

---

## Память переводов

Постоянная база данных всех выполненных переводов с автоматическим повторным использованием.

### Функции

- **Автоматическое повторное использование**: уже переведённые строки предлагаются без нового вызова AI
- **Поиск**: по оригинальному тексту, переводу или названию игры
- **Фильтр по игре**: отображает только переводы конкретного названия
- **Статистика**: общие единицы, распределение по игре, дата последнего изменения
- **Экспорт**: JSON, CSV, TMX для других CAT-инструментов
- **Импорт**: импортирует существующие переводы из TMX или CSV

### Как использовать

1. Перейдите в **Расширенные инструменты → Память переводов**
2. Найдите предыдущие переводы с помощью панели поиска
3. Редактируйте или удаляйте отдельные единицы по необходимости
4. Память автоматически консультируется при переводах AI

---

## OCR-переводчик

Захватывает текст из любого игрового окна или снимка экрана в реальном времени и мгновенно переводит его.

### Функции

- **Захват в реальном времени**: анализирует экран с настраиваемыми интервалами
- **Исходные языки**: японский, английский, упрощённый китайский, корейский
- **Выбор окна**: указывает непосредственно на игровое окно
- **Выбор региона**: определяет конкретную область экрана для анализа
- **Достоверность**: показывает уровень надёжности для каждого обнаруженного текста
- **Глобальная горячая клавиша**: включает/выключает захват сочетанием клавиш
- **Кэш переводов**: повторно использует предыдущие переводы для идентичных строк

### Как использовать

1. Перейдите в **OCR-переводчик** из боковой панели
2. Выберите исходный язык игры
3. Нажмите **«Выбрать окно»** и выберите игровое окно
4. *(Необязательно)* Установите конкретный регион через **«Выбрать регион»**
5. Нажмите **«Пуск»** для начала автоматического захвата и перевода

---

## AI-проверка

Автоматическая проверка качества переводов с обнаружением ошибок и предложениями исправлений.

### Функции

- **Единичный режим**: проверка одной пары оригинал/перевод
- **Пакетный режим**: массовая проверка в формате `оригинал|перевод` на строку
- **Категории проблем**: точность, беглость, терминология, тон, структура
- **Уровни серьёзности**: критический, предупреждение, информация
- **Авто-исправление**: автоматическое исправление незначительных проблем
- **Статистика**: глобальная оценка 0–100 для каждого пакета

### Как использовать

1. Перейдите в **Расширенные инструменты → AI-проверка**
2. Выберите **Единичный** или **Пакетный**
3. Вставьте оригинальный текст и перевод
4. Нажмите **«Проверить»** для получения отчёта
5. Используйте **«Авто-исправление»** для применения предложенных исправлений

---

## AI-пайплайн

Автоматизированный 6-шаговый рабочий процесс для получения переводов максимального качества одним кликом.

### Шаги пайплайна

1. **Harvest** — извлекает и классифицирует контекст
2. **Translate** — переводит с настроенным провайдером AI
3. **QA Check** — автоматическая проверка качества
4. **Auto-Fix** — исправляет найденные проблемы
5. **Review** — финальная проверка AI
6. **Score** — вычисляет итоговую оценку 0–100

### Доступные пресеты

- **Quick** — основные шаги (Translate + QA Check)
- **Max Quality** — все 6 шагов по порядку

### Как использовать

1. Перейдите в **Расширенные инструменты → AI-пайплайн**
2. Вставьте строки для перевода
3. Выберите пресет или настройте шаги вручную
4. Нажмите **«Запустить пайплайн»**
5. Скачайте итоговый отчёт с оценками для каждой строки

---

## Переводчик эмоций

Перевод, анализирующий и сохраняющий эмоции в оригинальном диалоге.

### Функции

- **Анализ эмоций**: определяет преобладающую эмоцию (гнев, грусть, страх, радость, нейтральная, удивление, отвращение)
- **Интенсивность**: измеряет уровень эмоциональной интенсивности (0–100)
- **Сохранение тона**: направляет AI на сохранение того же эмоционального воздействия
- **EmotionBadge**: визуальная метка для каждой строки с эмоцией и интенсивностью
- **Пакетная статистика**: распределение эмоций по всему файлу

### Как использовать

1. Перейдите в **Расширенные инструменты → Переводчик эмоций**
2. Вставьте текст для перевода
3. Выберите целевой язык
4. Нажмите **«Анализировать и перевести»**
5. Результат показывает перевод с идентифицированными эмоциями для каждой строки

---

## Культурная адаптация

Анализирует переведённый текст для выявления культурно проблематичных элементов и предлагает адаптации.

### Функции

- **Поддерживаемые культуры**: IT, EN, DE, FR, ES, JA, KO, ZH, PT, RU
- **Анализируемые категории**: идиоматические выражения, культурные отсылки, меры/валюты, символические цвета, формулы вежливости, юмор
- **Конкретные предложения**: для каждого элемента предлагает альтернативу, подходящую целевой культуре
- **Оценка адаптации**: процент текста, требующего пересмотра

### Как использовать

1. Перейдите в **Расширенные инструменты → Культурная адаптация**
2. Вставьте переведённый текст
3. Выберите исходную и целевую культуру
4. Нажмите **«Анализировать»**
5. Примените предложения перед финальной публикацией

---

## Тепловая карта надёжности

Визуализирует качество каждого перевода через карту с цветовой кодировкой, мгновенно выявляя проблемные строки.

### Функции

- **8 анализируемых метрик**: отсутствующие заполнители, пустые строки, непереведённые строки, пунктуация, заглавные буквы, HTML-теги, длина, числа
- **Цветовой код**:
  - 🟢 **Отлично** (90–100%) — правильный перевод
  - 🔵 **Хорошо** (75–89%) — мелкие стилистические проблемы
  - 🟡 **Приемлемо** (60–74%) — незначительные проблемы
  - 🟠 **Требует проверки** (40–59%) — серьёзные ошибки
  - 🔴 **Плохо** (<40%) — критические ошибки
- **3 режима ввода**: встроенная демонстрация, вставка текста (`оригинал|перевод` на строку), загрузка файла (JSON/CSV/TXT)
- **Экспорт отчёта**: скачайте JSON с оценками и проблемами для каждой строки

### Как использовать

1. Перейдите в **Расширенные инструменты → Тепловая карта надёжности**
2. Выберите режим: **Демо** для просмотра примера, **Вставить** для ручного ввода, **Файл** для загрузки
3. Нажмите **«Анализировать»**
4. Изучите цветовой отчёт: красные/оранжевые строки требуют приоритетной проверки
5. Используйте **«Экспортировать отчёт»** для сохранения в JSON

---

## Управление блогом

Управляет блогом новостей и обновлений для проекта перевода, отображаемым на панели инструментов.

### Функции

- **Создание публикаций**: заголовок, дата, краткое описание, тег категории
- **Доступные теги**: Feature, UI, Fix, Security, AI, Update, News
- **Закрепление**: фиксирует важные публикации в верхней части списка
- **Встроенное редактирование**: редактируйте любую публикацию без смены страницы
- **Удаление публикации**: удаление с подтверждением
- **Отображение**: хронологический список со стилизованной датой, цветным значком тега и превью описания

### Как использовать

1. Перейдите в **Управление блогом** из главного меню
2. Нажмите **«Новая публикация»**
3. Заполните дату (напр. «24 Jan»), заголовок (с рекомендованными эмодзи), описание и тег
4. Нажмите **«Сохранить»**
5. Используйте иконку 📌 для закрепления публикации вверху

---

## Ren'Py Patcher

Специализированный патчер для визуальных новелл на движке Ren'Py. Извлекает диалоги, меню и нарратив из файлов `.rpy` и генерирует нативные файлы перевода.

### Функции

- **Автообнаружение**: определяет название, версию и файлы скриптов игры
- **Типы строк**: Диалог, Меню, Нарратив
- **Определение персонажа**: показывает какой персонаж произносит каждую реплику
- **Встроенный редактор**: клик по строке для редактирования перевода
- **Поиск и фильтр**: поиск по тексту или персонажу, фильтр по типу
- **Генерация файлов `.rpy`**: создаёт структуру `tl/<язык>/` для Ren'Py
- **Сохранить/Загрузить JSON**: сохраняйте прогресс и продолжайте позже
- **Статистика**: процент завершения, количество по типу

### Как использовать

1. Перейдите в **Ren'Py Patcher** на боковой панели
2. Нажмите **«Обзор»** и выберите папку игры Ren'Py
3. Нажмите **«Извлечь строки»**
4. Редактируйте переводы в редакторе (кликните строку)
5. Введите название языка (напр. `russian`) и нажмите **«Создать .rpy»**
6. Файлы сохраняются в папке `tl/` игры

---

## RPG Maker Patcher

Специализированный патчер для игр RPG Maker (MV, MZ, XP, VX, VX Ace). Читает файлы `.json` и `.rxdata`/`.rvdata` проекта.

### Функции

- **Определение версии**: автоматически определяет MV/MZ/XP/VX/Ace
- **Поддерживаемые файлы**: Actors, Classes, Skills, Items, Weapons, Armors, Enemies, Troops, States, Maps, CommonEvents, System
- **Статистика по файлам**: прогресс перевода по каждому файлу
- **Интеграция Translator++**: прямая ссылка на скачивание Translator++
- **Экспорт патча**: сохраняет переводы как JSON
- **Редактор**: полнотекстовый поиск, встроенное редактирование

### Как использовать

1. Перейдите в **RPG Maker Patcher** на боковой панели
2. Выберите папку проекта RPG Maker
3. Нажмите **«Извлечь строки»**
4. Переведите строки в редакторе
5. Нажмите **«Сохранить патч»**

---

## Wolf RPG Patcher

Специализированный патчер для игр Wolf RPG Editor. Обрабатывает бинарные файлы `.wolf` и карты игры.

### Функции

- **Поддерживаемые файлы**: Data/*.wolf (база данных), Map/*.mps (карты)
- **Типы строк**: База данных, Карта, Скрипт, Событие
- **Определение шифрования**: предупреждает если игра использует зашифрованные файлы
- **Интеграция WolfTrans**: рекомендует WolfTrans для зашифрованных файлов
- **Прогресс-бар**: процент завершения для всего проекта
- **Сохранить/Загрузить**: JSON для возобновления работы

### Как использовать

1. Перейдите в **Wolf RPG Patcher** на боковой панели
2. Выберите папку игры Wolf RPG
3. Нажмите **«Извлечь строки»**
4. Если игра зашифрована, следуйте инструкциям WolfTrans
5. Переведите строки и нажмите **«Сохранить»**

---

## Danganronpa Patcher

Специализированный патчер для серии игр Danganronpa. Обрабатывает архивы `.pak` и файлы локализации `.po`.

### Функции

- **Определение игры**: автоматически определяет DR1, DR2, V3
- **Архивы PAK**: извлекает и перечисляет файлы в архивах `.pak`
- **Файлы PO**: нативная поддержка `.po`/`.pot` со статусом переведено/не переведено/приблизительно
- **Встроенный AI-перевод**: кнопка для автоматического перевода с настроенным AI
- **Статистика PO**: количество переведённых, непереведённых, приблизительных и процент
- **Интеграция DRAT**: ссылка на инструмент DRAT для расширенных операций с архивами
- **Экспорт патча**: экспортирует изменённый файл `.po`

### Как использовать

1. Перейдите в **Danganronpa Patcher** на боковой панели
2. Выберите папку игры Danganronpa
3. Извлеките архив `.pak` или напрямую загрузите файл `.po`
4. Редактируйте строки в редакторе или используйте **«Перевести с AI»**
5. Экспортируйте завершённый файл `.po` для реимпорта в игру

---

## Сравнение нескольких LLM

Сравнение нескольких LLM отправляет один и тот же текст нескольким AI-провайдерам параллельно и автоматически выбирает лучший перевод.

### Поддерживаемые провайдеры

- **OpenAI** (GPT-4o)
- **Gemini** (Google)
- **Claude** (Anthropic)
- **DeepSeek**
- **Mistral**
- **DeepL**
- **Libre Translate**

### Функции

- **Параллельное сравнение**: одновременный перевод с 2–7 провайдерами
- **Автоматический выбор**: система выбирает перевод с наивысшей оценкой
- **Консенсусный перевод**: когда несколько моделей совпадают, генерируется комбинированная версия
- **Оценка качества**: каждый перевод получает оценку по плавности, точности, согласованности и стилю
- **Профили персонажей**: примените голосовой профиль для настройки тона и словарного запаса

### Как использовать

1. Перейдите в **Translator → Compare** на боковой панели
2. Введите исходный текст и выберите целевой язык
3. Выберите как минимум 2 провайдера из верхней панели
4. Нажмите **«Сравнить»** для запуска параллельных переводов
5. Просмотрите результаты с оценками и выберите предпочтительный перевод или используйте автоматически выбранный

---

## Оценка качества в реальном времени

Система оценки качества в реальном времени автоматически оценивает каждый перевод по нескольким измерениям, присваивая числовую оценку и категорию.

### Оцениваемые измерения

| Измерение | Описание |
|---|---|
| **Плавность** | Естественность и читаемость на целевом языке |
| **Точность** | Верность исходному значению |
| **Согласованность** | Терминологическая последовательность с остальным проектом |
| **Стиль** | Соответствие тона и регистра контексту игры |

### Категории оценок

- **Отлично** (90–100): перевод готов к публикации
- **Хорошо** (75–89): незначительные улучшения возможны
- **Приемлемо** (60–74): рекомендуется проверка
- **Требует доработки** (40–59): необходимы исправления
- **Плохо** (0–39): необходим повторный перевод

### Автоматические проверки

- Сохранение чисел и заполнителей (`{0}`, `%s` и т.д.)
- Согласованность длины относительно оригинала
- Обнаружение непереведённых слов
- Проверка пунктуации и форматирования

---

## Голосовые профили персонажей

Голосовые профили персонажей позволяют настраивать переводы на основе личности каждого персонажа в игре.

### Доступные архетипы

Hero, Villain, Mentor, Sidekick, Love Interest, Comic Relief, Mysterious Stranger, Noble, Pirate, Warrior, Wizard, Merchant, Child, Robot, Monster, Narrator — или **Custom**.

### Настраиваемые параметры

- **Личность**: архетип, черты характера, настроение, возраст, пол
- **Стиль речи**: формальность (очень формально → очень неформально), словарный запас (архаичный, изысканный, стандартный, простой, сленг, технический), длина предложений, пунктуация
- **Паттерны**: фразы-визитки, слова-паразиты, конечные суффиксы, слова для избегания, предпочтительные замены
- **TTS-голос** *(опционально)*: провайдер (OpenAI, ElevenLabs, Azure), голос, высота тона, скорость, эмоция
- **Примеры диалогов**: пары оригинал/перевод для направления AI

### Как использовать

1. Откройте **Character Profile Manager** из панели перевода
2. Выберите предустановленный архетип или создайте пользовательский профиль
3. Настройте личность, стиль, паттерны и словарный запас
4. Добавьте примеры диалогов для улучшения согласованности
5. Сохраните профиль — он будет автоматически применяться в будущих переводах для этого персонажа

---

## Конвейер голосового перевода

Конвейер голосового перевода преобразует произнесённое аудио в переведённый и синтезированный текст на другом языке в едином сквозном процессе.

### Этапы конвейера

1. **Запись / Загрузка**: запись аудио с микрофона или загрузка аудиофайла
2. **Транскрипция (Whisper)**: преобразование речи в текст через OpenAI Whisper
3. **AI-перевод**: перевод транскрибированного текста на целевой язык
4. **Синтез речи (TTS)**: генерация переведённого аудио с синтетическими голосами

### Доступные голоса

| Голос | Характеристика |
|---|---|
| **Nova** | Женский, естественный |
| **Alloy** | Нейтральный, универсальный |
| **Echo** | Мужской, тёплый |
| **Fable** | Повествовательный, выразительный |
| **Onyx** | Мужской, глубокий |
| **Shimmer** | Женский, яркий |

### Как использовать

1. Перейдите в **Voice Translator** на боковой панели
2. Запишите аудио с микрофона или загрузите файл `.wav`/`.mp3`
3. Система автоматически транскрибирует аудио с помощью Whisper
4. Выберите целевой язык и начните перевод
5. Выберите TTS-голос и сгенерируйте переведённое аудио
6. Воспроизведите или скачайте результат

> **Примечание**: Требуется настроенный ключ API OpenAI для Whisper и TTS.

---

## OCR Мульти-движок

OCR Мульти-движок поддерживает 4 OCR-движка с автоматическим обнаружением и интеллектуальным откатом для распознавания текста на скриншотах игр.

### Поддерживаемые движки

| Движок | Описание | Преимущества |
|---|---|---|
| **OneOCR** | Windows 11 AI нативный (порт 17231) | Стилизованные шрифты, наложенный текст, низкое разрешение |
| **PaddleOCR** | Baidu open-source (порт 8866) | Отличный CJK, вертикальный текст, высокая точность |
| **RapidOCR** | Лёгкая ONNX-обёртка (порт 9003) | Быстрый, лёгкий, простая установка |
| **Tesseract.js** | Встроен в браузер | Всегда доступен, 100+ языков, без настройки |

### Функции

- **Автоматическое обнаружение**: проверка доступных движков при запуске
- **Цепочка отката**: OneOCR → PaddleOCR → RapidOCR → Tesseract (CJK: PaddleOCR первым)
- **Режим сравнения**: запуск всех движков параллельно с использованием лучшего результата
- **Предобработка изображений**: оттенки серого, контраст, порог, масштабирование для мелкого текста
- **Предпочтительный движок**: сохранение настройки для будущих сессий

### Как использовать

1. Перейдите в **OCR Multi-Engine** на боковой панели
2. Нажмите **«Обнаружить движки»** для проверки доступных
3. Выберите предпочтительный движок, кликнув на соответствующую карточку
4. Загрузите скриншот или вставьте изображение
5. Система распознаёт текст выбранным движком (или автоматический откат)

---

## Ретро-игры OCR

Ретро-игры OCR — специализированный модуль для распознавания текста на скриншотах ретро-игр с пиксельными шрифтами.

### Доступные пресеты

| Пресет | Эпоха | Оптимизация |
|---|---|---|
| **8-bit** | NES, Game Boy, MSX | Масштабирование 4x, высокий порог, удаление дизеринга |
| **16-bit** | SNES, Mega Drive, PC Engine | Масштабирование 3x, средний контраст, повышение резкости |
| **DOS/PC** | DOS, EGA/VGA | Масштабирование 2x, средний порог, моноширинный шрифт |
| **PC-98** | NEC PC-98 (японский) | Масштабирование 3x, высокий порог, оптимизация CJK |
| **Early Windows** | Windows 3.1/95/98 | Масштабирование 2x, лёгкий контраст |

### Настраиваемые параметры

- **Масштабирование**: коэффициент увеличения (nearest-neighbor для сохранения пикселей)
- **Контраст**: усиление контраста перед распознаванием
- **Бинарный порог**: конвертация в чёрно-белое с настраиваемым порогом
- **Удаление дизеринга**: фильтрация паттернов дизеринга, типичных для ретро-игр
- **Резкость / Шумоподавление**: повышение резкости и снижение шума

### Как использовать

1. Откройте панель **Retro-Game OCR** в разделе OCR
2. Выберите пресет игры или настройте параметры вручную
3. Загрузите скриншот ретро-игры
4. Система предобработает изображение и применит оптимизированное распознавание
5. Проверьте и отредактируйте распознанный текст

---

## Адаптивный MT

Адаптивный MT (Адаптивный машинный перевод) — система, которая учится на человеческих исправлениях для постепенного улучшения качества переводов.

### Как это работает

1. **Сохранение исправлений**: при исправлении AI-перевода пара (оригинал → исправление) сохраняется
2. **Нечёткое сходство**: триграммы (коэффициент Дайса) + словарное сходство (Жаккар) для поиска релевантных исправлений
3. **Few-shot обучение**: наиболее похожие исправления вставляются в промпт как примеры
4. **Цикл обратной связи**: чем больше исправлений сохранено, тем лучше будущие переводы

### Функции

- **Автоопределение тегов**: tone_change, terminology, major_rewrite, length_change, punctuation, style
- **Контекстный буст**: приоритет исправлениям той же игры (1.3x), того же типа контента (1.2x), недавним исправлениям
- **Утверждение**: пометка исправлений как проверенных для повышения надёжности
- **Импорт/Экспорт**: экспорт и импорт наборов исправлений между проектами
- **Статистика**: количество исправлений по языку, игре, типу, тегу и среднему использованию

### Конфигурация

| Параметр | По умолчанию | Описание |
|---|---|---|
| **Макс. примеров** | 5 | Максимум few-shot примеров на промпт |
| **Порог сходства** | 0.2 | Минимальное сходство для включения примера |
| **Та же игра** | Да | Приоритет исправлениям той же игры |
| **Только утверждённые** | Нет | Использовать только утверждённые исправления |

---

## Пакетный переводчик папок

Пакетный переводчик папок переводит целые папки с файлами за одну операцию, сохраняя оригинальную структуру.

### Функции

- **Рекурсивное сканирование**: автоматическое сканирование подпапок
- **Мультиформат**: поддержка CSV, JSON, XML, PO, YAML, TXT, SRT, VTT и других
- **Умный выбор**: фильтрация по типу файла, размеру или шаблону
- **Гибкий вывод**: настраиваемая папка вывода с сохранённой структурой
- **Параллельный перевод**: до 3 одновременных пакетов для максимальной скорости
- **Translation Memory**: автоматическое использование и пополнение памяти переводов
- **Классификация контента**: классификация строк по типу (диалог, UI, система) перед переводом
- **Контроль качества**: автоматический QA с настраиваемым минимальным баллом
- **Пауза/Возобновление**: пауза и возобновление перевода в любое время

### Параметры

| Параметр | По умолчанию | Описание |
|---|---|---|
| **Размер пакета** | 40 | Строк за API-вызов |
| **Параллельных** | 3 | Одновременных пакетов |
| **Задержка** | 50мс | Пауза между пакетами |
| **Мин. балл** | 70 | Минимальный порог качества |
| **Макс. попыток** | 3 | Повторов при ошибке |

### Как использовать

1. Перейдите в **Batch Translator** на боковой панели
2. Выберите исходную папку с файлами для перевода
3. Выберите исходный язык, целевой язык и AI-провайдера
4. Настройте опции (TM, QA, классификация, конвейер)
5. Нажмите **«Запустить»** для начала пакетного перевода
6. Отслеживайте прогресс в реальном времени — можно приостановить или отменить

---

## Офлайн-переводчик

Офлайн-переводчик позволяет переводить тексты без подключения к интернету, используя локальные AI-модели через Ollama. Никакие данные не отправляются онлайн.

### Требования

- **Ollama** установлен и запущен (`ollama serve`)
- Загружена хотя бы одна модель перевода

### Рекомендуемые модели

| Модель | Размер | Описание |
|---|---|---|
| **huihui_ai/hy-mt1.5-abliterated:7b** | ~4.5 ГБ | Tencent HY-MT 1.5 — №1 WMT25, превосходит Google Translate в 30/31 языке |
| **huihui_ai/hy-mt1.5-abliterated:1.8b** | ~1.2 ГБ | Лёгкая и сверхбыстрая версия |
| **translategemma:12b** | ~8.0 ГБ | Google TranslateGemma — 55 языков, высокое качество |
| **translategemma:2b** | ~1.5 ГБ | Google TranslateGemma — 55 языков, быстрая и лёгкая |
| **qwen3:4b** | ~2.5 ГБ | Alibaba Qwen 3 — универсальная, хороша для перевода |

### Функции

- **Одиночный режим**: перевод одного текста за раз
- **Пакетный режим**: перевод нескольких текстов (по одному на строку) за одну операцию
- **14 поддерживаемых языков**: IT, EN, FR, DE, ES, PT, RU, JA, KO, ZH, PL, NL, TR, CS
- **Обмен языков**: смена исходного и целевого языка одним кликом
- **Выбор модели**: выберите из моделей, установленных в Ollama
- **История результатов**: все результаты отображаются со временем перевода
- **Копирование результатов**: копирование отдельного перевода или всех сразу
- **Встроенная настройка**: запуск Ollama и загрузка моделей прямо из интерфейса

### Как использовать

1. Перейдите в **Офлайн-переводчик** на боковой панели
2. Если Ollama не запущен, нажмите **«Запустить Ollama»** в панели настроек
3. Скачайте рекомендуемую модель (например, `hy-mt1.5-abliterated:7b`)
4. Выберите исходный и целевой язык
5. Введите текст и нажмите **«Перевести»** (или Ctrl+Enter)
6. Для пакетного режима: включите пакетный режим и введите несколько строк

---

## Переводчик манги/комиксов

Переводчик манги/комиксов — это специализированный инструмент для перевода комиксов и манги с автоматическим определением пузырей, OCR, переводом и инпейнтингом.

### Функции

- **Определение пузырей**: автоматически определяет текстовые пузыри на страницах
- **Встроенный OCR**: распознаёт текст внутри пузырей (горизонтальный и вертикальный)
- **Автоматический перевод**: переводит распознанный текст на целевой язык
- **Инпейнтинг**: удаляет оригинальный текст и заменяет его переводом
- **Стили шрифтов**: Manga Style, Comic Sans, Handwritten, Bold
- **Многостраничный**: управление несколькими страницами одновременно
- **Пакетный перевод**: обработка всех страниц по очереди
- **Экспорт**: экспорт отдельной страницы или всех переведённых страниц

### Поддерживаемые языки

JA (японский), ZH (китайский), KO (корейский), EN (английский), IT (итальянский), ES (испанский), FR (французский), DE (немецкий)

### Как использовать

1. Перейдите в **Manga Translator** на боковой панели
2. Загрузите страницы манги/комикса (перетаскивание или выбор файлов)
3. Выберите исходный и целевой язык
4. Нажмите **«Обнаружить и перевести»** для анализа текущей страницы
5. Проверьте обнаруженные пузыри и переводы
6. Нажмите **«Инпейнтинг»** для применения переводов на изображение
7. Экспортируйте переведённую страницу

---

## Переводчик текстур

Переводчик текстур переводит текст в текстурах видеоигр (меню, HUD, кнопки, UI), сохраняя графический стиль и форматирование.

### Поддерживаемые форматы

| Формат | Описание |
|---|---|
| **DDS** | DirectDraw Surface (самый распространённый в играх) |
| **PNG** | Portable Network Graphics |
| **TGA** | Targa |
| **BMP** | Bitmap |
| **JPG** | JPEG |
| **WebP** | WebP |

### Функции

- **Определение регионов**: сканирует текстуру для поиска областей с текстом
- **OCR для текстур**: распознаёт текст в обнаруженных регионах
- **Автоматический перевод**: переводит текст, сохраняя визуальный контекст
- **Сохранение стиля**: сохраняет цвета фона, цвет текста, шрифт и размер
- **Автоподбор шрифта**: автоматически выбирает наиболее похожий шрифт
- **Предпросмотр**: показывает предпросмотр текстуры до и после перевода
- **Пакетная обработка**: обрабатывает все текстуры по очереди
- **Экспорт**: экспорт отдельной текстуры или всех изменённых текстур

### Как использовать

1. Перейдите в **Texture Translator** на боковой панели
2. Загрузите текстуры (перетаскивание, выбор файлов или целая папка)
3. Выберите исходный и целевой язык
4. Нажмите **«Сканировать текстуру»** для обнаружения текстовых регионов
5. Проверьте и отредактируйте предложенные переводы
6. Нажмите **«Применить переводы»** для генерации переведённой текстуры
7. Экспортируйте изменённые текстуры

---

## Авто-глоссарий

Авто-глоссарий автоматически извлекает игровые термины из текстов с помощью LLM, сохраняет их в глоссарии для каждой игры и внедряет в промпты перевода для обеспечения терминологической согласованности.

### 3-уровневая система

| Уровень | Иконка | Поведение |
|---|---|---|
| **Locked** | 🔒 | Фиксированный перевод, никогда не изменяется AI |
| **Synced** | 🔄 | Предпочтительный перевод, AI может предложить альтернативы |
| **Flexible** | 🔓 | Предложенный перевод, AI выбирает лучший |

### Категории терминов

👤 Персонаж, 📍 Локация, 🎒 Предмет, ⚔️ Навык, 📜 Квест, 🖥️ UI, ⚙️ Система, 📚 Лор, 🐉 Существо, 🏰 Фракция, 📌 Другое

### Функции

- **Автоматическое извлечение**: анализирует игровые тексты с помощью LLM и извлекает ключевые термины
- **Стандартные термины**: автоматически добавляет общие игровые термины (HP, XP, NPC и т.д.)
- **Поиск и фильтр**: поиск по тексту, фильтрация по уровню или категории
- **Внедрение в промпты**: термины автоматически внедряются в промпты перевода
- **Не переводить**: пометка терминов, которые не должны переводиться
- **Чувствительность к регистру**: опция для терминов с учётом регистра (имена собственные)
- **Импорт/Экспорт**: экспорт и импорт глоссариев в формате CSV или JSON
- **Проверка согласованности**: проверяет единообразное использование терминов в переводах
- **Статистика**: количество терминов по уровню, категории и источнику (авто/ручной)

### Настройка

| Параметр | По умолчанию | Описание |
|---|---|---|
| **Включено** | Да | Включить/выключить авто-глоссарий |
| **Извлекать при первом пакете** | Да | Извлекает термины из первого переведённого пакета |
| **Макс терминов за извлечение** | 20 | Максимальное количество терминов за запуск |
| **Мин. уверенность** | 50 | Минимальный порог уверенности (0–100) |
| **Внедрять в промпты** | Да | Внедрять термины в промпты перевода |
| **Макс терминов в промпте** | 30 | Максимум терминов в промпте (ограничение контекстного окна) |

### Как использовать

1. Перейдите в **Глоссарий** на боковой панели
2. Создайте новый глоссарий, выбрав игру, исходный и целевой язык
3. Добавьте термины вручную или нажмите **«Извлечь термины»** для AI-извлечения
4. Настройте уровень (Locked/Synced/Flexible) и категорию для каждого термина
5. Термины автоматически внедряются в промпты перевода
6. Используйте **«Проверить согласованность»** для проверки единообразного использования терминов

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

## Новое в v1.4.1

### Полная поддержка GOG Galaxy

- **Чтение библиотеки GOG Galaxy 2.0**: читает принадлежащие игры из локальной базы SQLite
- **Обложки и описания через GOG API**: автоматическое получение изображений и деталей
- **Объединение с установленными играми**: комбинирует данные реестра с базой Galaxy
- **Ссылки магазина и загрузки**: страница Store с прямыми ссылками GOG Galaxy

### Улучшенная панель управления

- **Подключённые магазины вверху**: магазины теперь рядом с последней открытой игрой
- **Бейджи магазинов с реальными числами**: показывает фактическое количество игр
- **Заполнитель последней игры**: элегантное отображение когда игра не открыта

### Улучшенная детализация игры

- **Вкладка Инфо**: системные требования, оценка Metacritic, ссылки магазина, список DLC
- **Обложки GOG**: автоматический фолбэк для обложек GOG игр
- **Описания GOG**: полное описание через GOG API

### Исправления AI-провайдеров

- **Бесплатные провайдеры никогда не блокируются навсегда**: MyMemory, Lingva используют кулдаун (30с)
- **Steam Wishlist**: новый эндпоинт IWishlistService с фолбэком

### Производительность

- **Кеш sessionStorage**: мгновенная навигация назад из детали в библиотеку
- **Пакетное сохранение обложек**: с дебаунсом (2с) для предотвращения гонок
- **Дедупликация запросов SteamGridDB**: избегает дублированных запросов в StrictMode

### Кроссплатформенная сборка

- **Скрипт сборки Node.js**: `build-tauri-cross.js` заменяет скрипт PowerShell
- **Поддержка Linux**: GitHub Actions теперь собирает для Linux (.deb, .AppImage)
- **Windows**: установщик (.msi, .exe NSIS) и портативная версия (.zip)

### Документация

- **11 руководств пользователя**: исправления markdown lint
- **Исправленная нумерация**: упорядоченный индекс без пропусков

---

## Новое в v1.4.2

### Vision LLM Переводчик

- **Контекстно-зависимый перевод**: использует скриншоты игры для визуального контекста
- **3 поддерживаемых провайдера**: Ollama (локальный), Gemini 2.0 Flash, OpenAI GPT-4o
- **Загрузка или захват**: загрузите изображение или сделайте снимок экрана для контекста ИИ
- **Выделенная страница**: `/vision-translator` с интегрированной боковой панелью

### Продвинутые инструменты ИИ

- **Lore Assistant**: RAG-чат для исследования лора и диалогов игры
- **Auto-Hook Scanner**: сканирование памяти процессов через WinAPI
- **System Monitor**: мониторинг VRAM/RAM в реальном времени (Rust-бэкенд)
- **Ollama Setup Wizard**: пошаговая установка локального ИИ
- **Debug Console**: встроенная консоль отладки с перехватом логов
- **Plugin System**: проектный документ `PLUGIN_SYSTEM.md`

### Центр сообщества

- **GitHub Discussions**: 12 обсуждений создано в категориях Announcements, General, Ideas, Q&A, Show and tell, Polls
- **Публичный REST API**: Центр сообщества теперь загружает обсуждения без токена GitHub
- **Боковая панель переименована**: "Workshop" → "Steam Workshop"

### Исправления провайдеров перевода

- **Ollama cooldown**: сетевые ошибки теперь используют 30-секундный кулдаун вместо постоянной блокировки
- **Lingva 404**: автоматическое усечение текстов >500 символов (предотвращение слишком длинных URL)
- **Auto-Translate Review**: новая кнопка "Перевести все непереведённые" с прогресс-баром и остановкой
- **Tutorial querySelector**: исправлен SyntaxError с селекторами `:contains()` (нестандартный CSS)
- **Update Bell**: исправлена неправильная версия во всплывающем окне (удалён жёстко заданный фолбэк)

### CI/CD и безопасность

- **Tauri Signing Key**: настроена для автоматической генерации подписанного `latest.json`
- **GitHub Secrets**: настроены `TAURI_SIGNING_PRIVATE_KEY` и `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- **Workflow release.yml**: обновлён с переменными подписи для обоих заданий (Windows + Linux)

### Unity: Автоустановка BepInEx + XUnity AutoTranslator

- **Автоматическое обнаружение Unity**: если сканер не находит переводимых файлов в игре Unity, отображается специальная карточка вместо общей ошибки
- **Установка в один клик**: кнопка «Установить BepInEx + XUnity AutoTranslator» автоматически находит exe игры, устанавливает фреймворк и плагин перевода с журналами в реальном времени
- **Пошаговый процесс**: после установки предлагается запустить игру один раз и повторно со сканировать — все тексты становятся переводимыми
- **Авторство**: команда BepInEx и bbepis (XUnity AutoTranslator)

---

*GameStringer v1.4.2 - Руководство обновлено 03.03.2026*
