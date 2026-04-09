# GameStringer v1.8.0 — Live Translation Overlay, Hub Marketplace, TM Network, AI Dubbing Pipeline, Plugin System

## Live Translation Overlay

- **Overlay OCR in tempo reale**: traduzione live del gioco tramite overlay trasparente
- Pipeline: cattura schermo → OCR multi-engine (Tesseract/OneOCR/PaddleOCR) → traduzione AI (Groq/Cerebras) → overlay stile gaming
- Hotkey `Ctrl+Alt+O` per attivare/disattivare
- Diff detection: salta il testo invariato tra frame successivi
- Cache traduzioni per replay istantaneo

## Hub Marketplace

- **Marketplace community**: piattaforma pacchetti traduzione con installazione 1-click
- Backend Supabase con 10 tabelle (packs, reviews, commenti, follower, moderazione)
- Profili utente con sistema di reputazione
- Workflow stato: draft → published → verified → featured

## Translation Memory Network

- **TM federata**: condivisione Translation Memory via Supabase
- Traduzioni ad alta qualità (confidence > 0.8) contribuite al pool globale (opt-in, privacy-first)
- Testo sorgente hashato per protezione privacy
- Auto-integrata nella pipeline `translateWithFallback()`
- Entry con scope per gioco

## AI Dubbing Pipeline

- **Pipeline doppiaggio a 7 step**: scan audio → Whisper STT → traduzione AI → sintesi TTS con voci personaggio (OpenAI/ElevenLabs/Azure) → duration matching → patching audio con backup → Rhubarb lip sync → sottotitoli (SRT/VTT/ASS)
- 16 archetipi personaggio per voci caratterizzate
- Supporto pausa/ripresa/annullamento

## Plugin System

- **PatcherPlugin interface**: plugin per patcher engine creati dalla community
- Ciclo di vita: detect → extract → patch → verify → restore
- Template generator per scaffolding plugin
- Nessuna compilazione Rust — plugin via JavaScript eval sandboxed
- Distribuzione come pacchetti `.gsplugin`

## Security

- CSP rinforzata: rimosso `unsafe-eval`, `img-src`/`connect-src` ristretti a domini specifici
- Fix XSS nella ricerca intelligente (rimosso `dangerouslySetInnerHTML`)
- Storage chiavi API criptato con AES-256-GCM (backend Rust + client TypeScript)
- Protezione CSRF: validazione Origin + header `X-GS-Client`
- Validazione input Zod su 4 route API
- Rate limiting globale middleware (configurabile per-route)
- Tutte le 42/42 route API usano `withErrorHandler`

## Architettura & Qualità Codice

- CI pipeline: aggiunto job `frontend-checks` (tsc, eslint, vitest, npm audit)
- ESLint config: regole `no-console`, `no-explicit-any`, `no-unused-vars`
- 71 nuovi unit test (api-schemas, middleware, moduli traduzione)
- 18 moduli estratti da 3 file monolitici (-1841 righe totali)
- 1197/1203 chiamate `console.*` migrate a `clientLogger`/`logger` strutturato (99.5%)
- 893 clausole catch tipizzate con `: unknown`
- 25+ tipi TypeScript `any` eliminati
- Rimosse dipendenze duplicate: react-hot-toast, vdf (-42 pacchetti)

---

**Download**: Scegli `GameStringer-1.8.0-Setup.exe` (installer) o `GameStringer-1.8.0-Portable.zip`
