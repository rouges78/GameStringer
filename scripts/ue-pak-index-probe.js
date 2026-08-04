#!/usr/bin/env node
/**
 * Sonda dell'INDICE di un .pak Unreal — senza caricare il pak in memoria.
 *
 * Perché esiste (04/08/2026, American Arcadia): il gioco ha 11 lingue ufficiali
 * ma GameStringer dichiarava «questo gioco Unreal non espone localizzazione
 * estraibile». Falso: il suo AArcadia-Windows.pak pesa 12 GB e il nostro
 * extract_unreal_localization faceva `fs::read(pak_path)`, cioè caricava
 * DODICI GIGABYTE in RAM. Fallisce, viene loggato con log::warn! (che l'utente
 * non vede) e il risultato arriva in UI come «non estraibile» — l'ennesimo
 * fallimento muto, stavolta in lettura.
 *
 * Questo script legge SOLO gli ultimi byte (footer) e poi il blocco dell'indice
 * con una seek: costo indipendente dalla dimensione del pak. Serve a due cose:
 *  1. diagnosi onesta su un gioco vero, prima di toccare il Rust;
 *  2. prototipo della cura: seek mirata invece di read totale.
 *
 * Uso:  node scripts/ue-pak-index-probe.js "<percorso del .pak>"
 */
const fs = require('fs');

const MAGIC = 0x5a6f12e1;
// Dimensioni footer note, dalla più recente: v11..v8 hanno la tabella dei
// metodi di compressione (32 nomi da 32 byte), v7 l'UUID di cifratura, ecc.
// Non le indoviniamo: proviamo tutte e teniamo quella il cui magic combacia.
const FOOTER_SIZES = [204, 205, 221, 226, 236, 396, 404, 12 + 20 + 4 + 4 + 1 + 16];

function leggiCoda(fd, size, quanti) {
  const len = Math.min(quanti, size);
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, size - len);
  return buf;
}

function trovaFooter(coda, fileSize) {
  // Cerca il magic scorrendo all'indietro: robusto senza indovinare la versione.
  for (let off = coda.length - 4; off >= 0; off--) {
    if (coda.readUInt32LE(off) !== MAGIC) continue;
    const magicAssoluto = fileSize - coda.length + off;
    const version = coda.readUInt32LE(off + 4);
    if (version < 1 || version > 12) continue; // magic casuale nei dati
    const indexOffset = Number(coda.readBigUInt64LE(off + 8));
    const indexSize = Number(coda.readBigUInt64LE(off + 16));
    if (indexOffset <= 0 || indexOffset >= fileSize) continue;
    if (indexSize <= 0 || indexOffset + indexSize > fileSize) continue;
    // Il flag "indice cifrato" sta nel byte PRIMA del magic (v4+).
    const encrypted = off > 0 ? coda[off - 1] : 0;
    return { magicAssoluto, version, indexOffset, indexSize, encrypted: encrypted === 1 };
  }
  return null;
}

/** Legge una FString UE: [i32 len][bytes]. len<0 = UTF-16, |len| in caratteri. */
function fstring(buf, pos) {
  const len = buf.readInt32LE(pos);
  pos += 4;
  if (len === 0) return { s: '', pos };
  if (len > 0) {
    const s = buf.toString('utf8', pos, pos + len - 1); // -1: NUL finale
    return { s, pos: pos + len };
  }
  const n = -len;
  const s = buf.toString('utf16le', pos, pos + n * 2 - 2);
  return { s, pos: pos + n * 2 };
}

/**
 * Estrae i percorsi dei file. Su v10+ passa dal Full Directory Index
 * (TMap<dir, TMap<file, offset>>), che sta FUORI dall'indice primario.
 * Su v<10 i nomi sono nell'indice stesso, uno per entry.
 */
