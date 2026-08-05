#!/usr/bin/env node
/**
 * Traduce i testi SCI estratti (testi-estratti.json) con OLLAMA IN LOCALE.
 * Costo zero: gira sul PC dell'utente, stesso motore del percorso offline di
 * GameStringer. Gemello di scripts/arcadia-ollama-translate.js, ma la struttura
 * dei dati è diversa e molto meno perdonante.
 *
 * ⛔ IL VINCOLO CHE COMANDA TUTTO: una risorsa SCI è una LISTA POSIZIONALE di
 * stringhe, e gli script del gioco le richiamano per INDICE (Print text, N).
 * Quindi l'output DEVE avere esattamente lo stesso numero di elementi, nello
 * stesso ordine. Non si accorpa, non si salta, non si riordina: una stringa in
 * meno e da lì in poi il gioco dice le battute sbagliate.
 * Qui si traduce per INDICE ESPLICITO e si ricompone la lista dall'originale:
 * quello che manca resta in inglese, mai un buco.
 *
 * NON SI TRADUCONO (misurato sui testi di Larry 3):
 *  - stringhe di soli numeri/simboli (« 0», «%d/%d»)
 *  - stringhe di servizio del parser e del debug (« %s was state %d; is now…»)
 *  - stringhe cortissime senza lettere
 * I segnaposto printf (%s %d %c) devono restare IDENTICI per numero e ordine:
 * il gioco ci infila dentro nomi e numeri. La guardia li conta e scarta le
 * traduzioni che li rovinano — meglio inglese che una frase che manda in crash
 * la formattazione.
 *
 * Uso:
 *   node scripts/sci-ollama-translate.js [--in estratti-larry3/testi-estratti.json]
 *                                        [--model nome] [--batch 12] [--limit N]
 * Output: estratti-larry3/tradotti-ollama.json  (stessa forma dell'input)
 * Poi:    node scripts/sci-write-patch.js "<gioco>" --apply estratti-larry3/tradotti-ollama.json
 */
const fs = require('fs');
const path = require('path');

const HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const IN = opt('in', 'estratti-larry3/testi-estratti.json');
const OUT = opt('out', 'estratti-larry3/tradotti-ollama.json');
const BATCH = parseInt(opt('batch', '12'), 10);
const LIMIT = parseInt(opt('limit', '0'), 10); // 0 = tutte
let MODEL = opt('model', null);

// ── che cosa NON si traduce ─────────────────────────────────────────────────
function daTradurre(s) {
  if (typeof s !== 'string') return false;
  if (s.trim().length < 3) return false;               // «%s», « 0»
  // ⚠️ CORREZIONE 05/08/2026: prima chiedevo 3 lettere CONSECUTIVE e finivano
  // fra gli scarti battute vere fatte di parole corte — «Hi, Al!», «Ha, ha!»,
  // «O.K.». Conta le lettere TOTALI: 2 bastano per una frase da tradurre.
  if ((s.match(/[a-zA-Z]/g) || []).length < 2) return false;
  if (/^[\s\d.,:%\/()-]*$/.test(s)) return false;      // solo numeri e simboli
  // stringhe di debug del motore: parlano di «state», «room», «newRoom»…
  if (/%s was state %d|newRoom|Debug will|room %d/i.test(s)) return false;
  return true;
}

/** Segnaposto printf, in ordine: devono sopravvivere identici. */
const segnaposto = (s) => (s.match(/%[sdcuxfl%]/g) || []).join('');

