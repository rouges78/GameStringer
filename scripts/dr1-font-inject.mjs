/**
 * INIEZIONE GLIFI ACCENTATI nel font di Danganronpa DR1.
 *
 * Formato decifrato il 10/08/2026 dalle sonde dr1-font-probe.mjs e
 * dr1-font-decode.mjs (memoria: danganronpa-font-formato). In breve:
 *   font.pak (in dr1_data_us.wad) = PAK contratto C con 4 sotto-file:
 *   [0] atlante dialoghi · [1] tabella SpFt dialoghi (h=39)
 *   [2] atlante grande   · [3] tabella SpFt grande   (h=75)
 *   atlante = header 1056 B + 1024×1024 a 8 bit INDICIZZATI, righe DAL BASSO
 *   palette bianco+alpha nell'header · indice 255 = sfondo trasparente
 *   record glifo = 16 B: u16 codepoint · u16 x · u16 y · u16 w · u16 h
 *   ⭐ il glifo sta a  x = record.x − 14  (misurato, 39/40 lettere)
 *
 * STRATEGIA — la più conservativa possibile, scelta dopo aver MISURATO:
 *   · l'atlante ha 676 righe libere in fondo ⇒ i glifi nuovi si disegnano in
 *     area VERGINE: nessun pixel dei caratteri esistenti viene toccato.
 *   · si RIUSANO record di caratteri inutili in italiano (katakana/kanji)
 *     invece di aggiungerne ⇒ nessuna dimensione cambia, a nessun livello:
 *     tabella, atlante, PAK e WAD restano lunghi uguali e si patcha in place.
 *   · gli accenti si RICAVANO da à/é che Spike ha già messo nel font
 *     (à − a = accento grave, nel loro stile) invece di inventarli.
 *
 * MODI (in ordine, ognuno è il gate del successivo):
 *   --roundtrip   parse+rebuild SENZA modifiche: i byte devono essere identici.
 *                 È il test che mancava al parser .lin e che è costato due WAD
 *                 corrotti il 09/08. Se fallisce, non si prosegue.
 *   --anteprima   mostra donatori scelti, coordinate e i glifi DISEGNATI in
 *                 ASCII-art. Non scrive niente.
 *   --applica     scrive. Su COPIA, con verifica PRIMA di sostituire.
 *
 * USO:
 *   node scripts/dr1-font-inject.mjs --gioco "C:/…/Danganronpa…" --roundtrip
 *   node scripts/dr1-font-inject.mjs --gioco "…" --anteprima
 */
import { openSync, readSync, closeSync, existsSync, statSync } from 'fs';
import { join } from 'path';

function arg(n, d = null) { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; }
const has = (n) => process.argv.includes(n);
const GIOCO = arg('--gioco');
if (!GIOCO || !existsSync(GIOCO)) { console.error('Manca o non esiste --gioco <cartella del gioco>'); process.exit(2); }

const SCARTO_X = -14;          // misurato, vedi sonda 2
const HDR_ATLANTE = 1056;      // header + palette
const IDX_SFONDO = 255;

const leggi = (fd, pos, len) => { const b = Buffer.alloc(len); readSync(fd, b, 0, len, pos); return b; };

// ─────────────────────────────────────────────────── WAD → font.pak
/**
 * @param percorso quale WAD leggere. Serve poter puntare anche al `.gsbackup`:
 * il rebuild (String it!) legge DA LÌ e ricopia verbatim tutte le entry che non
 * sono .lin — font compreso. Se il backup tiene il font originale, ogni
 * traduzione futura riporta i ≡ senza un errore e senza un avviso: l'utente
 * rilancia «String it!» e gli accenti spariscono. Va patchato anche quello.
 */
function caricaFontPak(percorso = join(GIOCO, 'dr1_data_us.wad')) {
  if (!existsSync(percorso)) { console.error(`${percorso} non trovato`); process.exit(1); }
  const fd = openSync(percorso, 'r');
  const head = leggi(fd, 0, 16);
  if (head.subarray(0, 4).toString('ascii') !== 'AGAR') { console.error('magic AGAR mancante'); process.exit(1); }
  const extra = head.readUInt32LE(12);
  let pos = 16 + extra;
  const count = leggi(fd, pos, 4).readUInt32LE(0); pos += 4;
  const entries = [];
  for (let i = 0; i < count; i++) {
    const nl = leggi(fd, pos, 4).readUInt32LE(0); pos += 4;
    const name = leggi(fd, pos, nl).toString('utf8'); pos += nl;
    const m = leggi(fd, pos, 16); pos += 16;
    entries.push({ name, size: Number(m.readBigUInt64LE(0)), offset: Number(m.readBigUInt64LE(8)) });
  }
  const dirCount = leggi(fd, pos, 4).readUInt32LE(0); pos += 4;
  for (let d = 0; d < dirCount; d++) {
    const nl = leggi(fd, pos, 4).readUInt32LE(0); pos += 4 + nl;
    const ec = leggi(fd, pos, 4).readUInt32LE(0); pos += 4;
    for (let e = 0; e < ec; e++) { const enl = leggi(fd, pos, 4).readUInt32LE(0); pos += 4 + enl + 1; }
  }
  const dataStart = pos;
  const e = entries.find(x => /\/font\/font\.pak$/i.test(x.name));
  if (!e) { console.error('Dr1/data/us/font/font.pak non trovato'); process.exit(1); }
  const buf = leggi(fd, dataStart + e.offset, e.size);
  closeSync(fd);
  return { buf, nome: e.name, posAssoluta: dataStart + e.offset, percorsoWad: percorso };
}

