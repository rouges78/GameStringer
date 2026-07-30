#!/usr/bin/env node
/**
 * Verifica del formato .locres contro FILE VERI.
 *
 * PERCHÉ ESISTE
 * -------------
 * Fino al 30/07/2026 il writer .locres di GameStringer scriveva un magic
 * INVENTATO: quattro byte 0x0E14DA7A. Il magic vero di UE è un FGuid da SEDICI
 * byte — `FGuid(0x7574140E, 0xFC034A67, 0x9D90154A, 0x1B7F37C3)` — e i file
 * Legacy (v0) non ne hanno affatto uno. Ogni .locres che abbiamo prodotto era
 * quindi un file che Unreal non carica.
 *
 * Il difetto è sopravvissuto ai test per mesi per una ragione sola: i test
 * erano CIRCOLARI. Le fixture le generava lo stesso writer che dovevano
 * validare, quindi il round-trip passava sempre — dimostrava che sapevamo
 * rileggere la nostra invenzione, non che fosse il formato di UE.
 *
 * Questo script rompe il cerchio: legge .locres prodotti da UNREAL, non da noi.
 *
 * COSA MISURA
 *   1. Magic e versione realmente presenti nei file dei giochi installati.
 *   2. Layout dell'header: che il campo dopo la versione sia un OFFSET assoluto
 *      al string array e non il conteggio delle stringhe.
 *   3. ⭐ L'HASH — la domanda ancora aperta. Per ogni namespace/key ricalcola il
 *      nostro `cityhash32` (crc32 * 0x9e3779b9, un valore inventato) e lo
 *      confronta con l'hash che il file contiene davvero. Se la corrispondenza
 *      non è ~100%, i .locres v2/v3 che scriviamo hanno hash sbagliati: se UE
 *      si fida dell'hash salvato per indicizzare le stringhe, le entry restano
 *      NON TROVABILI a runtime e il gioco resta in lingua originale senza dare
 *      errore. In quel caso l'unico formato sicuro è v0 Legacy, che hash non ne
 *      ha. È una domanda da misurare, non da dedurre.
 *      LIMITE ONESTO: questo script sa dire "non è il nostro", non "è
 *      quest'altro" — i candidati veri (CityHash64/UTF-16 per v2, FCrc::StrCrc32
 *      per v3, che NON è la crc32 IEEE) non sono implementati qui, e non vanno
 *      implementati a memoria: da portare dal sorgente UE quando serviranno.
 *      DA VERIFICARE su sorgente Epic: per versioni < v3 il loader potrebbe
 *      SCARTARE l'hash salvato e ricalcolarlo (SerializeDiscardHash) — se è
 *      così, l'hash sbagliato in v2 è innocuo e conta solo dalla v3. Finché non
 *      è letto nel sorgente, restiamo prudenti: v0 in scrittura.
 *   4. Come i giochi veri codificano le stringhe accentate (ANSI a byte singolo
 *      con lunghezza positiva vs UTF-16 con lunghezza negativa).
 *
 * SOLA LETTURA: apre i .locres, li legge e li richiude. Non scrive niente, non
 * modifica nessun gioco, non lancia niente.
 *
 * Uso:
 *   node scripts/ue-locres-check.js                       # cerca le librerie Steam
 *   node scripts/ue-locres-check.js "D:/Giochi"           # cartelle a mano
 *   node scripts/ue-locres-check.js --file "C:/.../Game.locres"
 *   node scripts/ue-locres-check.js --json
 *
 * NB: i giochi UE5 con IoStore tengono i .locres dentro .utoc/.ucas compressi
 * con Oodle e questo script NON li apre — cerca i .locres SCIOMPATTATI su disco
 * (frequenti nei giochi UE4). Se non ne trova nessuno, non è un difetto dello
 * script: è il blocco già documentato in [ue5-oodle-blocco].
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════
// Costanti di formato (dalla documentazione Epic)
// ═══════════════════════════════════════════════════════════════════

/** FGuid(0x7574140E, 0xFC034A67, 0x9D90154A, 0x1B7F37C3), quattro u32 LE. */
const LOCRES_MAGIC = Buffer.from([
  0x0e, 0x14, 0x74, 0x75, 0x67, 0x4a, 0x03, 0xfc,
  0x4a, 0x15, 0x90, 0x9d, 0xc3, 0x37, 0x7f, 0x1b,
]);

