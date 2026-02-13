# GameStringer Changelog

> Software professionale per la localizzazione di videogiochi.
> 
> **Stack**: Tauri v2 (Rust) + Next.js 15 + TailwindCSS

---

## 🗺️ Roadmap verso 1.0.0

| Fase | Versione | Stato |
|:-----|:---------|:------|
| Alpha | 0.1.x - 0.4.x | ✅ Completato |
| Beta | 0.5.x - 0.8.x | ✅ Completato |
| Release Candidate | 0.9.x | ✅ Completato |
| Release Pubblica | 1.0.0 | ✅ Rilasciato |

---

## 📅 Febbraio 2026

### v1.4.0 — Radix Unificato, Quality Badges & Pulizia Codebase 🧹✨

> **Data**: 2026-02-13

#### 📦 Migrazione Radix UI

- **Pacchetto unificato**: migrati 37 file da `@radix-ui/react-*` a `radix-ui`
- **27 pacchetti rimossi**: accordion, alert-dialog, avatar, checkbox, dialog, dropdown-menu, etc.
- **Pattern aggiornato**: `VisuallyHidden.Root`, `Slot.Root` per namespace exports

#### 🏆 Quality Badge nel Traduttore Pro

- **Per-riga**: ogni traduzione mostra `QualityScoreBadge` (0-100) e `ContentTypeBadge` (UI/Dialogo/Narrativa/Sistema)
- **Live Preview**: ultime 3 traduzioni con score qualità in tempo reale durante il batch
- **Tabella risultati**: fino a 200 righe con originale, traduzione, tipo e qualità

#### 🌍 Nuove Feature

- **Supporto RTL**: `lib/rtl.ts` con rilevamento automatico direzione testo
- **Ollama Generico**: `translateWithOllamaGeneric` con PROVIDER_MAP e chain presets fallback

#### ⚡ Ottimizzazione & Pulizia

- **Bundle**: `optimizePackageImports` aggiornato con `radix-ui`, `framer-motion`, `recharts`, `cmdk`, `react-hook-form`
- **0 errori TypeScript** nei sorgenti (da ~15)
- **Fix**: regex type casting in `translation-quality.ts` e `translation-validator.ts`
- **Fix**: props opzionali mancanti in `NotificationToastProps`, `TutorialProviderProps`, `CreateNotificationRequest`
- **Fix**: `TranslationMemoryEntry.usageCount` reso opzionale

---

### v1.3.0 — Danganronpa WAD Patcher & Export System 🎮📦

> **Data**: 2026-02-09

#### 🎮 Danganronpa WAD Patcher v15

- **All-Ice base + GameStringer override**: sistema di patching completo
- **35.865 stringhe** estratte dal WAD per traduzione
- **WAD Text Extractor CLI**: `scripts/extract-wad-text.mjs` per estrazione testi
- **WAD Patcher CLI**: `scripts/patch-wad-v15.mjs` con override selettivo

#### 🔍 WAD Extractor UI

- **Nuovo tab** "WAD Extractor" nel Danganronpa Patcher
- **Editor integrato** con ricerca, filtri e modifica stringhe
- **Traduzione batch AI** delle stringhe estratte
- **Export JSON** delle traduzioni

#### 📦 Export Patch Distribuibile

- **Backend Rust**: comando `export_danganronpa_patch` con `zip` crate (streaming ~626 MB)
- **UI Export**: bottone "Esporta .zip" con dialog salvataggio nativo (`@tauri-apps/plugin-dialog`)
- **Contenuto ZIP**: WAD patchato, `install.bat` (installer automatico Steam), `LEGGIMI.txt`, `translations.json`
- **Script CLI**: `scripts/export-danganronpa-patch.mjs` alternativo senza dipendenze

#### 📊 Dashboard Stats Reali

- **Translation Memory**: dati reali dal backend Rust (`list_translation_memories`)
- **Activity History**: traduzioni completate, patch applicate
- **Tempo Risparmiato**: calcolato da TM entries + traduzioni
- **Entry TM**: conteggio reale unità nelle Translation Memory

#### 🎨 UI Compattata

