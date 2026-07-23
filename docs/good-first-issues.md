# Good first issues — pronte da aprire

> Testi pronti per GitHub (bus factor / onboarding contributor). Redatto 23/07/2026.
> Ogni voce è verificata sul codice attuale. Crea prima la label **`good first issue`**,
> poi incolla ciascun blocco come nuova issue.
>
> Setup label (una volta): GitHub → Issues → Labels → New label →
> nome `good first issue`, colore `#7057ff`, descrizione "Buon primo contributo".

---

## Issue 1 — Implementare il template plugin di esempio

**Labels:** `good first issue`, `plugin`, `documentation`

**Contesto.** `lib/plugin-template.ts` è lo scheletro che i contributor copiano per creare
un nuovo plugin/engine, ma è pieno di stub `// TODO` non funzionanti (rilevamento gioco,
parse del formato, apply, restore). Un esempio completo e funzionante abbassa la barriera
d'ingresso per nuovi parser engine.

**Cosa fare.** Riempire i TODO (righe ~75, 88, 111, 139, 161, 185, 217) con
un'implementazione reale minima su un formato semplice (es. file `.json` o `.ini` chiave=valore):
rilevamento file, estrazione stringhe, applicazione traduzioni, restore dai backup `.original`.

**Criteri di accettazione.**
- Nessun `// TODO` residuo in `lib/plugin-template.ts`.
- Il plugin d'esempio estrae e riapplica stringhe su un file di prova incluso.
- Un breve commento in testa spiega come duplicarlo per un nuovo engine.

**Difficoltà:** bassa/media · **File:** `lib/plugin-template.ts`

---

## Issue 2 — Calcolare gli utenti attivi degli ultimi 7 giorni nel forum

**Labels:** `good first issue`, `backend`, `supabase`

**Contesto.** In `lib/social/forum.ts` la statistica `active_users` è cablata a `0`:

```ts
active_users: 0, // TODO: calcolare utenti attivi ultimi 7 giorni
```

**Cosa fare.** Sostituire lo `0` con un conteggio reale degli utenti distinti che hanno
avuto attività (thread/post) negli ultimi 7 giorni, via query Supabase (count distinct
`user_id` con `created_at >= now() - 7d`).

**Criteri di accettazione.**
- `active_users` riflette gli utenti distinti attivi negli ultimi 7 giorni.
- Fail-open: se la query fallisce, torna `0` senza rompere le altre statistiche.
- Un test copre il conteggio (mock del client Supabase).

**Difficoltà:** bassa · **File:** `lib/social/forum.ts` (~riga 593)

---

## Issue 3 — Lazy-load di recharts nelle statistiche realtime (performance)

**Labels:** `good first issue`, `performance`

**Contesto.** `components/injekt-realtime-stats.tsx` importa **staticamente** l'intero
recharts (riga 18: `AreaChart, PieChart, …`). recharts è pesante e finisce nel bundle
anche quando i grafici non sono visibili.

**Cosa fare.** Estrarre la parte grafica in un sotto-componente caricato con
`next/dynamic(() => import(...), { ssr: false })`, così recharts entra solo quando i
grafici vengono renderizzati. Aggiungere un fallback di caricamento leggero.

**Criteri di accettazione.**
- recharts non è più nel First Load JS di chi non apre le statistiche.
- I grafici funzionano identici a prima (nessuna regressione visiva).
- `npm run build` mostra il chunk recharts separato (allegare prima/dopo).

**Difficoltà:** bassa · **File:** `components/injekt-realtime-stats.tsx`

---

## Issue 4 — Aggiungere il Greco (`el`) alla verifica di integrità dei locale

**Labels:** `good first issue`, `i18n`

**Contesto.** Il test `__tests__/lib/i18n-locale-integrity.test.ts` verifica che ogni
locale abbia tutte le chiavi (baseline 0 mancanti), ma copre solo
`en, ru, es, fr, de, ja, zh, ko, pt, pl` — **il Greco `el` non è testato**, quindi può
accumulare chiavi mancanti senza che nessuno se ne accorga.

**Cosa fare.** Aggiungere `el` alla lista dei locale testati (righe ~115-124), importando
`el.json`, e colmare eventuali chiavi mancanti che il test evidenzia.

**Criteri di accettazione.**
- `el` è nella lista testata con `maxMissing: 0`.
- `npm test` passa (tutte le chiavi presenti in `lib/i18n/locales/el.json`).

**Difficoltà:** bassa · **File:** `__tests__/lib/i18n-locale-integrity.test.ts`, `lib/i18n/locales/el.json`

---

### Nota

Restano azioni non deleghabili a un contributor (tue): **backup offline della chiave
privata minisign** (rischio n.1, vedi `docs/MAINTAINERS.md` §1) e la creazione della label.
