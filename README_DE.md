<p align="center">
  <img src="public/logo.png" alt="GameStringer Logo" width="180" />
</p>

<h1 align="center">GameStringer</h1>

<p align="center">
  <strong>Desktop-Anwendung, die Videospiele mithilfe von KI in jede Sprache übersetzt.</strong><br>
  Wähle ein Spiel aus deiner Bibliothek, wähle eine Sprache, klicke auf Übersetzen — fertig.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.6.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/license-Source--Available-green" alt="License" />
  <img src="https://img.shields.io/badge/Tauri_2-24C8DB?logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/Next.js_15-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Rust-orange?logo=rust&logoColor=white" alt="Rust" />
</p>

<p align="center">
  <a href="#-was-ist-gamestringer">Was ist es</a> ·
  <a href="#-download">Download</a> ·
  <a href="#-so-funktionierts">So funktioniert's</a> ·
  <a href="#-das-prediction-tool-pt">P.T.</a> ·
  <a href="#-unterstützte-game-engines">Engines</a> ·
  <a href="#-funktionen">Funktionen</a> ·
  <a href="#-aus-quellcode-bauen">Build</a>
</p>

<p align="center">
  <strong>🌍 Lies in deiner Sprache:</strong><br>
  <a href="README.md">🇬🇧 English</a> ·
  <a href="README_IT.md">🇮🇹 Italiano</a> ·
  <a href="README_ES.md">🇪🇸 Español</a> ·
  <a href="README_FR.md">🇫🇷 Français</a> ·
  🇩🇪 Deutsch ·
  <a href="README_PT.md">🇧🇷 Português</a> ·
  <a href="README_JA.md">🇯🇵 日本語</a> ·
  <a href="README_ZH.md">🇨🇳 中文</a> ·
  <a href="README_KO.md">🇰🇷 한국어</a> ·
  <a href="README_RU.md">🇷🇺 Русский</a> ·
  <a href="README_PL.md">🇵🇱 Polski</a>
</p>

---

## Demo

<p align="center">
  <img src="docs/demo/demo-library.gif" alt="GameStringer Library Demo" width="720" />
</p>

<p align="center">
  <em>🎮 Spielebibliothek — automatische Erkennung von Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io</em>
</p>

<p align="center">
  <img src="docs/demo/demo-translator.gif" alt="GameStringer AI Translator Demo" width="720" />
</p>

<p align="center">
  <em>🤖 KI-Übersetzer — 20+ Anbieter, Quality Badges 0-100, Translation Memory</em>
</p>

<p align="center">
  <img src="docs/demo/demo-patcher.gif" alt="GameStringer Game Patcher Demo" width="720" />
</p>

<p align="center">
  <em>🔧 One-Click-Patcher — BepInEx, XUnity, UnrealLocres, Bethesda BSA/BA2, CRI CPK, automatisches Backup</em>
</p>

<p align="center">
  <img src="docs/demo/demo-chat.gif" alt="GameStringer Community Chat Demo" width="720" />
</p>

<p align="center">
  <em>💬 Community Chat — Supabase Realtime, benutzerdefinierte Räume, Online-Präsenz</em>
</p>

<p align="center">
  <img src="docs/demo/demo-tray.gif" alt="GameStringer Tray Icon Demo" width="480" />
</p>

<p align="center">
  <em>🖥️ System Tray — Schnellaktionen, Live-Ollama-Status, Tools-Untermenü</em>
</p>

---

## 🎮 Was ist GameStringer?

GameStringer ist eine **Desktop-Anwendung** (Windows und Linux), mit der du Videospiele übersetzen kannst, die deine Sprache nicht unterstützen.

Die meisten Spiele speichern ihren Text in Dateien — JSON, XML, CSV, `.locres`, `.rpy`, BSA/BA2, CPK, Unity Localization StringTables und viele andere Formate. GameStringer **scannt deinen Spielordner**, findet diese Dateien, sendet den Text durch einen **KI-Übersetzungsanbieter** deiner Wahl (OpenAI, Claude, Gemini, DeepSeek, Ollama und 20+ weitere) und **patcht den übersetzten Text zurück** ins Spiel. Ein Klick, keine technischen Kenntnisse erforderlich.

