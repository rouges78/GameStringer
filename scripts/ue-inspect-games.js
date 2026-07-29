#!/usr/bin/env node
/**
 * Censimento dei giochi Unreal installati — quali formati abbiamo DAVVERO
 * sotto mano per collaudare il writer.
 *
 * Nasce dall'ADR-002: sei pezzi mancanti nel percorso IoStore, e una decisione
 * esplicita di non implementarli senza un gioco vero su cui provare — «mai
 * spedire un writer binario plausibile ma sbagliato che l'utente non può
 * verificare». Prima di scegliere quale pezzo attaccare serve sapere cosa c'è.
 *
 * SOLA LETTURA: apre i file per leggerne gli header e li richiude. Non scrive,
 * non modifica, non estrae niente.
 *
 * Uso:
 *   node scripts/ue-inspect-games.js                     # cerca da solo le librerie Steam
 *   node scripts/ue-inspect-games.js "D:/Giochi" "E:/GOG" # più cartelle a mano
 *   node scripts/ue-inspect-games.js --json              # output JSON
 */

const fs = require('fs');
const path = require('path');

// Le stesse costanti del parser Rust (src-tauri/src/commands/unreal_iostore.rs),
// così il referto dice quello che vedrebbe l'app.
const UTOC_MAGIC = Buffer.from('-==--==--==--==-', 'ascii');
const UTOC_MAX_KNOWN_VERSION = 5; // UE 5.3 = v5 (PerfectHash)
const PAK_MAGIC = 0x5a6f12e1;

const MAX_DEPTH = 6;
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const deep = args.includes('--deep');
const cercaOodle = args.includes('--find-oodle');
const rootsFromArgs = args.filter((a) => !a.startsWith('--'));

// ── Dove cercare ──────────────────────────────────────────────────────────

function steamLibraries() {
  const out = [];
  const candidati = [
    'C:/Program Files (x86)/Steam/steamapps/libraryfolders.vdf',
    'C:/Program Files/Steam/steamapps/libraryfolders.vdf',
  ];
  for (const lettera of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
    candidati.push(`${lettera}:/SteamLibrary/steamapps/libraryfolders.vdf`);
  }
  for (const vdf of candidati) {
    if (!fs.existsSync(vdf)) continue;
    try {
      const testo = fs.readFileSync(vdf, 'utf8');
      // "path"    "D:\\SteamLibrary"
      for (const m of testo.matchAll(/"path"\s+"([^"]+)"/g)) {
        const comuni = path.join(m[1].replace(/\\\\/g, '/'), 'steamapps', 'common');
        if (fs.existsSync(comuni)) out.push(comuni);
      }
    } catch { /* vdf illeggibile: si prosegue */ }
  }
  // Cartelle comuni fuori Steam
  for (const lettera of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
    for (const nome of ['Games', 'Giochi', 'GOG Games', 'Epic Games']) {
      const p = `${lettera}:/${nome}`;
      if (fs.existsSync(p)) out.push(p);
    }
  }
  return [...new Set(out)];
}

// ── Lettura degli header ──────────────────────────────────────────────────

function leggiTesta(file, quanti) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(quanti);
    const letti = fs.readSync(fd, buf, 0, quanti, 0);
    return buf.subarray(0, letti);
  } catch {
    return null;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* già chiuso */ }
  }
}

/**
 * Header UTOC. Il layout è quello letto da parse_utoc_header in Rust: magic(16),
 * version(1), reserved(3), poi i campi u32.
 */
