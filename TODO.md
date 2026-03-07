# 📋 TODO.md - GameStringer Development Tasks

*Ultimo aggiornamento: 7 Marzo 2026 — v1.4.2 (Build 121)*

---

## 🚨 BUG CRITICI ATTIVI

### 🔴 Bloccanti
- [ ] **Finestra Tauri non si apre** — `gamestringer.exe` non viene generato nonostante compilazione Rust pulita e build statico Next.js completato (`out/` presente). Problema persistente anche dopo riavvii. Richiede investigazione profonda configurazione Tauri.
- [ ] **Epic Games Parser falso positivo** — Rileva ~1939 giochi invece dei reali 31. La whitelist attuale (200+ giochi) non è sufficiente; necessita riscrittura logica di filtraggio manifest.

### 🔴 Errori TypeScript Critici
- [ ] **`lib/translation-batch-operations-with-progress.ts`** (righe 67, 94, 259, 274) — Firma funzione incompatibile: `batchExportProcessor` / `batchImportProcessor` accettano 2 argomenti ma `processBatch` ne aspetta 1. Patch wrapper presente ma fragile.
- [ ] **`lib/translation-quality.ts`** (riga 320) — `Property 'replace' does not exist on type 'never'`. Type assertion esplicito necessario dopo filter.
- [ ] **`app/guide/page.tsx`** (righe 198, 200, 211, 213) — Chiavi di traduzione mancanti (`qualityGatesGuide`, `playerFeedbackGuide`) in 6 lingue: DE, FR, ES, PT, JA, ZH.

---

## 🔴 PRIORITÀ ALTA — Qualità Codice

### Silent Error Handling (58+ occorrenze)
Catch block vuoti che nascondono errori runtime. File più critici:
- [ ] **`lib/ai-translate-direct.ts`** (righe 200, 241, 284, 327, 367, 408, 451, 499, 556, 1585, 1597, 1929) — 12 catch vuoti nel core di traduzione
- [ ] **`app/auto-translate/page.tsx`** (righe 355, 364, 371, 427, 547, 655, 690, 808, 1218, 1267, 1293) — 11 catch vuoti
- [ ] **`lib/auto-glossary.ts`** (righe 112, 121, 146) — 3 catch vuoti
- [ ] **`lib/lore-assistant.ts`** (righe 144, 166, 204, 213) — 4 catch vuoti
- [ ] **`lib/ocr-engines.ts`** (righe 205, 685) — 2 catch vuoti nel motore OCR
- [ ] **`components/cover-picker.tsx`** (righe 69, 77, 87, 100) — 4 catch vuoti
- [ ] **`app/page.tsx`** (righe 128, 254) — 2 catch vuoti nella home
- [ ] **`app/library/page.tsx`** (righe 73, 140) — 2 catch vuoti nella libreria

Tutti dovrebbero loggare con il sistema di logging strutturato esistente.

### Type Safety (~80 `any`)
- [ ] Tipizzare risposte API in `app/api/games/route.ts`, `app/api/translate/batch/route.ts`
- [ ] Eliminare `any` type diffusi; passare a `unknown` + type guard

### Import non utilizzati (~150 occorrenze)
- [ ] `app/activity/page.tsx` — Tabs, TabsContent, TabsList, TabsTrigger
- [ ] `app/ai-review/page.tsx` — CardDescription, TabsContent, Copy, Check
- [ ] `app/ai-translator/page.tsx` — Globe, Card, CardContent
- [ ] `app/api/dictionaries/add/route.ts` — gameName, sourceLanguage
- [ ] `app/api/translate/compare/route.ts` — capitalizedWords

### Rust: unwrap/panic non protetti (~870+ occorrenze)
- [ ] Sostituire `unwrap()` critici con `?` o `match` nei moduli `steam.rs`, `epic.rs`, `games.rs`
- [ ] Rimuovere `todo!()` e `panic!()` dai percorsi di codice raggiungibili in produzione

---

## 🟠 FUNZIONI INCOMPLETE — TODO nel codice