Für **Unity-Spiele**, die Text in kompilierten Assets einsperren, **installiert GameStringer automatisch BepInEx + XUnity.AutoTranslator** — ohne manuelle Einrichtung. Für **Bethesda-Spiele** (Skyrim, Fallout, Starfield) parst es BSA/BA2/ESP nativ. Für **CRI Middleware-Spiele** (Persona, Yakuza) verarbeitet es CPK/CRILAYLA/MSG/BMD. Für **Unreal Engine** bearbeitet es `.locres` direkt.

**Es ist keine Website für maschinelle Übersetzung.** Es ist eine vollständige Pipeline: **Analyse mit P.T. → Engine erkennen → Text extrahieren → mit KI übersetzen → Qualitätsprüfung → zurückpatchen → spielen.**

---

## 📥 Download

Hol dir die neueste Version von **[GitHub Releases](https://github.com/rouges78/GameStringer/releases)**:

| Plattform | Datei | Hinweise |
|----------|------|-------|
| **Windows** | `GameStringer-Setup.exe` | Installer (empfohlen) |
| **Windows** | `GameStringer-Portable.zip` | Keine Installation nötig |
| **Linux** | `GameStringer.AppImage` | Universal (empfohlen) |
| **Linux** | `GameStringer.deb` | Debian / Ubuntu |

**Anforderungen:** Windows 10+ oder Linux (Ubuntu 22.04+, Fedora 38+), 4 GB RAM (8 GB+ für lokale KI), 500 MB Speicherplatz. Releases sind **digital signiert** und werden **automatisch aktualisiert** über den Tauri Updater.

---

## 🚀 So funktioniert's

1. **Installiere** GameStringer und starte es
2. **Deine Spielebibliothek wird automatisch geladen** — Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io (800+ Spiele in Sekunden erkannt)
3. **Wähle ein Spiel** → optional **P.T. (Prediction Tool)** ausführen, um Schwierigkeit, geschätzte Zeit und beste LLM-Kette zu sehen
4. Klicke auf **„String it!"** — GameStringer scannt, extrahiert, übersetzt und patcht automatisch
5. **Spiele in deiner Sprache** — Backups werden vor jedem Patch erstellt

Das war's. Keine Kommandozeile, kein manuelles Bearbeiten von Dateien, keine Modding-Erfahrung nötig.

---

## 🧠 Das Prediction Tool (P.T.)

> **Die mächtigste Funktion in GameStringer.** Beginne eine Übersetzung nicht blind — analysiere zuerst.

P.T. ist eine Tiefenanalyse-Engine, die *vor* jeder Übersetzung läuft. Sie scannt deinen Spielordner, erkennt die Engine, schätzt das Volumen übersetzbaren Textes und sagt dir:

- **Difficulty Score 0–100** — kombinierte Gewichtung von String-Volumen, Engine-Komplexität, DRM, Codierung, sprachlichen Herausforderungen
- **Geschätzte Zeit** über **18 LLM-Modelle** — Ollama (Gemma 4, Qwen 3, Llama), OpenAI GPT-4/4o, Claude 3.5, Gemini, DeepL, DeepSeek, Groq
- **5 empfohlene LLM-Ketten**: Local (Privatsphäre), Cloud (Qualität), Hybrid (ausgewogen), Budget, Premium — jeweils mit Kosten- und Qualitätsbewertung
- **DRM-Erkennung**: Denuvo, VMProtect, Steam DRM, EAC, BattlEye — warnt dich vor dem Versuch
- **Codierungsanalyse**: Shift-JIS, UTF-8, UTF-16, Big5, EUC-KR pro Datei erkannt
- **Übersetzungskomplexität**: Höflichkeitsformen, Geschlechterkongruenz, RTL, Ruby/Furigana, CJK-spezifische Behandlung
- **Konfidenzscore** und **Workflow-Plan** — die exakten Schritte, die beim Klick auf „String it!" ausgeführt werden
- **Report-Export** (JSON + Markdown) zum Teilen oder Archivieren

### P.T.Rank — Schnelle Rangliste

Nach dem Ausführen von P.T. auf mehreren Spielen öffne **P.T.Rank**, um alle analysierten Titel nach Schwierigkeit sortiert zu sehen. Perfekt zum Planen deiner Übersetzungsqueue: Beginne mit den leichten Siegen, spare die 800k-String-RPGs für den Schluss.

### Dry Run Scanner

Du willst nicht ein Spiel nach dem anderen analysieren? Führe **Dry Run** von der Bibliotheksseite aus, um **deine gesamte Steam-Bibliothek (800+ Spiele) im Batch** zu scannen, mit **null Dateiänderungen**. Du erhältst einen JSON-Bericht, der jedes Spiel als **Ready** (Engine unterstützt + Strings extrahierbar), **Errors** (Manifest-Probleme / DRM-Blocker) oder **Unsupported** (unbekannte Engine / kein Text) kategorisiert. Fortschritt in Echtzeit, kein Backup nötig, weil nichts angefasst wird.

### String it! Smart Gate

Die **„String it!"**-Schaltfläche auf der Spieldetailseite ist schlau: Wenn das Spiel in den letzten 24h von P.T. analysiert wurde, startet sie direkt den Übersetzungs-Wizard. Sonst schlägt sie vor, zuerst P.T. auszuführen (mit Ein-Klick-Auswahl „Run P.T. first" / „String it! anyway"). Keine verschwendeten Durchläufe mehr auf Spielen, die sich als DRM-gesperrt oder 5-Minuten-Angelegenheiten entpuppen.

---

## 🎯 Unterstützte Game Engines

GameStringer unterstützt **20+ Engines** mit unterschiedlichem Tiefgang:

| Engine | Support | Wie es funktioniert |
|--------|---------|--------------|
| **Unity** | ✅ Vollständig | Installiert automatisch BepInEx + XUnity.AutoTranslator + Unity Localization Package Pipeline (StringTable, SharedTableData, Addressables, Smart Strings) |
| **Unreal Engine** | ✅ Vollständig | `.locres`-Extraktion und -Patching mit UnrealLocres |
| **Unreal _P.pak** | ✅ Vollständig | Mod-Paketierung als `<GameStringer>_P.pak`, geladen über den Paks-Ordner |
| **Godot** | ✅ Vollständig | Native `.translation`-Datei-Unterstützung |
| **RPG Maker** | ✅ Vollständig | MV/MZ JSON, VX/Ace via Trans, XP via RMXP |
| **Ren'Py** | ✅ Vollständig | Natives `.rpy`-Script-Parsing mit Dialogerkennung |
| **GameMaker** | ⚡ Teilweise | Via UndertaleModTool-Integration |
| **Telltale** | ✅ Vollständig | `.langdb` / `.dlog`-Unterstützung |
| **Wolf RPG** | ✅ Vollständig | WolfTrans-Integration |
| **Kirikiri** | ✅ Vollständig | `.ks` / `.scn`-Parsing |
| **TyranoScript** | ✅ Vollständig | Fast-Path-Extractor mit JSON-Patching |
| **Electron** | ✅ Vollständig | ASAR-Unpacking + i18n-JSON-Erkennung |
| **Bethesda (Skyrim/Fallout/Oblivion/Starfield)** | ✅ **NEW v1.6.0** | BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1) Parser, STRINGS/DLSTRINGS/ILSTRINGS |
| **CRI Middleware (Persona/Yakuza/Tales of/Dragon Ball)** | ✅ **NEW v1.6.0** | CPK + CRILAYLA + MSG/BMD/FTD mit automatischer Erkennung von Shift-JIS/UTF-8/UTF-16 |
| **Visionaire Studio** | ✅ Vollständig | Daedalic-Adventures (Deponia, Edna usw.) |
| **Danganronpa WAD** | ✅ Vollständig | WAD-Archiv-Parser + STX-Dialog-Patching |

