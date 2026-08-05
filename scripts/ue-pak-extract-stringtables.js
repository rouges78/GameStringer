#!/usr/bin/env node
/**
 * Estrazione mirata di StringTable/DataTable da un .pak Unreal (v10/v11)
 * SENZA caricare il pak in memoria — seguito di ue-pak-index-probe.js.
 *
 * Contesto (04/08/2026, American Arcadia): il pak v11 da 11 GB ha 63.597 file;
 * i .locres sono tutti del motore, i testi veri stanno in StringTable dentro
 * gli .uasset (ST_L00_Loops, ST_LineDialogue, …). La sonda leggeva i NOMI dal
 * Full Directory Index ma saltava l'offset dell'entry codificata: qui quel
 * numero viene usato per decodificare la EncodedPakEntry (bit-packing UE) e
 * ricavare offset/dimensione/compressione, poi estrarre i file con seek.
 *
 * Prova di effetto, non conteggi: ogni .uasset estratto viene verificato col
 * magic 0x9E2A83C1 e si stampano stringhe VERE trovate dentro (lo stesso scan
 * di scan_uasset_strings in unreal_iostore.rs:876).
 *
 * Uso:
 *   node scripts/ue-pak-extract-stringtables.js "<percorso .pak>" [opzioni]
 * Opzioni:
 *   --filter <regex>  filtro sui percorsi (default: ST_/DT_/stringtable/datatable/subtitle/dialog)
 *   --out <dir>       cartella di uscita (default: estratti-arcadia — gitignored dal glob "estratti")
 *   --list            solo elenco entry decodificate, nessuna estrazione
 *
 * ⚠️ Gli estratti sono materiale del gioco: restano nelle cartelle "estratti-*"
 * (gitignored, vedi la lezione del 02/08 in .gitignore). NON committarli.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MAGIC = 0x5a6f12e1;
const UASSET_MAGIC = 0x9e2a83c1;

// ── argomenti ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const pak = argv.find(a => !a.startsWith('--'));
const opt = name => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const soloLista = argv.includes('--list');
const salvaRaw = argv.includes('--raw');
const outDir = opt('out') || 'estratti-arcadia';
const filtro = new RegExp(
  opt('filter') || '(^|/)(ST_|DT_)[^/]*\\.uasset$|stringtable|string_table|datatable|subtitle|dialog',
  'i'
);

if (!pak || !fs.existsSync(pak)) {
  console.error('Uso: node scripts/ue-pak-extract-stringtables.js "<percorso .pak>" [--filter re] [--out dir] [--list]');
  process.exit(2);
}

// ── letture di base ──────────────────────────────────────────────────────────
function leggi(fd, offset, size) {
  const buf = Buffer.alloc(size);
  fs.readSync(fd, buf, 0, size, offset);
  return buf;
}

/** FString UE: [i32 len][bytes]. len<0 = UTF-16, |len| in caratteri (NUL incluso). */
function fstring(buf, pos) {
  const len = buf.readInt32LE(pos);
  pos += 4;
  if (len === 0) return { s: '', pos };
  if (len > 0) return { s: buf.toString('utf8', pos, pos + len - 1), pos: pos + len };
  const n = -len;
  return { s: buf.toString('utf16le', pos, pos + n * 2 - 2), pos: pos + n * 2 };
}

// ── footer: versione, indice, NOMI dei metodi di compressione ────────────────
// Layout dal magic in poi: magic(4) version(4) indexOffset(8) indexSize(8)
// indexHash(20) poi — v8.0: 4 nomi da 32 byte, v8.1+: 5 nomi. Indice 0 = None,
// indice i>0 = nomi[i-1]. Il flag "indice cifrato" è il byte PRIMA del magic.
function trovaFooter(fd, fileSize) {
  const coda = leggi(fd, Math.max(0, fileSize - 1024), Math.min(1024, fileSize));
  for (let off = coda.length - 4; off >= 0; off--) {
    if (coda.readUInt32LE(off) !== MAGIC) continue;
    const version = coda.readUInt32LE(off + 4);
    if (version < 1 || version > 12) continue;
    const indexOffset = Number(coda.readBigUInt64LE(off + 8));
    const indexSize = Number(coda.readBigUInt64LE(off + 16));
    if (indexOffset <= 0 || indexOffset >= fileSize) continue;
    if (indexSize <= 0 || indexOffset + indexSize > fileSize) continue;
    const encrypted = off > 0 && coda[off - 1] === 1;
    const metodi = ['None'];
    if (version >= 8) {
      let p = off + 4 + 4 + 8 + 8 + 20;
      for (let i = 0; i < 5 && p + 32 <= coda.length; i++, p += 32) {
        const nome = coda.toString('utf8', p, p + 32).replace(/\0.*$/s, '');
        if (nome) metodi.push(nome);
      }
    }
    return { version, indexOffset, indexSize, encrypted, metodi };
  }
  return null;
}