function ispezionaUtoc(file) {
  const b = leggiTesta(file, 144);
  if (!b || b.length < 80) return { errore: 'file troppo corto' };
  if (!b.subarray(0, 16).equals(UTOC_MAGIC)) return { errore: 'magic non valido' };

  let off = 16;
  const version = b.readUInt8(off); off += 4; // +3 reserved
  const headerSize = b.readUInt32LE(off); off += 4;
  const entryCount = b.readUInt32LE(off); off += 4;
  const blockCount = b.readUInt32LE(off); off += 4;
  off += 4;                                    // compressedBlockEntrySize
  const compressionMethodCount = b.readUInt32LE(off); off += 4;
  const compressionMethodLength = b.readUInt32LE(off); off += 4;
  const compressionBlockSize = b.readUInt32LE(off); off += 4;
  const directoryIndexSize = b.readUInt32LE(off); off += 4;
  const partitionCount = b.readUInt32LE(off); off += 4;
  off += 8;                                    // containerId
  const guid = b.subarray(off, off + 16); off += 16;
  const containerFlags = b.readUInt8(off); off += 1;

  // Campi introdotti dalle versioni successive: servono per calcolare dove
  // finiscono le sezioni intermedie.
  let perfectHashSeeds = 0;
  let chunksWithoutPh = 0;
  if (version >= 4) {
    off += 3;                                  // padding di allineamento
    perfectHashSeeds = b.readUInt32LE(off); off += 4;
    off += 8 * partitionCount;                 // PartitionSize per partizione
  }
  if (version >= 5 && off + 4 <= b.length) {
    chunksWithoutPh = b.readUInt32LE(off);
  }

  // I nomi dei metodi di compressione NON stanno subito dopo l'header: vanno
  // saltate ChunkIds (12B), OffsetAndLengths (10B), PerfectHashSeeds (4B),
  // ChunkIndicesWithoutPerfectHash (4B) e CompressedBlockEntries (12B).
  // Gli stessi offset di parse_utoc_data in unreal_iostore.rs — se qui si
  // sbaglia, si leggono byte a caso e si riporta "nessuna compressione" su un
  // gioco che invece usa Oodle.
  const metodi = [];
  if (compressionMethodCount > 0 && compressionMethodLength > 0 && compressionMethodLength <= 256) {
    const cmnOffset = headerSize
      + entryCount * 12
      + entryCount * 10
      + perfectHashSeeds * 4
      + chunksWithoutPh * 4
      + blockCount * 12;
    const fine = cmnOffset + compressionMethodCount * compressionMethodLength;
    const zona = leggiTesta(file, fine);
    if (zona && zona.length >= fine) {
      for (let i = 0; i < compressionMethodCount; i++) {
        const inizio = cmnOffset + i * compressionMethodLength;
        const nome = zona.subarray(inizio, inizio + compressionMethodLength)
          .toString('ascii').replace(/\0+$/, '').trim();
        if (nome) metodi.push(nome);
      }
    }
  }

  return {
    version,
    headerSize,
    entryCount,
    blockCount,
    partitionCount,
    compressionBlockSize,
    directoryIndexSize,
    compressionMethodCount,
    compressionMethodLength,
    perfectHashSeeds,
    chunksWithoutPh,
    metodi,
    // bit 0 = Compressed, bit 1 = Encrypted, bit 2 = Signed, bit 3 = Indexed
    compresso: !!(containerFlags & 0x1),
    cifrato: !!(containerFlags & 0x2),
    firmato: !!(containerFlags & 0x4),
    chiaveNonNulla: !guid.every((x) => x === 0),
    oltreIlNoto: version > UTOC_MAX_KNOWN_VERSION,
  };
}

/**
 * FString di Unreal: i32 con la lunghezza (negativa = UTF-16), poi i byte,
 * terminatore nullo incluso nel conteggio.
 */
function leggiFString(buf, stato) {
  if (stato.off + 4 > buf.length) throw new Error('FString oltre la fine');
  const len = buf.readInt32LE(stato.off); stato.off += 4;
  if (len === 0) return '';
  if (len > 0) {
    if (stato.off + len > buf.length) throw new Error('FString ASCII oltre la fine');
    const s = buf.subarray(stato.off, stato.off + len - 1).toString('latin1');
    stato.off += len;
    return s;
  }
  const n = -len;
  if (stato.off + n * 2 > buf.length) throw new Error('FString UTF-16 oltre la fine');
  const s = buf.subarray(stato.off, stato.off + (n - 1) * 2).toString('utf16le');
  stato.off += n * 2;
  return s;
}