> **Unity-Spiele** erhalten eine Sonderbehandlung: Werden keine übersetzbaren Dateien gefunden, erkennt GameStringer, dass es sich um ein Unity-Spiel handelt, und bietet an, **BepInEx + XUnity.AutoTranslator automatisch mit einem Klick zu installieren**. Einfach das Spiel einmal nach der Installation starten, dann erneut scannen — der gesamte Text wird übersetzbar.
>
> ⚠️ **Anti-Cheat-Warnung**: BepInEx (DLL-Injection) kann Anti-Cheat-Systeme (EAC, BattlEye, Vanguard) auslösen. GameStringer enthält eine Anti-Cheat-Erkennung und warnt dich. **Nur bei Single-Player- / Offline-Spielen verwenden.** P.T. erkennt DRM vor jeder Modifikation.

---

## ✨ Funktionen

### 🤖 KI-Übersetzung

- **20+ Anbieter**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, DeepL, Ollama (lokal), LM Studio, TranslateGemma, HY-MT, Qwen 3, NLLB-200, Cerebras, Together AI, Fireworks, OpenRouter, Cohere, Lingva, MyMemory
- **Context-aware**: versteht Spielgenre, Charakterstimme, Ton, Erzählung vs. UI vs. Dialog
- **Translation Memory & Glossar**: Konsistenz im gesamten Projekt mit automatischer Glossar-Extraktion
- **Multi-LLM Compare**: führt mehrere Anbieter parallel aus, wähle das beste Ergebnis pro String
- **Quality Gates**: automatisches QA-Scoring für jeden übersetzten String (0-100) mit ContentTypeBadge
- **Vision LLM Translator**: nutzt In-Game-Screenshots für Kontext (Ollama, Gemini, GPT-4o)
- **Live Quality Preview**: sieh Qualitätsbewertungen in Echtzeit während der Batch-Übersetzung
- **RTL-Unterstützung**: automatische Richtungserkennung und `dir`-Attribut-Behandlung

