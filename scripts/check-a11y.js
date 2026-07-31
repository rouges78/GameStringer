#!/usr/bin/env node
/**
 * Guard accessibilità — analisi statica dei .tsx, a ratchet.
 *
 * PERCHÉ NON axe-core (ancora)
 * ----------------------------
 * La scelta naturale sarebbe `@axe-core/playwright`, ed è quella scritta nella
 * roadmap. Ma axe gira su una PAGINA RESA: servono un browser e l'app in
 * esecuzione, e `playwright.config.ts` ha il webServer **disabilitato** («avviare
 * manualmente: npm run dev:simple»). Un gate che in CI non può partire non è un
 * gate: è un file che dà l'impressione di essere protetti.
 *
 * Questo script copre quindi la parte che si può decidere leggendo il sorgente —
 * ed è la parte che stava crescendo senza che nessuno la contasse. axe resta il
 * passo successivo per ciò che solo il runtime può dire: contrasto reale (1.4.3),
 * focus visibile (2.4.7), ordine di lettura. Le due cose non si escludono.
 *
 * COSA CONTROLLA
 *   1.1.1  <img> senza attributo alt
 *   2.1.1  <div>/<span> con onClick non raggiungibili da tastiera
 *          (serve role + tabIndex + un gestore onKeyDown/Press/Up)
 *   4.1.2  <button> in cui TUTTO il testo sparisce a un breakpoint
 *          (`hidden sm:inline`) e non resta né aria-label né sr-only
 *
 * IL RATCHET, e perché è a conteggio per file
 * -------------------------------------------
 * La baseline (scripts/.a11y-baseline.json) tiene un CONTEGGIO per file e regola,
 * non una riga o uno snippet: numeri di riga e testo cambiano a ogni refactor e
 * una baseline che si invalida da sola viene aggiornata a scatola chiusa, che è
 * peggio di non averla. La CI fallisce se un file ne guadagna di nuovi, **e anche
 * se ne perde senza aggiornare la baseline** — come per i gate i18n, moduli morti
 * e comandi Tauri: una baseline non mantenuta smette di dire il vero.
 *
 * ⚠️ LIMITI — da leggere PRIMA di correggere in blocco quello che elenca
 *
 *  - `div-onclick-overlay` (backdrop `fixed/absolute inset-0`) è contato A PARTE
 *    perché il rimedio è OPPOSTO: un backdrop NON deve entrare nel tab order.
 *    Aggiungergli role+tabIndex lo peggiora, mettendo una trappola per chi naviga
 *    da tastiera. Lì la cosa giusta è che il dialogo si chiuda con Esc — e questo
 *    lo script NON lo sa vedere: va verificato a mano.
 *  - Per le card/righe cliccabili il rimedio migliore è spesso SOSTITUIRE il div
 *    con un <button>, non appiccicare tre attributi. Il conteggio scende uguale,
 *    ma il secondo modo lascia debito.
 *  - Lo script legge il sorgente, non il DOM: un componente che riceve `onClick`
 *    via prop e lo attacca a un <button> interno non è un difetto, e viceversa
 *    un wrapper che sembra a posto può renderizzare male. Segnala dove guardare.
 *  - `alt` è controllato sul tag HTML `<img>`, MAI su `<Image>`: in questo repo
 *    `<Image>` è quasi sempre l'ICONA di lucide-react, non un'immagine. Una
 *    ricerca ingenua il 31/07 ne ha segnalate 2 ed erano entrambe icone.
 *
 * Uso:
 *   node scripts/check-a11y.js            # verifica vs baseline
 *   node scripts/check-a11y.js --update   # riscrive la baseline
 *   node scripts/check-a11y.js --report   # elenco completo con i punti esatti
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(__dirname, '.a11y-baseline.json');
const DIRS = ['app', 'components', 'hooks'];
const IGNORA = /node_modules|\.next|dist|out|coverage/;

const REGOLE = {
  'img-no-alt': '<img> senza alt (WCAG 1.1.1)',
  'div-onclick': '<div>/<span> cliccabile non raggiungibile da tastiera (WCAG 2.1.1)',
  'div-onclick-overlay': 'backdrop cliccabile — NON renderlo focusabile, serve Esc sul dialogo',
  'icon-button-no-label': '<button> solo-icona a breakpoint, senza etichetta (WCAG 4.1.2)',
};

function elencaFile() {
  const out = [];
  const walk = (d) => {
    let voci;
    try { voci = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const v of voci) {
      const p = path.join(d, v.name);
      if (v.isDirectory()) { if (!IGNORA.test(p)) walk(p); }
      else if (/\.(tsx|jsx)$/.test(v.name)) out.push(path.relative(ROOT, p).replace(/\\/g, '/'));
    }
  };
  DIRS.forEach((d) => walk(path.join(ROOT, d)));
  return out.sort();
}

const riga = (s, i) => s.slice(0, i).split('\n').length;

/**
 * Un bottone è "solo icona" se, tolti gli elementi nascosti a breakpoint, non
 * resta più nulla di testuale.
 *
 * Serve a non gridare al lupo su `components/ui/command-palette.tsx`, dove a
 * nascondersi è il <kbd> della scorciatoia mentre il titolo del comando resta
 * sempre visibile: contare la presenza di `hidden sm:inline` e basta lo
 * segnalava come difetto, e non lo è.
 */