/** Il magic inventato che abbiamo scritto fino al 30/07/2026. */
const BOGUS_MAGIC = Buffer.from([0x0e, 0x14, 0xda, 0x7a]);

const VERSION_NAMES = {
  0: 'Legacy',
  1: 'Compact',
  2: 'Optimized (CityHash64/UTF-16)',
  3: 'Optimized_CRC32',
};

// ═══════════════════════════════════════════════════════════════════
// L'hash che scriviamo noi (port esatto di cityhash32 in unreal_localization.rs)
// ═══════════════════════════════════════════════════════════════════

const CRC32_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Replica bit per bit `cityhash32` del Rust: crc32(s) * 0x9e3779b9 (wrapping). */
function ourHash(str) {
  const h = crc32(Buffer.from(str, 'utf8'));
  return Number((BigInt(h) * 0x9e3779b9n) & 0xffffffffn);
}

// ═══════════════════════════════════════════════════════════════════
// Lettura binaria
// ═══════════════════════════════════════════════════════════════════

class Reader {
  constructor(buf) {
    this.buf = buf;
    this.pos = 0;
  }
  need(n) {
    if (this.pos + n > this.buf.length) {
      throw new Error(`EOF: servono ${n} byte a offset ${this.pos}, file di ${this.buf.length}`);
    }
  }
  u8() { this.need(1); return this.buf[this.pos++]; }
  i32() { this.need(4); const v = this.buf.readInt32LE(this.pos); this.pos += 4; return v; }
  u32() { this.need(4); const v = this.buf.readUInt32LE(this.pos); this.pos += 4; return v; }
  i64() { this.need(8); const v = this.buf.readBigInt64LE(this.pos); this.pos += 8; return Number(v); }

