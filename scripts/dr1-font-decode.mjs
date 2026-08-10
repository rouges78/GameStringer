/**
 * SONDA SOLA-LETTURA n.2 — decodifica del font Danganronpa (SpFt + atlante).
 *
 * COSA HA GIÀ MISURATO LA SONDA n.1 (dr1-font-probe.mjs, 10/08/2026)
 * ------------------------------------------------------------------
 * `Dr1/data/us/font/font.pak` dentro dr1_data_us.wad è un PAK con contratto C
 * (u32 count · offset×count · padding) e contiene QUATTRO sotto-file, in due
 * coppie:
 *   [0] 1.049.632 B  header `00010100 00000120 00000000 00040004 …`
 *   [1]   135.440 B  magic `tFpS` = "SpFt" a rovescio → Spike Font
 *   [2] 1.050.160 B  stesso header di [0]
 *   [3]   130.408 B  magic `tFpS`
 * `00 04 00 04` letto come due u16 LE dà 1024 e 1024, e 1024×1024 = 1.048.576,
 * cioè la dimensione del sotto-file meno un header di ~1 KB. IPOTESI: atlante
 * 1024×1024 a 8 bit non compresso. Questa sonda serve a CONFERMARLA O
 * UCCIDERLA, e a capire la tabella glifi.
 *
 * IL METODO, che è il punto
 * -------------------------
 * Un'ipotesi sul formato si prova FACENDOLA DISEGNARE. Se interpretiamo bene
 * l'atlante, stampandolo in ASCII-art devono comparire lettere leggibili; se
 * lo interpretiamo male esce rumore. È lo stesso trucco di
 * `scripts/sci-font-probe.js --render` e dell'esperimento visivo che su
 * GameMaker (ADR-005) scoprì che le coordinate dei glifi erano relative alla
 * regione TPAG. Un numero plausibile mente, un glifo disegnato no.
 *
 * NON SCRIVE NIENTE. Non estrae asset: tutto avviene in memoria e a schermo,
 * così nessun file del gioco lascia la macchina (gate anti-copyright).
 *
 * USO:
 *   node scripts/dr1-font-decode.mjs --gioco "C:/…/Danganronpa Trigger Happy Havoc"
 *   node scripts/dr1-font-decode.mjs --gioco "…" --atlante 0 --x 0 --y 0 --w 120 --h 48
 *
 * Opzioni:
 *   --gioco <DIR>   cartella del gioco (obbligatoria)
 *   --atlante <N>   quale sotto-file atlante disegnare (0 o 2, default 0)
 *   --x --y --w --h finestra di pixel da disegnare (default 0 0 128 40)
 *   --bpp <N>       byte per pixel da provare (default: prova 1 e deduce)
 */
import { openSync, readSync, closeSync, statSync, existsSync } from 'fs';
import { join } from 'path';

function arg(n, d = null) { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; }
const GIOCO = arg('--gioco');
const ATL = parseInt(arg('--atlante', '0'), 10);
const VX = parseInt(arg('--x', '0'), 10), VY = parseInt(arg('--y', '0'), 10);
const VW = parseInt(arg('--w', '128'), 10), VH = parseInt(arg('--h', '40'), 10);

if (!GIOCO || !existsSync(GIOCO)) {
  console.error('Manca o non esiste --gioco <cartella del gioco>');
  process.exit(2);
}

const leggi = (fd, pos, len) => { const b = Buffer.alloc(len); readSync(fd, b, 0, len, pos); return b; };
const hex = (b, n = 48) => b.subarray(0, n).toString('hex').replace(/(.{8})/g, '$1 ').trim();

// ------------------------------------------------- WAD → font.pak in memoria
function estraiFontPak() {
  const percorso = join(GIOCO, 'dr1_data_us.wad');
  if (!existsSync(percorso)) { console.error('dr1_data_us.wad non trovato'); process.exit(1); }
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
  if (!e) { console.error('Dr1/data/us/font/font.pak non trovato nel WAD'); process.exit(1); }
  const buf = leggi(fd, dataStart + e.offset, e.size);
  closeSync(fd);
  return { buf, nome: e.name };
}

// contratto C, quello che la sonda n.1 ha visto reggere sui byte veri
function sottoFile(pak) {
  const count = pak.readUInt32LE(0);
  const offs = [];
  for (let i = 0; i < count; i++) offs.push(pak.readUInt32LE(4 + i * 4));
  return offs.map((o, i) => pak.subarray(o, i + 1 < count ? offs[i + 1] : pak.length));
}

