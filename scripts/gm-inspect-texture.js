#!/usr/bin/env node
/**
 * Ispeziona le texture di un `data.win` GameMaker (task ADR-005).
 *
 * Risponde a UNA domanda: il contenitore `2zoq` (QOI compresso con BZip2) ha
 * l'header da 8 byte o quello da 12? Su GameMaker 2022.5+ ci sono quattro byte
 * in piu' che contengono la LUNGHEZZA DEL QOI DECOMPRESSO, e chi inietta glifi
 * deve aggiornarli: dimenticarlo produce un file che sembra sano e si rompe
 * alla lettura.
 *
 * Il metodo non passa dal numero di versione, che andrebbe interpretato: dopo
 * l'header inizia uno stream BZip2, e uno stream BZip2 comincia SEMPRE con
 * 'BZh' seguito dalla cifra del livello (1-9). Si guarda dove sta quel marcatore
 * e si sa quanto e' lungo l'header. E' una misura, non una deduzione.
 *
 * Uso:
 *   node scripts/gm-inspect-texture.js "C:\\percorso\\DELTARUNEdemo\\data.win"
 *
 * Non modifica nulla: apre il file in sola lettura.
 */

const fs = require('fs');
const path = require('path');

const MAGIC_BZ2QOI = Buffer.from('2zoq', 'latin1');
const MAGIC_QOI = Buffer.from('fioq', 'latin1');

/** Uno stream BZip2 inizia con 'BZh' + livello '1'..'9'. */
function isBzipStart(buf, at) {
  if (at + 4 > buf.length) return false;
  return (
    buf[at] === 0x42 && // B
    buf[at + 1] === 0x5a && // Z
    buf[at + 2] === 0x68 && // h
    buf[at + 3] >= 0x31 &&
    buf[at + 3] <= 0x39
  );
}

function human(n) {
  return n.toLocaleString('it-IT');
}