  /**
   * FString di UE. Lunghezza POSITIVA = ANSI a byte singolo (NON UTF-8),
   * NEGATIVA = UTF-16LE. In entrambi i casi include il terminatore nullo.
   */
  fstring() {
    const len = this.i32();
    if (len === 0) return { value: '', encoding: 'empty' };

    if (len > 0) {
      this.need(len);
      const bytes = this.buf.subarray(this.pos, this.pos + len);
      this.pos += len;
      const end = bytes.indexOf(0) === -1 ? bytes.length : bytes.indexOf(0);
      return { value: bytes.subarray(0, end).toString('latin1'), encoding: 'ansi' };
    }

    const units = -len;
    this.need(units * 2);
    const bytes = this.buf.subarray(this.pos, this.pos + units * 2);
    this.pos += units * 2;
    let str = bytes.toString('utf16le');
    const nul = str.indexOf('\u0000');
    if (nul !== -1) str = str.slice(0, nul);
    return { value: str, encoding: 'utf16' };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Parser .locres
// ═══════════════════════════════════════════════════════════════════

function parseLocres(buf) {
  const report = {
    bytes: buf.length,
    hasMagic: false,
    hasBogusMagic: false,
    version: null,
    versionName: null,
    stringArrayOffset: null,
    stringArrayCount: 0,
    entriesCountField: null,
    namespaces: 0,
    entries: 0,
    hashesChecked: 0,
    hashesMatchingOurs: 0,
    hashSamples: [],
    encodings: { ansi: 0, utf16: 0, empty: 0 },
    accentedAnsi: 0,
    accentedUtf16: 0,
    sample: [],
  };

  const r = new Reader(buf);

  if (buf.length >= 16 && buf.subarray(0, 16).equals(LOCRES_MAGIC)) {
    report.hasMagic = true;
    r.pos = 16;
    report.version = r.u8();
  } else {
    if (buf.length >= 4 && buf.subarray(0, 4).equals(BOGUS_MAGIC)) report.hasBogusMagic = true;
    report.version = 0; // Legacy: nessun header
  }
  report.versionName = VERSION_NAMES[report.version] || `sconosciuta (${report.version})`;

  if (report.version > 3) throw new Error(`versione ${report.version} oltre le note`);

  const noteEncoding = (fs_) => {
    report.encodings[fs_.encoding]++;
    // eslint-disable-next-line no-control-regex
    if (/[^\x00-\x7F]/.test(fs_.value)) {
      if (fs_.encoding === 'ansi') report.accentedAnsi++;
      else if (fs_.encoding === 'utf16') report.accentedUtf16++;
    }
  };

  // String array: dalla v1 l'header contiene un OFFSET assoluto, non un conteggio
  const stringArray = [];
  if (report.version >= 1) {
    const offset = r.i64();
    report.stringArrayOffset = offset;

    if (offset >= 0) {
      if (offset > buf.length) throw new Error(`offset string array ${offset} fuori dal file`);
      const ar = new Reader(buf);
      ar.pos = offset;
      const count = ar.i32();
      if (count < 0 || count > 5_000_000) throw new Error(`conteggio stringhe assurdo: ${count}`);
      report.stringArrayCount = count;
      for (let i = 0; i < count; i++) {
        const s = ar.fstring();
        noteEncoding(s);
        if (report.version >= 2) ar.i32(); // refcount
        stringArray.push(s.value);
      }
    }
  }

  if (report.version >= 3) report.entriesCountField = r.u32();

  const nsCount = r.i32();
  if (nsCount < 0 || nsCount > 100_000) throw new Error(`namespace assurdi: ${nsCount}`);
  report.namespaces = nsCount;

  for (let n = 0; n < nsCount; n++) {
    let nsHash = null;
    if (report.version >= 2) nsHash = r.u32();
    const ns = r.fstring();
    noteEncoding(ns);

    if (nsHash !== null) {
      report.hashesChecked++;
      const ours = ourHash(ns.value);
      if (ours === nsHash) report.hashesMatchingOurs++;
      else if (report.hashSamples.length < 5) {
        report.hashSamples.push({
          testo: ns.value || '(namespace vuoto)',
          nelFile: '0x' + nsHash.toString(16).padStart(8, '0'),
          nostro: '0x' + ours.toString(16).padStart(8, '0'),
        });
      }
    }

    const entryCount = r.i32();
    if (entryCount < 0 || entryCount > 2_000_000) throw new Error(`entry assurde: ${entryCount}`);

    for (let e = 0; e < entryCount; e++) {
      let keyHash = null;
      if (report.version >= 2) keyHash = r.u32();
      const key = r.fstring();
      noteEncoding(key);
      const sourceHash = r.u32();

      if (keyHash !== null) {
        report.hashesChecked++;
        const ours = ourHash(key.value);
        if (ours === keyHash) report.hashesMatchingOurs++;
        else if (report.hashSamples.length < 5) {
          report.hashSamples.push({
            testo: key.value,
            nelFile: '0x' + keyHash.toString(16).padStart(8, '0'),
            nostro: '0x' + ours.toString(16).padStart(8, '0'),
          });
        }
      }

      let value;
      if (report.version >= 1) {
        const idx = r.i32();
        value = idx >= 0 && idx < stringArray.length ? stringArray[idx] : null;
      } else {
        const v = r.fstring();
        noteEncoding(v);
        value = v.value;
      }

      report.entries++;
      if (report.sample.length < 3 && value) {
        report.sample.push({ ns: ns.value, key: key.value, sourceHash, value: value.slice(0, 60) });
      }
    }
  }

  report.trailingBytes = report.version >= 1 && report.stringArrayOffset >= 0
    ? Math.max(0, report.stringArrayOffset - r.pos)
    : buf.length - r.pos;

  return report;
}

// ═══════════════════════════════════════════════════════════════════
// Ricerca file
// ═══════════════════════════════════════════════════════════════════

function steamLibraries() {
  const roots = [];
  const candidates = [
    'C:/Program Files (x86)/Steam/steamapps/common',
    'C:/Program Files/Steam/steamapps/common',
    'D:/SteamLibrary/steamapps/common',
    'E:/SteamLibrary/steamapps/common',
    'F:/SteamLibrary/steamapps/common',
    'G:/SteamLibrary/steamapps/common',
  ];
  for (const c of candidates) {
    try { if (fs.statSync(c).isDirectory()) roots.push(c); } catch { /* assente */ }
  }
  return roots;
}

function findLocres(root, maxDepth = 10) {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth || found.length >= 400) return;
    let items;
    try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const it of items) {
      if (found.length >= 400) return; // il limite vale anche dentro una singola cartella
      const p = path.join(dir, it.name);
      if (it.isDirectory()) walk(p, depth + 1);
      else if (it.name.toLowerCase().endsWith('.locres')) found.push(p);
    }
  };
  walk(root, 0);
  return found;
}

