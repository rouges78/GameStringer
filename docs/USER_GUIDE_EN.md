# GameStringer - Complete Guide

## 🆕 New in v1.15.0

- ⚙️ **Ollama inference parameters**: new *Ollama Manager → Advanced* page with 3 presets (Faithful/Balanced/Creative) and an expert mode to tune `temperature`, `top_p`, `top_k`, `repeat_penalty`, `num_ctx` and `seed` of local models.
- 🚀 **Projects ↔ Patch Hub**: every imported `.gspack` is registered as a completed project; from Projects you can **Apply to game** (with `.bak` backup) or **Publish** the pre-filled translation to the Patch Hub.
- 💬 **Feedback widget** in *Settings → Community*: report bugs or ideas with technical context attached automatically (version, platform, screen).
- ⚡ **Faster Patch Hub**: local list cache and anti-abuse limits so you can move between tabs without reloading from the server each time.

## 🆕 New in v1.12.0

- 👁️ Visual-context translation (VLM): the AI sees the screen and translates with context, resolving ambiguous words (e.g. "Chest" = coffer vs. body). Local (Ollama) or OpenAI/Gemini
- 🪞 Self-correcting pass (Reflection): an optional second pass reviews and refines the translation against glossary, tone and consistency — only where needed
- 🧠 Semantic memory (RAG): Translation Memory and glossary matched by meaning via local embeddings, for consistent terminology across a game
- ⚡ Smoother live translation and native screenshot processing (crop/resize before the AI call)
- 🔌 More providers out of the box: DeepL, Groq, Cerebras, Cohere, Together, Fireworks, Hugging Face, Azure Translator, DashScope, LibreTranslate, Lingva, MyMemory
- 🧰 New settings to tune reflection, semantic RAG and visual-context (quality vs. speed/cost)

## 🆕 New in v1.11.2

- **More stores**: Humble App, Game Jolt and Big Fish Games are now auto-detected (see Phase 2).
- **Translation lookup**: check whether a game already ships your language via PCGamingWiki, plus Italian fan-patch search links.
- **Publish to Patch Hub**: send a completed project to the community Patch Hub in one step (Projects → Publish).
- **New engines**: TyranoScript cloud pipeline and a rewritten Godot `.pck` parser that reads real Godot 4.4+ archives (see Phase 4).
- **Unity**: local Ollama bridge for XUnity (CustomTranslate); asset downloads (BepInEx/XUnity/TMP/UABEA) resolve from the GitHub API.

## Table of Contents

