# Audit accessibilità — WCAG 2.1 AA

> Data: 24/07/2026 · Ambito: `app/` + `components/` (330 file .tsx) · Metodo: analisi statica del codice sorgente contro i criteri WCAG 2.1 livello A/AA.
> Nota: contrasto colore e visibilità del focus vanno confermati a runtime (axe-core / verifica manuale) — vedi §7. Questo report individua i problemi strutturali e ripetibili e i fix concreti.

## 1. Verdetto in una riga

La base è discreta — HTML semantico, `lang` dinamico, 135 modali etichettate, 110 `aria-label`, 77 label collegate con `htmlFor` — ma ci sono **due problemi diffusi da livello AA** (contrasto del testo secondario e testo micro) e alcuni problemi **puntuali di livello A** facili da chiudere (alt mancanti, elementi cliccabili non da tastiera, bottoni solo-icona su mobile). Nessun blocco strutturale; è lavoro di rifinitura mirata + un gate automatico che eviti regressioni.

## 2. Cosa è già a posto (da non toccare)

- **3.1.1 Lingua della pagina (A)** — `app/layout.tsx` imposta `<html lang="it">` e `lib/i18n/index.tsx` aggiorna `document.documentElement.lang` al cambio lingua. Corretto e dinamico.
- **4.1.2 Nome/Ruolo/Valore sui modali (A)** — 135 occorrenze di `DialogTitle` (shadcn Dialog associa `aria-labelledby`). I dialog sono etichettati.
- **Etichette form** — 77 `htmlFor` e uso diffuso del componente `<Label>`; 110 `aria-label` già presenti. Buona base per 3.3.2 e 4.1.2.

## 3. 🔴 Priorità ALTA — contrasto del testo (WCAG 1.4.3 Contrast Minimum, AA)

**Evidenza.** 589 occorrenze di `text-slate-500` / `text-slate-600` e **1263** occorrenze di testo micro (`text-2xs`, `text-[10px]`, `text-[11px]`), quasi sempre su sfondi scuri (`slate-900`).

