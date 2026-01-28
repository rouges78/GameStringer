# 🐛 Bug Report - GameStringer
**Data Analisi**: 28 Gennaio 2026
**Analizzato da**: Cascade AI

---

## 🔴 BUG CRITICI (TypeScript Errors)

### 1. `lib/translation-batch-operations-with-progress.ts`
**Errore**: Firma funzione incompatibile
```
TS2345: Argument of type '(items: TranslationBatchItem[], options: ExportOptions) => Promise<any>' 
is not assignable to parameter of type '(item: BatchItem) => Promise<any>'.
```
**Linee**: 67, 94, 259, 274
**Causa**: Le funzioni `batchExportProcessor` e `batchImportProcessor` accettano 2 argomenti ma `processBatch` ne aspetta 1.
**Fix**: Adattare le funzioni processor o creare wrapper.

---

### 2. `lib/translation-quality.ts`
**Errore**: Property 'replace' does not exist on type 'never'
**Linea**: 320
**Causa**: TypeScript non riesce a inferire il tipo corretto dopo il filter.
**Fix**: Aggiungere type assertion esplicito.

---

### 3. `app/guide/page.tsx`
**Errore**: Traduzioni mancanti per alcune lingue
```
TS2339: Property 'qualityGatesGuide' does not exist on type
TS2339: Property 'playerFeedbackGuide' does not exist on type
```
**Linee**: 198, 200, 211, 213
**Causa**: Le chiavi `qualityGatesGuide`, `qualityGatesGuideFeatures`, `playerFeedbackGuide`, `playerFeedbackGuideFeatures` mancano in alcune traduzioni (es. spagnolo).
**Fix**: Aggiungere le chiavi mancanti in tutte le lingue.

---

### 4. `vitest.config.ts`
**Errore**: Configurazione coverage incompleta
```
TS2769: No overload matches this call - Property 'provider' is missing
```
**Linea**: 12
**Causa**: Manca `provider: 'v8'` nella configurazione coverage.
**Fix**: Aggiungere provider esplicito.

---

## 🟠 BUG MEDI (ESLint Warnings)

### 5. Variabili/Import Non Utilizzati (~150+ occorrenze)
**File principali**:
- `app/activity/page.tsx`: Tabs, TabsContent, TabsList, TabsTrigger
- `app/ai-review/page.tsx`: CardDescription, TabsContent, Copy, Check, copied, handleCopy
- `app/ai-translator/page.tsx`: Globe, Card, CardContent
- `app/api/dictionaries/add/route.ts`: gameName, sourceLanguage
- `app/api/translate/compare/route.ts`: capitalizedWords

**Fix**: Rimuovere import e variabili inutilizzate.

---

### 6. Uso di `any` type (~80+ occorrenze)
**File principali**:
- `app/api/games/route.ts`: linea 21
- `app/api/games/[id]/route.ts`: linee 14, 43-46
- `app/api/translate/batch/route.ts`: linee 61, 159, 230, 292, 356
- `app/api/translate/route.ts`: linee 100, 899, 1025

**Fix**: Definire tipi espliciti.

---

### 7. Catch Blocks Vuoti (~25+ occorrenze)
**File principali**:
- `app/api/translate/route.ts` (6 occorrenze)
- `hooks/use-global-hotkeys.ts` (3 occorrenze)
- `lib/steam-utils.ts` (3 occorrenze)
- `app/ocr-translator/page.tsx` (4 occorrenze)

**Esempio**:
```typescript
} catch {} // Errore silenzioso - non sappiamo mai se qualcosa fallisce
```
**Fix**: Aggiungere logging o gestione errori appropriata.

---

### 8. Console.log in Production (~261 occorrenze)
**File principali**:
- `app/translator/pro/page.tsx`: 54 console statements
- `app/games/[id]/page.tsx`: 48 console statements
- `app/games/page.tsx`: 24 console statements
- `app/library/page.tsx`: 23 console statements

**Fix**: Sostituire con sistema di logging (`logger.debug/info`).