// ------------------------------------------------------------ atlante 8 bit
function analizzaAtlante(b, idx) {
  console.log(`\n${'═'.repeat(70)}\nATLANTE [${idx}] — ${b.length} byte`);
  console.log(`header: ${hex(b, 64)}`);

  const w = b.readUInt16LE(12), h = b.readUInt16LE(14);
  console.log(`u16 @12 = ${w} · u16 @14 = ${h}  → ipotesi dimensioni ${w}×${h}`);
  if (w === 0 || h === 0 || w > 8192 || h > 8192) {
    console.log('⛔ dimensioni assurde: l\'ipotesi sull\'header è sbagliata, mi fermo qui.');
    return null;
  }

  const pixel = w * h;
  const resto = b.length - pixel;
  console.log(`${w}×${h} = ${pixel} px · file ${b.length} → avanzano ${resto} byte`);
  if (resto < 0) {
    console.log('⛔ il file è PIÙ PICCOLO di w×h a 8 bit: non è 8 bpp non compresso. Ipotesi UCCISA.');
    return null;
  }
  if (resto > 4096) {
    console.log(`⚠️ avanzano ${resto} byte: troppi per un header. Forse è compresso o ha più mipmap: prudenza.`);
  } else {
    console.log(`✅ compatibile con 8 bpp non compresso e header di ${resto} byte.`);
  }

  // I pixel cominciano DOPO l'header. Se l'header è `resto`, i dati stanno lì.
  const inizio = resto;
  const dati = b.subarray(inizio);

  // istogramma: un atlante di font è quasi tutto vuoto, con pochi valori alti.
  // ⚠️ L'avviso di prima guardava il valore ZERO come "vuoto" e gridava al
  // lupo su un atlante sanissimo: i pixel sono INDICI di palette, e lo sfondo
  // qui è l'indice 255. Un controllo che presume quale sia il vuoto è cieco
  // proprio sul caso normale — si misura, non si presume.
  const isto = new Array(256).fill(0);
  for (let i = 0; i < dati.length; i++) isto[dati[i]]++;
  const sfondo = isto.indexOf(Math.max(...isto));
  const quota = isto[sfondo] / dati.length;
  console.log(`istogramma: indice più frequente = ${sfondo} (${(quota * 100).toFixed(1)}% → è lo SFONDO) · valori distinti = ${isto.filter(x => x > 0).length}`);
  if (quota < 0.3) console.log('⚠️ nemmeno il valore più frequente arriva al 30%: strano per un atlante di font, di solito è quasi tutto sfondo.');
  if (isto.filter(x => x > 0).length < 4) console.log('⚠️ pochissimi valori distinti: o è un font senza antialiasing, o non sto leggendo i pixel.');

  return { w, h, inizio, dati };
}

/**
 * IL GIUDICE INDIPENDENTE: disegna. Se compaiono lettere, l'ipotesi regge.
 *
 * ⚠️ CORREZIONE 10/08/2026, dopo il primo giro sui dati veri: i pixel NON sono
 * livelli di grigio ma INDICI DI PALETTE. L'header contiene una sequenza
 * `ff ff ff 01 · ff ff ff 0b · ff ff ff 2b …` = RGBA bianchi con alpha
 * variabile, cioè l'antialiasing del font. Il primo rendering usava l'indice
 * come luminosità e produceva un rettangolo pieno: l'89,4% di indice 255 è lo
 * SFONDO, non l'inchiostro. Il numero sembrava una diagnosi ("strano per un
 * atlante") ed era invece il sintomo del mio errore di lettura.
 *
 * Per non dipendere dal decodificare la palette (che serve al patcher, non
 * alla prova), qui si usa un criterio indipendente e robusto: il valore PIÙ
 * FREQUENTE è lo sfondo, tutto il resto è inchiostro.
 */
/**
 * Trova la palette: 256 entry da 4 byte in cui i primi tre sono uguali fra
 * loro (bianco) e il quarto è l'alpha. Si prova ogni offset e si tiene quello
 * col punteggio più alto, invece di fidarsi dell'occhio su un dump esadecimale.
 */
/**
 * ⚠️ La prima versione contava solo le entry "bianche" e sbagliava di
 * un'entry: con una palette tutta bianca il punteggio massimo lo prendono PIÙ
 * offset, e prendere il primo è un tiro di dadi. Il controllo positivo l'ha
 * beccato subito (sceglieva 18 invece di 22).
 *
 * Il discriminante buono non è un'euristica ma un FATTO del dominio: lo
 * sfondo dell'atlante è trasparente, quindi l'alpha dell'indice più frequente
 * DEVE essere ~0. È un vincolo che un offset sbagliato non soddisfa per caso.
 */
function trovaPalette(b, limite, sfondo) {
  const candidati = [];
  for (let off = 0; off + 1024 <= limite; off++) {
    let bianche = 0;
    for (let i = 0; i < 256; i++) {
      const p = off + i * 4;
      if (b[p] === b[p + 1] && b[p + 1] === b[p + 2]) bianche++;
    }
    const alphaSfondo = b[off + sfondo * 4 + 3];
    if (bianche >= 200 && alphaSfondo < 16) candidati.push({ off, bianche, alphaSfondo });
  }
  if (candidati.length === 0) return { off: -1, bianche: 0, motivo: 'nessun offset con sfondo trasparente' };
  if (candidati.length > 1) {
    // più candidati: preferisco quello con più alpha DISTINTI (una palette di
    // antialiasing usa molti livelli; un allineamento sbagliato ne ripete pochi)
    for (const c of candidati) {
      const s = new Set();
      for (let i = 0; i < 256; i++) s.add(b[c.off + i * 4 + 3]);
      c.distinti = s.size;
    }
    candidati.sort((a, b2) => b2.distinti - a.distinti);
    return { ...candidati[0], ambiguo: candidati.length, alternativi: candidati.slice(1, 4).map(c => c.off) };
  }
  return candidati[0];
}