function leggiNomi(fd, idx, f, fileSize) {
  const nomi = [];
  try {
    let p = 0;
    const mp = fstring(idx, p); p = mp.pos;
    const numEntries = idx.readInt32LE(p); p += 4;
    console.log(`   mount point: "${mp.s}" · ${numEntries.toLocaleString('it-IT')} file dichiarati`);

    if (f.version >= 10) {
      p += 8; // PathHashSeed
      const hasPathHash = idx.readInt32LE(p); p += 4;
      if (hasPathHash) p += 8 + 8 + 20; // offset + size + hash
      const hasFullDir = idx.readInt32LE(p); p += 4;
      if (!hasFullDir) {
        console.log('   ⚠️ nessun Full Directory Index: i nomi non sono ricostruibili senza gli hash dei path.');
        return nomi;
      }
      const fdOff = Number(idx.readBigInt64LE(p)); p += 8;
      const fdSize = Number(idx.readBigInt64LE(p)); p += 8;
      console.log(`   full directory index: offset ${fdOff.toLocaleString('it-IT')}, ${(fdSize / 1024 / 1024).toFixed(1)} MB`);
      if (fdOff <= 0 || fdOff + fdSize > fileSize) {
        console.log('   ⚠️ offset del directory index fuori dal file.');
        return nomi;
      }
      const t0 = Date.now();
      const dir = Buffer.alloc(fdSize);
      fs.readSync(fd, dir, 0, fdSize, fdOff);
      console.log(`   letto in ${Date.now() - t0} ms (seek mirata, non tutto il pak)`);

      let q = 0;
      const numDirs = dir.readInt32LE(q); q += 4;
      for (let i = 0; i < numDirs; i++) {
        const d = fstring(dir, q); q = d.pos;
        const numFiles = dir.readInt32LE(q); q += 4;
        for (let j = 0; j < numFiles; j++) {
          const fn = fstring(dir, q); q = fn.pos;
          q += 4; // offset dell'entry codificata
          nomi.push(`${d.s}${fn.s}`);
        }
      }
    } else {
      // v<10: [FString nome][FPakEntry] ripetuto — leggiamo solo i nomi,
      // saltando l'entry a dimensione fissa (best-effort per la diagnosi).
      for (let i = 0; i < numEntries && p < idx.length - 4; i++) {
        const n = fstring(idx, p); p = n.pos;
        nomi.push(n.s);
        p += 53; // FPakEntry minima (offset+size+uncompressed+method+hash+flags)
      }
    }
  } catch (e) {
    console.log(`   ⚠️ parsing interrotto: ${e.message} (letti ${nomi.length} percorsi)`);
  }
  return nomi;
}

/**
 * Quando i .locres del gioco non ci sono, i testi vivono in StringTable o
 * DataTable dentro i .uasset. Qui si cercano i candidati PER NOME: è una
 * pista, non una prova — la prova è aprire il .uasset e trovarci le stringhe.
 */
function candidatiUasset(nomi) {
  const uasset = nomi.filter(n => /\.uasset$/i.test(n) && !/^Engine[/\\]/i.test(n));
  const gruppi = [
    ['StringTable', /stringtable|string_table|\bST_/i],
    ['DataTable',   /datatable|\bDT_/i],
    ['Dialoghi',    /dialog|dialogue|conversa|barks?\b/i],
    ['Sottotitoli', /subtitle|subtitles|\bsub_/i],
    ['Testo/Loc',   /localiz|l10n|\btext\b|\bloc_/i],
    ['Narrativa',   /narrative|script|story|quest|journal/i],
  ];
  console.log(`\n🔍 Candidati fra i ${uasset.length.toLocaleString('it-IT')} .uasset del gioco:`);
  const visti = new Set();
  for (const [nome, re] of gruppi) {
    const hit = uasset.filter(n => re.test(n) && !visti.has(n));
    hit.forEach(n => visti.add(n));
    if (!hit.length) { console.log(`   ${nome}: 0`); continue; }
    console.log(`   ${nome}: ${hit.length}`);
    for (const p of hit.slice(0, 8)) console.log(`      · ${p}`);
    if (hit.length > 8) console.log(`      · … e altri ${hit.length - 8}`);
  }
  if (visti.size === 0) {
    console.log('   Nessun nome parlante. Serve aprire i .uasset e cercare le stringhe dentro.');
  } else {
    console.log(`\n➡️  PROSSIMO PASSO: estrarre questi ${visti.size} file dal pak e cercarci dentro le stringhe.`);
  }
}