async function api(pathname, body) {
  const r = await fetch(HOST + pathname, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${pathname} → HTTP ${r.status}`);
  return r.json();
}

async function scegliModello() {
  let tags;
  try { tags = await api('/api/tags'); }
  catch (e) {
    console.error(`❌ Ollama non raggiungibile su ${HOST} — avvialo e riprova.\n   ${e.message}`);
    process.exit(2);
  }
  const inst = (tags.models || []).map(m => m.name);
  if (!inst.length) { console.error('❌ Nessun modello installato in Ollama.'); process.exit(2); }
  if (MODEL) {
    const hit = inst.find(n => n === MODEL || n === `${MODEL}:latest` || n.startsWith(MODEL + ':'));
    if (!hit) { console.error(`❌ Modello «${MODEL}» non installato. Disponibili: ${inst.join(', ')}`); process.exit(2); }
    return hit;
  }
  for (const re of [/qwen2\.5.*instruct/i, /gemma/i, /qwen.*instruct/i, /llama3.*instruct/i, /mistral/i, /llama3/i]) {
    const hit = inst.find(n => re.test(n)); if (hit) return hit;
  }
  return inst[0];
}

const prompt = (obj) => `Sei un traduttore professionista di avventure grafiche. Traduci in ITALIANO i valori di questo oggetto JSON (inglese → italiano). È Leisure Suit Larry 3, una commedia demenziale del 1989: tono ironico, parlato, battute salaci ma non volgari gratuite.
REGOLE FERREE:
- Rispondi SOLO con un oggetto JSON con le STESSE chiavi (sono numeri: sono INDICI, non toccarli).
- I segnaposto %s %d %c vanno lasciati IDENTICI, stesso numero e stesso ordine: il gioco ci mette dentro parole e numeri.
- Non tradurre i nomi propri: Larry, Patti, Al Lowe, Sierra, Nontoonyt, Kalalau.
- Mantieni la lunghezza simile all'originale: il testo va in finestre piccole.
- Usa accenti veri (à è é ì ò ù); per la maiuscola accentata scrivi E' (es. E' vero).
- Conserva la punteggiatura iniziale/finale e gli spazi ai bordi.

JSON:
${JSON.stringify(obj, null, 0)}`;

async function traduciLotto(model, obj) {
  const res = await api('/api/generate', {
    model, prompt: prompt(obj), stream: false, format: 'json',
    options: { temperature: 0.35, num_ctx: 8192 },
  });
  try { return JSON.parse(res.response); } catch { return null; }
}

async function main() {
  const model = await scegliModello();
  const src = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  // Elenco piatto dei lavori: {risorsa, indice, testo}
  const lavori = [];
  for (const [ris, arr] of Object.entries(src)) {
    arr.forEach((s, i) => { if (daTradurre(s)) lavori.push({ ris, i, s }); });
  }
  const totale = lavori.length;
  const daFare = lavori.filter(l => !(out[l.ris] && typeof out[l.ris][l.i] === 'string' && out[l.ris][l.i] !== src[l.ris][l.i]));
  const lista = LIMIT > 0 ? daFare.slice(0, LIMIT) : daFare;

  console.log(`🤖 ${model} · ${HOST} · lotti da ${BATCH}`);
  console.log(`📄 ${Object.keys(src).length} risorse · ${totale} stringhe traducibili · ${daFare.length} ancora da fare` +
    (LIMIT > 0 ? ` · limite ${LIMIT}` : ''));

  let tradotte = 0, fallite = 0, scartate = 0;
  const t0 = Date.now();

  for (let p = 0; p < lista.length; p += BATCH) {
    const fetta = lista.slice(p, p + BATCH);
    const inObj = Object.fromEntries(fetta.map((l, k) => [String(k), l.s]));

    let ris = await traduciLotto(model, inObj);
    if (!ris) ris = {};

    fetta.forEach((l, k) => {
      const t = ris[String(k)];
      if (typeof t !== 'string' || !t.trim()) { fallite++; return; }
      // GUARDIA: i segnaposto devono coincidere, altrimenti si scarta.
      if (segnaposto(t) !== segnaposto(l.s)) { scartate++; return; }
      // La lista completa si ricompone dall'ORIGINALE: mai buchi, mai spostamenti.
      if (!out[l.ris]) out[l.ris] = src[l.ris].slice();
      out[l.ris][l.i] = t;
      tradotte++;
    });

    fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); // checkpoint a ogni lotto
    const vel = tradotte / Math.max(1, (Date.now() - t0) / 1000);
    process.stdout.write(`\r   ${tradotte}/${lista.length} · ${vel.toFixed(1)} str/s · ${fallite} fallite · ${scartate} scartate (segnaposto)   `);
  }
  console.log();

  // ── verifica strutturale: è l'unica che protegge dal disastro degli indici ──
  let strutturaOk = true;
  for (const [ris, arr] of Object.entries(out)) {
    if (arr.length !== src[ris].length) {
      console.log(`   ❌ ${ris}: ${arr.length} elementi invece di ${src[ris].length}`);
      strutturaOk = false;
    }
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\n📊 ${tradotte} tradotte · ${fallite} fallite · ${scartate} scartate dalla guardia segnaposto · ${sec}s`);
  console.log(strutturaOk
    ? '✅ Struttura integra: ogni risorsa ha lo stesso numero di stringhe dell\'originale.'
    : '⛔ STRUTTURA ROTTA: non applicare — gli indici si sposterebbero e il gioco direbbe battute sbagliate.');
  console.log(`✍️  ${OUT}`);
  console.log('\nProssimo: node scripts/sci-write-patch.js "<gioco>" --apply ' + OUT);
  if (fallite + scartate > 0) console.log(`⚠️ ${fallite + scartate} stringhe resteranno in INGLESE (onesto). Rilancia per ritentarle.`);
}

main().catch(e => { console.error(e); process.exit(1); });