/**
 * ⚠️ 10/08, terzo giro: il verso era giusto ma il glifo usciva come un blocco
 * pieno. Colpa del criterio, non dei dati: disegnavo "tutto ciò che non è
 * l'indice di sfondo", mentre la palette è BIANCO CON ALPHA VARIABILE — gli
 * indici con alpha quasi zero sono invisibili a schermo ed erano inchiostro
 * per me. Si disegna l'ALPHA VERO, non l'indice. Stessa famiglia dell'errore
 * di due passi fa: un criterio comodo che non è quello che il gioco usa.
 */
function disegna(atl, x0, y0, larg, alt, sfondo, capovolta = false, palette = null) {
  const { w, h, dati } = atl;
  const scala = ' .:-=+*#%@';
  console.log(`\nANTEPRIMA — finestra (${x0},${y0}) ${larg}×${alt} px${capovolta ? '  ·  LETTURA DAL BASSO' : ''}${palette ? '  ·  ALPHA DA PALETTE' : `  ·  sfondo = indice ${sfondo}`}`);
  console.log('┌' + '─'.repeat(Math.min(larg, 200)) + '┐');
  for (let y = y0; y < Math.min(y0 + alt, h); y++) {
    let riga = '';
    const yf = capovolta ? h - 1 - y : y;
    for (let x = x0; x < Math.min(x0 + larg, w); x++) {
      const v = dati[yf * w + x];
      if (v === undefined) { riga += ' '; continue; }
      if (palette) {
        const a = palette[v];
        riga += a < 16 ? ' ' : scala[Math.min(9, Math.max(1, Math.round(a / 28)))];
      } else {
        riga += v === sfondo ? ' ' : '#';
      }
    }
    console.log('│' + riga + '│');
  }
  console.log('└' + '─'.repeat(Math.min(larg, 200)) + '┘');
}

/**
 * Legge la tabella glifi: campo @8 = numero glifi, campo @12 = offset tabella,
 * record da 16 byte. NON è un'ipotesi a naso — regge una VERIFICA INCROCIATA:
 * (dimensione_file − offset) / 16 dà esattamente il numero dichiarato in @8,
 * su entrambi i font (323 e 179). Due strade indipendenti sullo stesso numero.
 */
function leggiGlifi(b) {
  const n = b.readUInt32LE(8);
  const off = b.readUInt32LE(12);
  const derivato = Math.floor((b.length - off) / 16);
  const coerente = derivato === n;
  const glifi = [];
  for (let i = 0; i < n && off + i * 16 + 16 <= b.length; i++) {
    const p = off + i * 16;
    glifi.push({
      cp: b.readUInt16LE(p), x: b.readUInt16LE(p + 2), y: b.readUInt16LE(p + 4),
      w: b.readUInt16LE(p + 6), h: b.readUInt16LE(p + 8),
      coda: b.subarray(p + 10, p + 16).toString('hex'),
    });
  }
  return { n, off, derivato, coerente, glifi };
}

