# GameStringer Changelog

## 🔧 v1.6.1 - 2026-04-06

- Fix pipeline auto-update: firma binari con minisign + `latest.json` multipiattaforma (Windows/macOS/Linux)
- Upgrade tauri 2.10.2 → 2.10.3 (fix `__TAURI_BUNDLE_TYPE` marker, issue #14186)
- Upgrade tauri-action v0.5 → v0.6.2 (fix pattern matching `.sig` files)
- Aggiunta config `createUpdaterArtifacts: "v1Compatible"` per generare updater bundles (.nsis.zip, .app.tar.gz, .AppImage.tar.gz)
- Rimossi step custom `merge-updater` — tauri-action v0.6.2 gestisce `latest.json` nativamente
- Versione portable Windows (.zip) inclusa nella release
- 140 unit test per i parser Bethesda (54) e CRI Middleware (86): BSA/BA2, STRINGS, ESP/ESM, CPK, @UTF, CRILAYLA, MSG/BMD/JSON/XML/FTD
- Documentazione `RELEASE_PROCESS.md` riscritta con tutte le lezioni apprese

## 🚀 v1.6.0 - 2026-04-04

- Prediction Tool (P.T.): analisi traduzione per-gioco con difficulty score 0-100, DRM detection, encoding analysis, translation complexity, confidence score, LLM time estimates su 18 modelli, 5 chain Local/Cloud/Hybrid, export report
- P.T.Rank / Classifica Rapida: ranking giochi per difficoltà con ordine suggerito di traduzione
- Dry Run Scanner: scansione batch 800+ giochi senza modifica file (bottone + pannello nella library), categorizzazione ready/errori/unsupported, report JSON
- Workflow Orchestrator: real execution engine con fast path universale per 6+ engine e progress real-time
- "String it!" quick action: bottone one-click sulla game card (hover) per lanciare il Translation Wizard
- "String it!" smart gate: nel dettaglio gioco controlla se il gioco è già stato analizzato da P.T. (cache 24h) e, se no, suggerisce di eseguire prima P.T. via toast con azioni "Esegui P.T. prima" / "String it! comunque"
- Game Update Tracker: bottone "Smetti di monitorare" per disattivare il tracking di un gioco (comando backend `remove_tracked_game`), fix toast "patch danneggiata" ricorrente
- P.T. upgrade: parsing reale stringhe, 20+ engine supportati, Gemma 4 (27B MoE A4B / E4B / E2B) nei time estimates e chains
- Ollama Manager: auto-discovery modelli dal registry ollama.com + auto-refresh al focus/navigazione
- Bethesda Engine Patcher: Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield con parser BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1)
- CRI Middleware Patcher: parser CPK + CRILAYLA + MSG/BMD/FTD (Persona 5 Royal, Yakuza, Tales of, Dragon Ball) con rilevamento Shift-JIS/UTF-8/UTF-16
- Unity Localization Package pipeline: StringTable, SharedTableData, Addressables catalog, Smart Strings tokenizer + validator
- Universal PO export (gettext .po) per tutti i patcher con metadata project/language/source/engine
- Wizard Stepper condiviso per flussi multi-step nei patcher
- a11y: aria-label su icon button, CardTitle semantic headings, focus-visible su primitives, skip-to-content link, landmark main, sr-only italiano
- a11y: prefers-reduced-motion e forced-colors (Windows High Contrast) rispettati
- Design system: Card variants via cva (default/muted/highlight/success/error/warning), Button size xs + icon-sm
- OCR Image Processor: wiring a backend Tauri Tesseract (sostituisce stub simulateOCR)
- Text utilities: text-micro (9px) + text-2xs (10px) per eliminare classi Tailwind arbitrarie
- Fix: prevent console flash loop su spawn processi Windows quando l'app è in tray (helper process_util::no_window_command)

## 📝 v1.5.0 - 2026-03-24

