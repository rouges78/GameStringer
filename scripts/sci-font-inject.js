#!/usr/bin/env node
/**
 * Iniezione dei glifi ACCENTATI nei font Sierra SCI.
 *
 * Perché (05/08/2026, Larry 3): i 6 font del gioco si fermano a 128 caratteri,
 * quindi «è à ù» non esistono. Ma la sonda ha MISURATO che sopra le vocali
 * a/e/o/u ci sono 2 righe libere anche nei font di dialogo: l'accento ci sta.
 * Quindi invece di scrivere «perche'» si generano i glifi veri dalle lettere
 * che già ci sono, e si patcha la risorsa font col canale esterno (<num>.FON),
 * lo stesso già provato in gioco per i testi.
 *
 * COME: il font viene RISCRITTO con numChars esteso (128 → 256) e i glifi
 * accentati inseriti agli indici latin1 (à=224, è=232, é=233, ì=236, ò=242,
 * ù=249…). Gli slot non usati puntano a un glifo vuoto: un font con offset
 * penzolanti farebbe crashare il renderer.
 *
 * ⚠️ LA «ì» È UN CASO A PARTE: la «i» non ha righe libere perché ha il
 * PUNTINO — l'accento non ci va sopra, SOSTITUISCE il puntino. Trattarla come
 * le altre produrrebbe un glifo tagliato (ed è l'errore che ha fatto sbagliare
 * il primo verdetto della sonda).
 *
 * Uso:
 *   node scripts/sci-font-inject.js "<gioco>" --fonts 0,1,4,7,9        (scrittura)
 *   node scripts/sci-font-inject.js "<gioco>" --fonts 0 --preview       (solo disegno a schermo)
 *   node scripts/sci-font-inject.js "<gioco>" --remove                  (toglie le patch .FON)
 */
const fs = require('fs');
const path = require('path');
const { decomprimi } = require('./lib/sci-decompress');

const TIPO_FONT = 7;
const EXT_FONT = 'FON';

// Lettera base → codice latin1 del glifo accentato da generare.
// 'grave'/'acuto' = verso dell'accento; 'sostituisci' = la i, che perde il puntino.
const DA_GENERARE = [
  { base: 'a', code: 224, accento: 'grave' },
  { base: 'e', code: 232, accento: 'grave' },
  { base: 'e', code: 233, accento: 'acuto' },
  { base: 'i', code: 236, accento: 'grave', sostituisciPuntino: true },
  { base: 'o', code: 242, accento: 'grave' },
  { base: 'u', code: 249, accento: 'grave' },
  { base: 'A', code: 192, accento: 'grave' },
  { base: 'E', code: 200, accento: 'grave' },
  { base: 'E', code: 201, accento: 'acuto' },
  { base: 'O', code: 210, accento: 'grave' },
  { base: 'U', code: 217, accento: 'grave' },
];

