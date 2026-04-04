<p align="center">
  <img src="public/logo.png" alt="GameStringer Logo" width="180" />
</p>

<h1 align="center">GameStringer</h1>

<p align="center">
  <strong>App desktop che traduce i videogiochi in qualsiasi lingua usando l'AI.</strong><br>
  Scegli un gioco dalla libreria, seleziona la lingua, clicca traduci — fatto.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/versione-1.6.0-blue" alt="Versione" />
  <img src="https://img.shields.io/badge/piattaforma-Windows%20%7C%20Linux-lightgrey" alt="Piattaforma" />
  <img src="https://img.shields.io/badge/licenza-Source--Available-green" alt="Licenza" />
  <img src="https://img.shields.io/badge/Tauri_2-24C8DB?logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/Next.js_15-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Rust-orange?logo=rust&logoColor=white" alt="Rust" />
</p>

<p align="center">
  <a href="#-cosè-gamestringer">Cos'è</a> ·
  <a href="#-download">Download</a> ·
  <a href="#-come-funziona">Come funziona</a> ·
  <a href="#-engine-supportati">Engine</a> ·
  <a href="#-funzionalità">Funzionalità</a> ·
  <a href="#%EF%B8%8F-compila-da-sorgente">Build</a>
</p>

<p align="center">
  <a href="README.md">🇬🇧 Read in English</a>
</p>

---

## 🎮 Cos'è GameStringer?

GameStringer è un'**applicazione desktop** (Windows e Linux) che ti permette di tradurre i videogiochi che non hanno la tua lingua.

La maggior parte dei giochi salva i testi in file — JSON, XML, CSV, .locres, .rpy e molti altri formati. GameStringer **scansiona la cartella del gioco**, trova quei file, invia il testo a un **provider AI di traduzione** a tua scelta (OpenAI, Gemini, DeepSeek, Ollama, ecc.) e **reinserisce il testo tradotto** nel gioco. Un click, nessuna competenza tecnica richiesta.

Per i **giochi Unity** che bloccano il testo dentro gli asset compilati, GameStringer **installa automaticamente BepInEx + XUnity.AutoTranslator** — nessun setup manuale.

**Non è un sito di traduzione automatica.** È una pipeline completa: rileva il gioco → estrai il testo → traduci con AI → controllo qualità → patcha → gioca.

---

## 📥 Download

Scarica l'ultima release da **[GitHub Releases](https://github.com/rouges78/GameStringer/releases)**:

| Piattaforma | File | Note |
|-------------|------|------|
| **Windows** | `GameStringer-Setup.exe` | Installer (consigliato) |
| **Windows** | `GameStringer-Portable.zip` | Nessuna installazione |
| **Linux** | `GameStringer.AppImage` | Universale (consigliato) |
| **Linux** | `GameStringer.deb` | Debian / Ubuntu |

**Requisiti:** Windows 10+ o Linux (Ubuntu 22.04+, Fedora 38+), 4 GB RAM (8 GB+ per AI locale), 500 MB disco.

---

## 🚀 Come funziona

1. **Installa** GameStringer e avvialo
2. **La libreria giochi si carica automaticamente** — Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io
3. **Scegli un gioco** e clicca **"Traduci"**
4. **Seleziona la lingua** e il provider AI
5. GameStringer scansiona i file, traduce tutto e genera una patch
6. **Applica la patch** — il gioco è nella tua lingua

Tutto qui. Niente terminale, niente file da modificare a mano, niente esperienza di modding.

---

## � Engine Supportati

| Engine | Supporto | Come funziona |
|--------|----------|---------------|
| **Unity** | ✅ Completo | Installa automaticamente BepInEx + XUnity.AutoTranslator |
| **Unreal Engine** | ✅ Completo | Estrazione e patching .locres |
| **Godot** | ✅ Completo | File .translation nativi |
| **RPG Maker** | ✅ Completo | MV/MZ JSON, VX/Ace via Trans |
| **Ren'Py** | ✅ Completo | Parsing script .rpy nativo |
| **GameMaker** | ⚡ Parziale | Via UndertaleModTool |
| **Telltale** | ✅ Completo | Supporto .langdb / .dlog |
| **Wolf RPG** | ✅ Completo | Integrazione WolfTrans |
| **Kirikiri** | ✅ Completo | Parsing .ks / .scn |

> I **giochi Unity** hanno un trattamento speciale: se non vengono trovati file traducibili, GameStringer rileva che è un gioco Unity e propone di **installare automaticamente BepInEx + XUnity.AutoTranslator** con un click. Basta avviare il gioco una volta dopo l'installazione, poi ri-scansionare — tutti i testi diventano traducibili.
>
> ⚠️ **Avviso Anti-Cheat**: BepInEx (iniezione DLL) può attivare sistemi anti-cheat (EAC, BattlEye, Vanguard). GameStringer include il rilevamento anti-cheat e ti avviserà. **Usalo solo su giochi single-player / offline.**

---

## ✨ Funzionalità

### Traduzione AI

- **18+ provider**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, DeepL, Ollama (locale), LM Studio, Qwen 3, NLLB-200 e altri
- **Consapevole del contesto**: comprende genere, voce dei personaggi, tono
- **Memoria di Traduzione e Glossario**: coerenza in tutto il progetto
- **Confronto Multi-LLM**: esegui più provider in parallelo, scegli il risultato migliore
- **Quality gates**: controllo qualità automatico su ogni stringa