- Community Chat Realtime: chat in tempo reale integrata nel Community Hub con Supabase Realtime
- 4 stanze predefinite: Generale, Traduzioni, Feedback & Bug, Annunci
- Auto-bridge: login automatico Supabase tramite profilo GameStringer (nessun login aggiuntivo)
- Presenza online: indicatore utenti connessi in tempo reale con Supabase Presence
- Creazione stanze personalizzate per giochi o progetti specifici
- Risposte, modifica ed eliminazione messaggi
- Widget chat in basso a destra con drawer espandibile
- Backend Supabase: PostgreSQL, RLS policies, trigger auto-profilo, RPC functions
- i18n: traduzioni chat in tutte le 11 lingue supportate (IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL)
- Tutorial interattivo Community Chat aggiunto
- Guide utente aggiornate in 11 lingue con sezione Chat Community
- Client Supabase unificato (eliminati Multiple GoTrueClient warnings)

## 🔧 v1.4.2 - 2026-03-03

- Vision LLM Translator: traduzione context-aware con screenshot del gioco (Ollama, Gemini, OpenAI)
- Lore Assistant: chat RAG per lore e dialoghi del gioco
- Auto-Hook Scanner: scansione memoria processo con WinAPI
- System Monitor: monitoraggio VRAM/RAM in tempo reale (backend Rust)
- Ollama Setup Wizard: installazione guidata AI locale step-by-step
- Debug Console: console di debug con intercept console integrato
- Plugin System: design doc PLUGIN_SYSTEM.md
- GitHub Discussions: 12 discussioni create (Announcements, General, Ideas, Q&A, Show and tell, Polls)
- Community Hub: fix fetch discussions con REST API pubblica (no token richiesto)
- Sidebar: Vision LLM aggiunto, Workshop rinominato in Steam Workshop
- Fix: Rendered more hooks — dynamic imports con ssr:false sulle nuove pagine
- CI/CD: Tauri Signing Key per release firmate
- Fix: Ollama provider cooldown invece di blocco permanente per errori di rete
- Fix: Lingva 404 per testi lunghi (troncamento URL automatico)
- Fix: Tutorial querySelector SyntaxError con selettori :contains()
- Fix: Update Bell mostrava versione sbagliata (fallback hardcoded rimosso)
- Auto-Translate Review: pulsante 'Traduci tutte le non tradotte' con progress bar

## 📝 v1.4.1 - 2026-03-02

- i18n: UI completa in 11 lingue (IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL)
- Aggiunte traduzioni KO (coreano), PT (portoghese), RU (russo), PL (polacco) a translations.ts
- Aggiornato Locale type e SUPPORTED_LOCALES con ru e pl
- Creati locales/ru/common.json e locales/pl/common.json
- Guide utente aggiornate in tutte le 11 lingue con sezioni v1.1-v1.4
- Nuove guide utente: USER_GUIDE_KO.md, USER_GUIDE_PT.md, USER_GUIDE_RU.md, USER_GUIDE_PL.md
- README.md e README_IT.md aggiornati con 11 lingue e nuove guide
- CHANGELOG.md e main-layout changelog aggiornati
- site-i18n.js aggiornato con ru e pl
- CI: workflow Linux + Windows fixato e funzionante

## 📝 v1.4.0 - 2026-02-13

- Radix UI Unificato: migrati 37 file da @radix-ui/react-* a radix-ui, rimossi 27 pacchetti
- Quality Badge nel Traduttore Pro: punteggio qualità per-riga con ContentTypeBadge e QualityScoreBadge
- Live Quality Preview: anteprima qualità in tempo reale durante la traduzione batch
- Dettaglio Traduzioni: tabella risultati con tipo contenuto (UI/Dialogo/Narrativa) e score 0-100
- Supporto RTL: rilevamento automatico direzione testo e applicazione dir attribute
- Ollama Generico: translateWithOllamaGeneric con PROVIDER_MAP e chain presets fallback
- Ottimizzazione Bundle: optimizePackageImports aggiornato con radix-ui, framer-motion, recharts, cmdk
- Pulizia TypeScript: 0 errori TS nei sorgenti, fix in 8 file (translation-quality, validator, notifications, tutorial)
- Fix: regex match type casting in translation-quality.ts e translation-validator.ts
- Fix: NotificationToastProps con props opzionali mancanti
- Fix: TutorialProviderProps con userId opzionale
- Fix: CreateNotificationRequest con profileId opzionale