/**
 * Quanti blocchi sono davvero compressi.
 *
 * Un CompressedBlockEntry con method_index == 0 è in chiaro, e il codice lo
 * legge senza mai chiamare Oodle. La domanda pratica: senza la DLL siamo
 * fermi del tutto, o resta comunque una parte leggibile?
 */
function contaBlocchi(file, h) {
  if (!h || h.errore || !h.blockCount) return null;

  const cbeOffset = h.headerSize
    + h.entryCount * 12
    + h.entryCount * 10
    + h.perfectHashSeeds * 4
    + h.chunksWithoutPh * 4;
  const fine = cbeOffset + h.blockCount * 12;

  const zona = leggiTesta(file, fine);
  if (!zona || zona.length < fine) return { errore: 'blocchi oltre la fine del file' };

  const perMetodo = {};
  let byteCompressi = 0;
  let byteInChiaro = 0;
  for (let i = 0; i < h.blockCount; i++) {
    const base = cbeOffset + i * 12;
    const compSize = zona[base + 5] | (zona[base + 6] << 8) | (zona[base + 7] << 16);
    const uncompSize = zona[base + 8] | (zona[base + 9] << 8) | (zona[base + 10] << 16);
    const idx = zona[base + 11];
    // Il codice di produzione salta la decompressione anche quando le due
    // dimensioni coincidono: stessa regola qui, per non mentire sul totale.
    const inChiaro = idx === 0 || compSize === uncompSize;
    const nome = inChiaro ? '(nessuna)' : (h.metodi[idx - 1] || `metodo ${idx}`);
    perMetodo[nome] = (perMetodo[nome] || 0) + 1;
    if (inChiaro) byteInChiaro += uncompSize; else byteCompressi += uncompSize;
  }
  const inChiaro = perMetodo['(nessuna)'] || 0;
  return {
    totale: h.blockCount,
    inChiaro,
    quotaInChiaro: inChiaro / h.blockCount,
    perMetodo,
    mbInChiaro: byteInChiaro / 1048576,
    mbCompressi: byteCompressi / 1048576,
  };
}

/**
 * Prova a leggere la DirectoryIndex assumendo il layout v5, che è quello che
 * il parser Rust conosce. Serve a rispondere a UNA domanda: su un container
 * v6/v8 quel layout regge ancora, o legge byte a caso?
 *
 * Se i percorsi che escono sono leggibili e plausibili, la struttura non è
 * cambiata dove ci interessa. Se esce spazzatura, il reader va adeguato prima
 * di pensare alla scrittura.
 */
