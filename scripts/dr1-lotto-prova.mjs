#!/usr/bin/env node
/**
 * Lotto di prova Danganronpa — la decisione si prende LEGGENDO, non stimando.
 *
 * Il 10/08/2026 la misura ha detto due cose: tradurre tutto DR1 costa $1-25
 * secondo il modello, e il gioco è tradotto all'1% (329 righe su 47.999 dopo
 * ~13 ore di Ollama). La domanda vera non è «quanto costa» ma «quanto è
 * migliore»: e a quella risponde solo Davide, leggendo le stesse battute nelle
 * due versioni. Questo script produce esattamente quel confronto.
 *
 * COSA FA
 *   1. legge il checkpoint (translations.json) SENZA MAI SCRIVERCI;
 *   2. sceglie ~250 righe rappresentative — di preferenza fra quelle GIÀ
 *      tradotte da Ollama, così il confronto è a tre colonne sulle stesse
 *      battute (EN · Ollama · Cloud), che è l'unico confronto che decide;
 *   3. le traduce col modello cloud scelto, stesso contesto del ramo cloud di
 *      danganronpa-translate.ts (visual novel Spike Chunsoft, tag <CLT>
 *      preservati ESATTI, tono colloquiale);
 *   4. scrive `lotto-prova.md` (tabella da leggere) e `lotto-prova.json`
 *      accanto al checkpoint, e stampa il costo REALE dal conteggio token
 *      dell'API — non una stima a 4 caratteri per token.
 *
 * NON tocca né il checkpoint né i file del gioco: è una prova di lettura.
 *
 * USO (serve ANTHROPIC_API_KEY nell'ambiente):
 *   node scripts/dr1-lotto-prova.mjs "<percorso translations.json>"
 *   node scripts/dr1-lotto-prova.mjs "<percorso>" --model claude-haiku-4-5-20251001
 *   node scripts/dr1-lotto-prova.mjs "<percorso>" --n 300
 *
 * Modelli utili al confronto (listini riverificati il 16/08/2026):
 *   claude-haiku-4-5-20251001   (~$4,30 per tutto il gioco)
 *   claude-sonnet-5             (~$8,60 — ✅ NESSUN AUMENTO: il +50% previsto per
 *                                il 01/09 è stato annullato il 10/08, $2/$10 è
 *                                permanente. Non c'è fretta di decidere)
 *   claude-opus-5               (~$21,49)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';

const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--'));
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const MODEL = arg('model', 'claude-sonnet-5');
const N = Math.max(50, Math.min(1000, parseInt(arg('n', '250'), 10) || 250));
const KEY = process.env.ANTHROPIC_API_KEY;

if (!file || !existsSync(file)) {
  console.error('Uso: node scripts/dr1-lotto-prova.mjs "<percorso translations.json>" [--model m] [--n 250]');
  process.exit(2);
}
if (!KEY) {
  console.error('ANTHROPIC_API_KEY non impostata. In Git Bash:  export ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(2);
}

const righe = JSON.parse(readFileSync(file, 'utf8'));

/* ── Selezione ──────────────────────────────────────────────────────────────
 * Rappresentativa, non «le prime N»: le prime righe di un .lin sono menu e
 * system text, e giudicare un modello sui menu è giudicare un cuoco sull'acqua
 * bollita. Criteri:
 *   - solo battute con almeno 25 caratteri (dialogo vero, non «OK»);
 *   - di preferenza righe GIÀ tradotte da Ollama (confronto a 3 colonne);
 *   - passo costante sull'elenco ordinato → copre tutto l'arco del gioco
 *     in modo DETERMINISTICO: rilanciando con un altro modello si ottengono
 *     le STESSE battute, quindi i lotti sono confrontabili fra loro. */
const dialogo = r => String(r.original || '').trim().length >= 25;
const tradotte = righe.filter(r => r.translated && String(r.translated).trim() && dialogo(r));
const base = tradotte.length >= N ? tradotte : righe.filter(dialogo);
const passo = Math.max(1, Math.floor(base.length / N));
const lotto = [];
for (let i = 0; i < base.length && lotto.length < N; i += passo) lotto.push(base[i]);

console.log(`Checkpoint: ${righe.length} righe totali · ${tradotte.length} già tradotte (Ollama)`);
console.log(`Lotto: ${lotto.length} battute (passo ${passo} su ${base.length}) · modello: ${MODEL}`);
if (tradotte.length < N) {
  console.log('⚠️ Meno righe tradotte del lotto richiesto: il confronto con Ollama sarà parziale.');
}

