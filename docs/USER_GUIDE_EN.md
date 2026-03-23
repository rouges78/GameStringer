# GameStringer - Complete Guide

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

Steam, Epic Games, GOG, Ubisoft Connect, Origin/EA, Battle.net, Itch.io, Rockstar, Amazon Games.

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

Unity (Mono/IL2CPP), Unreal Engine, Godot, RPG Maker, Ren'Py, Source Engine, CryEngine, RE Engine, Frostbite, id Tech, Creation Engine, Construct, AGS, Defold, Love2D.

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

### Prediction Tool

Search with Ctrl+K. Analyzes a game before translation:
- Estimated string and word count
- Estimated cost per provider (DeepL, OpenAI, local)
- Estimated time per method
- Recommended translation chains

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