// ── indice primario v10+: arriva fino alle EncodedPakEntries ────────────────
function parseIndicePrimario(idx) {
  let p = 0;
  const mp = fstring(idx, p); p = mp.pos;
  const numEntries = idx.readInt32LE(p); p += 4;
  p += 8; // PathHashSeed
  const hasPathHash = idx.readInt32LE(p); p += 4;
  if (hasPathHash) p += 8 + 8 + 20; // offset + size + hash
  const hasFullDir = idx.readInt32LE(p); p += 4;
  if (!hasFullDir) throw new Error('nessun Full Directory Index nel pak');
  const fdOff = Number(idx.readBigInt64LE(p)); p += 8;
  const fdSize = Number(idx.readBigInt64LE(p)); p += 8;
  p += 20; // hash del directory index — la sonda si fermava PRIMA di qui
  const encSize = idx.readInt32LE(p); p += 4;
  const encoded = idx.subarray(p, p + encSize); p += encSize;
  const numNonEncoded = idx.readInt32LE(p); p += 4;
  return { mountPoint: mp.s, numEntries, fdOff, fdSize, encoded, numNonEncoded };
}

// ── full directory index: percorso → offset dentro EncodedPakEntries ────────
function leggiDirectory(dir) {
  const mappa = new Map();
  let q = 0;
  const numDirs = dir.readInt32LE(q); q += 4;
  for (let i = 0; i < numDirs; i++) {
    const d = fstring(dir, q); q = d.pos;
    const numFiles = dir.readInt32LE(q); q += 4;
    for (let j = 0; j < numFiles; j++) {
      const fn = fstring(dir, q); q = fn.pos;
      const loc = dir.readInt32LE(q); q += 4; // il numero che la sonda saltava
      mappa.set(`${d.s}${fn.s}`, loc);
    }
  }
  return mappa;
}

/**
 * Decodifica di una EncodedPakEntry (FPakFile::DecodePakEntry).
 * u32 di testa: bit31 offset a 32 bit · bit30 uncompressed a 32 bit ·
 * bit29 size a 32 bit · bit28..23 indice metodo compressione · bit22 cifrato ·
 * bit21..6 numero blocchi · bit5..0 block size >>11 (0x3f ⇒ u32 esplicito).
 */
function decodeEntry(enc, off) {
  let p = off;
  const value = enc.readUInt32LE(p); p += 4;
  const metodo = (value >>> 23) & 0x3f;
  const cifrato = (value & (1 << 22)) !== 0;
  const numBlocchi = (value >>> 6) & 0xffff;

  let offset, uncompressed, size;
  if (value & (1 << 31)) { offset = enc.readUInt32LE(p); p += 4; }
  else { offset = Number(enc.readBigInt64LE(p)); p += 8; }
  if (value & (1 << 30)) { uncompressed = enc.readUInt32LE(p); p += 4; }
  else { uncompressed = Number(enc.readBigInt64LE(p)); p += 8; }
  if (metodo !== 0) {
    if (value & (1 << 29)) { size = enc.readUInt32LE(p); p += 4; }
    else { size = Number(enc.readBigInt64LE(p)); p += 8; }
  } else size = uncompressed;

  let blockSize = 0;
  if (numBlocchi > 0) {
    if ((value & 0x3f) === 0x3f) { blockSize = enc.readUInt32LE(p); p += 4; }
    else blockSize = (value & 0x3f) << 11;
  }

  // Dimensione dell'header FPakEntry che nel pak PRECEDE i dati del file
  // (offset+size+uncompressed 8×3, indice metodo 4, sha1 20, flags 1,
  //  blocksize 4; se compresso: contatore 4 + 16 per blocco).
  const structSize = 53 + (metodo !== 0 ? 4 + numBlocchi * 16 : 0);

  const blocchi = [];
  if (numBlocchi === 1 && !cifrato) {
    blocchi.push({ start: offset + structSize, len: size });
  } else if (numBlocchi > 0) {
    let cum = structSize;
    for (let i = 0; i < numBlocchi; i++) {
      const bs = enc.readUInt32LE(p); p += 4;
      blocchi.push({ start: offset + cum, len: bs });
      cum += cifrato ? Math.ceil(bs / 16) * 16 : bs;
    }
  }
  return { offset, size, uncompressed, metodo, cifrato, numBlocchi, blockSize, structSize, blocchi };
}