// ─────────────────────────────────────────────── PAK (contratto C)
function leggiPak(pak) {
  const count = pak.readUInt32LE(0);
  const offs = [];
  for (let i = 0; i < count; i++) offs.push(pak.readUInt32LE(4 + i * 4));
  const parti = offs.map((o, i) => ({ off: o, buf: pak.subarray(o, i + 1 < count ? offs[i + 1] : pak.length) }));
  return { count, offs, parti };
}

/** Ricostruisce il PAK dalle parti. Deve restituire byte identici all'originale
 *  quando le parti non sono state modificate: è il round-trip. */
function scriviPak(originale, parti, offs) {
  const out = Buffer.from(originale);          // conserva header e padding esatti
  parti.forEach((p, i) => p.buf.copy(out, offs[i]));
  return out;
}

/**
 * ⭐ LA MAPPA carattere → indice glifo. Trovata il 10/08 DOPO il secondo
 * fallimento in-game, rileggendo i dati della prima sonda con l'informazione
 * nuova («il gioco non usa il campo codepoint del record»).
 *
 * La sonda aveva segnalato «una corsa di codepoint consecutivi a offset 162».
 * NON erano codepoint: erano INDICI. Infatti 32 + 0x41*2 = 162, cioè la
 * posizione della lettera 'A' in una tabella che parte a 32, indicizzata per
 * codepoint, u16 per voce — e il valore lì è 32, che è esattamente l'indice
 * del record di 'A'. La «corsa» erano gli indici di A,B,C… consecutivi.
 *
 * Cioè: `mappa[codepoint] = indice del glifo`, 0xFFFF = carattere assente
 * (ed è per questo che la zona è quasi tutta ffff: il font copre 323 caratteri
 * su 65536 possibili).
 */
const MAPPA_OFF = 32;
function leggiMappa(b, cp) {
  const p = MAPPA_OFF + cp * 2;
  if (p + 2 > b.length) return null;
  return b.readUInt16LE(p);
}
function scriviMappa(b, cp, idx) {
  const p = MAPPA_OFF + cp * 2;
  if (p + 2 > b.length) return false;
  b.writeUInt16LE(idx, p);
  return true;
}

// ─────────────────────────────────────────────── tabella glifi SpFt
function leggiGlifi(b) {
  const n = b.readUInt32LE(8), off = b.readUInt32LE(12);
  const glifi = [];
  for (let i = 0; i < n; i++) {
    const p = off + i * 16;
    glifi.push({
      i, cp: b.readUInt16LE(p), x: b.readUInt16LE(p + 2), y: b.readUInt16LE(p + 4),
      w: b.readUInt16LE(p + 6), h: b.readUInt16LE(p + 8),
    });
  }
  return { n, off, glifi };
}

// ─────────────────────────────────────────────────────── atlante
function apriAtlante(b) {
  const w = b.readUInt16LE(12), h = b.readUInt16LE(14);
  const inizio = b.length - w * h;
  // palette: 256 entry RGBA, offset scelto col vincolo "sfondo trasparente"
  let pOff = -1;
  for (let off = 0; off + 1024 <= inizio; off++) {
    let bianche = 0;
    for (let i = 0; i < 256; i++) { const p = off + i * 4; if (b[p] === b[p + 1] && b[p + 1] === b[p + 2]) bianche++; }
    if (bianche >= 200 && b[off + IDX_SFONDO * 4 + 3] < 16) { pOff = off; break; }
  }
  const alpha = new Uint8Array(256);
  if (pOff >= 0) for (let i = 0; i < 256; i++) alpha[i] = b[pOff + i * 4 + 3];
  // indice più "pieno" per disegnare: quello con alpha massimo
  let idxPieno = 0, best = -1;
  for (let i = 0; i < 256; i++) if (alpha[i] > best) { best = alpha[i]; idxPieno = i; }
  return {
    w, h, inizio, pOff, alpha, idxPieno,
    // righe memorizzate DAL BASSO: y logico → riga file h-1-y
    get: (x, y) => b[inizio + (h - 1 - y) * w + x],
    set: (x, y, v) => { b[inizio + (h - 1 - y) * w + x] = v; },
    vivo: (x, y) => { const v = b[inizio + (h - 1 - y) * w + x]; return v !== undefined && alpha[v] >= 16; },
  };
}

/** Ritaglia un glifo come matrice di indici, usando la regola misurata. */
function ritaglia(atl, g) {
  const x0 = g.x + SCARTO_X;
  const m = [];
  for (let y = 0; y < g.h; y++) {
    const riga = [];
    for (let x = 0; x < g.w; x++) riga.push(atl.get(x0 + x, g.y + y));
    m.push(riga);
  }
  return m;
}

function disegnaMatrice(m, alpha, titolo) {
  const scala = ' .:-=+*#%@';
  console.log(`   ${titolo}`);
  for (const riga of m) {
    console.log('   │' + riga.map(v => { const a = alpha[v] ?? 0; return a < 16 ? ' ' : scala[Math.min(9, Math.max(1, Math.round(a / 28)))]; }).join('') + '│');
  }
}

