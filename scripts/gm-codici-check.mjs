/**
 * Deltarune / GameMaker: quanti codici di controllo sono sopravvissuti alla traduzione?
 *
 * Nasce il 16/08/2026 per dare un NUMERO alla prova in campo del masking
 * (commands/gm_placeholder.rs). Il 15/08, dopo la prima run completa, il
 * confronto chiave-per-chiave EN/IT aveva trovato 891 stringhe su 5.992 con i
 * codici alterati e 179 soft-lock potenziali. Senza uno strumento che rifaccia
 * quella misura, «adesso sembra a posto» non è una prova: è un'impressione.
 *
 * Confronta la sorgente inglese col file tradotto, chiave per chiave, e conta
 * le stringhe in cui l'insieme dei codici è cambiato.
 *
 * ⚠️ Questo script NON è il guard: è il suo controllo indipendente. Riproduce
 * l'algoritmo di gm_placeholder.rs invece di importarlo, di proposito — un
 * verificatore che condivide il codice con ciò che verifica dà sempre ragione
 * a sé stesso. Se i due divergono, va guardato PERCHÉ divergono.
 *
 * USO:
 *   node scripts/gm-codici-check.mjs "<percorso gioco>"
 *   node scripts/gm-codici-check.mjs "C:\\...\\DELTARUNEdemo"
 *   node scripts/gm-codici-check.mjs "<percorso>" --mostra 20
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const gamePath = process.argv[2];
const mostraIdx = process.argv.indexOf('--mostra');
const MOSTRA = mostraIdx > -1 ? parseInt(process.argv[mostraIdx + 1] || '10', 10) : 10;

if (!gamePath || !existsSync(gamePath)) {
  console.error('Uso: node scripts/gm-codici-check.mjs "<percorso gioco>" [--mostra N]');
  process.exit(2);
}

const langDir = join(gamePath, 'lang');
if (!existsSync(langDir)) {
  console.error(`❌ Nessuna cartella lang/ in ${gamePath}`);
  console.error('   Questo script serve ai GameMaker con file di lingua esterni (Deltarune).');
  process.exit(2);
}

// ── L'algoritmo, tenuto identico a gm_placeholder.rs ────────────────────
const isAlpha = (c) => /[A-Za-z]/.test(c);
const isDigit = (c) => /[0-9]/.test(c);
const isAlnum = (c) => /[A-Za-z0-9]/.test(c);

function isTrailing(s, from) {
  let i = from;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '/' || c === '%' || c === '&') i++;
    else if (c === '^' && i + 1 < s.length && isDigit(s[i + 1])) i += 2;
    else if (c === '\\' && i + 2 < s.length && isAlpha(s[i + 1])) i += 3;
    else return false;
  }
  return true;
}

function estraiCodici(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '%') { out.push('/%'); i += 2; continue; }
    if (c === '\\' && i + 2 < s.length && isAlpha(s[i + 1]) && isAlnum(s[i + 2])) { out.push(s.slice(i, i + 3)); i += 3; continue; }
    if (c === '^' && i + 1 < s.length && isDigit(s[i + 1])) { out.push(s.slice(i, i + 2)); i += 2; continue; }
    if (c === '&') { out.push('&'); i++; continue; }
    if ((c === '/' || c === '%') && isTrailing(s, i + 1)) { out.push(c); i++; continue; }
    i++;
  }
  return out;
}

const multiset = (a) => { const m = new Map(); for (const x of a) m.set(x, (m.get(x) || 0) + 1); return m; };
function diffCodici(src, tgt) {
  const a = multiset(estraiCodici(src)), b = multiset(estraiCodici(tgt));
  const persi = [], aggiunti = [];
  for (const [k, n] of a) { const d = n - (b.get(k) || 0); for (let i = 0; i < d; i++) persi.push(k); }
  for (const [k, n] of b) { const d = n - (a.get(k) || 0); for (let i = 0; i < d; i++) aggiunti.push(k); }
  return { persi, aggiunti };
}

// ── Coppie sorgente/target, come le accoppia il patcher ─────────────────
const files = readdirSync(langDir);
const coppie = files
  .filter((f) => f.startsWith('lang_en') && f.endsWith('.json'))
  .map((src) => ({ src, tgt: `lang_ja${src.slice('lang_en'.length, -5)}.json` }))
  .filter((p) => files.includes(p.tgt));

if (coppie.length === 0) {
  console.error('❌ Nessuna coppia lang_en*.json + lang_ja*.json trovata.');
  process.exit(2);
}

console.log(`\n${'═'.repeat(70)}`);
console.log('DELTARUNE — CODICI DI CONTROLLO SOPRAVVISSUTI ALLA TRADUZIONE');
console.log(`${'═'.repeat(70)}`);

// ── CONTROLLO DI SANITÀ: sto guardando una traduzione, o il giapponese? ──
//
// ⚠️ Aggiunto il 16/08/2026 dopo che questa mancanza ha prodotto un verdetto
// FALSO sulla prima run vera. Il file di destinazione è `lang_ja*.json`: se la
// patch non è stata applicata (o è stata ripristinata dal .bak), lì dentro c'è
// il giapponese ORIGINALE del gioco. Confrontarlo con l'inglese misura le
// differenze editoriali fra due localizzazioni ufficiali — numeri veri su una
// domanda che nessuno ha fatto — e le stampa con la stessa autorità di un
// risultato buono. Un verificatore che non verifica di star guardando la cosa
// giusta è peggio di nessun verificatore: dà una risposta, e la si crede.
function profiloScrittura(testi) {
  let cjk = 0, latino = 0;
  for (const t of testi) {
    for (const ch of t) {
      const c = ch.codePointAt(0);
      if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xff9f)) cjk++;
      else if (/[a-zA-ZÀ-ÿ]/.test(ch)) latino++;
    }
  }
  return { cjk, latino };
}
/** True se la stringa è prevalentemente giapponese (CJK). */
function eGiapponese(t) {
  const { cjk, latino } = profiloScrittura([t]);
  return cjk + latino > 0 && cjk / (cjk + latino) > 0.5;
}
{
  const primaCoppia = files.filter((f) => f.startsWith('lang_ja') && f.endsWith('.json'))[0];
  if (primaCoppia) {
    const campione = Object.values(JSON.parse(readFileSync(join(langDir, primaCoppia), 'utf8')))
      .filter((v) => typeof v === 'string').slice(0, 400);
    const { cjk, latino } = profiloScrittura(campione);
    const quotaCjk = cjk + latino > 0 ? cjk / (cjk + latino) : 0;
    if (quotaCjk > 0.85) {
      // Non "più del 30%": il file patchato è legittimamente MISTO — italiano
      // per le chiavi tradotte, giapponese per quelle che il guard ha rifiutato
      // o che non hanno ricevuto traduzione (nel percorso Deltarune il rifiuto
      // lascia il giapponese che c'era, non l'inglese). Solo un file QUASI
      // TUTTO giapponese indica che la patch non c'è proprio.
      console.log(`\n  ⛔⛔ FERMO QUI: ${primaCoppia} è al ${Math.round(quotaCjk * 100)}% giapponese.`);
      console.log('     Non è una traduzione con qualche residuo: è il file originale del');
      console.log('     gioco. La patch non è stata applicata a questa copia, oppure è');
      console.log('     stata ripristinata dal backup .bak.');
      console.log('\n     Confrontarlo con l\'inglese misurerebbe le differenze fra due');
      console.log('     localizzazioni ufficiali — un numero vero su una domanda che');
      console.log('     nessuno ha fatto. Non lo faccio: sarebbe un verdetto falso.');
      console.log('\n     Da controllare, nella cartella lang/ del gioco:');
      console.log(`       · esiste ${primaCoppia}.bak ?  (se sì, una patch c'è stata)`);
      console.log(`       · la data di ${primaCoppia} è quella della run?`);
      console.log('       · il percorso passato a questo script è lo stesso che usa l\'app?\n');
      process.exit(3);
    }
  }
}