/** Elenca i chunk IFF di primo livello (FORM + [nome, dimensione]). */
function listChunks(buf) {
  const chunks = [];
  if (buf.length < 8 || buf.toString('latin1', 0, 4) !== 'FORM') return chunks;
  const formEnd = Math.min(8 + buf.readUInt32LE(4), buf.length);
  let pos = 8;
  while (pos + 8 <= formEnd) {
    const name = buf.toString('latin1', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (!/^[A-Z0-9]{4}$/.test(name) || size > buf.length) break;
    chunks.push({ name, offset: pos + 8, size });
    pos += 8 + size;
  }
  return chunks;
}

function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Uso: node scripts/gm-inspect-texture.js <percorso del data.win>');
    process.exit(2);
  }
  if (!fs.existsSync(target)) {
    console.error(`File non trovato: ${target}`);
    process.exit(2);
  }

  const stat = fs.statSync(target);
  console.log(`\n=== ${path.basename(target)} — ${human(stat.size)} byte ===\n`);

  const buf = fs.readFileSync(target);

  const chunks = listChunks(buf);
  if (chunks.length) {
    console.log(`Chunk IFF: ${chunks.map((c) => c.name).join(' ')}\n`);
  } else {
    console.log('Attenzione: intestazione FORM non riconosciuta, si procede comunque a scansione.\n');
  }

  // Scansione diretta dei blob: e' piu' robusta che seguire i puntatori del
  // chunk TXTR, la cui struttura cambia da una versione all'altra.
  const trovati = [];
  let idx = buf.indexOf(MAGIC_BZ2QOI, 0);
  while (idx !== -1) {
    trovati.push(idx);
    idx = buf.indexOf(MAGIC_BZ2QOI, idx + 4);
  }

  const qoiNudi = [];
  let j = buf.indexOf(MAGIC_QOI, 0);
  while (j !== -1) {
    qoiNudi.push(j);
    j = buf.indexOf(MAGIC_QOI, j + 4);
  }

  console.log(`Texture 2zoq (QOI+BZip2): ${trovati.length}`);
  console.log(`Texture fioq (QOI non compresso): ${qoiNudi.length}\n`);

  if (trovati.length === 0) {
    console.log('Nessun contenitore 2zoq: questo data.win non usa QOI+BZip2.');
    return;
  }

  const conteggio = { h8: 0, h12: 0, ignoto: 0 };
  const righe = [];

  for (const off of trovati) {
    const width = buf.readUInt16LE(off + 4);
    const height = buf.readUInt16LE(off + 6);

    let header = null;
    let uncompressed = null;
    if (isBzipStart(buf, off + 8)) {
      header = 8;
      conteggio.h8++;
    } else if (isBzipStart(buf, off + 12)) {
      header = 12;
      uncompressed = buf.readInt32LE(off + 8);
      conteggio.h12++;
    } else {
      conteggio.ignoto++;
    }

    righe.push({ off, width, height, header, uncompressed });
  }

  // Le texture sono allineate a 0x80, quindi la distanza dal blob successivo E'
  // la dimensione del blob (compreso il riempimento a zeri). E' l'unico modo di
  // conoscerla senza decomprimere: la lunghezza dello stream BZip2 non e'
  // memorizzata da nessuna parte.
  const txtr = chunks.find((c) => c.name === 'TXTR');
  const fineTxtr = txtr ? txtr.offset + txtr.size : null;
  for (let i = 0; i < righe.length; i++) {
    const succ = i + 1 < righe.length ? righe[i + 1].off : fineTxtr;
    righe[i].blob = succ && succ > righe[i].off ? succ - righe[i].off : null;
  }

  const w = (s, n) => String(s).padStart(n);
  console.log('  offset        dimensioni     header   blob (con padding)   QOI decompresso');
  console.log('  ----------    -----------    ------   ------------------   ---------------');
  for (const r of righe) {
    const dim = `${r.width}x${r.height}`;
    const hdr = r.header === null ? '  ???' : `${w(r.header, 2)} B`;
    const unc = r.uncompressed === null ? '—' : `${human(r.uncompressed)} B`;
    const blob = r.blob === null ? '—' : `${human(r.blob)} B`;
    console.log(
      `  ${w(r.off, 10)}    ${w(dim, 11)}    ${hdr}   ${w(blob, 18)}   ${w(unc, 15)}`
    );
  }

  console.log('\n--- Verdetto ---');
  if (conteggio.h12 > 0 && conteggio.h8 === 0) {
    console.log('Header da 12 BYTE (GameMaker 2022.5+).');
    console.log('=> Il campo a offset 8 e\' la lunghezza del QOI decompresso.');
    console.log('   L\'iniezione dei glifi DEVE aggiornarlo: e\' a dimensione fissa,');
    console.log('   quindi non sposta nulla, ma un valore stantio rompe la lettura.');
  } else if (conteggio.h8 > 0 && conteggio.h12 === 0) {
    console.log('Header da 8 BYTE (GameMaker precedente a 2022.5).');
    console.log('=> Nessun campo di lunghezza da aggiornare.');
  } else if (conteggio.h8 > 0 && conteggio.h12 > 0) {
    console.log(`ANOMALIA: ${conteggio.h8} texture con header da 8 e ${conteggio.h12} con header da 12.`);
    console.log('=> Un solo data.win non dovrebbe mescolare le due varianti: da guardare a mano.');
  }
  if (conteggio.ignoto > 0) {
    console.log(`\n${conteggio.ignoto} blob senza 'BZh' ne\' a offset 8 ne\' a 12.`);
    console.log("=> Probabili falsi positivi: la sequenza '2zoq' puo\' comparire per caso");
    console.log('   dentro dati compressi. Contano solo le righe con un header riconosciuto.');
  }

  // Il font giapponese di Deltarune sta su una texture 2048x2048: e' quella su
  // cui ADR-005 ha misurato i 230 KB e i 32 KB di margine.
  // ADR-005 ha misurato 230.197 byte sul blob compresso della texture del font
  // giapponese. Con il riempimento fino al confine dei 128 diventano 230.272:
  // e' la firma che permette di RITROVARE quell'atlante senza decomprimere
  // ventisette texture.
  const ATTESO_FONT = 230197;
  const arrotonda128 = (n) => Math.ceil(n / 128) * 128;
  const candidati = righe.filter(
    (r) => r.header !== null && r.blob !== null && r.blob === arrotonda128(ATTESO_FONT)
  );
  if (candidati.length) {
    console.log('\n--- Atlante del font (firma di ADR-005) ---');
    for (const r of candidati) {
      const indice = righe.indexOf(r);
      console.log(
        `  indice ${indice} (0-based) — offset ${human(r.off)} — ${r.width}x${r.height} — ` +
          `blob ${human(r.blob)} B, di cui ${human(r.blob - ATTESO_FONT)} di riempimento`
      );
    }
    console.log(`  Combacia con i ${human(ATTESO_FONT)} byte misurati il 26/07.`);
  } else {
    const grandi = righe.filter((r) => r.width === 2048 && r.height === 2048 && r.header !== null);
    console.log(`\nNessun blob da ${human(arrotonda128(ATTESO_FONT))} byte.`);
    console.log(`Texture 2048x2048 da esaminare: ${grandi.length}.`);
    console.log('  Atteso da ADR-005 sulla texture del font: 1.888.553 byte decompressi.');
  }
  console.log('');
}

main();
