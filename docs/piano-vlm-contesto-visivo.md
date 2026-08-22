# Piano tecnico — Traduzione con Contesto Visivo (VLM) nel loop live

> Integrazione del **Vision-Language Model** come motore di disambiguazione contestuale
> dentro la pipeline di traduzione in tempo reale di GameStringer.
> Vincoli di progetto: **nessun testo hardcoded** (tutte le stringhe UI passano da `locales/`), documentazione in italiano.

---

## 1. Stato attuale (cosa esiste già)

La pipeline live e i mattoni VLM esistono, ma **non sono collegati tra loro**.

| Componente | File | Ruolo attuale |
|---|---|---|
| Loop real-time | `lib/live-translation-engine.ts` → `captureAndTranslate()` (riga ~225) | capture → OCR → diff → traduzione **solo testo** → overlay |
| Cattura schermo | `lib/ocr/screen-capture.ts` (`captureScreen`) + `src-tauri/src/commands/screen_capture.rs` | ritorna screenshot `imageData` (base64) |
| OCR multi-engine | `lib/ocr/ocr-service.ts`, `lib/ocr/ocr-engines.ts` | OneOCR → PaddleOCR → RapidOCR → Tesseract, con **bbox per riga** |
| Traduzione testo | `lib/ai/ai-translate-direct.ts` (`translateWithFallback`, riga 1821) | traduzione cieca, senza immagine |
| **VLM (già scritto)** | `lib/ocr/vision-translate.ts` (`visionTranslate`) | invia screenshot + testo a Ollama/OpenAI/Gemini, ritorna `{translated, confidence, visualContext, disambiguation}` |
| **VLM single-pass** | `lib/ocr/vlm-translator.ts` (`VlmTranslator`) | estrae+traduce l'immagine intera via Ollama |
| Consumatori VLM | `app/ocr-translator/page.tsx`, `components/tools/vision-translator.tsx` | **solo tool manuale**, fuori dal loop live |

**Il gap:** `captureAndTranslate()` alla riga 299 chiama `translateWithFallback` (solo testo). Lo screenshot `capture.imageData` è già in memoria in quel punto, ma viene buttato via dopo l'OCR. Basta farlo arrivare al motore VLM.

Il problema che risolve è quello già annotato nel codice (`vision-translate.ts`): *"Chest" = forziere o petto? L'IA VEDE lo schermo.*

---

## 2. Architettura target

Introduciamo una **terza modalità di traduzione** selezionabile, senza rompere le altre due:

```
                       ┌─ mode: "fast"    → translateWithFallback (testo, come oggi)
capture → OCR (bbox) ──┼─ mode: "vlm-hybrid" → OCR dà i bbox, il VLM traduce con lo screenshot  ★ nuovo
                       └─ mode: "vlm-full"  → VlmTranslator estrae+traduce l'intera immagine     ★ nuovo
```

La modalità **`vlm-hybrid`** è quella consigliata come default "qualità": mantiene la precisione posizionale dei bounding box dell'OCR (necessari per l'overlay) e aggiunge la disambiguazione visiva del VLM. La `vlm-full` è per giochi con font stilizzati dove l'OCR fallisce del tutto.

---

## 3. Librerie

Nessuna dipendenza nuova obbligatoria — l'infrastruttura c'è già:

- **`openai` `^5.8.2`** — provider VLM cloud (GPT-4o vision) + JSON mode / structured outputs.
- **Ollama via `lib/ai/ollama-http.ts`** (`ollamaFetch`) — VLM locale (`llava`, `qwen2-vl`, `minicpm-v`, `pixtral`). Già usato da entrambi i file VLM.
- **`deepl-node`** — resta come fallback testo per la modalità `fast`.
- **`sharp` `^0.34.5`** — **usarlo per l'ottimizzazione costi/latenza**: ridimensionare lo screenshot (max ~1280px lato lungo) e/o croppare la regione dei bbox prima di inviarlo al VLM. Riduce token e tempo. Attualmente non applicato al path VLM.
- **`tesseract.js` / engine nativi** — restano per i bbox nella modalità hybrid.

Aggiunte opzionali (fase 3+):
- **Gemini** (`@google/generative-ai`) — il branch `provider: 'gemini'` in `vision-translate.ts` esiste ma va completato; valuta di aggiungere l'SDK invece della fetch grezza.
- ⚠️ **Correzione (22/08/2026): `xcap` non è una dipendenza del progetto** — compare
  zero volte in `Cargo.toml` e in `Cargo.lock`. Di cattura schermo ce ne sono due:
  `commands/screen_capture.rs` è uno **stub** (tutto `Err`) ed è proprio quello che
  `lib/ocr/screen-capture.ts:87` invoca, quindi quel percorso ripiega sempre su
  `getDisplayMedia`; `ocr_translator/screen_capture.rs` è reale ma fa `BitBlt` dalle
  **coordinate dello schermo**, quindi cattura qualunque finestra stia sopra al gioco.
  Vedi la voce dedicata in `METODI-DI-TRADUZIONE.md`: va risolto **prima** del VLM.