- **Danganronpa Patcher**: tutti i tab (PAK, PO, Patch, LIN, WAD Extractor) ottimizzati
- **Header ridotti**: `py-1.5 px-3`, titoli `text-xs`, icone `w-3 h-3`
- **ScrollArea ridotte**: 300-320px per massimizzare spazio
- **Empty states** minimali e gap uniformi `gap-2`

---

### v1.2.0 — Fallback Provider & Full Tauri Compatibility 🛡️

> **Data**: 2026-02-06

#### 🛡️ Fallback Provider Automatico

- **Traduzione con fallback**: Gemini → DeepSeek → OpenAI → testo originale
- **Helper centralizzato**: `lib/ai-translate-direct.ts` con `translateWithFallback()` e `translateSingleWithFallback()`
- **10+ componenti aggiornati** per usare il fallback automatico
- **Zero crash** se un provider fallisce o la quota è esaurita

#### 🔧 Audit /api/* Completato al 100%

- **0 fetch('/api/') attive** — tutto funziona senza API routes Next.js
- **Injection UI** → Tauri `invoke()` (list_running_processes, start_injection, stop_injection)
- **Secrets dashboard** → localStorage
- **Logging dashboard** → localStorage
- **Translation import** → localStorage TM diretta
- **GitHub discussions** → GitHub API diretta
- **Language detect** → solo rilevamento locale
- **Force refresh** → solo Tauri (rimosso fallback API)

#### 🔍 Danganronpa Filtro Smart

- **Nuovo modulo**: `lib/danganronpa-filter.ts`
- **Filtro locale**: elimina vuoti, duplicati, stringhe sistema, codici, UI buttons
- **Classificazione AI** (opzionale): priorità 1-5 per dialoghi
- **Risultato atteso**: 18K → ~3K stringhe rilevanti
- **Stima risparmio**: mostra costo evitato nel toast

#### 🧪 Test E2E Playwright

- **38 test reali** tutti passanti (da 5 scheletrici)
- **navigation.spec.ts**: 14 test (core pages, tool pages, sidebar, 404, console errors)
- **translation.spec.ts**: 19 test (settings, AI translator, batch, TM, quality, specialized tools)
- **danganronpa.spec.ts**: 5 test (page load, filtro dialoghi, stima costi)

#### 🐛 Bug Fix

- **notification-indicator.tsx**: fix precedenza operatori (`||` vs `&&`)
- **Translation Memory**: usa `translateSingleWithFallback` invece di `/api/translate`
- **Offline Cache**: usa `translateSingleWithFallback` invece di `/api/translate`

---

### v1.1.0 — Website Multilingua & Danganronpa Support 🌐

> **Data**: 2026-02-05

#### 🌐 Sito Web Multilingua

- **9 lingue supportate**: EN, IT, ES, DE, FR, JA, ZH, KO, PT
- **Selettore lingua** con bandiere nel nav
- **Auto-detect** lingua browser
- **Persistenza** in localStorage
- **URL params**: `?lang=en`, `?lang=ja`, etc.
- **Cambio dinamico** senza reload pagina

#### 🎮 Danganronpa Auto-Translator

- Supporto nativo per file **PAK/LIN/STX**
- Integrazione con **DRAT** (Danganronpa Another Tool)
- Estrazione e traduzione automatica dialoghi

#### 🧪 Test E2E con Playwright

- **9 test** per navigation, translation e danganronpa
- Configurazione multi-browser (Chromium, Firefox, WebKit)
- Fix errori 500 da conflitto i18n

#### 📝 Documentazione

- Aggiornato `docs/sito/README.md` con info i18n
- Aggiornate guide utente in 6 lingue

---

## 📅 Gennaio 2026

### v1.0.9 — Animated Headers & UI Polish ✨

> **Data**: 2026-01-31

#### ✨ Header Animati

- **Effetto "Respiro"**: Gradiente che si espande/contrae dolcemente (12s)
- **Animazione shimmer**: Keyframes CSS personalizzati per movimento fluido
- **Ombreggiature profonde**: shadow-xl con tinta blu per maggiore profondità
- **16 pagine aggiornate** con nuovo stile header

#### 🎨 UI Miglioramenti

- **Gradiente uniforme**: Sky → Blue → Cyan su tutti gli header Traduzione
- **Menu Sidebar**: Sub-item con hover verde scuro (emerald-600)
- **Coerenza visiva**: Stile unificato su tutte le pagine di traduzione

