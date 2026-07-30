#!/usr/bin/env node
/**
 * Estrae e decodifica i .locres da un dump di memoria di un gioco Unreal.
 *
 * PERCHÉ QUESTA VIA
 * -----------------
 * Su UE5 i .locres stanno in container compressi Oodle, e Oodle è compilato
 * dentro l'eseguibile: niente DLL da riusare. Misurato il 30/07/2026 su
 * Below, Rusted Gods (pak v11, unico metodo "Oodle", zero blob in chiaro).
 *
 * Ma il gioco decomprime i propri dati da sé, all'avvio. Un .locres decompresso
 * è un buffer contiguo che comincia col GUID magico del formato:
 *
 *     0E 14 74 75 67 4A 03 FC 4A 15 90 9D C3 37 7F 1B
 *     = FGuid(0x7574140E, 0xFC034A67, 0x9D90154A, 0x1B7F37C3)
 *
 * Quindi basta un dump della memoria del processo e una ricerca di quel GUID.
 * Nessuna injection, nessun hook, nessuna DLL: si legge un file su disco.
 *
 * COME FARE IL DUMP (nessuno strumento da installare)
 *   1. avvia il gioco e arriva al MENU PRINCIPALE
 *      (la localizzazione si carica all'avvio, non al primo dialogo)
 *   2. Gestione attività → scheda Dettagli → trova il processo del gioco
 *   3. tasto destro → "Crea file di dump"
 *   4. Windows dice dove l'ha salvato (di solito in %TEMP%)
 *   5. node scripts/ue-locres-from-dump.js "<percorso del .DMP>"
 *
 * Il .DMP di un gioco UE5 pesa qualche GB: serve spazio su disco. In cambio non
 * si tocca il processo, e questo script è codice normale, testabile.
 *
 * FORMATO — implementato secondo CUE4Parse
 * (CUE4Parse/UE4/Localization/FTextLocalizationResource.cs), che rispecchia
 * FTextLocalizationResource di UE:
 *
 *   FGuid magic(16) · uint8 version
 *   if version >= 1 (Compact):        int64 offset dell'array delle stringhe
 *   if version >= 2 (Optimized_CRC32): uint32 conteggio entry (ignorato)
 *   uint32 numero di namespace
 *     per namespace: FTextKey · uint32 numero di chiavi
 *       per chiave:  FTextKey · uint32 hash della stringa sorgente
 *                    if version >= 1: int32 indice nell'array
 *                    else:            FString stringa tradotta
 *   array delle stringhe (all'offset dichiarato):
 *     int32 conteggio · per ognuna: FString · if version >= 2: int32 refCount
 *
 *   FTextKey  = (version >= 2 ? uint32 hash : niente) + FString
 *   FString   = int32 len; len < 0 → UTF-16 di (-len) unità, altrimenti (len)
 *               byte a 8 bit; in entrambi i casi il terminatore è incluso.
 *
 * ONESTÀ SUL COLLAUDO: la fixture di prova è generata da questo stesso file
 * secondo la specifica sopra, quindi dimostra che il lettore è coerente con la
 * specifica — NON che la specifica sia giusta. La prova vera è il dump di un
 * gioco reale: per questo il parser è severo e rumoroso invece di indovinare.
 * È lo stesso errore in cui è caduto write_locres_* del progetto, le cui
 * fixture erano prodotte dal writer sbagliato.
 *
 * Uso:
 *   node scripts/ue-locres-from-dump.js "<file.DMP>"
 *   node scripts/ue-locres-from-dump.js "<file.DMP>" --out estratti --json
 */

const fs = require('fs');
const path = require('path');

const MAGIC = Buffer.from([
  0x0e, 0x14, 0x74, 0x75, 0x67, 0x4a, 0x03, 0xfc,
  0x4a, 0x15, 0x90, 0x9d, 0xc3, 0x37, 0x7f, 0x1b,
]);

const VERSIONI = { 0: 'Legacy', 1: 'Compact', 2: 'Optimized_CRC32', 3: 'Optimized_CRC32_Utf16' };

const CHUNK = 64 * 1024 * 1024;
// Tetto su quanto si copia da un ritrovamento: un .locres di un gioco intero sta
// largamente sotto, e un tetto evita di allocare mezzo dump per un falso positivo.
const MAX_BLOB = 64 * 1024 * 1024;

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : null;
// Attenzione al sentinella: se --out non c'è, outIdx è -1 e outIdx+1 è 0, che
// escluderebbe il primo argomento — cioè il file. Si esclude solo se c'è davvero.
const idxDaSaltare = outIdx >= 0 ? outIdx + 1 : -1;
const file = args.find((a, i) => !a.startsWith('--') && i !== idxDaSaltare);

// ── Lettore ───────────────────────────────────────────────────────────────

