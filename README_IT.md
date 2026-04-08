<p align="center">
  <img src="public/logo.png" alt="GameStringer Logo" width="180" />
</p>

<h1 align="center">GameStringer</h1>

<p align="center">
  <strong>App desktop che traduce i videogiochi in qualsiasi lingua usando l'IA.</strong><br>
  Scegli un gioco dalla tua libreria, seleziona una lingua, clicca traduci — fatto.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.7.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/license-Source--Available-green" alt="License" />
  <img src="https://img.shields.io/badge/Tauri_2-24C8DB?logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/Next.js_15-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Rust-orange?logo=rust&logoColor=white" alt="Rust" />
</p>

<p align="center">
  <a href="#-cosè-gamestringer">Cos'è</a> ·
  <a href="#-download">Download</a> ·
  <a href="#-come-funziona">Come funziona</a> ·
  <a href="#-il-prediction-tool-pt">P.T.</a> ·
  <a href="#-motori-di-gioco-supportati">Motori</a> ·
  <a href="#-funzionalità">Funzionalità</a> ·
  <a href="#-compilazione-dai-sorgenti">Build</a>
</p>

<p align="center">
  <strong>🌍 Leggi nella tua lingua:</strong><br>
  <a href="README.md">🇬🇧 English</a> ·
  🇮🇹 Italiano ·
  <a href="README_ES.md">🇪🇸 Español</a> ·
  <a href="README_FR.md">🇫🇷 Français</a> ·
  <a href="README_DE.md">🇩🇪 Deutsch</a> ·
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
  <em>🎮 Libreria Giochi — rilevamento automatico di Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io</em>
</p>

<p align="center">
  <img src="docs/demo/demo-translator.gif" alt="GameStringer AI Translator Demo" width="720" />
</p>

<p align="center">
  <em>🤖 Traduttore IA — 20+ provider, Quality Badges 0-100, Translation Memory</em>
</p>

<p align="center">
  <img src="docs/demo/demo-patcher.gif" alt="GameStringer Game Patcher Demo" width="720" />
</p>

<p align="center">
  <em>🔧 Patcher One-Click — BepInEx, XUnity, UnrealLocres, Bethesda BSA/BA2, CRI CPK, backup automatico</em>
</p>

<p align="center">
  <img src="docs/demo/demo-chat.gif" alt="GameStringer Community Chat Demo" width="720" />
</p>

<p align="center">
  <em>💬 Community Chat — Supabase Realtime, stanze personalizzate, presenza online</em>
</p>

<p align="center">
  <img src="docs/demo/demo-tray.gif" alt="GameStringer Tray Icon Demo" width="480" />
</p>

<p align="center">
  <em>🖥️ System Tray — azioni rapide, stato Ollama live, sottomenu strumenti</em>
</p>

---

## 🎮 Cos'è GameStringer?

GameStringer è un'**applicazione desktop** (Windows e Linux) che ti permette di tradurre videogiochi che non supportano la tua lingua.

La maggior parte dei giochi memorizza il testo in file — JSON, XML, CSV, `.locres`, `.rpy`, BSA/BA2, CPK, StringTable di Unity Localization e molti altri formati. GameStringer **scansiona la cartella del gioco**, trova quei file, invia il testo tramite un **provider di traduzione IA** a tua scelta (OpenAI, Claude, Gemini, DeepSeek, Ollama, 20+ altri) e **applica la patch del testo tradotto** al gioco. Un clic, senza conoscenze tecniche.

Per i **giochi Unity** che bloccano il testo in asset compilati, GameStringer **installa automaticamente BepInEx + XUnity.AutoTranslator** — senza setup manuale. Per i **giochi Bethesda** (Skyrim, Fallout, Starfield) analizza nativamente BSA/BA2/ESP. Per i **giochi CRI Middleware** (Persona, Yakuza) gestisce CPK/CRILAYLA/MSG/BMD. Per **Unreal Engine** modifica direttamente i `.locres`.

**Non è un sito di traduzione automatica.** È una pipeline completa: **analisi con P.T. → rilevamento motore → estrazione testo → traduzione IA → controllo qualità → patch di ritorno → gioca.**

---

## 📥 Download

Ottieni l'ultima versione da **[GitHub Releases](https://github.com/rouges78/GameStringer/releases)**:

| Piattaforma | File | Note |
|----------|------|-------|
| **Windows** | `GameStringer-Setup.exe` | Installer (consigliato) |
| **Windows** | `GameStringer-Portable.zip` | Nessuna installazione |
| **Linux** | `GameStringer.AppImage` | Universale (consigliato) |
| **Linux** | `GameStringer.deb` | Debian / Ubuntu |

**Requisiti:** Windows 10+ o Linux (Ubuntu 22.04+, Fedora 38+), 4 GB RAM (8 GB+ per IA locale), 500 MB di spazio su disco. Le release sono **firmate digitalmente** e **auto-aggiornate** tramite Tauri Updater.

---

## 🚀 Come funziona

1. **Installa** GameStringer e avvialo
2. **La tua libreria di giochi si carica automaticamente** — Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io (800+ giochi rilevati in pochi secondi)
3. **Scegli un gioco** → opzionalmente esegui **P.T. (Prediction Tool)** per vedere difficoltà, tempo stimato, miglior catena LLM
4. Clicca **"String it!"** — GameStringer scansiona, estrae, traduce e applica la patch automaticamente
5. **Gioca nella tua lingua** — i backup vengono sempre creati prima del patching

Tutto qui. Nessuna riga di comando, nessuna modifica manuale dei file, nessuna esperienza di modding richiesta.

---

## 🧠 Il Prediction Tool (P.T.)

> **La funzionalità più potente di GameStringer.** Non iniziare una traduzione alla cieca — analizza prima.

P.T. è un motore di analisi approfondita che viene eseguito *prima* di qualsiasi traduzione. Scansiona la cartella del gioco, rileva il motore, stima il volume di testo traducibile e ti dice:

- **Difficulty Score 0–100** — peso combinato di volume di stringhe, complessità del motore, DRM, encoding, sfide linguistiche
- **Tempo stimato** su **18 modelli LLM** — Ollama (Gemma 4, Qwen 3, Llama), OpenAI GPT-4/4o, Claude 3.5, Gemini, DeepL, DeepSeek, Groq
- **5 catene LLM consigliate**: Local (privacy), Cloud (qualità), Hybrid (bilanciato), Budget, Premium — ciascuna con punteggio di costo e qualità
- **Rilevamento DRM**: Denuvo, VMProtect, Steam DRM, EAC, BattlEye — ti avvisa prima di provare
- **Analisi encoding**: Shift-JIS, UTF-8, UTF-16, Big5, EUC-KR rilevati per file
- **Complessità della traduzione**: onorifici, concordanza di genere, RTL, ruby/furigana, gestione specifica CJK
- **Punteggio di confidenza** e **piano di workflow** — i passi esatti che verranno eseguiti quando clicchi "String it!"
- **Export report** (JSON + Markdown) per condivisione o archiviazione

### P.T.Rank — Classifica Rapida

Dopo aver eseguito P.T. su più giochi, apri **P.T.Rank** per vedere tutti i titoli analizzati ordinati per difficoltà. Perfetto per pianificare la tua coda di traduzione: inizia dai giochi facili, lascia per ultimi gli RPG da 800k stringhe.

### Dry Run Scanner

Non vuoi analizzare un gioco alla volta? Esegui **Dry Run** dalla pagina Libreria per scansionare **l'intera libreria Steam (800+ giochi) in batch**, con **zero modifiche ai file**. Ottieni un report JSON che categorizza ogni gioco come **Ready** (motore supportato + stringhe estraibili), **Errors** (problemi del manifest / blocco DRM) o **Unsupported** (motore sconosciuto / nessun testo). Il progresso è in tempo reale e non serve backup perché nulla viene toccato.

### String it! Smart Gate

Il pulsante **"String it!"** nella pagina di dettaglio del gioco è intelligente: se il gioco è già stato analizzato da P.T. nelle ultime 24h, avvia direttamente il wizard di traduzione. Altrimenti suggerisce di eseguire prima P.T. (con scelta one-click "Run P.T. first" / "String it! anyway"). Niente più esecuzioni sprecate su giochi che si rivelano bloccati da DRM o affari di 5 minuti.

---

## 🎯 Motori di gioco supportati

GameStringer supporta **20+ motori** con diversi livelli di profondità:

| Motore | Supporto | Come funziona |
|--------|---------|--------------|
| **Unity** | ✅ Completo | Installa automaticamente BepInEx + XUnity.AutoTranslator + pipeline Unity Localization Package (StringTable, SharedTableData, Addressables, Smart Strings) |
| **Unreal Engine** | ✅ Completo | Estrazione e patching `.locres` con UnrealLocres |
| **Unreal _P.pak** | ✅ Completo | Packaging mod come `<GameStringer>_P.pak` caricato tramite cartella Paks |
| **Godot** | ✅ Completo | Supporto nativo file `.translation` |
| **RPG Maker** | ✅ Completo | MV/MZ JSON, VX/Ace via Trans, XP via RMXP |
| **Ren'Py** | ✅ Completo | Parsing nativo script `.rpy` con rilevamento dialoghi |
| **GameMaker** | ⚡ Parziale | Via integrazione UndertaleModTool |
| **Telltale** | ✅ Completo | Supporto `.langdb` / `.dlog` |
| **Wolf RPG** | ✅ Completo | Integrazione WolfTrans |
| **Kirikiri** | ✅ Completo | Parsing `.ks` / `.scn` |
| **TyranoScript** | ✅ Completo | Estrattore fast-path con patching JSON |
| **Electron** | ✅ Completo | Unpacking ASAR + rilevamento i18n JSON |
| **Bethesda (Skyrim/Fallout/Oblivion/Starfield)** | ✅ **NEW v1.6.0** | Parser BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1), STRINGS/DLSTRINGS/ILSTRINGS |
| **CRI Middleware (Persona/Yakuza/Tales of/Dragon Ball)** | ✅ **NEW v1.6.0** | CPK + CRILAYLA + MSG/BMD/FTD con auto-detect Shift-JIS/UTF-8/UTF-16 |
| **Visionaire Studio** | ✅ Completo | Avventure Daedalic (Deponia, Edna, ecc.) |
| **Danganronpa WAD** | ✅ Completo | Parser archivio WAD + patching dialoghi STX |

> **I giochi Unity** ricevono un trattamento speciale: se non vengono trovati file traducibili, GameStringer rileva che è un gioco Unity e offre di **installare automaticamente BepInEx + XUnity.AutoTranslator** con un clic. Basta avviare il gioco una volta dopo l'installazione, poi ri-scansionare — tutto il testo diventa traducibile.
>
> ⚠️ **Avviso Anti-Cheat**: BepInEx (DLL injection) può attivare sistemi anti-cheat (EAC, BattlEye, Vanguard). GameStringer include rilevamento anti-cheat e ti avviserà. **Usare solo su giochi single-player / offline.** P.T. rileva il DRM prima di qualsiasi modifica.

---

## ✨ Funzionalità

### 🤖 Traduzione IA

- **20+ provider**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, DeepL, Ollama (locale), LM Studio, TranslateGemma, HY-MT, Qwen 3, NLLB-200, Cerebras, Together AI, Fireworks, OpenRouter, Cohere, Lingva, MyMemory
- **Context-aware**: comprende genere del gioco, voce del personaggio, tono, narrazione vs UI vs dialogo
- **Translation Memory e Glossario**: coerenza nel progetto con estrazione automatica del glossario
- **Multi-LLM Compare**: esegue più provider in parallelo, scegli il miglior risultato per stringa
- **Auto-Select Engine** (NEW v1.7.0): preset `auto` che classifica dinamicamente i provider per lingua di destinazione + genere del gioco (DeepL per le europee, Claude per CJK, boost basato sul genere)
- **Quality gates**: punteggio QA automatico su ogni stringa tradotta (0-100) con ContentTypeBadge
- **Vision LLM Translator**: usa screenshot in-game per il contesto (Ollama, Gemini, GPT-4o)
- **Live Quality Preview**: vedi i punteggi di qualità in tempo reale durante la traduzione batch
- **Supporto RTL**: rilevamento automatico della direzione e gestione attributo `dir`

### 🧠 P.T. — Prediction Tool (v1.6.0)

