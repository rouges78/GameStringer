/**
 * SONDA SOLA-LETTURA sui font di Danganronpa (DR1 PC).
 *
 * PERCHÉ ESISTE
 * -------------
 * Il gioco gira in italiano (09/08/2026) ma il font non ha gli accenti:
 * à/è/ì/ò/ù escono come `≡`. Prima di scrivere una riga di codice che TOCCA
 * un font, questa sonda risponde a tre domande misurandole, non deducendole:
 *
 *   1. In quale WAD stanno i font, e con che nome esatto?
 *   2. Che formato ha il PAK font: il contratto è (offset,size) interleaved
 *      oppure count+1 offset come nel text block dei .lin?
 *   3. I sotto-file sono immagini (atlante bitmap) o font sfnt (TTF/OTF)?
 *      Da questa risposta dipende TUTTA la strategia: atlante = filone
 *      ADR-005/Sierra SCI (disegnare i glifi), sfnt = si sostituisce il font.
 *
 * NON SCRIVE NIENTE dentro la cartella del gioco. Con --estrai <DIR> copia i
 * file font in una cartella A SCELTA, fuori dal gioco, per ispezionarli.
 *
 * USO (Git Bash, percorsi assoluti):
 *   node scripts/dr1-font-probe.mjs --gioco "C:/Program Files (x86)/Steam/steamapps/common/Danganronpa Trigger Happy Havoc"
 *   node scripts/dr1-font-probe.mjs --gioco "..." --estrai "C:/temp/dr1-font"
 *
 * Opzioni:
 *   --gioco <DIR>    cartella del gioco (obbligatoria)
 *   --estrai <DIR>   estrae i file font trovati in DIR (fuori dal gioco)
 *   --hex <N>        byte di anteprima esadecimale per sotto-file (default 32)
 *
 * CONTRATTO WAD (da gs_read_wad in danganronpa_patcher.rs, l'unico parser
 * corretto in casa): magic AGAR · u32 extra@12 · a 16+extra: u32 count ·
 * count × [u32 name_len, name, u64 size, u64 offset] · tabella DIRECTORY ·
 * dati. Gli offset delle entry sono RELATIVI a data_start.
 * ⚠️ Il vecchio read_wad_archive() assume header 20 fisso e ignora `extra` e
 * la tabella directory: NON usarlo come riferimento.
 */