#### 📄 Pagine Aggiornate

- AI Translator, AI Review, Emotion Translator, OCR Translator
- Memory, Batch, Subtitles, Neural Pro, Translator Tools
- Live OCR, Manga, Texture, Voice Clone
- Character Voice, Multi-LLM, Voice Translator

---

### v1.0.8 — Fix Update Download 🔧

> **Data**: 2026-01-29

#### 🔧 Bug Fix

- **Pulsante Scarica**: Ora apre il browser correttamente
- **Tauri Shell API**: Usato invece di window.open per link esterni
- **Feedback Toast**: Conferma visiva apertura download

---

### v1.0.7 — Community Forum & License Update 💬📜

> **Data**: 2026-01-29

#### 💬 GitHub Discussions Integration

- **Forum integrato**: Tab Discussions nel Community Hub
- **Grafica personalizzata**: UI GameStringer per le discussioni
- **API Route**: Fetch automatico da GitHub con scraping fallback
- **Link esterni**: Apertura con Tauri shell API

#### 🧹 Community Hub Cleanup

- **Dati mock rimossi**: Ora solo dati reali
- **Modal warning rimosso**: Accesso diretto senza popup
- **Bottoni aggiornati**: Stile bordo arancione

#### 📜 Licenza v1.1

- **Source Available License** aggiornata
- **Non-commercial chiarito**: YouTuber/streamer OK con attribuzione
- **Fork permessi**: Fork non-commerciali esplicitamente consentiti
- **Sezione 9**: Aggiornamenti licenza futuri

#### 🌍 Traduzioni

- Chiavi `communityHub.discussions` in **7 lingue** (IT, EN, ES, FR, DE, JA, ZH)

---

### v1.0.6 — Bug Fixing & New Translation Providers 🔧🌐

> **Data**: 2026-01-28

#### 🌐 Nuovi Provider Traduzione

- **Qwen 3**: Provider dedicato per lingue asiatiche (CN/JP/KR) via Ollama
- **NLLB-200**: Supporto 200 lingue (incluse rare: Thai, Vietnamese, Hindi, Arabic) via HuggingFace
- **Ollama Generico**: Usa qualsiasi modello installato in Ollama

#### 🐛 Bug Fixing

- **Catch vuoti**: Sostituiti 8 catch vuoti con logging appropriato
- **Import non utilizzati**: Rimossi ~15 import inutilizzati dai file principali
- **Vitest config**: Aggiunto provider 'v8' mancante per coverage
- **Batch operations**: Fix firme funzioni incompatibili con wrapper

#### 🌍 Traduzioni

- Aggiunte traduzioni mancanti per **5 lingue** (ES, FR, DE, JA, ZH):
  - `voiceCloneGuide` + features
  - `vrOverlayGuide` + features
  - `qualityGatesGuide` + features
  - `playerFeedbackGuide` + features

#### 📄 Documentazione

- **Bug Report**: Creato report dettagliato dei bug (`BUG_REPORT_2026-01-28.md`)

---

### v1.0.5 — AI Voice & VR Tools 🎤🥽

> **Data**: 2026-01-26

#### 🎤 Voice Clone Studio

- **AI voice cloning** with ElevenLabs and OpenAI TTS
- **Text-to-speech synthesis** with multiple voices
- **Custom voice profiles** from audio samples
- **Voice presets**: narrator, hero, villain, child, robot, elderly

#### 🥽 VR Text Overlay

- **Spatial subtitles** for VR games
- **Headset detection**: Oculus, SteamVR, WMR
- **Position presets**: bottom center, top center, peripheral, wrist
- **Customizable style**: font size, opacity, shadow

#### 🛡️ Quality Gates

- **Automatic QA system** for translation validation
- **Checks**: placeholders, numbers, HTML tags, length
- **Context-aware validation**: UI, dialogue, narrative
- **Quality score** with pass/fail threshold

#### 💬 Player Feedback

- **Feedback collection** from players
- **Categories**: accuracy, fluency, context, terminology, style
- **5-star rating system** with status tracking
- **Export** as JSON or CSV

#### 🌐 i18n