function restaSoloIcona(testoBottone) {
  const senzaNascosti = testoBottone.replace(/<(\w+)[^>]*className={?["'`][^"'`]*hidden\s+(sm|md|lg|xl):[^"'`]*["'`][^>]*>[\s\S]*?<\/\1>/g, '');
  const interno = senzaNascosti.replace(/^<[^>]*>/, '').replace(/<\/[^>]*>$/, '');
  const conTesto = /[>{]\s*[A-Za-zÀ-ÿ]/.test(interno.replace(/className={?["'`][^"'`]*["'`]}?/g, ''));
  return !conTesto;
}

function analizza(file) {
  const s = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const trovati = [];

  for (const m of s.matchAll(/<img\b[\s\S]*?(?:\/>|>)/g)) {
    if (!/\balt\s*=/.test(m[0])) {
      trovati.push({ regola: 'img-no-alt', riga: riga(s, m.index) });
    }
  }

  for (const m of s.matchAll(/<(div|span)\b[^>]*onClick[\s\S]*?>/g)) {
    const t = m[0];
    const accessibile = /\brole\s*=/.test(t) && /\btabIndex\s*=/.test(t) && /onKey(Down|Press|Up)/.test(t);
    if (accessibile) continue;
    const overlay = /(fixed|absolute)\s+inset-0/.test(t);
    trovati.push({ regola: overlay ? 'div-onclick-overlay' : 'div-onclick', riga: riga(s, m.index) });
  }

  for (const m of s.matchAll(/<[Bb]utton\b[\s\S]*?<\/[Bb]utton>/g)) {
    const t = m[0];
    if (!/hidden\s+(sm|md|lg|xl):inline/.test(t)) continue;
    if (/aria-label\s*=/.test(t) || /sr-only/.test(t)) continue;
    if (!restaSoloIcona(t)) continue;
    trovati.push({ regola: 'icon-button-no-label', riga: riga(s, m.index) });
  }

  return trovati;
}

function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const report = args.includes('--report');

  const attuale = {};
  const dettaglio = {};
  for (const f of elencaFile()) {
    const t = analizza(f);
    if (!t.length) continue;
    const perRegola = {};
    for (const x of t) perRegola[x.regola] = (perRegola[x.regola] || 0) + 1;
    attuale[f] = perRegola;
    dettaglio[f] = t;
  }

  const totali = {};
  for (const per of Object.values(attuale)) {
    for (const [r, n] of Object.entries(per)) totali[r] = (totali[r] || 0) + n;
  }
  const totale = Object.values(totali).reduce((a, b) => a + b, 0);

  if (update) {
    fs.writeFileSync(
      BASELINE_FILE,
      JSON.stringify({
        _nota: 'Conteggi noti per file e regola. Aggiornare SOLO dopo aver corretto o valutato: vedi i LIMITI in scripts/check-a11y.js — i backdrop non vanno resi focusabili.',
        aggiornato: new Date().toISOString().slice(0, 10),
        totali,
        known: attuale,
      }, null, 2) + '\n'
    );
    console.log(`✔ baseline a11y aggiornata: ${totale} segnalazioni in ${Object.keys(attuale).length} file`);
    for (const [r, n] of Object.entries(totali)) console.log(`    ${String(n).padStart(4)}  ${REGOLE[r] || r}`);
    return;
  }

  if (report) {
    for (const [f, t] of Object.entries(dettaglio)) {
      console.log(`\n${f}`);
      for (const x of t) console.log(`   riga ${String(x.riga).padStart(5)}  ${x.regola}`);
    }
    console.log(`\nTOTALE ${totale}`);
    for (const [r, n] of Object.entries(totali)) console.log(`  ${String(n).padStart(4)}  ${REGOLE[r] || r}`);
    return;
  }

  if (!fs.existsSync(BASELINE_FILE)) {
    console.error('✖ Baseline assente. Crearla con:  node scripts/check-a11y.js --update');
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  const noti = baseline.known || {};

  const peggiorati = [];
  const migliorati = [];

  for (const [f, per] of Object.entries(attuale)) {
    for (const [r, n] of Object.entries(per)) {
      const atteso = (noti[f] && noti[f][r]) || 0;
      if (n > atteso) peggiorati.push({ f, r, atteso, n });
    }
  }
  for (const [f, per] of Object.entries(noti)) {
    for (const [r, atteso] of Object.entries(per)) {
      const n = (attuale[f] && attuale[f][r]) || 0;
      if (n < atteso) migliorati.push({ f, r, atteso, n });
    }
  }

  if (peggiorati.length) {
    console.error(`\n✖ ${peggiorati.length} peggioramento/i di accessibilità rispetto alla baseline:\n`);
    for (const p of peggiorati) {
      console.error(`  ${p.f}`);
      console.error(`      ${p.r}: ${p.atteso} → ${p.n}`);
      const punti = (dettaglio[p.f] || []).filter((x) => x.regola === p.r).map((x) => x.riga);
      console.error(`      righe: ${punti.join(', ')}`);
      console.error(`      ${REGOLE[p.r] || ''}`);
    }
    console.error('\n  Correggere, oppure — se è una scelta consapevole — aggiornare la baseline:');
    console.error('    node scripts/check-a11y.js --update\n');
    process.exit(1);
  }

  if (migliorati.length) {
    console.error(`\n✖ baseline non aggiornata: ${migliorati.length} voce/i migliorata/e ma ancora elencata/e.`);
    for (const m of migliorati) console.error(`  ${m.f}  ${m.r}: ${m.atteso} → ${m.n}`);
    console.error('\n  Ottima notizia, ma va registrata: node scripts/check-a11y.js --update\n');
    process.exit(1);
  }

  console.log(`✅ Accessibilità: nessun peggioramento (${totale} segnalazioni note = baseline).`);
  for (const [r, n] of Object.entries(totali)) console.log(`    ${String(n).padStart(4)}  ${REGOLE[r] || r}`);
}

main();