### Backend Rust (`src-tauri/src/`)
- [ ] **`commands/epic.rs`** riga 389 — Implementare salvataggio credenziali con crittografia AES-GCM
- [ ] **`commands/epic.rs`** riga 604 — Implementare autenticazione Epic Games Web API
- [ ] **`commands/epic.rs`** riga 611 — Implementare scansione avanzata file Epic Games locali
- [ ] **`commands/epic.rs`** riga 834 — Scansione dettagliata manifest Epic Games
- [ ] **`commands/games.rs`** riga 1188 — Aggiungere Epic Games dopo correzione tipo di ritorno
- [ ] **`commands/steam.rs`** riga 2477 — Implementare logica con sqlx per persistenza
- [ ] **`commands/steam.rs`** riga 4251 — Implementare parser VDF alternativo (rimossa dipendenza `steamy_vdf`)
- [ ] **`commands/dlc_manager.rs`** riga 254 — Implementare controllo ownership e logica installazione DLC
- [ ] **`commands/dlc_manager.rs`** riga 670 — Implementare scansione DLC GOG
- [ ] **`commands/utilities.rs`** riga 483 — Implementare pulizia cache Steam, HowLongToBeat, SteamGridDB
- [ ] **`commands/unreal_patcher.rs`** riga 287 — Implementare injection DLL dopo avvio processo
- [ ] **`commands/unity_patcher.rs`** — `let tm_count = 0u32` placeholder; integrare con modulo `translation_memory`
- [ ] **`commands/danganronpa_patcher.rs`** riga 2868 — Integrare con API traduzione reali
- [ ] **`commands/wolfrpg_patcher.rs`** — `available: false` hardcoded; implementare detection installazione
- [ ] **`notifications/storage.rs`** — `profile_name: None` in 2 occorrenze; integrare con ProfileManager
- [ ] **`notifications/profile_event_handler.rs`** riga 140 — Implementare migrazione profili se necessario

### Frontend TypeScript (`app/`, `components/`)
- [ ] **`app/editor/page.tsx`** riga 662 — Implementare integrazione con API traduzione (DeepL, Google, etc.)
- [ ] **`components/profiles/password-recovery-dialog.tsx`** riga 84 — Implementare reset password effettivo via Tauri command
- [ ] **`components/translator/batch-folder-translator.tsx`** riga 233 — Implementare traduzione contenuto cartella

### C++ Native DLL (`unreal-translator/`, `ue-translator-dll/`)
- [ ] **`unreal-translator/hook-dll/src/hooks.cpp`** righe 98, 157 — Pattern scanning per versioni UE specifiche + pattern alternativi
- [ ] **`unreal-translator/hook-dll/src/ipc.cpp`** righe 127, 133, 187 — Invio log, statistiche e aggiornamento configurazione
- [ ] **`unreal-translator/hook-dll/src/cache.cpp`** riga 72 — Implementare LRU cache reale con lista ordinata
- [ ] **`ue-translator-dll/src/text_hooks.h`** riga 107 — Pattern scanning specifico per versione UE

### C# Plugin Unity (`plugins/`)
- [ ] **`plugins/GameStringer.Satellite/Plugin.cs`** riga 154 — Implementare protocollo shared memory

---

## 🟡 PRIORITÀ MEDIA — Code Hygiene

- [ ] **261 console.log in produzione** — Sostituire con sistema di logging strutturato (Tauri `tracing`). File più critici: `app/translator/pro/page.tsx` (54), `app/games/[id]/page.tsx` (48), `app/games/page.tsx` (24)
- [ ] **Lockfile multipli** — Risolvere conflitto tra `C:\dev\package-lock.json` e `C:\dev\GameStringer\package-lock.json`
- [ ] **ESLint deprecato** — Migrare da `next lint` a ESLint CLI standalone (Next.js 16 rimuoverà `next lint`)
- [ ] **TypeScript strict mode** — `strict: false` in `tsconfig.json`; migrare gradualmente verso strict mode
- [ ] **Copertura test incompleta** — 37 file test presenti ma molti endpoint API senza copertura; aumentare coverage con Vitest
- [ ] **Steam Family Sharing** — Problemi con giochi condivisi; debug approfondito necessario
- [ ] **Cache Corruption** — Occasionale corruzione cache localStorage; aggiungere validazione checksum

