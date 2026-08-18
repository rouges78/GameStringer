#!/usr/bin/env node
/**
 * generate-icons.js — TUTTE le icone dell'app, per TUTTE le piattaforme,
 * da UNA sola sorgente dichiarata.
 *
 * ⛔ STORIA, perché questo file è nato storto (18/08/2026):
 * la sorgente era CABLATA a src-tauri/icons/icon-neon.svg (la "GS" neon
 * azzurra), che NON è il marchio del prodotto. Il 04/08/2026 lo script è stato
 * toccato per tutt'altro motivo — il bump Dependabot to-ico 1.0.1→1.1.5 tirava
 * dentro jimp@0.2.28 con 12 advisory — e nel provarlo ha rigenerato l'intero
 * bundle: v1.16.0 e v1.17.0 sono uscite con l'icona sbagliata, mentre il sito e
 * l'interfaccia mostravano il quadrato viola. Due marchi in circolazione per
 * due settimane, e nessuno se n'è accorto finché Davide non ha installato la
 * v1.17.0 e ha guardato la taskbar.
 * ⛔ E l'.icns non veniva generato AFFATTO: lo script si limitava a stampare
 * "vai su cloudconvert.com e caricalo a mano". Risultato prevedibile: fermo al
 * 24/06/2026, cioè macOS spediva ancora l'icona precedente. Un passo manuale in
 * fondo a uno script automatico è un passo che non si farà.
 * ⇒ Adesso: sorgente dichiarata qui sotto, .icns generato in casa (nessuna
 * dipendenza nuova: il formato ICNS incapsula PNG), e una PROVA D'EFFETTO che
 * rilegge da disco tutto quello che ha scritto e fallisce se manca qualcosa.
 *
 * Uso:  npm run icons:generate            (sorgente ufficiale)
 *       node scripts/generate-icons.js <file.png|svg>   (override esplicito)
 */

// sharp e png-to-ico sono caricati DENTRO generateIcons(), non qui: sharp porta
// un binario nativo per piattaforma (nel repo c'è solo @img/sharp-win32-x64) e
// un require in cima renderebbe il file non importabile altrove — cioè non
// testabile senza Windows. Le funzioni pure (buildIcns, pngSize) restano
// verificabili ovunque, ed è così che l'ICNS è stato provato prima di spedirlo.
// png-to-ico, NON to-ico: facevano la stessa cosa (erano installati ENTRAMBI),
// ma il bump Dependabot to-ico 1.0.1→1.1.5 del 04/08/2026 ha portato dentro
// resize-img→jimp@0.2.28 (2016) con request/form-data/jpeg-js/minimist vulnerabili:
// 12 advisory di colpo, 5 critical, audit-gate rosso. Un convertitore basta.
// png-to-ico 3.x è transpilato da ESM: require() ritorna { __esModule, default },
// non la funzione. Senza il .default il primo run è morto con
// "pngToIco is not a function" — trovato dalla prova d'effetto, non dai gate.
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const iconsDir = path.join(ROOT, 'src-tauri', 'icons');

/**
 * SORGENTE UFFICIALE DEL MARCHIO — deciso da Davide il 18/08/2026.
 * Il quadrato viola di public/logohires.png (1024x1024 RGBA) è l'icona del
 * prodotto: la stessa che si vede sul sito e dentro l'app. Se un giorno il
 * marchio cambia, SI CAMBIA QUI e si rilancia il comando: è l'unico punto.
 * (public/favicon.svg è un TERZO disegno, azzurro-verde, rimasto da aprile:
 * non è il marchio, non usarlo come sorgente senza deciderlo prima.)
 */
const SOURCE = path.join(ROOT, 'public', 'logohires.png');
const sourceFile = process.argv[2] ? path.resolve(process.argv[2]) : SOURCE;

// Le sei icone che tauri.conf.json e il bundler si aspettano.
const PNG_SIZES = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: '256x256.png', size: 256 },
  { name: '512x512.png', size: 512 },
  { name: 'icon.png', size: 512 },
];
const ICO_SIZES = [16, 32, 48, 256];
// ICNS: ogni blocco è un PNG incapsulato. ic07..ic10 sono le taglie in punti,
// ic11..ic14 le varianti @2x. Coprirle tutte evita che macOS scali a mano.
const ICNS_TYPES = [
  { ostype: 'ic07', size: 128 },
  { ostype: 'ic08', size: 256 },
  { ostype: 'ic09', size: 512 },
  { ostype: 'ic10', size: 1024 },
  { ostype: 'ic11', size: 32 },
  { ostype: 'ic12', size: 64 },
  { ostype: 'ic13', size: 256 },
  { ostype: 'ic14', size: 512 },
];

