# GameStringer v1.4.0 — Radix Unificato, Quality Badges & Pulizia Codebase

## Migrazione Radix UI

- **37 componenti migrati** da `@radix-ui/react-*` a `radix-ui`
- **27 pacchetti rimossi** dalle dipendenze, bundle più leggero
- Nessun cambiamento visivo — stessa UI, meno dipendenze

## Quality Badge nel Traduttore Pro

- **QualityScoreBadge**: punteggio qualità 0-100 per ogni riga tradotta (🟢 ≥80, 🟡 ≥60, 🔴 <60)
- **ContentTypeBadge**: tipo contenuto (UI, Dialogo, Narrativa, Sistema, Tutorial)
- **Live Preview**: anteprima qualità in tempo reale durante la traduzione batch
- **Tabella Dettaglio**: fino a 200 righe con originale, traduzione, tipo e qualità

## Nuove Feature

- **Supporto RTL**: rilevamento automatico direzione testo per lingue arabe/ebraiche
- **Ollama Generico**: `translateWithOllamaGeneric` con chain presets e fallback automatico

## Ottimizzazione & Fix

- **Bundle ottimizzato**: `optimizePackageImports` con radix-ui, framer-motion, recharts, cmdk
- **0 errori TypeScript** nei sorgenti (da ~15)
- Fix regex type casting in translation-quality e translation-validator
- Fix props opzionali mancanti in NotificationToast, TutorialProvider, CreateNotificationRequest
- Fix TranslationMemoryEntry.usageCount reso opzionale

## Guide aggiornate

- Documentazione v1.4.0 in 7 lingue: IT, EN, ES, FR, DE, JA, ZH

---

**Download**: Scegli `GameStringer-1.4.0-Setup.exe` (installer) o `GameStringer-1.4.0-Portable.zip`