const argv = process.argv.slice(2);
const gameDir = argv.find(a => !a.startsWith('--'));
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const soloPreview = argv.includes('--preview');
const modoRemove = argv.includes('--remove');
const listaFont = (opt('fonts') || '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));

if (!gameDir || !fs.existsSync(gameDir)) {
  console.error('Uso: node scripts/sci-font-inject.js "<gioco>" --fonts 0,1,4 [--preview] | --remove');
  process.exit(2);
}
const REGISTRO = path.join(gameDir, 'GameStringer_fonts.txt');

if (modoRemove) {
  if (!fs.existsSync(REGISTRO)) { console.log('Nessun registro font: niente da rimuovere.'); process.exit(0); }
  let n = 0;
  for (const f of fs.readFileSync(REGISTRO, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)) {
    const p = path.join(gameDir, f);
    if (fs.existsSync(p)) { fs.unlinkSync(p); n++; }
  }
  fs.unlinkSync(REGISTRO);
  console.log(`🧹 Rimosse ${n} patch font. I font originali non erano stati toccati.`);
  process.exit(0);
}
if (!listaFont.length) { console.error('Serve --fonts con i numeri dei font (es. --fonts 0,1,4,7,9)'); process.exit(2); }

// ── lettura risorse ─────────────────────────────────────────────────────────
const trova = (nome) => {
  const hit = fs.readdirSync(gameDir).find(v => v.toLowerCase() === nome.toLowerCase());
  return hit ? path.join(gameDir, hit) : null;
};
const mapPath = trova('RESOURCE.MAP');
if (!mapPath) { console.error('❌ RESOURCE.MAP non trovato.'); process.exit(1); }
const volumi = fs.readdirSync(gameDir).filter(v => /^resource\.\d{3}$/i.test(v))
  .map(v => ({ num: parseInt(v.slice(-3), 10), path: path.join(gameDir, v) }));

const map = fs.readFileSync(mapPath);
const viste = new Set();
const fontRes = new Map();
for (let p = 0; p + 6 <= map.length; p += 6) {
  const w = map.readUInt16LE(p);
  if (w === 0xffff) break;
  const d = map.readUInt32LE(p + 2);
  const tipo = (w >> 11) & 0x1f, numero = w & 0x7ff;
  const k = `${tipo}:${numero}`;
  if (viste.has(k)) continue;   // dedup: la mappa ha versioni accodate
  viste.add(k);
  if (tipo === TIPO_FONT) fontRes.set(numero, { volume: (d >> 26) & 0x3f, offset: d & 0x3ffffff });
}

const fdVol = new Map();
for (const v of volumi) fdVol.set(v.num, fs.openSync(v.path, 'r'));

function leggiFont(numero) {
  const r = fontRes.get(numero);
  if (!r) return null;
  const fd = fdVol.get(r.volume);
  const h = Buffer.alloc(8);
  fs.readSync(fd, h, 0, 8, r.offset);
  const comp = h.readUInt16LE(2), dec = h.readUInt16LE(4), met = h.readUInt16LE(6);
  const src = Buffer.alloc(comp);
  fs.readSync(fd, src, 0, comp, r.offset + 8);
  const d = decomprimi(src, dec, met);
  return d.dati.subarray(0, d.scritti);
}

// ── modello del font ────────────────────────────────────────────────────────
function parseFont(buf) {
  const testa = buf.readUInt16LE(0);
  const numChars = buf.readUInt16LE(2);
  const heightMax = buf.readUInt16LE(4);
  const glifi = [];
  for (let i = 0; i < numChars; i++) {
    const off = buf.readUInt16LE(6 + i * 2);
    const w = buf[off], h = buf[off + 1];
    const perRiga = Math.ceil(w / 8);
    const righe = [];
    for (let y = 0; y < h; y++) {
      const riga = [];
      for (let b = 0; b < perRiga; b++) riga.push(buf[off + 2 + y * perRiga + b] || 0);
      righe.push(riga);
    }
    glifi.push({ w, h, righe });
  }
  return { testa, numChars, heightMax, glifi };
}

const setPixel = (g, x, y, on) => {
  if (y < 0 || y >= g.h || x < 0 || x >= g.w) return;
  const b = x >> 3, m = 0x80 >> (x & 7);
  if (on) g.righe[y][b] |= m; else g.righe[y][b] &= ~m & 0xff;
};
const getPixel = (g, x, y) => {
  if (y < 0 || y >= g.h || x < 0 || x >= g.w) return 0;
  return (g.righe[y][x >> 3] & (0x80 >> (x & 7))) ? 1 : 0;
};

/** Prima riga con almeno un pixel acceso (dove comincia la lettera). */
function primaRigaPiena(g) {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (getPixel(g, x, y)) return y;
  return -1;
}

/**
 * Genera il glifo accentato dalla lettera base.
 * grave = `\`  (alto a sinistra → basso a destra) · acuto = `/`
 * Per la «i»: si CANCELLA il puntino e si disegna l'accento al suo posto.
 */
function generaAccentato(base, accento, sostituisciPuntino) {
  const g = { w: base.w, h: base.h, righe: base.righe.map(r => r.slice()) };
  const inizio = primaRigaPiena(g);
  if (inizio < 0) return null;

  let rigaAccento, righeDisponibili;
  if (sostituisciPuntino) {
    // La «i»: il puntino è il blocco staccato in cima. Lo si spegne e si usa
    // quella riga per l'accento — così non serve spazio libero.
    // Trova la fine del puntino: prima riga vuota dopo l'inizio.
    let yFineP = inizio;
    while (yFineP < g.h) {
      let vuota = true;
      for (let x = 0; x < g.w; x++) if (getPixel(g, x, yFineP)) { vuota = false; break; }
      if (vuota) break;
      yFineP++;
    }
    for (let y = inizio; y < yFineP; y++) for (let x = 0; x < g.w; x++) setPixel(g, x, y, false);
    rigaAccento = inizio;
    // ⚠️ Dopo aver cancellato il puntino lo spazio utile NON è solo la sua riga:
    // c'è anche lo stacco vuoto fra puntino e asta. Contando solo il puntino
    // ripiegavo sull'accento piatto pur avendo posto per la diagonale (visto
    // nell'anteprima: «ì» con accento staccato e storto).
    let yAsta = inizio;
    while (yAsta < g.h) {
      let vuota = true;
      for (let x = 0; x < g.w; x++) if (getPixel(g, x, yAsta)) { vuota = false; break; }
      if (!vuota) break;
      yAsta++;
    }
    righeDisponibili = Math.max(1, yAsta - inizio);
  } else {
    if (inizio < 1) return null;          // nessuno spazio sopra: non forzare
    righeDisponibili = inizio;            // righe vuote in cima
    rigaAccento = inizio - righeDisponibili;
  }

  // ⚠️ CORREZIONE dopo l'anteprima (05/08/2026): la prima versione disegnava
  // sia il grave sia l'acuto come una barretta orizzontale — «è» ed «é»
  // venivano IDENTICI, e in italiano la differenza conta (perché / cioè).
  // Con 2 righe si fa una diagonale vera: grave «\», acuto «/».
  // Con 1 riga sola si ripiega sulla posizione: grave spostato a sinistra,
  // acuto a destra — distinguibili anche se piatti.
  // Centro dell'accento: sui PIXEL VERI della lettera, non su w/2. Nella «i»
  // l'asta è spostata a destra e l'accento risultava sbilenco (visto in anteprima).
  let xMin = g.w, xMax = -1;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (getPixel(g, x, y)) { if (x < xMin) xMin = x; if (x > xMax) xMax = x; }
  }
  const centro = xMax >= 0 ? Math.round((xMin + xMax) / 2) : Math.floor(g.w / 2);
  const cx = Math.min(Math.max(1, centro), Math.max(1, g.w - 2));
  if (righeDisponibili >= 2) {
    const yAlto = rigaAccento, yBasso = rigaAccento + 1;
    if (accento === 'grave') {            // «\» scende da sinistra a destra
      setPixel(g, cx - 1, yAlto, true);
      setPixel(g, cx, yBasso, true);
      setPixel(g, cx + 1, yBasso, true);
    } else {                              // «/» sale da sinistra a destra
      setPixel(g, cx + 1, yAlto, true);
      setPixel(g, cx, yBasso, true);
      setPixel(g, cx - 1, yBasso, true);
    }
  } else {
    const y = rigaAccento;
    if (accento === 'grave') {            // piatto, spostato a SINISTRA
      setPixel(g, cx - 1, y, true);
      setPixel(g, cx, y, true);
    } else {                              // piatto, spostato a DESTRA
      setPixel(g, cx + 1, y, true);
      setPixel(g, cx + 2 < g.w ? cx + 2 : cx, y, true);
    }
  }
  return g;
}