---

## 4. Formato dati

### 4.1 Estensione della config del loop
In `lib/live-translation-engine.ts`, estendere `LiveTranslationConfig`:

```ts
export type TranslationMode = 'fast' | 'vlm-hybrid' | 'vlm-full';

export interface LiveTranslationConfig {
  // ... campi esistenti ...
  mode?: TranslationMode;              // default 'fast'
  vlmProvider?: 'ollama' | 'openai' | 'gemini';
  vlmModel?: string;                   // es. 'qwen2-vl', 'gpt-4o'
  vlmDownscaleMaxPx?: number;          // default 1280 — passato a sharp
  vlmSendContextLines?: number;        // n. righe dialogo precedenti come contesto (default 5)
}
```

### 4.2 Output strutturato del VLM (il pezzo chiave)
Oggi `visionTranslate` ritorna **una stringa per un testo**. Per il loop serve **N righe in un solo giro** (una sola chiamata VLM per frame, non una per riga → costo/latenza). Definire un contratto JSON che il VLM deve rispettare, così mappiamo 1:1 sui bbox dell'OCR tramite `id`:

```ts
// nuovo: lib/ocr/vlm-batch-schema.ts
export interface VlmLineInput {
  id: number;           // indice riga OCR
  text: string;         // testo OCR grezzo
  bbox: BoundingBox;    // da ocr-service.ts, per riferimento spaziale nel prompt
}

export interface VlmLineOutput {
  id: number;
  translated: string;
  confidence: number;      // 0..1
  disambiguation?: string; // es. "chest = forziere (visibile cassa nel dungeon)"
}

export interface VlmBatchResult {
  scene: string;           // descrizione scena (riusabile come cache-key semantica)
  lines: VlmLineOutput[];
}
```

Il prompt (interno, non stringa UI) chiede al modello di restituire **solo** questo JSON. Con OpenAI usare `response_format: { type: 'json_object' }`; con Ollama usare `format: 'json'`. Validare con Zod prima di consumare (coerente con `lib/api-schemas.ts`).

### 4.3 Mappatura sull'overlay
`captureAndTranslate` costruisce già l'overlay da bbox + traduzioni tramite `buildOverlayTexts(lines, translations, w, h)`. Il `VlmBatchResult.lines[i].translated` sostituisce l'array `result.translations`, allineato per `id`. **Nessun cambio al renderer overlay** (`lib/subtitle-overlay.ts` / `vr-overlay.ts`).

---

## 5. Punti d'aggancio nel codice (in ordine di implementazione)

### Hook 1 — nuovo orchestratore batch VLM
**Nuovo file:** `lib/ocr/vlm-batch-translate.ts`

```ts
export async function vlmBatchTranslate(args: {
  imageBase64: string;
  lines: VlmLineInput[];
  sourceLanguage?: string;
  targetLanguage: string;
  contextLines?: string[];
  provider: 'ollama' | 'openai' | 'gemini';
  model?: string;
  downscaleMaxPx?: number;
}): Promise<VlmBatchResult>
```

Riusa il `VISION_SYSTEM_PROMPT` di `vision-translate.ts`, aggiunge le regole di output JSON, applica `sharp` per il downscale prima dell'encode. Questo file è il vero "motore" nuovo; `vision-translate.ts` resta per il tool a riga singola.

### Hook 2 — biforcazione nel loop live
**File:** `lib/live-translation-engine.ts`, dentro `captureAndTranslate()`, **subito dopo il diff-check e prima della riga 299**:

```ts
// 4. TRANSLATE
let overlayTexts;
if (this.config.mode === 'fast' || !this.config.mode) {
  const result = await translateWithFallback(translateOpts);      // path attuale invariato
  overlayTexts = this.buildOverlayTexts(lines, result.translations, w, h);
} else if (this.config.mode === 'vlm-hybrid') {
  const vlm = await vlmBatchTranslate({
    imageBase64: capture.imageData,                                // ★ lo screenshot già in memoria
    lines: lines.map((l, i) => ({ id: i, text: l.text.trim(), bbox: l.bbox })),
    targetLanguage: this.config.targetLanguage,
    sourceLanguage: this.config.sourceLanguage,
    contextLines: this.recentDialogue.slice(-(this.config.vlmSendContextLines ?? 5)),
    provider: this.config.vlmProvider ?? 'ollama',
    model: this.config.vlmModel,
    downscaleMaxPx: this.config.vlmDownscaleMaxPx ?? 1280,
  });
  overlayTexts = this.buildOverlayTexts(lines, vlm.lines.map(l => l.translated), w, h);
} else { // vlm-full
  // salta l'OCR: usa VlmTranslator.translateImage() e stima le posizioni o overlay centrale
}
```