---

## 📦 PRIORITÀ BASSA — Espansioni

### Store Integration
- [ ] **Espandere Database Nomi** — Coprire più giochi popolari per tutti gli store
- [ ] **Microsoft Store** — Integrazione Xbox Game Pass e Microsoft Store
- [ ] **PlayStation Store** — Supporto per giochi PlayStation (se possibile)
- [ ] **Nintendo eShop** — Integrazione per giochi Nintendo (se possibile)

### Developer Tools
- [ ] **Debug Console** — Console di debug integrata per sviluppatori (design doc presente: `PLUGIN_SYSTEM.md`)
- [ ] **API Documentation** — Documentazione completa API Tauri commands
- [ ] **Plugin System** — Sistema di plugin per estensioni di terze parti
- [ ] **Automated Testing** — Aumentare suite E2E con Playwright; aggiungere test API routes

---

## 🔮 FUTURO — Roadmap a Lungo Termine

### Funzionalità Avanzate
- [ ] **AI Translation Engine** — Motore di traduzione AI proprietario (fine-tuned)
- [ ] **Real-time Collaboration** — Traduzione collaborativa in tempo reale
- [ ] **Cloud Sync** — Sincronizzazione cloud per traduzioni e impostazioni
- [ ] **Mobile Companion** — App mobile per gestione remota

### Commercializzazione
- [ ] **Versione Premium** — Funzionalità avanzate a pagamento
- [ ] **Marketplace Traduzioni** — Piattaforma vendita traduzioni professionali
- [ ] **API Pubblica** — API per sviluppatori terze parti
- [ ] **Enterprise Solutions** — Soluzioni per studi di sviluppo

### Metriche Obiettivo
- [ ] **<3s Startup Time** — Tempo di avvio sotto 3 secondi
- [ ] **<100MB Memory** — Uso memoria sotto 100MB a riposo
- [ ] **99% Uptime** — Stabilità applicazione 99%
- [ ] **<1s Translation** — Traduzione testi sotto 1 secondo
- [ ] **1000+ Giochi Supportati** — Database giochi riconosciuti
- [ ] **Community Active** — Community attiva di traduttori

---

## ✅ COMPLETATI (v1.0 → v1.4.2)

### Stabilità e Performance
- [x] **Risoluzione Epic Games False Positive** — Implementata whitelist robusta con 200+ giochi reali
- [x] **Ottimizzazione Cache System** — Cache intelligente con strategie adattive, priorità, preload e cleanup automatico
- [x] **Gestione Errori Robusta** — Sistema centralizzato con retry automatico, classificazione errori e logging contestuale
- [x] **Memory Leak Prevention** — Sistema audit memoria con tracking allocazioni, leak detection e cleanup automatico

### Core Gaming Features
- [x] **Engine Detection Sistema** — Database 1000+ giochi, frontend-backend integrati
- [x] **Copertine Steam Complete** — CDN Cloudflare/Akamai + fallback intelligenti
- [x] **VR Games Support** — Filtri VR, badge e rilevamento automatico
- [x] **Steam API Enhancement** — Integrazione steamlocate-rs per scansione robusta e veloce
- [x] **DLC Management** — Sistema completo cross-store per gestione DLC Steam/Epic Games
- [x] **HowLongToBeat Integration** — Sistema statistiche tempi completamento con cache intelligente
- [x] **Game Launch Integration** — Sistema universale avvio giochi Steam/Epic/GOG/Diretto con fallback