- All 4 new tools translated in **7 languages** (IT, EN, ES, DE, JA, ZH)
- Guide page updated with documentation

#### 🎨 UI

- **Green hero headers** for Tools section pages
- **Compact VR Overlay layout** optimized for screen

---

### v1.0.4 — Translation Tools Expansion 🚀

> **Data**: 2026-01-23

#### 🎬 Subtitle Translator

- **Parser completo** per SRT, VTT, ASS/SSA
- **Preview in tempo reale** con validazione QA
- **Export multi-formato** con timing preservato

#### 📁 Batch Folder Translator

- **Scansione ricorsiva** con walkdir (Rust)
- **10+ formati** supportati (JSON, PO, CSV, SRT, VTT, ASS, XML, YAML...)
- **Progress tracking** con pausa/stop

#### 👥 Community Hub

- **Browser pacchetti** TM con search/filter
- **Top contributori** e statistiche
- **Download** Translation Memory dalla community

#### 🎮 Retro ROM Tools

- **8 console** supportate (NES, SNES, GB, GBC, GBA, Genesis, PSX, N64)
- **Table file** (.TBL) parser/generator
- **Font injection** per caratteri accentati italiani

#### 🔌 API Pubblica v1

- `POST /api/v1/translate` - Traduzione singola
- `POST /api/v1/batch` - Traduzione batch (max 100)
- `GET /api/v1/languages` - 20 lingue supportate
- `GET /api/v1/health` - Health check

#### 🖥️ Screen Adaptation

- **Adattamento automatico** risoluzione schermo
- **Breakpoint** per compact (<1400px), normal, 4K (≥3840px)
- **CSS variables** per spacing/font dinamici

#### 🔧 Fix & Miglioramenti

- **Tutorial unificato**: risolto conflitto OnboardingWizard/InteractiveTutorial
- **Hero headers compatti** per Retro e Batch
- **Landing page** pronta per deploy

---

### v1.0.3 — Recovery Key & i18n Complete 🔐

> **Data**: 2026-01-22

#### 🔐 Recovery Key System

- **Sistema recupero password** con 12 parole mnemoniche
- **Generazione automatica** recovery key alla creazione profilo
- **UI copia/download** per salvare la chiave in sicurezza
- **Verifica chiave** per reset password senza email
- **Hash SHA-256** della chiave salvato localmente

#### 🌍 Traduzioni Complete

- **+537 righe** aggiunte per ES, FR, DE
- **9 nuove sezioni** tradotte: gameDetails, notifications, stores, projects, heatmap, activity, ocrTranslator, workshop
- **Tutte le lingue ora complete**: IT, EN, ES, FR, DE, ZH

---

### v1.0.2 — Multilingual Support 🌍

> **Data**: 2026-01-22

#### 🌍 Nuove Lingue

- **Supporto multilingua completo**: Español, Français, Deutsch, 日本語, 中文
- **Selettore lingua** ora attivo per tutte le lingue (rimosso "Coming Soon")
- **Traduzioni Translation Fixer** complete per ES, FR, DE, JA, ZH
- **Traduzioni AI Context Crawler** complete per ES, FR, DE, JA, ZH
- **Categorie glossario** tradotte (personaggio, luogo, oggetto, abilità, nemico, etc.)

#### 🔧 Miglioramenti

- Stringhe "frames", "terms", "fps" tradotte in tutte le lingue
- Nomi categorie nel Context Crawler ora localizzati dinamicamente

---

### v1.0.1 — Game Details Layout Overhaul

> **Data**: 2026-01-21

#### 🎨 Layout Redesign

- **Nuovo layout 3:1** per pagina dettaglio gioco
  - Colonna principale (75%): screenshot gallery grande, tabs File/Traduzioni/Patch
  - Sidebar destra (25%): info gioco, azioni, HLTB
- **Screenshot gallery espansa**: griglia 4 colonne con fino a 12 screenshot
- **Trama completa** nell'header hero (senza limite righe)
- **Raccomandazione Traduzione** a tutta larghezza sotto la griglia
- **Componente TranslationRecommendation** ingrandito e più leggibile

#### 🌍 Traduzioni