Punti di attenzione già gestiti dal loop e da preservare: **diff-hash** (riga ~267) e **cache traduzioni** (riga ~277) funzionano identici — la chiave resta l'hash del testo OCR, quindi il VLM non viene richiamato su frame invariati (fondamentale per il costo cloud).

### Hook 3 — memoria dialogo (contesto narrativo)
Il loop non tiene ancora lo storico. Aggiungere un ring buffer `private recentDialogue: string[]` nella classe, popolato con `currentText` a ogni frame tradotto. Alimenta `contextLines` (l'unico modo perché il VLM mantenga coerenza di tono/soggetto tra battute). Riusabile anche da `lib/smart-context.ts` / `lib/context-harvester.ts`.

### Hook 4 — routing/telemetria
Registrare la modalità in `lib/ai/smart-content-router.ts` e loggare `confidence`/`disambiguation` in `lib/translation-confidence.ts` + `lib/translation-analytics.ts`, così l'utente vede *perché* una traduzione è stata scelta.

### Hook 5 — UI (rispettando "nessun testo hardcoded")
- Selettore modalità e provider nel pannello del traduttore live. **Ogni etichetta va aggiunta ai file `locales/<lang>/*.json`** (it, en, de, es, fr, ja, ko, pl, pt, ru) e referenziata via il sistema i18n (`lib/i18n/`). Nessuna stringa letterale nei componenti `.tsx`.
- Le chiavi nuove (esempio): `liveTranslate.mode.fast`, `liveTranslate.mode.vlmHybrid`, `liveTranslate.mode.vlmFull`, `liveTranslate.vlm.provider`, `liveTranslate.vlm.noModelFound`.
- Anche i messaggi di errore VLM (es. "nessun modello vision trovato" in `vlm-translator.ts`) vanno spostati su chiavi i18n: oggi sono stringhe hardcoded → **da correggere** per rispettare il vincolo di progetto.

### Hook 6 — Rust (opzionale, performance)
Per `vlm-full` ad alta frequenza conviene croppare/ridimensionare lato nativo. Aggiungere un comando in `src-tauri/src/commands/screen_capture.rs` che ritorna già lo screenshot ridotto (JPEG qualità ~80), riducendo il traffico Rust→JS.

---

## 6. Costo, latenza e privacy

- **Ollama locale** = zero costo, privacy totale, ma richiede GPU decente; latenza 1–4 s/frame. Default consigliato per l'utente privacy-first, coerente con `lib/ollama-manager.ts` già presente.
- **OpenAI GPT-4o** = qualità/latenza migliori (~0.5–1.5 s) ma costo per immagine → **obbligatorio** il gate su diff-hash + cache già esistenti, più il downscale `sharp`, per non inviare ogni frame.
- Frequenza: alzare `captureIntervalMs` in modalità VLM (es. 800–1200 ms) rispetto alla modalità fast. Renderlo dipendente dalla modalità.

---

## 7. Piano a fasi

| Fase | Contenuto | Esito verificabile |
|---|---|---|
| 1 | `vlm-batch-translate.ts` + schema Zod + provider Ollama | test unit: dato uno screenshot mock + righe, ritorna `VlmBatchResult` valido |
| 2 | Hook nel loop (`vlm-hybrid`), ring buffer dialogo, downscale sharp | overlay live funzionante su un gioco reale; confronto A/B con modalità fast |
| 3 | Provider OpenAI (JSON mode) + gate costo/cache; UI i18n | switch provider da UI; nessuna stringa hardcoded (lint) |
| 4 | `vlm-full` + comando Rust crop/resize; telemetria confidence | funziona su font stilizzati dove l'OCR fallisce |
| 5 | Verifica | test E2E (`e2e/`), lint anti-hardcoded, misura latenza/accuratezza su set di screenshot |

---

## 8. Verifica (step obbligatorio)

1. **Test unit** su `vlm-batch-translate` con risposta VLM simulata: validazione schema, allineamento `id`↔bbox, gestione JSON malformato.
2. **Lint "no hardcoded strings"**: script che fallisce se trova stringhe UI letterali nei nuovi `.tsx` fuori da i18n. Include la correzione delle stringhe già hardcoded in `vlm-translator.ts`.
3. **Benchmark**: dataset di ~20 screenshot con ambiguità note ("chest", "bat", "spring"…), confronto accuratezza fast vs vlm-hybrid.
4. **E2E** nel loop live (`e2e/`) con provider Ollama mockato, verifica che diff-hash/cache evitino chiamate VLM ridondanti.

---

### Riassunto in una riga
Lo screenshot è **già catturato e in memoria** dentro `captureAndTranslate()`; il motore VLM **è già scritto** ma isolato in un tool. Il lavoro è: creare l'orchestratore batch con output JSON strutturato, biforcare la fase di traduzione del loop per passargli l'immagine + i bbox OCR, e portare ogni nuova stringa UI su `locales/` (nessun testo hardcoded).