function main() {
  const pak = process.argv[2];
  if (!pak) {
    console.error('Uso: node scripts/ue-pak-index-probe.js "<percorso del .pak>"');
    process.exit(2);
  }
  if (!fs.existsSync(pak)) {
    console.error(`❌ File non trovato: ${pak}`);
    process.exit(2);
  }

  const size = fs.statSync(pak).size;
  const gb = (size / 1024 / 1024 / 1024).toFixed(2);
  console.log(`📦 ${pak}`);
  console.log(`   dimensione: ${size.toLocaleString('it-IT')} byte (${gb} GB)`);

  const fd = fs.openSync(pak, 'r');
  try {
    const coda = leggiCoda(fd, size, 1024);
    const f = trovaFooter(coda, size);
    if (!f) {
      console.log('❌ Footer non riconosciuto negli ultimi 1024 byte.');
      console.log('   → pak cifrato per intero, formato non standard, o versione oltre v12.');
      process.exit(1);
    }

    console.log(`\n✅ Footer trovato a offset ${f.magicAssoluto.toLocaleString('it-IT')}`);
    console.log(`   versione pak: v${f.version}`);
    console.log(`   indice: offset ${f.indexOffset.toLocaleString('it-IT')}, ${f.indexSize.toLocaleString('it-IT')} byte`);
    console.log(`   indice cifrato: ${f.encrypted ? 'SÌ ⛔' : 'no ✅'}`);

    if (f.encrypted) {
      console.log('\n⛔ L\'indice è cifrato: senza la chiave AES del gioco i nomi dei file non si leggono.');
      process.exit(1);
    }

    // ── LA PARTE CHE CONTA: si legge SOLO l'indice, con una seek. ──
    const t0 = Date.now();
    const idx = Buffer.alloc(f.indexSize);
    fs.readSync(fd, idx, 0, f.indexSize, f.indexOffset);
    const ms = Date.now() - t0;
    console.log(`\n📖 Indice letto in ${ms} ms (${(f.indexSize / 1024 / 1024).toFixed(1)} MB) — nessun caricamento del pak in memoria.`);

    // ⚠️ Dal pak v10 l'indice primario NON contiene i nomi: sono hash dei
    // percorsi. I nomi veri stanno nel FULL DIRECTORY INDEX, a un offset
    // separato dichiarato qui dentro. Cercare testo nell'indice primario
    // restituisce ZERO su qualunque gioco moderno — misurato su American
    // Arcadia (v11): 0 .locres, 0 .uasset, che è impossibile in un pak UE.
    const nomi = leggiNomi(fd, idx, f, size);
    const testo = nomi.join('\n');
    const locres = (testo.match(/\.locres/gi) || []).length;
    const locmeta = (testo.match(/\.locmeta/gi) || []).length;
    const uasset = (testo.match(/\.uasset/gi) || []).length;

    console.log(`\n🔎 Nell'indice: ${nomi.length} percorsi · ${locres} .locres · ${locmeta} .locmeta · ${uasset} .uasset`);

    if (locres > 0) {
      // ⚠️ Distinzione che conta: i .locres di Engine/ e Engine/Plugins/ sono
      // del MOTORE (una manciata di stringhe: "Yes", "Cancel", errori di rete).
      // Tradurre quelli e dichiarare il gioco tradotto è un fallimento muto —
      // la versione in lettura dello stesso errore di find_project_name.
      const tutti = nomi.filter(n => /\.locres$/i.test(n));
      const motore = tutti.filter(n => /^Engine[/\\]/i.test(n));
      const gioco = tutti.filter(n => !/^Engine[/\\]/i.test(n));

      console.log(`\n   DEL GIOCO: ${gioco.length}`);
      for (const p of gioco) console.log(`   ✅ ${p}`);
      console.log(`\n   DEL MOTORE (da ignorare): ${motore.length}`);
      for (const p of motore.slice(0, 5)) console.log(`   · ${p}`);
      if (motore.length > 5) console.log(`   · … e altri ${motore.length - 5}`);

      if (gioco.length > 0) {
        console.log('\n✅ VERDETTO: i testi del GIOCO ci sono. È traducibile — se l\'app dice il contrario, sbaglia il reader.');
      } else {
        console.log('\n⚠️ Nessun .locres del gioco: la localizzazione passa dagli .uasset.');
        candidatiUasset(nomi);
      }
    } else if (nomi.length > 0) {
      const loc = nomi.filter(n => /localization|localiz|l10n|text|string/i.test(n)).slice(0, 20);
      if (loc.length) {
        console.log('\n   Percorsi sospetti di localizzazione (max 20):');
        for (const p of loc) console.log(`   · ${p}`);
      }
      console.log('\n   Campione dei primi 10 percorsi:');
      for (const p of nomi.slice(0, 10)) console.log(`   · ${p}`);
      console.log('\n⚠️ VERDETTO: indice leggibile ma nessun .locres. La localizzazione passa da StringTable/DataTable nei .uasset.');
    } else {
      console.log('\n❌ VERDETTO: nessun percorso estratto — vedi gli avvisi qui sopra.');
    }
  } finally {
    fs.closeSync(fd);
  }
}

main();
