#!/usr/bin/env node
/**
 * Mette gli asset di Tesseract sotto `public/tesseract/`, dove l'applicazione
 * li serve da sé.
 *
 * PERCHÉ ESISTE (22/08/2026). Tesseract.js scarica worker, core wasm e dati
 * lingua da un CDN a runtime. In una finestra Tauri quella richiesta NON passa:
 * la CSP elenca gli host delle API di traduzione e nessun CDN. Il risultato,
 * misurato nell'app, era `OCR failed: Unknown error` a ogni fotogramma — 183
 * catture, zero traduzioni, e nessun indizio su cosa mancasse.
 *
 * Serviti da `self` non serve toccare la CSP, non si aggiunge nessun host di
 * rete, e l'OCR funziona offline: coerente con un'applicazione che ha un
 * traduttore offline fra le sue pagine.
 *
 * PERCHÉ UNO SCRIPT E NON FILE NEL REPO. Sono ~47 MB: worker, dodici varianti
 * del core (il worker sceglie in base al supporto SIMD, e sceglierne una sola
 * significa fallire sulle macchine che ne vogliono un'altra) e i dati lingua.
 * Copiarli da `node_modules` a ogni installazione li tiene allineati alla
 * versione del pacchetto e il repository leggero.
 *
 * Uso:  node scripts/prepare-tesseract-assets.js [lingua...]
 *       (senza argomenti: `eng`)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const DEST = path.join(__dirname, '..', 'public', 'tesseract');
const CORE = path.join(__dirname, '..', 'node_modules', 'tesseract.js-core');
const DIST = path.join(__dirname, '..', 'node_modules', 'tesseract.js', 'dist');

// I dati lingua non stanno in node_modules: vanno presi una volta. `tessdata_fast`
// e' la variante piccola e veloce, quella che il progetto Tesseract consiglia
// per l'uso interattivo.
const TESSDATA = 'https://github.com/tesseract-ocr/tessdata_fast/raw/main';

function copia(da, a) {
  fs.copyFileSync(da, a);
  return fs.statSync(a).size;
}

function scarica(url, dest) {
  return new Promise((resolve, reject) => {
    const richiesta = (u, giri = 0) => {
      if (giri > 5) return reject(new Error('troppi redirect'));
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return richiesta(res.headers.location, giri + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} su ${u}`));
        }
        const out = fs.createWriteStream(dest);
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve(fs.statSync(dest).size)));
        out.on('error', reject);
      }).on('error', reject);
    };
    richiesta(url);
  });
}

async function main() {
  const lingue = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  if (lingue.length === 0) lingue.push('eng');

  if (!fs.existsSync(CORE) || !fs.existsSync(DIST)) {
    console.error('tesseract.js non installato: esegui prima `npm install`.');
    process.exit(1);
  }
  fs.mkdirSync(DEST, { recursive: true });

  let totale = 0;
  totale += copia(path.join(DIST, 'worker.min.js'), path.join(DEST, 'worker.min.js'));

  // TUTTE le varianti del core, non una scelta a caso: il worker decide a
  // runtime in base a SIMD, e una variante mancante e' un 404 che diventa
  // «Unknown error» molto piu' avanti.
  const varianti = fs.readdirSync(CORE).filter((f) => f.endsWith('.wasm') || f.endsWith('.wasm.js'));
  for (const v of varianti) totale += copia(path.join(CORE, v), path.join(DEST, v));
  console.log(`worker + ${varianti.length} varianti del core copiate da node_modules`);

  for (const lingua of lingue) {
    const dest = path.join(DEST, `${lingua}.traineddata`);
    if (fs.existsSync(dest)) {
      console.log(`${lingua}.traineddata gia' presente, non riscaricato`);
      totale += fs.statSync(dest).size;
      continue;
    }
    process.stdout.write(`scarico ${lingua}.traineddata... `);
    try {
      const n = await scarica(`${TESSDATA}/${lingua}.traineddata`, dest);
      console.log(`${(n / 1024 / 1024).toFixed(1)} MB`);
      totale += n;
    } catch (e) {
      // Una lingua mancante non deve far fallire l'installazione: l'OCR
      // funzionera' con quelle che ci sono, e il messaggio dice quale manca.
      fs.rmSync(dest, { force: true });
      console.log(`fallito (${e.message}) — quella lingua non sara' disponibile`);
    }
  }

  console.log(`public/tesseract/: ${(totale / 1024 / 1024).toFixed(0)} MB totali`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