1. [Initial Setup](#phase-1-initial-setup)
2. [Store Connection](#phase-2-store-connection)
3. [Game Library](#phase-3-game-library)
4. [Translate Game (Auto-Translate)](#phase-4-translate-game)
5. [Patcher Engine](#phase-5-patcher-engine)
6. [Unity CSV Translator](#phase-6-unity-csv-translator)
7. [BepInEx + XUnity](#phase-7-bepinex--xunity)
8. [AI Pipeline Multi-Agent](#phase-8-ai-pipeline)
9. [AI Translator](#phase-9-ai-translator)
10. [OCR Translator & Multi-Engine](#phase-10-ocr-translator)
11. [Voice Translator](#phase-11-voice-translator)
12. [Batch & Offline Translation](#phase-12-batch--offline)
13. [Danganronpa Patcher](#phase-13-danganronpa-patcher)
14. [Prediction Tool & QA Check](#phase-14-prediction-tool--qa-check)
15. [Glossary, TM & Adaptive MT](#phase-15-glossary-tm--adaptive-mt)
16. [Advanced Tools](#phase-16-advanced-tools)
17. [Security & Recovery Key](#phase-17-security)
18. [Troubleshooting](#phase-18-troubleshooting)
19. [Community Chat (Real-Time)](#phase-19-community-chat) *(NEW v1.5.0)*
20. [Projects & Patch Hub](#projects--patch-hub) *(UPDATED v1.15.0)*
21. [Ollama Inference Parameters](#ollama-inference-parameters) *(NEW v1.15.0)*
22. [Send Feedback](#send-feedback) *(NEW v1.15.0)*

---

## PHASE 1: INITIAL SETUP

### First Launch

Launch GameStringer. On first run, the profile creation screen appears.

### Profile Creation

- **Name**: choose a name (e.g. "Mario Gaming")
- **Avatar**: select a color/gradient
- **Password**: minimum 4 characters
- Click **"Create Profile"** — automatic authentication

### Interface

- **Sidebar** (left): navigation between sections
- **Dashboard** (center): game overview, stats, AI Engine widget
- **Ctrl+K**: global quick search to access any page

---

## PHASE 2: STORE CONNECTION

### Supported Stores

Steam, Epic Games, GOG, Ubisoft Connect, Origin/EA, Battle.net, Itch.io, Rockstar, Amazon Games, Humble App, Game Jolt, Big Fish Games.

### Steam Configuration (Priority)

1. Get API Key from https://steamcommunity.com/dev/apikey
2. Find your Steam ID64 from https://steamid.io/
3. In GS: **Settings** → enter API Key and Steam ID
4. Steam profile must be **Public**

GS also detects games from **Steam Family Sharing**.

---

## PHASE 3: GAME LIBRARY

- Sidebar → **"Library"** or Dashboard → **"Update Library"**
- Loading takes 1-2 minutes for hundreds of games
- Clicking a game: details, detected engine, path, **"Translate Game"** button

---

## PHASE 4: TRANSLATE GAME

Sidebar → **"Translate Game"** (Auto-Translate). The heart of GameStringer.

### Workflow

1. **Select game** from library or manual path
2. **Scan**: detects engine (Unity, Unreal, Godot, RPG Maker, Ren'Py, etc.) and translatable files
3. **Smart Auto-Select**: recommends the best method for the detected engine
4. **AI Translation**: strings translated with the configured AI engine
5. **Review**: review, edit, approve
6. **Apply Patch**: automatic backup + application

### Smart Auto-Select for Unity

| Type | Recommended Method | Alternative |
|------|-------------------|-------------|
| Unity Mono (no BepInEx) | Unity CSV Translator | BepInEx + XUnity |
| Unity Mono (BepInEx present) | Unity CSV Translator | AI translate captured strings |
| Unity IL2CPP | Unity CSV Translator | None (BepInEx incompatible) |

### Detected Engines

Unity (Mono/IL2CPP), Unreal Engine, Godot (incl. 4.4+ `.pck`), RPG Maker, Ren'Py, TyranoScript, Visionaire, Source Engine, CryEngine, RE Engine, Frostbite, id Tech, Creation Engine, Construct, AGS, Defold, Love2D.

---

## PHASE 5: PATCHER ENGINE

Sidebar → **Patcher** → **Patcher Engine**. 5 specialized patchers:

- **Unity**: BepInEx + XUnity AutoTranslator for Mono
- **Unreal Engine**: .locres file translation (UE4/UE5)
- **Godot**: extract/translate/re-pack .pck files (Godot 3/4)
- **RPG Maker**: JSON translation for MV/MZ (dialogues, items, skills)
- **Ren'Py**: .rpy file translation (visual novels)

---

## PHASE 6: UNITY CSV TRANSLATOR

The **best method** for Unity games (both Mono and IL2CPP).

### How It Works

1. Scans Unity assets (resources.assets, etc.)
2. Extracts CSV localization tables
3. Translates with AI (Ollama or cloud)
4. Injects translations with **Resize Injection** (zero truncation)

### Advantages

- Works with **all** Unity games (Mono and IL2CPP)
- Zero truncation thanks to resize
- Complete coverage (all strings, not just on-screen ones)
- No external dependencies
- Automatic backup (.backup) and restore

---

## PHASE 7: BEPINEX + XUNITY

For **Unity Mono** games — live translation during gameplay.

1. GS detects Unity game and finds the exe
2. Click **"Install BepInEx + XUnity"**
3. Launch the game — XUnity captures on-screen strings
4. Close and return to GS — translate captured strings with AI

**Limitation**: does not work with IL2CPP (causes crash). Use Unity CSV Translator for IL2CPP.

---

## PHASE 8: AI PIPELINE

Search **"AI Pipeline"** with Ctrl+K. Multi-step system for high quality.

### 6 Steps

Harvest → Translate → QA Check → Auto-Fix → Review → Score

### 3 Modes

- **Quick**: Translate + QA (fast)
- **Balanced**: + Auto-Fix (recommended)
- **Max Quality**: all 6 steps, threshold 75, max 3 attempts

### Multi-Agent

Assign different models per step (e.g. qwen for Translate, gemma for Review). 4 presets: Default, Speed, Max Quality, Diversified.

### Benchmark

Execution history with score, duration, ms/string. Preset comparison.

---

## PHASE 9: AI TRANSLATOR

Sidebar → **Translation** → **AI Translator**.

### Providers

- **Ollama** (local, free), **OpenAI/GPT-4**, **Claude**, **Gemini**, **DeepL**, **Lingva**

### Features

- Single or batch translation
- Auto-detect source language
- Style: natural, literal, gaming
- Placeholder preservation ({0}, %s, \n)
- Glossary + Translation Memory + Adaptive MT integration

---

## PHASE 10: OCR TRANSLATOR

Sidebar → **Translation** → **OCR Translator**.

Translates text from screen in real time:
- Manual screenshot or selected area
- Continuous Live OCR
- Global hotkey: **Ctrl+Shift+T**

### OCR Multi-Engine

4 engines: **OneOCR** (Win11), **PaddleOCR** (CJK), **RapidOCR** (ONNX), **Tesseract** (fallback).

- Automatic engine probe
- Automatic fallback chain
- Parallel comparison mode

---

## PHASE 11: VOICE TRANSLATOR

Sidebar → **Translation** → **Voice Translator**.

- In-game voice recognition
- Audio → translated text
- Real-time subtitle overlay

---

## PHASE 12: BATCH & OFFLINE

### Batch

Sidebar → **Translation** → **Batch**. Translates entire file folders:
- Supports .txt, .json, .csv, .po, .xml, .rpy, .ini
- Real-time progress per file
- AI pipeline option for maximum quality

### Offline (Ollama)

Sidebar → **Translation** → **Offline Translator**.
- Fully local translation with Ollama
- No internet connection needed
- Total privacy — data never leaves your PC

---

## PHASE 13: DANGANRONPA PATCHER

Search **"Danganronpa"** with Ctrl+K.

### Features

1. **Apply Patch tab**: select Steam game, view WAD files, apply patch
2. **WAD Extractor tab**: extract, search, filter and translate 35,865 strings
3. **AI Batch Translation**: select strings → translate with AI → export JSON
4. **Distributable .zip export**: patched WAD + auto-installer + instructions
5. In-game: Settings → Control Hints → "Keyboard and Mouse"

---

## PHASE 14: PREDICTION TOOL & QA CHECK

### Prediction Tool (P.T.)

Open it from the game detail page (**"Run P.T."**) or via search (Ctrl+K). It analyzes a game **before** translating, so you can plan instead of discovering problems halfway.

What it tells you:
- **Difficulty Score 0–100** — combined weight of string volume, engine complexity, DRM, encoding and linguistic challenges.
- **Time estimates** across multiple LLM models (local Ollama and cloud).
- **5 recommended LLM chains** — Local (privacy), Cloud (quality), Hybrid, Budget, Premium — each with estimated cost and quality.
- **DRM / anti-cheat detection** (Denuvo, VMProtect, Steam DRM, EAC, BattlEye, Vanguard) — warns before touching any file.
- **Encoding analysis** per file (Shift-JIS, UTF-8/16, Big5, EUC-KR).
- **Translation complexity** (honorifics, gender agreement, CJK, ruby/furigana, RTL).
- **Confidence score** + **workflow plan**, plus an **exportable report** (JSON + Markdown).

Results are **cached for 24h**, so reopening an analyzed game is instant.

**P.T.Rank** — after analyzing several games, open P.T.Rank to see them ranked by difficulty (plan your queue: easy wins first, save the huge RPGs for last).

**Dry Run Scanner** — from the Library, scan the entire library **without modifying anything**; it classifies each title as **Ready** (engine supported + strings extractable), **Errors** (manifest/DRM blocker) or **Unsupported** (unknown engine / no text).

**"String it!" Smart Gate** — the button is smart: if the game was analyzed by P.T. within 24h it starts directly; otherwise it suggests running P.T. first ("Run P.T. first" / "String it! anyway").

### QA Check

Search with Ctrl+K. Post-translation quality control:
- Placeholder verification
- Number and value checks
- String length verification
- Format and punctuation checks
- Per-string quality score

---

## PHASE 15: GLOSSARY, TM & ADAPTIVE MT

### Glossary

Search with Ctrl+K. Custom terminology per game:
- Add terms (e.g. "quest" → "missione")
- Categories: gameplay, UI, characters, lore
- Automatically integrated in AI translation

### Smart Glossary

Automatically generates glossary from game file analysis.

### Translation Memory

Dashboard → "TM Entries" widget. Translation memory:
- Automatically saves every translated pair
- Reuses previous translations
- Rust backend for performance

### Adaptive MT

Learns from your corrections:
- Saves: original → AI → human correction
- Finds similar corrections with trigram/word similarity
- Injects few-shot examples into AI prompt
- Improves over time

---

## PHASE 16: ADVANCED TOOLS

### Context Harvester

Scans game files and extracts context for AI translation.

### Translation Editor

Advanced editor for manual string review with filters and search.

### Subtitle Overlay

In-game overlay for translated subtitles in real time.

### ROM Patcher

Apply and create IPS/BPS patches for retro translations (SNES, GBA, etc.).

### Export Formats

Export translations to: PO, XLIFF, CSV, JSON, TMX.

### Community Hub

Share translations, vote, comment, download community translations.

---

## PHASE 17: SECURITY

### Recovery Key

On profile creation, a **Recovery Key** is generated (12 mnemonic words).
- Copy or download as .txt
- **Save in a secure place!**

### Password Recovery

Login screen → **"Forgot password?"** → enter the 12 words → new password.

---

## PHASE 18: TROUBLESHOOTING

### Game Not Found

- Verify it's installed and Steam/Epic is open
- Update library and restart GS

### Translation Not Applied

- Fully restart the game
- Check file write permissions
- Run GS as administrator

### AI Not Responding

- Check internet connection (for cloud providers)
- For Ollama: verify it's running (green dot in sidebar)
- Try a different engine

### Game Crashed After Patch

- Click **"Restore Backup"** in the tool used
- Verify file integrity on Steam (right-click → Properties → Local Files)

### Unity IL2CPP + BepInEx = Crash

- GS now automatically blocks BepInEx for IL2CPP
- Use Unity CSV Translator instead

### Ollama Slow or Not Responding

- Sidebar: green dot = online, red = offline
- Ollama Manager → check installed models
- Recommended: 7B model for speed, 13B+ for quality

---

## PHASE 19: COMMUNITY CHAT

*(NEW v1.5.0)*

Real-time community chat integrated into the Community Hub, powered by Supabase Realtime.

### How to Access

1. Go to **Community Hub** from the sidebar
2. Click the **Chat** tab or the chat icon in the bottom-right corner
3. If you're logged into your GameStringer profile, you're **automatically connected** — no extra login needed!

### Default Rooms

- **General**: free chat for the GameStringer community
- **Translations**: discuss translations, ask for help, share progress
- **Feedback & Bug**: report bugs and suggest improvements
- **Announcements**: official news and updates

### Features

- **Real-time messages**: messages appear instantly via Supabase Realtime
- **Online presence**: see who's online in real-time
- **Reply to messages**: click a message to reply in thread
- **Edit/Delete**: edit or delete your own messages
- **Create custom rooms**: create dedicated rooms for specific projects or games
- **Auto-login**: automatic bridge syncs your GS profile with Supabase Auth

### Requirements

- Active GameStringer profile (logged in)
- Active internet connection
- Supabase backend configured (for self-hosting)

## What's New v1.9.0

### Bethesda Engine Patcher
- **Supported games**: Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield
- **Archive formats**: BSA v103/v104/v105 and BA2 (GNRL + DX10)
- **Plugins**: ESP/ESM parsing with translatable record extraction
- **Localized strings**: STRINGS, DLSTRINGS, ILSTRINGS
- **Workflow**: extract → AI translate → repack with automatic backup

### CRI Middleware Patcher
- **Supported games**: Persona 5 Royal, Yakuza, Tales of, Dragon Ball and every CRI title
- **Archives**: CPK with CRILAYLA decompression
- **Message formats**: MSG, BMD, FTD
- **Workflow**: unpack CPK → decode messages → translate → repack

### Unity Localization Package
- Pipeline for the official Unity Localization package (Unity 2021.3+)
- StringTable + SharedTableData, Addressables, Smart Strings support
- Dedicated validator for placeholders and plural forms

### Universal PO Export
- gettext PO export with full metadata from every patcher
- Compatible with Poedit, Weblate, Crowdin and any CAT tool

### Accessibility WCAG 2.1 AA
- aria-label on icon buttons, semantic headings, focus-visible
- "Skip to content" skip link, prefers-reduced-motion
- Windows High Contrast compatibility (forced-colors)

### Design System and OCR
- Card variants via cva, Button xs/icon-sm, text-micro/text-2xs utilities
- Real Tauri Tesseract backend replacing the OCR stub
- Fix: Windows console flash loop when the app runs in tray

---

## Patch Hub (Community Translation Packs)

The Patch Hub is a Steam Workshop–style marketplace for sharing and downloading community translation packs, backed by the GameStringer community server. Open it from the **Patch Hub** entry in the sidebar (orange/amber section).

### Browsing packs
The main view lists published packs with search and sorting (most downloaded, top rated, recently updated, completion). Each card shows the game, source→target languages, completion %, rating and download count. Click a pack to open its detail page with stats, description, included files and changelog.

### Downloading a pack
On a pack's detail page, click **Download**. GameStringer fetches all of the pack's files from the community server and saves them locally as a `.gspack` bundle in your pack library (`Documents/GameStringer/packs`). From there you can manage the pack and import it from a game's detail page to apply the translation.

### Publishing a pack
Click **Publish patch** to open the publish form. Fill in the pack name, game, source and target language, an optional description and tags, and attach your translation file(s). When you are signed in to the Community Hub, the pack is uploaded to the community server and enters a moderation queue before it becomes publicly visible. If you are not signed in, the pack is kept as a local draft — sign in and publish again to share it online.

> Publishing online requires a Community Hub account (separate from your local profile). Browsing and downloading work without an account.

---

## Projects & Patch Hub

*(UPDATED v1.15.0)*

The **Projects** page gathers, in one place, every game you are translating or have already translated — sourced from Quality Scoring, dictionaries, Translation Memory and the game library. From here you manage the full life cycle of a translation: open, apply, publish.

### Import `.gspack` → project

When you **import a `.gspack` bundle** (downloaded from the Patch Hub or made by you), GameStringer doesn't just apply it: it **registers a completed project** and **saves the translated files** locally. The game then shows up under Projects at 100%, ready to be re-applied or published later without redoing any work.

### Apply to game

For **completed** projects, the **"Apply to game"** button (folder icon) copies the translated files straight into the installation:

1. Pick the game's **installation folder**
2. Before overwriting an existing file, a **`.bak` backup** is created next to the original
3. **Safety**: if a file's backup fails, that file is **skipped** (never overwritten without a safety copy)
4. When done, you see how many files were written and how many skipped

To restore an original, just rename the `.bak` file, removing the extension.

### Publish (pre-filled)

The **"Publish to Patch Hub"** button (share icon) sends the translation to the community. It publishes **the real translated file** (not just a metadata manifest), with name, game, languages and completion percentage **already pre-filled**. The pack enters a **moderation queue** before it becomes publicly visible.

> Publishing requires being signed in to the **Community Hub** (an account separate from your local profile).

### Explore / My patches

The **Patch Hub** page has two tabs:

- **Explore** — every pack published by the community, with search and sorting (most downloaded, top rated, recently updated, completion)
- **My patches** — only the packs you published with the current profile

### Performance

Patch Hub lists use a **local cache** (about 60 seconds): moving back and forth between tabs no longer reloads from the server every time. The cache refreshes automatically after a publish or download. Publishing and reporting also have a small **minimum interval** between submissions, to avoid overloading the shared server.

---

## Ollama Inference Parameters

*(NEW v1.15.0)*

When you translate with a **local Ollama model**, you can control *how* the model generates text. Open the page from **Ollama Manager → "Advanced"** (route `/ollama-manager/advanced`).

> If you change nothing, the recommended defaults stay active: translation behaves exactly as before. Advanced parameters are sent to Ollama **only** when you set them.

### Presets

Three ready-made profiles, tuned for video game translation:

| Preset | Temperature | `num_ctx` | When to use |
|--------|-------------|-----------|-------------|
| 🎯 **Faithful** | 0.1 | 8192 | Maximum adherence to the text, little invention. **Recommended** for translation. |
| ⚖️ **Balanced** | 0.3 | 4096 | A compromise between faithfulness and naturalness. |
| ✨ **Creative** | 0.7 | 4096 | More stylistic freedom: for dialogue and expressive tone. |

### Expert mode

Expand **"Expert mode"** to tune each parameter with sliders:

| Parameter | Effect |
|-----------|--------|
| `temperature` | Randomness of generation. Low = more deterministic and faithful; high = more varied and creative. |
| `top_p` | *Nucleus sampling*: consider only the most probable tokens up to this probability mass. Lower = more focused. |
| `top_k` | Limit the choice to the k most probable tokens at each step. Lower = fewer digressions. |
| `repeat_penalty` | Discourages repeating words. Above 1.0 reduces loops; too high can distort the text. |
| `num_ctx` | Context window (tokens kept in memory). **Wider = no truncation on long texts**, but more RAM/VRAM. |
| `seed` *(optional)* | Fixes the random seed for **reproducible** results (useful for benchmarks). Off = every run may vary. |

Editing any value switches the preset to **"custom"** automatically.

### When and why to use them

- **Faithfulness vs creativity**: for translation, prefer a **low temperature** (Faithful preset) — less invention, more adherence. Raise it only for dialogue where you want a more expressive tone.
- **Long files**: if you translate long texts and notice truncation or lost context, increase **`num_ctx`** (at the cost of more RAM/VRAM).
- **Reproducibility**: enable the **`seed`** when you want to compare two models or re-run the same translation and get exactly the same output.

### How to use

1. Open **Ollama Manager** from the sidebar and click **"Advanced"**
2. Pick a preset (start with **Faithful** for translation) or open **Expert mode**
3. Adjust the parameters (e.g. raise `num_ctx` for long files, enable `seed` for repeatable results)
4. Click **"Save"** — the parameters are stored for subsequent translations

> **Scope**: these parameters apply to translations run with **local Ollama models** (including the *reflection* pass). They do not affect web providers (Gemini, Groq, etc.).

---

## Send Feedback

*(NEW v1.15.0)*

You can report a bug, suggest an idea, or tell us what you think straight from the app, without leaving GameStringer.

### How to send it

1. Go to **Settings → Community** (Community Hub tab)
2. In the **"Send feedback"** box, click **"Send feedback"**
3. Pick a **category** — 🐞 Bug, 💡 Idea or 💬 Other
4. Write your message and click **"Send"**

### Context attached automatically

To help us understand the problem, a **minimal technical context** is attached to the message:

- **Version** of the app
- **Platform** (operating system + Tauri/Web)
- **Screen** you were on (the current route)
- **Game** (only if you were working on a specific title)

> **Privacy**: no personal data. Only version, platform and current screen.

### If the backend is unavailable

The widget is **fail-open**: if the server isn't configured or you're offline, the message isn't lost. You can still **copy the report** to the clipboard or send it by **email** in one click — the technical context is already included in the text.

---

## What's New v1.8.1

### Live Translation Overlay
- Go to **/live-translate** page or press **Ctrl+Alt+O**
- Select source/target language and AI provider
- Click **Start** — overlay appears on top of the game
- Text is captured via OCR every 2 seconds
- Translations appear as transparent overlay boxes
- Diff detection skips unchanged text (saves API calls)

### Hub Marketplace
- Go to **Community Hub** to browse translation packs
- **1-click install**: download → validate → import
- Rate and review community packs
- Publish your own translations as **.gspack** files
- User profiles with reputation and badges

### Translation Memory Network
- Enable in **Settings → TM Network**
- Opt-in: your high-quality translations contribute to global pool
- Privacy-first: source text hashed, no user data shared
- Next user translating same game gets pre-filled suggestions
- Auto-integrated into translation pipeline

### AI Dubbing Pipeline
- Go to **/dubbing** page
- Select game folder and configure languages/voice
- 7-step pipeline: scan → transcribe → translate → synthesize → patch → lip sync → subtitles
- Duration matching keeps translated audio same length as original
- Character voice profiles with 16 archetypes

### Plugin System
- Community can create new game engine patchers in JavaScript
- No Rust compilation needed
- Template generator creates complete plugin scaffold
- Plugins distributed as **.gsplugin** packages

---

## What's New v1.9.0

### Community Hub UI Improvements
- **Redesigned Community Hub**: cleaner, more consistent design without excessive gradients and decorative blobs
- **Compact KPI Cards**: smaller, more subtle stat cards with minimal colors
- **Minimalist Category Cards**: clean design without heavy gradients and shadows
- **Unified Trending Cards**: consistent styling across all card types

### Friends Sidebar Compact Design
- **Reduced width**: from 72 to 56 (w-56) for more screen space
- **Compact Friend Cards**: smaller avatars (7x7), tighter spacing
- **Smaller sections**: Online/Offline headers with reduced text size
- **Ultra-thin scrollbar**: 4px, invisible by default, appears on hover

### Persistent Chat Improvements
- **Discrete chat button**: elegant, small button in bottom-right corner
- **Visible on all pages**: chat accessible throughout the entire app
- **Cleaner design**: removed excessive animations and decorations

### Supabase Social Features
- **Compatible schema**: Supabase social schema aligned with frontend expectations (tools/supabase_social_compatible.sql)
- **RLS disabled temporarily**: for easier debugging of social features
- **Chat participants fix**: column names corrected for UUID validation

### Bug Fixes
- **Chat Loop Fix**: added chatAttempted state to prevent infinite loop in startDirectChat
- **Mock Data Removal**: removed invalid UUID mock data (user-123, etc.) that caused 400 errors
- **Ollama IPC Fix**: replaced all check_ollama_status IPC calls with direct HTTP to localhost:11434
- **Stores Link**: added Stores link in sidebar Resources section
- **Epic Connect**: changed from broken OAuth to credentials modal
- **Connection Test**: testConnection now uses real Tauri commands instead of simulated API
- **Disconnect Fix**: added Epic/Steam credential deletion in Tauri backend
- **Presence Fix**: added session guard in updatePresence to avoid 400 Bad Request

---

## What's New in v1.9.0

### 🟢 Unified Online Presence

Unified presence system combining Supabase Realtime and database:

- **Instant updates**: Online users appear in real time (Supabase Realtime Presence)
- **Global heartbeat**: Presence status updated automatically every 30 seconds
- **Auto-away**: If the window is not focused for 2+ minutes, status becomes "Away"
- **Auto-online**: When the window regains focus, status returns to "Online"
- **DB fallback**: If Realtime is unavailable, the system uses the database as fallback
- **Updated widget**: The "Online Users" widget shows usernames, avatars, and Realtime indicator

### 🔔 System Tray Notifications

Native OS notifications for important events:

- **💬 Chat Messages**: OS notification when you receive a message in the community chat
- **✅ Translations Completed**: Notification when a translation finishes successfully
- **❌ Translation/System Errors**: Notification for critical errors (always visible, even when window is focused)
- **🔄 App Updates**: Notification when a GameStringer update is available
- **🎮 Game Updates**: Notification when an updated game may have invalidated the patch
- **🟢 Friends Online**: Notification when a friend comes online
- **📰 News**: Notifications for community news and updates

**Configuration**: Settings → Notifications → System Tray Notifications
- Toggle for each notification type
- **Quiet Hours**: Suppress notifications during specific hours (e.g., 23:00-07:00)
- **Test Button**: Send a test notification to verify functionality
- **Tray Tooltip**: The tray icon shows the unread notification count

### 🛡️ Error Boundaries + Crash Recovery

Protection against component crashes:

- **WidgetErrorBoundary**: If a widget (Chat, Background Translations, etc.) crashes, it shows a compact message and automatically attempts recovery after 5 seconds (max 3 attempts)
- **AppErrorBoundary**: If the entire app crashes, it shows an error screen with "Reload App" option
- **Auto-recovery**: Widgets restore automatically without user intervention

### 🌐 Network Resilience / Offline Mode

Graceful handling of disconnections:

- **Network Monitor**: Detects online/offline status + Supabase health check every 30 seconds
- **Connection Status Bar**: Red bar at top if offline, amber if Supabase is down, green when connection is restored
- **Retry with Backoff**: Failed network operations are automatically retried with exponential backoff (1s, 2s, 4s)
- **Offline Queue**: If you're offline, operations (chat messages, presence updates) are queued and executed when connection returns
- **"Offline mode"**: Changes will be automatically synchronized when the connection returns

### 🎙️ Character Voice Profiles (Voice Cloning)

System to preserve character "voice" during translation:

- **Auto-Extraction**: Analyzes game dialogue strings to identify characters and their linguistic style
- **16 Available Tones**: Formal, Casual, Aggressive, Gentle, Mysterious, Comedic, Dramatic, Stoic, Sarcastic, Wise, Childish, Noble, Pirate, Military, Academic, Street
- **5 Formality Levels**: Very formal → Very informal
- **5 Age Groups**: Child, Teen, Young Adult, Adult, Elder
- **Speech Patterns**: Automatic recognition of patterns (archaic words, exclamations, frequent questions)
- **Catchphrases**: Automatic identification of recurring character expressions
- **Prompt Injection**: Voice profiles are automatically injected into the translation prompt to maintain character consistency
- **Default Profile**: Set a profile as fallback for unidentified characters

**How to use**:
1. On the Auto-Translate page, after loading files, the "Character Voice Profiles" panel appears
2. Click **"Auto-Extract"** to analyze dialogues and create profiles
3. Or create profiles manually with **"New Profile"**
4. Profiles are applied automatically during translation

### 🧠 Fine-Tuning Infrastructure

System to generate training datasets and manage per-game models:

- **Dataset from Corrections**: Generate JSONL datasets from human corrections (Adaptive MT)
- **4 Export Formats**: OpenAI JSONL, Ollama JSONL, Alpaca JSON, ChatML TXT
- **Approved Only**: Option to use only approved corrections in the dataset
- **Model Management**: Register and manage fine-tuned models per game
- **Ollama Integration**: Check Ollama availability for local training
- **Dataset Statistics**: Example count, average length, quality score

**How to use**:
1. Go to **Settings → AI → Fine-Tuning Infrastructure**
2. Select the language pair and click **"Generate"** to create the dataset from your corrections
3. Click **"Export"** to download the dataset in your desired format
4. Use the dataset for fine-tuning with Ollama or cloud providers

### ⚡ Code Splitting / Lazy Loading

Startup time optimization:

- 8 heavy components (Chat, Background Jobs, Command Palette, etc.) are loaded only when needed
- The app starts faster and uses less memory

---

GameStringer v1.15.0 - Guide updated 24/07/2026
