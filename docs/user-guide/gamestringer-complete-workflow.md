# GameStringer - Guida Completa

## Indice

1. [Setup Iniziale](#fase-1-setup-iniziale)
2. [Collegamento Store](#fase-2-collegamento-store)
3. [Libreria Giochi](#fase-3-libreria-giochi)
4. [Traduci Gioco (Auto-Translate)](#fase-4-traduci-gioco)
5. [Patcher Engine](#fase-5-patcher-engine)
6. [Unity CSV Translator](#fase-6-unity-csv-translator)
7. [BepInEx + XUnity](#fase-7-bepinex--xunity)
8. [AI Pipeline Multi-Agent](#fase-8-ai-pipeline)
9. [Traduttore AI](#fase-9-traduttore-ai)
10. [Traduttore OCR e Multi-Engine](#fase-10-traduttore-ocr)
11. [Traduttore Vocale](#fase-11-traduttore-vocale)
12. [Traduzione Batch e Offline](#fase-12-traduzione-batch-e-offline)
13. [Danganronpa Patcher](#fase-13-danganronpa-patcher)
14. [Prediction Tool e QA Check](#fase-14-prediction-tool-e-qa-check)
15. [Glossario, TM e Adaptive MT](#fase-15-glossario-tm-e-adaptive-mt)
16. [Strumenti Avanzati](#fase-16-strumenti-avanzati)
17. [Sicurezza e Recovery Key](#fase-17-sicurezza)
18. [Risoluzione Problemi](#fase-18-risoluzione-problemi)

---

## FASE 1: SETUP INIZIALE

### Primo Avvio

Avvia GameStringer. Alla prima apertura compare la creazione profilo.

### Creazione Profilo

- **Nome**: scegli un nome (es. "Mario Gaming")
- **Avatar**: seleziona colore/gradiente
- **Password**: minimo 4 caratteri
- Clicca **"Crea Profilo"** — autenticazione automatica

### Interfaccia

- **Sidebar** (sinistra): navigazione tra le sezioni
- **Dashboard** (centro): panoramica giochi, statistiche, widget AI Engine
- **Ctrl+K**: ricerca globale rapida per accedere a qualsiasi pagina

---

## FASE 2: COLLEGAMENTO STORE

### Store Supportati

Steam, Epic Games, GOG, Ubisoft Connect, Origin/EA, Battle.net, Itch.io, Rockstar, Amazon Games.

### Configurazione Steam (Prioritaria)

1. API Key da <https://steamcommunity.com/dev/apikey>
2. Steam ID64 da <https://steamid.io/>
3. In GS: **Impostazioni** → inserisci API Key e Steam ID
4. Profilo Steam deve essere **Pubblico**

GS rileva anche giochi da **Steam Family Sharing**.

---

## FASE 3: LIBRERIA GIOCHI

- Sidebar → **"Libreria"** oppure Dashboard → **"Aggiorna Libreria"**
- Caricamento 1-2 minuti per centinaia di giochi
- Cliccando su un gioco: dettagli, engine rilevato, path, pulsante **"Traduci Gioco"**

---

## FASE 4: TRADUCI GIOCO

Sidebar → **"Traduci Gioco"** (Auto-Translate). Il cuore di GameStringer.

### Workflow

1. **Seleziona gioco** dalla libreria o path manuale
2. **Scansione**: rileva engine (Unity, Unreal, Godot, RPG Maker, Ren'Py, etc.) e file traducibili
3. **Smart Auto-Select**: raccomanda il metodo migliore per l'engine rilevato
4. **Traduzione AI**: stringhe tradotte con il motore configurato
5. **Revisione**: rivedi, modifica, approva
6. **Applica Patch**: backup automatico + applicazione

### Smart Auto-Select per Unity

| Tipo | Metodo Consigliato | Alternativa |
|------|-------------------|-------------|
| Unity Mono (senza BepInEx) | Unity CSV Translator | BepInEx + XUnity |
| Unity Mono (BepInEx presente) | Unity CSV Translator | Traduzione AI stringhe catturate |
| Unity IL2CPP | Unity CSV Translator | Nessuna (BepInEx incompatibile) |

### Engine Rilevati

Unity (Mono/IL2CPP), Unreal Engine, Godot, RPG Maker, Ren'Py, Source Engine, CryEngine, RE Engine, Frostbite, id Tech, Creation Engine, Construct, AGS, Defold, Love2D.

---

## FASE 5: PATCHER ENGINE

Sidebar → **Patcher** → **Patcher Engine**. 5 patcher specializzati:

- **Unity**: BepInEx + XUnity AutoTranslator per Mono
- **Unreal Engine**: traduzione file .locres (UE4/UE5)
- **Godot**: estrazione/traduzione/re-pack file .pck (Godot 3/4)
- **RPG Maker**: traduzione JSON per MV/MZ (dialoghi, oggetti, skill)
- **Ren'Py**: traduzione file .rpy (visual novel)

---

## FASE 6: UNITY CSV TRANSLATOR

Il **metodo migliore** per giochi Unity (Mono e IL2CPP).

### Come Funziona

1. Scansiona asset Unity (resources.assets, etc.)
2. Estrae tabelle CSV di localizzazione
3. Traduce con AI (Ollama o cloud)
4. Inietta traduzioni con **Resize Injection** (zero troncamento)

### Vantaggi

- Funziona con **tutti** i giochi Unity (Mono e IL2CPP)
- Zero troncamento grazie al resize
- Copertura completa (tutte le stringhe, non solo quelle a schermo)
- Nessuna dipendenza esterna
- Backup automatico (.backup) e ripristino

---

## FASE 7: BEPINEX + XUNITY

Per giochi **Unity Mono** — traduzione live durante il gameplay.

1. GS rileva il gioco Unity e trova l'exe
2. Clicca **"Installa BepInEx + XUnity"**
3. Avvia il gioco — XUnity cattura stringhe a schermo
4. Chiudi e torna in GS — traduci stringhe catturate con AI

**Limitazione**: non funziona con IL2CPP (causa crash). Per IL2CPP usa Unity CSV Translator.

---

## FASE 8: AI PIPELINE

Cerca **"AI Pipeline"** con Ctrl+K. Sistema multi-step per alta qualità.

### 6 Step

Harvest → Translate → QA Check → Auto-Fix → Review → Score

### 3 Modalità

- **Quick**: Translate + QA (veloce)
- **Balanced**: + Auto-Fix (consigliato)
- **Max Quality**: tutti i 6 step, threshold 75, max 3 tentativi

### Multi-Agent

Assegna modelli diversi per step (es. qwen per Translate, gemma per Review). 4 preset: Default, Speed, Max Quality, Diversified.

### Benchmark

Storico esecuzioni con score, durata, ms/stringa. Confronto preset.

---

## FASE 9: TRADUTTORE AI

Sidebar → **Traduzione** → **Traduttore AI**.

### Provider

- **Ollama** (locale, gratuito), **OpenAI/GPT-4**, **Claude**, **Gemini**, **DeepL**, **Lingva**

### Funzionalità

- Traduzione singola o batch
- Auto-detect lingua sorgente
- Stile: naturale, letterale, gaming
- Mantenimento placeholder ({0}, %s, \n)
- Integrazione Glossario + Translation Memory + Adaptive MT

---

## FASE 10: TRADUTTORE OCR

Sidebar → **Traduzione** → **Traduttore OCR**.

Traduce testo dallo schermo in tempo reale:

- Screenshot manuale o area selezionata
- Live OCR continuo
- Hotkey globale: **Ctrl+Shift+T**

### OCR Multi-Engine

4 engine: **OneOCR** (Win11), **PaddleOCR** (CJK), **RapidOCR** (ONNX), **Tesseract** (fallback).

- Probe automatico engine attivi
- Fallback chain automatico
- Modalità confronto parallelo

---

## FASE 11: TRADUTTORE VOCALE

Sidebar → **Traduzione** → **Traduttore Vocale**.

- Riconoscimento vocale in-game
- Traduzione audio → testo tradotto
- Overlay sottotitoli in tempo reale

---

## FASE 12: TRADUZIONE BATCH E OFFLINE

### Batch

Sidebar → **Traduzione** → **Batch**. Traduce intere cartelle di file:

- Supporta .txt, .json, .csv, .po, .xml, .rpy, .ini
- Progresso in tempo reale per ogni file
- Opzione pipeline AI per qualità massima

### Offline (Ollama)

Sidebar → **Traduzione** → **Traduttore Offline**.

- Traduzione completamente locale con Ollama
- Nessuna connessione internet necessaria
- Privacy totale — i dati non escono dal PC

---

## FASE 13: DANGANRONPA PATCHER

Sidebar → cerca **"Danganronpa"** con Ctrl+K.

### Funzionalità

1. **Tab Applica Patch**: seleziona gioco Steam, vedi file WAD, applica patch
2. **Tab WAD Extractor**: estrai, cerca, filtra e traduci 35.865 stringhe
3. **Traduzione Batch AI**: seleziona stringhe → traduci con AI → esporta JSON
4. **Export .zip distribuibile**: WAD patchato + installer automatico + istruzioni
5. In-gioco: Impostazioni → Control Hints → "Keyboard and Mouse"

---

## FASE 14: PREDICTION TOOL E QA CHECK

### Prediction Tool

Cerca con Ctrl+K. Analizza un gioco prima della traduzione:

- Stima numero stringhe e parole
- Costo stimato per provider (DeepL, OpenAI, locale)
- Tempo stimato per metodo
- Catene di traduzione consigliate

### QA Check

Cerca con Ctrl+K. Controllo qualità post-traduzione:

- Verifica placeholder mantenuti
- Controllo numeri e valori
- Verifica lunghezza stringhe
- Controllo formato e punteggiatura
- Score qualità per stringa

---

## FASE 15: GLOSSARIO, TM E ADAPTIVE MT

### Glossario

Sidebar → cerca con Ctrl+K. Terminologia personalizzata per gioco:

- Aggiungi termini (es. "quest" → "missione")
- Categorie: gameplay, UI, personaggi, lore
- Integrato automaticamente nella traduzione AI

### Smart Glossary

Genera glossario automaticamente dall'analisi dei file del gioco.

### Translation Memory

Dashboard → widget "Entry TM". Memoria di traduzione:

- Salva automaticamente ogni coppia tradotta
- Riutilizza traduzioni precedenti
- Backend Rust per performance

### Adaptive MT

Impara dalle tue correzioni:

- Salva: originale → AI → correzione umana
- Trova correzioni simili con trigram/word similarity
- Inietta few-shot examples nel prompt AI
- Migliora col tempo

---

## FASE 16: STRUMENTI AVANZATI

### Context Harvester

Scansiona file del gioco ed estrae contesto per la traduzione AI.

### Editor Traduzioni

Editor avanzato per revisione manuale stringhe tradotte con filtri e ricerca.

### Overlay Sottotitoli

Overlay in-game per sottotitoli tradotti in tempo reale.

### ROM Patcher

Applica e crea patch IPS/BPS per traduzioni retro (SNES, GBA, etc.).

### Export Formati

Esporta traduzioni in: PO, XLIFF, CSV, JSON, TMX.

### Community Hub

Condividi traduzioni, vota, commenta, scarica traduzioni della community.

---

## FASE 17: SICUREZZA

### Recovery Key

Alla creazione profilo viene generata una **Recovery Key** (12 parole mnemoniche).

- Copia o scarica come .txt
- **Salva in un posto sicuro!**

### Recupero Password

Schermata login → **"Password dimenticata?"** → inserisci le 12 parole → nuova password.

---

## FASE 18: RISOLUZIONE PROBLEMI

### Gioco Non Trovato

- Verifica che sia installato e che Steam/Epic sia aperto
- Aggiorna libreria e riavvia GS

### Traduzione Non Applicata

- Riavvia il gioco completamente
- Verifica permessi di scrittura sui file
- Esegui GS come amministratore

### AI Non Risponde

- Verifica connessione internet (per provider cloud)
- Per Ollama: verifica che sia in esecuzione (pallino verde in sidebar)
- Prova un motore diverso

### Gioco Crashato Dopo Patch

- Clicca **"Ripristina Backup"** nello strumento usato
- Verifica integrità file su Steam (tasto destro → Proprietà → File Locali)

### Unity IL2CPP + BepInEx = Crash

- GS ora blocca automaticamente BepInEx per IL2CPP
- Usa Unity CSV Translator invece

### Ollama Lento o Non Risponde

- Sidebar: pallino verde = online, rosso = offline
- Ollama Manager → verifica modelli installati
- Consigliato: modello 7B per velocità, 13B+ per qualità