function ispezionaDirectoryIndex(file, h) {
  if (!h || h.errore) return { errore: 'header non leggibile' };
  // `global.utoc` non ha indice per costruzione: contiene shader e script
  // referenziati per ChunkId, non per percorso. Non è un difetto e non va
  // riportato come tale.
  if (!h.directoryIndexSize) return { senzaIndice: true };

  const cmnOffset = h.headerSize
    + h.entryCount * 12
    + h.entryCount * 10
    + h.perfectHashSeeds * 4
    + h.chunksWithoutPh * 4
    + h.blockCount * 12;
  const dirOffset = cmnOffset + h.compressionMethodCount * h.compressionMethodLength;
  const fine = dirOffset + h.directoryIndexSize;

  const zona = leggiTesta(file, fine);
  if (!zona || zona.length < fine) {
    return { errore: `l'indice finirebbe a ${fine} ma il file è più corto (${zona ? zona.length : 0})` };
  }

  const dir = zona.subarray(dirOffset, fine);
  const stato = { off: 0 };
  try {
    const mountPoint = leggiFString(dir, stato);

    const dirCount = dir.readUInt32LE(stato.off); stato.off += 4;
    if (dirCount > 5_000_000) throw new Error(`dirCount assurdo: ${dirCount}`);
    stato.off += dirCount * 16;

    const fileCount = dir.readUInt32LE(stato.off); stato.off += 4;
    if (fileCount > 5_000_000) throw new Error(`fileCount assurdo: ${fileCount}`);
    stato.off += fileCount * 12;

    const stringCount = dir.readUInt32LE(stato.off); stato.off += 4;
    if (stringCount > 5_000_000) throw new Error(`stringCount assurdo: ${stringCount}`);

    const nomi = [];
    for (let i = 0; i < stringCount; i++) nomi.push(leggiFString(dir, stato));

    // Un nome "plausibile" è stampabile e senza byte di controllo: se il
    // layout fosse sbagliato leggeremmo binario, e questa quota crollerebbe.
    const plausibili = nomi.filter((n) => n.length > 0 && /^[\x20-\x7E]+$/.test(n)).length;
    const quota = nomi.length ? plausibili / nomi.length : 0;

    const estensioni = {};
    for (const n of nomi) {
      const m = n.match(/\.([a-zA-Z0-9]+)$/);
      if (m) estensioni[m[1].toLowerCase()] = (estensioni[m[1].toLowerCase()] || 0) + 1;
    }

    return {
      mountPoint,
      dirCount,
      fileCount,
      stringCount,
      quotaLeggibile: quota,
      esempi: nomi.filter((n) => n).slice(0, 8),
      estensioni,
      // Il byte finale letto deve coincidere con la dimensione dichiarata:
      // se avanza o manca roba, il layout non è quello.
      avanzo: dir.length - stato.off,
    };
  } catch (e) {
    return { errore: String(e && e.message ? e.message : e), offsetRaggiunto: stato.off };
  }
}

/** Versione .pak: il magic sta nel FOOTER, non in testa. */
function ispezionaPak(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const dim = fs.fstatSync(fd).size;
    // Il footer cambia di lunghezza fra le versioni: si cerca il magic
    // all'indietro negli ultimi 256 byte.
    const quanti = Math.min(256, dim);
    const buf = Buffer.alloc(quanti);
    fs.readSync(fd, buf, 0, quanti, dim - quanti);
    for (let i = buf.length - 4; i >= 0; i--) {
      if (buf.readUInt32LE(i) === PAK_MAGIC) {
        const version = i + 8 <= buf.length ? buf.readUInt32LE(i + 4) : 0;
        return { version, dimensione: dim };
      }
    }
    return { errore: 'magic pak non trovato nel footer', dimensione: dim };
  } catch (e) {
    return { errore: String(e && e.message ? e.message : e) };
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* già chiuso */ }
  }
}

// ── Scansione ─────────────────────────────────────────────────────────────

function cercaCartellePaks(radice, profondita = 0, trovate = []) {
  if (profondita > MAX_DEPTH || trovate.length > 400) return trovate;
  let voci;
  try {
    voci = fs.readdirSync(radice, { withFileTypes: true });
  } catch {
    return trovate; // permessi negati: si prosegue
  }
  for (const v of voci) {
    if (!v.isDirectory()) continue;
    const p = path.join(radice, v.name);
    if (v.name === 'Paks') { trovate.push(p); continue; }
    cercaCartellePaks(p, profondita + 1, trovate);
  }
  return trovate;
}

/** Dal percorso .../<Gioco>/<Progetto>/Content/Paks risale al nome del gioco. */
function nomeGioco(cartellaPaks) {
  const parti = cartellaPaks.split(/[\\/]/);
  const iContent = parti.lastIndexOf('Content');
  if (iContent >= 2) return parti[iContent - 2];
  return parti[Math.max(0, parti.length - 4)] || cartellaPaks;
}