let totChiavi = 0, totConCodici = 0, totRotte = 0, totNonTradotte = 0, totInGiapponese = 0;
const classifica = new Map();
const esempi = [];
let softlock = 0;

for (const { src, tgt } of coppie) {
  const EN = JSON.parse(readFileSync(join(langDir, src), 'utf8'));
  const IT = JSON.parse(readFileSync(join(langDir, tgt), 'utf8'));
  console.log(`\n  ${src} → ${tgt}`);

  let rotte = 0, conCodici = 0, nonTradotte = 0, inGiapponese = 0;
  for (const [k, originale] of Object.entries(EN)) {
    if (typeof originale !== 'string') continue;
    const tradotta = IT[k];
    if (typeof tradotta !== 'string') continue;
    totChiavi++;
    const codiciSrc = estraiCodici(originale);
    if (codiciSrc.length === 0) continue;
    conCodici++;
    if (tradotta === originale) { nonTradotte++; continue; }

    // Rimasta in giapponese = il guard l'ha rifiutata o non è mai stata
    // tradotta: il patcher lascia il contenuto che c'era. NON è un codice
    // rotto — il giapponese ufficiale impagina coi SUOI codici, e contarne
    // le differenze come rotture è stato l'errore del primo verdetto (16/08):
    // 581 «alterate» che erano solo stringhe mai toccate da noi.
    if (eGiapponese(tradotta)) { inGiapponese++; continue; }

    const { persi, aggiunti } = diffCodici(originale, tradotta);
    if (persi.length || aggiunti.length) {
      rotte++;
      for (const p of persi) classifica.set(p, (classifica.get(p) || 0) + 1);
      // Un terminatore perso è la firma del soft-lock: il gioco resta in attesa.
      if (persi.some((p) => p === '/' || p === '%' || p === '/%')) softlock++;
      if (esempi.length < MOSTRA) esempi.push({ k, originale, tradotta, persi, aggiunti });
    }
  }
  console.log(`    con codici: ${conCodici}  ·  alterate: ${rotte}  ·  in inglese: ${nonTradotte}  ·  in giapponese: ${inGiapponese}`);
  totConCodici += conCodici; totRotte += rotte; totNonTradotte += nonTradotte; totInGiapponese += inGiapponese;
}