- **Difficulty Score 0-100** con fattori ponderati (volume, motore, DRM, encoding, complessità)
- **Stime di tempo per 18 modelli LLM** inclusi Gemma 4 (27B MoE A4B / E4B / E2B)
- **5 catene LLM** (Local / Cloud / Hybrid / Budget / Premium) con stime di costo e qualità
- **Rilevamento DRM / Anti-Cheat** (Denuvo, VMProtect, Steam DRM, EAC, BattlEye, Vanguard)
- **Analisi encoding** per file (Shift-JIS, UTF-8/16, Big5, EUC-KR)
- **Analisi complessità traduzione** (onorifici, genere, CJK, ruby, RTL)
- **P.T.Rank / Quick Ranking** — ordina tutti i giochi analizzati per difficoltà
- **Dry Run Scanner** — scansione batch dell'intera libreria Steam (800+ giochi) senza modifiche
- **Workflow Orchestrator** — motore di esecuzione reale con fast path universale per 6+ motori e progresso in tempo reale
- **Prediction cache** (24h) — riapertura istantanea di giochi già analizzati
- **Export report** (JSON + Markdown) per condivisione e archiviazione

### 📚 Libreria Giochi

- **Auto-detect**: Steam (con Family Sharing), Epic, GOG Galaxy, Origin/EA, Ubisoft Connect, Amazon Games, itch.io
- **800+ giochi** riconosciuti dalle librerie installate in pochi secondi
- **Card dei giochi** con copertine, metadati, badge motore, badge VR, stato di installazione
- **Azioni rapide hover**: String it!, Batch, Community, P.T. — tutte a un clic
- **Game Update Tracker**: rileva quando Steam aggiorna un gioco tradotto (tramite `buildid`), verifica l'integrità della patch (file BepInEx, presenza `_P.pak`), avvisa se è necessario ri-patchare
- Pulsante **"Stop monitoring"** per non tracciare più un gioco specifico

### 🔧 Strumenti di Traduzione

- **One-Click Translate** ("String it!"): scansione → traduzione → patch in un unico flusso
- **Batch Translation**: traduci interi giochi o cartelle in una volta
- **Traduttore Sottotitoli**: SRT, VTT, ASS/SSA con preservazione del timing
- **OCR Translator**: estrae testo da giochi retro (preset 8-bit, 16-bit, DOS) con backend Tauri Tesseract reale
- **Voice Pipeline**: speech-to-text → traduci → text-to-speech con **Duration Matching** (NEW v1.7.0) — regola automaticamente la velocità per corrispondere alla durata dell'audio originale
- **Lip Sync** (NEW v1.7.0): integrazione Rhubarb per generazione visemi, export per Unity/Unreal
- **Gridly CSV Export/Import** (NEW v1.7.0): formato multi-lingua compatibile con Gridly/Lokalise/Crowdin
- **Real-time Overlay**: vedi le traduzioni mentre giochi tramite VR/screen overlay
- **Auto-Translate Review**: pulsante "Translate all untranslated" con barra di progresso
- **Lore Assistant**: chat RAG che conosce lore e dialoghi del gioco
- **Character Voice Profiles**: definisci personalità, tono, pattern di linguaggio per personaggio
- **Translation Confidence Heatmap**: panoramica visiva della qualità di tutte le traduzioni

### 🎮 Patcher per Motori di Gioco

- **Unity**: auto-installer BepInEx + XUnity.AutoTranslator, Unity Localization Package (StringTable, SharedTableData, catalogo Addressables, validatore Smart Strings)
- **Unreal Engine**: estrazione `.locres` + mod packaging `_P.pak`
- **Bethesda Engine Patcher** (NEW v1.6.0): Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield — BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1)
- **CRI Middleware Patcher** (NEW v1.6.0): Persona 5 Royal, Yakuza, Tales of, Dragon Ball — CPK + CRILAYLA + MSG/BMD/FTD
- **Ren'Py**, **RPG Maker**, **Godot**, **GameMaker**, **Kirikiri**, **Wolf RPG**, **Telltale**, **Visionaire**, **Danganronpa WAD** — tutti con parser nativi
- **Wizard Stepper**: UI multi-step condivisa per tutti i patcher
- **Universal PO Export** (gettext `.po`) per ogni patcher con metadati progetto/lingua/sorgente/motore
- **Backup automatico**: prima di ogni patch, con ripristino one-click

### 🔌 Avanzate