### Visual e UI
- [x] **Placeholder Intelligenti** — Copertine generate per giochi senza artwork
- [x] **Dark/Light Theme** — Sistema di temi completo con persistenza
- [x] **Responsive Design** — Layout adattivo con breakpoint personalizzati
- [x] **Filtri Avanzati** — Filtri multipli per genere, anno, rating, tempo di gioco, store, tags
- [x] **Ordinamento Personalizzato** — Sistema preset personalizzati con salvataggio localStorage
- [x] **Ricerca Intelligente** — Ricerca semantica con suggerimenti e cronologia
- [x] **Statistiche Dettagliate** — Dashboard analytics con metriche aggregate e visualizzazioni

### Sistema Traduzione
- [x] **OCR per Immagini** — Estrazione testo con preprocessing e bounding boxes
- [x] **Traduzione Audio** — Speech-to-text, traduzione e TTS con impostazioni avanzate
- [x] **Context-Aware Translation** — Traduzione contestuale basata su contesto di gioco
- [x] **Community Translations** — Sistema collaborativo con recensioni, voti e gestione community
- [x] **Vision LLM Translator** — Traduzione context-aware con screenshot
- [x] **Lore Assistant** — Chat RAG con conoscenza lore/dialoghi gioco
- [x] **Auto-Hook Scanner** — Scansione memoria processo
- [x] **System Monitor** — Monitoraggio VRAM/RAM real-time
- [x] **Ollama Setup Wizard** — Installazione guidata AI locale
- [x] **Backend Multipli** — DeepL, Yandex, Papago, Google Translate con rate limiting e fallback
- [x] **Supporto Offline** — Argos Translate con gestione modelli locali
- [x] **Logging Avanzato** — Feedback, correzioni, export CSV/JSON/TMX/XLIFF

### Injection System
- [x] **Stabilizzazione Injekt** — Sistema robusto con heartbeat, recovery automatico, validazione indirizzi
- [x] **Multi-Process Support** — Supporto giochi multi-processo con sincronizzazione traduzioni
- [x] **Anti-Cheat Compatibility** — Rilevamento EAC, BattlEye, Vanguard; strategie compatibilità
- [x] **Performance Optimization** — Hook pooling, cache intelligente, batch processing, adaptive polling

### Bug Fix e Compilazione
- [x] **Risoluzione 119 Errori Rust** — Struct fields, temporal types, Display traits, ErrorType variants
- [x] **Fix Base64 API Deprecate** — Aggiornati rockstar, itchio, battlenet, ubisoft, origin
- [x] **Fix Async/Await OCR** — Rimosso `.await` errato in `commands/advanced_ocr.rs`
- [x] **Fix Configurazione Tauri/Next.js** — Porta 3036 sincronizzata
- [x] **Vitest Coverage Provider** — Aggiunto `provider: 'v8'` in `vitest.config.ts`
- [x] **Auto-install BepInEx + XUnity** — One-Click Translate per giochi Unity
- [x] **Guide Utente Multilingua** — 14 sezioni complete in 11 lingue

---

## 🔧 Setup Development

### Prerequisiti
- Node.js 18+ con npm
- Rust toolchain (stable)
- Tauri CLI v2 (`cargo install tauri-cli`)

### Comandi Utili
```bash
# Sviluppo
npm run tauri:dev          # Avvia app Tauri in dev mode
npm run dev                # Solo frontend Next.js (debug UI)

# Build
npm run tauri:build        # Build produzione completa

# Testing
npm run test               # Test suite Vitest
npm run test:coverage      # Coverage report
npm run test:e2e           # E2E tests con Playwright

# Manutenzione
npm run lint               # ESLint
npm run version:patch      # Bump versione patch
```

---

## 📝 Principi Guida

1. **Traduzione First** — Ogni feature deve supportare l'obiettivo principale
2. **Performance** — Ottimizzazione continua per responsività
3. **Sicurezza** — Crittografia e protezione dati utente
4. **Usabilità** — UI intuitiva e accessibile in 11 lingue

---

**Repository**: https://github.com/rouges78/GameStringer
**Issues**: Utilizzare GitHub Issues per bug report
**Discussions**: GitHub Discussions per feature request

*Aggiornato il 7 Marzo 2026 tramite audit automatico del codebase.*