// ── estrazione + decompressione ─────────────────────────────────────────────
// salvaRaw: se impostato (--raw), i blocchi Oodle/LZ4 vengono salvati COMPRESSI
// con un manifest .oodle.json — li decomprime tools/oodle-probe (oozextract, MIT).
function estrai(fd, e, nomeMetodo, salvaRaw) {
  if (e.cifrato) throw new Error('entry cifrata: serve la chiave AES del gioco');
  if (e.metodo === 0) return leggi(fd, e.offset + e.structSize, e.size);

  const inflate = /^zlib$/i.test(nomeMetodo) ? zlib.inflateSync
    : /^gzip$/i.test(nomeMetodo) ? zlib.gunzipSync
    : null;
  if (!inflate && salvaRaw) {
    const blocchi = e.blocchi.map((b, i) => {
      const restante = e.uncompressed - i * e.blockSize;
      return {
        raw: leggi(fd, b.start, b.len),
        uncompressed: Math.min(e.blockSize || e.uncompressed, restante),
      };
    });
    return { rawBlocks: blocchi, metodo: nomeMetodo };
  }
  if (!inflate) throw new Error(`compressione «${nomeMetodo}» non decodificabile qui (Oodle/LZ4: usa --raw + tools/oodle-probe)`);

  const pezzi = [];
  for (const b of e.blocchi) pezzi.push(inflate(leggi(fd, b.start, b.len)));
  const out = Buffer.concat(pezzi);
  if (out.length !== e.uncompressed) {
    throw new Error(`decompresso ${out.length} byte, attesi ${e.uncompressed}`);
  }
  return out;
}

// ── scan stringhe: replica di scan_uasset_strings (unreal_iostore.rs:876) ───
function scanStringhe(data) {
  const trovate = [];
  let i = 0;
  while (i + 4 < data.length) {
    const len = data.readInt32LE(i);
    if (len >= 3 && len <= 2000) {
      const start = i + 4, end = start + len;
      if (end <= data.length && data[end - 1] === 0) {
        const s = data.toString('utf8', start, end - 1);
        if (/^[\x20-\x7e\xc0-\xff][^\x00-\x08\x0b\x0c\x0e-\x1f]*$/.test(s) && /[a-zA-Z]{3}/.test(s)) {
          trovate.push(s);
          i = end;
          continue;
        }
      }
    }
    // UTF-16 (len negativo)
    if (len <= -3 && len >= -2000) {
      const n = -len, start = i + 4, end = start + n * 2;
      if (end <= data.length && data.readUInt16LE(end - 2) === 0) {
        const s = data.toString('utf16le', start, end - 2);
        if (/[a-zA-Z]{3}/.test(s)) { trovate.push(s); i = end; continue; }
      }
    }
    i++;
  }
  return trovate;
}