/** Riserializza il font (numChars esteso, offset ricalcolati). */
function serializza(f, nuovoNumChars) {
  const n = nuovoNumChars;
  const testaLen = 6 + n * 2;
  const corpi = [];
  const offsets = new Array(n);
  let cursore = testaLen;
  const vuoto = { w: 0, h: 0, righe: [] };

  for (let i = 0; i < n; i++) {
    const g = f.glifi[i] || vuoto;
    offsets[i] = cursore;
    const perRiga = Math.ceil(g.w / 8);
    const b = Buffer.alloc(2 + perRiga * g.h);
    b[0] = g.w; b[1] = g.h;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < perRiga; x++) b[2 + y * perRiga + x] = g.righe[y][x] || 0;
    corpi.push(b);
    cursore += b.length;
    if (cursore > 0xffff) throw new Error('font oltre 64 KB: gli offset sono a 16 bit');
  }

  const out = Buffer.alloc(cursore);
  out.writeUInt16LE(f.testa, 0);
  out.writeUInt16LE(n, 2);
  out.writeUInt16LE(f.heightMax, 4);
  for (let i = 0; i < n; i++) out.writeUInt16LE(offsets[i], 6 + i * 2);
  let p = testaLen;
  for (const b of corpi) { b.copy(out, p); p += b.length; }
  return out;
}