function analizzaCartellaPaks(cartella) {
  let file;
  try {
    file = fs.readdirSync(cartella);
  } catch {
    return null;
  }

  const utoc = file.filter((f) => f.toLowerCase().endsWith('.utoc'));
  const pak = file.filter((f) => f.toLowerCase().endsWith('.pak'));
  const ucas = file.filter((f) => f.toLowerCase().endsWith('.ucas'));
  if (!utoc.length && !pak.length) return null;

  const gioco = {
    nome: nomeGioco(cartella),
    percorso: cartella,
    conteggi: { utoc: utoc.length, ucas: ucas.length, pak: pak.length },
    iostore: [],
    pak: [],
    locresSciolti: [],
  };

  for (const f of utoc.slice(0, 12)) {
    const percorso = path.join(cartella, f);
    const h = ispezionaUtoc(percorso);
    // La prova che conta su un container più recente della v5: il layout noto
    // regge ancora? Si fa solo con --deep perché legge l'indice per intero.
    if (deep && !h.errore) {
      h.indice = ispezionaDirectoryIndex(percorso, h);
      h.blocchi = contaBlocchi(percorso, h);
    }
    gioco.iostore.push({ file: f, ...h });
  }
  for (const f of pak.slice(0, 12)) {
    gioco.pak.push({ file: f, ...ispezionaPak(path.join(cartella, f)) });
  }

  // La DLL Oodle: senza, un container compresso con Oodle non si apre. La
  // domanda che conta è se il gioco se la porta dietro — perché in quel caso
  // basta cercarla lì invece di pretendere che l'utente installi Unreal.
  gioco.oodle = [];
  const radiceGioco = path.resolve(cartella, '..', '..', '..');
  const daGuardare = [
    radiceGioco,
    path.join(radiceGioco, 'Binaries', 'Win64'),
    path.join(radiceGioco, 'Engine', 'Binaries', 'ThirdParty', 'Oodle'),
  ];
  // ...e la cartella del progetto (quella che contiene Content/)
  const radiceProgetto = path.resolve(cartella, '..', '..');
  daGuardare.push(radiceProgetto, path.join(radiceProgetto, 'Binaries', 'Win64'));

  for (const base of [...new Set(daGuardare)]) {
    const pila = [base];
    let visitate = 0;
    while (pila.length && visitate < 200 && gioco.oodle.length < 5) {
      const dir = pila.pop();
      visitate++;
      let voci = [];
      try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const v of voci) {
        const p = path.join(dir, v.name);
        if (v.isDirectory() && visitate < 200) pila.push(p);
        else if (/^oo2core_\d+_win64\.dll$/i.test(v.name)) gioco.oodle.push(p);
      }
    }
  }
  gioco.oodle = [...new Set(gioco.oodle)];

  // Alcuni giochi lasciano i .locres sciolti su disco: sono il caso più facile
  // da collaudare, perché non serve toccare nessun container.
  const localization = path.join(path.dirname(cartella), 'Localization');
  if (fs.existsSync(localization)) {
    const pila = [localization];
    while (pila.length && gioco.locresSciolti.length < 20) {
      const dir = pila.pop();
      let voci = [];
      try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const v of voci) {
        const p = path.join(dir, v.name);
        if (v.isDirectory()) pila.push(p);
        else if (v.name.toLowerCase().endsWith('.locres')) {
          gioco.locresSciolti.push(path.relative(localization, p));
        }
      }
    }
  }

  return gioco;
}