// ------------------------------------------------------- tabella glifi SpFt
function analizzaSpFt(b, idx) {
  console.log(`\n${'═'.repeat(70)}\nTABELLA GLIFI [${idx}] — ${b.length} byte — magic ${JSON.stringify(b.subarray(0, 4).toString('ascii'))}`);
  const campi = [];
  for (let i = 0; i < 8; i++) campi.push(b.readUInt32LE(i * 4));
  console.log('primi 8 u32:');
  campi.forEach((v, i) => console.log(`  @${String(i * 4).padStart(2)} = ${String(v).padStart(10)}  (0x${v.toString(16)})${i === 0 ? '  ← magic' : ''}${v === b.length ? '  ← == dimensione file!' : ''}${v < b.length && v > 64 ? '  ← plausibile OFFSET interno' : ''}`));

  // Cerca la tabella dei codepoint: una corsa crescente che parte da 0x20
  // (spazio) e prosegue 0x21, 0x22… La cerco a passo 2 e a passo 4 e pretendo
  // che UNO SOLO regga a lungo — se reggono entrambi lo dico invece di
  // sceglierne uno (trappola ADR-005: mai fermarsi al primo che funziona).
  const esiti = [];
  for (const passo of [2, 4]) {
    let migliore = { inizio: -1, lung: 0 };
    for (let p = 8; p + passo * 8 < b.length; p += 1) {
      const primo = passo === 2 ? b.readUInt16LE(p) : b.readUInt32LE(p);
      if (primo !== 0x20) continue;
      let n = 1;
      while (p + n * passo + passo <= b.length) {
        const v = passo === 2 ? b.readUInt16LE(p + n * passo) : b.readUInt32LE(p + n * passo);
        if (v !== 0x20 + n) break;
        n++;
      }
      if (n > migliore.lung) migliore = { inizio: p, lung: n };
    }
    esiti.push({ passo, ...migliore });
  }
  console.log('\nricerca tabella codepoint (corsa crescente da 0x20 "spazio"):');
  for (const e of esiti) {
    console.log(`  passo ${e.passo} byte → ${e.lung > 1 ? `corsa di ${e.lung} codepoint consecutivi a offset ${e.inizio}` : 'nessuna corsa'}`);
  }
  const vincitore = esiti.reduce((a, b2) => (b2.lung > a.lung ? b2 : a), { lung: 0 });
  if (vincitore.lung < 10) {
    console.log('⛔ nessuna tabella di codepoint riconoscibile: i codepoint non sono in chiaro,');
    console.log('   oppure non partono dallo spazio. Serve un altro giro di reverse.');
  } else {
    const altri = esiti.filter(e => e.lung >= 10 && e.passo !== vincitore.passo);
    if (altri.length) console.log(`  ⚠️ AMBIGUO: regge anche il passo ${altri.map(a => a.passo).join('/')} — non decidere a naso.`);
    console.log(`\n✅ tabella codepoint: passo ${vincitore.passo} byte, inizio offset ${vincitore.inizio}, corsa di ${vincitore.lung}`);
    console.log(`   (${vincitore.lung} caratteri consecutivi da U+0020: copre l'ASCII stampabile fino a U+${(0x20 + vincitore.lung - 1).toString(16).toUpperCase().padStart(4, '0')})`);
    const dopo = vincitore.inizio + vincitore.lung * vincitore.passo;
    console.log(`   byte SUBITO DOPO la corsa (qui si scopre se la tabella continua con altri blocchi): ${hex(b.subarray(dopo), 32)}`);
    const lettiDopo = [];
    for (let i = 0; i < 8 && dopo + i * vincitore.passo + vincitore.passo <= b.length; i++) {
      lettiDopo.push(vincitore.passo === 2 ? b.readUInt16LE(dopo + i * vincitore.passo) : b.readUInt32LE(dopo + i * vincitore.passo));
    }
    console.log(`   letti col passo: ${lettiDopo.join(', ')}`);
    console.log(`   ⚠️ SE qui compaiono valori > 0x7F, sono i codepoint NON ascii (accentate, giapponese):`);
    console.log(`      è la lista di ciò che il font copre — e quindi la risposta a "quali accenti mancano".`);
  }

  // dump di zone chiave per il ragionamento offline
  console.log(`\ndump @32:  ${hex(b.subarray(32), 48)}`);
  const meta = campi.filter(v => v > 64 && v < b.length);
  for (const off of [...new Set(meta)].slice(0, 3)) {
    console.log(`dump @${off} (da un campo dell'header): ${hex(b.subarray(off), 48)}`);
  }
  return vincitore;
}

// -------------------------------------------------------------------- main
console.log('SONDA DECODIFICA FONT DANGANRONPA — sola lettura\n');
const { buf, nome } = estraiFontPak();
console.log(`${nome} — ${buf.length} byte`);
const sub = sottoFile(buf);
console.log(`sotto-file: ${sub.map((s, i) => `[${i}] ${s.length}B`).join(' · ')}`);

// ---------------------------------------------------------- lettura glifi
const ACCENTI = 'àèéìòùÀÈÉÌÒÙ';
const tabelle = [];
sub.forEach((s, i) => {
  if (s.subarray(0, 4).toString('ascii') !== 'tFpS') return;
  analizzaSpFt(s, i);
  const t = leggiGlifi(s);
  console.log(`\nTABELLA GLIFI [${i}] — record da 16 byte`);
  console.log(`  dichiarati in @8: ${t.n} · derivati da (dimensione−offset)/16: ${t.derivato} → ${t.coerente ? '✅ COINCIDONO (verifica incrociata superata)' : '⛔ NON coincidono: il formato non è questo'}`);
  if (!t.coerente) return;
  console.log(`  primi 6 record:`);
  t.glifi.slice(0, 6).forEach((g, k) => {
    const c = g.cp >= 32 && g.cp < 127 ? `'${String.fromCharCode(g.cp)}'` : `U+${g.cp.toString(16).toUpperCase().padStart(4, '0')}`;
    console.log(`    #${k} ${c.padEnd(8)} x=${String(g.x).padStart(4)} y=${String(g.y).padStart(4)} w=${String(g.w).padStart(3)} h=${String(g.h).padStart(3)}  coda=${g.coda}`);
  });
  const cps = new Set(t.glifi.map(g => g.cp));
  const min = Math.min(...cps), max = Math.max(...cps);
  console.log(`  copertura: ${cps.size} codepoint distinti, da U+${min.toString(16).toUpperCase().padStart(4, '0')} a U+${max.toString(16).toUpperCase().padStart(4, '0')}`);
  const nonAscii = [...cps].filter(c => c > 0x7f).sort((a, b) => a - b);
  console.log(`  codepoint sopra U+007F: ${nonAscii.length === 0 ? 'NESSUNO' : nonAscii.map(c => `U+${c.toString(16).toUpperCase().padStart(4, '0')}(${String.fromCharCode(c)})`).join(' ')}`);
  console.log(`\n  ⭐ LA RISPOSTA — accenti italiani in questo font:`);
  const mancanti = [];
  for (const ch of ACCENTI) {
    const ok = cps.has(ch.codePointAt(0));
    if (!ok) mancanti.push(ch);
    process.stdout.write(`   ${ch}${ok ? '✓' : '✗'}`);
  }
  console.log(`\n  → ${mancanti.length === 0 ? 'CI SONO TUTTI: il font non è il colpevole, il problema è a monte (encoding/mappatura).' : `MANCANO ${mancanti.length}: ${mancanti.join(' ')} — vanno disegnati.`}`);
  tabelle.push({ idx: i, ...t });
});