## 📝 v1.3.0 - 2026-02-09

- Danganronpa WAD Patcher v15: All-Ice base + GameStringer override (35.865 stringhe)
- WAD Text Extractor CLI: estrazione completa testi da WAD per traduzione
- WAD Extractor UI: nuovo tab nel Danganronpa Patcher con editor e traduzione batch AI
- Export Patch Distribuibile: crea .zip con WAD, install.bat, LEGGIMI.txt, translations.json
- Export Patch UI: bottone export nel tab Applica Patch con dialog salvataggio nativo
- Export Patch Backend Rust: comando export_danganronpa_patch con zip streaming
- Dashboard Stats Reali: collegati a Translation Memory Rust e activity history
- UI Danganronpa Patcher compattata: tutti i tab ottimizzati per densità informativa

## 📝 v1.2.0 - 2026-02-06

- Fallback Provider: traduzione automatica Gemini → DeepSeek → OpenAI in tutti i componenti
- Audit /api/* completato: 0 fetch('/api/') attive, tutto compatibile Tauri
- Danganronpa Filtro Smart: riduce 18K→3K stringhe con filtro locale + AI opzionale
- Test E2E Playwright: 38 test reali (navigation, translation, danganronpa)
- Fix: injection UI usa Tauri invoke invece di API routes
- Fix: secrets dashboard, logging, import traduzioni ora locali
- Fix: bug precedenza operatori in notification-indicator
- Translation Memory e Offline Cache usano fallback provider

## 📝 v1.1.0 - 2026-02-05

- Website Multilingua: 9 lingue (EN, IT, ES, DE, FR, JA, ZH, KO, PT)
- Selettore lingua nel nav con bandiere e auto-detect browser
- Danganronpa Auto-Translator: traduzione automatica con estrazione PAK nativa
- Test E2E con Playwright: 9 test per navigation, translation, danganronpa
- Verifica API Key: controllo chiavi prima di iniziare traduzione
- Stima Costo: calcolo automatico token e costo per provider
- Rate Limit Handler: retry automatico con delay per quota API
- Redirect automatico a Settings se API non configurata

## 📝 v1.0.9 - 2026-01-31

- UI Header Animati: Effetto 'respiro' con gradiente che si espande/contrae
- Ombreggiature Header: shadow-xl con tinta blu per profondità
- Menu Sidebar: Sub-item con hover verde scuro (emerald-600)
- Gradiente uniforme: Sky → Blue → Cyan su tutti gli header Traduzione
- 16 pagine aggiornate con nuovo stile header animato

## 🔧 v1.0.8 - 2026-01-29

- Fix: Pulsante 'Scarica' aggiornamento ora apre il browser correttamente
- Fix: Usato Tauri shell API invece di window.open per link esterni
- Aggiunto feedback toast per debug download

## 📝 v1.0.7 - 2026-01-29

- GitHub Discussions: Forum integrato nel Community Hub
- Tab Discussions con grafica GameStringer personalizzata
- Fetch automatico discussioni da GitHub con API route
- Link esterni aperti con Tauri shell API
- Community Hub: rimossi dati mock, ora solo dati reali
- Rimosso modal warning 'In Sviluppo' dal Community Hub
- Licenza aggiornata a v1.1 Source Available
- Licenza: chiarito uso non-commercial (YouTuber/streamer OK)
- Licenza: fork non-commerciali permessi esplicitamente
- i18n: traduzioni Discussions in 7 lingue

## 🔧 v1.0.6 - 2026-01-28

- Qwen 3: Provider dedicato per lingue asiatiche (CN/JP/KR) via Ollama
- NLLB-200: Supporto 200 lingue via HuggingFace Inference API
- Ollama Generico: Usa qualsiasi modello installato
- Bug fix: Catch vuoti sostituiti con logging appropriato
- Bug fix: Import non utilizzati rimossi dai file principali
- Bug fix: Vitest config provider v8 mancante
- Bug fix: Firme funzioni batch operations incompatibili
- i18n: Traduzioni mancanti aggiunte per ES, FR, DE, JA, ZH

## 📝 v1.0.5 - 2026-01-26

- Voice Clone Studio: AI voice cloning with ElevenLabs and OpenAI TTS
- VR Text Overlay: Spatial subtitles for VR games with headset detection
- Quality Gates: Automatic translation quality control system
- Player Feedback: Collect and manage player translation feedback
- Guide Page: Documentation for all 4 new tools
- i18n: Translations for all new features in 7 languages (IT, EN, ES, DE, JA, ZH)
- UI: Green hero headers for Tools section pages

## 📝 v1.0.4 - 2026-01-23

- Subtitle Translator: parser SRT/VTT/ASS con preview e QA
- Batch Folder Translator: scansione ricorsiva cartelle con walkdir
- Community Hub: pagina completa con browser pacchetti TM
- Retro ROM Tools: supporto NES/SNES/GB/GBA/Genesis/PSX con table files
- API Pubblica v1: endpoint REST per CI/CD (/api/v1/translate, batch, languages, health)
- Landing Page: pagina marketing pronta per deploy
- Screen Adaptation: adattamento automatico risoluzione schermo
- Tutorial unificato: risolto conflitto tra OnboardingWizard e InteractiveTutorial
- Hero headers compatti per Retro e Batch

## 📝 v1.0.3 - 2026-01-22

- Recovery Key: sistema recupero password con 12 parole mnemoniche
- Recovery Key: copia/download chiave alla creazione profilo
- Recovery Key: verifica chiave per reset password
- Traduzioni i18n complete per ES, FR, DE (9 sezioni aggiunte)
- Nuove sezioni: gameDetails, notifications, stores, projects, heatmap, activity, ocrTranslator, workshop

## 📝 v1.0.2 - 2026-01-22

- Supporto multilingua completo: ES, FR, DE, JA, ZH
- Selettore lingua abilitato per tutte le lingue
- Traduzioni Translation Fixer per tutte le lingue
- Traduzioni AI Context Crawler per tutte le lingue
- Categorie glossario tradotte (personaggio, luogo, oggetto, etc.)

## 🔧 v1.0.1 - 2026-01-21

- Nuovo layout 3:1 per pagina dettaglio gioco
- Screenshot gallery espansa (12 screenshot)
- Raccomandazione traduzione full-width
- Traduzioni EN complete per gameDetails
- Trama completa nell'header hero

## 💥 v1.0.0 - 2026-01-20

- Release pubblica ufficiale
- Sistema i18n completo (Italiano/English)
- Hero Image Fusion per tutte le pagine
- Screenshot Gallery nella pagina dettaglio
- GitHub Sponsors integrato

## 📝 v0.9.9-beta - 2026-01-19

- Ultima versione beta prima del release ufficiale 1.0.0
- Sistema i18n completo (Italiano/English)
- Integrazione Ko-fi e GitHub Sponsors
- Ottimizzazioni finali e bug fix

## 📝 v0.9.8-beta - 2026-01-18

- Esporta/Importa Profilo: backup e restore profili come JSON
- OCR Service: Tesseract.js integrato per riconoscimento testo
- Screen Capture: cattura schermo con fallback browser getDisplayMedia
- Hero headers tutti compatti con text shadow uniforme
- Community Hub ridisegnato con stile compatto
- Libreria header minimalista con icona gradient
- Rimosso mini logo GS dalla sidebar chiusa

## 📝 v0.9.7-beta - 2026-01-18

- Hero headers compatti per tutti gli strumenti (Overlay, Fixer, Crawler, Voice, Injector, Patcher)
- Dashboard ridisegnata con gradiente viola e card animate
- Menu profilo glassmorphism con effetto vetro
- Game Patcher header unificato con quick links
- Attività recenti espanse a 9 elementi
- Rimossi indicatori Neural/Steam/Cache dall'header
- Text shadows migliorati per leggibilità su gradienti chiari

## 📝 v0.9.6-beta - 2026-01-12

- Command Palette (Ctrl+K): ricerca globale stile VS Code
- Skeleton Loaders: loading states eleganti per tutte le pagine
- Empty States: illustrazioni e CTA per stati vuoti
- Drag & Drop Zone: trascina file per tradurre
- Info Tooltips: spiegazioni hover per funzioni complesse
- Sidebar animata: hover effects, glow, transizioni fluide
- Toast migliorati: gradienti colorati, progress bar, animazioni
- Keyboard Shortcuts: Ctrl+L libreria, Ctrl+T traduci, etc.

## 📝 v0.9.5-beta - 2026-01-12

- Steam Workshop Browser: cerca e scarica traduzioni dalla community
- Filtri per lingua, ordinamento (popolarità, recenti, rating)
- Visualizzazione dettagli: subscribers, favorites, views, rating
- Download simulato con stato installazione
- Link diretto a Steam Workshop per ogni item

## 📝 v0.9.4-beta - 2026-01-12

- Dashboard completamente ridisegnata con hero header viola/fuchsia
- Card Azioni Rapide con icone grandi e gradienti colorati
- Link rapidi a Batch, Progetti, Statistiche, Impostazioni
- Attività recenti in card dedicata con design cyan
- Progress bar traduzioni con card emerald

## 📝 v0.9.3-beta - 2026-01-12

- Statistiche Traduzione: dashboard dettagliata con grafici
- Grafico attività settimanale con barre
- Stats: traduzioni totali, stringhe, parole, progress medio
- Conteggio progetti completati e in corso
- Lingue target più usate con percentuali
- Tempo stimato rimanente per progetti attivi

## 📝 v0.9.2-beta - 2026-01-12

- Project Manager: salva/carica progetti di traduzione (.gsproj)
- Esporta traduzioni in JSON, CSV, PO (Gettext)
- Glossario progetto per consistenza terminologica
- Statistiche progetto: file, stringhe, progress
- Tab Panoramica, File, Glossario, Impostazioni

## 📝 v0.9.1-beta - 2026-01-12

- Batch Translation: coda di traduzione per più file simultanei
- Supporto drag & drop file e cartelle nella coda
- Progress tracking per ogni job con tempo stimato
- Pausa/riprendi/stop elaborazione coda
- Gradiente dinamico pagina gioco basato sul genere (Horror=rosso, RPG=viola, etc.)

## 📝 v0.9.0-beta - 2026-01-12

- Pagina Dettaglio Gioco: nuovo hero header con gradiente indigo/purple/fuchsia
- Stats dinamiche: piattaforma, stato installazione, data uscita, generi, traduzioni
- Background immagine gioco integrato nell'header
- Metacritic score con colori dinamici (verde/giallo/rosso)

## 📝 v0.8.9-beta - 2026-01-08

- Sidebar riorganizzata: da 17 a 6 elementi per navigazione pulita
- Header hero colorati per pagine Traduci, Patcher, Community, Impostazioni
- Dialog Impostazioni Profilo con design viola/pink e card colorate
- Dialog Sicurezza Profilo con design cyan/emerald
- Link rapidi agli strumenti secondari nelle pagine principali
- Fix accessibilità DialogTitle con VisuallyHidden

## 📝 v0.8.8-beta - 2026-01-08

- Wizard Onboarding per primo avvio con configurazione guidata
- Indicatore stato offline nell'header con feature disponibili
- Sistema cache offline per traduzioni, giochi e pack
- Tooltip contestuali per aiuto in-app
- Servizio offline-support per funzionalità senza internet

## 📝 v0.8.7-beta - 2026-01-08

- Visual Translation Editor per preview stringhe su screenshot
- Editor overlay con drag & drop, font, colori, opacità
- Esportazione immagini PNG e progetti .gsvte
- Nexus Mods Integration per cercare patch italiane
- Ricerca automatica traduzioni per gioco
- Download diretto da Nexus Mods (richiede API key)

## 📝 v0.8.6-beta - 2026-01-08

- Community Translation Hub per condivisione traduzioni
- Sistema Translation Packs con download/upload
- Rating e recensioni per pack traduzioni
- Statistiche community in tempo reale
- Filtri avanzati per ricerca pack
- Supporto 10 lingue per traduzioni

## 📝 v0.8.5-beta - 2026-01-08

- AI Translation Assistant con supporto LLM locali (Ollama, LM Studio)
- Traduzioni context-aware per genere gioco (RPG, Horror, etc.)
- Glossario personalizzabile per consistenza terminologica
- Supporto voci personaggi con stile e formalità
- Generazione alternative di traduzione
- Cronologia traduzioni con riutilizzo rapido

## 🔧 v0.8.4-beta - 2026-01-08

- Dialog Impostazioni Profilo (notifiche, libreria, sessione)
- Dialog Sicurezza Profilo (cambio password, eliminazione)
- Menu profilo completamente funzionale
- Integrazione ThemeSelector nelle impostazioni profilo

## 🔧 v0.8.3-beta - 2026-01-08

- Parser Godot Engine (.tres, .tscn, .cfg, .translation)
- Parser Ren'Py (.rpy) per visual novel
- Telltale Patcher: backup automatico e ripristino
- Telltale Patcher: verifica installazione
- Theme toggle (chiaro/scuro/auto) nell'header
- Script version-manager sincronizza tutti i file versione

## 🔧 v0.8.2-beta - 2026-01-08

- Telltale Patcher per Wolf Among Us, Walking Dead, Batman
- Parser Telltale (.langdb, .landb, .dlog)
- Fix immagini giochi nella pagina dettaglio
- Steam API 403 rate limiting gestito gracefully
- Tauri CLI aggiornato a v2.5.0

## 🔧 v0.8.1-beta - 2026-01-04

- Dizionario righe compatte
- Estensioni layout unificato con Parser
- Campanella notifiche gialla fosforescente
- Placeholder colorati per copertine mancanti

## 🚀 v0.8.0-beta - 2026-01-02

- Integrazione Epic Games Store via Legendary CLI
- Filtro asset/plugin Unreal Engine (41 giochi)
- Badge piattaforma Epic Games nella scheda gioco
- Versione cliccabile per vedere changelog

## 🔧 v3.2.2 - 2025-07-07

- Implementato sistema versioning automatico completo
- Integrazione UI dinamica
- Git hooks configurati

## 🔧 v3.2.1 - 2025-01-07

- Sistema versioning automatico implementato
- System Status spostato nella sidebar
- Dashboard layout migliorato
- Quick Actions compattate

## 🚀 v3.2.0 - 2025-01-06

- Pagina impostazioni completamente ridisegnata
- Debug tools integrati nelle impostazioni
- Sidebar collassabile con animazioni
- Steam API debugging migliorato

## 🚀 v3.1.0 - 2025-01-05

- Force refresh implementato per Steam games
- Sistema manual game addition
- Badge system per VR games
- Dashboard design futuristico