### 🧠 P.T. — Prediction Tool (v1.6.0)

- **Difficulty Score 0-100** mit gewichteten Faktoren (Volumen, Engine, DRM, Codierung, Komplexität)
- **Zeitschätzungen für 18 LLM-Modelle** einschließlich Gemma 4 (27B MoE A4B / E4B / E2B)
- **5 LLM-Ketten** (Local / Cloud / Hybrid / Budget / Premium) mit Kosten- und Qualitätsschätzungen
- **DRM-/Anti-Cheat-Erkennung** (Denuvo, VMProtect, Steam DRM, EAC, BattlEye, Vanguard)
- **Codierungsanalyse** pro Datei (Shift-JIS, UTF-8/16, Big5, EUC-KR)
- **Übersetzungskomplexitätsanalyse** (Höflichkeitsformen, Geschlecht, CJK, Ruby, RTL)
- **P.T.Rank / Quick Ranking** — sortiere alle analysierten Spiele nach Schwierigkeit
- **Dry Run Scanner** — Batch-Scan der gesamten Steam-Bibliothek (800+ Spiele) ohne Modifikation
- **Workflow Orchestrator** — echter Ausführungsmotor mit universellem Fast Path für 6+ Engines und Echtzeit-Fortschritt
- **Prediction-Cache** (24h) — sofortiges Wieder-Öffnen zuvor analysierter Spiele
- **Report-Export** (JSON + Markdown) zum Teilen und Archivieren

### 📚 Spielebibliothek

- **Auto-Detect**: Steam (mit Family Sharing), Epic, GOG Galaxy, Origin/EA, Ubisoft Connect, Amazon Games, itch.io
- **800+ Spiele** aus installierten Bibliotheken in Sekunden erkannt
- **Spielkarten** mit Cover-Art, Metadaten, Engine-Badge, VR-Badge, Installationsstatus
- **Hover-Schnellaktionen**: String it!, Batch, Community, P.T. — alles mit einem Klick
- **Game Update Tracker**: erkennt, wenn Steam ein übersetztes Spiel aktualisiert (via `buildid`), prüft Patch-Integrität (BepInEx-Dateien, `_P.pak`-Präsenz), warnt, wenn ein Re-Patch nötig ist
- **„Stop monitoring"**-Schaltfläche, um ein bestimmtes Spiel nicht mehr zu verfolgen

### 🔧 Übersetzungs-Tools