- **Traduzioni inglesi complete** per pagina dettaglio gioco
- Nuove chiavi: `scanning`, `filesFound`, `translate`, `noFilesDetected`, `searchTranslatableFiles`, `scan`, `noActiveTranslations`, `engineNotRecognized`, `free`, `loadPlaytime`, `loading`
- **Dialogo chiusura app** tradotto in IT/EN

#### 🐛 Bug Fix

- Risolti problemi di layout con colonne sbilanciate
- Rimossi elementi duplicati dalla pagina dettagli

---

### v1.0.0 — Public Release 🎉

> **Data**: 2026-01-20

#### ✨ Nuove Feature

- **Hero Image Fusion**: immagine gioco fusa nell'header con gradiente cinematografico
  - AI Translator, Neural Translator Pro, Game Detail
  - Effetti blur e overlay per qualità visiva
- **Screenshot Gallery**: mini-galleria 2x2 nella pagina dettaglio gioco
  - Hover zoom + lightbox click
  - Sostituisce immagine ridondante
- **Game Info Espanse**: sviluppatore, publisher, data uscita, generi nella sidebar
- **Raccomandazione Traduzione**: versione compatta e leggibile
- **GitHub Sponsors**: integrazione completa con Stripe Connect

#### 🌍 Traduzioni

- **Componente Support**: tradotto completamente in italiano
- **Pulsanti Libreria**: Aggiorna, Condivisi, Aggiorna DB
- **Testo contestuale**: "Gioco non visibile?" e altri

---

### v0.9.9-beta — Pre-Release Final

> **Data**: 2026-01-19

#### 🚀 Release Preparation

- **Ultima beta** prima del release ufficiale 1.0.0
- **Sistema i18n completo**: supporto Italiano e English
- **Integrazione donazioni**: Ko-fi e GitHub Sponsors
- **Ottimizzazioni finali** e bug fix pre-release

---

### v0.9.6-beta — Tools Suite & Monetization

> **Data**: 2026-01-18

#### ✨ Nuove Feature

- **Mod Injector Universale**: injection automatica per Unity/Unreal/Godot/RPG Maker
- **AI Context Crawler**: estrazione contesto AI da cartelle gioco per prompt ottimali
- **Translation Fixer**: rilevamento e fix automatico tag markup visibili (RPG Maker, Unity, Unreal)
- **Subtitle Overlay**: overlay traduzioni real-time per streaming/recording con export SRT/VTT
- **Bottone Supporta**: integrazione Ko-fi e GitHub Sponsors nell'header
- **Landing Page**: pagina marketing completa per GameStringer

#### 🔒 Licenza

- **Nuova licenza Source-Available**: protezione codice da uso commerciale non autorizzato

#### 🎨 UI

- **Logo personalizzato** integrato in sidebar e landing page
- **Navigazione sidebar** aggiornata con Fixer e Overlay

---

### v0.9.0-beta — Game Detail Page Redesign

> **Data**: 2026-01-12

#### 🎨 Redesign UI

- **Pagina Dettaglio Gioco**: nuovo hero header con gradiente indigo/purple/fuchsia
- **Stats dinamiche** nell'header: piattaforma, stato installazione, data uscita, generi, traduzioni
- **Background immagine gioco** integrato nell'header con overlay
- **Metacritic score** con colori dinamici (verde/giallo/rosso) e shadow

#### 🚀 Milestone

- Raggiunta versione **0.9.x Release Candidate**
- Beta completata (0.5.x - 0.8.x)

---

### v0.8.9-beta — UI Redesign & Navigation

> **Data**: 2026-01-08

#### 🎨 Redesign UI

- **Sidebar riorganizzata**: da 17 a 6 elementi per navigazione pulita e compatta
- **Header hero colorati** per tutte le pagine principali:
  - Traduci: gradiente viola/pink
  - Patcher: gradiente verde/teal
  - Community: gradiente arancione/ambra
  - Impostazioni: gradiente sky/indigo
- **Dialog Impostazioni Profilo**: design viola/pink con card colorate per sezioni
- **Dialog Sicurezza Profilo**: design cyan/emerald con card colorate

#### ✨ Nuove Feature

- Link rapidi agli strumenti secondari nelle pagine principali
- Strumenti accessibili da Impostazioni (Neural Pro, OCR, Visual Editor, Unreal, Telltale, etc.)

