#!/usr/bin/env node
/**
 * unity-loc-probe.js — sonda SOLA LETTURA della localizzazione di un gioco Unity.
 *
 * Nata il 12/09/2026 su Fran Bow (Unity 2021.3.16f1, Mono, app Steam 362680),
 * per rispondere PRIMA di tradurre alle domande che decidono il metodo:
 *
 *  1. I font TextMeshPro del gioco hanno le lettere della lingua di arrivo?
 *     Un atlante SDF contiene solo i glifi scelti al momento del build: se manca
 *     «ì», in gioco si vede un quadrato e nessuna traduzione lo aggiusta.
 *  2. Dove stanno le traduzioni esistenti, e com'è fatto il testo?
 *
 * Non modifica nulla e non deserializza: cerca pattern di byte.
 *  - Tabelle font TMP: voci TMP_Character consecutive da 16 byte
 *    (m_ElementType=1 · m_Unicode · m_GlyphIndex · m_Scale=1.0f).
 *  - Array di lingue: int32 = 6 seguito da 6 stringhe Unity (int32 lunghezza +
 *    UTF-8, allineate a 4 byte).
 * L'ordine delle colonne NON viene assunto: si ricava contando in ogni colonna
 * parole tipiche di ciascuna lingua.
 *
 * Limite noto: un font con atlante dinamico può avere la tabella vuota nel file,
 * e allora qui non compare. Su Fran Bow il russo si vede in gioco ma nessuna
 * tabella trovata contiene cirillico: i font elencati non sono per forza tutti.
 *
 * Uso: node scripts/unity-loc-probe.js "<gioco>/<Nome>_Data" ["glifi da cercare"]
 *      (glifi di default: le accentate italiane e l'apostrofo tipografico)
 */
const fs = require('fs');
const path = require('path');

const dataDir = process.argv[2];
if (!dataDir || !fs.existsSync(path.join(dataDir, 'globalgamemanagers'))) {
  console.error('Uso: node scripts/unity-loc-probe.js "<gioco>/<Nome>_Data" ["glifi"]');
  process.exit(2);
}
const glyphs = [...(process.argv[3] || 'àèéìòùÀÈÉÌÒÙ’')];

// File serializzati: *.assets e i file di scena levelN (senza estensione).
// .resS e .resource sono texture e audio: niente testo né tabelle font.
const serialized = fs.readdirSync(dataDir)
  .filter(f => f.endsWith('.assets') || /^level\d+$/.test(f))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

const ggm = fs.readFileSync(path.join(dataDir, 'globalgamemanagers'));
const version = ggm.toString('latin1').match(/20\d\d\.\d+\.\d+[abfp]\d+/);
console.log(`Unity ${version ? version[0] : '(versione non trovata)'} · ${serialized.length} file serializzati`);

// Parole che compaiono quasi solo nella lingua indicata: servono a riconoscere
// le colonne e a capire quali file contengono testo non inglese.
const MARKERS = { en: ' you ', fr: ' vous ', de: ' nicht ', es: ' pero ', pt: 'você', ru: ' не ' };

function countOf(buf, needle) {
  let n = 0;
  for (let p = buf.indexOf(needle); p !== -1; p = buf.indexOf(needle, p + needle.length)) n++;
  return n;
}

// ── Tabelle font TMP ────────────────────────────────────────────────────────
const FLOAT_ONE = Buffer.from([0x00, 0x00, 0x80, 0x3f]);
function fontTables(buf) {
  const tables = [];
  let run = [], prev = -1, runStart = -1;
  const close = () => { if (run.length >= 60) tables.push({ offset: runStart, chars: new Set(run) }); };
  for (let p = buf.indexOf(FLOAT_ONE); p !== -1; p = buf.indexOf(FLOAT_ONE, p + 1)) {
    const s = p - 12;
    if (s < 0 || buf.readUInt32LE(s) !== 1) continue;
    const u = buf.readUInt32LE(s + 4);
    if (u > 0x2ffff) continue;
    if (s === prev + 16) run.push(u);
    else { close(); run = [u]; runStart = s; }
    prev = s;
  }
  close();
  // Una tabella vera contiene quasi tutto l'ASCII stampabile; il resto è rumore
  // (1.0f come scala di un transform capita ovunque).
  return tables.filter(t => {
    t.ascii = 0;
    for (let c = 0x20; c < 0x7f; c++) if (t.chars.has(c)) t.ascii++;
    return t.ascii >= 80;
  });
}