// ═══════════════════════════════════════════════════════════ main
const { buf: pakBuf, nome, percorsoWad, posAssoluta } = caricaFontPak();
const pak = leggiPak(pakBuf);
console.log(`${nome} — ${pakBuf.length} byte · ${pak.count} sotto-file\n`);

// ── MODO 1: ROUND-TRIP (il gate di tutto)
// ── VERIFICA DELL'IPOTESI SULLA MAPPA (prima di scriverci dentro)
if (has('--mappa')) {
  for (const idxTab of [1, 3]) {
    const tab = pak.parti[idxTab];
    if (!tab || tab.buf.subarray(0, 4).toString('ascii') !== 'tFpS') continue;
    const t = leggiGlifi(tab.buf);
    console.log(`\n── FONT [${idxTab}]: la mappa a offset ${MAPPA_OFF} è davvero codepoint→indice?`);
    let ok = 0, tot = 0;
    const campione = t.glifi.filter((g, i) => i % 17 === 0 || g.cp === 0x41 || g.cp === 0xe0).slice(0, 20);
    for (const g of campione) {
      const letto = leggiMappa(tab.buf, g.cp);
      const giusto = letto === g.i;
      if (giusto) ok++;
      tot++;
      const ch = g.cp >= 33 && g.cp < 127 ? `'${String.fromCharCode(g.cp)}'` : `U+${g.cp.toString(16).toUpperCase()}`;
      console.log(`   ${ch.padEnd(8)} record #${String(g.i).padStart(3)} · mappa[${g.cp}] = ${letto === 0xffff ? 'ffff (assente)' : letto}  ${giusto ? '✅' : '⛔'}`);
    }
    console.log(`   → ${ok}/${tot} corrispondenze`);
    if (ok === tot) {
      console.log('   ✅ IPOTESI CONFERMATA: mappa[codepoint] = indice del glifo.');
      console.log('      È QUI che il gioco cerca — ecco perché cambiare il codepoint del record non bastava.');
      // e i caratteri che ci servono?
      for (const ch of 'àéóèìòùÀÈÉÌÒÙ') {
        const v = leggiMappa(tab.buf, ch.codePointAt(0));
        console.log(`      ${ch} → ${v === 0xffff ? 'ffff = ASSENTE (il gioco mostra .notdef)' : `indice ${v}`}`);
      }
    } else {
      console.log('   ⛔ ipotesi NON confermata: la mappa è altrove o ha un altro formato.');
    }
  }
}

if (has('--roundtrip')) {
  const ricostruito = scriviPak(pakBuf, pak.parti, pak.offs);
  const identico = ricostruito.equals(pakBuf);
  console.log('── ROUND-TRIP: parse + rebuild SENZA modifiche');
  console.log(`   ${identico ? '✅ BYTE IDENTICI' : '⛔ DIVERSI'} (${pakBuf.length} byte)`);
  if (!identico) {
    let primo = -1;
    for (let i = 0; i < pakBuf.length; i++) if (ricostruito[i] !== pakBuf[i]) { primo = i; break; }
    console.log(`   primo byte diverso a offset ${primo}`);
    console.log('   ⛔ NON PROSEGUIRE: se non so ricostruire ciò che non ho toccato,');
    console.log('      non posso ricostruire ciò che modifico. (Lezione dei 2 WAD corrotti del 09/08.)');
    process.exit(1);
  }
  // controllo positivo: se cambio UN byte, il round-trip DEVE accorgersene
  const sporco = Buffer.from(pakBuf);
  sporco[sporco.length - 1] ^= 0xff;
  console.log(`   controllo positivo (1 byte alterato): ${sporco.equals(pakBuf) ? '⛔ NON RILEVATO — il confronto è cieco' : '✅ rilevato'}`);
  console.log('\n   → il round-trip regge: si può passare all\'anteprima.');
}