function disegna(g, etichetta) {
  console.log(`      ${etichetta} (${g.w}x${g.h})`);
  for (let y = 0; y < g.h; y++) {
    let s = '        ';
    for (let x = 0; x < g.w; x++) s += getPixel(g, x, y) ? '█' : '·';
    console.log(s);
  }
}

// ── esecuzione ──────────────────────────────────────────────────────────────
const scritte = [];
let totGlifi = 0, fontOk = 0, fontKo = 0;

for (const num of listaFont) {
  let buf;
  try { buf = leggiFont(num); } catch (e) { console.log(`font.${num}: ⛔ ${e.message}`); fontKo++; continue; }
  if (!buf) { console.log(`font.${num}: ⛔ risorsa non trovata`); fontKo++; continue; }

  const f = parseFont(buf);
  console.log(`\nfont.${String(num).padStart(3, '0')}: ${f.numChars} caratteri, altezza ${f.heightMax}`);

  let generati = 0, saltati = [];
  for (const spec of DA_GENERARE) {
    const codeBase = spec.base.charCodeAt(0);
    const base = f.glifi[codeBase];
    if (!base || !base.w) { saltati.push(`${spec.base}(base assente)`); continue; }
    const g = generaAccentato(base, spec.accento, spec.sostituisciPuntino);
    if (!g) { saltati.push(`${String.fromCharCode(spec.code)}(niente spazio)`); continue; }
    f.glifi[spec.code] = g;
    generati++;
    // In anteprima si mostrano TUTTI i glifi generati: quello che non si vede
    // non si può giudicare (la «ì», il caso delicato, era fuori dai primi 3).
    if (soloPreview) disegna(g, `${String.fromCharCode(spec.code)} (da «${spec.base}», ${spec.accento}${spec.sostituisciPuntino ? ', puntino sostituito' : ''})`);
  }

  console.log(`   generati ${generati}/${DA_GENERARE.length} glifi accentati` +
    (saltati.length ? ` · saltati: ${saltati.join(', ')}` : ''));
  totGlifi += generati;

  if (soloPreview) { fontOk++; continue; }
  if (!generati) { console.log('   ⚠️ nessun glifo generato: font NON patchato (meglio invariato che rotto)'); fontKo++; continue; }

  try {
    const nuovo = serializza(f, 256);
    const patch = Buffer.concat([Buffer.from([TIPO_FONT, 0]), nuovo]);
    const dest = path.join(gameDir, `${String(num).padStart(3, '0')}.${EXT_FONT}`);
    fs.writeFileSync(dest, patch);
    scritte.push(path.basename(dest));
    fontOk++;
    console.log(`   ✅ ${path.basename(dest)} (${patch.length} byte, 128 → 256 caratteri)`);
  } catch (e) {
    console.log(`   ❌ serializzazione fallita: ${e.message}`);
    fontKo++;
  }
}

if (!soloPreview && scritte.length) {
  fs.writeFileSync(REGISTRO, scritte.join('\n') + '\n');
  console.log(`\n📊 ${fontOk} font patchati, ${fontKo} falliti · ${totGlifi} glifi generati`);
  console.log(`📝 Registro: ${REGISTRO}`);
  console.log('\n▶️  PROVA: i testi tradotti con accenti veri devono mostrarli a schermo.');
  console.log('   Se compaiono glifi sbagliati o il gioco crasha: --remove e si torna indietro.');
} else if (soloPreview) {
  console.log('\n(anteprima: nessun file scritto)');
}
for (const fd of fdVol.values()) fs.closeSync(fd);