// ═══════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const args = argv.filter((a) => a !== '--json');

  let files = [];
  const fileFlag = args.indexOf('--file');
  if (fileFlag !== -1) {
    const target = args[fileFlag + 1];
    if (!target) {
      console.error('--file richiede un percorso: node scripts/ue-locres-check.js --file "C:/.../Game.locres"');
      process.exit(2);
    }
    files = [target];
  } else {
    const roots = args.length ? args : steamLibraries();
    if (!roots.length) {
      console.error('Nessuna libreria Steam trovata. Passa una cartella: node scripts/ue-locres-check.js "D:/Giochi"');
      process.exit(2);
    }
    if (!json) console.log(`Cerco .locres in ${roots.length} cartell${roots.length === 1 ? 'a' : 'e'}...\n`);
    for (const root of roots) files.push(...findLocres(root));
  }

  if (!files.length) {
    if (json) { console.log(JSON.stringify({ files: [], note: 'nessun .locres scompattato trovato' }, null, 2)); return; }
    console.log('Nessun .locres SCOMPATTATO trovato.');
    console.log('Non è un errore: i giochi UE5 con IoStore li tengono dentro .utoc/.ucas');
    console.log('compressi con Oodle, che questo script non apre (vedi [ue5-oodle-blocco]).');
    console.log('Serve un gioco UE4 con i file di localizzazione sciolti su disco.');
    process.exit(1);
  }

  const results = [];
  const totals = {
    ok: 0, falliti: 0, conMagic: 0, conMagicFasullo: 0,
    hashChecked: 0, hashMatch: 0,
    accentedAnsi: 0, accentedUtf16: 0,
    versioni: {},
  };

  for (const f of files) {
    try {
      const buf = fs.readFileSync(f);
      const rep = parseLocres(buf);
      rep.file = f;
      results.push(rep);
      totals.ok++;
      if (rep.hasMagic) totals.conMagic++;
      if (rep.hasBogusMagic) totals.conMagicFasullo++;
      totals.hashChecked += rep.hashesChecked;
      totals.hashMatch += rep.hashesMatchingOurs;
      totals.accentedAnsi += rep.accentedAnsi;
      totals.accentedUtf16 += rep.accentedUtf16;
      totals.versioni[rep.versionName] = (totals.versioni[rep.versionName] || 0) + 1;
    } catch (err) {
      results.push({ file: f, errore: err.message });
      totals.falliti++;
    }
  }

  if (json) {
    console.log(JSON.stringify({ totals, results }, null, 2));
    return;
  }

  for (const r of results.slice(0, 15)) {
    console.log('─'.repeat(72));
    console.log(path.basename(r.file));
    console.log(`  ${r.file}`);
    if (r.errore) { console.log(`  ⛔ NON PARSATO: ${r.errore}`); continue; }
    console.log(`  versione: ${r.versionName}  ·  magic: ${r.hasMagic ? 'presente (16 byte)' : 'assente (Legacy)'}`);
    if (r.hasBogusMagic) console.log('  ⛔ questo file ha il MAGIC FASULLO: l\'abbiamo scritto noi, UE non lo carica');
    if (r.stringArrayOffset !== null) {
      console.log(`  string array: offset ${r.stringArrayOffset} · ${r.stringArrayCount} stringhe condivise`);
    }
    if (r.trailingBytes !== 0) {
      console.log(`  ⚠️ ${r.trailingBytes} byte fra la fine dei namespace e lo string array: layout diverso da quello assunto`);
    }
    console.log(`  ${r.namespaces} namespace · ${r.entries} entry`);
    console.log(`  codifiche: ${r.encodings.ansi} ANSI · ${r.encodings.utf16} UTF-16 · ${r.encodings.empty} vuote`);
    if (r.accentedAnsi) console.log(`  ⚠️ ${r.accentedAnsi} stringhe non-ASCII marcate ANSI`);
    if (r.hashesChecked) {
      const pct = ((r.hashesMatchingOurs / r.hashesChecked) * 100).toFixed(1);
      console.log(`  hash: ${r.hashesMatchingOurs}/${r.hashesChecked} combaciano col nostro (${pct}%)`);
      for (const s of r.hashSamples) {
        console.log(`     "${s.testo}"  file=${s.nelFile}  nostro=${s.nostro}`);
      }
    }
    for (const s of r.sample) console.log(`  es. [${s.ns}] ${s.key} = "${s.value}"`);
  }

  if (results.length > 15) console.log(`\n… e altri ${results.length - 15} file (usa --json per tutti).`);

  console.log('\n' + '═'.repeat(72));
  console.log('VERDETTO');
  console.log('═'.repeat(72));
  console.log(`File letti: ${totals.ok} · non parsati: ${totals.falliti}`);
  console.log(`Con magic da 16 byte: ${totals.conMagic}/${totals.ok}`);
  console.log('Versioni trovate: ' + (Object.entries(totals.versioni).map(([k, v]) => `${k} × ${v}`).join(' · ') || 'nessuna'));

  if (totals.conMagicFasullo) {
    console.log(`\n⛔ ${totals.conMagicFasullo} file col magic inventato da noi: sono nostri, e UE non li carica.`);
  }

  console.log('\n── LA DOMANDA APERTA: l\'hash ──');
  if (!totals.hashChecked) {
    console.log('Nessun file v2/v3 fra quelli trovati: gli hash non compaiono nel formato Legacy,');
    console.log('quindi la domanda resta aperta. Serve un gioco che spedisca .locres v2 o v3.');
  } else {
    const pct = ((totals.hashMatch / totals.hashChecked) * 100).toFixed(1);
    console.log(`${totals.hashMatch}/${totals.hashChecked} hash combaciano col nostro cityhash32 (${pct}%)`);
    if (totals.hashMatch === 0) {
      console.log('\n⛔ RISPOSTA: ZERO. Il nostro hash non è quello di UE, come sospettato.');
      console.log('   → i .locres v2/v3 che scriviamo hanno hash sbagliati.');
      console.log('   → finché non implementiamo CityHash64/UTF-16 (v2) o FCrc::StrCrc32 (v3),');
      console.log('     l\'unico formato sicuro da SCRIVERE è v0 Legacy, che hash non ne ha.');
    } else if (totals.hashMatch === totals.hashChecked) {
      console.log('\n✅ RISPOSTA: combaciano tutti. Inatteso — ricontrollare prima di fidarsi.');
    } else {
      console.log('\n⚠️ RISPOSTA: parziale. Un hash che combacia a metà è un hash sbagliato.');
    }
  }

  console.log('\n── Codifica delle stringhe ──');
  console.log(`Non-ASCII in UTF-16 (lunghezza negativa): ${totals.accentedUtf16}`);
  console.log(`Non-ASCII marcate ANSI: ${totals.accentedAnsi}`);
  if (totals.accentedUtf16 > 0 && totals.accentedAnsi === 0) {
    console.log('→ conferma: i giochi veri mettono gli accenti in UTF-16, mai in ANSI.');
  }

  // Uscita ≠ 0 se non c'è niente da misurare O se troviamo file nostri col
  // magic fasullo in giro: sono .locres che UE non carica, non un dettaglio.
  process.exit(totals.ok === 0 || totals.conMagicFasullo > 0 ? 1 : 0);
}

if (require.main === module) main();

module.exports = { parseLocres, ourHash, LOCRES_MAGIC };
