#!/usr/bin/env node
/**
 * renpy-rpa-probe.js — sonda SOLA LETTURA di un archivio Ren'Py .rpa.
 *
 * Nata il 07/08/2026 su Scarlet Hollow: il flusso Ren'Py falliva con «Nessun
 * file .rpy trovato» perché i copioni stanno DENTRO game/archive.rpa e nessuno
 * chiamava l'estrattore. Prima di cablare l'estrazione serve sapere COSA c'è
 * nell'archivio: se i sorgenti .rpy ci sono si estrae e si traduce; se ci sono
 * solo i .rpyc compilati serve un decompilatore, ed è un'altra storia.
 *
 * Non estrae nulla: legge l'header, gonfia l'indice zlib e conta i nomi per
 * estensione cercando i pattern dei nomi dentro il pickle (senza unpicklare:
 * per contare le estensioni basta il testo grezzo).
 *
 * Uso: node scripts/renpy-rpa-probe.js "<percorso archivio.rpa>"
 */
const fs = require('fs');
const zlib = require('zlib');

const rpaPath = process.argv[2];
if (!rpaPath) { console.error('Uso: node scripts/renpy-rpa-probe.js "<file.rpa>"'); process.exit(2); }

// Lettura con SEEK, mai il file intero: gli archivi commerciali superano i
// 2 GiB (Scarlet Hollow: 5,6 GB) e readFileSync esplode. Stessa lezione del
// pak di Arcadia (fs::read da 12 GB): header dai primi byte, indice dalla coda.
const fd = fs.openSync(rpaPath, 'r');
const { size } = fs.fstatSync(fd);
const head = Buffer.alloc(64);
fs.readSync(fd, head, 0, 64, 0);
const nl = head.indexOf(0x0a);
if (nl < 0) { console.error('Header RPA non trovato'); process.exit(1); }
const header = head.subarray(0, nl).toString('ascii');
const parts = header.trim().split(/\s+/);
console.log(`header: ${header.trim()} · file: ${(size / 1e9).toFixed(2)} GB`);
if (!/^RPA-[23]\.0$/.test(parts[0])) { console.error('Formato non supportato'); process.exit(1); }
const indexOffset = parseInt(parts[1], 16);

const tailLen = size - indexOffset;
if (tailLen <= 0 || tailLen > 512 * 1024 * 1024) { console.error(`Indice sospetto: offset ${indexOffset}, coda ${tailLen} byte`); process.exit(1); }
const tail = Buffer.alloc(Number(tailLen));
let read = 0;
while (read < tailLen) {
  const n = fs.readSync(fd, tail, read, Math.min(1 << 24, tailLen - read), indexOffset + read);
  if (n <= 0) break;
  read += n;
}
fs.closeSync(fd);
const pickled = zlib.inflateSync(tail);
console.log(`indice: ${pickled.length} byte decompressi`);

// I nomi file nel pickle sono stringhe leggibili: contiamo per estensione.
const text = pickled.toString('latin1');
const names = text.match(/[\w\-/ .()']+?\.(rpyc?|rpym?c?|png|jpg|webp|ogg|mp3|wav|ttf|otf|txt|json|webm|avif)\b/g) || [];
const byExt = {};
for (const n of names) {
  const ext = n.slice(n.lastIndexOf('.') + 1).toLowerCase();
  byExt[ext] = (byExt[ext] || 0) + 1;
}
console.log('conteggio per estensione:', JSON.stringify(byExt, null, 1));

const rpy = names.filter(n => /\.rpy$/i.test(n));
console.log(`\n.rpy sorgenti: ${rpy.length}`);
for (const n of rpy.slice(0, 15)) console.log('  ', n);
if (rpy.length > 15) console.log(`   … e altri ${rpy.length - 15}`);
const rpyc = names.filter(n => /\.rpyc$/i.test(n));
console.log(`.rpyc compilati: ${rpyc.length}`);
for (const n of rpyc.slice(0, 5)) console.log('  ', n);