- **Auto-Hook Scanner**: scansione memoria processo (Windows WinAPI) per stringhe hardcoded
- **System Monitor**: uso VRAM/RAM in tempo reale per pianificazione LLM locale
- **Ollama Setup Wizard**: installazione IA locale passo-passo
- **Ollama Manager**: auto-discovery di modelli dal registro ollama.com + auto-refresh su focus/navigazione
- **Debug Console**: console integrata con log intercept
- **Video Extractor** (v1.7.0): estrai e converti video FMV da giochi retro/moderni con upscaling IA
- **Plugin System**: design doc per plugin di terze parti (vedi `PLUGIN_SYSTEM.md`)
- **Community Hub**: condividi e scarica translation memories + integrazione GitHub Discussions
- **Public API v1**: endpoint REST per integrazione (`/api/v1/translate`, `/api/v1/batch`)

### 💬 Community Chat

- **Chat in tempo reale** con altri traduttori via Supabase Realtime
- **4 stanze predefinite**: General, Translations, Feedback & Bugs, Announcements
- **Stanze personalizzate**: crea stanze per giochi o progetti specifici
- **Auto-Bridge Auth**: il tuo profilo GameStringer si sincronizza automaticamente con Supabase — nessun login extra
- **Presenza online**: vedi chi è online in ogni stanza
- **Rispondi / modifica / elimina** messaggi con ownership enforced da RLS
- **Widget drawer espandibile** nell'angolo in basso a destra

### ♿ Accessibilità (v1.6.0)

- **WCAG 2.1 AA sweep** — `aria-label` sui pulsanti icona, heading semantici `CardTitle`, `focus-visible` su tutte le primitive, link skip-to-content, landmark `main`, helper `sr-only` italiani
- **`prefers-reduced-motion`** rispettato in tutte le animazioni
- **`forced-colors`** (Windows High Contrast Mode) rispettato
- **UI in 11 lingue**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL
- **Supporto layout RTL** con rilevamento automatico della direzione

### 🎨 Design System (v1.6.0)

- **Varianti Card** tramite `cva`: default, muted, highlight, success, error, warning
- **Dimensioni Button** incluse `xs` e `icon-sm`
- **Text utilities**: `text-micro` (9px), `text-2xs` (10px) — niente più valori Tailwind arbitrari
- **Radix UI unificato**: migrati 37 file da `@radix-ui/react-*` a `radix-ui`, 27 pacchetti rimossi
- **Bundle ottimizzato**: `optimizePackageImports` per radix-ui, framer-motion, recharts, cmdk

### 🖥️ App

- **Auto-updates firmati**: aggiornamento one-click dall'app via Tauri Updater
- **Profili**: profili utente multipli con recovery key
- **Global Hotkeys**: `Ctrl+Shift+T` OCR, `Ctrl+Shift+Q` Quick Translate, `Ctrl+Alt+O` Overlay, `Alt+T` toggle XUnity
- **System Tray**: azioni rapide, stato Ollama live, sottomenu strumenti
- **Cross-platform**: Windows e Linux con build native
- **Fix tray Windows**: previene il loop di flash console allo spawn di processi figli

---

## 🔧 AI Provider

| Provider | API Key | Free Tier | Ideale per |
|----------|---------|-----------|----------|
| **Ollama** | No (locale) | ✅ Illimitato | Privacy, offline |
| **LM Studio** | No (locale) | ✅ Illimitato | Privacy, modelli GGUF |
| **TranslateGemma** | No (Ollama) | ✅ Illimitato — 55 lingue, Google | **Inizio consigliato** |
| **HY-MT1.5** | No (Ollama) | ✅ Illimitato — ~1GB RAM, Tencent | Macchine con poca RAM |
| **Qwen 3** | No (Ollama) | ✅ Illimitato — multilingua | Lingue CJK |
| **Gemma 4** | No (Ollama) | ✅ Illimitato — 27B MoE A4B/E4B/E2B | Qualità locale |
| **Gemini** | Sì | ✅ Free tier (15 RPM) | **Cloud consigliato** |
| **DeepSeek** | Sì | ✅ $0.14/1M input | Cloud economico |
| **Groq** | Sì | ✅ 14.400 req/giorno | Velocità |
| **Mistral** | Sì | ✅ Free tier | Cloud UE |
| **OpenAI** | Sì | A pagamento | Qualità GPT-4o |
| **Claude** | Sì | A pagamento | Sfumature, contesto lungo |
| **DeepL** | Sì | ✅ 500k caratteri/mese | Lingue europee |
| **MyMemory** | No | ✅ Illimitato | Fallback |
| **Lingva** | No | ✅ Illimitato | Mirror Google MT |
| **Cerebras** | Sì | ✅ Free tier | Velocità |
| **Together AI** | Sì | ✅ $25 di credito gratis | Modelli aperti |
| **Fireworks** | Sì | ✅ Free tier | Modelli aperti |
| **OpenRouter** | Sì | ✅ Modelli gratuiti | Varietà modelli |
| **NLLB-200** | Sì | ✅ 200 lingue | Lingue rare |
| **Cohere** | Sì | ✅ Prova gratuita | RAG |