/** Impacchetta PNG in un .icns. Formato: 'icns' + len32, poi blocchi ostype+len32+dati. */
function buildIcns(entries) {
  const blocks = entries.map(({ ostype, buf }) => {
    const head = Buffer.alloc(8);
    head.write(ostype, 0, 4, 'ascii');
    head.writeUInt32BE(buf.length + 8, 4);
    return Buffer.concat([head, buf]);
  });
  const body = Buffer.concat(blocks);
  const head = Buffer.alloc(8);
  head.write('icns', 0, 4, 'ascii');
  head.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([head, body]);
}

/** Legge larghezza/altezza dall'header IHDR di un PNG su disco. */
function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(24);
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  if (buf.toString('ascii', 1, 4) !== 'PNG') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function generateIcons() {
  const sharp = require('sharp');
  const pngToIcoModule = require('png-to-ico');
  const pngToIco = pngToIcoModule.default || pngToIcoModule;

  if (!fs.existsSync(sourceFile)) {
    console.error(`❌ Sorgente non trovata: ${sourceFile}`);
    console.error('   Attesa: public/logohires.png (il quadrato viola, marchio ufficiale).');
    process.exit(1);
  }

  const meta = await sharp(sourceFile).metadata();
  console.log(`🎨 Sorgente: ${path.relative(ROOT, sourceFile)} (${meta.width}x${meta.height})\n`);
  // 1024 serve per il blocco ic10 dell'ICNS: sotto, macOS mostrerebbe un
  // ingrandimento sfocato sui display retina.
  if ((meta.width || 0) < 1024 || (meta.height || 0) < 1024) {
    console.error(`❌ Sorgente troppo piccola (${meta.width}x${meta.height}): servono almeno 1024x1024.`);
    process.exit(1);
  }

  const written = [];

  for (const { name, size } of PNG_SIZES) {
    const out = path.join(iconsDir, name);
    await sharp(sourceFile).resize(size, size).png().toFile(out);
    written.push({ file: out, expect: size });
    console.log(`✅ ${name} (${size}x${size})`);
  }

  // Layer PNG per l'ICO: png-to-ico vuole file su disco, ma sono INTERMEDI.
  // 18/08/2026: finivano in src-tauri/icons/png/ dentro il repo, e i quattro
  // icon-*.png erano perfino tracciati da git — scarti di lavorazione versionati
  // che al primo giro divergono dall'icona vera e confondono chi li trova.
  // Ora vivono in una cartella temporanea di sistema, cancellata alla fine.
  const pngDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-icons-'));
  const icoPngPaths = [];
  for (const size of ICO_SIZES) {
    const buf = await sharp(sourceFile).resize(size, size).png().toBuffer();
    const p = path.join(pngDir, `icon-${size}.png`);
    fs.writeFileSync(p, buf);
    icoPngPaths.push(p);
    console.log(`✅ ICO layer ${size}x${size}`);
  }

  const icoPath = path.join(iconsDir, 'icon.ico');
  const icoBuffer = await pngToIco(icoPngPaths);
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`✅ icon.ico (${ICO_SIZES.join(', ')})`);

  // ICNS — generato qui, non su un sito a mano.
  const icnsEntries = [];
  for (const { ostype, size } of ICNS_TYPES) {
    icnsEntries.push({ ostype, buf: await sharp(sourceFile).resize(size, size).png().toBuffer() });
  }
  const icnsPath = path.join(iconsDir, 'icon.icns');
  fs.writeFileSync(icnsPath, buildIcns(icnsEntries));
  console.log(`✅ icon.icns (${ICNS_TYPES.map((t) => t.size).join(', ')})`);

  // ── Asset web: sito e app devono mostrare LO STESSO marchio dell'eseguibile ─
  // 18/08/2026: public/favicon.ico e docs/sito/favicon.png erano già il quadrato
  // viola, ma i due favicon.svg contenevano un TERZO disegno azzurro-verde di
  // aprile. Nessuna pagina li caricava — erano orfani — ed è proprio per questo
  // che erano pericolosi: il primo che li riusa credendoli il marchio rimette in
  // circolazione un logo morto. Il logo non è vettoriale, quindi l'SVG incapsula
  // il PNG: qualunque riferimento a .svg resta valido e mostra la cosa giusta.
  const webTargets = [
    { file: path.join(ROOT, 'public', 'favicon.ico'), kind: 'ico' },
    { file: path.join(ROOT, 'public', 'favicon.svg'), kind: 'svg' },
    { file: path.join(ROOT, 'public', 'logo.png'), kind: 'png', size: 512 },
    { file: path.join(ROOT, 'docs', 'sito', 'favicon.png'), kind: 'png', size: 256 },
    { file: path.join(ROOT, 'docs', 'sito', 'favicon.svg'), kind: 'svg' },
    { file: path.join(ROOT, 'docs', 'sito', 'logo.png'), kind: 'png', size: 256 },
  ];
  const FAVICON_ICO_SIZES = [16, 32, 48, 64, 128, 256];
  const svg128 = await sharp(sourceFile).resize(128, 128).png().toBuffer();
  const svgWrapper =
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
    'viewBox="0 0 128 128" width="128" height="128">\n' +
    '  <!-- Marchio ufficiale GameStringer. Generato da npm run icons:generate:\n' +
    '       non modificare a mano, si cambia la sorgente in scripts/generate-icons.js. -->\n' +
    `  <image width="128" height="128" xlink:href="data:image/png;base64,${svg128.toString('base64')}"/>\n` +
    '</svg>\n';

  for (const t of webTargets) {
    if (!fs.existsSync(path.dirname(t.file))) continue; // il sito può non esserci in un checkout parziale
    if (t.kind === 'png') {
      await sharp(sourceFile).resize(t.size, t.size).png().toFile(t.file);
      written.push({ file: t.file, expect: t.size });
    } else if (t.kind === 'svg') {
      fs.writeFileSync(t.file, svgWrapper);
    } else {
      const layers = [];
      for (const size of FAVICON_ICO_SIZES) {
        const p = path.join(pngDir, `favicon-${size}.png`);
        fs.writeFileSync(p, await sharp(sourceFile).resize(size, size).png().toBuffer());
        layers.push(p);
      }
      fs.writeFileSync(t.file, await pngToIco(layers));
    }
    console.log(`✅ ${path.relative(ROOT, t.file)}`);
  }

  // ── PROVA D'EFFETTO: rileggo da disco quello che dico di aver scritto ─────
  console.log('\n🔍 Verifica su disco:');
  const problemi = [];
  for (const { file, expect } of written) {
    const s = pngSize(file);
    if (!s) problemi.push(`${path.basename(file)}: non è un PNG valido`);
    else if (s.w !== expect || s.h !== expect) problemi.push(`${path.basename(file)}: ${s.w}x${s.h} invece di ${expect}x${expect}`);
    else console.log(`   • ${path.basename(file)} ${s.w}x${s.h}`);
  }
  const ico = fs.readFileSync(icoPath);
  const icoCount = ico.readUInt16LE(4);
  if (icoCount !== ICO_SIZES.length) problemi.push(`icon.ico: ${icoCount} immagini invece di ${ICO_SIZES.length}`);
  else console.log(`   • icon.ico ${icoCount} immagini`);
  const icns = fs.readFileSync(icnsPath);
  if (icns.toString('ascii', 0, 4) !== 'icns') problemi.push('icon.icns: magic sbagliato');
  else {
    const mancanti = ICNS_TYPES.filter((t) => !icns.includes(Buffer.from(t.ostype, 'ascii'))).map((t) => t.ostype);
    if (mancanti.length) problemi.push(`icon.icns: blocchi mancanti ${mancanti.join(', ')}`);
    else console.log(`   • icon.icns ${ICNS_TYPES.length} blocchi, ${icns.length} byte`);
  }

  // gli SVG incapsulati: devono contenere il PNG, non un disegno scollegato
  for (const t of webTargets.filter((x) => x.kind === 'svg' && fs.existsSync(x.file))) {
    const txt = fs.readFileSync(t.file, 'utf8');
    if (!txt.includes('data:image/png;base64,')) problemi.push(`${path.relative(ROOT, t.file)}: non incapsula il PNG`);
    else console.log(`   • ${path.relative(ROOT, t.file)} incapsula il marchio`);
  }
  const favIco = path.join(ROOT, 'public', 'favicon.ico');
  if (fs.existsSync(favIco)) {
    const n = fs.readFileSync(favIco).readUInt16LE(4);
    if (n !== FAVICON_ICO_SIZES.length) problemi.push(`public/favicon.ico: ${n} immagini invece di ${FAVICON_ICO_SIZES.length}`);
    else console.log(`   • public/favicon.ico ${n} immagini`);
  }

  fs.rmSync(pngDir, { recursive: true, force: true }); // via gli intermedi

  if (problemi.length) {
    console.error('\n❌ La generazione dice di aver funzionato ma il disco dice altro:');
    problemi.forEach((p) => console.error(`   • ${p}`));
    process.exit(1);
  }

  console.log('\n✅ Windows, Linux e macOS generati dalla STESSA sorgente.');
  console.log('   Prova vera: installa la build e guarda la taskbar — Windows tiene');
  console.log('   una cache delle icone che può mostrare la vecchia anche quando il file è giusto.');
}

module.exports = { buildIcns, pngSize, SOURCE, PNG_SIZES, ICO_SIZES, ICNS_TYPES };

if (require.main === module) {
  generateIcons().catch((err) => {
    console.error('❌', err.message);
    process.exit(1);
  });
}
