# 📖 GameStringer - 완전한 사용자 가이드

## 목차

1. [개요](#개요)
2. [첫 실행과 프로필](#첫-실행과-프로필)
3. [라이브러리와 게임 상세](#라이브러리와-게임-상세)
4. [Neural Translator Pro](#neural-translator-pro)
5. [Translation Wizard](#translation-wizard)
6. [Translation Bridge](#translation-bridge)
7. [Subtitle Translator Pro](#subtitle-translator-pro)
8. [Retro ROM Tools](#retro-rom-tools)
9. [공개 API v1](#공개-api-v1)
10. [Voice Clone Studio](#voice-clone-studio) *(새 기능 v1.0.5)*
11. [VR Text Overlay](#vr-text-overlay) *(새 기능 v1.0.5)*
12. [Quality Gates](#quality-gates) *(새 기능 v1.0.5)*
13. [Player Feedback](#player-feedback) *(새 기능 v1.0.5)*
14. [새 AI 제공업체 v1.0.6](#새-ai-제공업체-v106) *(새 기능 v1.0.6)*
15. [Community Hub v1.0.7](#community-hub-v107) *(새 기능 v1.0.7)*
16. [UI 개선 v1.0.9](#ui-개선-v109) *(새 기능 v1.0.9)*
17. [Danganronpa 자동 번역기](#danganronpa-자동-번역기) *(새 기능 v1.1.0)*
18. [패치 내보내기](#패치-내보내기)
19. [게임에 적용](#게임에-적용)
20. [백업 관리](#백업-관리)
21. [번역 편집기](#번역-편집기)
22. [활동 기록](#활동-기록)
23. [사전](#사전)
24. [문제 해결](#문제-해결)
25. [용어집](#용어집)
26. [컨텍스트 하베스터](#컨텍스트-하베스터)
27. [번역 메모리](#번역-메모리)
28. [OCR 번역기](#ocr-번역기)
29. [AI 검토](#ai-검토)
30. [AI 파이프라인](#ai-파이프라인)
31. [감정 번역기](#감정-번역기)
32. [문화적 적응](#문화적-적응)
33. [신뢰도 히트맵](#신뢰도-히트맵)
34. [블로그 관리](#블로그-관리)
35. [Ren'Py 패처](#renpy-패처)
36. [RPG Maker 패처](#rpg-maker-패처)
37. [Wolf RPG 패처](#wolf-rpg-패처)
38. [Danganronpa 패처](#danganronpa-패처)
39. [멀티 LLM 비교](#멀티-llm-비교) *(새 기능)*
40. [실시간 품질 점수](#실시간-품질-점수) *(새 기능)*
41. [캐릭터 보이스 프로필](#캐릭터-보이스-프로필) *(새 기능)*
42. [음성 번역 파이프라인](#음성-번역-파이프라인) *(새 기능)*
43. [OCR 멀티 엔진](#ocr-멀티-엔진) *(새 기능)*
44. [레트로 게임 OCR](#레트로-게임-ocr) *(새 기능)*
45. [적응형 MT](#적응형-mt) *(새 기능)*
46. [배치 폴더 번역기](#배치-폴더-번역기) *(새 기능)*
47. [오프라인 번역기](#오프라인-번역기) *(새 기능)*
48. [만화/코믹 번역기](#만화코믹-번역기) *(새 기능)*
49. [텍스처 번역기](#텍스처-번역기) *(새 기능)*
50. [자동 용어집](#자동-용어집) *(새 기능)*

---

## 개요

GameStringer는 비디오 게임의 자동 및 수동 번역을 위한 고급 시스템입니다. 지원:

- **게임 엔진**: Unity, Unreal Engine, RPG Maker, Ren'Py, Godot, Telltale, Wolf RPG, Kirikiri 등
- **파일 형식**: CSV, JSON, XML, PO/POT, YAML, TXT, SRT, VTT, ASS/SSA 등
- **AI 제공업체**: Claude, Gemini, GPT, DeepSeek, Mistral, Groq, Ollama, **Qwen 3**, **NLLB-200** (18개 이상)
- **언어**: 200개 이상 지원 (NLLB-200 사용 시)
- **다국어 UI**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL (11개 언어)
- **게임 스토어**: Steam, Epic Games, GOG, Origin, Battle.net, Ubisoft, itch.io, Amazon Games
- **새 기능 v1.0.5**: Voice Clone Studio, VR Text Overlay, Quality Gates, Player Feedback
- **새 기능 v1.0.6**: Qwen 3 (아시아 언어), NLLB-200 (200개 언어), 버그 수정
- **새 기능 v1.0.7**: Community Hub, GitHub Discussions, 라이선스 v1.1
- **새 기능 v1.0.8**: 업데이트 다운로드 수정
- **새 기능 v1.0.9**: 애니메이션 헤더, 업데이트 알림, UI 개선
- **새 기능 v1.4.0**: Radix UI 통합, 행별 Quality Badges, RTL 지원, 범용 Ollama, TypeScript 정리

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

## 용어집

용어집은 각 게임에 대한 맞춤형 용어 사전을 관리하여 번역의 일관성을 보장합니다.

### 기능

- **용어 등급**:
  - 🔴 **Locked** — 항상 동일하게 번역 (고유 명사, 마법, 장소)
  - 🟡 **Synced** — 일관된 번역, 문맥에 따라 적응 가능
  - 🟢 **Flexible** — 자유로운 번역
- **카테고리**: 캐릭터, 장소, 아이템, 스킬, 퀘스트, UI, 시스템, 로어, 크리처, 세력
- **자동 추출**: AI가 추가할 용어를 제안
- **일관성 검사**: 모든 파일에서 균일하게 번역되는지 확인
- **가져오기/내보내기**: 게임 간 공유를 위한 CSV 및 JSON

### 사용 방법

1. **고급 도구 → 용어집**으로 이동
2. 목록에서 게임 선택
3. 수동으로 용어 추가 또는 **"용어 추출"**로 AI 제안 받기
4. 각 용어의 등급 설정
5. 번역 시 자동으로 용어집 적용

---

## 컨텍스트 하베스터

AI 번역 전에 텍스트 문자열을 분류하고 컨텍스트로 보강하여 번역 품질을 향상시킵니다.

### 기능

- **자동 분류**: 화면 유형 식별 (메뉴, 대화, 내레이션, 튜토리얼, 시스템)
- **화자 인식**: 누가 말하는지와 어조 유형 (격식체, 구어체, 공격적) 추론
- **컨텍스트 메타데이터**: 각 문자열에 게임 장르, 콘텐츠 유형, 어조 부여
- **하베스트 저장**: 추출된 컨텍스트를 저장하여 이후 세션에서 재사용
- **일괄 처리**: 한 번의 작업으로 전체 파일 분석

### 사용 방법

1. **고급 도구 → 컨텍스트 하베스터**로 이동
2. 문자열을 붙여넣거나 파일 불러오기
3. **"분석"**을 클릭하여 각 문자열 분류
4. AI 번역의 입력으로 사용할 JSON 결과 다운로드

---

## 번역 메모리

완료된 모든 번역의 영구 데이터베이스로, 새 세션에서 자동으로 재사용됩니다.

### 기능

- **자동 재사용**: 이미 번역된 문자열은 새 AI 호출 없이 제안
- **검색**: 원문, 번역 또는 게임 이름으로 검색
- **게임 필터**: 특정 타이틀의 번역만 표시
- **통계**: 총 단위, 게임별 분포, 마지막 수정 날짜
- **내보내기**: 다른 CAT 도구용 JSON, CSV, TMX
- **가져오기**: TMX 또는 CSV에서 기존 번역 가져오기

### 사용 방법

1. **고급 도구 → 번역 메모리**로 이동
2. 검색창으로 이전 번역 검색
3. 필요에 따라 개별 단위 편집 또는 삭제
4. AI 번역 시 메모리가 자동으로 참조됨

---

## OCR 번역기

게임 창이나 스크린샷에서 실시간으로 텍스트를 캡처하여 즉시 번역합니다.

### 기능

- **실시간 캡처**: 설정 가능한 간격으로 화면 분석
- **소스 언어**: 일본어, 영어, 중국어 간체, 한국어
- **창 선택**: 게임 창을 직접 지정
- **영역 선택**: 분석할 화면의 특정 영역 정의
- **신뢰도**: 각 감지된 텍스트의 신뢰도 표시
- **전역 단축키**: 키보드 단축키로 캡처 전환
- **번역 캐시**: 동일한 문자열에 대한 이전 번역 재사용

### 사용 방법

1. 사이드바에서 **OCR 번역기**로 이동
2. 게임의 소스 언어 선택
3. **"창 선택"**을 클릭하여 게임 창 선택
4. *(선택 사항)* **"영역 선택"**으로 특정 영역 설정
5. **"시작"**을 눌러 자동 캡처 및 번역 시작

---

## AI 검토

오류 감지 및 수정 제안을 통한 번역 자동 품질 검토.

### 기능

- **단일 모드**: 원문/번역 쌍 검토
- **일괄 모드**: `원문|번역` 형식으로 줄별 대량 검토
- **문제 카테고리**: 정확성, 유창성, 용어, 어조, 구조
- **심각도 수준**: 심각, 경고, 정보
- **자동 수정**: 사소한 문제 자동 수정
- **통계**: 일괄 처리별 전체 점수 0–100

### 사용 방법

1. **고급 도구 → AI 검토**로 이동
2. **단일** 또는 **일괄** 중 선택
3. 원문과 번역 붙여넣기
4. **"검토"**를 클릭하여 보고서 수신
5. **"자동 수정"**으로 제안된 수정 사항 적용

---

## AI 파이프라인

클릭 한 번으로 최고 품질의 번역을 얻기 위한 자동화된 6단계 워크플로우.

### 파이프라인 단계

1. **Harvest** — 컨텍스트 추출 및 분류
2. **Translate** — 구성된 AI 제공자로 번역
3. **QA Check** — 자동 품질 검증
4. **Auto-Fix** — 발견된 문제 수정
5. **Review** — 최종 AI 검토
6. **Score** — 최종 점수 0–100 계산

### 사용 가능한 프리셋

- **Quick** — 필수 단계 (Translate + QA Check)
- **Max Quality** — 순서대로 모든 6단계

### 사용 방법

1. **고급 도구 → AI 파이프라인**으로 이동
2. 번역할 문자열 붙여넣기
3. 프리셋 선택 또는 수동으로 단계 구성
4. **"파이프라인 실행"** 클릭
5. 문자열별 점수가 포함된 최종 보고서 다운로드

---

## 감정 번역기

원본 대화에 있는 감정을 분석하고 보존하는 번역 도구.

### 기능

- **감정 분석**: 지배적인 감정 감지 (분노, 슬픔, 두려움, 기쁨, 중립, 놀라움, 혐오)
- **강도**: 감정적 강도 수준 측정 (0–100)
- **어조 보존**: AI가 번역에서 동일한 감정적 영향을 유지하도록 유도
- **EmotionBadge**: 감정과 강도가 표시된 각 문자열의 시각적 레이블
- **일괄 통계**: 전체 파일의 감정 분포

### 사용 방법

1. **고급 도구 → 감정 번역기**로 이동
2. 번역할 텍스트 붙여넣기
3. 대상 언어 선택
4. **"분석 및 번역"** 클릭
5. 결과는 각 문자열에 감정이 식별된 번역을 표시

---

## 문화적 적응

번역된 텍스트를 분석하여 문화적으로 문제 있는 요소를 식별하고 대상 문화에 맞는 조정을 제안합니다.

### 기능

- **지원 문화권**: IT, EN, DE, FR, ES, JA, KO, ZH, PT, RU
- **분석 카테고리**: 관용 표현, 문화적 참조, 단위/통화, 상징적 색상, 경어 표현, 유머
- **구체적인 제안**: 각 요소에 대해 대상 문화에 적합한 대안 제안
- **적응 점수**: 수정이 필요한 텍스트의 비율

### 사용 방법

1. **고급 도구 → 문화적 적응**으로 이동
2. 번역된 텍스트 붙여넣기
3. 소스 및 대상 문화 선택
4. **"분석"** 클릭
5. 최종 출판 전에 제안 사항 적용

---

## 신뢰도 히트맵

색상 코드 맵을 통해 각 번역의 품질을 시각화하여 문제가 있는 문자열을 즉시 식별합니다.

### 기능

- **8가지 분석 지표**: 누락된 자리 표시자, 빈 문자열, 미번역, 구두점, 대문자, HTML 태그, 길이, 숫자
- **색상 코드**:
  - 🟢 **우수** (90–100%) — 올바른 번역
  - 🔵 **양호** (75–89%) — 작은 스타일 문제
  - 🟡 **허용 가능** (60–74%) — 경미한 문제
  - 🟠 **검토 필요** (40–59%) — 중대한 오류
  - 🔴 **불량** (<40%) — 치명적인 오류
- **3가지 입력 모드**: 내장 데모, 텍스트 붙여넣기 (`원문|번역` 줄당), 파일 업로드 (JSON/CSV/TXT)
- **보고서 내보내기**: 각 문자열의 점수와 문제를 JSON으로 다운로드

### 사용 방법

1. **고급 도구 → 신뢰도 히트맵**으로 이동
2. 모드 선택: **데모**로 예시 확인, **붙여넣기**로 수동 입력, **파일**로 업로드
3. **"분석"** 클릭
4. 색상 보고서 검토: 빨간색/주황색 문자열은 우선 수정 필요
5. **"보고서 내보내기"**로 JSON 형식으로 저장

---

## 블로그 관리

번역 프로젝트의 뉴스 및 업데이트 블로그를 관리하며 대시보드에 표시됩니다.

### 기능

- **게시물 작성**: 제목, 날짜, 짧은 설명, 카테고리 태그
- **사용 가능한 태그**: Feature, UI, Fix, Security, AI, Update, News
- **고정**: 중요한 게시물을 목록 상단에 고정
- **인라인 편집**: 페이지 변경 없이 게시물 편집
- **게시물 삭제**: 확인 후 삭제
- **표시**: 스타일화된 날짜, 색상 태그 배지, 설명 미리보기가 있는 시간순 목록

### 사용 방법

1. 메인 메뉴에서 **블로그 관리**로 이동
2. **"새 게시물"** 클릭
3. 날짜 (예: "24 Jan"), 제목 (이모지 권장), 설명, 태그 입력
4. **"저장"** 클릭
5. 📌 아이콘으로 게시물을 상단에 고정

---

## Ren'Py 패처

Ren'Py 엔진으로 제작된 비주얼 노벨 전용 패처. `.rpy` 파일에서 대화, 메뉴, 내레이션을 추출하고 네이티브 번역 파일을 생성합니다.

### 기능

- **자동 감지**: 게임 제목, 버전, 스크립트 파일 식별
- **문자열 유형**: 대화, 메뉴, 내레이션
- **캐릭터 식별**: 각 대사를 말하는 캐릭터 표시
- **인라인 에디터**: 문자열 클릭으로 번역 편집
- **검색 및 필터**: 텍스트나 캐릭터로 검색, 유형별 필터
- **`.rpy` 파일 생성**: Ren'Py 호환 `tl/<언어>/` 구조 생성
- **JSON 저장/불러오기**: 진행 상황 저장 후 나중에 재개
- **통계**: 완성율, 유형별 개수

### 사용 방법

1. 사이드바에서 **Ren'Py 패처**로 이동
2. **"찾아보기"** 클릭 후 Ren'Py 게임 폴더 선택
3. **"문자열 추출"** 클릭
4. 에디터에서 번역 편집 (문자열 클릭)
5. 대상 언어 이름 입력 (예: `korean`) 후 **"`.rpy` 생성"** 클릭
6. 파일은 게임의 `tl/` 폴더에 저장

---

## RPG Maker 패처

RPG Maker 게임 (MV, MZ, XP, VX, VX Ace) 전용 패처. 프로젝트의 `.json` 및 `.rxdata`/`.rvdata` 파일을 읽습니다.

### 기능

- **버전 감지**: MV/MZ/XP/VX/Ace 자동 식별
- **지원 파일**: Actors, Classes, Skills, Items, Weapons, Armors, Enemies, Troops, States, Maps, CommonEvents, System
- **파일별 통계**: 파일별 번역 진행률
- **Translator++ 통합**: Translator++ 직접 다운로드 링크
- **패치 내보내기**: 번역을 JSON으로 저장
- **에디터**: 전문 검색, 인라인 편집

### 사용 방법

1. 사이드바에서 **RPG Maker 패처**로 이동
2. RPG Maker 프로젝트 폴더 선택
3. **"문자열 추출"** 클릭
4. 에디터에서 문자열 번역
5. **"패치 저장"** 클릭

---

## Wolf RPG 패처

Wolf RPG Editor 게임 전용 패처. 바이너리 `.wolf` 파일과 게임 맵을 처리합니다.

### 기능

- **지원 파일**: Data/*.wolf (데이터베이스), Map/*.mps (맵)
- **문자열 유형**: 데이터베이스, 맵, 스크립트, 이벤트
- **암호화 감지**: 게임이 암호화된 파일을 사용하는 경우 경고
- **WolfTrans 통합**: 암호화된 파일에 WolfTrans 권장
- **진행 표시줄**: 전체 프로젝트 완성율
- **저장/불러오기**: 작업 재개를 위한 JSON

### 사용 방법

1. 사이드바에서 **Wolf RPG 패처**로 이동
2. Wolf RPG 게임 폴더 선택
3. **"문자열 추출"** 클릭
4. 게임이 암호화된 경우 WolfTrans 지침 따르기
5. 문자열 번역 후 **"저장"** 클릭

---

## Danganronpa 패처

Danganronpa 시리즈 전용 패처. `.pak` 아카이브와 `.po` 현지화 파일을 처리합니다.

### 기능

- **게임 감지**: DR1, DR2, V3 자동 식별
- **PAK 아카이브**: `.pak` 아카이브의 파일 추출 및 목록화
- **PO 파일**: 번역됨/미번역/퍼지 상태의 `.po`/`.pot` 기본 지원
- **AI 번역 내장**: 구성된 AI로 문자열 자동 번역 버튼
- **PO 통계**: 번역됨, 미번역, 퍼지 개수 및 비율
- **DRAT 통합**: 고급 아카이브 작업을 위한 DRAT 도구 링크
- **패치 내보내기**: 수정된 `.po` 파일 내보내기

### 사용 방법

1. 사이드바에서 **Danganronpa 패처**로 이동
2. Danganronpa 게임 폴더 선택
3. `.pak` 아카이브 추출 또는 `.po` 파일 직접 로드
4. 에디터에서 문자열 편집 또는 **"AI로 번역"** 사용
5. 완성된 `.po` 파일 내보내기 후 게임에 재임포트

---

## 멀티 LLM 비교

멀티 LLM 비교는 동일한 텍스트를 여러 AI 제공업체에 병렬로 전송하고 최적의 번역을 자동으로 선택합니다.

### 지원 제공업체

- **OpenAI** (GPT-4o)
- **Gemini** (Google)
- **Claude** (Anthropic)
- **DeepSeek**
- **Mistral**
- **DeepL**
- **Libre Translate**

### 기능

- **병렬 비교**: 2~7개 제공업체로 동시 번역
- **자동 선택**: 시스템이 최고 점수의 번역을 선택
- **합의 번역**: 여러 모델이 일치하면 통합 버전 생성
- **품질 점수**: 각 번역에 유창성, 정확성, 일관성, 스타일 점수 부여
- **캐릭터 프로필**: 톤과 어휘를 맞춤 설정하는 보이스 프로필 적용

### 사용 방법

1. 사이드바에서 **Translator → Compare**로 이동
2. 원본 텍스트를 입력하고 대상 언어 선택
3. 상단 바에서 최소 2개의 제공업체 선택
4. **"비교"**를 클릭하여 병렬 번역 실행
5. 점수가 포함된 결과를 확인하고 선호하는 번역을 선택하거나 자동 선택된 것을 사용

---

## 실시간 품질 점수

실시간 품질 점수 시스템은 각 번역을 여러 차원에서 자동 평가하여 수치 점수와 카테고리를 부여합니다.

### 평가 차원

| 차원 | 설명 |
|---|---|
| **유창성** | 대상 언어에서의 자연스러움과 가독성 |
| **정확성** | 원문 의미에 대한 충실도 |
| **일관성** | 프로젝트 전체와의 용어 일관성 |
| **스타일** | 게임 맥락에 적합한 톤과 어조 |

### 점수 카테고리

- **우수** (90~100): 출판 가능한 번역
- **양호** (75~89): 경미한 개선 가능
- **허용** (60~74): 검토 권장
- **검토 필요** (40~59): 수정 필요
- **불량** (0~39): 재번역 필요

### 자동 검사

- 숫자 및 자리 표시자(`{0}`, `%s` 등) 보존
- 원문 대비 길이 일관성
- 미번역어 감지
- 구두점 및 형식 검증

---

## 캐릭터 보이스 프로필

캐릭터 보이스 프로필을 통해 게임 내 각 캐릭터의 개성에 맞게 번역을 맞춤 설정할 수 있습니다.

### 사용 가능한 원형

Hero, Villain, Mentor, Sidekick, Love Interest, Comic Relief, Mysterious Stranger, Noble, Pirate, Warrior, Wizard, Merchant, Child, Robot, Monster, Narrator — 또는 **Custom**.

### 설정 가능한 매개변수

- **성격**: 원형, 성격 특성, 기분, 나이, 성별
- **말투 스타일**: 격식 수준(매우 격식 → 매우 비격식), 어휘(고어, 세련된, 표준, 단순, 속어, 기술적), 문장 길이, 구두점
- **패턴**: 구호, 추임새, 어미 접미사, 피할 단어, 선호 대체어
- **TTS 음성** *(선택)*: 제공업체(OpenAI, ElevenLabs, Azure), 음성, 피치, 속도, 감정
- **대화 예시**: AI를 안내하는 원문/번역 쌍

### 사용 방법

1. 번역 패널에서 **Character Profile Manager** 열기
2. 프리셋 원형 선택 또는 커스텀 프로필 생성
3. 성격, 스타일, 패턴, 어휘 설정
4. 일관성 향상을 위한 대화 예시 추가
5. 프로필 저장 — 해당 캐릭터의 향후 번역에 자동 적용됩니다

---

## 음성 번역 파이프라인

음성 번역 파이프라인은 음성 오디오를 번역 및 합성된 텍스트로 변환하여 다른 언어로 엔드투엔드 단일 플로우로 처리합니다.

### 파이프라인 단계

1. **녹음 / 업로드**: 마이크로 오디오 녹음 또는 오디오 파일 업로드
2. **전사 (Whisper)**: OpenAI Whisper를 통한 음성→텍스트 변환
3. **AI 번역**: 전사된 텍스트를 대상 언어로 번역
4. **음성 합성 (TTS)**: 합성 음성으로 번역된 오디오 생성

### 사용 가능한 음성

| 음성 | 특징 |
|---|---|
| **Nova** | 여성, 자연스러운 |
| **Alloy** | 중성, 다재다능 |
| **Echo** | 남성, 따뜻한 |
| **Fable** | 내러티브, 표현력 풍부 |
| **Onyx** | 남성, 깊은 |
| **Shimmer** | 여성, 밝은 |

### 사용 방법

1. 사이드바에서 **Voice Translator**로 이동
2. 마이크로 오디오 녹음 또는 `.wav`/`.mp3` 파일 업로드
3. 시스템이 Whisper로 자동 전사
4. 대상 언어 선택 후 번역 시작
5. TTS 음성 선택 후 번역된 오디오 생성
6. 결과 재생 또는 다운로드

> **참고**: Whisper 및 TTS용 OpenAI API 키가 필요합니다.

---

## OCR 멀티 엔진

OCR 멀티 엔진은 게임 스크린샷에서의 텍스트 인식을 위해 자동 감지 및 지능적 폴백을 갖춘 4개의 OCR 엔진을 지원합니다.

### 지원 엔진

| 엔진 | 설명 | 강점 |
|---|---|---|
| **OneOCR** | Windows 11 AI 네이티브 (포트 17231) | 스타일 폰트, 오버레이 텍스트, 저해상도 |
| **PaddleOCR** | Baidu 오픈소스 (포트 8866) | CJK 우수, 세로 텍스트, 높은 정확도 |
| **RapidOCR** | 경량 ONNX 래퍼 (포트 9003) | 빠름, 경량, 설치 용이 |
| **Tesseract.js** | 브라우저 통합 | 항상 사용 가능, 100+ 언어, 설정 불필요 |

### 기능

- **자동 감지**: 시작 시 사용 가능한 엔진 프로빙
- **폴백 체인**: OneOCR → PaddleOCR → RapidOCR → Tesseract (CJK: PaddleOCR 우선)
- **비교 모드**: 모든 엔진을 병렬로 실행하고 최상의 결과 사용
- **이미지 전처리**: 그레이스케일, 대비, 임계값, 작은 텍스트용 업스케일
- **선호 엔진**: 다음 세션을 위한 설정 저장

### 사용 방법

1. 사이드바에서 **OCR Multi-Engine**으로 이동
2. **"엔진 감지"**를 클릭하여 온라인 엔진 확인
3. 해당 카드를 클릭하여 선호 엔진 선택
4. 스크린샷 업로드 또는 이미지 붙여넣기
5. 선택한 엔진(또는 자동 폴백)으로 텍스트 인식

---

## 레트로 게임 OCR

레트로 게임 OCR은 픽셀 폰트를 사용하는 레트로 게임 스크린샷에서의 텍스트 인식에 특화된 모듈입니다.

### 사용 가능한 프리셋

| 프리셋 | 시대 | 최적화 |
|---|---|---|
| **8-bit** | NES, Game Boy, MSX | 4x 업스케일, 높은 임계값, 디더링 제거 |
| **16-bit** | SNES, Mega Drive, PC Engine | 3x 업스케일, 중간 대비, 샤프닝 |
| **DOS/PC** | DOS, EGA/VGA | 2x 업스케일, 중간 임계값, 고정폭 폰트 |
| **PC-98** | NEC PC-98 (일본어) | 3x 업스케일, 높은 임계값, CJK 최적화 |
| **Early Windows** | Windows 3.1/95/98 | 2x 업스케일, 약한 대비 |

### 설정 가능한 매개변수

- **업스케일**: 확대 비율 (픽셀 보존을 위한 nearest-neighbor)
- **대비**: 인식 전 대비 부스트
- **이진 임계값**: 설정 가능한 임계값으로 흑백 변환
- **디더링 제거**: 레트로 게임 특유의 디더링 패턴 필터링
- **샤프닝 / 노이즈 제거**: 선명도 향상 및 노이즈 감소

### 사용 방법

1. OCR 섹션에서 **Retro-Game OCR** 패널 열기
2. 게임 프리셋 선택 또는 매개변수 수동 설정
3. 레트로 게임 스크린샷 업로드
4. 시스템이 이미지를 전처리하고 최적화된 인식 적용
5. 인식된 텍스트 확인 및 편집

---

## 적응형 MT

적응형 MT(적응형 기계 번역)는 인간의 수정에서 학습하여 번역 품질을 점진적으로 향상시키는 시스템입니다.

### 작동 방식

1. **수정 저장**: AI 번역을 수정하면 쌍(원문 → 수정)이 저장됩니다
2. **퍼지 유사도**: 트라이그램(Dice 계수) + 단어 유사도(Jaccard)로 관련 수정 검색
3. **Few-shot 학습**: 현재 텍스트와 가장 유사한 수정이 프롬프트에 예시로 주입됩니다
4. **피드백 루프**: 더 많은 수정을 저장할수록 미래 번역이 향상됩니다

### 기능

- **태그 자동 감지**: tone_change, terminology, major_rewrite, length_change, punctuation, style
- **컨텍스트 부스트**: 같은 게임(1.3x), 같은 콘텐츠 유형(1.2x), 최근 수정 우선
- **승인**: 수정을 검증됨으로 표시하여 신뢰성 향상
- **가져오기/내보내기**: 프로젝트 간 수정 세트 내보내기 및 가져오기
- **통계**: 언어, 게임, 유형, 태그, 평균 사용 횟수별 수정 수

### 설정

| 매개변수 | 기본값 | 설명 |
|---|---|---|
| **최대 예시 수** | 5 | 프롬프트당 최대 few-shot 예시 수 |
| **유사도 임계값** | 0.2 | 예시를 포함하기 위한 최소 유사도 |
| **같은 게임** | 예 | 같은 게임의 수정 우선 |
| **승인된 것만** | 아니오 | 승인된 수정만 사용 |

---

## 배치 폴더 번역기

배치 폴더 번역기는 원래 구조를 유지하면서 전체 파일 폴더를 한 번의 작업으로 번역합니다.

### 기능

- **재귀 스캔**: 하위 폴더 자동 스캔
- **멀티 포맷**: CSV, JSON, XML, PO, YAML, TXT, SRT, VTT 등 지원
- **스마트 선택**: 파일 유형, 크기 또는 패턴으로 필터링
- **유연한 출력**: 구조가 보존된 사용자 정의 출력 폴더
- **병렬 번역**: 최대 3개 배치 동시 실행으로 최대 속도
- **Translation Memory**: 번역 메모리 자동 사용 및 축적
- **콘텐츠 분류**: 번역 전 문자열을 유형별(대화, UI, 시스템)로 분류
- **품질 관리**: 설정 가능한 최소 점수로 자동 QA
- **일시 정지/재개**: 언제든지 번역 일시 정지 및 재개 가능

### 매개변수

| 매개변수 | 기본값 | 설명 |
|---|---|---|
| **배치 크기** | 40 | API 호출당 문자열 수 |
| **병렬** | 3 | 동시 배치 수 |
| **지연** | 50ms | 배치 간 일시 정지 |
| **최소 점수** | 70 | 최소 품질 임계값 |
| **최대 재시도** | 3 | 오류 시 재시도 횟수 |

### 사용 방법

1. 사이드바에서 **Batch Translator**로 이동
2. 번역할 파일이 포함된 소스 폴더 선택
3. 소스 언어, 대상 언어 및 AI 제공업체 선택
4. 옵션 설정 (TM, QA, 분류, 파이프라인)
5. **"시작"**을 클릭하여 배치 번역 시작
6. 실시간으로 진행 상황 모니터링 — 일시 정지 또는 취소 가능

---

## 오프라인 번역기

오프라인 번역기는 Ollama를 통한 로컬 AI 모델을 사용하여 인터넷 연결 없이 텍스트를 번역할 수 있습니다. 데이터는 온라인으로 전송되지 않습니다.

### 요구사항

- **Ollama**가 설치되고 실행 중이어야 합니다 (`ollama serve`)
- 최소 1개의 번역 모델이 다운로드되어야 합니다

### 추천 모델

| 모델 | 크기 | 설명 |
|---|---|---|
| **huihui_ai/hy-mt1.5-abliterated:7b** | ~4.5 GB | Tencent HY-MT 1.5 — WMT25 1위, 30/31개 언어에서 Google 번역을 능가 |
| **huihui_ai/hy-mt1.5-abliterated:1.8b** | ~1.2 GB | 경량 초고속 버전 |
| **translategemma:12b** | ~8.0 GB | Google TranslateGemma — 55개 언어, 고품질 |
| **translategemma:2b** | ~1.5 GB | Google TranslateGemma — 55개 언어, 빠르고 가벼움 |
| **qwen3:4b** | ~2.5 GB | Alibaba Qwen 3 — 범용, 번역에 적합 |

### 기능

- **단일 모드**: 한 번에 하나의 텍스트를 번역
- **배치 모드**: 여러 텍스트(줄당 하나)를 한 번의 작업으로 번역
- **14개 언어 지원**: IT, EN, FR, DE, ES, PT, RU, JA, KO, ZH, PL, NL, TR, CS
- **언어 교환**: 원본과 대상을 한 번의 클릭으로 교환
- **모델 선택**: Ollama에 설치된 모델 중 선택
- **결과 기록**: 번역 시간과 함께 모든 결과 표시
- **결과 복사**: 개별 번역 또는 전체 복사
- **통합 설정**: 인터페이스에서 직접 Ollama를 시작하고 모델을 다운로드

### 사용 방법

1. 사이드바에서 **오프라인 번역기**로 이동
2. Ollama가 실행되지 않는 경우, 설정 패널에서 **"Ollama 시작"**을 클릭
3. 추천 모델을 다운로드 (예: `hy-mt1.5-abliterated:7b`)
4. 원본 언어와 대상 언어를 선택
5. 텍스트를 입력하고 **"번역"**을 클릭 (또는 Ctrl+Enter)
6. 배치의 경우: 배치 모드를 활성화하고 여러 줄을 입력

---

## 만화/코믹 번역기

만화/코믹 번역기는 자동 말풍선 감지, OCR, 번역 및 인페인팅 기능을 갖춘 만화 번역 전용 도구입니다.

### 기능

- **말풍선 감지**: 페이지의 텍스트 말풍선을 자동으로 식별
- **통합 OCR**: 말풍선 내의 텍스트를 인식 (가로 및 세로)
- **자동 번역**: 인식된 텍스트를 대상 언어로 번역
- **인페인팅**: 원본 텍스트를 제거하고 번역으로 대체
- **글꼴 스타일**: Manga Style, Comic Sans, Handwritten, Bold
- **멀티 페이지**: 여러 페이지를 동시에 관리
- **배치 번역**: 모든 페이지를 순서대로 처리
- **내보내기**: 단일 페이지 또는 모든 번역된 페이지를 내보내기

### 지원 언어

JA (일본어), ZH (중국어), KO (한국어), EN (영어), IT (이탈리아어), ES (스페인어), FR (프랑스어), DE (독일어)

### 사용 방법

1. 사이드바에서 **Manga Translator**로 이동
2. 만화 페이지를 업로드 (드래그 앤 드롭 또는 파일 선택)
3. 원본 언어와 대상 언어를 선택
4. **"감지 및 번역"**을 클릭하여 현재 페이지를 분석
5. 감지된 말풍선과 번역을 검토
6. **"인페인팅"**을 클릭하여 이미지에 번역을 적용
7. 번역된 페이지를 내보내기

---

## 텍스처 번역기

텍스처 번역기는 비디오 게임 텍스처(메뉴, HUD, 버튼, UI)에 있는 텍스트를 그래픽 스타일과 서식을 유지하면서 번역합니다.

### 지원 형식

| 형식 | 설명 |
|---|---|
| **DDS** | DirectDraw Surface (게임에서 가장 일반적) |
| **PNG** | Portable Network Graphics |
| **TGA** | Targa |
| **BMP** | Bitmap |
| **JPG** | JPEG |
| **WebP** | WebP |

### 기능

- **영역 감지**: 텍스처를 스캔하여 텍스트가 있는 영역을 찾기
- **텍스처 OCR**: 감지된 영역의 텍스트를 인식
- **자동 번역**: 시각적 컨텍스트를 유지하면서 텍스트를 번역
- **스타일 유지**: 배경색, 텍스트 색상, 글꼴 및 크기를 유지
- **자동 글꼴 매칭**: 가장 유사한 글꼴을 자동으로 선택
- **미리보기**: 번역 전후의 텍스처 미리보기 표시
- **배치 처리**: 모든 텍스처를 순서대로 처리
- **내보내기**: 단일 텍스처 또는 모든 수정된 텍스처를 내보내기

### 사용 방법

1. 사이드바에서 **Texture Translator**로 이동
2. 텍스처를 업로드 (드래그 앤 드롭, 파일 선택 또는 전체 폴더)
3. 원본 언어와 대상 언어를 선택
4. **"텍스처 스캔"**을 클릭하여 텍스트 영역을 감지
5. 제안된 번역을 검토하고 편집
6. **"번역 적용"**을 클릭하여 번역된 텍스처를 생성
7. 수정된 텍스처를 내보내기

---

## 자동 용어집

자동 용어집은 LLM을 사용하여 게임 텍스트에서 용어를 자동 추출하고, 게임별 용어집에 저장하며, 번역 프롬프트에 주입하여 용어의 일관성을 보장합니다.

### 3단계 시스템

| 단계 | 아이콘 | 동작 |
|---|---|---|
| **Locked** | 🔒 | 고정 번역, AI에 의해 변경되지 않음 |
| **Synced** | 🔄 | 우선 번역, AI가 대안을 제안 가능 |
| **Flexible** | 🔓 | 제안 번역, AI가 최적을 선택 |

### 용어 카테고리

👤 캐릭터, 📍 위치, 🎒 아이템, ⚔️ 스킬, 📜 퀘스트, 🖥️ UI, ⚙️ 시스템, 📚 로어, 🐉 크리처, 🏰 팩션, 📌 기타

### 기능

- **자동 추출**: LLM으로 게임 텍스트를 분석하고 핵심 용어를 추출
- **기본 용어**: 일반적인 게임 용어를 자동 추가 (HP, XP, NPC 등)
- **검색 및 필터**: 텍스트로 검색, 단계 또는 카테고리로 필터링
- **프롬프트 주입**: 용어가 번역 프롬프트에 자동 주입
- **번역 금지**: 번역하지 않아야 하는 용어를 표시
- **대소문자 구분**: 고유 명사를 위한 대소문자 옵션
- **가져오기/내보내기**: CSV 또는 JSON 형식으로 용어집을 가져오기 및 내보내기
- **일관성 확인**: 번역에서 용어의 균일한 사용을 확인
- **통계**: 단계, 카테고리 및 출처(자동/수동)별 용어 수

### 설정

| 매개변수 | 기본값 | 설명 |
|---|---|---|
| **활성화** | 예 | 자동 용어집 활성화/비활성화 |
| **첫 번째 배치에서 추출** | 예 | 첫 번째 번역 배치에서 용어를 추출 |
| **추출당 최대 용어 수** | 20 | 실행당 최대 추출 용어 수 |
| **최소 신뢰도** | 50 | 최소 신뢰도 임계값 (0–100) |
| **프롬프트에 주입** | 예 | 번역 프롬프트에 용어를 주입 |
| **프롬프트 내 최대 용어 수** | 30 | 프롬프트당 최대 용어 수 (컨텍스트 윈도우 제한) |

### 사용 방법

1. 사이드바에서 **용어집**으로 이동
2. 게임, 원본 언어 및 대상 언어를 선택하여 새 용어집을 생성
3. 수동으로 용어를 추가하거나 **"용어 추출"**을 클릭하여 AI 추출
4. 각 용어의 단계(Locked/Synced/Flexible)와 카테고리를 설정
5. 용어가 번역 프롬프트에 자동 주입
6. **"일관성 확인"**을 사용하여 용어의 균일한 사용을 확인

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

## v1.4.1 새로운 기능

### GOG Galaxy 완전 지원

- **GOG Galaxy 2.0 라이브러리 읽기**: 로컬 SQLite 데이터베이스에서 소유 게임 읽기
- **GOG API를 통한 커버 및 설명**: 이미지 및 세부 정보 자동 가져오기
- **설치된 게임과 병합**: 레지스트리 데이터와 Galaxy 데이터베이스 결합
- **스토어 및 다운로드 링크**: GOG Galaxy 직접 링크가 있는 스토어 페이지

### 개선된 대시보드

- **상단 연결 스토어**: 스토어가 마지막으로 연 게임 옆에 표시
- **실제 수치의 스토어 배지**: 스토어별 실제 게임 수 표시
- **마지막 게임 플레이스홀더**: 게임이 열리지 않았을 때 우아한 표시

### 향상된 게임 상세

- **정보 탭**: 시스템 요구사항, Metacritic 점수, 스토어 링크, DLC 목록
- **GOG 커버**: GOG 게임 커버 자동 폴백
- **GOG 설명**: GOG API를 통한 전체 설명 가져오기

### AI 제공자 수정

- **무료 제공자 영구 차단 없음**: MyMemory, Lingva는 쿨다운(30초) 사용
- **Steam Wishlist**: 레거시 폴백이 있는 새 IWishlistService 엔드포인트

### 성능

- **sessionStorage 캐시**: 게임 상세에서 라이브러리로 즉시 돌아가기
- **배치 커버 저장**: 경쟁 조건 방지를 위한 디바운스(2초) 저장
- **SteamGridDB 가져오기 중복 제거**: StrictMode에서 중복 요청 방지

### 크로스 플랫폼 빌드

- **Node.js 빌드 스크립트**: `build-tauri-cross.js`가 PowerShell 스크립트를 대체
- **Linux 지원**: GitHub Actions 워크플로가 Linux(.deb, .AppImage)도 빌드
- **Windows**: 설치 프로그램(.msi, .exe NSIS) 및 포터블 버전(.zip)

### 문서

- **11개 사용자 가이드**: 마크다운 린트 수정
- **인덱스 번호 수정**: 번호 건너뛰기 없는 정렬된 인덱스

---

## v1.4.2 새로운 기능

### Vision LLM 번역기

- **컨텍스트 인식 번역**: 게임 스크린샷을 사용하여 시각적 컨텍스트로 번역
- **3개 제공업체 지원**: Ollama(로컬), Gemini 2.0 Flash, OpenAI GPT-4o
- **업로드 또는 캡처**: 이미지를 업로드하거나 화면을 캡처하여 AI 컨텍스트 제공
- **전용 페이지**: `/vision-translator`(사이드바 통합)

### 고급 AI 도구

- **로어 어시스턴트**: 게임 로어와 대화를 탐색하는 RAG 채팅
- **오토 훅 스캐너**: WinAPI를 사용한 프로세스 메모리 스캔
- **시스템 모니터**: 실시간 VRAM/RAM 모니터링(Rust 백엔드)
- **Ollama 설정 마법사**: 단계별 로컬 AI 설치 가이드
- **디버그 콘솔**: 로그 인터셉트가 포함된 내장 디버그 콘솔
- **플러그인 시스템**: `PLUGIN_SYSTEM.md` 설계 문서

### 커뮤니티 허브

- **GitHub Discussions**: Announcements, General, Ideas, Q&A, Show and tell, Polls 카테고리에 12개 토론 생성
- **공개 REST API 가져오기**: 커뮤니티 허브가 GitHub 토큰 없이 토론을 로드
- **사이드바 이름 변경**: "Workshop" → "Steam Workshop"

### 번역 제공업체 수정

- **Ollama 쿨다운**: 네트워크 오류가 영구 차단 대신 30초 쿨다운 사용
- **Lingva 404**: 500자 이상 텍스트 자동 잘라내기(URL 오버플로 방지)
- **자동 번역 검토**: "미번역 전체 번역" 버튼 추가(진행률 표시줄 및 중지 기능)
- **튜토리얼 querySelector**: `:contains()` 선택자 SyntaxError 수정(비표준 CSS)
- **업데이트 벨**: 팝업의 잘못된 버전 수정(하드코딩된 폴백 제거)

### CI/CD 및 보안

- **Tauri 서명 키**: 릴리스에서 서명된 `latest.json` 자동 생성 구성
- **GitHub Secrets**: `TAURI_SIGNING_PRIVATE_KEY` 및 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 구성
- **워크플로 release.yml**: Windows + Linux 양쪽 작업에 서명 변수 추가

### Unity: BepInEx + XUnity AutoTranslator 자동 설치

- **Unity 자동 감지**: 스캐너가 Unity 게임에서 번역 가능한 파일을 찾지 못하면 일반 오류 대신 전용 카드를 표시
- **원클릭 설치**: “BepInEx + XUnity AutoTranslator 설치” 버튼이 게임 exe를 자동으로 감지하고 실시간 로그와 함께 프레임워크 및 번역 플러그인을 설치
- **안내 흐름**: 설치 후 게임을 한 번 실행하고 다시 스캔하도록 안내 — 모든 텍스트가 번역 가능해짐
- **크레딧**: BepInEx 팀 및 bbepis (XUnity AutoTranslator)

---

*GameStringer v1.4.2 - 가이드 업데이트 2026/03/03*