console.log(`\n== 1. Tabelle font TextMeshPro · glifi cercati: ${glyphs.join(' ')} ==`);
let tableCount = 0;
const textFiles = [];
for (const f of serialized) {
  const buf = fs.readFileSync(path.join(dataDir, f));
  for (const t of fontTables(buf)) {
    tableCount++;
    const missing = glyphs.filter(g => !t.chars.has(g.codePointAt(0)));
    const has = ch => (t.chars.has(ch.codePointAt(0)) ? 'sì' : 'no');
    console.log(`${f} @0x${t.offset.toString(16)}: ${t.chars.size} caratteri (ASCII ${t.ascii}/95)` +
      ` · mancanti: ${missing.join(' ') || 'nessuno'} · ñ=${has('ñ')} ő=${has('ő')} Ж=${has('Ж')}`);
  }
  const counts = {};
  for (const [lang, word] of Object.entries(MARKERS)) counts[lang] = countOf(buf, Buffer.from(word));
  if (Object.values(counts).some(Boolean)) textFiles.push({ f, counts });
}
console.log(`tabelle trovate: ${tableCount}`);

// ── Dove sta il testo ───────────────────────────────────────────────────────
console.log('\n== 2. File con testo, per lingua (occorrenze delle parole-spia) ==');
const nonEnglish = textFiles.filter(t => Object.entries(t.counts).some(([l, n]) => l !== 'en' && n > 0));
for (const t of nonEnglish) console.log(`${t.f}: ${Object.entries(t.counts).map(([l, n]) => `${l}=${n}`).join(' ')}`);
console.log(`file con testo non inglese: ${nonEnglish.length} · file con solo inglese: ${textFiles.length - nonEnglish.length}`);

// ── Array di lingue in resources.assets ─────────────────────────────────────
const resPath = path.join(dataDir, 'resources.assets');
if (!fs.existsSync(resPath)) { console.log('\nresources.assets assente: sezione 3 saltata'); process.exit(0); }
const res = fs.readFileSync(resPath);
const dec = new TextDecoder('utf-8', { fatal: true });

function unityString(buf, p) {
  if (p + 4 > buf.length) return null;
  const len = buf.readUInt32LE(p);
  if (len > 20000 || p + 4 + len > buf.length) return null;
  const bytes = buf.subarray(p + 4, p + 4 + len);
  if (bytes.includes(0)) return null;
  let text;
  try { text = dec.decode(bytes); } catch { return null; }
  const end = p + 4 + len;
  return { text, next: end + ((4 - (end % 4)) % 4) };
}

const SIX = Buffer.from([6, 0, 0, 0]);
const arrays = [];
for (let p = res.indexOf(SIX); p !== -1; p = res.indexOf(SIX, p + 1)) {
  if (p % 4) continue;
  const vals = [];
  let q = p + 4;
  for (let i = 0; i < 6; i++) {
    const s = unityString(res, q);
    if (!s) break;
    vals.push(s.text);
    q = s.next;
  }
  // Almeno 4 valori pieni e 3 diversi: scarta liste di sei stringhe uguali.
  if (vals.length === 6 && vals.filter(Boolean).length >= 4 && new Set(vals).size >= 3) arrays.push(vals);
}
console.log('\n== 3. resources.assets: array di 6 stringhe (una per lingua) ==');
console.log(`array trovati: ${arrays.length}`);
if (!arrays.length) process.exit(0);

const matrix = Array.from({ length: 6 }, () => ({}));
for (const vals of arrays) {
  vals.forEach((v, i) => {
    for (const [lang, word] of Object.entries(MARKERS)) if (v.includes(word)) matrix[i][lang] = (matrix[i][lang] || 0) + 1;
  });
}
const slotOf = lang => matrix.reduce((best, row, i) => ((row[lang] || 0) > (matrix[best][lang] || 0) ? i : best), 0);
matrix.forEach((row, i) => console.log(`colonna ${i}: ${Object.keys(MARKERS).map(l => `${l}=${row[l] || 0}`).join(' ')}`));
const order = Object.keys(MARKERS).map(l => [slotOf(l), l]).sort((a, b) => a[0] - b[0]).map(([i, l]) => `${i}=${l}`);
console.log(`ordine ricavato: ${order.join(' · ')}`);