// ── main ────────────────────────────────────────────────────────────────────
function main() {
  const size = fs.statSync(pak).size;
  console.log(`📦 ${pak} (${(size / 1024 ** 3).toFixed(2)} GB)`);
  const fd = fs.openSync(pak, 'r');
  try {
    const f = trovaFooter(fd, size);
    if (!f) { console.log('❌ Footer non riconosciuto.'); process.exit(1); }
    if (f.encrypted) { console.log('⛔ Indice cifrato: serve la chiave AES.'); process.exit(1); }
    if (f.version < 10) { console.log(`⛔ pak v${f.version}: questo script gestisce v10+ (EncodedPakEntries).`); process.exit(1); }
    console.log(`   v${f.version} · metodi compressione: [${f.metodi.join(', ')}]`);

    const idx = leggi(fd, f.indexOffset, f.indexSize);
    const pi = parseIndicePrimario(idx);
    console.log(`   mount "${pi.mountPoint}" · ${pi.numEntries.toLocaleString('it-IT')} entry · EncodedPakEntries: ${(pi.encoded.length / 1024).toFixed(0)} KB · non codificate: ${pi.numNonEncoded}`);

    const mappa = leggiDirectory(leggi(fd, pi.fdOff, pi.fdSize));

    // --dump-paths <file>: scrive TUTTI i percorsi dell'indice e finisce lì.
    // Serve quando la caccia per regex fallisce: si guarda l'elenco intero
    // invece di indovinare il filtro giusto (lezione American Arcadia 05/08:
    // le ST_ «giuste» contenevano solo chiavi, il testo vive altrove).
    const dumpFile = opt('dump-paths');
    if (dumpFile) {
      fs.writeFileSync(dumpFile, [...mappa.keys()].sort().join('\n') + '\n');
      console.log(`\n📝 ${mappa.size.toLocaleString('it-IT')} percorsi scritti in ${dumpFile}`);
      return;
    }

    // candidati: filtro sul percorso, mai Engine/, e per ogni .uasset anche
    // i fratelli .uexp/.ubulk (nei cooked le stringhe stanno quasi sempre nel .uexp)
    const tutti = [...mappa.keys()];
    const base = tutti.filter(n => filtro.test(n) && !/^Engine\//i.test(n));
    const scelti = new Set(base);
    for (const n of base) {
      if (/\.uasset$/i.test(n)) {
        for (const ext of ['.uexp', '.ubulk']) {
          const fr = n.replace(/\.uasset$/i, ext);
          if (mappa.has(fr)) scelti.add(fr);
        }
      }
    }
    console.log(`\n🔍 Candidati: ${base.length} (+${scelti.size - base.length} .uexp/.ubulk fratelli) su ${tutti.length.toLocaleString('it-IT')} file`);
    if (!base.length) { console.log('   Niente da fare col filtro attuale. Prova --filter.'); process.exit(1); }

    let estratti = 0, stringheTotali = 0, errori = 0;
    for (const nome of [...scelti].sort()) {
      const loc = mappa.get(nome);
      let e;
      try {
        if (loc < 0) throw new Error(`entry non codificata (indice ${-loc - 1}): variante non ancora gestita`);
        e = decodeEntry(pi.encoded, loc);
      } catch (err) {
        console.log(`   ❌ ${nome}: decodifica fallita — ${err.message}`);
        errori++;
        continue;
      }
      const met = f.metodi[e.metodo] || `#${e.metodo}`;
      const riga = `${nome} · ${met}${e.cifrato ? ' ·🔒' : ''} · ${e.size.toLocaleString('it-IT')} → ${e.uncompressed.toLocaleString('it-IT')} byte · ${e.numBlocchi} blocchi @ offset ${e.offset.toLocaleString('it-IT')}`;
      if (soloLista) { console.log(`   · ${riga}`); continue; }

      try {
        const dati = estrai(fd, e, met, salvaRaw);
        const dest = path.join(outDir, nome);
        fs.mkdirSync(path.dirname(dest), { recursive: true });

        if (dati.rawBlocks) {
          // Blocchi compressi + manifest per tools/oodle-probe
          const manifest = { file: nome, metodo: dati.metodo, uncompressedSize: e.uncompressed, blocks: [] };
          dati.rawBlocks.forEach((b, i) => {
            const bin = `${dest}.oodleblk${i}`;
            fs.writeFileSync(bin, b.raw);
            manifest.blocks.push({ bin: path.basename(bin), rawSize: b.raw.length, uncompressedSize: b.uncompressed });
          });
          fs.writeFileSync(`${dest}.oodle.json`, JSON.stringify(manifest, null, 2));
          estratti++;
          console.log(`   📦 ${riga} → ${dati.rawBlocks.length} blocchi raw + manifest (decomprimere con tools/oodle-probe)`);
          continue;
        }

        fs.writeFileSync(dest, dati);
        estratti++;

        // PROVA DI EFFETTO — magic sui .uasset, stringhe vere sui .uexp
        if (/\.uasset$/i.test(nome)) {
          const magicOk = dati.length >= 4 && dati.readUInt32LE(0) === UASSET_MAGIC;
          console.log(`   ${magicOk ? '✅' : '⚠️ MAGIC ERRATO'} ${riga}`);
          if (!magicOk) console.log(`      primi 4 byte: ${dati.subarray(0, 4).toString('hex')} (attesi c1832a9e LE) — decodifica entry da rivedere`);
        } else {
          const stringhe = scanStringhe(dati).filter(s => s.length > 8 && / /.test(s));
          stringheTotali += stringhe.length;
          console.log(`   ✅ ${riga}`);
          if (stringhe.length) {
            console.log(`      ${stringhe.length} stringhe con spazi — campione:`);
            for (const s of stringhe.slice(0, 3)) console.log(`      “${s.length > 90 ? s.slice(0, 90) + '…' : s}”`);
          }
        }
      } catch (err) {
        console.log(`   ❌ ${nome}: ${err.message}`);
        errori++;
      }
    }

    if (!soloLista) {
      console.log(`\n📊 Estratti ${estratti}/${scelti.size} file in ${outDir}/ · ${stringheTotali} stringhe di dialogo trovate · ${errori} errori`);
      if (stringheTotali > 0) {
        console.log('✅ VERDETTO: i testi del gioco sono raggiungibili con seek mirate. Prossimo: portare la via in Rust (parse EncodedPakEntries + scan_uasset_strings).');
      } else if (estratti > 0) {
        console.log('⚠️ VERDETTO: file estratti ma nessuna stringa di dialogo — guardare i .uexp a mano prima di dichiarare alcunché.');
      } else {
        console.log('❌ VERDETTO: nessuna estrazione riuscita — leggere gli errori qui sopra, non aggirarli.');
      }
      console.log(`⚠️ ${outDir}/ è materiale del gioco: resta fuori dal repo (glob /estratti*/), non committare.`);
    }
  } finally {
    fs.closeSync(fd);
  }
}

main();