// ── MODO 2: ANTEPRIMA
if (has('--anteprima')) {
  const ACCENTI = { 'è': ['e', '`'], 'ì': ['i', '`'], 'ò': ['o', '`'], 'ù': ['u', '`'], 'À': ['A', '`'], 'È': ['E', '`'], 'É': ['E', "'"], 'Ì': ['I', '`'], 'Ò': ['O', '`'], 'Ù': ['U', '`'] };
  for (const idxTab of [1, 3]) {
    const tab = pak.parti[idxTab];
    if (!tab || tab.buf.subarray(0, 4).toString('ascii') !== 'tFpS') continue;
    const atl = apriAtlante(pak.parti[idxTab - 1].buf);
    const t = leggiGlifi(tab.buf);
    console.log(`\n${'═'.repeat(66)}\nFONT [${idxTab}] — ${t.n} glifi, altezza ${t.glifi[0].h}, atlante ${atl.w}×${atl.h}`);
    console.log(`palette a offset ${atl.pOff} · indice "pieno" = ${atl.idxPieno} (alpha ${atl.alpha[atl.idxPieno]})`);

    // spazio vergine
    let ultima = 0;
    for (const g of t.glifi) ultima = Math.max(ultima, g.y + g.h);
    console.log(`ultima riga usata dai glifi: ${ultima} · spazio libero sotto: ${atl.h - ultima} px`);

    // ⭐ L'ACCENTO DI SPIKE: à − a. Si estrae solo se ENTRAMBI esistono.
    const gA = t.glifi.find(g => g.cp === 0xe0);   // à
    const ga = t.glifi.find(g => g.cp === 0x61);   // a
    if (gA && ga) {
      console.log(`\n⭐ ACCENTO RICAVATO DA SPIKE (à − a): à è nel font (glifo #${gA.i}), quindi`);
      console.log('   non inventiamo il disegno dell\'accento, lo copiamo dal loro.');
      disegnaMatrice(ritaglia(atl, gA), atl.alpha, `à  (${gA.w}×${gA.h})`);
      disegnaMatrice(ritaglia(atl, ga), atl.alpha, `a  (${ga.w}×${ga.h})`);
    } else {
      console.log(`\n⚠️ à o a mancanti in questo font (à:${!!gA} a:${!!ga}):`);
      console.log('   qui l\'accento va preso dall\'altro font o disegnato — da decidere, non da improvvisare.');
    }

    // donatori candidati: caratteri inutili in italiano
    const inutile = (cp) => (cp >= 0x3000 && cp <= 0x9fff) || (cp >= 0xff00 && cp <= 0xffef);
    const donatori = t.glifi.filter(g => inutile(g.cp));
    const mancanti = Object.keys(ACCENTI).filter(ch => !t.glifi.some(g => g.cp === ch.codePointAt(0)));
    console.log(`\nglifi mancanti: ${mancanti.join(' ')} (${mancanti.length})`);
    console.log(`donatori disponibili (CJK/fullwidth, inutili in italiano): ${donatori.length}`);
    if (donatori.length < mancanti.length) console.log('   ⚠️ donatori insufficienti: servirà aggiungere record (cambia le dimensioni).');
    else console.log(`   ✅ bastano: si riusano ${mancanti.length} record senza cambiare nessuna dimensione.`);
    console.log(`   primi donatori: ${donatori.slice(0, mancanti.length).map(g => `U+${g.cp.toString(16).toUpperCase()}(#${g.i})`).join(' ')}`);
  }
  console.log('\n⛔ ANTEPRIMA: non è stato scritto niente. Il passo dopo (--applica) va fatto');
  console.log('   su una COPIA del WAD, con verifica PRIMA di sostituire l\'originale.');
}

// ─────────────────────────────────────────────── costruzione dei glifi
/** L'accento di Spike: le righe in cui `à` ha inchiostro e `a` no. */
function estraiAccento(atl, gAcc, gBase) {
  const A = ritaglia(atl, gAcc), B = ritaglia(atl, gBase);
  const righe = [];
  for (let y = 0; y < Math.min(A.length, B.length); y++) {
    const accesaA = A[y].some(v => atl.alpha[v] >= 16);
    const accesaB = B[y].some(v => atl.alpha[v] >= 16);
    if (accesaA && !accesaB) righe.push({ y, riga: A[y] });
  }
  return righe;                       // [{y, riga:[indici]}]
}

/** Prima riga con inchiostro di un glifo (per sapere dove appoggiare l'accento). */
function primaRigaPiena(atl, g) {
  const m = ritaglia(atl, g);
  for (let y = 0; y < m.length; y++) if (m[y].some(v => atl.alpha[v] >= 16)) return y;
  return -1;
}

/** Blocchi verticali di righe piene separati da righe vuote.
 *  Serve per la `i`: il PUNTINO è un blocco staccato sopra l'asta. Se si prende
 *  la prima riga piena come "cima della lettera" si appoggia l'accento sopra il
 *  puntino — che è esattamente l'errore visto in anteprima. */
function blocchi(atl, g) {
  const m = ritaglia(atl, g);
  const out = []; let ini = -1;
  for (let y = 0; y < m.length; y++) {
    const piena = m[y].some(v => atl.alpha[v] >= 16);
    if (piena && ini < 0) ini = y;
    if (!piena && ini >= 0) { out.push([ini, y - 1]); ini = -1; }
  }
  if (ini >= 0) out.push([ini, m.length - 1]);
  return out;
}

/** Ritaglia l'accento alla sua bounding box reale.
 *  ⚠️ Prima usavo la larghezza del glifo `à` (16) come larghezza dell'accento:
 *  centrandolo su una `i` larga 9 finiva fuori asse e tagliato. L'accento va
 *  misurato, non ereditato dal glifo che lo conteneva. */
function ritagliaAccento(atl, righe) {
  let x0 = Infinity, x1 = -1;
  for (const r of righe) r.riga.forEach((v, x) => { if (atl.alpha[v] >= 16) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } });
  if (x1 < 0) return { larg: 0, righe: [] };
  return { larg: x1 - x0 + 1, righe: righe.map(r => ({ y: r.y, riga: r.riga.slice(x0, x1 + 1) })) };
}

if (has('--applica') || has('--prova')) {
  const SOLO_PROVA = has('--prova');
  const ACCENTATE = [
    ['è', 'e'], ['ì', 'i'], ['ò', 'o'], ['ù', 'u'],
    ['À', 'A'], ['È', 'E'], ['É', 'E'], ['Ì', 'I'], ['Ò', 'O'], ['Ù', 'U'],
  ];
  const idxTab = 1, idxAtl = 0;                     // font dei dialoghi
  const atlBuf = pak.parti[idxAtl].buf;
  const tabBuf = pak.parti[idxTab].buf;
  const atl = apriAtlante(atlBuf);
  const t = leggiGlifi(tabBuf);

  const gAcc = t.glifi.find(g => g.cp === 0xe0), gBase = t.glifi.find(g => g.cp === 0x61);
  if (!gAcc || !gBase) { console.error('⛔ à o a non nel font: senza il modello di Spike non si procede.'); process.exit(1); }
  const accento = estraiAccento(atl, gAcc, gBase);
  if (accento.length === 0) { console.error('⛔ accento non estraibile (à e a hanno le stesse righe piene?).'); process.exit(1); }
  const accY0 = accento[0].y, accY1 = accento[accento.length - 1].y;
  console.log(`── ACCENTO estratto da à−a: righe ${accY0}..${accY1} (${accento.length} righe)`);
  console.log(`   la 'a' comincia a riga ${primaRigaPiena(atl, gBase)} → gap accento-lettera = ${primaRigaPiena(atl, gBase) - accY1 - 1} px\n`);
  const GAP = primaRigaPiena(atl, gBase) - accY1 - 1;

  // area vergine: sotto l'ultimo glifo esistente
  let ultimaUsata = 0;
  for (const g of t.glifi) ultimaUsata = Math.max(ultimaUsata, g.y + g.h);
  const yNuovo = ultimaUsata + 4;
  const hGlifo = t.glifi[0].h;
  if (yNuovo + hGlifo > atl.h) { console.error('⛔ non c\'è spazio vergine sufficiente.'); process.exit(1); }

  const inutile = (cp) => (cp >= 0x3000 && cp <= 0x9fff) || (cp >= 0xff00 && cp <= 0xffef);
  const donatori = t.glifi.filter(g => inutile(g.cp));
  const piano = [];
  let xCursore = 2;
  for (const [acc, base] of ACCENTATE) {
    const cpAcc = acc.codePointAt(0);
    if (t.glifi.some(g => g.cp === cpAcc)) { console.log(`   ${acc} già presente, salto`); continue; }
    const gb = t.glifi.find(g => g.cp === base.codePointAt(0));
    if (!gb) { console.log(`   ⚠️ base '${base}' assente: ${acc} non generabile`); continue; }
    const don = donatori[piano.length];
    if (!don) { console.log(`   ⚠️ donatori finiti a ${acc}`); break; }
    // ⭐ la "cima" su cui appoggiare l'accento è quella del CORPO della lettera.
    // Per la `i` il primo blocco è il puntino: va ignorato (e poi cancellato),
    // altrimenti l'accento finisce sopra il puntino invece che al suo posto.
    const bl = blocchi(atl, gb);
    const haPuntino = bl.length >= 2 && (base === 'i' || base === 'I');
    const corpo = haPuntino ? bl[1] : bl[0];
    const cima = corpo ? corpo[0] : primaRigaPiena(atl, gb);
    const serve = accento.length + GAP;
    piano.push({
      acc, cpAcc, base, gb, don,
      x: xCursore, y: yNuovo, w: gb.w, h: hGlifo,
      // l'accento si appoggia sopra il corpo; se non c'è spazio si alza il
      // meno possibile e SI DICE (mai in silenzio)
      accY: Math.max(0, cima - GAP - accento.length),
      stretto: cima < serve,
      // il puntino si cancella fino all'inizio del corpo, misurato — non con
      // una percentuale a occhio, che lasciava un residuo visibile
      tagliaFinoA: haPuntino ? corpo[0] : -1,
    });
    xCursore += gb.w + 2;
  }

  // Il font è già patchato? Allora il piano è vuoto e non si scriverebbe nulla
  // — col rischio di lasciare il .gsbackup vergine e credere di aver finito.
  if (piano.length === 0) {
    console.log('\n⚠️ NESSUN GLIFO DA AGGIUNGERE: le accentate ci sono già (font già patchato).');
    console.log('   Se stai cercando di patchare anche il .gsbackup, prima riporta tutto');
    console.log('   all\'originale con --ripristina e poi rilancia --applica.');
    process.exit(0);
  }

  console.log(`── PIANO: ${piano.length} glifi in area vergine a y=${yNuovo} (ultimo glifo esistente finiva a ${ultimaUsata})`);
  for (const p of piano) {
    console.log(`   ${p.acc} = '${p.base}' + accento · donatore U+${p.don.cp.toString(16).toUpperCase()} (#${p.don.i}) · x=${p.x} w=${p.w}${p.stretto ? ' ⚠️ poco spazio sopra: accento alzato al bordo' : ''}${p.tagliaPuntino ? ' · puntino della i rimosso' : ''}`);
  }

  // ── DISEGNO su copia dei buffer (l'originale non si tocca finché non verifica)
  const atlNuovo = Buffer.from(atlBuf), tabNuovo = Buffer.from(tabBuf);
  const atlW = apriAtlante(atlNuovo);
  for (const p of piano) {
    const src = ritaglia(atl, p.gb);
    const cima = primaRigaPiena(atl, p.gb);
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        let v = src[y] ? src[y][x] : IDX_SFONDO;
        // per ì/Ì il puntino va tolto TUTTO (fino all'inizio del corpo):
        // l'accento lo sostituisce, non ci si sovrappone
        if (p.tagliaFinoA >= 0 && y < p.tagliaFinoA) v = IDX_SFONDO;
        atlW.set(p.x + x, p.y + y, v ?? IDX_SFONDO);
      }
    }
    // accento sopra, centrato sulla larghezza REALE dell'accento (non su
    // quella del glifo à che lo conteneva: su una `i` stretta finiva fuori asse)
    const accR = ritagliaAccento(atl, accento);
    const dx = Math.max(0, Math.round((p.w - accR.larg) / 2));
    accR.righe.forEach((r, k) => {
      r.riga.forEach((v, x) => {
        if (atl.alpha[v] < 16) return;                 // solo l'inchiostro
        const px = p.x + dx + x, py = p.y + p.accY + k;
        if (px < p.x + p.w && py < p.y + p.h) atlW.set(px, py, v);
      });
    });
    // record del donatore riscritto: codepoint + coordinate (x_record = x + 14)
    const off = t.off + p.don.i * 16;
    tabNuovo.writeUInt16LE(p.cpAcc, off);
    tabNuovo.writeUInt16LE(p.x - SCARTO_X, off + 2);
    tabNuovo.writeUInt16LE(p.y, off + 4);
    tabNuovo.writeUInt16LE(p.w, off + 6);
    tabNuovo.writeUInt16LE(p.h, off + 8);

    // ⭐ E LA MAPPA — il pezzo che mancava ai primi due tentativi.
    // Il gioco cerca in mappa[codepoint], non nel campo codepoint del record:
    // senza questa riga il glifo è scritto, perfetto e IRRAGGIUNGIBILE, e il
    // gioco continua a disegnare il .notdef. Il donatore va anche tolto dalla
    // mappa, altrimenti resterebbe a puntare a un glifo che ora è un'altra
    // lettera (un ideogramma che disegna «è»).
    scriviMappa(tabNuovo, p.don.cp, 0xffff);
    scriviMappa(tabNuovo, p.cpAcc, p.don.i);
  }

  // ⛔⛔ IL RIORDINO ERA SBAGLIATO — smentito dalla prova in-game del 10/08.
  //
  // Avevo riordinato i record per codepoint scrivendo che «ADR-005 insegna che
  // un runtime può fare ricerca binaria, quindi riordinare è gratis e sicuro;
  // non riordinare sarebbe una scommessa». Era ESATTAMENTE il contrario, e la
  // frase stessa conteneva l'errore: avevo scritto poco prima che la cosa
  // andava «VERIFICATA prima, non assunta», e poi l'ho assunta lo stesso.
  // Una precauzione presa in prestito da un altro motore è un'assunzione
  // travestita da prudenza.
  //
  // COSA HA MOSTRATO IL GIOCO: `già`→«giÈ», `abilità`→«abilitÈ» (à trovata ma
  // con l'indice spostato) e TUTTE le minuscole nuove →«ó» (non trovate, e
  // cadute sul .notdef che dopo il riordino non era più ≡ ma ó). Due fatti:
  //   1. il gioco indirizza i glifi per POSIZIONE: riordinare rompe tutto;
  //   2. il gioco NON cerca nel campo codepoint del record, altrimenti
  //      avrebbe trovato le lettere nuove (i loro record c'erano).
  // Quindi da qui in poi: NON si riordina, e si verifica se cambiare il
  // codepoint basti — è la domanda che l'esperimento qui sotto risponde.
  if (has('--riordina')) {
    const rec = [];
    for (let i = 0; i < t.n; i++) rec.push(Buffer.from(tabNuovo.subarray(t.off + i * 16, t.off + i * 16 + 16)));
    rec.sort((a, b) => a.readUInt16LE(0) - b.readUInt16LE(0));
    rec.forEach((r, i) => r.copy(tabNuovo, t.off + i * 16));
    console.log(`   ⚠️ record RIORDINATI per codepoint (${t.n}) — provato il 10/08: ROMPE il gioco.`);
  } else {
    console.log(`   record lasciati al loro posto (nessun riordino): il gioco indirizza per posizione`);
  }

  // ── ANTEPRIMA DEL RISULTATO: si guarda prima di scrivere
  const tW = leggiGlifi(tabNuovo);
  console.log('\n── GLIFI GENERATI (rilette dal buffer nuovo, come farà il gioco):');
  // si mostrano i casi A RISCHIO, non i primi tre: minuscola semplice, la i
  // col puntino, e le MAIUSCOLE (che hanno meno spazio sopra per l'accento)
  const daMostrare = ['è', 'ì', 'À', 'Ì'].map(c => piano.find(p => p.acc === c)).filter(Boolean);
  for (const p of daMostrare) {
    const g = tW.glifi.find(x => x.cp === p.cpAcc);
    if (!g) { console.log(`   ⛔ ${p.acc} non ritrovata dopo il riordino!`); continue; }
    disegnaMatrice(ritaglia(atlW, g), atlW.alpha, `${p.acc}  (record x=${g.x} y=${g.y} w=${g.w})`);
  }

  // ── VERIFICHE PRIMA DI SCRIVERE (la lezione dei 2 WAD corrotti)
  console.log('\n── VERIFICHE (prima di toccare il gioco)');
  const check = [];
  check.push(['dimensione atlante invariata', atlNuovo.length === atlBuf.length]);
  check.push(['dimensione tabella invariata', tabNuovo.length === tabBuf.length]);
  check.push(['numero glifi invariato', tW.n === t.n]);
  // ⚠️ NON si controlla più che i record siano ordinati: la prova in-game ha
  // mostrato che il gioco li indirizza per POSIZIONE, quindi l'ordine va
  // lasciato com'è. Si controlla invece che i record NON toccati siano rimasti
  // esattamente dove stavano — che è la proprietà che conta davvero.
  const posizioniIntatte = t.glifi.every(g =>
    piano.some(p => p.don.i === g.i) || tW.glifi[g.i] && tW.glifi[g.i].cp === g.cp);
  check.push(['record non toccati rimasti al loro INDICE', posizioniIntatte]);
  check.push(['tutte le accentate presenti', piano.every(p => tW.glifi.some(g => g.cp === p.cpAcc))]);
  check.push(['ogni accentata ha inchiostro', piano.every(p => { const g = tW.glifi.find(x => x.cp === p.cpAcc); return g && ritaglia(atlW, g).some(r => r.some(v => atlW.alpha[v] >= 16)); })]);
  // i glifi ESISTENTI devono essere intatti: si confrontano i pixel di quelli
  // che non abbiamo toccato — è la difesa contro "ho scritto nel posto sbagliato"
  const intatti = t.glifi.filter(g => !piano.some(p => p.don.i === g.i) && g.y + g.h <= ultimaUsata)
    .every(g => JSON.stringify(ritaglia(atl, g)) === JSON.stringify(ritaglia(atlW, g)));
  check.push(['glifi preesistenti INTATTI (pixel per pixel)', intatti]);

  // ⭐ Due controlli che i contatori non fanno: un glifo può esistere, avere
  // inchiostro e non rompere niente — ed essere comunque BRUTTO. Sulle
  // maiuscole lo spazio sopra è poco: l'accento può finire attaccato alla
  // lettera (illeggibile) o tagliato dal bordo (mozzato).
  const staccato = piano.every(p => {
    const g = tW.glifi.find(x => x.cp === p.cpAcc);
    if (!g) return false;
    const bl = blocchi(atlW, g);
    return bl.length >= 2;              // accento e lettera separati da una riga vuota
  });
  check.push(['accento STACCATO dalla lettera (non incollato)', staccato]);
  const nonTagliato = piano.every(p => {
    const g = tW.glifi.find(x => x.cp === p.cpAcc);
    if (!g) return false;
    const m = ritaglia(atlW, g);
    const primaPiena = m.findIndex(r => r.some(v => atlW.alpha[v] >= 16));
    return primaPiena > 0;               // c'è almeno una riga vuota sopra l'accento
  });
  check.push(['accento NON tagliato dal bordo superiore', nonTagliato]);

  // ⭐ LA VERIFICA CHE MANCAVA AI PRIMI DUE TENTATIVI: il glifo dev'essere
  // RAGGIUNGIBILE, non solo presente. Si controlla la mappa esattamente come
  // la legge il gioco, e si controlla anche che i donatori non puntino più a
  // niente (sennò un ideogramma disegnerebbe «è»).
  const raggiungibili = piano.every(p => leggiMappa(tabNuovo, p.cpAcc) === p.don.i);
  check.push(['accentate RAGGIUNGIBILI dalla mappa (come le cerca il gioco)', raggiungibili]);
  const donatoriLiberati = piano.every(p => leggiMappa(tabNuovo, p.don.cp) === 0xffff);
  check.push(['donatori tolti dalla mappa (non puntano più al glifo cambiato)', donatoriLiberati]);
  // e i caratteri che il gioco già trovava devono continuare a trovarli
  const mappaIntatta = t.glifi.filter(g => !piano.some(p => p.don.i === g.i))
    .every(g => leggiMappa(tabNuovo, g.cp) === leggiMappa(tabBuf, g.cp));
  check.push(['mappa dei caratteri NON toccati invariata', mappaIntatta]);
  let tutteOk = true;
  for (const [nome2, ok] of check) { console.log(`   ${ok ? '✅' : '⛔'} ${nome2}`); if (!ok) tutteOk = false; }

  if (!tutteOk) { console.error('\n⛔ VERIFICHE FALLITE: non scrivo niente. Il gioco resta intatto.'); process.exit(1); }
  console.log('\n✅ tutte le verifiche passate.');

  if (SOLO_PROVA) {
    console.log('   (--prova: mi fermo qui, il gioco non è stato toccato. Usa --applica per scrivere.)');
  } else {
    const { writeFileSync, copyFileSync, mkdirSync } = await import('fs');
    const partiNuove = pak.parti.map((p, i) => ({ buf: i === idxAtl ? atlNuovo : i === idxTab ? tabNuovo : p.buf }));
    const nuovoPak = scriviPak(pakBuf, partiNuove, pak.offs);
    if (nuovoPak.length !== pakBuf.length) { console.error('⛔ la dimensione del PAK è cambiata: mi fermo.'); process.exit(1); }
    // backup chirurgico del solo font.pak (2,3 MB) invece del WAD (1,2 GB)
    const dirBk = join(GIOCO, 'GameStringer_FontBackup');
    mkdirSync(dirBk, { recursive: true });
    const bk = join(dirBk, 'font.pak.orig');
    if (!existsSync(bk)) { writeFileSync(bk, pakBuf); console.log(`   backup originale → ${bk}`); }
    else console.log(`   backup già presente (non sovrascritto): ${bk}`);
    const { openSync: openW, writeSync, closeSync: closeW } = await import('fs');

    // ⭐ SI SCRIVE IN DUE POSTI, e il secondo è quello che rende il lavoro
    // permanente: `gs_rebuild_single_wad` (il rebuild dietro «String it!») legge
    // dal .gsbackup e ricopia verbatim tutto ciò che non è .lin. Senza patchare
    // anche il backup, la prossima traduzione riporterebbe i ≡ IN SILENZIO.
    // ⚠️ L'offset del font nel backup NON è quello nel WAD corrente: il rebuild
    // cambia la dimensione dei .lin e quindi tutti gli offset a valle. Va
    // ricalcolato leggendo il backup, non riusato.
    const bersagli = [{ nome: 'WAD', percorso: percorsoWad, pos: posAssoluta, len: pakBuf.length }];
    const gsbk = percorsoWad.replace(/\.wad$/i, '.wad.gsbackup');
    if (existsSync(gsbk)) {
      const info = caricaFontPak(gsbk);
      if (info.buf.length !== nuovoPak.length) {
        console.log(`   ⚠️ il font nel .gsbackup ha dimensione diversa (${info.buf.length} vs ${nuovoPak.length}): NON lo tocco.`);
      } else {
        bersagli.push({ nome: '.gsbackup', percorso: gsbk, pos: info.posAssoluta, len: info.buf.length });
      }
    } else {
      console.log('   (nessun .gsbackup: verrà creato dal primo rebuild, e conterrà già il font patchato)');
    }

    for (const b of bersagli) {
      const fdw = openW(b.percorso, 'r+');
      writeSync(fdw, nuovoPak, 0, nuovoPak.length, b.pos);
      closeW(fdw);
      // prova d'effetto su OGNI bersaglio: riletto da disco, non dedotto
      const ric = caricaFontPak(b.percorso);
      const tr = leggiGlifi(leggiPak(ric.buf).parti[idxTab].buf);
      const trovate = piano.filter(p => tr.glifi.some(g => g.cp === p.cpAcc)).length;
      const raggiungibili = piano.filter(p => leggiMappa(leggiPak(ric.buf).parti[idxTab].buf, p.cpAcc) !== 0xffff).length;
      console.log(`   ✅ ${b.nome}: scritto e riletto → ${trovate}/${piano.length} accentate, ${raggiungibili}/${piano.length} raggiungibili dalla mappa`);
      if (trovate !== piano.length || raggiungibili !== piano.length) {
        console.error(`   ⛔ ${b.nome}: RILETTURA INCOERENTE — ripristina con --ripristina`);
        process.exit(1);
      }
    }
    if (bersagli.length > 1) {
      console.log('   → il font è patchato ANCHE nel backup: «String it!» non riporterà più i ≡.');
    }
    console.log('   → PROVA IN GIOCO: apri il prologo e cerca «può», «lì», «È». Se il ≡ è sparito, è fatta.');
  }
}