/**
 * MAPPA TERMICA dell'atlante intero, a blocchi.
 *
 * PERCHÉ SERVE (10/08/2026): la "A" disegnata alle coordinate dichiarate dalla
 * sua tabella è uscita VUOTA, e così l'angolo (0,0) dove stanno i primi glifi.
 * Eppure l'istogramma dice che il 10,6% dei pixel è inchiostro. Quindi i dati
 * ci sono ma non dove li cerco: o l'offset dei pixel è un altro, o le righe
 * non sono lunghe 1024, o — ipotesi seria, visto che DR1 nasce su PSP — la
 * texture è SWIZZLED e i pixel non stanno in ordine lineare.
 *
 * Invece di indovinare quale delle tre, si guarda: questa mappa mostra dove
 * sta l'inchiostro nell'intera immagine. Righe di glifi ordinate = lettura
 * giusta. Rumore uniforme = swizzling. Tutto ammassato altrove = offset.
 */
function mappaTermica(dati, w, h, sfondo, offset) {
  const COL = 96, RIG = 48;
  const bw = Math.ceil(w / COL), bh = Math.ceil(h / RIG);
  console.log(`\nMAPPA DELL'ATLANTE (offset dati ${offset}, ${w}×${h}, ogni carattere = blocco ${bw}×${bh} px)`);
  console.log('  spazio = vuoto · . = poco · : - = + * # % @ = sempre più inchiostro');
  const scala = ' .:-=+*#%@';
  console.log('┌' + '─'.repeat(COL) + '┐');
  for (let by = 0; by < RIG; by++) {
    let riga = '';
    for (let bx = 0; bx < COL; bx++) {
      let acc = 0, tot = 0;
      for (let y = by * bh; y < Math.min((by + 1) * bh, h); y += 2) {
        for (let x = bx * bw; x < Math.min((bx + 1) * bw, w); x += 2) {
          const v = dati[y * w + x];
          if (v !== undefined) { tot++; if (v !== sfondo) acc++; }
        }
      }
      const q = tot ? acc / tot : 0;
      riga += q === 0 ? ' ' : scala[Math.min(9, Math.max(1, Math.round(q * 9)))];
    }
    console.log('│' + riga + '│');
  }
  console.log('└' + '─'.repeat(COL) + '┘');

  // dove comincia davvero l'inchiostro, misurato
  let primaRiga = -1, ultimaRiga = -1;
  for (let y = 0; y < h; y++) {
    let pieno = false;
    for (let x = 0; x < w; x += 4) if (dati[y * w + x] !== undefined && dati[y * w + x] !== sfondo) { pieno = true; break; }
    if (pieno) { if (primaRiga < 0) primaRiga = y; ultimaRiga = y; }
  }
  console.log(`inchiostro dalla riga ${primaRiga} alla riga ${ultimaRiga} (su ${h})`);
  return { primaRiga, ultimaRiga };
}