class Lettore {
  constructor(buf) {
    this.b = buf;
    this.p = 0;
  }
  get resto() { return this.b.length - this.p; }
  u8() { this.serve(1); return this.b[this.p++]; }
  i32() { this.serve(4); const v = this.b.readInt32LE(this.p); this.p += 4; return v; }
  u32() { this.serve(4); const v = this.b.readUInt32LE(this.p); this.p += 4; return v; }
  i64() {
    this.serve(8);
    const v = this.b.readBigInt64LE(this.p);
    this.p += 8;
    if (v > 0x7fffffffffffn || v < -1n) throw new Error(`int64 implausibile: ${v}`);
    return Number(v);
  }
  serve(n) {
    if (this.p + n > this.b.length) throw new Error('dati esauriti');
  }
  /** FString di UE: lunghezza negativa = UTF-16. Il terminatore è incluso nel conteggio. */
  fstring() {
    const len = this.i32();
    if (len === 0) return '';
    if (len < 0) {
      const unita = -len;
      if (unita > 1 << 20) throw new Error(`FString UTF-16 assurda: ${unita}`);
      const byte = unita * 2;
      this.serve(byte);
      const s = this.b.toString('utf16le', this.p, this.p + byte);
      this.p += byte;
      return s.replace(/\0+$/, '');
    }
    if (len > 1 << 20) throw new Error(`FString assurda: ${len}`);
    this.serve(len);
    const s = this.b.toString('utf8', this.p, this.p + len);
    this.p += len;
    return s.replace(/\0+$/, '');
  }
  textKey(versione) {
    if (versione >= 2) this.u32(); // hash della chiave, non ci serve per tradurre
    return this.fstring();
  }
}

// ── Parser ────────────────────────────────────────────────────────────────

function parseLocres(buf) {
  const r = new Lettore(buf);
  if (!buf.subarray(0, 16).equals(MAGIC)) throw new Error('GUID magico assente');
  r.p = 16;

  const versione = r.u8();
  if (!(versione in VERSIONI)) throw new Error(`versione ignota: ${versione}`);

  let offsetArray = -1;
  if (versione >= 1) offsetArray = r.i64();
  if (versione >= 2) r.u32(); // conteggio entry, ridondante

  // Array delle stringhe: sta più avanti nel file, si legge a parte.
  let stringhe = null;
  if (versione >= 1) {
    if (offsetArray < 0 || offsetArray >= buf.length) {
      throw new Error(`offset array stringhe fuori dai dati: ${offsetArray}`);
    }
    const ra = new Lettore(buf);
    ra.p = offsetArray;
    const n = ra.i32();
    if (n < 0 || n > 5_000_000) throw new Error(`conteggio stringhe assurdo: ${n}`);
    stringhe = new Array(n);
    for (let i = 0; i < n; i++) {
      stringhe[i] = ra.fstring();
      if (versione >= 2) ra.i32(); // refCount
    }
  }

  const nNamespace = r.u32();
  if (nNamespace > 500_000) throw new Error(`namespace assurdi: ${nNamespace}`);

  const voci = [];
  for (let i = 0; i < nNamespace; i++) {
    const ns = r.textKey(versione);
    const nChiavi = r.u32();
    if (nChiavi > 2_000_000) throw new Error(`chiavi assurde: ${nChiavi}`);
    for (let j = 0; j < nChiavi; j++) {
      const key = r.textKey(versione);
      const hashSorgente = r.u32();
      let testo;
      if (versione >= 1) {
        const idx = r.i32();
        if (!stringhe || idx < 0 || idx >= stringhe.length) {
          throw new Error(`indice stringa fuori range: ${idx}`);
        }
        testo = stringhe[idx];
      } else {
        testo = r.fstring();
      }
      voci.push({ namespace: ns, key, hashSorgente, testo });
    }
  }

  return {
    versione,
    versioneNome: VERSIONI[versione],
    voci,
    // Dove finisce la parte "indice": serve a stimare la lunghezza reale del file.
    fineIndice: r.p,
    fineDati: versione >= 1 ? Math.max(r.p, offsetArray) : r.p,
  };
}

// ── Scansione del dump ────────────────────────────────────────────────────