console.log(`\n${'─'.repeat(70)}`);
console.log('TOTALE');
console.log(`${'─'.repeat(70)}`);
console.log(`  chiavi confrontate        : ${totChiavi.toLocaleString('it-IT')}`);
console.log(`  di cui CON codici         : ${totConCodici.toLocaleString('it-IT')}`);
console.log(`  rimaste in inglese        : ${totNonTradotte.toLocaleString('it-IT')}`);
console.log(`  rimaste in giapponese     : ${totInGiapponese.toLocaleString('it-IT')}  (rifiutate dal guard o mai tradotte: il file di destinazione ERA giapponese)`);
console.log(`  ⛔ TRADOTTE con codici alterati : ${totRotte.toLocaleString('it-IT')}`);
console.log(`  ⛔ soft-lock potenziali    : ${softlock.toLocaleString('it-IT')}  (terminatore / o % perso)`);

if (classifica.size) {
  console.log('\n  Classifica dei codici PERSI:');
  [...classifica.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([c, n]) => console.log(`    ${String(n).padStart(5)}  ${JSON.stringify(c)}`));
}

if (esempi.length) {
  console.log(`\n  Primi ${esempi.length} casi (per capire COSA si rompe, non solo quanto):`);
  for (const e of esempi) {
    console.log(`\n    [${e.k}]`);
    console.log(`      EN: ${JSON.stringify(e.originale.slice(0, 90))}`);
    console.log(`      IT: ${JSON.stringify(e.tradotta.slice(0, 90))}`);
    if (e.persi.length) console.log(`      persi:    ${e.persi.map((x) => JSON.stringify(x)).join(' ')}`);
    if (e.aggiunti.length) console.log(`      inventati: ${e.aggiunti.map((x) => JSON.stringify(x)).join(' ')}`);
  }
}

console.log(`\n${'═'.repeat(70)}`);
// ⚠️ Il verdetto si dà in PERCENTUALE, non su una soglia assoluta. La prima
// versione di questo script diceva «oltre il 90% in meno» confrontando il
// conteggio grezzo con l'891 del 15/08: su una fixture da 6 chiavi dichiarava
// un successo che non aveva. Un numero assoluto non sa su quante stringhe è
// stato calcolato, e un verdetto che non conosce il proprio denominatore è
// esattamente il difetto che questo progetto insegue da settimane.
const BASELINE_ROTTE = 891, BASELINE_TOT = 5992;
const tassoPrima = (BASELINE_ROTTE / BASELINE_TOT) * 100; // 14,9%
// Denominatore: le stringhe che ABBIAMO tradotto. Contare anche quelle rimaste
// in inglese o giapponese diluirebbe il tasso con stringhe mai passate dal
// modello — un altro modo di darsi ragione coi numeri.
const tradotteConCodici = totConCodici - totNonTradotte - totInGiapponese;
const tassoOra = tradotteConCodici > 0 ? (totRotte / tradotteConCodici) * 100 : 0;

console.log('  IL METRO DI PARAGONE: il 15/08/2026, PRIMA del masking, la stessa');
console.log(`  misura dava 891 alterate su 5.992 con codici = ${tassoPrima.toFixed(1)}% rotte, 179 soft-lock.`);
console.log(`  ORA: ${totRotte} su ${tradotteConCodici} tradotte = ${tassoOra.toFixed(1)}% rotte.`);
if (totInGiapponese > 0) {
  console.log(`  (${totInGiapponese} rimaste in giapponese: prezzo del guard che rifiuta invece di rompere)`);
}

if (totConCodici < 200) {
  console.log(`\n  ⚠️ CAMPIONE TROPPO PICCOLO (${totConCodici} stringhe con codici) per un verdetto.`);
  console.log('     Su Deltarune vero sono ~6.000: se ne vedi poche, stai guardando');
  console.log('     una fixture o una run parziale, non la prova.');
} else if (totRotte === 0) {
  console.log('\n  ✅ ZERO alterate su un campione vero: i codici sono sopravvissuti tutti.');
} else if (tassoOra < tassoPrima / 10) {
  console.log(`\n  ✅ Tasso sceso da ${tassoPrima.toFixed(1)}% a ${tassoOra.toFixed(1)}%: oltre 10 volte meglio.`);
  console.log('     Resta comunque da guardare la classifica: i codici che ancora si perdono');
  console.log('     sono di una forma che il pattern non conosce?');
} else {
  console.log(`\n  ⚠️ Tasso ${tassoOra.toFixed(1)}% contro ${tassoPrima.toFixed(1)}% di prima: il masking NON sta coprendo.`);
  console.log('     Guarda la classifica e gli esempi: quasi certamente c\'è una forma di');
  console.log('     codice che extract_gm_codes non riconosce, e va aggiunta al modulo Rust.');
}
console.log(`${'═'.repeat(70)}`);
console.log('\n⚠️ Questo conta i CODICI, non la qualità della traduzione né il fatto');
console.log('   che il gioco parta. La prova finale resta avviare Deltarune.\n');

process.exit(totRotte === 0 ? 0 : 1);