#### 🔧 Fix

- Accessibilità: aggiunto `DialogTitle` con `VisuallyHidden` per screen reader

---

### v0.8.8-beta — Onboarding & Offline Support

> **Data**: 2026-01-08

#### ✨ Nuove Feature

- **Wizard Onboarding**: configurazione guidata al primo avvio
- **Indicatore stato offline**: nell'header con feature disponibili
- **Sistema cache offline**: per traduzioni, giochi e pack
- **Tooltip contestuali**: aiuto in-app per le funzionalità
- **Servizio offline-support**: funzionalità senza internet

---

### v0.8.3-beta — Parser & Tools Expansion

> **Data**: 2026-01-08

#### ✨ Nuove Feature

- **Parser Godot Engine**: supporto file `.tres`, `.tscn`, `.cfg`, `.translation`
- **Parser Ren'Py**: supporto file `.rpy` per visual novel
- **Theme Toggle**: switch chiaro/scuro/auto nell'header
- **Telltale Patcher migliorato**:
  - Backup automatico file originali
  - Ripristino backup con un click
  - Verifica installazione traduzione

#### 🛠️ Infrastruttura

- Script `version-manager.js` sincronizza automaticamente tutte le versioni
- Nuovi comandi Rust: `create_directory_backup`, `restore_directory_backup`
- Comando `npm run version:sync` per sincronizzare versioni

---

### v0.8.2-beta — Telltale Support & Image Fix

> **Data**: 2026-01-08

#### ✨ Nuove Feature

- **Telltale Patcher**: nuovo strumento per traduzioni giochi Telltale (Wolf Among Us, Walking Dead, Batman, etc.)
- **Parser Telltale**: supporto file `.langdb`, `.landb`, `.dlog`
- Rilevamento automatico piattaforma (Steam/GOG/Epic) per giochi Telltale
- Istruzioni specifiche per versione GOG (script batch)

#### 🔧 Fix

- **Immagini giochi**: corretto caricamento copertine nella pagina dettaglio
- Passaggio `appId` numerico dalla libreria alla pagina dettaglio
- Evitato URL immagini Steam con appId 0 (causava sfondo bianco)
- Steam API 403: gestito rate limiting gracefully (restituisce null invece di errore)

#### 🛠️ Infrastruttura

- Aggiornato `tauri-cli` da 1.6.5 a 2.5.0 (fix compatibilità config v2)
- Nuovo comando Rust `check_path_exists` per verifiche filesystem

---

### v0.8.1-beta — UI Polish & Fixes

> **Data**: 2026-01-04

#### 🎨 Miglioramenti UI

- Dizionario: righe molto più compatte (padding ridotto, testo xs)
- Estensioni: layout unificato con Parser (stile compatto, bordo viola)
- Notifiche: campanella gialla fosforescente quando ci sono notifiche non lette
- Libreria: placeholder colorati per giochi senza copertina (6 gradienti diversi)

#### 🔧 Fix

- Widget Stato Traduzioni: ora mostra TUTTE le traduzioni fatte con GameStringer
- Copertine mancanti: componente `GameImageWithFallback` con gestione errori

#### ➖ Rimosso

- Credenziali Steam dalla gestione profilo (disponibili solo in Settings)

#### ⏸️ Disabilitato

- HLTB Integration: temporaneamente disabilitato per API outdated

---

### v0.8.0-beta — Epic Games Store Integration

**Data**: 2026-01-02

**Nuove Feature**

- Integrazione completa Epic Games Store via Legendary CLI
- Filtro automatico asset/plugin Unreal Engine (solo giochi veri)
- Badge piattaforma dinamico (Steam/Epic/GOG/Origin)
- Versione cliccabile per visualizzare changelog

**Miglioramenti**

- Placeholder per giochi senza immagine copertina
- Rilevamento automatico piattaforma dal gameId

**Fix**

- Rimossa card "Gestione Piattaforme" duplicata in Settings

---

### v0.7.9-beta — Badge Traduzione + Tracking

**Data**: 2026-01-01

**Nuove Feature**

- Badge visivo stato traduzione (Argento / Bronzo)
- Tracking patch installate in "Attività Recenti"