- **One-Click Translate** („String it!"): scannen → übersetzen → patchen in einem einzigen Fluss
- **Batch Translation**: ganze Spiele oder Ordner auf einmal übersetzen
- **Untertitel-Übersetzer**: SRT, VTT, ASS/SSA mit Timing-Erhaltung
- **OCR Translator**: extrahiert Text aus Retro-Spielen (8-Bit-, 16-Bit-, DOS-Presets) mit echtem Tauri-Tesseract-Backend
- **Voice Pipeline**: speech-to-text → übersetzen → text-to-speech
- **Echtzeit-Overlay**: siehe Übersetzungen beim Spielen via VR/Screen-Overlay
- **Auto-Translate Review**: „Translate all untranslated"-Schaltfläche mit Fortschrittsbalken
- **Lore Assistant**: RAG-Chat, der Lore und Dialoge des Spiels kennt
- **Character Voice Profiles**: definiere Persönlichkeit, Ton, Sprechmuster pro Charakter
- **Translation Confidence Heatmap**: visuelle Qualitätsübersicht aller Übersetzungen

### 🎮 Game-Engine-Patcher

- **Unity**: BepInEx + XUnity.AutoTranslator-Auto-Installer, Unity Localization Package (StringTable, SharedTableData, Addressables-Katalog, Smart Strings-Validator)
- **Unreal Engine**: `.locres`-Extraktion + `_P.pak`-Mod-Paketierung
- **Bethesda Engine Patcher** (NEW v1.6.0): Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield — BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1)
- **CRI Middleware Patcher** (NEW v1.6.0): Persona 5 Royal, Yakuza, Tales of, Dragon Ball — CPK + CRILAYLA + MSG/BMD/FTD
- **Ren'Py**, **RPG Maker**, **Godot**, **GameMaker**, **Kirikiri**, **Wolf RPG**, **Telltale**, **Visionaire**, **Danganronpa WAD** — alle mit nativen Parsern
- **Wizard Stepper**: gemeinsames mehrstufiges UI für alle Patcher
- **Universal PO Export** (gettext `.po`) für jeden Patcher mit Projekt-/Sprach-/Quell-/Engine-Metadaten
- **Automatisches Backup**: vor jedem Patch, mit Ein-Klick-Wiederherstellung

### 🔌 Erweitert

- **Auto-Hook Scanner**: Prozessspeicher-Scanning (Windows WinAPI) für hartcodierte Strings
- **System Monitor**: Echtzeit-VRAM/RAM-Nutzung für lokale LLM-Planung
- **Ollama Setup Wizard**: schrittweise Installation der lokalen KI
- **Ollama Manager**: Auto-Discovery von Modellen aus dem ollama.com-Register + Auto-Refresh bei Fokus/Navigation
- **Debug Console**: integrierte Konsole mit Log-Intercept
- **Plugin System**: Design-Dokument für Drittanbieter-Plugins (siehe `PLUGIN_SYSTEM.md`)
- **Community Hub**: Teile und lade Translation Memories herunter + GitHub Discussions-Integration
- **Public API v1**: REST-Endpunkte zur Integration (`/api/v1/translate`, `/api/v1/batch`)

### 💬 Community Chat

- **Echtzeit-Chat** mit anderen Übersetzern via Supabase Realtime
- **4 Standardräume**: General, Translations, Feedback & Bugs, Announcements
- **Benutzerdefinierte Räume**: erstelle Räume für bestimmte Spiele oder Projekte
- **Auto-Bridge Auth**: dein GameStringer-Profil synchronisiert automatisch mit Supabase — kein zusätzlicher Login
- **Online-Präsenz**: sieh, wer in jedem Raum online ist
- **Antworten / Bearbeiten / Löschen** von Nachrichten mit RLS-durchgesetztem Ownership
- **Ausklappbares Drawer-Widget** in der unteren rechten Ecke

### ♿ Barrierefreiheit (v1.6.0)

- **WCAG 2.1 AA sweep** — `aria-label` auf Icon-Buttons, semantische `CardTitle`-Überschriften, `focus-visible` auf allen Primitives, Skip-to-Content-Link, `main`-Landmark, italienische `sr-only`-Helper
- **`prefers-reduced-motion`** in allen Animationen respektiert
- **`forced-colors`** (Windows High Contrast Mode) respektiert
- **UI in 11 Sprachen**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL
- **RTL-Layout-Unterstützung** mit automatischer Richtungserkennung