---

## 🟡 BUG MINORI (Code Quality)

### 9. Preferire `const` invece di `let`
**File**: `app/api/translations/route.ts` linea 4
```typescript
let translations: any[] = []; // Dovrebbe essere const
```

---

### 10. Variabili di errore non utilizzate
**File**:
- `app/api/secrets/route.ts`: linee 39, 70 (`e` non utilizzato)
- `app/api/translate/stream/route.ts`: linea 188 (`e` non utilizzato)
- `app/api/library/scan-files/route.ts`: linea 181 (`err` non utilizzato)

---

## 🎨 PROBLEMI UI/UX

### 11. Potenziali `undefined` in className
**File**:
- `components/injekt-overlay-config.tsx` (4 occorrenze)
- `components/onboarding/interactive-tutorial.tsx` (1 occorrenza)

**Rischio**: Classi CSS potrebbero non essere applicate correttamente.

---

### 12. Traduzioni Incomplete
Le seguenti chiavi esistono solo in IT e EN, mancano in DE, FR, ES, PT-BR, JA, ZH:
- `qualityGatesGuide`
- `qualityGatesGuideFeatures`
- `playerFeedbackGuide`
- `playerFeedbackGuideFeatures`

---

## ⚙️ PROBLEMI CONFIGURAZIONE

### 13. Lockfile Multipli
```
Warning: Detected multiple lockfiles:
- C:\dev\package-lock.json
- C:\dev\GameStringer\package-lock.json
```
**Rischio**: Inconsistenze nelle dipendenze.
**Fix**: Rimuovere il lockfile nella cartella parent.

---

### 14. ESLint Deprecato
```
`next lint` is deprecated and will be removed in Next.js 16
```
**Fix**: Migrare a ESLint CLI standalone.

---

## 📊 RIEPILOGO

| Severità | Conteggio | Stato |
|----------|-----------|-------|
| 🔴 Critici | 4 | Da Fixare |
| 🟠 Medi | 4 categorie (~350+ issue) | Da Valutare |
| 🟡 Minori | 2 | Bassa priorità |
| 🎨 UI/UX | 2 | Da Verificare |
| ⚙️ Config | 2 | Da Sistemare |

---

## ✅ FIX APPLICATI

### 1. ✅ `vitest.config.ts` - Coverage provider mancante
**Fix**: Aggiunto `provider: 'v8'` alla configurazione coverage.
```typescript
coverage: {
  provider: 'v8',  // AGGIUNTO
  reporter: ['text', 'json', 'html'],
  ...
}
```

### 2. ✅ `lib/translation-batch-operations-with-progress.ts` - Firma funzioni incompatibili
**Fix**: Creati wrapper per adattare le funzioni `batchExportProcessor` e `batchImportProcessor`.
```typescript
const exportWrapper = async (item: TranslationBatchItem) => {
  return batchExportProcessor([item], { format: 'json' });
};
```

### 3. ✅ `lib/ai-translation-service.ts` - Nuovi provider traduzione
**Fix**: Aggiunti provider `qwen3` e `nllb` per supporto lingue asiatiche e rare.

### 4. ✅ `app/api/translate/route.ts` - Nuovi provider API
**Fix**: Implementate funzioni `translateWithQwen3`, `translateWithNLLB`, `translateWithOllama`.

---

## ⏳ BUG NON CRITICI (Da Valutare)

### `vitest.config.ts` - moduleResolution
**Errore**: Cannot find module '@vitejs/plugin-react'
**Causa**: Il setting `moduleResolution` in tsconfig.json non è compatibile.
**Nota**: Non critico - vitest funziona comunque. Fix richiede modifica a moduleResolution che potrebbe impattare altre parti del progetto.

### Traduzioni mancanti in ES/FR/DE/JA/ZH
Le chiavi `qualityGatesGuide`, `playerFeedbackGuide` e relative features esistono solo in IT/EN.
**Nota**: Non critico - il codice usa fallback con valori default.