/** Che cosa possiamo collaudare con questo gioco, detto senza girarci intorno. */
function verdetto(g) {
  const note = [];
  const v = g.iostore.filter((x) => !x.errore);

  if (v.length) {
    const versioni = [...new Set(v.map((x) => x.version))].sort();
    note.push(`IoStore UTOC v${versioni.join(', v')}`);
    if (v.some((x) => x.oltreIlNoto)) {
      note.push(`⚠️ oltre la v${UTOC_MAX_KNOWN_VERSION} testata: lettura best-effort`);
    }
    const metodi = [...new Set(v.flatMap((x) => x.metodi || []))].filter(Boolean);
    if (metodi.length) note.push(`compressione: ${metodi.join(', ')}`);
    if (v.some((x) => x.cifrato || x.chiaveNonNulla)) {
      note.push('🔒 container cifrato: serve la chiave AES, fuori portata');
    }
  }
  if (g.pak.some((x) => !x.errore)) {
    const versioni = [...new Set(g.pak.filter((x) => !x.errore).map((x) => x.version))].sort();
    note.push(`pak v${versioni.join(', v')}`);
  }
  if (g.locresSciolti.length) {
    note.push(`${g.locresSciolti.length} .locres sciolti su disco`);
  }
  const usaOodle = v.some((x) => (x.metodi || []).some((m) => /oodle/i.test(m)));
  if (g.oodle && g.oodle.length) {
    note.push(`✓ DLL Oodle nel gioco: ${path.basename(g.oodle[0])}`);
  } else if (usaOodle) {
    note.push('✗ usa Oodle ma NON ha la DLL: serve procurarla altrove');
  }
  return note;
}

/** Referto della lettura profonda: il layout noto regge su questo container? */
function refertoIndice(x) {
  const righe = [];
  const i = x.indice;
  if (!i) return righe;
  if (i.senzaIndice) {
    righe.push('    · nessun indice: normale per il container global (shader e script)');
    return righe;
  }
  if (i.errore) {
    righe.push(`    ✗ indice NON leggibile col layout v${UTOC_MAX_KNOWN_VERSION}: ${i.errore}`);
    return righe;
  }
  const pct = (i.quotaLeggibile * 100).toFixed(0);
  const ok = i.quotaLeggibile > 0.95 && i.avanzo === 0;
  righe.push(`    ${ok ? '✓' : '✗'} indice: ${i.dirCount} cartelle · ${i.fileCount} file · ${i.stringCount} nomi · ${pct}% leggibili · avanzo ${i.avanzo}B`);
  if (i.mountPoint) righe.push(`      mount: ${i.mountPoint}`);
  const est = Object.entries(i.estensioni).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (est.length) righe.push(`      estensioni: ${est.map(([e, n]) => `${e}×${n}`).join(' · ')}`);
  if (i.esempi.length) righe.push(`      esempi: ${i.esempi.slice(0, 3).join(' · ')}`);
  return righe;
}

/** Quanto resta leggibile senza la DLL Oodle. */
function refertoBlocchi(x) {
  const b = x.blocchi;
  if (!b) return [];
  if (b.errore) return [`    blocchi: ${b.errore}`];
  const pct = (b.quotaInChiaro * 100).toFixed(1);
  const dettaglio = Object.entries(b.perMetodo)
    .sort((p, q) => q[1] - p[1])
    .map(([m, n]) => `${m}×${n}`).join(' · ');
  return [
    `    blocchi: ${b.totale} · ${b.inChiaro} in chiaro (${pct}%) · ${dettaglio}`,
    `      leggibile senza Oodle: ${b.mbInChiaro.toFixed(1)} MB su ${(b.mbInChiaro + b.mbCompressi).toFixed(1)} MB`,
  ];
}

// ── Esecuzione ────────────────────────────────────────────────────────────

const radici = rootsFromArgs.length ? rootsFromArgs : steamLibraries();

if (!radici.length) {
  console.error('Nessuna libreria trovata. Passa le cartelle a mano:');
  console.error('  node scripts/ue-inspect-games.js "D:/Giochi" "E:/SteamLibrary/steamapps/common"');
  process.exit(1);
}

if (!asJson) {
  console.log('Cerco in:');
  for (const r of radici) console.log(`  ${r}`);
  console.log('');
}

