# GameStringer - Architettura del Progetto

## Visione
Software desktop professionale per la localizzazione di videogiochi che analizza automaticamente i giochi installati e suggerisce il metodo di traduzione migliore.

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

#### Per ogni gioco deve mostrare:
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

#### Opzioni di Traduzione (dalla Library):
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

```
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
```

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