**Consigliati per iniziare**: **TranslateGemma** via Ollama (gratis, locale, 55 lingue) o **Gemini** (free tier, cloud). Poca RAM: **HY-MT1.5** (~1GB). Migliore qualità: **Claude 3.5** o **GPT-4o**. Miglior CJK: **Qwen 3**.

---

## 📖 Documentazione

### Guide Utente (11 lingue)

| | | |
|---|---|---|
| 🇮🇹 [Italiano](docs/GUIDA_UTENTE.md) | 🇬🇧 [English](docs/USER_GUIDE_EN.md) | 🇪🇸 [Español](docs/USER_GUIDE_ES.md) |
| 🇫🇷 [Français](docs/USER_GUIDE_FR.md) | 🇩🇪 [Deutsch](docs/USER_GUIDE_DE.md) | 🇯🇵 [日本語](docs/USER_GUIDE_JA.md) |
| 🇨🇳 [中文](docs/USER_GUIDE_ZH.md) | 🇰🇷 [한국어](docs/USER_GUIDE_KO.md) | 🇧🇷 [Português](docs/USER_GUIDE_PT.md) |
| 🇷🇺 [Русский](docs/USER_GUIDE_RU.md) | 🇵🇱 [Polski](docs/USER_GUIDE_PL.md) | |

### Documentazione di Progetto

- **[CHANGELOG.md](CHANGELOG.md)** — storico completo delle versioni
- **[docs/VERSIONING.md](docs/VERSIONING.md)** — policy di versioning
- **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** — roadmap attuale
- **[PLUGIN_SYSTEM.md](PLUGIN_SYSTEM.md)** — design dell'architettura plugin
- **[LICENSE](LICENSE)** — Source-Available License v1.1

---

## 🛠️ Compilazione dai sorgenti

**Prerequisiti**: Node.js 18+, Rust 1.70+, npm. Su Linux anche: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.

```bash
git clone https://github.com/rouges78/GameStringer.git
cd GameStringer
npm install
npm run dev          # sviluppo
npm run tauri:build  # build di produzione
```

Backend Rust: `cd src-tauri && cargo check` per verificare che i comandi Tauri compilino sulla tua piattaforma.

---

## 💖 Supporto

Se GameStringer ti ha aiutato a giocare nella tua lingua:

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

## 📜 Licenza

**Source-Available License v1.1** — il codice sorgente è pubblico e puoi compilarlo tu stesso, ma non è "Open Source" approvato OSI.

- ✅ Gratuito per uso personale
- ✅ Libero di ispezionare, compilare e modificare per te stesso
- ❌ L'uso commerciale richiede permesso scritto
- ❌ La ridistribuzione di versioni modificate richiede permesso scritto

Vedi [LICENSE](LICENSE) per i dettagli. Domande? Apri una [Discussion](https://github.com/rouges78/GameStringer/discussions).

---

## 🙏 Credits

- **[BepInEx](https://github.com/BepInEx/BepInEx)** — framework di modding Unity (BepInEx Team)
- **[XUnity.AutoTranslator](https://github.com/bbepis/XUnity.AutoTranslator)** — framework di traduzione Unity (bbepis)
- **[UnrealLocres](https://github.com/akintos/UnrealLocres)** — parser Unreal `.locres` (akintos)
- **[UndertaleModTool](https://github.com/krzys-h/UndertaleModTool)** — modding GameMaker (krzys-h)
- **[Tauri](https://tauri.app)** — framework per app desktop
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** — motore OCR
- **[Ollama](https://ollama.com)** — runtime LLM locale
- **[Supabase](https://supabase.com)** — backend realtime per la Community Chat

---

<p align="center">
  Fatto con ❤️ per i giocatori che vogliono giocare nella loro lingua<br>
  <strong>GameStringer v1.7.0</strong> · © 2025-2026 GameStringer Team
</p>