// ---------------------------------------------------------- prova visiva
const atlante = analizzaAtlante(sub[ATL], ATL);
if (atlante) {
  // sfondo = valore più frequente (criterio indipendente dalla palette)
  const conta = new Array(256).fill(0);
  for (let i = 0; i < atlante.dati.length; i++) conta[atlante.dati[i]]++;
  const sfondo = conta.indexOf(Math.max(...conta));

  // LA PROVA CHE VALE: disegnare un glifo alle coordinate DICHIARATE dalla
  // sua tabella. Se compare la lettera giusta, sono confermati in un colpo
  // solo l'atlante, l'offset dei pixel E i record glifo.
  mappaTermica(atlante.dati, atlante.w, atlante.h, sfondo, atlante.inizio);

  // Se l'angolo in alto a sinistra è vuoto ma altrove c'è inchiostro, provo
  // altri offset dei pixel: la differenza fra il file e w*h potrebbe non
  // essere tutta header. Il criterio di successo è OGGETTIVO: i primi glifi
  // dichiarano y=0, quindi la riga 0 DEVE contenere inchiostro.
  // ⭐ 10/08/2026, secondo giro sui dati veri: la mappa dice che l'inchiostro
  // sta dalla riga 675 alla 1023 — in FONDO, e fino all'ULTIMA riga del file.
  // Sono 349 righe che, con glifi alti 39, fanno 9 righe di testo esatte: la
  // struttura è giusta, è il VERSO che non torna. Molte texture si scrivono
  // dal basso verso l'alto (BMP, OpenGL). Ipotesi da verificare GUARDANDO.
  const inchiostroNelRettangolo = (capovolta) => {
    let acc = 0;
    for (let y = 0; y < 39; y++) {
      const yf = capovolta ? atlante.h - 1 - y : y;
      for (let x = 0; x < 104; x++) if (atlante.dati[yf * atlante.w + x] !== sfondo) acc++;
    }
    return acc;
  };
  const dritta = inchiostroNelRettangolo(false), rovescia = inchiostroNelRettangolo(true);
  console.log(`\nVERSO DELLE RIGHE — inchiostro nel rettangolo dei primi 6 glifi (0,0)-(104,39):`);
  console.log(`   dall'alto: ${dritta} px · DAL BASSO: ${rovescia} px`);
  let capovolta = false;
  if (rovescia > dritta * 3 && rovescia > 20) {
    capovolta = true;
    console.log('   → l\'immagine è memorizzata DAL BASSO VERSO L\'ALTO (come BMP/OpenGL).');
  } else if (dritta === 0 && rovescia === 0) {
    console.log('   → nessuno dei due versi funziona: non è il verso. Resta lo swizzling (DR1 nasce su PSP).');
    const b = sub[ATL];
    for (const off of [0, 16, 22, 32, 64, 1024, 1046]) {
      if (off + atlante.w * atlante.h > b.length) continue;
      const d = b.subarray(off);
      let acc = 0;
      for (let y = 0; y < 39; y++) for (let x = 0; x < 104; x++) if (d[y * atlante.w + x] !== sfondo) acc++;
      console.log(`     offset alternativo ${String(off).padStart(5)} → ${acc} px`);
    }
  }

  // palette: la cerco e mi faccio dire quanto è convinta
  const pal = trovaPalette(sub[ATL], atlante.inizio, sfondo);
  let alpha = null;
  if (pal.off < 0) {
    console.log(`\nPALETTE: non trovata (${pal.motivo}) → disegno col criterio grezzo.`);
  } else {
    alpha = new Uint8Array(256);
    for (let i = 0; i < 256; i++) alpha[i] = sub[ATL][pal.off + i * 4 + 3];
    const vis = [...alpha].filter(a => a >= 16).length;
    console.log(`\nPALETTE: offset ${pal.off} · ${pal.bianche}/256 entry bianche · alpha dello sfondo (indice ${sfondo}) = ${pal.alphaSfondo} ✅`);
    console.log(`   indici con alpha ≥16 (inchiostro visibile a schermo): ${vis}/256 · livelli di alpha distinti: ${pal.distinti ?? new Set(alpha).size}`);
    if (pal.ambiguo) console.log(`   ⚠️ ${pal.ambiguo} offset soddisfacevano il vincolo; scelto quello con più livelli di alpha. Altri: ${pal.alternativi.join(', ')}`);
  }

  const t = tabelle.find(x => x.idx === ATL + 1);
  const bersaglio = t && t.glifi.find(g => g.cp === 0x41); // 'A'
  if (bersaglio) {
    console.log(`\n⭐ PROVA FINALE — glifo 'A' alle coordinate della sua tabella (x=${bersaglio.x} y=${bersaglio.y} w=${bersaglio.w} h=${bersaglio.h})`);
    disegna(atlante, Math.max(0, bersaglio.x - 1), Math.max(0, bersaglio.y - 1), bersaglio.w + 2, bersaglio.h + 2, sfondo, capovolta, alpha);
    // ── CALIBRAZIONE: dove comincia DAVVERO l'inchiostro rispetto alla x
    // dichiarata? La fila ABCDEF si legge, ma la prima lettera parte qualche
    // pixel dopo la x del record. Invece di stimarlo a occhio lo si misura su
    // molti glifi: uno scarto COSTANTE è un margine di cella (si somma e via),
    // uno scarto VARIABILE vuol dire che il campo significa altro — e sarebbe
    // il tipo di errore che riempie di pixel il posto sbagliato.
    if (alpha) {
      const inchiostroA = (x, y0, h2) => {
        for (let y = y0; y < y0 + h2; y++) {
          const yf = capovolta ? atlante.h - 1 - y : y;
          const v = atlante.dati[yf * atlante.w + x];
          if (v !== undefined && alpha[v] >= 16) return true;
        }
        return false;
      };
      // ⚠️ La prima calibrazione cercava il primo inchiostro da `x-4` in poi e
      // ha dato «-4px×16 su 24»: il valore più frequente coincideva col BORDO
      // della finestra di ricerca — non è un risultato, è la misura che sbatte
      // contro il proprio limite. E a sinistra si trova comunque la coda del
      // glifo precedente (gap 2 + antialiasing che sbava).
      //
      // Misura che non dipende da dove comincio a guardare: si cercano le
      // COLONNE VUOTE che separano i glifi e si confrontano i segmenti reali
      // con le x dichiarate, affiancati. Così la corrispondenza si LEGGE.
      const fascia = t.glifi[0].h;
      const colonnaPiena = (x) => inchiostroA(x, 0, fascia);
      const segmenti = [];
      let inizio = -1;
      for (let x = 0; x < atlante.w; x++) {
        const piena = colonnaPiena(x);
        if (piena && inizio < 0) inizio = x;
        if (!piena && inizio >= 0) { segmenti.push({ da: inizio, a: x - 1, w: x - inizio }); inizio = -1; }
        if (segmenti.length >= 30) break;
      }
      console.log(`\n── CORRISPONDENZA record ↔ glifi reali (prima riga dell'atlante, y 0-${fascia})`);
      console.log('   Segmenti = gruppi di colonne con inchiostro, separati da colonne vuote.');
      console.log('   record dichiarato          segmento misurato');
      const visibili = t.glifi.filter(g => g.cp !== 0x20).slice(0, 14);
      for (let i = 0; i < Math.min(visibili.length, segmenti.length); i++) {
        const g = visibili[i], s = segmenti[i];
        const ch = g.cp >= 33 && g.cp < 127 ? `'${String.fromCharCode(g.cp)}'` : `U+${g.cp.toString(16)}`;
        console.log(`   ${ch.padEnd(6)} x=${String(g.x).padStart(4)} w=${String(g.w).padStart(3)}   →   x=${String(s.da).padStart(4)} w=${String(s.w).padStart(3)}   scarto x ${s.da - g.x >= 0 ? '+' : ''}${s.da - g.x} · scarto w ${s.w - g.w >= 0 ? '+' : ''}${s.w - g.w}`);
      }
      // ⚠️ Il confronto ingenuo segmenti[i]↔visibili[i] dà scarti caotici, ma
      // NON perché la lettura sia sbagliata: alcuni caratteri (", %, ecc.) si
      // spezzano in PIÙ segmenti e altri si toccano, quindi il numero di
      // segmenti non è il numero di glifi. La prova che la corrispondenza
      // esiste sta nelle DISTANZE fra glifi consecutivi, che dal quarto in poi
      // sono la stessa identica sequenza nei due elenchi.
      //
      // Quindi non si confronta a indice fisso: si cerca la combinazione
      // (sfasamento, scarto) che allinea il maggior numero di glifi. Se una
      // combinazione spiega quasi tutto, è quella; se nessuna ci riesce,
      // non si scrive un pixel.
      // ⚠️ Anche l'allineamento per segmenti si è rivelato fragile (50%): sulla
      // punteggiatura alcuni caratteri si spezzano in più segmenti e altri si
      // toccano, quindi i due elenchi non possono corrispondere a indice.
      //
      // Criterio che NON dipende dalla segmentazione, e che è una proprietà
      // del disegno stesso: un rettangolo giusto ha le colonne SUBITO FUORI
      // vuote (sono i gap fra glifi) e almeno una colonna interna con
      // inchiostro. Si prova ogni scarto e si conta su quanti glifi regge.
      // Si usano le LETTERE, che sono glifi solidi e ben separati, non la
      // punteggiatura che è il caso patologico.
      const solidi = t.glifi.filter(g => (g.cp >= 0x41 && g.cp <= 0x5a) || (g.cp >= 0x61 && g.cp <= 0x7a)).slice(0, 40);
      // ⚠️ La prima versione controllava SEMPRE la fascia y=0..39, cioè la
      // prima riga dell'atlante — ma i glifi stanno su nove righe. Le 14
      // lettere che "non reggevano" erano semplicemente quelle con y>0, e il
      // 65% non era una misura del formato: era la percentuale di lettere che
      // per caso stavano nella riga che guardavo. Ogni glifo va cercato NELLA
      // SUA fascia.
      const colPiena = (x, y0, h2) => inchiostroA(x, y0, h2);
      const colVuota = (x, y0, h2) => !colPiena(x, y0, h2);
      const interno = (x, w2, y0, h2) => { for (let k = 0; k < w2; k++) if (colPiena(x + k, y0, h2)) return true; return false; };
      // ⚠️ Un rettangolo un po' più largo del glifo soddisfa il criterio per
      // PIÙ valori di scarto (il controllo positivo, con scarto vero +5, dava
      // 26/26 già a +3). Prendere il primo sarebbe una precisione finta: si
      // riporta l'INTERVALLO dei valori che reggono, e si usa il centro.
      const punteggi = [];
      for (let d = -40; d <= 40; d++) {
        let quanti = 0;
        for (const g of solidi) {
          const x0 = g.x + d;
          if (x0 < 1 || x0 + g.w + 1 >= atlante.w) continue;
          if (colVuota(x0 - 1, g.y, g.h) && colVuota(x0 + g.w, g.y, g.h) && interno(x0, g.w, g.y, g.h)) quanti++;
        }
        punteggi.push({ d, quanti });
      }
      const max = Math.max(...punteggi.map(p => p.quanti));
      const buoni = punteggi.filter(p => p.quanti === max).map(p => p.d);
      const centro = buoni[Math.floor(buoni.length / 2)];
      const best = { scarto: centro, quanti: max, quota: max / solidi.length, n: solidi.length };
      console.log(`\n   ricerca dello scarto col criterio "bordi vuoti, interno pieno" su ${solidi.length} lettere:`);
      console.log(`   → reggono gli scarti da ${buoni[0]} a ${buoni[buoni.length - 1]} px, tutti su ${max}/${solidi.length} lettere (${(best.quota * 100).toFixed(0)}%)`);
      console.log(`   → uso il centro dell'intervallo: ${centro >= 0 ? '+' : ''}${centro}px`);
      if (best.quota >= 0.7) {
        console.log(`   ✅ CORRISPONDENZA TROVATA: il glifo del record R sta nell'atlante a x = R.x ${best.scarto >= 0 ? '+' : ''}${best.scarto}`);
        console.log(`      cioè il campo x del record NON è l'origine del glifo: c'è un margine fisso.`);
        console.log(`      ⚠️ misurato sul font [1] (h=39): per il font grande [3] va RIMISURATO`);
        console.log(`         con --atlante 2, non dedotto per proporzione.`);
        console.log(`   ⛔ PRIMA DI SCRIVERE PIXEL: confermare disegnando il rettangolo corretto (sotto).`);
      } else {
        console.log('   ⚠️ nessuna combinazione spiega la maggioranza dei glifi.');
        console.log('      NON scrivere pixel: si rischia di riempire la cella sbagliata.');
      }
      // ⭐ LA CONFERMA: ritaglio la 'A' col rettangolo CORRETTO. Se esce una A
      // pulita e centrata, la regola è giusta; se esce mezza lettera, no.
      const gA = t.glifi.find(g => g.cp === 0x41);
      if (gA && best.quota >= 0.7) {
        console.log(`\n⭐ CONFERMA: 'A' ritagliata col rettangolo corretto (x=${gA.x}${best.scarto >= 0 ? '+' : ''}${best.scarto}=${gA.x + best.scarto}, w=${gA.w})`);
        disegna(atlante, gA.x + best.scarto, gA.y, gA.w + 1, gA.h + 1, sfondo, capovolta, alpha);
      }
    }

    // e una fila di glifi consecutivi: se si legge una parola, non è fortuna
    const seq = t.glifi.filter(g => g.cp >= 0x41 && g.cp <= 0x5a).slice(0, 6);
    if (seq.length) {
      const x1 = Math.min(...seq.map(g => g.x)), x2 = Math.max(...seq.map(g => g.x + g.w));
      console.log(`\n   e la fila A-F di seguito (${seq.map(g => String.fromCharCode(g.cp)).join('')}): se si leggono, è confermato`);
      disegna(atlante, x1, seq[0].y, Math.min(x2 - x1 + 2, 190), seq[0].h + 1, sfondo, capovolta, alpha);
    }
  }
  if (false && bersaglio) {
    console.log(`\n⭐ PROVA INCROCIATA: disegno il glifo 'A' alle coordinate che dichiara la sua tabella`);
    console.log(`   (x=${bersaglio.x} y=${bersaglio.y} w=${bersaglio.w} h=${bersaglio.h}). Se compare una A, il formato è capito.`);
    disegna(atlante, Math.max(0, bersaglio.x - 1), Math.max(0, bersaglio.y - 1), bersaglio.w + 2, bersaglio.h + 2, sfondo);
  }
  console.log('\nfinestra generica richiesta:');
  disegna(atlante, VX, VY, VW, VH, sfondo);
}

console.log(`\n${'═'.repeat(70)}`);
console.log('COSA GUARDARE:');
console.log(' 1. La riga "accenti italiani": dice se il font ha à/è/ì oppure no.');
console.log('    Se CI SONO → il font è innocente e il ≡ nasce a monte (encoding o mappatura):');
console.log('       riparazione piccola, nessun pixel da toccare.');
console.log('    Se MANCANO → vanno disegnati nell\'atlante e aggiunti alla tabella glifi.');
console.log(' 2. La "A" disegnata: se è una A leggibile, atlante e record sono confermati.');
console.log('    Se è rumore, la tabella la stiamo leggendo bene ma i pixel no.');
