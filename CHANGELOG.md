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

## 📅 Gennaio 2026

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
| **Versione attuale** | 1.0.0 |
| **Periodo sviluppo** | Giugno 2025 - Presente |
| **Stack Backend** | Rust (Tauri v2) |
| **Stack Frontend** | Next.js 15, React, TailwindCSS |
| **Piattaforme** | Windows, macOS, Linux |
| **Parser supportati** | JSON, PO, RESX, CSV, XLIFF, Telltale, Godot, Ren'Py |
| **Store supportati** | Steam, Epic, GOG, Origin, Ubisoft, Battle.net, itch.io |