**Fix**

- Layout Unity Patcher tagliato a destra
- Warning dead_code per costanti BepInEx 6.x

---

## Dicembre 2025

### v0.7.8-beta — Unity Patcher Stabilization

**Data**: 2025-12-31

- BepInEx 5.4.23.4 come default (compatibile con XUnity 5.5)
- Plugin UIToolkitTranslator sperimentale
- Rimosso BepInEx 6.x (incompatibile con XUnity)

---

### v0.7.7-beta — Family Sharing Completo

**Data**: 2025-12-31

- Supporto fino a 4 Steam ID condivisori
- Screenshot gallery con lightbox
- UX intelligente Neural Translator
- Persistenza IDs nel backend
- Da 107 a ~276 giochi Family Sharing visibili

---

### v0.7.6-beta — Streaming LLM Translation

**Data**: 2025-12-31

- Traduzioni in tempo reale con Server-Sent Events
- Supporto OpenAI, Claude, Gemini, DeepSeek
- Da 50 a 426+ giochi Steam rilevati

---

### v0.7.5-beta — Translation Tools Pro

**Data**: 2025-12-30

- Glossario personalizzato con categorie
- Hotkey globali OCR (Ctrl+Shift+T)
- History traduzioni con statistiche
- Auto-detect lingua sorgente

---

### v0.7.4-beta — Epic Games Fix + Ottimizzazioni

**Data**: 2025-12-30

- Supporto IPA per Unity 5.0-5.5
- Link tool esterni (gdsdecomp, UnrealLocres)
- Sistema notifiche aggiornamenti
- Ricerca fuzzy nella Library
- Plugin system per formati file
- Virtualizzazione liste (50MB → 5MB RAM)
- Lazy loading immagini
- Cache LRU con limite 5000 entries
- Epic Games Parser: da 1939 a ~31 giochi reali

---

### v0.7.3-beta — Translation Recommendation

**Data**: 2025-12-29

- Card raccomandazione metodo traduzione
- Ordinamento "Recenti" nella Library
- OCR Overlay non blocca più i giochi

---

### v0.7.2-beta — Codebase Cleanup

**Data**: 2025-12-29

- Risolti tutti i 29 warning Rust
- Compilazione pulita senza warning

---

### v0.7.1-beta — Editor Multi-lingua

**Data**: 2025-12-11

- Vista split IDE-style per traduzioni
- Translation Wizard integrato
- Activity History con filtri
- Bandiere grafiche per lingue

---

## Agosto 2025

### v0.6.x-beta — Sistema Profili

**Data**: 2025-08

- Sistema profili utente completo
- Fix critico riavvio app durante login
- Sistema notifiche con toast

---

## Luglio 2025

### v0.5.x-beta — Tauri v2 Migration

**Data**: 2025-07

- Migrazione completa a Tauri v2
- Sistema traduzione OCR avanzato
- Backend multipli (Claude, OpenAI, Google)
- Game Launch Integration
- Engine Detection automatico
- HowLongToBeat integration
- Supporto 2FA per GOG

---

## Giugno 2025

### v0.1.x-alpha — Fondamenta

**Data**: 2025-06

- Scansione librerie (Steam, Epic, GOG, Origin, Ubisoft, Battle.net, itch.io, Rockstar)
- Traduzione neurale batch (Claude, OpenAI)
- Translation Memory locale in Rust
- Quality Gates per validazione
- Supporto formati: JSON, PO, RESX, CSV
- UI moderna Next.js + TailwindCSS + shadcn/ui

---

## 📊 Statistiche Progetto

| Metrica | Valore |
|:--------|:-------|
| **Versione attuale** | 1.3.0 |
| **Periodo sviluppo** | Giugno 2025 - Presente |
| **Stack Backend** | Rust (Tauri v2) |
| **Stack Frontend** | Next.js 15, React, TailwindCSS |
| **Piattaforme** | Windows, macOS, Linux |
| **Parser supportati** | JSON, PO, RESX, CSV, XLIFF, Telltale, Godot, Ren'Py, WAD (Danganronpa), PAK, LIN, STX |
| **Store supportati** | Steam, Epic, GOG, Origin, Ubisoft, Battle.net, itch.io |
