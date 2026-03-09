# 📖 GameStringer - Guia do Usuário Completo

## Índice

1. [Visão Geral](#visão-geral)
2. [Primeiro Lançamento e Perfis](#primeiro-lançamento-e-perfis)
3. [Biblioteca e Detalhes do Jogo](#biblioteca-e-detalhes-do-jogo)
4. [Neural Translator Pro](#neural-translator-pro)
5. [Translation Wizard](#translation-wizard)
6. [Translation Bridge](#translation-bridge)
7. [Subtitle Translator Pro](#subtitle-translator-pro)
8. [Retro ROM Tools](#retro-rom-tools)
9. [API Pública v1](#api-pública-v1)
10. [Voice Clone Studio](#voice-clone-studio) *(NOVO v1.0.5)*
11. [VR Text Overlay](#vr-text-overlay) *(NOVO v1.0.5)*
12. [Quality Gates](#quality-gates) *(NOVO v1.0.5)*
13. [Player Feedback](#player-feedback) *(NOVO v1.0.5)*
14. [Novos Provedores AI v1.0.6](#novos-provedores-ai-v106) *(NOVO v1.0.6)*
15. [Community Hub v1.0.7](#community-hub-v107) *(NOVO v1.0.7)*
16. [Melhorias de UI v1.0.9](#melhorias-de-ui-v109) *(NOVO v1.0.9)*
17. [Danganronpa Auto-Tradutor](#danganronpa-auto-tradutor) *(NOVO v1.1.0)*
18. [Exportação de Patch](#exportação-de-patch)
19. [Aplicar ao Jogo](#aplicar-ao-jogo)
20. [Gerenciamento de Backup](#gerenciamento-de-backup)
21. [Editor de Traduções](#editor-de-traduções)
22. [Histórico de Atividades](#histórico-de-atividades)
23. [Dicionários](#dicionários)
24. [Solução de Problemas](#solução-de-problemas)
25. [Glossário](#glossário)
26. [Context Harvester](#context-harvester)
27. [Memória de Tradução](#memória-de-tradução)
28. [Tradutor OCR](#tradutor-ocr)
29. [Revisão AI](#revisão-ai)
30. [Pipeline AI](#pipeline-ai)
31. [Tradutor de Emoções](#tradutor-de-emoções)
32. [Adaptação Cultural](#adaptação-cultural)
33. [Mapa de Calor de Confiança](#mapa-de-calor-de-confiança)
34. [Gestor de Blog](#gestor-de-blog)
35. [Ren'Py Patcher](#renpy-patcher)
36. [RPG Maker Patcher](#rpg-maker-patcher)
37. [Wolf RPG Patcher](#wolf-rpg-patcher)
38. [Danganronpa Patcher](#danganronpa-patcher)
39. [Comparação Multi-LLM](#comparação-multi-llm) *(NOVO)*
40. [Pontuação de Qualidade ao Vivo](#pontuação-de-qualidade-ao-vivo) *(NOVO)*
41. [Perfis de Voz de Personagem](#perfis-de-voz-de-personagem) *(NOVO)*
42. [Pipeline de Tradução por Voz](#pipeline-de-tradução-por-voz) *(NOVO)*
43. [OCR Multi-Motor](#ocr-multi-motor) *(NOVO)*
44. [OCR Jogos Retro](#ocr-jogos-retro) *(NOVO)*
45. [MT Adaptativa](#mt-adaptativa) *(NOVO)*
46. [Tradutor Batch de Pastas](#tradutor-batch-de-pastas) *(NOVO)*
47. [Tradutor Offline](#tradutor-offline) *(NOVO)*
48. [Tradutor Manga/Quadrinhos](#tradutor-mangaquadrinhos) *(NOVO)*
49. [Tradutor de Texturas](#tradutor-de-texturas) *(NOVO)*
50. [Auto-Glossário](#auto-glossário) *(NOVO)*

---

## Visão Geral

GameStringer é um sistema avançado para tradução automática e manual de videojogos. Suporta:

- **Motores de jogo**: Unity, Unreal Engine, RPG Maker, Ren'Py, Godot, Telltale, Wolf RPG, Kirikiri e outros
- **Formatos de arquivo**: CSV, JSON, XML, PO/POT, YAML, TXT, SRT, VTT, ASS/SSA e outros
- **Provedores AI**: Claude, Gemini, GPT, DeepSeek, Mistral, Groq, Ollama, **Qwen 3**, **NLLB-200** (18+ provedores)
- **Idiomas**: 200+ idiomas suportados (com NLLB-200)
- **UI Multilingual**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL (11 idiomas)
- **Lojas de Jogos**: Steam, Epic Games, GOG, Origin, Battle.net, Ubisoft, itch.io, Amazon Games
- **NOVO v1.0.5**: Voice Clone Studio, VR Text Overlay, Quality Gates, Player Feedback
- **NOVO v1.0.6**: Qwen 3 (idiomas asiáticos), NLLB-200 (200 idiomas), correções
- **NOVO v1.0.7**: Community Hub, GitHub Discussions, Licença v1.1
- **NOVO v1.0.8**: Correção de download de atualizações
- **NOVO v1.0.9**: Cabeçalhos animados, notificações de atualização, melhorias de UI
- **NOVO v1.4.0**: Radix UI unificado, Quality Badges por linha, suporte RTL, Ollama genérico, limpeza TypeScript
- **NOVO v1.4.1**: GOG Galaxy completo, dashboard melhorado, aba Info, fix provedores AI, build multiplataforma Linux

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

## Glossário

O Glossário gerencia dicionários de terminologia personalizados para cada jogo, garantindo consistência nas traduções.

### Funcionalidades

- **Níveis de termos**:
  - 🔴 **Locked** — termo sempre traduzido de forma idêntica (nomes próprios, feitiços, locais)
  - 🟡 **Synced** — tradução consistente, adaptável ao contexto
  - 🟢 **Flexible** — tradução livre
- **Categorias**: personagem, local, item, habilidade, quest, UI, sistema, lore, criatura, facção
- **Extração automática**: análise IA para sugerir termos
- **Verificação de consistência**: verifica tradução uniforme em todos os arquivos
- **Importar/Exportar**: CSV e JSON para compartilhar glossários entre jogos

### Como usar

1. Vá para **Ferramentas Avançadas → Glossário**
2. Selecione o jogo da lista
3. Adicione termos manualmente ou use **“Extrair termos”** para sugestões IA
4. Defina o nível para cada termo
5. O glossário é aplicado automaticamente durante as traduções

---

## Context Harvester

Analisa strings de texto para classificá-las e enriquecê-las com contexto antes da tradução IA, melhorando a qualidade.

### Funcionalidades

- **Classificação automática**: identifica tipo de tela (menu, diálogo, narrativa, tutorial, sistema)
- **Reconhecimento de falante**: infere quem fala e o tipo de tom (formal, coloquial, agressivo)
- **Metadados de contexto**: cada string recebe gênero de jogo, tipo de conteúdo e tom
- **Salvamento de harvest**: contextos extraídos salvos e reutilizados em sessões futuras
- **Processamento em lote**: analisa arquivos inteiros em uma operação

### Como usar

1. Vá para **Ferramentas Avançadas → Context Harvester**
2. Cole as strings ou carregue um arquivo
3. Clique em **“Analisar”** para classificar cada string
4. Baixe o resultado JSON como entrada para traduções IA

---

## Memória de Tradução

Banco de dados persistente de todas as traduções concluídas, com reutilização automática em novas sessões.

### Funcionalidades

- **Reutilização automática**: strings já traduzidas são sugeridas sem nova chamada IA
- **Pesquisa**: por texto original, tradução ou nome do jogo
- **Filtro por jogo**: exibe apenas traduções de um título específico
- **Estatísticas**: unidades totais, distribuição por jogo, data da última modificação
- **Exportar**: JSON, CSV, TMX para outras ferramentas CAT
- **Importar**: importa traduções existentes de TMX ou CSV

### Como usar

1. Vá para **Ferramentas Avançadas → Memória de Tradução**
2. Pesquise traduções anteriores com a barra de pesquisa
3. Edite ou exclua unidades individuais conforme necessário
4. A memória é consultada automaticamente durante traduções IA

---

## Tradutor OCR

Captura texto de qualquer janela de jogo ou captura de tela em tempo real e o traduz instantaneamente.

### Funcionalidades

- **Captura em tempo real**: analisa a tela em intervalos configuráveis
- **Idiomas de origem**: japonês, inglês, chinês simplificado, coreano
- **Seleção de janela**: aponta diretamente para a janela do jogo
- **Seleção de região**: define uma área específica da tela para análise
- **Confiança**: mostra nível de confiabilidade para cada texto detectado
- **Atalho global**: ativa/desativa captura com atalho de teclado
- **Cache de traduções**: reutiliza traduções anteriores para strings idênticas

### Como usar

1. Vá para **Tradutor OCR** na barra lateral
2. Selecione o idioma de origem do jogo
3. Clique em **“Selecionar janela”** e escolha a janela do jogo
4. *(Opcional)* Defina uma região específica com **“Selecionar região”**
5. Pressione **“Iniciar”** para começar a captura e tradução automáticas

---

## Revisão AI

Revisão automática de qualidade das traduções com detecção de erros e sugestões de correção.

### Funcionalidades

- **Modo individual**: revisão de um par original/tradução
- **Modo em lote**: revisão em massa no formato `original|tradução` por linha
- **Categorias de problemas**: precisão, fluência, terminologia, tom, estrutura
- **Níveis de gravidade**: crítico, aviso, informação
- **Auto-fix**: correção automática de problemas menores
- **Estatísticas**: pontuação global 0–100 por lote

### Como usar

1. Vá para **Ferramentas Avançadas → Revisão AI**
2. Escolha entre **Individual** ou **Lote**
3. Cole o texto original e a tradução
4. Clique em **“Revisar”** para receber o relatório
5. Use **“Auto-fix”** para aplicar as correções sugeridas

---

## Pipeline AI

Fluxo de trabalho automatizado de 6 etapas para obter traduções de máxima qualidade com um clique.

### Etapas do Pipeline

1. **Harvest** — extrai e classifica contexto
2. **Translate** — traduz com o provedor IA configurado
3. **QA Check** — verificação automática de qualidade
4. **Auto-Fix** — corrige problemas encontrados
5. **Review** — revisão IA final
6. **Score** — calcula pontuação final 0–100

### Predefinições disponíveis

- **Quick** — etapas essenciais (Translate + QA Check)
- **Max Quality** — todas as 6 etapas em sequência

### Como usar

1. Vá para **Ferramentas Avançadas → Pipeline AI**
2. Cole as strings a traduzir
3. Escolha uma predefinição ou configure as etapas manualmente
4. Clique em **“Executar Pipeline”**
5. Baixe o relatório final com pontuações por string

---

## Tradutor de Emoções

Tradução que analisa e preserva as emoções presentes no diálogo original.

### Funcionalidades

- **Análise emocional**: detecta a emoção predominante (raiva, tristeza, medo, alegria, neutro, surpresa, repulsa)
- **Intensidade**: mede o nível de intensidade emocional (0–100)
- **Preservação do tom**: guia a IA para manter o mesmo impacto emocional
- **EmotionBadge**: rótulo visual por string com emoção e intensidade
- **Estatísticas em lote**: distribuição de emoções em um arquivo inteiro

### Como usar

1. Vá para **Ferramentas Avançadas → Tradutor de Emoções**
2. Cole o texto a traduzir
3. Selecione o idioma de destino
4. Clique em **“Analisar e Traduzir”**
5. O resultado mostra a tradução com as emoções identificadas

---

## Adaptação Cultural

Analisa o texto traduzido para identificar elementos culturalmente problemáticos e propõe adaptações.

### Funcionalidades

- **Culturas suportadas**: IT, EN, DE, FR, ES, JA, KO, ZH, PT, RU
- **Categorias analisadas**: expressões idiomáticas, referências culturais, medidas/moedas, cores simbólicas, fórmulas de cortesia, humor
- **Sugestões específicas**: para cada elemento, propõe uma alternativa adequada à cultura alvo
- **Pontuação de adaptação**: percentagem de texto que requer revisão

### Como usar

1. Vá para **Ferramentas Avançadas → Adaptação Cultural**
2. Cole o texto traduzido
3. Selecione cultura de origem e destino
4. Clique em **“Analisar”**
5. Aplique as sugestões antes da publicação final

---

## Mapa de Calor de Confiança

Visualiza a qualidade de cada tradução através de um mapa codificado por cores, identificando instantaneamente as strings problemáticas.

### Funcionalidades

- **8 métricas analisadas**: marcadores de posição em falta, strings vazias, não traduzidas, pontuação, maiúsculas, etiquetas HTML, comprimento, números
- **Código de cores**:
  - 🟢 **Excelente** (90–100%) — tradução correta
  - 🔵 **Boa** (75–89%) — pequenos problemas de estilo
  - 🟡 **Aceitável** (60–74%) — problemas menores
  - 🟠 **Rever** (40–59%) — erros significativos
  - 🔴 **Fraca** (<40%) — erros críticos
- **3 modos de entrada**: demo integrada, colar texto (`original|tradução` por linha), carregar ficheiro (JSON/CSV/TXT)
- **Exportar relatório**: transfere JSON com pontuações e problemas para cada string

### Como usar

1. Vá para **Ferramentas Avançadas → Mapa de Calor de Confiança**
2. Escolha o modo: **Demo** para ver um exemplo, **Colar** para entrada manual, **Ficheiro** para carregar
3. Clique em **"Analisar"**
4. Reveja o relatório de cores: strings vermelhas/cor-de-laranja requerem revisão prioritária
5. Use **"Exportar Relatório"** para guardar o resultado em JSON

---

## Gestor de Blog

Gere um blog de notícias e atualizações para o projeto de tradução, visível no painel de controlo.

### Funcionalidades

- **Criar publicações**: título, data, descrição curta, etiqueta de categoria
- **Etiquetas disponíveis**: Feature, UI, Fix, Security, AI, Update, News
- **Afixar**: fixa publicações importantes no topo da lista
- **Edição em linha**: edita qualquer publicação sem mudar de página
- **Eliminar publicação**: remoção com confirmação
- **Visualização**: lista cronológica com data estilizada, badge de etiqueta colorida e pré-visualização da descrição

### Como usar

1. Vá para **Gestor de Blog** no menu principal
2. Clique em **"Nova Publicação"**
3. Preencha data (ex. "24 Jan"), título (com emojis recomendados), descrição e etiqueta
4. Clique em **"Guardar"**
5. Use o ícone 📌 para afixar uma publicação no topo

---

## Ren'Py Patcher

Patcher dedicado para novelas visuais criadas com o motor Ren'Py. Extrai diálogos, menus e narração de ficheiros `.rpy` e gera os ficheiros de tradução nativos.

### Funcionalidades

- **Deteção automática**: identifica título, versão e ficheiros de script do jogo
- **Tipos de string**: Diálogo, Menu, Narração
- **Identificação de personagem**: mostra qual personagem diz cada fala
- **Editor em linha**: clique em qualquer string para editar a tradução
- **Pesquisar e filtrar**: pesquise por texto ou personagem, filtre por tipo
- **Gerar ficheiros `.rpy`**: cria a estrutura `tl/<idioma>/` compatível com Ren'Py
- **Guardar/Carregar JSON**: guarda o progresso e retoma mais tarde
- **Estatísticas**: percentagem de conclusão, contagem por tipo

### Como usar

1. Vá para **Ren'Py Patcher** na barra lateral
2. Clique em **"Procurar"** e selecione a pasta do jogo Ren'Py
3. Clique em **"Extrair Strings"**
4. Edite as traduções no editor (clique numa string para a editar)
5. Introduza o nome do idioma destino (ex. `portuguese`) e clique em **"Gerar .rpy"**
6. Os ficheiros são guardados na pasta `tl/` do jogo

---

## RPG Maker Patcher

Patcher dedicado para jogos RPG Maker (MV, MZ, XP, VX, VX Ace). Lê os ficheiros `.json` e `.rxdata`/`.rvdata` do projeto.

### Funcionalidades

- **Deteção de versão**: identifica automaticamente MV/MZ/XP/VX/Ace
- **Ficheiros suportados**: Actors, Classes, Skills, Items, Weapons, Armors, Enemies, Troops, States, Maps, CommonEvents, System
- **Estatísticas por ficheiro**: progresso de tradução dividido por ficheiro
- **Integração Translator++**: link direto de transferência do Translator++
- **Exportar patch**: guarda as traduções em JSON
- **Editor**: pesquisa de texto completo, edição em linha

### Como usar

1. Vá para **RPG Maker Patcher** na barra lateral
2. Selecione a pasta do projeto RPG Maker
3. Clique em **"Extrair Strings"**
4. Traduza as strings no editor
5. Clique em **"Guardar Patch"**

---

## Wolf RPG Patcher

Patcher dedicado para jogos Wolf RPG Editor. Gere ficheiros binários `.wolf` e mapas do jogo.

### Funcionalidades

- **Ficheiros suportados**: Data/*.wolf (base de dados), Map/*.mps (mapas)
- **Tipos de string**: Base de dados, Mapa, Script, Evento
- **Deteção de encriptação**: avisa se o jogo usa ficheiros encriptados
- **Integração WolfTrans**: sugere WolfTrans para ficheiros encriptados
- **Barra de progresso**: percentagem de conclusão para todo o projeto
- **Guardar/Carregar**: JSON para retomar o trabalho

### Como usar

1. Vá para **Wolf RPG Patcher** na barra lateral
2. Selecione a pasta do jogo Wolf RPG
3. Clique em **"Extrair Strings"**
4. Se o jogo estiver encriptado, siga as instruções do WolfTrans
5. Traduza as strings e clique em **"Guardar"**

---

## Danganronpa Patcher

Patcher dedicado para a série de jogos Danganronpa. Gere arquivos `.pak` e ficheiros de localização `.po`.

### Funcionalidades

- **Deteção de jogo**: identifica automaticamente DR1, DR2, V3
- **Arquivos PAK**: extrai e lista ficheiros em arquivos `.pak`
- **Ficheiros PO**: suporte nativo para `.po`/`.pot` com estado traduzido/não traduzido/aproximado
- **Tradução IA integrada**: botão para traduzir automaticamente strings com a IA configurada
- **Estatísticas PO**: contagem de traduzido, não traduzido, aproximado e percentagem
- **Integração DRAT**: link para a ferramenta DRAT para operações avançadas
- **Exportar patch**: exporta o ficheiro `.po` modificado

### Como usar

1. Vá para **Danganronpa Patcher** na barra lateral
2. Selecione a pasta do jogo Danganronpa
3. Extraia o arquivo `.pak` ou carregue diretamente um ficheiro `.po`
4. Edite as strings no editor ou use **"Traduzir com IA"**
5. Exporte o ficheiro `.po` completo para reimportar no jogo

---

## Comparação Multi-LLM

A Comparação Multi-LLM envia o mesmo texto para múltiplos fornecedores de IA em paralelo e seleciona automaticamente a melhor tradução.

### Fornecedores suportados

- **OpenAI** (GPT-4o)
- **Gemini** (Google)
- **Claude** (Anthropic)
- **DeepSeek**
- **Mistral**
- **DeepL**
- **Libre Translate**

### Funcionalidades

- **Comparação paralela**: tradução simultânea com 2–7 fornecedores
- **Seleção automática**: o sistema escolhe a tradução com maior pontuação
- **Tradução de consenso**: quando vários modelos concordam, é gerada uma versão combinada
- **Pontuação de qualidade**: cada tradução recebe uma pontuação em fluência, precisão, coerência e estilo
- **Perfis de personagem**: aplique um perfil de voz para personalizar tom e vocabulário

### Como usar

1. Vá para **Translator → Compare** na barra lateral
2. Insira o texto de origem e selecione o idioma de destino
3. Escolha pelo menos 2 fornecedores na barra superior
4. Clique em **"Comparar"** para lançar as traduções em paralelo
5. Revise os resultados com pontuação e escolha a sua tradução preferida, ou use a selecionada automaticamente

---

## Pontuação de Qualidade ao Vivo

O sistema de Pontuação de Qualidade ao Vivo avalia automaticamente cada tradução em múltiplas dimensões, atribuindo uma pontuação numérica e uma categoria.

### Dimensões avaliadas

| Dimensão | Descrição |
|---|---|
| **Fluência** | Naturalidade e legibilidade no idioma de destino |
| **Precisão** | Fidelidade ao significado original |
| **Coerência** | Consistência terminológica com o resto do projeto |
| **Estilo** | Adequação do tom e registo ao contexto do jogo |

### Categorias de pontuação

- **Excelente** (90–100): tradução pronta para publicação
- **Boa** (75–89): pequenas melhorias opcionais
- **Aceitável** (60–74): revisão recomendada
- **A rever** (40–59): correções necessárias
- **Fraca** (0–39): retradução necessária

### Controlos automáticos

- Preservação de números e marcadores de posição (`{0}`, `%s`, etc.)
- Coerência no comprimento em relação ao original
- Deteção de palavras não traduzidas
- Verificação de pontuação e formato

---

## Perfis de Voz de Personagem

Os Perfis de Voz de Personagem permitem personalizar as traduções com base na personalidade de cada personagem do jogo.

### Arquétipos disponíveis

Hero, Villain, Mentor, Sidekick, Love Interest, Comic Relief, Mysterious Stranger, Noble, Pirate, Warrior, Wizard, Merchant, Child, Robot, Monster, Narrator — ou **Custom**.

### Parâmetros configuráveis

- **Personalidade**: arquétipo, traços de carácter, humor, idade, género
- **Estilo de fala**: formalidade (muito formal → muito informal), vocabulário (arcaico, sofisticado, padrão, simples, gíria, técnico), comprimento de frases, pontuação
- **Padrões**: frases recorrentes, palavras de preenchimento, sufixos finais, palavras a evitar, substituições preferidas
- **Voz TTS** *(opcional)*: fornecedor (OpenAI, ElevenLabs, Azure), voz, tom, velocidade, emoção
- **Exemplos de diálogo**: pares original/traduzido para guiar a IA

### Como usar

1. Abra o **Character Profile Manager** no painel de tradução
2. Escolha um arquétipo predefinido ou crie um perfil personalizado
3. Configure personalidade, estilo, padrões e vocabulário
4. Adicione exemplos de diálogo para melhorar a coerência
5. Guarde o perfil — será aplicado automaticamente em traduções futuras para esse personagem

---

## Pipeline de Tradução por Voz

A Pipeline de Tradução por Voz transforma áudio falado em texto traduzido e sintetizado noutra língua, num único fluxo de ponta a ponta.

### Etapas da pipeline

1. **Gravação / Upload**: grave áudio do microfone ou carregue um ficheiro de áudio
2. **Transcrição (Whisper)**: conversão de fala para texto via OpenAI Whisper
3. **Tradução IA**: tradução do texto transcrito para o idioma de destino
4. **Síntese de voz (TTS)**: geração do áudio traduzido com vozes sintéticas

### Vozes disponíveis

| Voz | Característica |
|---|---|
| **Nova** | Feminina, natural |
| **Alloy** | Neutra, versátil |
| **Echo** | Masculina, calorosa |
| **Fable** | Narrativa, expressiva |
| **Onyx** | Masculina, profunda |
| **Shimmer** | Feminina, brilhante |

### Como usar

1. Vá para **Voice Translator** na barra lateral
2. Grave áudio com o microfone ou carregue um ficheiro `.wav`/`.mp3`
3. O sistema transcreve automaticamente o áudio com Whisper
4. Selecione o idioma de destino e inicie a tradução
5. Escolha uma voz TTS e gere o áudio traduzido
6. Reproduza ou descarregue o resultado

> **Nota**: Requer uma chave API OpenAI configurada para Whisper e TTS.

---

## OCR Multi-Motor

O OCR Multi-Motor suporta 4 motores OCR com deteção automática e fallback inteligente para reconhecimento de texto a partir de capturas de ecrã de jogos.

### Motores suportados

| Motor | Descrição | Pontos fortes |
|---|---|---|
| **OneOCR** | Windows 11 AI nativo (porta 17231) | Fontes estilizadas, texto sobreposto, baixa resolução |
| **PaddleOCR** | Baidu open-source (porta 8866) | CJK excelente, texto vertical, alta precisão |
| **RapidOCR** | Wrapper leve ONNX (porta 9003) | Rápido, leve, fácil de instalar |
| **Tesseract.js** | Integrado no browser | Sempre disponível, 100+ idiomas, sem configuração |

### Funcionalidades

- **Deteção automática**: sondagem dos motores disponíveis ao arranque
- **Cadeia de fallback**: OneOCR → PaddleOCR → RapidOCR → Tesseract (CJK: PaddleOCR primeiro)
- **Modo comparação**: executa todos os motores em paralelo e usa o melhor resultado
- **Pré-processamento de imagem**: escala de cinzentos, contraste, limiar, ampliação para texto pequeno
- **Motor preferido**: guarda a preferência para sessões futuras

### Como usar

1. Vá para **OCR Multi-Engine** na barra lateral
2. Clique em **"Detetar Motores"** para verificar quais estão online
3. Selecione o motor preferido clicando no cartão correspondente
4. Carregue uma captura de ecrã ou cole uma imagem
5. O sistema reconhece o texto com o motor escolhido (ou fallback automático)

---

## OCR Jogos Retro

OCR Jogos Retro é um módulo especializado para reconhecimento de texto a partir de capturas de jogos retro com fontes pixeladas.

### Presets disponíveis

| Preset | Era | Otimização |
|---|---|---|
| **8-bit** | NES, Game Boy, MSX | Ampliação 4x, limiar alto, remoção de dithering |
| **16-bit** | SNES, Mega Drive, PC Engine | Ampliação 3x, contraste médio, sharpen |
| **DOS/PC** | DOS, EGA/VGA | Ampliação 2x, limiar médio, fonte monoespaçada |
| **PC-98** | NEC PC-98 (japonês) | Ampliação 3x, limiar alto, otimizado CJK |
| **Early Windows** | Windows 3.1/95/98 | Ampliação 2x, contraste leve |

### Parâmetros configuráveis

- **Ampliação**: fator de ampliação (nearest-neighbor para preservar pixels)
- **Contraste**: aumento do contraste antes do reconhecimento
- **Limiar binário**: conversão preto/branco com limiar configurável
- **Remoção de dithering**: filtra padrões de dithering típicos de jogos retro
- **Sharpen / Denoise**: nitidez e redução de ruído

### Como usar

1. Abra o painel **Retro-Game OCR** na secção OCR
2. Escolha um preset de jogo ou configure os parâmetros manualmente
3. Carregue a captura do jogo retro
4. O sistema pré-processa a imagem e aplica reconhecimento otimizado
5. Reveja e edite o texto reconhecido

---

## MT Adaptativa

MT Adaptativa (Tradução Automática Adaptativa) é um sistema que aprende com as correções humanas para melhorar progressivamente a qualidade das traduções.

### Como funciona

1. **Guardar correções**: quando corrige uma tradução AI, o par (original → correção) é guardado
2. **Similaridade fuzzy**: trigramas (coeficiente Dice) + similaridade de palavras (Jaccard) para encontrar correções relevantes
3. **Few-shot learning**: as correções mais semelhantes ao texto atual são injetadas no prompt como exemplos
4. **Feedback loop**: quanto mais correções guardar, melhores serão as traduções futuras

### Funcionalidades

- **Auto-deteção de tags**: tone_change, terminology, major_rewrite, length_change, punctuation, style
- **Boost contextual**: prioridade a correções do mesmo jogo (1.3x), mesmo tipo de conteúdo (1.2x), correções recentes
- **Aprovação**: marque correções como verificadas para maior fiabilidade
- **Import/Export**: exporte e importe conjuntos de correções entre projetos
- **Estatísticas**: número de correções por idioma, jogo, tipo, tag e utilização média

### Configuração

| Parâmetro | Padrão | Descrição |
|---|---|---|
| **Max examples** | 5 | Máximo de exemplos few-shot por prompt |
| **Limiar similaridade** | 0.2 | Mínimo de similaridade para incluir um exemplo |
| **Mesmo jogo** | Sim | Preferir correções do mesmo jogo |
| **Só aprovadas** | Não | Usar apenas correções marcadas como aprovadas |

---

## Tradutor Batch de Pastas

O Tradutor Batch de Pastas traduz pastas inteiras de ficheiros numa única operação, preservando a estrutura original.

### Funcionalidades

- **Verificação recursiva**: verifica automaticamente subpastas
- **Multi-formato**: suporta CSV, JSON, XML, PO, YAML, TXT, SRT, VTT e mais
- **Seleção inteligente**: filtra por tipo de ficheiro, tamanho ou padrão
- **Saída flexível**: pasta de saída personalizável com estrutura preservada
- **Tradução paralela**: até 3 batches simultâneos para máxima velocidade
- **Translation Memory**: usa e alimenta a memória de tradução automaticamente
- **Classificação de conteúdo**: classifica as strings por tipo (diálogo, UI, sistema) antes da tradução
- **Controlo de qualidade**: QA automático com pontuação mínima configurável
- **Pausa/Retomar**: pause e retome a tradução a qualquer momento

### Parâmetros

| Parâmetro | Padrão | Descrição |
|---|---|---|
| **Tamanho batch** | 40 | Strings por chamada API |
| **Paralelos** | 3 | Batches simultâneos |
| **Atraso** | 50ms | Pausa entre batches |
| **Pontuação mín.** | 70 | Limiar mínimo de qualidade |
| **Max tentativas** | 3 | Tentativas em caso de erro |

### Como usar

1. Vá para **Batch Translator** na barra lateral
2. Selecione a pasta de origem com os ficheiros a traduzir
3. Escolha idioma de origem, idioma de destino e fornecedor AI
4. Configure as opções (TM, QA, classificação, pipeline)
5. Clique em **"Iniciar"** para começar a tradução batch
6. Monitorize o progresso em tempo real — pode pausar ou cancelar

---

## Tradutor Offline

O Tradutor Offline permite traduzir textos sem conexão à internet, utilizando modelos AI locais via Ollama. Nenhum dado é enviado online.

### Requisitos

- **Ollama** instalado e em execução (`ollama serve`)
- Pelo menos um modelo de tradução descarregado

### Modelos recomendados

| Modelo | Tamanho | Descrição |
|---|---|---|
| **huihui_ai/hy-mt1.5-abliterated:7b** | ~4.5 GB | Tencent HY-MT 1.5 — #1 WMT25, supera o Google Translate em 30/31 idiomas |
| **huihui_ai/hy-mt1.5-abliterated:1.8b** | ~1.2 GB | Versão leve e ultra-rápida |
| **translategemma:12b** | ~8.0 GB | Google TranslateGemma — 55 idiomas, alta qualidade |
| **translategemma:2b** | ~1.5 GB | Google TranslateGemma — 55 idiomas, rápido e leve |
| **qwen3:4b** | ~2.5 GB | Alibaba Qwen 3 — uso geral, bom para tradução |

### Funcionalidades

- **Modo individual**: traduza um texto de cada vez
- **Modo batch**: traduza múltiplos textos (um por linha) numa única operação
- **14 idiomas suportados**: IT, EN, FR, DE, ES, PT, RU, JA, KO, ZH, PL, NL, TR, CS
- **Troca de idiomas**: inverta origem e destino com um clique
- **Seleção de modelo**: escolha entre os modelos instalados no Ollama
- **Histórico de resultados**: todos os resultados mostrados com tempo de tradução
- **Copiar resultados**: copie tradução individual ou todas juntas
- **Setup integrado**: inicie o Ollama e descarregue modelos diretamente da interface

### Como usar

1. Vá a **Tradutor Offline** na barra lateral
2. Se o Ollama não estiver em execução, clique em **"Iniciar Ollama"** no painel de configuração
3. Descarregue um modelo recomendado (ex. `hy-mt1.5-abliterated:7b`)
4. Selecione idioma de origem e destino
5. Introduza o texto e clique em **"Traduzir"** (ou Ctrl+Enter)
6. Para batch: ative o modo batch e introduza múltiplas linhas

---

## Tradutor Manga/Quadrinhos

O Tradutor Manga/Quadrinhos é uma ferramenta especializada para tradução de banda desenhada e manga, com deteção automática de balões, OCR, tradução e inpainting.

### Funcionalidades

- **Deteção de balões**: identifica automaticamente os balões de texto nas páginas
- **OCR integrado**: reconhece o texto dentro dos balões (horizontal e vertical)
- **Tradução automática**: traduz o texto reconhecido para o idioma de destino
- **Inpainting**: remove o texto original e substitui pela tradução
- **Estilos de fonte**: Manga Style, Comic Sans, Handwritten, Bold
- **Multi-página**: gerencie múltiplas páginas simultaneamente
- **Tradução batch**: processe todas as páginas em sequência
- **Exportação**: exporte página individual ou todas as páginas traduzidas

### Idiomas suportados

JA (japonês), ZH (chinês), KO (coreano), EN (inglês), IT (italiano), ES (espanhol), FR (francês), DE (alemão)

### Como usar

1. Vá a **Manga Translator** na barra lateral
2. Carregue as páginas do manga/quadrinho (arrastar e soltar ou seleção de ficheiros)
3. Selecione idioma de origem e destino
4. Clique em **"Detetar & Traduzir"** para analisar a página atual
5. Revise os balões detetados e as traduções
6. Clique em **"Inpainting"** para aplicar as traduções na imagem
7. Exporte a página traduzida

---

## Tradutor de Texturas

O Tradutor de Texturas traduz o texto presente nas texturas de videojogos (menus, HUD, botões, UI), preservando o estilo gráfico e a formatação.

### Formatos suportados

| Formato | Descrição |
|---|---|
| **DDS** | DirectDraw Surface (o mais comum em jogos) |
| **PNG** | Portable Network Graphics |
| **TGA** | Targa |
| **BMP** | Bitmap |
| **JPG** | JPEG |
| **WebP** | WebP |

### Funcionalidades

- **Deteção de regiões**: escaneia a textura para encontrar áreas com texto
- **OCR para texturas**: reconhece o texto nas regiões detetadas
- **Tradução automática**: traduz o texto preservando o contexto visual
- **Preservar estilo**: mantém cores de fundo, cor do texto, fonte e tamanho
- **Auto-match de fonte**: seleciona automaticamente a fonte mais similar
- **Pré-visualização**: mostra a pré-visualização da textura antes e depois da tradução
- **Processamento batch**: processa todas as texturas em sequência
- **Exportação**: exporte textura individual ou todas as texturas modificadas

### Como usar

1. Vá a **Texture Translator** na barra lateral
2. Carregue as texturas (arrastar e soltar, seleção de ficheiros ou pasta inteira)
3. Selecione idioma de origem e destino
4. Clique em **"Escanear Textura"** para detetar as regiões de texto
5. Revise e edite as traduções propostas
6. Clique em **"Aplicar Traduções"** para gerar a textura traduzida
7. Exporte as texturas modificadas

---

## Auto-Glossário

O Auto-Glossário extrai automaticamente termos de jogo dos textos usando LLM, guarda-os num glossário por jogo e injeta-os nos prompts de tradução para garantir coerência terminológica.

### Sistema de 3 níveis

| Nível | Ícone | Comportamento |
|---|---|---|
| **Locked** | 🔒 | Tradução fixa, nunca modificada pela AI |
| **Synced** | 🔄 | Tradução preferida, a AI pode sugerir alternativas |
| **Flexible** | 🔓 | Tradução sugerida, a AI escolhe a melhor |

### Categorias de termos

👤 Personagem, 📍 Local, 🎒 Objeto, ⚔️ Habilidade, 📜 Missão, 🖥️ UI, ⚙️ Sistema, 📚 Lore, 🐉 Criatura, 🏰 Fação, 📌 Outro

### Funcionalidades

- **Extração automática**: analisa os textos do jogo com LLM e extrai os termos chave
- **Termos padrão**: adiciona automaticamente termos gaming comuns (HP, XP, NPC, etc.)
- **Pesquisa e filtro**: pesquise por texto, filtre por nível ou categoria
- **Injeção nos prompts**: os termos são automaticamente injetados nos prompts de tradução
- **Do Not Translate**: marque termos que não devem ser traduzidos
- **Case-sensitive**: opção para termos sensíveis a maiúsculas (nomes próprios)
- **Import/Export**: exporte e importe glossários em formato CSV ou JSON
- **Controlo de coerência**: verifica que os termos são usados de forma coerente nas traduções
- **Estatísticas**: número de termos por nível, categoria e origem (auto/manual)

### Configuração

| Parâmetro | Padrão | Descrição |
|---|---|---|
| **Ativado** | Sim | Ativa/desativa o glossário automático |
| **Extrair no primeiro batch** | Sim | Extrai termos do primeiro batch traduzido |
| **Max termos por extração** | 20 | Máximo de termos extraídos por vez |
| **Confiança mínima** | 50 | Limiar mínimo de confiança (0–100) |
| **Injetar nos prompts** | Sim | Injeta termos nos prompts de tradução |
| **Max termos no prompt** | 30 | Máximo de termos por prompt (limita context window) |

### Como usar

1. Vá a **Glossário** na barra lateral
2. Crie um novo glossário selecionando jogo, idioma de origem e destino
3. Adicione termos manualmente ou clique em **"Extrair Termos"** para extração AI
4. Configure o nível (Locked/Synced/Flexible) e a categoria para cada termo
5. Os termos são automaticamente injetados nos prompts de tradução
6. Use **"Verificar Coerência"** para verificar o uso uniforme dos termos

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

## Novidades v1.4.1

### Suporte Completo GOG Galaxy

- **Leitura biblioteca GOG Galaxy 2.0**: lê jogos possuídos do banco de dados SQLite local
- **Capas e descrições via GOG API**: busca automática de imagens e detalhes
- **Fusão com jogos instalados**: combina dados do registro com banco Galaxy
- **Links de loja e download**: página Store com links diretos GOG Galaxy

### Dashboard Melhorado

- **Lojas conectadas no topo**: lojas agora ficam ao lado do último jogo aberto
- **Badges de loja com contagens reais**: mostra número real de jogos por loja
- **Placeholder último jogo**: exibição elegante quando nenhum jogo foi aberto

### Detalhe do Jogo Aprimorado

- **Aba Info**: requisitos do sistema, pontuação Metacritic, links de loja, lista DLC
- **Capas GOG**: fallback automático para capas de jogos GOG
- **Descrições GOG**: busca completa de descrição via GOG API

### Correções Provedores AI

- **Provedores gratuitos nunca bloqueados permanentemente**: MyMemory, Lingva usam cooldown (30s)
- **Steam Wishlist**: novo endpoint IWishlistService com fallback legacy

### Desempenho

- **Cache sessionStorage**: navegação instantânea de volta do detalhe para biblioteca
- **Salvamento batch de capas**: com debounce (2s) para evitar race conditions
- **Dedup fetch SteamGridDB**: evita requisições duplicadas no StrictMode

### Build Multiplataforma

- **Script build Node.js**: `build-tauri-cross.js` substitui o script PowerShell
- **Suporte Linux**: workflow GitHub Actions agora compila para Linux (.deb, .AppImage)
- **Windows**: instalador (.msi, .exe NSIS) e versão portátil (.zip)

### Documentação

- **11 guias do usuário**: correções markdown lint
- **Numeração de índice corrigida**: índice ordenado sem saltos

---

## Novidades v1.4.2

### Vision LLM Translator

- **Tradução context-aware**: usa capturas de tela do jogo para contexto visual
- **3 provedores suportados**: Ollama (local), Gemini 2.0 Flash, OpenAI GPT-4o
- **Upload ou captura**: carregue uma imagem ou capture a tela para contexto IA
- **Página dedicada**: `/vision-translator` com sidebar integrada

### Ferramentas IA Avançadas

- **Lore Assistant**: chat RAG para explorar lore e diálogos do jogo
- **Auto-Hook Scanner**: varredura de memória de processos com WinAPI
- **System Monitor**: monitoramento VRAM/RAM em tempo real (backend Rust)
- **Ollama Setup Wizard**: guia de instalação passo a passo de IA local
- **Debug Console**: console de depuração com interceptação de logs
- **Plugin System**: documento de design `PLUGIN_SYSTEM.md`

### Community Hub

- **GitHub Discussions**: 12 discussões criadas nas categorias Announcements, General, Ideas, Q&A, Show and tell, Polls
- **Fetch REST API pública**: o Community Hub agora carrega discussões sem exigir token GitHub
- **Sidebar renomeada**: "Workshop" → "Steam Workshop" para maior clareza

### Correção de Provedores de Tradução

- **Ollama cooldown**: erros de rede agora usam cooldown de 30s em vez de bloqueio permanente
- **Lingva 404**: truncamento automático de textos >500 caracteres para evitar URLs muito longos
- **Auto-Translate Review**: novo botão "Traduzir todas as não traduzidas" com barra de progresso e stop
- **Tutorial querySelector**: fix SyntaxError com seletores `:contains()` (não CSS padrão)
- **Update Bell**: fix versão incorreta no popup (fallback hardcoded removido)

### CI/CD e Segurança

- **Tauri Signing Key**: configurada para geração automática de `latest.json` assinado nas releases
- **GitHub Secrets**: `TAURI_SIGNING_PRIVATE_KEY` e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` configurados
- **Workflow release.yml**: atualizado com variáveis de assinatura para ambos os jobs (Windows + Linux)

### Unity: Auto-Instalação do BepInEx + XUnity AutoTranslator

- **Detecção automática de Unity**: se o scanner não encontrar arquivos traduzíveis em um jogo Unity, exibe um card dedicado em vez de um erro genérico
- **Instalação com um clique**: o botão "Instalar BepInEx + XUnity AutoTranslator" detecta automaticamente o exe do jogo, instala o framework e o plugin de tradução com logs em tempo real
- **Fluxo guiado**: após a instalação, sugere iniciar o jogo uma vez e re-escanear — todos os textos se tornam traduzíveis
- **Créditos**: BepInEx Team e bbepis (XUnity AutoTranslator)

---

*GameStringer v1.4.2 - Guia atualizado em 03/03/2026*