const EN = slotOf('en'), FR = slotOf('fr'), RU = slotOf('ru');
// Non ogni array di 6 stringhe è una frase: passano anche liste di keyword shader
// (UNITY_UI_ALPHACLIP…). Una riga di localizzazione vera ha cirillico nella colonna
// russa, oppure la stessa stringa dell'inglese (nomi propri, numeri).
const hasRussian = (matrix[RU].ru || 0) > 0;
const rows = hasRussian ? arrays.filter(v => /\p{Script=Cyrillic}/u.test(v[RU]) || v[RU] === v[EN]) : arrays;
const kept = new Set(rows);
const noise = arrays.filter(v => !kept.has(v));
console.log(hasRussian
  ? `righe di localizzazione: ${rows.length} · scartati come non-frasi: ${noise.length}  es: ${noise.slice(0, 4).map(v => JSON.stringify(v[EN])).join(' ')}`
  : `righe di localizzazione: ${rows.length} (nessuna colonna russa riconosciuta: nessun filtro)`);

const en = rows.map(v => v[EN]).filter(Boolean);
const chars = en.reduce((n, s) => n + [...s].length, 0);
const words = en.reduce((n, s) => n + s.split(/\s+/).filter(Boolean).length, 0);
const lens = en.map(s => [...s].length).sort((a, b) => a - b);
const at = (xs, q) => xs[Math.floor(xs.length * q)];
console.log(`\ninglese: ${chars} caratteri, ${words} parole (stima grezza ~${Math.floor(chars / 4)} token)`);
console.log(`lunghezza: mediana ${at(lens, 0.5)} · 95° percentile ${at(lens, 0.95)} · massimo ${lens[lens.length - 1]}`);

const FEATURES = {
  'tag rich text <…>': /<[a-zA-Z/][^>]*>/, 'segnaposto {…}': /\{[^}]*\}/, 'printf %s %d': /%[sdif0-9]/,
  'a capo': /\n/, 'tra quadre […]': /\[[^\]]*\]/, 'tra asterischi *…*': /\*[^*]+\*/,
};
for (const [name, rx] of Object.entries(FEATURES)) {
  const hits = en.filter(s => rx.test(s));
  console.log(`  ${name}: ${hits.length}${hits.length ? `  es: ${JSON.stringify(hits[0].slice(0, 90))}` : ''}`);
}
const ratios = rows
  .filter(v => [...v[EN]].length >= 20)
  .map(v => [...v[FR]].length / [...v[EN]].length)
  .sort((a, b) => a - b);
console.log(`francese/inglese (stringhe da 20 caratteri in su): mediana ${at(ratios, 0.5).toFixed(2)} · 95° percentile ${at(ratios, 0.95).toFixed(2)}`);

// Stessa regola di looks_like_game_text in src-tauri/src/commands/unity_assets.rs,
// il filtro dello scan euristico: più di 5 lettere, almeno uno spazio, e meno del
// 40% di simboli sul numero di BYTE (text.len() in Rust conta byte UTF-8).
const SAFE_PUNCT = new Set([...'.,!?:;\'-"()[]{}']);
const looksLikeGameText = s => {
  const alpha = [...s].filter(c => /\p{Alphabetic}/u.test(c)).length;
  const symbols = [...s].filter(c => !/[\p{Alphabetic}\p{N}\p{White_Space}]/u.test(c) && !SAFE_PUNCT.has(c)).length;
  return alpha > 5 && s.includes(' ') && symbols / Buffer.byteLength(s) < 0.4;
};
const dropped = en.filter(s => !looksLikeGameText(s));
console.log(`valori inglesi che looks_like_game_text (unity_assets.rs) scarterebbe: ${dropped.length} su ${en.length}` +
  `  es: ${dropped.slice(0, 6).map(s => JSON.stringify(s)).join(' ')}`);