/* ── Traduzione a batch ──────────────────────────────────────────────────── */
const SYSTEM = [
  'Sei un traduttore professionale di videogiochi. Traduci in ITALIANO le battute',
  'di Danganronpa: Trigger Happy Havoc (visual novel Spike Chunsoft): dialogo',
  'parlato, tono colloquiale naturale, niente calchi dall\'inglese.',
  'REGOLE INVIOLABILI:',
  '1. Ogni tag <CLT ...> o <CLT> va preservato ESATTO, nella stessa posizione logica.',
  '2. Rispondi SOLO con le traduzioni numerate, una per riga: «1. …», «2. …».',
  '3. Stesso numero di righe dell\'input, stessi numeri.',
  '4. Non tradurre i nomi propri (Makoto, Monokuma, Hope\'s Peak Academy resta tale).',
].join('\n');

const CHUNK = 20;
let inTok = 0, outTok = 0;
const risultati = new Map();

async function traduciBatch(batch, tentativo = 1) {
  const prompt = batch.map((r, i) => `${i + 1}. ${r.original}`).join('\n');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4096, system: SYSTEM, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  inTok += data.usage?.input_tokens || 0;
  outTok += data.usage?.output_tokens || 0;
  const testo = (data.content || []).map(c => c.text || '').join('');
  const mappa = new Map();
  for (const m of testo.matchAll(/^\s*(\d+)\.\s*(.+)$/gm)) mappa.set(Number(m[1]), m[2].trim());
  // Un batch che torna con la metà delle righe non si accetta in silenzio:
  // o si riprova una volta, o ci si ferma e si dice quanto manca.
  if (mappa.size < batch.length && tentativo === 1) return traduciBatch(batch, 2);
  return mappa;
}

const inizio = Date.now();
for (let i = 0; i < lotto.length; i += CHUNK) {
  const batch = lotto.slice(i, i + CHUNK);
  const mappa = await traduciBatch(batch);
  batch.forEach((r, j) => {
    const trad = mappa.get(j + 1);
    if (trad) risultati.set(r, trad);
  });
  process.stdout.write(`\r${Math.min(i + CHUNK, lotto.length)}/${lotto.length}…`);
}
console.log(` fatto in ${((Date.now() - inizio) / 1000).toFixed(0)}s`);

/* ── Output ─────────────────────────────────────────────────────────────── */
const mancate = lotto.length - risultati.size;
if (mancate > 0) console.log(`⚠️ ${mancate} battute senza risposta valida dal modello: nel file restano vuote.`);

const dir = dirname(file);
const esc = s => String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const md = [
  `# Lotto di prova DR1 — ${MODEL} — ${new Date().toISOString().slice(0, 10)}`,
  '',
  `${lotto.length} battute scelte lungo tutto l'arco del gioco. Da leggere con una domanda sola:`,
  `**quale colonna suona come italiano scritto da una persona?** («il tipo dell'eroe» era Ollama.)`,
  '',
  '| # | Inglese | Ollama (locale) | ' + MODEL + ' |',
  '|---|---------|-----------------|------|',
  ...lotto.map((r, i) =>
    `| ${i + 1} | ${esc(r.original)} | ${esc(r.translated) || '—'} | ${esc(risultati.get(r)) || '⚠️ vuota'} |`),
].join('\n');
writeFileSync(join(dir, 'lotto-prova.md'), md + '\n');
writeFileSync(join(dir, 'lotto-prova.json'), JSON.stringify(
  lotto.map((r, i) => ({ n: i + 1, file: r.file, index: r.index, original: r.original, ollama: r.translated || null, cloud: risultati.get(r) || null })),
  null, 1) + '\n');

/* Costo reale dai token dell'API (listino 10/08/2026 — ridatare prima di fidarsi). */
const LISTINO = {
  'claude-haiku-4-5-20251001': [1, 5],
  'claude-sonnet-5': [2, 10],
  'claude-opus-5': [5, 25],
};
const [pi, po] = LISTINO[MODEL] || [0, 0];
const costo = (inTok / 1e6) * pi + (outTok / 1e6) * po;
console.log(`\nToken: ${inTok} in · ${outTok} out${pi ? ` → costo reale ≈ $${costo.toFixed(3)}` : ' (modello fuori listino: costo non calcolato)'}`);
console.log(`Scritti:\n  ${join(dir, 'lotto-prova.md')}   ← da LEGGERE\n  ${join(dir, 'lotto-prova.json')}`);
console.log('\nIl checkpoint NON è stato toccato.');