// ── Caccia alla DLL Oodle su tutto il PC ──────────────────────────────────
//
// UE5 compila Oodle dentro l'eseguibile, quindi dai giochi UE5 non si recupera.
// Molti giochi UE4 invece la spediscono come DLL: se l'utente ne ha anche uno
// solo, quella copia sblocca la lettura di TUTTI i suoi giochi UE5. È la
// ragione per cui esiste la cache %APPDATA%/GameStringer/tools — che però oggi
// nessuno riempie.
if (cercaOodle) {
  console.log('Cerco oo2core_*.dll nelle librerie di gioco...\n');
  const trovate = [];
  for (const r of radici) {
    const pila = [r];
    let visitate = 0;
    while (pila.length && visitate < 40000) {
      const dir = pila.pop();
      visitate++;
      let voci = [];
      try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const v of voci) {
        const p = path.join(dir, v.name);
        if (v.isDirectory()) {
          // I .pak pesano decine di GB e non contengono DLL: si evitano.
          if (v.name !== 'Paks' && v.name !== 'Content') pila.push(p);
          else if (v.name === 'Content') pila.push(p);
        } else if (/^oo2core_\d+_win64\.dll$/i.test(v.name)) {
          let dim = 0;
          try { dim = fs.statSync(p).size; } catch { /* sparita nel frattempo */ }
          trovate.push({ percorso: p, dimensione: dim });
        }
      }
    }
  }
  if (!trovate.length) {
    console.log('Nessuna oo2core_*.dll trovata sul PC.');
    console.log('Senza, i container compressi con Oodle non si aprono:');
    console.log('è il caso della quasi totalità dei giochi UE5.');
  } else {
    console.log(`${trovate.length} copie trovate:`);
    for (const t of trovate) {
      console.log(`  ${(t.dimensione / 1024).toFixed(0).padStart(5)} KB  ${t.percorso}`);
    }
    console.log('\nUna qualsiasi di queste, copiata in');
    console.log('  %APPDATA%/GameStringer/tools/');
    console.log('sblocca la lettura di tutti i container Oodle.');
  }
  process.exit(0);
}

const giochi = [];
for (const r of radici) {
  for (const cartella of cercaCartellePaks(r)) {
    const g = analizzaCartellaPaks(cartella);
    if (g) giochi.push(g);
  }
}

if (asJson) {
  console.log(JSON.stringify(giochi, null, 2));
  process.exit(0);
}

if (!giochi.length) {
  console.log('Nessun gioco Unreal trovato nelle cartelle indicate.');
  console.log('Se i giochi sono altrove, passa il percorso come argomento.');
  process.exit(0);
}

console.log(`${giochi.length} giochi Unreal trovati\n`);
for (const g of giochi) {
  const c = g.conteggi;
  console.log(`▸ ${g.nome}`);
  console.log(`  ${g.percorso}`);
  console.log(`  file: ${c.utoc} .utoc · ${c.ucas} .ucas · ${c.pak} .pak`);
  for (const n of verdetto(g)) console.log(`  ${n}`);
  if (deep) {
    for (const x of g.iostore) {
      if (x.errore) { console.log(`  ${x.file}: ${x.errore}`); continue; }
      console.log(`  ${x.file} (v${x.version}, ${x.entryCount} entry)`);
      for (const r of refertoIndice(x)) console.log(r);
      for (const r of refertoBlocchi(x)) console.log(r);
    }
  }
  console.log('');
}

// Riassunto: quello che serve per decidere su cosa lavorare.
const conIoStore = giochi.filter((g) => g.iostore.some((x) => !x.errore));
const inChiaro = conIoStore.filter((g) => !g.iostore.some((x) => x.cifrato || x.chiaveNonNulla));
const conLocres = giochi.filter((g) => g.locresSciolti.length);
const soloPak = giochi.filter((g) => !g.iostore.some((x) => !x.errore) && g.pak.length);

console.log('─'.repeat(60));
console.log(`IoStore (.utoc):            ${conIoStore.length}`);
console.log(`  di cui NON cifrati:       ${inChiaro.length}  ← collaudabili`);
console.log(`solo .pak classici:         ${soloPak.length}`);
console.log(`con .locres sciolti:        ${conLocres.length}  ← il caso più facile`);
if (inChiaro.length) {
  console.log(`\nCandidati per il writer IoStore:`);
  for (const g of inChiaro.slice(0, 5)) console.log(`  · ${g.nome}`);
}