// ── RIPRISTINO: esiste PRIMA che serva. Rimette il font.pak originale dal
// backup chirurgico (2,3 MB), senza toccare il resto del WAD da 1,2 GB.
if (has('--ripristina')) {
  const { readFileSync, openSync: openW, writeSync, closeSync: closeW } = await import('fs');
  const bk = join(GIOCO, 'GameStringer_FontBackup', 'font.pak.orig');
  if (!existsSync(bk)) { console.error(`⛔ backup non trovato: ${bk}`); process.exit(1); }
  const orig = readFileSync(bk);
  if (orig.length !== pakBuf.length) { console.error(`⛔ il backup è lungo ${orig.length}, il font attuale ${pakBuf.length}: NON sovrascrivo alla cieca.`); process.exit(1); }
  // si ripristina ovunque si sia scritto: WAD e .gsbackup
  const dove = [{ nome: 'WAD', percorso: percorsoWad, pos: posAssoluta }];
  const gsbk = percorsoWad.replace(/\.wad$/i, '.wad.gsbackup');
  if (existsSync(gsbk)) {
    const info = caricaFontPak(gsbk);
    if (info.buf.length === orig.length) dove.push({ nome: '.gsbackup', percorso: gsbk, pos: info.posAssoluta });
  }
  for (const d of dove) {
    const fdw = openW(d.percorso, 'r+');
    writeSync(fdw, orig, 0, orig.length, d.pos);
    closeW(fdw);
    const ric = caricaFontPak(d.percorso);
    console.log(ric.buf.equals(orig)
      ? `✅ ${d.nome}: font originale ripristinato e riletto, identico al backup.`
      : `⛔ ${d.nome}: la rilettura NON coincide col backup — controllare a mano.`);
  }
  process.exit(0);
}

if (!has('--roundtrip') && !has('--anteprima') && !has('--applica') && !has('--prova') && !has('--ripristina')) {
  console.log('Modi, in ordine (ognuno è il gate del successivo):');
  console.log('  --roundtrip    parse+rebuild senza modifiche: i byte devono essere identici');
  console.log('  --anteprima    donatori, spazio, accento di Spike (non scrive)');
  console.log('  --prova        genera i glifi e passa TUTTE le verifiche, senza scrivere');
  console.log('  --applica      scrive nel WAD (backup automatico del solo font.pak)');
  console.log('  --ripristina   rimette il font originale dal backup');
  console.log(`\nWAD: ${percorsoWad}`);
}
