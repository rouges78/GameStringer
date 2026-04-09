# GameStringer - Architettura del Progetto (v1.8.0)

## Visione

Software desktop professionale per la localizzazione di videogiochi che analizza automaticamente i giochi installati e suggerisce il metodo di traduzione migliore. Include traduzione live overlay, dubbing AI, marketplace community, e sistema plugin estensibile.

---

## Nuovi Moduli v1.8.0

### LIVE TRANSLATION OVERLAY
- **Engine**: `lib/live-translation-engine.ts` — Loop cattura→OCR→diff→traduci→overlay
- **UI**: `app/live-translate/page.tsx` — Pannello di controllo
- **Overlay**: `app/ocr-overlay/page.tsx` — Finestra trasparente con traduzioni

### HUB MARKETPLACE
- **Backend**: `lib/community-hub-backend.ts` — Supabase CRUD (pack, review, commenti, moderazione)
- **Installer**: `lib/marketplace-installer.ts` — Download→validate→import 1-click
- **Schema**: `docs/supabase-schema.sql` — 10 tabelle PostgreSQL + RLS

### TRANSLATION MEMORY NETWORK
- **Network**: `lib/tm-network.ts` — Pull/push/lookup federato via Supabase
- **Integrazione**: auto-inject in `lib/ai-translate-direct.ts` → `translateWithFallback()`

### AI DUBBING PIPELINE
- **Pipeline**: `lib/dubbing-pipeline.ts` — 7 step: scan→STT→translate→TTS→patch→lipsync→subtitles
- **UI**: `app/dubbing/page.tsx` — Configurazione e monitoraggio

### PLUGIN SYSTEM
- **Registry**: `lib/plugin-system.ts` — PatcherPlugin interface + template generator
- **Template**: `lib/plugin-template.ts` — Scaffold per nuovi plugin community

### MODULI ESTRATTI (Refactoring)
- `lib/translation/language-mappings.ts` — Mappe codici lingua
- `lib/translation/chain-presets.ts` — Catene provider
- `lib/translation/provider-blocking.ts` — Blocco/cooldown provider
- `lib/translation/provider-quality-tracker.ts` — Tracking qualita
- `lib/translation/prompt-builder.ts` — Costruzione prompt AI
- `components/game-detail/` — 8 sub-componenti estratti
- `components/translator-pro/` — 4 sub-componenti + cost calculator

---

## Struttura Moduli

### 1. STORES (Configurazione)

**Scopo**: Configurare le sorgenti per la scansione dei giochi installati.

- Steam (percorsi librerie, API key opzionale)
- Epic Games (percorso installazione)
- GOG Galaxy (database)
- Xbox/Microsoft Store
- Percorsi personalizzati

**Stato attuale**: ✅ Implementato

---

### 2. LIBRARY (Centro di Controllo)

**Scopo**: Hub centrale che mostra tutti i giochi e guida l'utente alla traduzione.

#### Per ogni gioco deve mostrare

1. **Info da Internet**
   - Copertina, descrizione, genere
   - Lingue supportate ufficialmente
   - Link a traduzioni fan esistenti (se disponibili)

2. **Analisi File Installati**
   - Motore di gioco (Unity, Unreal, Godot, RPG Maker, etc.)
   - File di localizzazione trovati (JSON, PO, RESX, CSV, etc.)
   - Struttura cartelle del gioco

3. **Raccomandazione Traduzione**
   - Metodo migliore suggerito automaticamente
   - Affidabilità stimata
   - AI consigliata per quel tipo di contenuto

#### Opzioni di Traduzione (dalla Library)

| Metodo | Descrizione | Quando usarlo |
|--------|-------------|---------------|
| **Traduzione al Volo** | BepInEx/XUnity (Unity), Overlay (altri) | Giochi senza file modificabili |
| **Traduzione File** | Modifica diretta dei file di localizzazione | Giochi con file accessibili |
| **Creazione Patch** | Genera patch distribuibile con dizionario | Per condividere traduzioni |

**Stato attuale**: ⚠️ Parziale - manca integrazione analisi + raccomandazioni

---

### 3. TRANSLATION MEMORY (TM)

**Scopo**: Database unico condiviso da TUTTI i metodi di traduzione.

- Salva ogni traduzione effettuata
- Riutilizza traduzioni esistenti (risparmio API)
- Permette correzioni manuali dall'utente
- Esportabile/importabile

**Stato attuale**: ✅ Implementato (ma verificare integrazione completa)

---

### 4. METODI DI TRADUZIONE

#### 4.1 Traduzione al Volo (Live)

- **Unity**: BepInEx + XUnity.AutoTranslator
- **Altri motori**: OCR Translator (overlay)
- Usa Translation Memory per cache
- Chiama AI per testi nuovi

#### 4.2 Traduzione File (Batch)

- Neural Translator Pro
- Supporta vari formati (JSON, PO, RESX, CSV, XML)
- Usa Translation Memory
- Quality Gates per validazione

#### 4.3 Creazione Patch

- Genera pacchetto distribuibile
- Include dizionario modificabile
- L'utente può correggere/migliorare
- Esportabile per altri utenti

**Stato attuale**: ⚠️ Metodi separati, non integrati dalla Library

---

### 5. AI PROVIDERS

- Gemini (default)
- OpenAI (GPT-4)
- Claude (Anthropic)
- DeepSeek
- DeepL
- Altri...

Configurabili per profilo, con API key personali.

**Stato attuale**: ✅ Implementato

---

## Flusso Utente Ideale

```text
1. STORES → Configura sorgenti giochi
           ↓
2. LIBRARY → Vede tutti i giochi installati
           ↓
3. Seleziona gioco → Vede analisi completa:
   - Info gioco
   - Motore rilevato
   - File localizzazione trovati
   - RACCOMANDAZIONE: "Usa Traduzione File (JSON trovati)"
           ↓
4. Clicca "Traduci" → Apre metodo consigliato
           ↓
5. Traduzione usa Translation Memory unica
           ↓
6. Opzionale: Crea Patch distribuibile
```text

---

## Gap da Colmare

### Priorità Alta

- [ ] Library: Integrare analisi motore + file nella vista gioco
- [ ] Library: Aggiungere raccomandazione metodo traduzione
- [ ] Library: Bottone "Traduci" che apre metodo giusto

### Priorità Media

- [ ] Creazione Patch: Sistema per generare patch distribuibili
- [ ] TM: Verificare che tutti i metodi la usino correttamente

### Priorità Bassa

- [ ] Ricerca traduzioni fan esistenti online
- [ ] Stima affidabilità traduzione

---

## Note Tecniche

- Frontend: Next.js + React + TailwindCSS + shadcn/ui
- Backend: Tauri (Rust)
- Database: SQLite locale per TM
- AI: API REST per vari provider

Buongiorno.
Ora che mi sono calmata, mi sembrava giusto scriverti ciò che penso, alla luce di quello che c’è stato tra di noi.
Mi hai fatto perdere completamente il controllo: la tua insistenza mi ha mandato in escandescenza. Considera che ero già piuttosto satura per quanto era accaduto in precedenza, quindi questa è stata la goccia che ha fatto traboccare il vaso.

Io ho commesso i miei errori, ma tu hai perseverato e non sei riuscito a passarci sopra, se non temporaneamente, perché poi ogni scusa era buona per tirare fuori tutto.

Non c’è fiducia e un rapporto a distanza, in queste condizioni, non si può vivere. Conserverò di te solo i ricordi belli, cancellando questo ultimo periodo deleterio.

Buona vita.