function scansiona(file) {
  const fd = fs.openSync(file, 'r');
  const dim = fs.statSync(file).size;
  const occorrenze = [];
  try {
    let letto = 0;
    while (letto < dim) {
      const inizio = letto === 0 ? 0 : letto - 15;
      const quanti = Math.min(CHUNK, dim - inizio);
      if (quanti <= 15 && letto !== 0) break;
      const buf = Buffer.alloc(quanti);
      const n = fs.readSync(fd, buf, 0, quanti, inizio);
      if (n <= 0) break;
      const vista = buf.subarray(0, n);
      let i = 0;
      while ((i = vista.indexOf(MAGIC, i)) !== -1) {
        occorrenze.push(inizio + i);
        i++;
      }
      letto = inizio + n;
    }

    // Per ogni ritrovamento, prova a decodificare.
    const risultati = [];
    for (const off of [...new Set(occorrenze)] ) {
      const quanti = Math.min(MAX_BLOB, dim - off);
      const blob = Buffer.alloc(quanti);
      const n = fs.readSync(fd, blob, 0, quanti, off);
      const vista = blob.subarray(0, n);
      try {
        const p = parseLocres(vista);
        risultati.push({ off, ok: true, ...p, blob: vista });
      } catch (e) {
        risultati.push({ off, ok: false, errore: e.message, versione: n > 16 ? vista[16] : null });
      }
    }
    return { dim, risultati };
  } finally {
    fs.closeSync(fd);
  }
}

// ── Referto ───────────────────────────────────────────────────────────────

function main() {
  if (!file) {
    console.log('Uso: node scripts/ue-locres-from-dump.js "<file.DMP>" [--out cartella] [--json]');
    console.log('');
    console.log('Come ottenere il .DMP: avvia il gioco, arriva al MENU PRINCIPALE,');
    console.log('poi Gestione attivita\' -> Dettagli -> tasto destro sul processo');
    console.log('-> "Crea file di dump".');
    process.exitCode = 2;
    return;
  }
  if (!fs.existsSync(file)) {
    console.log(`File non trovato: ${file}`);
    process.exitCode = 2;
    return;
  }

  const { dim, risultati } = scansiona(file);
  const buoni = risultati.filter((r) => r.ok);
  const rotti = risultati.filter((r) => !r.ok);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          file,
          dimensione: dim,
          trovati: risultati.length,
          decodificati: buoni.length,
          risorse: buoni.map((b) => ({
            offset: b.off,
            versione: b.versione,
            versioneNome: b.versioneNome,
            voci: b.voci.length,
            namespace: [...new Set(b.voci.map((v) => v.namespace))].length,
          })),
          errori: rotti.map((r) => ({ offset: r.off, versione: r.versione, errore: r.errore })),
        },
        null,
        2
      )
    );
  } else {
    console.log(`Dump: ${path.basename(file)} (${(dim / 1024 / 1024 / 1024).toFixed(2)} GB)`);
    console.log(`GUID .locres trovati: ${risultati.length} · decodificati: ${buoni.length}`);
    console.log('');
    for (const b of buoni) {
      const ns = [...new Set(b.voci.map((v) => v.namespace))];
      console.log(`+ offset 0x${b.off.toString(16)} · versione ${b.versione} (${b.versioneNome})`);
      console.log(`  ${b.voci.length} voci in ${ns.length} namespace`);
      const esempi = b.voci.filter((v) => v.testo && v.testo.length > 3).slice(0, 4);
      for (const e of esempi) {
        const t = e.testo.replace(/\s+/g, ' ').slice(0, 68);
        console.log(`    [${e.namespace || '(vuoto)'}/${e.key}] ${t}`);
      }
    }
    if (rotti.length) {
      console.log('');
      console.log(`Ritrovamenti NON decodificabili: ${rotti.length}`);
      for (const r of rotti.slice(0, 8)) {
        console.log(`  - 0x${r.off.toString(16)} (versione ${r.versione}): ${r.errore}`);
      }
      console.log('  Attesi: il GUID puo\' comparire anche in copie parziali o');
      console.log('  in buffer riusati. Conta solo che ce ne sia almeno uno buono.');
    }
    if (!buoni.length) {
      console.log('');
      console.log('Nessuna risorsa decodificata. Possibili cause, in ordine:');
      console.log('  1. il dump e\' stato preso prima che il gioco caricasse la lingua');
      console.log('     (rifallo dal menu principale);');
      console.log('  2. il dump non contiene la memoria completa del processo;');
      console.log('  3. il formato di questa build si discosta dalla specifica.');
    }
  }

  // Salvataggio dei blob e delle voci, per il passo successivo.
  if (outDir && buoni.length) {
    fs.mkdirSync(outDir, { recursive: true });
    for (const b of buoni) {
      const base = path.join(outDir, `locres_${b.off.toString(16)}`);
      // Il blob grezzo, tagliato a una lunghezza plausibile: serve come
      // RIFERIMENTO REALE per correggere parser e writer del progetto.
      const fine = Math.min(b.blob.length, Math.max(b.fineIndice, b.fineDati) + 4096);
      fs.writeFileSync(`${base}.locres`, b.blob.subarray(0, fine));
      fs.writeFileSync(
        `${base}.json`,
        JSON.stringify(
          { versione: b.versione, versioneNome: b.versioneNome, voci: b.voci },
          null,
          2
        )
      );
    }
    console.log('');
    console.log(`Salvati ${buoni.length} .locres + .json in ${path.resolve(outDir)}`);
  }
}

main();