### 🎨 Design System (v1.6.0)

- **Card-Varianten** via `cva`: default, muted, highlight, success, error, warning
- **Button-Größen** einschließlich `xs` und `icon-sm`
- **Text-Utilities**: `text-micro` (9px), `text-2xs` (10px) — keine willkürlichen Tailwind-Werte mehr
- **Radix UI vereinheitlicht**: 37 Dateien von `@radix-ui/react-*` nach `radix-ui` migriert, 27 Pakete entfernt
- **Bundle optimiert**: `optimizePackageImports` für radix-ui, framer-motion, recharts, cmdk

### 🖥️ App

- **Signierte Auto-Updates**: Ein-Klick-Update aus der App via Tauri Updater
- **Profile**: mehrere Benutzerprofile mit Recovery-Schlüsseln
- **Global Hotkeys**: `Ctrl+Shift+T` OCR, `Ctrl+Shift+Q` Quick Translate, `Ctrl+Alt+O` Overlay, `Alt+T` XUnity-Toggle
- **System Tray**: Schnellaktionen, Live-Ollama-Status, Tools-Untermenü
- **Cross-Platform**: Windows und Linux mit nativen Builds
- **Windows-Tray-Fix**: verhindert Konsolen-Flash-Loop beim Spawn von Kindprozessen

---

## 🔧 KI-Anbieter

| Anbieter | API-Key | Free Tier | Ideal für |
|----------|---------|-----------|----------|
| **Ollama** | Nein (lokal) | ✅ Unbegrenzt | Privatsphäre, offline |
| **LM Studio** | Nein (lokal) | ✅ Unbegrenzt | Privatsphäre, GGUF-Modelle |
| **TranslateGemma** | Nein (Ollama) | ✅ Unbegrenzt — 55 Sprachen, Google | **Empfohlener Start** |
| **HY-MT1.5** | Nein (Ollama) | ✅ Unbegrenzt — ~1 GB RAM, Tencent | Maschinen mit wenig RAM |
| **Qwen 3** | Nein (Ollama) | ✅ Unbegrenzt — mehrsprachig | CJK-Sprachen |
| **Gemma 4** | Nein (Ollama) | ✅ Unbegrenzt — 27B MoE A4B/E4B/E2B | Lokale Qualität |
| **Gemini** | Ja | ✅ Free Tier (15 RPM) | **Empfohlene Cloud** |
| **DeepSeek** | Ja | ✅ $0.14/1M input | Günstige Cloud |
| **Groq** | Ja | ✅ 14.400 Anfragen/Tag | Geschwindigkeit |
| **Mistral** | Ja | ✅ Free Tier | EU-Cloud |
| **OpenAI** | Ja | Kostenpflichtig | GPT-4o-Qualität |
| **Claude** | Ja | Kostenpflichtig | Nuance, langer Kontext |
| **DeepL** | Ja | ✅ 500k Zeichen/Monat | Europäische Sprachen |
| **MyMemory** | Nein | ✅ Unbegrenzt | Fallback |
| **Lingva** | Nein | ✅ Unbegrenzt | Google MT-Spiegel |
| **Cerebras** | Ja | ✅ Free Tier | Geschwindigkeit |
| **Together AI** | Ja | ✅ $25 Gratis-Guthaben | Offene Modelle |
| **Fireworks** | Ja | ✅ Free Tier | Offene Modelle |
| **OpenRouter** | Ja | ✅ Kostenlose Modelle | Modellvielfalt |
| **NLLB-200** | Ja | ✅ 200 Sprachen | Seltene Sprachen |
| **Cohere** | Ja | ✅ Gratis-Testphase | RAG |

**Empfohlener Einstieg**: **TranslateGemma** via Ollama (kostenlos, lokal, 55 Sprachen) oder **Gemini** (Free Tier, Cloud). Wenig RAM: **HY-MT1.5** (~1 GB). Beste Qualität: **Claude 3.5** oder **GPT-4o**. Bestes CJK: **Qwen 3**.

---

## 📖 Dokumentation

### Benutzerhandbücher (11 Sprachen)