**Perché è un problema.** Su sfondo `slate-900` (#0f172a):
- `text-slate-500` (#64748b) ≈ **3,4:1** → sotto la soglia 4,5:1 richiesta per testo normale (passa solo come "testo grande").
- `text-slate-600` (#475569) ≈ **2,3:1** → fallisce anche come testo grande.

Con `text-2xs`/10–11px (testo piccolo, mai "grande" ai fini WCAG) la soglia resta 4,5:1, quindi molte di queste combinazioni **non passano AA**.

**Fix.**
1. Alzare i grigi del testo secondario di un gradino: `text-slate-500 → text-slate-400` (#94a3b8 ≈ 6,5:1 su slate-900, passa), e **eliminare `text-slate-600` per il testo** (tenerlo solo per bordi/decorazioni non testuali).
2. Evitare `text-2xs`/`text-[10px]` per contenuto informativo: minimo `text-xs` (12px). Riservare il micro-testo a badge decorativi ridondanti.
3. Definire due token semantici (es. `--text-muted`, `--text-subtle`) con contrasto garantito e sostituire le classi sparse, così il fix non si perde alla prossima schermata.

## 4. 🟠 Priorità MEDIA — testo alternativo immagini (WCAG 1.1.1 Non-text Content, A)

**Evidenza.** 16 tag `<img>` su 32 sono **senza `alt`**. File coinvolti (esempi): `components/game-detail/screenshot-lightbox.tsx`, `components/game-card.tsx`, `components/cover-picker.tsx`, `components/tools/manga-translator.tsx`, `components/tools/texture-translator.tsx`, `components/ui/featured-game-widget.tsx`, `components/layout/main-layout.tsx`, `app/translation-wizard/page.tsx`, `components/modals/steam-modal.tsx`, `components/layout/global-search.tsx`, `components/notifications/notification-center.tsx`.

**Fix.**
- Copertine/screenshot di gioco: `alt={gameName}` (o `alt={`Copertina di ${gameName}`}`).
- Immagini puramente decorative: `alt=""` esplicito (le nasconde agli screen reader — corretto e voluto).
- Regola generale: **ogni `<img>` deve avere `alt`**, anche vuoto. Vietare `<img>` senza `alt` è il candidato ideale per una lint rule (`jsx-a11y/alt-text`).

## 5. 🟠 Priorità MEDIA — elementi cliccabili non raggiungibili da tastiera (WCAG 2.1.1 Keyboard, A + 4.1.2)

**Evidenza.** 7 `<div onClick=…>`. Vanno distinti due casi:

Interattivi veri (da convertire in `<button>` o aggiungere ruolo+tastiera):
- `app/auto-translate/page.tsx:2347` — selezione di un file dalla lista (`onClick={() => setSelectedFile(f.name)}`).
- `app/video-extractor/page.tsx:647` — avvia l'analisi header al click.
- `components/profiles/profile-selector.tsx:652` — selezione del profilo.

Overlay/backdrop di chiusura (accettabili se esiste già `Esc` o un pulsante di chiusura, ma meglio esplicitare):
- `app/library/page.tsx:1759`, `components/game-detail/screenshot-lightbox.tsx:127`, `components/notifications/keyboard-shortcuts-help.tsx:16`.

**Fix.**
- Per gli interattivi veri: usare `<button type="button">` (eredita focus + Invio/Spazio) invece di `<div>`, oppure — se il markup lo impedisce — aggiungere `role="button"`, `tabIndex={0}` e `onKeyDown` per Invio/Spazio.
- Per gli overlay: garantire chiusura con `Esc` (i Dialog shadcn lo fanno già) e un pulsante di chiusura visibile con `aria-label`; il click sul backdrop resta come scorciatoia aggiuntiva, non come unico modo.

## 6. 🟠 Priorità MEDIA — bottoni solo-icona su mobile (WCAG 2.4.4 / 4.1.2)

**Evidenza.** Pattern ricorrente `<span className="hidden sm:inline">Etichetta</span>` dentro bottoni con icona: su schermi piccoli il testo sparisce e resta **solo l'icona senza nome accessibile**. Presente in ~9 file, tra cui `app/ollama-manager/page.tsx`, `app/ollama-manager/advanced/page.tsx`, `app/library/page.tsx`, `components/layout/global-search.tsx`, `components/ui/command-palette.tsx`, `components/profiles/profile-header.tsx`.

**Fix.** Aggiungere `aria-label` (o `title`) al bottone con la stessa etichetta del testo, così il nome accessibile è presente anche quando il testo è nascosto:
```tsx
<Button aria-label={t('...label')}>
  <Icon className="h-4 w-4" />
  <span className="hidden sm:inline">{t('...label')}</span>
</Button>
```

## 7. Da verificare a runtime (non deducibile staticamente)

- **1.4.3 Contrasto** — confermare i rapporti reali con axe-core (vedi §3 per le combinazioni sospette).
- **2.4.7 Focus visibile (AA)** — verificare che ogni elemento interattivo mostri un anello di focus percepibile (attenzione a eventuali `outline-none` senza `focus-visible:ring`).
- **1.4.11 Contrasto non testuale (AA)** — bordi input, stati attivi, icone informative.
- **2.4.3 Ordine del focus** — nei flussi con modali/overlay.

## 8. Raccomandazione: automatizzare (chiude la card `a11y`)

Esiste già la suite E2E Playwright (`e2e/navigation.spec.ts`, `translation.spec.ts`, …) ma **axe-core non è installato**. Aggiungerlo rende l'audit ripetibile e blocca le regressioni:

```bash
npm i -D @axe-core/playwright
```
```ts
// in e2e/accessibility.spec.ts
import AxeBuilder from '@axe-core/playwright';
test('home senza violazioni critiche', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
});
```
Poi eseguirlo sulle schermate chiave (home, library, editor, patch-hub, projects, settings) e agganciarlo al workflow CI come gate — coerente con la nota della roadmap ("Tauri = webview, si usa axe-core in E2E"). Modello a ratchet come il gate i18n: prima si fotografa lo stato, poi si impedisce che peggiori mentre si bonifica.

## 9. Piano prioritizzato

| # | Intervento | WCAG | Sforzo | Impatto |
|---|-----------|------|--------|---------|
| 1 | `text-slate-500→400`, eliminare `text-slate-600` sul testo, min `text-xs` | 1.4.3 (AA) | Medio (diffuso, ma meccanico + token) | Alto |
| 2 | `alt` su tutte le `<img>` + lint `jsx-a11y/alt-text` | 1.1.1 (A) | Basso | Medio |
| 3 | `aria-label` sui bottoni con testo nascosto su mobile | 2.4.4/4.1.2 | Basso | Medio |
| 4 | `<div onClick>` interattivi → `<button>` (o role+tabIndex+onKeyDown) | 2.1.1 (A) | Basso | Medio |
| 5 | axe-core in E2E + gate CI a ratchet | tutti | Medio | Alto (previene regressioni) |
| 6 | Verifica runtime focus/contrasto non testuale | 2.4.7/1.4.11 | — | — |

**Quick win consigliati per primi:** 2, 3, 4 (poco codice, tutto livello A, nessun rischio UI). Poi 5 (gate) prima di affrontare 1 (contrasto), così il refactoring dei grigi è protetto dal test.
