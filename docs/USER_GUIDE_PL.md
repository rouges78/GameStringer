# 📖 GameStringer - Kompletny Przewodnik Użytkownika

## Spis Treści

1. [Przegląd](#przegląd)
2. [Pierwsze uruchomienie i profile](#pierwsze-uruchomienie-i-profile)
3. [Biblioteka i szczegóły gry](#biblioteka-i-szczegóły-gry)
4. [Neural Translator Pro](#neural-translator-pro)
5. [Translation Wizard](#translation-wizard)
6. [Translation Bridge](#translation-bridge)
7. [Subtitle Translator Pro](#subtitle-translator-pro)
8. [Retro ROM Tools](#retro-rom-tools)
9. [Publiczne API v1](#publiczne-api-v1)
10. [Voice Clone Studio](#voice-clone-studio) *(NOWE v1.0.5)*
11. [VR Text Overlay](#vr-text-overlay) *(NOWE v1.0.5)*
12. [Quality Gates](#quality-gates) *(NOWE v1.0.5)*
13. [Player Feedback](#player-feedback) *(NOWE v1.0.5)*
14. [Nowi dostawcy AI v1.0.6](#nowi-dostawcy-ai-v106) *(NOWE v1.0.6)*
15. [Community Hub v1.0.7](#community-hub-v107) *(NOWE v1.0.7)*
16. [Ulepszenia UI v1.0.9](#ulepszenia-ui-v109) *(NOWE v1.0.9)*
17. [Danganronpa Auto-Tłumacz](#danganronpa-auto-tłumacz) *(NOWE v1.1.0)*
18. [Eksport patcha](#eksport-patcha)
19. [Zastosuj do gry](#zastosuj-do-gry)
20. [Zarządzanie kopiami zapasowymi](#zarządzanie-kopiami-zapasowymi)
21. [Edytor tłumaczeń](#edytor-tłumaczeń)
22. [Historia aktywności](#historia-aktywności)
23. [Słowniki](#słowniki)
24. [Rozwiązywanie problemów](#rozwiązywanie-problemów)
25. [Słownik terminologiczny](#słownik-terminologiczny)
26. [Context Harvester](#context-harvester)
27. [Pamięć tłumaczeniowa](#pamięć-tłumaczeniowa)
28. [Tłumacz OCR](#tłumacz-ocr)
29. [Prześgląd AI](#prześgląd-ai)
30. [Pipeline AI](#pipeline-ai)
31. [Tłumacz emocji](#tłumacz-emocji)
32. [Adaptacja kulturowa](#adaptacja-kulturowa)
33. [Mapa ciepła pewności](#mapa-ciepła-pewności)
34. [Zarządzanie blogiem](#zarządzanie-blogiem)
35. [Ren'Py Patcher](#renpy-patcher)
36. [RPG Maker Patcher](#rpg-maker-patcher)
37. [Wolf RPG Patcher](#wolf-rpg-patcher)
38. [Danganronpa Patcher](#danganronpa-patcher)
39. [Porównanie Multi-LLM](#porównanie-multi-llm) *(NOWE)*
40. [Ocena Jakości na Żywo](#ocena-jakości-na-żywo) *(NOWE)*
41. [Profile Głosowe Postaci](#profile-głosowe-postaci) *(NOWE)*
42. [Pipeline Tłumaczenia Głosowego](#pipeline-tłumaczenia-głosowego) *(NOWE)*
43. [OCR Multi-Silnik](#ocr-multi-silnik) *(NOWE)*
44. [OCR Gier Retro](#ocr-gier-retro) *(NOWE)*
45. [Adaptacyjne MT](#adaptacyjne-mt) *(NOWE)*
46. [Batch Tłumacz Folderów](#batch-tłumacz-folderów) *(NOWE)*
47. [Tłumacz Offline](#tłumacz-offline) *(NOWE)*
48. [Tłumacz Manga/Komiks](#tłumacz-mangakomiks) *(NOWE)*
49. [Tłumacz Tekstur](#tłumacz-tekstur) *(NOWE)*
50. [Auto-Słownik](#auto-słownik) *(NOWE)*

---

## Przegląd

GameStringer to zaawansowany system do automatycznego i ręcznego tłumaczenia gier wideo. Obsługuje:

- **Silniki gier**: Unity, Unreal Engine, RPG Maker, Ren'Py, Godot, Telltale, Wolf RPG, Kirikiri i inne
- **Formaty plików**: CSV, JSON, XML, PO/POT, YAML, TXT, SRT, VTT, ASS/SSA i inne
- **Dostawcy AI**: Claude, Gemini, GPT, DeepSeek, Mistral, Groq, Ollama, **Qwen 3**, **NLLB-200** (18+ dostawców)
- **Języki**: 200+ obsługiwanych języków (z NLLB-200)
- **Wielojęzyczny interfejs**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL (11 języków)
- **Sklepy z grami**: Steam, Epic Games, GOG, Origin, Battle.net, Ubisoft, itch.io, Amazon Games
- **NOWE v1.0.5**: Voice Clone Studio, VR Text Overlay, Quality Gates, Player Feedback
- **NOWE v1.0.6**: Qwen 3 (języki azjatyckie), NLLB-200 (200 języków), poprawki błędów
- **NOWE v1.0.7**: Community Hub, GitHub Discussions, Licencja v1.1
- **NOWE v1.0.8**: Poprawka pobierania aktualizacji
- **NOWE v1.0.9**: Animowane nagłówki, powiadomienia o aktualizacjach, ulepszenia UI
- **NOWE v1.4.0**: Zunifikowany Radix UI, Quality Badges na wiersz, obsługa RTL, uniwersalny Ollama, porządki TypeScript
- **NOWE v1.4.1**: Pełne GOG Galaxy, ulepszony dashboard, zakładka Info, poprawki dostawców AI, build Linux

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

## Słownik terminologiczny

Słownik terminologiczny zarządza niestandardowymi słownikami terminologii dla każdej gry, zapewniając spójność tłumaczeń.

### Funkcje

- **Poziomy terminów**:
  - 🔴 **Locked** — termin zawsze tłumaczony identycznie (nazwy własne, zaklęcia, miejsca)
  - 🟡 **Synced** — spójne tłumaczenie, adaptowalne do kontekstu
  - 🟢 **Flexible** — swobodne tłumaczenie
- **Kategorie**: postać, miejsce, przedmiot, umiejętność, quest, UI, system, lore, stworzenie, frakcja
- **Auto-ekstrakcja**: analiza AI w celu zaproponowania terminów
- **Sprawdzanie spójności**: weryfikuje jednolite tłumaczenie we wszystkich plikach
- **Import/Eksport**: CSV i JSON do udostępniania słowników między grami

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Słownik terminologiczny**
2. Wybierz grę z listy
3. Dodaj terminy ręcznie lub użyj **„Wyodrębnij terminy”** dla propozycji AI
4. Ustaw poziom dla każdego terminu
5. Słownik jest stosowany automatycznie podczas tłumaczeń

---

## Context Harvester

Analizuje ciągi tekstowe, klasyfikuje je i wzbogaca kontekstem przed tłumaczeniem AI, poprawiając jakość.

### Funkcje

- **Automatyczna klasyfikacja**: identyfikuje typ ekranu (menu, dialog, narracja, tutorial, system)
- **Rozpoznawanie mówiącego**: wnioskuje kto mówi i typ tonu (formalny, potoczny, agresywny)
- **Metadane kontekstowe**: każdy ciąg otrzymuje gatunek gry, typ treści i ton
- **Zapisywanie harvestów**: wyodrębnione konteksty zapisywane i ponownie używane
- **Przetwarzanie wsadowe**: analizuje całe pliki w jednej operacji

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Context Harvester**
2. Wklej ciągi lub załaduj plik
3. Kliknij **„Analizuj”** aby sklasyfikować każdy ciąg
4. Pobierz wynik JSON jako dane wejściowe dla tłumaczeń AI

---

## Pamięć tłumaczeniowa

Trwała baza danych wszystkich ukończonych tłumaczeń z automatycznym ponownym użyciem.

### Funkcje

- **Automatyczne ponowne użycie**: już przetłumaczone ciągi są sugerowane bez nowego wywołania AI
- **Wyszukiwanie**: po tekście oryginalnym, tłumaczeniu lub nazwie gry
- **Filtr gry**: wyświetla tylko tłumaczenia określonego tytułu
- **Statystyki**: łączne jednostki, rozkład według gry, data ostatniej modyfikacji
- **Eksport**: JSON, CSV, TMX dla innych narzędzi CAT
- **Import**: importuje istniejące tłumaczenia z TMX lub CSV

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Pamięć tłumaczeniowa**
2. Wyszukaj poprzednie tłumaczenia paskiem wyszukiwania
3. Edytuj lub usuń pojedyncze jednostki w razie potrzeby
4. Pamięć jest automatycznie konsultowana podczas tłumaczeń AI

---

## Tłumacz OCR

Przechwytuje tekst z dowolnego okna gry lub zrzutu ekranu w czasie rzeczywistym i tłumaczy go natychmiast.

### Funkcje

- **Przechwytywanie w czasie rzeczywistym**: analizuje ekran w konfigurowalnych odstępach
- **Języki źródłowe**: japoński, angielski, chiński uproszczony, koreański
- **Wybór okna**: wskazuje bezpośrednio na okno gry
- **Wybór regionu**: definiuje określony obszar ekranu do analizy
- **Pewność**: pokazuje poziom niezawodności dla każdego wykrytego tekstu
- **Globalny skrót**: włącza/wyłącza przechwytywanie skrótem klawiaturowym
- **Pamięć podręczna tłumaczeń**: ponownie używa poprzednich tłumaczeń dla identycznych ciągów

### Jak używać

1. Przejdź do **Tłumacz OCR** z paska bocznego
2. Wybierz język źródłowy gry
3. Kliknij **„Wybierz okno”** i wybierz okno gry
4. *(Opcjonalnie)* Ustaw określony region przez **„Wybierz region”**
5. Naciśnij **„Start”** aby rozpocząć automatyczne przechwytywanie i tłumaczenie

---

## Prześgląd AI

Automatyczny prześgląd jakości tłumaczeń z wykrywaniem błędów i sugestiami korekt.

### Funkcje

- **Tryb pojedynczy**: prześgląd jednej pary oryginał/tłumaczenie
- **Tryb wsadowy**: masowy prześgląd w formacie `oryginał|tłumaczenie` na wiersz
- **Kategorie problemów**: dokładność, płynność, terminologia, ton, struktura
- **Poziomy ważności**: krytyczny, ostrzeżenie, informacja
- **Auto-fix**: automatyczna korekta drobnych problemów
- **Statystyki**: globalny wynik 0–100 dla każdej partii

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Prześgląd AI**
2. Wybierz **Pojedynczy** lub **Wsadowy**
3. Wklej oryginalny tekst i tłumaczenie
4. Kliknij **„Przejrzyj”** aby otrzymać raport
5. Użyj **„Auto-fix”** aby zastosować sugerowane korekty

---

## Pipeline AI

Zautomatyzowany 6-etapowy przepływ pracy dla tłumaczeń najwyższej jakości jednym kliknięciem.

### Etapy Pipeline

1. **Harvest** — wyodrębnia i klasyfikuje kontekst
2. **Translate** — tłumaczy ze skonfigurowanym dostawcą AI
3. **QA Check** — automatyczna weryfikacja jakości
4. **Auto-Fix** — koryguje znalezione problemy
5. **Review** — końcowy prześgląd AI
6. **Score** — oblicza końcowy wynik 0–100

### Dostępne ustawienia wstępne

- **Quick** — niezbędne etapy (Translate + QA Check)
- **Max Quality** — wszystkie 6 etapów po kolei

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Pipeline AI**
2. Wklej ciągi do przetłumaczenia
3. Wybierz ustawienie wstępne lub skonfiguruj etapy ręcznie
4. Kliknij **„Uruchom Pipeline”**
5. Pobierz końcowy raport z wynikami dla każdego ciągu

---

## Tłumacz emocji

Tłumaczenie analizujące i zachowujące emocje obecne w oryginalnym dialogu.

### Funkcje

- **Analiza emocji**: wykrywa dominującą emocję (gniew, smutek, strach, radość, neutralna, zaskoczenie, wstręt)
- **Intensywność**: mierzy poziom intensywności emocjonalnej (0–100)
- **Zachowanie tonu**: prowadzi AI do utrzymania tego samego emocjonalnego wpływu
- **EmotionBadge**: wizualna etykieta dla każdego ciągu z emocją i intensywnością
- **Statystyki wsadowe**: rozkład emocji w całym pliku

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Tłumacz emocji**
2. Wklej tekst do przetłumaczenia
3. Wybierz język docelowy
4. Kliknij **„Analizuj i tłumacz”**
5. Wynik pokazuje tłumaczenie z zidentyfikowanymi emocjami dla każdego ciągu

---

## Adaptacja kulturowa

Analizuje przetłumaczony tekst w celu identyfikacji kulturowo problematycznych elementów i proponuje adaptacje.

### Funkcje

- **Obsługiwane kultury**: IT, EN, DE, FR, ES, JA, KO, ZH, PT, RU
- **Analizowane kategorie**: wyrażenia idiomatyczne, odniesienia kulturowe, miary/waluty, symboliczne kolory, formuły grzecznościowe, humor
- **Konkretne sugestie**: dla każdego elementu proponuje alternatywę dopasowaną do kultury docelowej
- **Wynik adaptacji**: odsetek tekstu wymagający przeglądu

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Adaptacja kulturowa**
2. Wklej przetłumaczony tekst
3. Wybierz kulturę źródłową i docelową
4. Kliknij **„Analizuj”**
5. Zastosuj sugestie przed ostateczną publikacją

---

## Mapa ciepła pewności

Wizualizuje jakość każdego tłumaczenia za pomocą mapy zakodowanej kolorami, natychmiast identyfikując problematyczne ciągi.

### Funkcje

- **8 analizowanych metryk**: brakujące symbole zastępcze, puste ciągi, nieprzetłumaczone, interpunkcja, wielkie litery, tagi HTML, długość, liczby
- **Kod kolorów**:
  - 🟢 **Doskonały** (90–100%) — poprawne tłumaczenie
  - 🔵 **Dobry** (75–89%) — drobne problemy stylistyczne
  - 🟡 **Akceptowalny** (60–74%) — drobne problemy
  - 🟠 **Do sprawdzenia** (40–59%) — poważne błędy
  - 🔴 **Słaby** (<40%) — krytyczne błędy
- **3 tryby wprowadzania**: wbudowana demonstracja, wklejenie tekstu (`oryginał|tłumaczenie` na wiersz), wczytanie pliku (JSON/CSV/TXT)
- **Eksport raportu**: pobierz JSON z wynikami i problemami dla każdego ciągu

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Mapa ciepła pewności**
2. Wybierz tryb: **Demo** aby zobaczyć przykład, **Wklej** do ręcznego wprowadzenia, **Plik** do wczytania
3. Kliknij **"Analizuj"**
4. Przejrzyj raport kolorów: czerwone/pomarańczowe ciągi wymagają priorytetowej weryfikacji
5. Użyj **"Eksportuj raport"** aby zapisać wynik w JSON

---

## Zarządzanie blogiem

Zarządza blogiem aktualnosci i aktualizacji dla projektu tłumaczenia, widocznym na pulpicie nawigacyjnym.

### Funkcje

- **Tworzenie wpisów**: tytuł, data, krótki opis, tag kategorii
- **Dostępne tagi**: Feature, UI, Fix, Security, AI, Update, News
- **Przypinanie**: przypina ważne wpisy na górze listy
- **Edycja w miejscu**: edytuj dowolny wpis bez zmiany strony
- **Usuwanie wpisu**: usunięcie z potwierdzeniem
- **Wyświetlanie**: lista chronologiczna ze stylizowaną datą, kolorowym znacznikiem tagu i podglądem opisu

### Jak używać

1. Przejdź do **Zarządzanie blogiem** z menu głównego
2. Kliknij **"Nowy wpis"**
3. Wypełnij datę (np. "24 Sty"), tytuł (z zalecanymi emoji), opis i tag
4. Kliknij **"Zapisz"**
5. Użyj ikony 📌 aby przypiąć wpis na górze

---

## Ren'Py Patcher

Dedykowany patcher dla powieści wizualnych zbudowanych na silniku Ren'Py. Wyodrębnia dialogi, menu i narrację z plików `.rpy` i generuje natywne pliki tłumaczeń.

### Funkcje

- **Automatyczne wykrywanie**: identyfikuje tytuł, wersję i pliki skryptów gry
- **Typy ciągów**: Dialog, Menu, Narracja
- **Identyfikacja postaci**: pokazuje która postać mówi każdą kwestie
- **Edytor w miejscu**: kliknij ciąg aby edytować tłumaczenie
- **Wyszukiwanie i filtrowanie**: szukaj po tekście lub postaci, filtruj po typie
- **Generowanie plików `.rpy`**: tworzy strukturę `tl/<język>/` kompatyblną z Ren'Py
- **Zapisz/Wczytaj JSON**: zapisz postęp i kontynuuj później
- **Statystyki**: procent ukończenia, liczba według typu

### Jak używać

1. Przejdź do **Ren'Py Patcher** na pasku bocznym
2. Kliknij **"Przeglądaj"** i wybierz folder gry Ren'Py
3. Kliknij **"Wyodrębnij ciągi"**
4. Edytuj tłumaczenia w edytorze (kliknij ciąg aby go edytować)
5. Wprowadź nazwę docelowego języka (np. `polish`) i kliknij **"Generuj .rpy"**
6. Pliki są zapisywane w folderze `tl/` gry

---

## RPG Maker Patcher

Dedykowany patcher dla gier RPG Maker (MV, MZ, XP, VX, VX Ace). Odczytuje pliki `.json` i `.rxdata`/`.rvdata` projektu.

### Funkcje

- **Wykrywanie wersji**: automatycznie identyfikuje MV/MZ/XP/VX/Ace
- **Obsługiwane pliki**: Actors, Classes, Skills, Items, Weapons, Armors, Enemies, Troops, States, Maps, CommonEvents, System
- **Statystyki per plik**: postęp tłumaczenia podzielony według pliku
- **Integracja Translator++**: bezpośredni link do pobrania Translator++
- **Eksport patcha**: zapisuje tłumaczenia jako JSON
- **Edytor**: wyszukiwanie pełnotekstowe, edycja w miejscu

### Jak używać

1. Przejdź do **RPG Maker Patcher** na pasku bocznym
2. Wybierz folder projektu RPG Maker
3. Kliknij **"Wyodrębnij ciągi"**
4. Przetłumacz ciągi w edytorze
5. Kliknij **"Zapisz patcha"**

---

## Wolf RPG Patcher

Dedykowany patcher dla gier Wolf RPG Editor. Obsługuje binarne pliki `.wolf` i mapy gry.

### Funkcje

- **Obsługiwane pliki**: Data/*.wolf (baza danych), Map/*.mps (mapy)
- **Typy ciągów**: Baza danych, Mapa, Skrypt, Zdarzenie
- **Wykrywanie szyfrowania**: ostrzega jeśli gra używa zaszyfrowanych plików
- **Integracja WolfTrans**: sugeruje WolfTrans dla zaszyfrowanych plików
- **Pasek postępu**: procent ukończenia dla całego projektu
- **Zapisz/Wczytaj**: JSON do wznowienia pracy

### Jak używać

1. Przejdź do **Wolf RPG Patcher** na pasku bocznym
2. Wybierz folder gry Wolf RPG
3. Kliknij **"Wyodrębnij ciągi"**
4. Jeśli gra jest zaszyfrowana, postępuj zgodnie z instrukcjami WolfTrans
5. Przetłumacz ciągi i kliknij **"Zapisz"**

---

## Danganronpa Patcher

Dedykowany patcher dla serii gier Danganronpa. Obsługuje archiwa `.pak` i pliki lokalizacji `.po`.

### Funkcje

- **Wykrywanie gry**: automatycznie identyfikuje DR1, DR2, V3
- **Archiwa PAK**: wyodrębnia i wylistowuje pliki w archiwach `.pak`
- **Pliki PO**: natywna obsługa `.po`/`.pot` ze statusem przetłumaczony/nieprzetłumaczony/przybliżony
- **Wbudowane tłumaczenie AI**: przycisk do automatycznego tłumaczenia skonfigurowanym AI
- **Statystyki PO**: liczba przetłumaczonych, nieprzetłumaczonych, przybliżonych i procent
- **Integracja DRAT**: link do narzędzia DRAT dla zaawansowanych operacji na archiwach
- **Eksport patcha**: eksportuje zmodyfikowany plik `.po`

### Jak używać

1. Przejdź do **Danganronpa Patcher** na pasku bocznym
2. Wybierz folder gry Danganronpa
3. Wyodrębnij archiwum `.pak` lub załaduj bezpośrednio plik `.po`
4. Edytuj ciągi w edytorze lub użyj **"Tłumacz za pomocą AI"**
5. Wyeksportuj ukończony plik `.po` aby zaimportować go z powrotem do gry

---

## Porównanie Multi-LLM

Porównanie Multi-LLM wysyła ten sam tekst do wielu dostawców AI równolegle i automatycznie wybiera najlepsze tłumaczenie.

### Obsługiwani dostawcy

- **OpenAI** (GPT-4o)
- **Gemini** (Google)
- **Claude** (Anthropic)
- **DeepSeek**
- **Mistral**
- **DeepL**
- **Libre Translate**

### Funkcje

- **Porównanie równoległe**: jednoczesne tłumaczenie z 2–7 dostawcami
- **Automatyczny wybór**: system wybiera tłumaczenie z najwyższą oceną
- **Tłumaczenie konsensusowe**: gdy kilka modeli się zgadza, generowana jest wersja łączona
- **Ocena jakości**: każde tłumaczenie otrzymuje ocenę płynności, dokładności, spójności i stylu
- **Profile postaci**: zastosuj profil głosowy, aby dostosować ton i słownictwo

### Jak używać

1. Przejdź do **Translator → Compare** na pasku bocznym
2. Wprowadź tekst źródłowy i wybierz język docelowy
3. Wybierz co najmniej 2 dostawców z górnego paska
4. Kliknij **„Porównaj"** aby uruchomić tłumaczenia równoległe
5. Przejrzyj wyniki z ocenami i wybierz preferowane tłumaczenie lub użyj automatycznie wybranego

---

## Ocena Jakości na Żywo

System Oceny Jakości na Żywo automatycznie ocenia każde tłumaczenie w wielu wymiarach, przypisując ocenę liczbową i kategorię.

### Oceniane wymiary

| Wymiar | Opis |
|---|---|
| **Płynność** | Naturalność i czytelność w języku docelowym |
| **Dokładność** | Wierność oryginalnemu znaczeniu |
| **Spójność** | Konsekwencja terminologiczna z resztą projektu |
| **Styl** | Odpowiedniość tonu i rejestru dla kontekstu gry |

### Kategorie ocen

- **Doskonałe** (90–100): tłumaczenie gotowe do publikacji
- **Dobre** (75–89): drobne opcjonalne ulepszenia
- **Akceptowalne** (60–74): zalecany przegląd
- **Do poprawki** (40–59): wymagane korekty
- **Słabe** (0–39): wymagane ponowne tłumaczenie

### Automatyczne kontrole

- Zachowanie liczb i symboli zastępczych (`{0}`, `%s` itp.)
- Spójność długości w stosunku do oryginału
- Wykrywanie nieprzetłumaczonych słów
- Weryfikacja interpunkcji i formatu

---

## Profile Głosowe Postaci

Profile Głosowe Postaci pozwalają dostosować tłumaczenia na podstawie osobowości każdej postaci w grze.

### Dostępne archetypy

Hero, Villain, Mentor, Sidekick, Love Interest, Comic Relief, Mysterious Stranger, Noble, Pirate, Warrior, Wizard, Merchant, Child, Robot, Monster, Narrator — lub **Custom**.

### Konfigurowalne parametry

- **Osobowość**: archetyp, cechy charakteru, nastrój, wiek, płeć
- **Styl mowy**: formalność (bardzo formalny → bardzo nieformalny), słownictwo (archaiczne, wyszukane, standardowe, proste, slang, techniczne), długość zdań, interpunkcja
- **Wzorce**: hasła, słowa wypełniające, przyrostki końcowe, słowa do unikania, preferowane zamiany
- **Głos TTS** *(opcjonalnie)*: dostawca (OpenAI, ElevenLabs, Azure), głos, wysokość tonu, prędkość, emocja
- **Przykłady dialogów**: pary oryginał/tłumaczenie do kierowania AI

### Jak używać

1. Otwórz **Character Profile Manager** z panelu tłumaczenia
2. Wybierz predefiniowany archetyp lub utwórz niestandardowy profil
3. Skonfiguruj osobowość, styl, wzorce i słownictwo
4. Dodaj przykłady dialogów dla poprawy spójności
5. Zapisz profil — będzie automatycznie stosowany w przyszłych tłumaczeniach dla tej postaci

---

## Pipeline Tłumaczenia Głosowego

Pipeline Tłumaczenia Głosowego przekształca mówione audio w przetłumaczony i zsyntezowany tekst w innym języku, w jednym przepływie od początku do końca.

### Etapy pipeline

1. **Nagrywanie / Upload**: nagrywanie audio z mikrofonu lub przesyłanie pliku audio
2. **Transkrypcja (Whisper)**: konwersja mowy na tekst przez OpenAI Whisper
3. **Tłumaczenie AI**: tłumaczenie transkrybowanego tekstu na język docelowy
4. **Synteza mowy (TTS)**: generowanie przetłumaczonego audio z głosami syntetycznymi

### Dostępne głosy

| Głos | Charakterystyka |
|---|---|
| **Nova** | Kobiecy, naturalny |
| **Alloy** | Neutralny, wszechstronny |
| **Echo** | Męski, ciepły |
| **Fable** | Narracyjny, ekspresyjny |
| **Onyx** | Męski, głęboki |
| **Shimmer** | Kobiecy, jasny |

### Jak używać

1. Przejdź do **Voice Translator** na pasku bocznym
2. Nagraj audio mikrofonem lub prześlij plik `.wav`/`.mp3`
3. System automatycznie transkrybuje audio za pomocą Whisper
4. Wybierz język docelowy i rozpocznij tłumaczenie
5. Wybierz głos TTS i wygeneruj przetłumaczone audio
6. Odtwórz lub pobierz wynik

> **Uwaga**: Wymaga skonfigurowanego klucza API OpenAI dla Whisper i TTS.

---

## OCR Multi-Silnik

OCR Multi-Silnik obsługuje 4 silniki OCR z automatycznym wykrywaniem i inteligentnym fallbackiem do rozpoznawania tekstu ze zrzutów ekranu gier.

### Obsługiwane silniki

| Silnik | Opis | Mocne strony |
|---|---|---|
| **OneOCR** | Windows 11 AI natywny (port 17231) | Stylizowane czcionki, nałożony tekst, niska rozdzielczość |
| **PaddleOCR** | Baidu open-source (port 8866) | Doskonałe CJK, tekst pionowy, wysoka dokładność |
| **RapidOCR** | Lekki wrapper ONNX (port 9003) | Szybki, lekki, łatwa instalacja |
| **Tesseract.js** | Zintegrowany z przeglądarką | Zawsze dostępny, 100+ języków, bez konfiguracji |

### Funkcje

- **Automatyczne wykrywanie**: sondowanie dostępnych silników przy starcie
- **Łańcuch fallback**: OneOCR → PaddleOCR → RapidOCR → Tesseract (CJK: PaddleOCR pierwszy)
- **Tryb porównania**: uruchomienie wszystkich silników równolegle i użycie najlepszego wyniku
- **Przetwarzanie wstępne obrazu**: skala szarości, kontrast, próg, skalowanie dla małego tekstu
- **Preferowany silnik**: zapisywanie preferencji na przyszłe sesje

### Jak używać

1. Przejdź do **OCR Multi-Engine** na pasku bocznym
2. Kliknij **„Wykryj silniki"** aby sprawdzić, które są online
3. Wybierz preferowany silnik klikając odpowiednią kartę
4. Prześlij zrzut ekranu lub wklej obraz
5. System rozpoznaje tekst wybranym silnikiem (lub automatyczny fallback)

---

## OCR Gier Retro

OCR Gier Retro to wyspecjalizowany moduł do rozpoznawania tekstu ze zrzutów ekranu gier retro z pikselowymi czcionkami.

### Dostępne presety

| Preset | Era | Optymalizacja |
|---|---|---|
| **8-bit** | NES, Game Boy, MSX | Skalowanie 4x, wysoki próg, usuwanie ditheringu |
| **16-bit** | SNES, Mega Drive, PC Engine | Skalowanie 3x, średni kontrast, wyostrzanie |
| **DOS/PC** | DOS, EGA/VGA | Skalowanie 2x, średni próg, czcionka o stałej szerokości |
| **PC-98** | NEC PC-98 (japoński) | Skalowanie 3x, wysoki próg, optymalizacja CJK |
| **Early Windows** | Windows 3.1/95/98 | Skalowanie 2x, lekki kontrast |

### Konfigurowalne parametry

- **Skalowanie**: współczynnik powiększenia (nearest-neighbor dla zachowania pikseli)
- **Kontrast**: wzmocnienie kontrastu przed rozpoznawaniem
- **Próg binarny**: konwersja czarno-biała z konfigurowalnym progiem
- **Usuwanie ditheringu**: filtrowanie wzorców ditheringu typowych dla gier retro
- **Wyostrzanie / Odszumianie**: wyostrzanie i redukcja szumu

### Jak używać

1. Otwórz panel **Retro-Game OCR** w sekcji OCR
2. Wybierz preset gry lub skonfiguruj parametry ręcznie
3. Prześlij zrzut ekranu gry retro
4. System wstępnie przetwarza obraz i stosuje zoptymalizowane rozpoznawanie
5. Sprawdź i edytuj rozpoznany tekst

---

## Adaptacyjne MT

Adaptacyjne MT (Adaptacyjne Tłumaczenie Maszynowe) to system, który uczy się z ludzkich poprawek, aby stopniowo poprawiać jakość tłumaczeń.

### Jak to działa

1. **Zapisywanie poprawek**: gdy poprawiasz tłumaczenie AI, para (oryginał → poprawka) jest zapisywana
2. **Rozmyte podobieństwo**: trigramy (współczynnik Dice'a) + podobieństwo słów (Jaccard) do znajdowania trafnych poprawek
3. **Few-shot learning**: najbardziej podobne poprawki do bieżącego tekstu są wstrzykiwane do promptu jako przykłady
4. **Pętla zwrotna**: im więcej poprawek zapiszesz, tym lepsze będą przyszłe tłumaczenia

### Funkcje

- **Auto-wykrywanie tagów**: tone_change, terminology, major_rewrite, length_change, punctuation, style
- **Boost kontekstowy**: priorytet dla poprawek z tej samej gry (1.3x), tego samego typu treści (1.2x), ostatnich poprawek
- **Zatwierdzanie**: oznaczanie poprawek jako zweryfikowanych dla wyższej niezawodności
- **Import/Eksport**: eksport i import zestawów poprawek między projektami
- **Statystyki**: liczba poprawek wg języka, gry, typu, tagu i średniego użycia

### Konfiguracja

| Parametr | Domyślnie | Opis |
|---|---|---|
| **Maks. przykładów** | 5 | Maksimum przykładów few-shot na prompt |
| **Próg podobieństwa** | 0.2 | Minimum podobieństwa do włączenia przykładu |
| **Ta sama gra** | Tak | Preferuj poprawki z tej samej gry |
| **Tylko zatwierdzone** | Nie | Używaj tylko zatwierdzonych poprawek |

---

## Batch Tłumacz Folderów

Batch Tłumacz Folderów tłumaczy całe foldery plików w jednej operacji, zachowując oryginalną strukturę.

### Funkcje

- **Skanowanie rekurencyjne**: automatyczne skanowanie podfolderów
- **Wiele formatów**: obsługa CSV, JSON, XML, PO, YAML, TXT, SRT, VTT i więcej
- **Inteligentny wybór**: filtrowanie wg typu pliku, rozmiaru lub wzorca
- **Elastyczne wyjście**: konfigurowalny folder wyjściowy z zachowaną strukturą
- **Tłumaczenie równoległe**: do 3 równoczesnych batchy dla maksymalnej szybkości
- **Translation Memory**: automatyczne używanie i zasilanie pamięci tłumaczeniowej
- **Klasyfikacja treści**: klasyfikacja ciągów wg typu (dialog, UI, system) przed tłumaczeniem
- **Kontrola jakości**: automatyczne QA z konfigurowalnym minimalnym wynikiem
- **Pauza/Wznowienie**: pauzuj i wznawiaj tłumaczenie w dowolnym momencie

### Parametry

| Parametr | Domyślnie | Opis |
|---|---|---|
| **Rozmiar batcha** | 40 | Ciągów na wywołanie API |
| **Równoległe** | 3 | Jednoczesne batche |
| **Opóźnienie** | 50ms | Przerwa między batchami |
| **Min. wynik** | 70 | Minimalny próg jakości |
| **Maks. prób** | 3 | Ponowne próby w przypadku błędu |

### Jak używać

1. Przejdź do **Batch Translator** na pasku bocznym
2. Wybierz folder źródłowy z plikami do tłumaczenia
3. Wybierz język źródłowy, docelowy i dostawcę AI
4. Skonfiguruj opcje (TM, QA, klasyfikacja, pipeline)
5. Kliknij **„Rozpocznij"** aby rozpocząć tłumaczenie batch
6. Monitoruj postęp w czasie rzeczywistym — możesz wstrzymać lub anulować

---

## Tłumacz Offline

Tłumacz Offline pozwala tłumaczyć teksty bez połączenia z internetem, używając lokalnych modeli AI przez Ollama. Żadne dane nie są wysyłane online.

### Wymagania

- **Ollama** zainstalowany i uruchomiony (`ollama serve`)
- Co najmniej jeden model tłumaczeniowy pobrany

### Polecane modele

| Model | Rozmiar | Opis |
|---|---|---|
| **huihui_ai/hy-mt1.5-abliterated:7b** | ~4.5 GB | Tencent HY-MT 1.5 — #1 WMT25, bije Google Translate w 30/31 językach |
| **huihui_ai/hy-mt1.5-abliterated:1.8b** | ~1.2 GB | Lekka i ultraszybka wersja |
| **translategemma:12b** | ~8.0 GB | Google TranslateGemma — 55 języków, wysoka jakość |
| **translategemma:2b** | ~1.5 GB | Google TranslateGemma — 55 języków, szybki i lekki |
| **qwen3:4b** | ~2.5 GB | Alibaba Qwen 3 — ogólnego przeznaczenia, dobry do tłumaczeń |

### Funkcje

- **Tryb pojedynczy**: tłumacz jeden tekst naraz
- **Tryb batch**: tłumacz wiele tekstów (jeden na linię) w jednej operacji
- **14 obsługiwanych języków**: IT, EN, FR, DE, ES, PT, RU, JA, KO, ZH, PL, NL, TR, CS
- **Zamiana języków**: zamień źródłowy i docelowy jednym kliknięciem
- **Wybór modelu**: wybierz spośród modeli zainstalowanych w Ollama
- **Historia wyników**: wszystkie wyniki wyświetlane z czasem tłumaczenia
- **Kopiowanie wyników**: kopiuj pojedyncze tłumaczenie lub wszystkie razem
- **Zintegrowana konfiguracja**: uruchom Ollama i pobieraj modele bezpośrednio z interfejsu

### Jak używać

1. Przejdź do **Tłumacz Offline** w pasku bocznym
2. Jeśli Ollama nie jest uruchomiony, kliknij **„Uruchom Ollama"** w panelu konfiguracji
3. Pobierz polecany model (np. `hy-mt1.5-abliterated:7b`)
4. Wybierz język źródłowy i docelowy
5. Wpisz tekst i kliknij **„Tłumacz"** (lub Ctrl+Enter)
6. Dla batch: włącz tryb batch i wpisz wiele linii

---

## Tłumacz Manga/Komiks

Tłumacz Manga/Komiks to specjalistyczne narzędzie do tłumaczenia komiksów i mangi, z automatycznym wykrywaniem dymków, OCR, tłumaczeniem i inpaintingiem.

### Funkcje

- **Wykrywanie dymków**: automatycznie identyfikuje dymki tekstowe na stronach
- **Zintegrowany OCR**: rozpoznaje tekst wewnątrz dymków (poziomy i pionowy)
- **Automatyczne tłumaczenie**: tłumaczy rozpoznany tekst na język docelowy
- **Inpainting**: usuwa oryginalny tekst i zastępuje go tłumaczeniem
- **Style czcionek**: Manga Style, Comic Sans, Handwritten, Bold
- **Wiele stron**: zarządzaj wieloma stronami jednocześnie
- **Tłumaczenie batch**: przetwarzaj wszystkie strony po kolei
- **Eksport**: eksportuj pojedynczą stronę lub wszystkie przetłumaczone strony

### Obsługiwane języki

JA (japoński), ZH (chiński), KO (koreański), EN (angielski), IT (włoski), ES (hiszpański), FR (francuski), DE (niemiecki)

### Jak używać

1. Przejdź do **Manga Translator** w pasku bocznym
2. Prześlij strony mangi/komiksu (przeciągnij i upuść lub wybierz pliki)
3. Wybierz język źródłowy i docelowy
4. Kliknij **„Wykryj i Tłumacz"** aby przeanalizować bieżącą stronę
5. Sprawdź wykryte dymki i tłumaczenia
6. Kliknij **„Inpainting"** aby zastosować tłumaczenia na obrazie
7. Eksportuj przetłumaczoną stronę

---

## Tłumacz Tekstur

Tłumacz Tekstur tłumaczy tekst obecny w teksturach gier wideo (menu, HUD, przyciski, UI), zachowując styl graficzny i formatowanie.

### Obsługiwane formaty

| Format | Opis |
|---|---|
| **DDS** | DirectDraw Surface (najczęstszy w grach) |
| **PNG** | Portable Network Graphics |
| **TGA** | Targa |
| **BMP** | Bitmap |
| **JPG** | JPEG |
| **WebP** | WebP |

### Funkcje

- **Wykrywanie regionów**: skanuje teksturę w poszukiwaniu obszarów z tekstem
- **OCR dla tekstur**: rozpoznaje tekst w wykrytych regionach
- **Automatyczne tłumaczenie**: tłumaczy tekst zachowując kontekst wizualny
- **Zachowanie stylu**: utrzymuje kolory tła, kolor tekstu, czcionkę i rozmiar
- **Auto-dopasowanie czcionki**: automatycznie wybiera najbardziej podobną czcionkę
- **Podgląd**: pokazuje podgląd tekstury przed i po tłumaczeniu
- **Przetwarzanie batch**: przetwarza wszystkie tekstury po kolei
- **Eksport**: eksportuj pojedynczą teksturę lub wszystkie zmodyfikowane tekstury

### Jak używać

1. Przejdź do **Texture Translator** w pasku bocznym
2. Prześlij tekstury (przeciągnij i upuść, wybierz pliki lub cały folder)
3. Wybierz język źródłowy i docelowy
4. Kliknij **„Skanuj teksturę"** aby wykryć regiony tekstu
5. Sprawdź i edytuj zaproponowane tłumaczenia
6. Kliknij **„Zastosuj tłumaczenia"** aby wygenerować przetłumaczoną teksturę
7. Eksportuj zmodyfikowane tekstury

---

## Auto-Słownik

Auto-Słownik automatycznie wyodrębnia terminy gry z tekstów za pomocą LLM, zapisuje je w słowniku per-gra i wstrzykuje do promptów tłumaczeniowych, aby zapewnić spójność terminologiczną.

### System 3-poziomowy

| Poziom | Ikona | Zachowanie |
|---|---|---|
| **Locked** | 🔒 | Stałe tłumaczenie, nigdy nie zmieniane przez AI |
| **Synced** | 🔄 | Preferowane tłumaczenie, AI może sugerować alternatywy |
| **Flexible** | 🔓 | Sugerowane tłumaczenie, AI wybiera najlepsze |

### Kategorie terminów

👤 Postać, 📍 Lokalizacja, 🎒 Przedmiot, ⚔️ Umiejętność, 📜 Zadanie, 🖥️ UI, ⚙️ System, 📚 Lore, 🐉 Stworzenie, 🏰 Frakcja, 📌 Inne

### Funkcje

- **Automatyczna ekstrakcja**: analizuje teksty gry za pomocą LLM i wyodrębnia kluczowe terminy
- **Domyślne terminy**: automatycznie dodaje powszechne terminy gamingowe (HP, XP, NPC itp.)
- **Wyszukiwanie i filtr**: szukaj po tekście, filtruj po poziomie lub kategorii
- **Wstrzykiwanie do promptów**: terminy są automatycznie wstrzykiwane do promptów tłumaczeniowych
- **Nie tłumacz**: oznacz terminy, które nie powinny być tłumaczone
- **Rozróżnianie wielkości liter**: opcja dla terminów wrażliwych na wielkość liter (nazwy własne)
- **Import/Eksport**: eksportuj i importuj słowniki w formacie CSV lub JSON
- **Kontrola spójności**: weryfikuje, czy terminy są używane spójnie w tłumaczeniach
- **Statystyki**: liczba terminów według poziomu, kategorii i źródła (auto/ręczne)

### Konfiguracja

| Parametr | Domyślnie | Opis |
|---|---|---|
| **Włączony** | Tak | Włącz/wyłącz auto-słownik |
| **Wyodrębnij przy pierwszym batch** | Tak | Wyodrębnia terminy z pierwszego przetłumaczonego batcha |
| **Max terminów na ekstrakcję** | 20 | Maksymalna liczba terminów na uruchomienie |
| **Min. pewność** | 50 | Minimalny próg pewności (0–100) |
| **Wstrzykuj do promptów** | Tak | Wstrzykuje terminy do promptów tłumaczeniowych |
| **Max terminów w prompcie** | 30 | Maksymalna liczba terminów na prompt (ograniczenie okna kontekstowego) |

### Jak używać

1. Przejdź do **Słownik** w pasku bocznym
2. Utwórz nowy słownik wybierając grę, język źródłowy i docelowy
3. Dodaj terminy ręcznie lub kliknij **„Wyodrębnij terminy"** dla ekstrakcji AI
4. Skonfiguruj poziom (Locked/Synced/Flexible) i kategorię dla każdego terminu
5. Terminy są automatycznie wstrzykiwane do promptów tłumaczeniowych
6. Użyj **„Sprawdź spójność"** aby zweryfikować jednolite użycie terminów

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

## Nowości w v1.4.1

### Pełne wsparcie GOG Galaxy

- **Odczyt biblioteki GOG Galaxy 2.0**: czyta posiadane gry z lokalnej bazy SQLite
- **Okładki i opisy przez GOG API**: automatyczne pobieranie obrazów i szczegółów
- **Scalanie z zainstalowanymi grami**: łączy dane rejestru z bazą Galaxy
- **Linki sklepu i pobierania**: strona Store z bezpośrednimi linkami GOG Galaxy

### Ulepszony Dashboard

- **Połączone sklepy na górze**: sklepy są teraz obok ostatnio otwartej gry
- **Odznaki sklepów z prawdziwymi liczbami**: pokazuje rzeczywistą liczbę gier
- **Placeholder ostatniej gry**: eleganckie wyświetlanie gdy brak otwartej gry

### Ulepszone szczegóły gry

- **Zakładka Info**: wymagania systemowe, ocena Metacritic, linki sklepu, lista DLC
- **Okładki GOG**: automatyczny fallback dla okładek gier GOG
- **Opisy GOG**: pełny opis przez GOG API

### Poprawki dostawców AI

- **Darmowi dostawcy nigdy nie blokowani na stałe**: MyMemory, Lingva używają cooldown (30s)
- **Steam Wishlist**: nowy endpoint IWishlistService z fallbackiem legacy

### Wydajność

- **Cache sessionStorage**: natychmiastowa nawigacja z detali do biblioteki
- **Zapis okładek w partiach**: z debounce (2s) aby uniknąć race conditions
- **Deduplikacja fetch SteamGridDB**: unika duplikatów żądań w StrictMode

### Build wieloplatformowy

- **Skrypt build Node.js**: `build-tauri-cross.js` zastępuje skrypt PowerShell
- **Wsparcie Linux**: workflow GitHub Actions kompiluje teraz też dla Linux (.deb, .AppImage)
- **Windows**: instalator (.msi, .exe NSIS) i wersja przenośna (.zip)

### Dokumentacja

- **11 przewodników użytkownika**: poprawki markdown lint
- **Poprawiona numeracja indeksu**: uporządkowany indeks bez przeskoków

---

## Nowości w v1.4.2

### Vision LLM Translator

- **Tłumaczenie kontekstowe**: wykorzystuje zrzuty ekranu z gry do kontekstu wizualnego
- **3 obsługiwanych dostawców**: Ollama (lokalnie), Gemini 2.0 Flash, OpenAI GPT-4o
- **Przesyłanie lub przechwytywanie**: załaduj obraz lub przechwyć ekran dla kontekstu AI
- **Dedykowana strona**: `/vision-translator` ze zintegrowanym paskiem bocznym

### Zaawansowane narzędzia AI

- **Lore Assistant**: czat RAG do eksploracji lore i dialogów gry
- **Auto-Hook Scanner**: skanowanie pamięci procesów przez WinAPI
- **System Monitor**: monitorowanie VRAM/RAM w czasie rzeczywistym (backend Rust)
- **Ollama Setup Wizard**: przewodnik instalacji lokalnego AI krok po kroku
- **Debug Console**: wbudowana konsola debugowania z przechwytywaniem logów
- **Plugin System**: dokument projektowy `PLUGIN_SYSTEM.md`

### Community Hub

- **GitHub Discussions**: 12 dyskusji utworzonych w kategoriach Announcements, General, Ideas, Q&A, Show and tell, Polls
- **Publiczne REST API**: Community Hub ładuje teraz dyskusje bez tokena GitHub
- **Pasek boczny przemianowany**: "Workshop" → "Steam Workshop"

### Poprawki dostawców tłumaczeń

- **Ollama cooldown**: błędy sieciowe używają teraz 30s cooldown zamiast trwałego blokowania
- **Lingva 404**: automatyczne skracanie tekstów >500 znaków (zapobieganie zbyt długim URL)
- **Auto-Translate Review**: nowy przycisk "Przetłumacz wszystkie nieprzetłumaczone" z paskiem postępu i stop
- **Tutorial querySelector**: poprawka SyntaxError z selektorami `:contains()` (niestandardowe CSS)
- **Update Bell**: poprawka błędnej wersji w popup (usunięto zakodowany na stałe fallback)

### CI/CD i bezpieczeństwo

- **Tauri Signing Key**: skonfigurowana do automatycznego generowania podpisanego `latest.json`
- **GitHub Secrets**: skonfigurowane `TAURI_SIGNING_PRIVATE_KEY` i `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- **Workflow release.yml**: zaktualizowany ze zmiennymi podpisu dla obu zadań (Windows + Linux)

### Unity: Automatyczna instalacja BepInEx + XUnity AutoTranslator

- **Automatyczne wykrywanie Unity**: jeśli skaner nie znajdzie plików do tłumaczenia w grze Unity, wyświetla dedykowaną kartę zamiast ogólnego błędu
- **Instalacja jednym kliknięciem**: przycisk „Zainstaluj BepInEx + XUnity AutoTranslator‟ automatycznie wykrywa plik exe gry, instaluje framework i wtyczkę tłumaczącą z logami w czasie rzeczywistym
- **Przepływ z przewodnikiem**: po instalacji sugeruje uruchomienie gry raz i ponowne skanowanie — wszystkie teksty stają się tłumaczalne
- **Podziękowania**: BepInEx Team i bbepis (XUnity AutoTranslator)

---

*GameStringer v1.4.2 - Przewodnik zaktualizowany 03.03.2026*
