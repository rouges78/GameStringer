# Piano — Bundle slimming & Bus factor

> Piano d'attacco per i due task ROADMAP `bundle` e `bus-factor`. Redatto 23/07/2026.
> Nessun codice ancora toccato: qui ci sono passi, file, rischi e la divisione io / Davide.

---

## 1. Bundle e avvio (route pesanti ~700 kB + cold-start)

### Stato di partenza (misurato dai sorgenti)

- **~90 route** in `app/`. Le più grosse per sorgente: `auto-translate` (2633 righe),
  `translation-wizard` (2549), `prediction-tool` (2112), `translator/pro` (2064),
  `library` (2043), `settings` (1886), `editor` (1651).
- `next.config.js` ha già `experimental.optimizePackageImports` (lucide, framer-motion,
  recharts, radix, date-fns, cmdk…) → buona base di tree-shaking.
- **Solo 15 file** usano `next/dynamic`: molto spazio per il lazy-load dei pannelli pesanti.
- Dipendenze pesanti reali: **framer-motion** (import statico in moltissime route grandi),
  **recharts**, **tesseract.js** (WASM OCR, enorme).

### Step 0 — MISURA (prerequisito, prima di ottimizzare)

Serve il dato vero "First Load JS" per route, che si ha solo dalla build:

```
npm run build      # output Next: dimensione per route + First Load JS condiviso
```

Da qui in sandbox **non posso eseguirla in modo affidabile** (build pesante / env Windows).
La lanci tu, oppure ci provo io con un timeout: dimmi. Senza questo numero, ogni "slimming"
è a naso. Il chunk condiviso ~700 kB va scomposto: quasi certamente è
framer-motion + radix + recharts finiti nel bundle comune.

### Interventi proposti (in ordine di leva)

1. **framer-motion → `LazyMotion` + `domAnimation`** (leva più grossa).
   È importato staticamente in decine di route grandi. Passare a `LazyMotion` con feature
   caricate on-demand può togliere ~30–50 kB dal First Load condiviso. Rischio: medio
   (tocca molti file, va testato che le animazioni restino).
2. **tesseract.js solo dove serve.** Verificare che sia importato **dinamicamente** e solo
   nelle route OCR (`live-ocr`, `ocr-overlay`, `ocr-translator`, `manga-translator`,
   `vision-translator`). Se anche una sola route non-OCR lo importa staticamente, si porta
   dietro il WASM. Rischio: basso, alto guadagno.
3. **recharts lazy.** I grafici (`stats`, `heatmap`, `quality-scoring`) caricano recharts
   nel First Load: wrapparli in `next/dynamic({ ssr:false })`. Rischio: basso.
4. **Split dei pannelli nelle route monstre.** `auto-translate`, `translation-wizard`,
   `prediction-tool`, `translator/pro`: estrarre i sotto-pannelli non-critici in componenti
   caricati con `next/dynamic`. Da 15 file con dynamic a copertura delle top-10 route.
   Rischio: medio (regressioni UI da testare).

### Cold-start

- Aggiungere una **misura**: timestamp da avvio processo Tauri a primo paint utile
  (log una-tantum in dev / flag), così il numero è tracciabile.
- Collegare al task ROADMAP `coldstart-ci` (benchmark cold-start in CI, mediana su N run).

### Io vs Davide (bundle)

- **Io**: applico gli interventi 1–4, con verifica transpile; scrivo il wrapper `LazyMotion`
  e i `dynamic()`. **Non** posso misurare la build né il cold-start in sandbox.
- **Davide**: lanci `npm run build` (prima/dopo) per confermare i kB risparmiati e
  `npm run typecheck` + avvio dev per le regressioni UI.

---

## 2. Bus factor (percorsi critici + good first issue)

### Stato di partenza

- **`docs/MAINTAINERS.md` è GIÀ FATTO** (22/07): copre chiave di firma minisign (§1),
  deploy sito Ionos (§2), Supabase (§3), sync versioni (§4), inventario segreti (§5),
  come abbassare il bus factor nel tempo (§6). La parte "documentare i percorsi critici"
  del task **è chiusa**.
- Il README già rimanda a `good first issue` (riga 64) **ma la label non esiste ancora**
  su GitHub e non ci sono issue così etichettate → la promessa è a vuoto.

### Cosa resta

1. Creare la label **`good first issue`** su GitHub e applicarla a issue reali.
2. Backup **offline** della chiave privata minisign (rischio n.1 del progetto).
3. Popolare qualche issue ben scoped per far entrare contributor esterni.

### Candidati "good first issue" (pronti da aprire)

Scoperti nel codice, piccoli e ben delimitati:

1. **i18n motivazioni engine onboarding** — tradurre le motivazioni del "primo gioco"
   nelle 10 lingue mancanti (ora fallback EN). File: locale `firstGame.reason.*`. Difficoltà: bassa.
2. **`lib/plugin-template.ts` — riempire i TODO del template plugin** con un esempio
   funzionante (rilevamento gioco + parse + apply). Ottimo primo contributo, isolato. Difficoltà: bassa/media.
3. **`lib/social/forum.ts:593` — calcolare `active_users` ultimi 7 giorni** (ora hardcoded 0).
   Query + test. Difficoltà: bassa.
4. **recharts lazy in una route stats** — primo PR di performance a basso rischio,
   misurabile. Difficoltà: bassa.
5. **locale fixes / nuovo parser engine** — come già invita il README. Difficoltà: variabile.

(Ci sono ~23 marcatori TODO/FIXME totali in `app/`/`components/`/`lib`: bacino ulteriore.)

### Io vs Davide (bus factor)

- **Io**: ti preparo il **testo pronto** di 4–5 issue (titolo, descrizione, file, criteri di
  accettazione, difficoltà) da incollare su GitHub; posso anche implementare il candidato #3
  o #4 come esempio. **Non** posso creare la label né aprire issue da qui (niente strumenti
  GitHub in questa sessione; sarebbe comunque un'azione che richiede il tuo ok).
- **Davide**: crei la label `good first issue`, apri le issue, e fai il **backup offline
  della chiave** (azione fisica, il rischio più serio del progetto).

---

## Ordine consigliato

1. **Bus factor** ha il ROI più alto e più rapido: MAINTAINERS.md è già fatto, mancano poche
   azioni. Ti genero le issue pronte → tu crei label + apri (30 min) → la promessa del README
   diventa vera.
2. **Bundle** dopo la misura: prima `npm run build` per il numero reale, poi attacco
   framer-motion/tesseract/recharts nell'ordine sopra.