| | | |
|---|---|---|
| 🇮🇹 [Italiano](docs/GUIDA_UTENTE.md) | 🇬🇧 [English](docs/USER_GUIDE_EN.md) | 🇪🇸 [Español](docs/USER_GUIDE_ES.md) |
| 🇫🇷 [Français](docs/USER_GUIDE_FR.md) | 🇩🇪 [Deutsch](docs/USER_GUIDE_DE.md) | 🇯🇵 [日本語](docs/USER_GUIDE_JA.md) |
| 🇨🇳 [中文](docs/USER_GUIDE_ZH.md) | 🇰🇷 [한국어](docs/USER_GUIDE_KO.md) | 🇧🇷 [Português](docs/USER_GUIDE_PT.md) |
| 🇷🇺 [Русский](docs/USER_GUIDE_RU.md) | 🇵🇱 [Polski](docs/USER_GUIDE_PL.md) | |

### Projekt-Dokumentation

- **[CHANGELOG.md](CHANGELOG.md)** — vollständige Versionshistorie
- **[docs/VERSIONING.md](docs/VERSIONING.md)** — Versionierungsrichtlinie
- **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** — aktuelle Roadmap
- **[PLUGIN_SYSTEM.md](PLUGIN_SYSTEM.md)** — Plugin-Architektur-Design
- **[LICENSE](LICENSE)** — Source-Available License v1.1

---

## 🛠️ Aus Quellcode bauen

**Voraussetzungen**: Node.js 18+, Rust 1.70+, npm. Unter Linux zusätzlich: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.

```bash
git clone https://github.com/rouges78/GameStringer.git
cd GameStringer
npm install
npm run dev          # Entwicklung
npm run tauri:build  # Produktions-Build
```

Rust-Backend: `cd src-tauri && cargo check`, um zu prüfen, ob die Tauri-Befehle auf deiner Plattform kompilieren.

---

## 💖 Unterstützung

Wenn GameStringer dir geholfen hat, Spiele in deiner Sprache zu spielen:

<p align="center">
  <a href="https://buymeacoffee.com/gamestringer">
    <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" />
  </a>
  <a href="https://ko-fi.com/gamestringer">
    <img src="https://img.shields.io/badge/Ko--fi-FF5E5B?logo=ko-fi&logoColor=white" alt="Ko-fi" />
  </a>
  <a href="https://github.com/sponsors/rouges78">
    <img src="https://img.shields.io/badge/GitHub%20Sponsors-EA4AAA?logo=github-sponsors&logoColor=white" alt="GitHub Sponsors" />
  </a>
</p>

---

## 📜 Lizenz

**Source-Available License v1.1** — der Quellcode ist öffentlich und du kannst ihn selbst bauen, aber er ist nicht OSI-genehmigtes „Open Source".

- ✅ Kostenlos für private Nutzung
- ✅ Frei zum Prüfen, Bauen und Modifizieren für dich selbst
- ❌ Kommerzielle Nutzung erfordert schriftliche Genehmigung
- ❌ Weiterverbreitung modifizierter Versionen erfordert schriftliche Genehmigung

Siehe [LICENSE](LICENSE) für Details. Fragen? Öffne eine [Discussion](https://github.com/rouges78/GameStringer/discussions).

---

## 🙏 Credits

- **[BepInEx](https://github.com/BepInEx/BepInEx)** — Unity-Modding-Framework (BepInEx Team)
- **[XUnity.AutoTranslator](https://github.com/bbepis/XUnity.AutoTranslator)** — Unity-Übersetzungs-Framework (bbepis)
- **[UnrealLocres](https://github.com/akintos/UnrealLocres)** — Unreal `.locres`-Parser (akintos)
- **[UndertaleModTool](https://github.com/krzys-h/UndertaleModTool)** — GameMaker-Modding (krzys-h)
- **[Tauri](https://tauri.app)** — Desktop-App-Framework
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** — OCR-Engine
- **[Ollama](https://ollama.com)** — lokale LLM-Runtime
- **[Supabase](https://supabase.com)** — Realtime-Backend für den Community Chat

---

<p align="center">
  Mit ❤️ gemacht für Gamer, die in ihrer eigenen Sprache spielen wollen<br>
  <strong>GameStringer v1.6.0</strong> · © 2025-2026 GameStringer Team
</p>