### Libreria Giochi

- **Rilevamento automatico**: Steam (con Family Sharing), Epic, GOG Galaxy, Origin/EA, Ubisoft Connect, Amazon Games, itch.io
- **600+ giochi** riconosciuti dalle librerie installate
- **Schede gioco** con copertina, metadati e traduzione con un click

### Strumenti di Traduzione

- **Traduci con un Click**: scansiona → traduci → patcha in un solo flusso
- **Traduzione Batch**: traduci interi giochi in una volta
- **Vision LLM**: usa screenshot del gioco per traduzioni context-aware (Ollama, Gemini, GPT-4o)
- **Traduttore Sottotitoli**: SRT, VTT, ASS/SSA con preservazione timing
- **Traduttore OCR**: estrai testo da giochi retro (preset 8-bit, 16-bit, DOS)
- **Pipeline Vocale**: speech-to-text → traduzione → text-to-speech
- **Overlay Real-time**: vedi le traduzioni mentre giochi

### Avanzati

- **Lore Assistant**: chat RAG che conosce il lore e i dialoghi del gioco
- **Profili Voce Personaggio**: definisci personalità, tono, pattern vocali per personaggio
- **Heatmap Confidenza Traduzione**: panoramica visiva della qualità di tutte le traduzioni
- **Auto-Hook Scanner**: scansione memoria processo (Windows)
- **Community Hub**: condividi e scarica memorie di traduzione
- **API Pubblica v1**: endpoint REST per integrazione (`/api/v1/translate`, `/api/v1/batch`)

### App

- **UI in 11 lingue**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL
- **Aggiornamenti automatici firmati**: aggiorna con un click dall'app
- **System Monitor**: utilizzo VRAM/RAM in tempo reale
- **Profili**: profili utente multipli con chiavi di recupero
- **Cross-platform**: Windows e Linux con build native

---

## 🔧 Provider AI

| Provider | API Key | Tier Gratuito |
|----------|---------|---------------|
| Ollama | No (locale) | ✅ Illimitato |
| LM Studio | No (locale) | ✅ Illimitato |
| Gemini | Sì | ✅ Tier gratuito |
| DeepSeek | Sì | ✅ Molto economico |
| Groq | Sì | ✅ 14.400 req/giorno |
| Mistral | Sì | ✅ Tier gratuito |
| OpenAI | Sì | A pagamento |
| Claude | Sì | A pagamento |
| DeepL | Sì | ✅ 500k car/mese |
| MyMemory | No | ✅ 1000 parole/giorno |

**Per iniziare**: **Ollama** (gratuito, locale) o **Gemini** (tier gratuito, cloud).

---

## 📖 Documentazione

Guide utente in 11 lingue:

| | | |
|---|---|---|
| 🇮🇹 [Italiano](docs/GUIDA_UTENTE.md) | 🇬🇧 [English](docs/USER_GUIDE_EN.md) | 🇪🇸 [Español](docs/USER_GUIDE_ES.md) |
| 🇫🇷 [Français](docs/USER_GUIDE_FR.md) | 🇩🇪 [Deutsch](docs/USER_GUIDE_DE.md) | 🇯🇵 [日本語](docs/USER_GUIDE_JA.md) |
| 🇨🇳 [中文](docs/USER_GUIDE_ZH.md) | 🇰🇷 [한국어](docs/USER_GUIDE_KO.md) | 🇧🇷 [Português](docs/USER_GUIDE_PT.md) |
| 🇷🇺 [Русский](docs/USER_GUIDE_RU.md) | 🇵🇱 [Polski](docs/USER_GUIDE_PL.md) | |

---

## 🛠️ Compila da Sorgente

**Prerequisiti**: Node.js 18+, Rust 1.70+, npm. Su Linux anche: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.

```bash
git clone https://github.com/rouges78/GameStringer.git
cd GameStringer
npm install
npm run dev          # sviluppo
npm run tauri:build  # build produzione
```text

---

## 💖 Supporta

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

**Licenza Source-Available** — il codice sorgente è pubblico e puoi compilarlo tu stesso, ma non è "Open Source" approvato OSI.

- ✅ Gratuito per uso personale
- ✅ Libero di ispezionare, compilare e modificare per sé
- ❌ Uso commerciale richiede permesso scritto
- ❌ Ridistribuzione di versioni modificate richiede permesso scritto

Vedi [LICENSE](LICENSE) per i dettagli. Domande? Apri una [Discussione](https://github.com/rouges78/GameStringer/discussions).

---

## 🙏 Crediti

- **[BepInEx](https://github.com/BepInEx/BepInEx)** — Framework modding Unity (BepInEx Team)
- **[XUnity.AutoTranslator](https://github.com/bbepis/XUnity.AutoTranslator)** — Framework traduzione Unity (bbepis)
- **[Tauri](https://tauri.app)** — Framework app desktop
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** — Motore OCR

---

<p align="center">
  Fatto con ❤️ per i gamer che vogliono giocare nella propria lingua<br>
  <strong>GameStringer v1.6.0</strong> · © 2025-2026 GameStringer Team
</p>