import { openSync, readSync, closeSync, statSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

// ---------------------------------------------------------------- argomenti
function arg(nome, def = null) {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const GIOCO = arg('--gioco');
const ESTRAI = arg('--estrai');
const HEXN = parseInt(arg('--hex', '32'), 10);

if (!GIOCO) {
  console.error('Manca --gioco <cartella del gioco>. Esempio:');
  console.error('  node scripts/dr1-font-probe.mjs --gioco "C:/Program Files (x86)/Steam/steamapps/common/Danganronpa Trigger Happy Havoc"');
  process.exit(2);
}
if (!existsSync(GIOCO)) {
  console.error(`Cartella non trovata: ${GIOCO}`);
  process.exit(2);
}

// ------------------------------------------------------------------ utility
const leggi = (fd, pos, len) => { const b = Buffer.alloc(len); readSync(fd, b, 0, len, pos); return b; };
const kb = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1024).toFixed(1)} KB`;

/** Riconosce il formato dai byte iniziali. Elenco deliberatamente ampio:
 *  un "non lo so" onesto vale più di un'etichetta inventata. */
function riconosci(b) {
  if (b.length < 4) return 'troppo corto';
  const a = b.subarray(0, 4).toString('ascii');
  const h = b.subarray(0, 4).toString('hex').toUpperCase();
  if (a === 'AGAR') return 'WAD (AGAR)';
  if (h === '00010000') return '⭐ FONT sfnt (TTF)';
  if (a === 'OTTO') return '⭐ FONT sfnt (OTF/CFF)';
  if (a === 'ttcf') return '⭐ FONT collection (TTC)';
  if (a === 'wOFF' || a === 'wOF2') return '⭐ FONT WOFF';
  if (b[0] === 0x89 && a.slice(1) === 'PNG') return '🖼 PNG';
  if (h.startsWith('FFD8FF')) return '🖼 JPEG';
  if (a.startsWith('DDS')) return '🖼 DDS (texture)';
  if (a === 'GXT\0' || a.startsWith('GXT')) return '🖼 GXT (texture PSVita)';
  if (a === 'BTX\0' || a.startsWith('BTX')) return '🖼 BTX (texture Spike)';
  if (a === 'TIM2' || a === 'TIM3') return '🖼 TIM (texture Sony)';
  if (b[0] === 0x00 && b[1] === 0x00 && (b[2] === 0x02 || b[2] === 0x0A)) return '🖼 TGA (probabile)';
  if (a === 'RIFF') return 'RIFF (audio/altro)';
  if (a === 'FBX\0' || a.startsWith('SRD')) return 'SRD (Spike resource)';
  if (a.startsWith('PK\u0003')) return 'ZIP';
  if (a === 'SRD\0' || a === 'SRDV' || a === 'SRDI') return 'SRD (Spike Chunsoft resource)';
  if (a === '$CFH' || a === '$CG4') return 'CRIWARE compresso';
  if (b[0] === 0xFF && b[1] === 0xFE) return 'testo UTF-16 LE (BOM)';
  return `sconosciuto (ascii "${a.replace(/[^\x20-\x7e]/g, '.')}" hex ${h})`;
}

/** Se il magic iniziale non dice niente, cerca firme note più avanti nei
 *  primi byte: molti contenitori mettono un piccolo header proprio davanti a
 *  un formato standard. È un indizio, NON una diagnosi: lo si dichiara. */
function firmeInterne(b) {
  const zona = b.subarray(0, Math.min(b.length, 512));
  const trovate = [];
  const cerca = [
    ['PNG', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
    ['sfnt/TTF', Buffer.from([0x00, 0x01, 0x00, 0x00])],
    ['OTTO', Buffer.from('OTTO')],
    ['DDS', Buffer.from('DDS ')],
    ['GXT', Buffer.from('GXT')],
    ['BTX', Buffer.from('BTX')],
    ['SRD', Buffer.from('SRD')],
    ['TIM2', Buffer.from('TIM2')],
  ];
  for (const [nome, firma] of cerca) {
    const i = zona.indexOf(firma);
    if (i > 0) trovate.push(`${nome}@${i}`);
  }
  return trovate;
}

// -------------------------------------------------------------- lettura WAD
function leggiWad(percorso) {
  const fd = openSync(percorso, 'r');
  try {
    const head = leggi(fd, 0, 16);
    if (head.subarray(0, 4).toString('ascii') !== 'AGAR') {
      return { errore: 'magic AGAR mancante' };
    }
    const extra = head.readUInt32LE(12);
    let pos = 16 + extra;
    const count = leggi(fd, pos, 4).readUInt32LE(0); pos += 4;
    const tableStart = pos;

    const entries = [];
    for (let i = 0; i < count; i++) {
      const nameLen = leggi(fd, pos, 4).readUInt32LE(0); pos += 4;
      if (nameLen === 0 || nameLen > 512) return { errore: `entry ${i}: name_len assurdo (${nameLen})` };
      const name = leggi(fd, pos, nameLen).toString('utf8'); pos += nameLen;
      const m = leggi(fd, pos, 16); pos += 16;
      entries.push({ name, size: Number(m.readBigUInt64LE(0)), offset: Number(m.readBigUInt64LE(8)) });
    }
    const fileTableEnd = pos;

    // tabella DIRECTORY: dir_count · [name_len, name, entry_count · [len, name+1]]
    const dirCount = leggi(fd, pos, 4).readUInt32LE(0); pos += 4;
    for (let d = 0; d < dirCount; d++) {
      const nl = leggi(fd, pos, 4).readUInt32LE(0); pos += 4 + nl;
      const ec = leggi(fd, pos, 4).readUInt32LE(0); pos += 4;
      for (let e = 0; e < ec; e++) {
        const enl = leggi(fd, pos, 4).readUInt32LE(0); pos += 4 + enl + 1;
      }
    }
    const dataStart = pos;

    // PROVA D'EFFETTO sul parsing: l'ultima entry deve finire esattamente
    // dentro il file. Se sfora, data_start è sbagliato e tutto il resto è
    // fuffa — meglio saperlo qui che dopo aver estratto byte a caso.
    const dim = statSync(percorso).size;
    let fine = 0;
    for (const e of entries) fine = Math.max(fine, dataStart + e.offset + e.size);
    const coerente = fine <= dim;

    return { fd, entries, tableStart, fileTableEnd, dataStart, dim, coerente, fine, extra, dirCount };
  } catch (e) {
    closeSync(fd);
    return { errore: String(e.message || e) };
  }
}

// -------------------------------------------------- interpretazione del PAK
/**
 * Il PAK Danganronpa ha DUE contratti candidati in circolazione nel repo:
 *   (A) u32 count · count × [u32 offset, u32 size]      ← read_pak_archive_internal
 *   (B) u32 count · (count+1) × u32 offset              ← text block dei .lin
 * Non si sceglie a naso: si prova a validarli entrambi e si pretende che ne
 * regga ESATTAMENTE UNO. Se reggono tutti e due, o nessuno, lo si dice.
 * (Metodo ADR-005: non fermarsi al primo candidato che funziona.)
 */
function interpretaPak(buf) {
  const esiti = {};
  const n = buf.length;
  if (n < 8) return { esiti, vincitore: null, motivo: 'troppo corto' };
  const count = buf.readUInt32LE(0);
  if (count === 0 || count > 100000) return { esiti, vincitore: null, motivo: `count assurdo (${count})` };

  // (A) offset+size interleaved
  {
    const hdr = 4 + count * 8;
    let ok = hdr <= n;
    const sub = [];
    if (ok) {
      for (let i = 0; i < count; i++) {
        const off = buf.readUInt32LE(4 + i * 8);
        const size = buf.readUInt32LE(8 + i * 8);
        if (off < hdr || off + size > n) { ok = false; break; }
        sub.push({ off, size });
      }
    }
    esiti.A = { ok, sub, etichetta: 'u32 count · [offset,size]×count' };
  }

  // (B) count+1 offset (l'ultimo è la fine dati) — è il contratto del text
  // block dei .lin, provato col round-trip byte-identico 1580/1580
  {
    const hdr = 4 + (count + 1) * 4;
    let ok = hdr <= n;
    const sub = [];
    if (ok) {
      let prev = buf.readUInt32LE(4);
      if (prev !== hdr) ok = false; // il primo offset DEVE essere la fine header
      for (let i = 1; ok && i <= count; i++) {
        const cur = buf.readUInt32LE(4 + i * 4);
        if (cur < prev || cur > n) { ok = false; break; }
        sub.push({ off: prev, size: cur - prev });
        prev = cur;
      }
    }
    esiti.B = { ok, sub, etichetta: 'u32 count · offset×(count+1)' };
  }

  // (C) count offset SENZA quello finale, header allineato con padding.
  // AGGIUNTO 10/08/2026 DOPO AVER GUARDATO I BYTE VERI del gioco: né A né B
  // reggevano su bin_sv_font_l.pak (`06000000 20000000 400d0000 …`) né su
  // font.pak (`04000000 20000000 40041000 …`). In entrambi 4+count*4 è MINORE
  // del primo offset (28<32 e 20<32): c'è padding di allineamento, e dopo
  // l'ultimo offset valido segue 00000000 di riempimento, non una sentinella.
  // La size dell'ultima entry si ricava dalla FINE DEL FILE, quindi va
  // trattata con prudenza: se in coda c'è padding, è sovrastimata.
  {
    const hdrMin = 4 + count * 4;
    let ok = hdrMin <= n;
    const sub = [];
    let off0 = 0;
    if (ok) {
      off0 = buf.readUInt32LE(4);
      // il primo offset deve stare oltre la tabella e a un allineamento sensato
      if (off0 < hdrMin || off0 > n || off0 % 4 !== 0) ok = false;
    }
    if (ok) {
      const offs = [];
      for (let i = 0; i < count; i++) {
        const o = buf.readUInt32LE(4 + i * 4);
        // strettamente crescenti e dentro il file: un 0 di padding li rompe
        if (o < off0 || o > n || (i > 0 && o <= offs[i - 1])) { ok = false; break; }
        offs.push(o);
      }
      if (ok) {
        for (let i = 0; i < count; i++) {
          const fine = i + 1 < count ? offs[i + 1] : n;
          sub.push({ off: offs[i], size: fine - offs[i], ultimaStimata: i + 1 === count });
        }
      }
    }
    esiti.C = { ok, sub, etichetta: 'u32 count · offset×count · padding (size ultima = fine file)' };
  }

  const validi = Object.entries(esiti).filter(([, v]) => v.ok).map(([k]) => k);
  if (validi.length === 1) return { esiti, vincitore: validi[0], count, motivo: null };
  if (validi.length === 0) return { esiti, vincitore: null, count, motivo: 'nessun contratto regge' };
  return { esiti, vincitore: null, count, motivo: `AMBIGUO: reggono ${validi.join(' e ')} — non decidere a naso` };
}

// ----------------------------------------------------------------- discesa
function ispeziona(buf, nome, prof, out) {
  const pad = '  '.repeat(prof);
  const tipo = riconosci(buf);
  console.log(`${pad}• ${nome} — ${kb(buf.length)} — ${tipo}`);
  if (HEXN > 0) console.log(`${pad}  hex: ${buf.subarray(0, HEXN).toString('hex').replace(/(.{8})/g, '$1 ').trim()}`);
  if (tipo.startsWith('sconosciuto')) {
    const f = firmeInterne(buf);
    if (f.length) console.log(`${pad}  indizio (firma NON all'inizio, quindi header proprio davanti a un formato noto): ${f.join(', ')}`);
    // testo leggibile nei primi byte: spesso i contenitori Spike hanno nomi
    const ascii = buf.subarray(0, 256).toString('latin1').replace(/[^\x20-\x7e]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (ascii.length > 6) console.log(`${pad}  ascii: ${ascii.slice(0, 100)}`);
  }

  if (out) {
    const dest = join(out, nome.replace(/[\\/:*?"<>|]/g, '_'));
    writeFileSync(dest, buf);
  }

  // discesa nei PAK annidati (type 3), max 3 livelli: oltre è rumore
  if (prof >= 3) return;
  const inter = interpretaPak(buf);
  const validi = Object.entries(inter.esiti).filter(([, v]) => v.ok);

  if (validi.length === 0) {
    if (inter.motivo && inter.count) console.log(`${pad}  ↳ non è un PAK leggibile: ${inter.motivo}`);
    return;
  }

  // ⚠️ Se più contratti reggono NON si sceglie a naso e non ci si ferma al
  // primo che funziona (trappola ADR-005): si esplorano TUTTI e si lascia
  // decidere a un giudice INDIPENDENTE dalla struttura — i magic dei
  // sotto-file. Un contratto sbagliato produce sotto-file "sconosciuto";
  // quello giusto produce formati riconoscibili.
  if (validi.length > 1) {
    console.log(`${pad}  ⚠️ AMBIGUO: reggono ${validi.map(([k]) => k).join(' e ')}. Li esploro entrambi:`);
    console.log(`${pad}     giudice = i magic dei sotto-file, non la struttura.`);
  }

  for (const [chiave, v] of validi) {
    const et = validi.length > 1 ? `${chiave}: ` : '';
    console.log(`${pad}  ↳ ${et}PAK annidato, contratto ${chiave} (${v.etichetta}), ${v.sub.length} sotto-file`);
    v.sub.forEach((s, i) => {
      if (s.size <= 0) return;
      const stima = s.ultimaStimata ? ' [size dedotta dalla fine file: può includere padding]' : '';
      if (stima) console.log(`${pad}    (ultimo sotto-file${stima})`);
      ispeziona(buf.subarray(s.off, s.off + s.size), `${nome}${validi.length > 1 ? '.' + chiave : ''}[${String(i).padStart(4, '0')}]`, prof + 1, out);
    });
  }
}

// -------------------------------------------------------------------- main
console.log('SONDA FONT DANGANRONPA — sola lettura\n');
console.log(`Gioco: ${GIOCO}`);

if (ESTRAI) {
  if (ESTRAI.toLowerCase().startsWith(GIOCO.toLowerCase())) {
    console.error(`\n⛔ --estrai punta DENTRO la cartella del gioco. Scegli una cartella fuori: il gioco non si tocca.`);
    process.exit(2);
  }
  mkdirSync(ESTRAI, { recursive: true });
  console.log(`Estrazione in: ${ESTRAI}`);
}

const wads = readdirSync(GIOCO).filter(f => f.toLowerCase().endsWith('.wad'));
if (wads.length === 0) {
  console.error('\n⛔ Nessun .wad nella cartella del gioco. Percorso sbagliato?');
  process.exit(1);
}
console.log(`WAD trovati: ${wads.join(', ')}\n`);

let totaliFont = 0;
for (const w of wads) {
  const percorso = join(GIOCO, w);
  console.log('─'.repeat(70));
  console.log(`WAD: ${w} (${kb(statSync(percorso).size)})`);
  const wad = leggiWad(percorso);
  if (wad.errore) { console.log(`  ⛔ ${wad.errore}`); continue; }

  console.log(`  entry: ${wad.entries.length} · extra: ${wad.extra} · directory: ${wad.dirCount} · data_start: ${wad.dataStart}`);
  if (!wad.coerente) {
    console.log(`  ⛔ INCOERENTE: l'ultima entry finisce a ${wad.fine} ma il file è ${wad.dim}. Il parsing è sbagliato: NON fidarsi di quel che segue.`);
    closeSync(wad.fd);
    continue;
  }
  console.log(`  ✅ coerente: l'ultima entry finisce a ${wad.fine} ≤ ${wad.dim} byte del file`);

  const font = wad.entries.filter(e => /font/i.test(e.name));
  console.log(`  entry con "font" nel nome: ${font.length}`);
  totaliFont += font.length;

  for (const e of font) {
    console.log(`\n  ── ${e.name} (${kb(e.size)}, offset rel ${e.offset})`);
    if (e.size > 64 * 1024 * 1024) { console.log('     (saltato: >64 MB, troppo grande per la sonda)'); continue; }
    const buf = leggi(wad.fd, wad.dataStart + e.offset, e.size);
    ispeziona(buf, basename(e.name), 2, ESTRAI);
  }
  closeSync(wad.fd);
}

console.log('\n' + '═'.repeat(70));
if (totaliFont === 0) {
  console.log('⛔ NESSUNA entry con "font" nel nome.');
  console.log('   Non vuol dire che i font non ci sono: possono avere un altro nome.');
  console.log('   Prossima mossa: rilanciare stampando TUTTI i nomi entry e cercare a occhio.');
} else {
  console.log(`Trovate ${totaliFont} entry font.`);
  console.log('LA DOMANDA CHE DECIDE LA STRATEGIA: nei sotto-file compare "⭐ FONT sfnt"');
  console.log('oppure "🖼" (immagine/atlante)?');
  console.log('  · sfnt  → si sostituisce il font con uno che ha gli accenti (facile)');
  console.log('  · atlante → filone ADR-005 / Sierra SCI: i glifi vanno DISEGNATI (lungo)');
  console.log('  · sconosciuto → serve un giro di reverse sul formato, con round-trip');
  console.log('    byte-identico come primo test (lezione del parser .lin).');
}
