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
 *   node scripts/ue-locres-from-dump.js "<file.DMP>" --cerca-array 752
 *   node scripts/ue-locres-from-dump.js "<file.DMP>" --copie "0A7FC84841C29B4DB6D3F2B1164F219D"
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

  let stringheTroncate = null;
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
    // ⚠️ PARZIALE È MEGLIO DI NIENTE — imparato il 30/07/2026 su Below.
    // Prima questo ciclo lasciava propagare l'eccezione e l'intero .locres
    // veniva scartato: il referto diceva «FString UTF-16 assurda» e ZERO voci,
    // mentre in realtà 204 stringhe su 752 erano perfettamente leggibili, con
    // dialoghi interi. In un dump di memoria la coda TRONCA è la norma, non
    // l'eccezione: il buffer viene liberato dopo il caricamento e l'allocatore
    // ne ricicla dei pezzi. Un parser che pretende il file intero, su questa
    // sorgente, non serve a niente.
    //
    // Ora si legge finché i dati reggono e si DICHIARA dove ci si è fermati.
    // Il numero di stringhe recuperate è un dato del referto, non un dettaglio
    // nascosto: è quello che dice se serve un altro dump.
    for (let i = 0; i < n; i++) {
      try {
        stringhe[i] = ra.fstring();
        if (versione >= 2) ra.i32(); // refCount
      } catch (e) {
        stringheTroncate = { a: i, di: n, motivo: e.message, offset: ra.p };
        for (let k = i; k < n; k++) stringhe[k] = null;
        break;
      }
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
        // `null` = la chiave esiste ed è valida, ma la sua stringa cadeva nella
        // coda riciclata. Distinguerlo da stringa vuota è essenziale: dice
        // esattamente QUALI voci mancano, e quindi cosa deve recuperare il
        // prossimo dump. Buttare l'intero file perché ne mancano alcune
        // sarebbe stato il solito verdetto tutto-o-niente.
        testo = stringhe[idx];
      } else {
        testo = r.fstring();
      }
      voci.push({ namespace: ns, key, hashSorgente, indice: versione >= 1 ? undefined : null, testo, mancante: testo === null || testo === undefined });
    }
  }

  return {
    versione,
    versioneNome: VERSIONI[versione],
    voci,
    // Quante voci hanno davvero un testo. Se `mancanti` > 0 il file è
    // utilizzabile ma incompleto, e il referto deve dirlo forte: è la
    // differenza fra «ho le chiavi, mi mancano N stringhe» e un falso «fatto».
    mancanti: voci.filter((v) => v.mancante).length,
    stringheTroncate,
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

// ── Ricerca di ALTRE COPIE (31/07/2026, Below) ────────────────────────────
//
// La scansione del magic ha trovato UN solo Game.locres per dump, con l'array
// stringhe troncato a 204/752 e causa NON determinata. L'ipotesi da MISURARE:
// se il gioco ha caricato la localizzazione più volte (avvio in en, poi cambio
// in es), in memoria possono esistere ALTRE copie dei dati — anche parziali,
// anche SENZA magic davanti (l'array stringhe è autosufficiente: int32
// conteggio + FString). Il magic scan non le vede per definizione.
//
// Due misure, nessuna teoria:
//   --cerca-array N   cerca ogni int32 LE == N (il conteggio dell'array, per
//                     Below: 752) e prova a parsare da lì un array di FString
//                     v>=2 (FString + int32 refCount). Il rumore muore al primo
//                     FString implausibile; i candidati veri si riconoscono da
//                     QUANTE stringhe si leggono. Se un candidato supera le 204
//                     del blob noto, la copia buona esiste.
//   --copie "testo"   cerca un'ancora nota (chiave dell'indice o frase dei
//                     dialoghi) in ASCII e UTF-16LE, e per ogni occorrenza dice
//                     se è un FString SERIALIZZATO (int32 di lunghezza che
//                     combacia, col terminatore incluso — la stessa distinzione
//                     imparata con ue-dump-strings: l'euristica vale su blob
//                     serializzati, NON su FString vive in heap) e a che
//                     distanza sta dal magic .locres più vicino.
//
// ⚠️ Gli offset riportati sono POSIZIONI NEL FILE .DMP: al confine fra due
// regioni la lettura sequenziale sconfina in memoria di altri oggetti
// (lezione di --ricostruisci). Un candidato promettente va sempre riletto per
// indirizzo virtuale: --ricostruisci <offset>.

/** Scansione streaming generica: chiama visita(vista, inizioAssoluto) per chunk. */
function perChunk(file, sovrapposizione, visita) {
  const fd = fs.openSync(file, 'r');
  const dim = fs.statSync(file).size;
  try {
    let letto = 0;
    while (letto < dim) {
      const inizio = letto === 0 ? 0 : letto - sovrapposizione;
      const quanti = Math.min(CHUNK, dim - inizio);
      if (quanti <= sovrapposizione && letto !== 0) break;
      const buf = Buffer.alloc(quanti);
      const n = fs.readSync(fd, buf, 0, quanti, inizio);
      if (n <= 0) break;
      visita(buf.subarray(0, n), inizio);
      letto = inizio + n;
    }
    return dim;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Prova a leggere un array di stringhe .locres (v>=2) a partire da `off` nel
 * file: int32 conteggio (già verificato dal chiamante), poi FString + int32
 * refCount. Restituisce quante stringhe si leggono e un campione, fermandosi
 * dove i dati smettono di reggere — parziale è meglio di niente, come sopra.
 */
/**
 * Quota di caratteri "da testo" (lettere anche accentate, cifre, spazi,
 * punteggiatura, tag tipo <Speaker>) su una stringa.
 *
 * PERCHÉ ESISTE — misurato il 31/07/2026 sui dump veri di Below: la sola
 * plausibilità STRUTTURALE (lunghezze e refCount nei range) ha promosso
 * CENTINAIA di candidati «752/752» che erano rumore binario: tabelle di
 * offset e altre strutture reggono il parse per caso, ma decodificate danno
 * mojibake. La forma non basta: bisogna guardare cosa c'è scritto.
 */
function leggibilita(s) {
  if (!s) return 0;
  let ok = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (
      (c >= 0x20 && c <= 0x7e) || // ASCII stampabile
      (c >= 0xc0 && c <= 0x17f) || // latino accentato (es/fr/de/it…)
      c === 0x0a || c === 0x0d || c === 0x09 ||
      c === 0xa1 || c === 0xbf || c === 0xe9 // ¡ ¿ é e simili già coperti sopra
    ) ok++;
  }
  return ok / [...s].length;
}

function provaArray(fd, dim, off, conteggioAtteso, maxByte) {
  const n = Math.min(maxByte, dim - off);
  const buf = Buffer.alloc(n);
  fs.readSync(fd, buf, 0, n, off);
  const r = new Lettore(buf);
  let lette = 0;
  const campione = [];
  let byteValidi = 4;
  let sommaLeg = 0;
  let nonVuote = 0;
  try {
    const c = r.i32();
    if (c !== conteggioAtteso) return null; // race col chiamante, non dovrebbe
    for (let i = 0; i < c; i++) {
      const s = r.fstring();
      const ref = r.i32();
      if (ref < 0 || ref > 1_000_000) throw new Error(`refCount implausibile: ${ref}`);
      lette++;
      byteValidi = r.p;
      if (s && s.length >= 4) {
        sommaLeg += leggibilita(s);
        nonVuote++;
      }
      if (campione.length < 3 && s && s.length > 12) campione.push(s);
    }
  } catch {
    /* ci si ferma dove i dati finiscono: `lette` è la misura */
  }
  // `testo`: media di leggibilità sulle stringhe non banali. Il rumore binario
  // sta sotto 0,3; i dialoghi veri sopra 0,9. Con zero stringhe non banali il
  // candidato è rumore per definizione (un array di localizzazione ha frasi).
  const testo = nonVuote > 0 ? sommaLeg / nonVuote : 0;
  return { lette, campione, byteValidi, testo, nonVuote };
}

function cercaArray(file, conteggio, minStringhe) {
  const ago = Buffer.alloc(4);
  ago.writeInt32LE(conteggio, 0);
  const grezzi = [];
  const dim = perChunk(file, 3, (vista, base) => {
    let i = 0;
    while ((i = vista.indexOf(ago, i)) !== -1) {
      grezzi.push(base + i);
      i++;
    }
  });
  const posizioni = [...new Set(grezzi)];
  console.log(`Dump: ${path.basename(file)} (${(dim / 1024 ** 3).toFixed(2)} GB)`);
  console.log(`int32==${conteggio}: ${posizioni.length} occorrenze — ora il parse di prova su ognuna.`);

  const fd = fs.openSync(file, 'r');
  const candidati = [];
  try {
    for (const off of posizioni) {
      // Due stadi: un assaggio da 4 KB scarta il rumore (in un dump da 6 GB le
      // occorrenze di un int32 qualsiasi si contano a migliaia, e allocare
      // 64 MB per ognuna costerebbe minuti); solo chi regge l'assaggio viene
      // riletto per intero.
      // 64 KB e non meno: le prime FString possono essere dialoghi UTF-16 da
      // centinaia di byte l'una, e un assaggio troppo corto leggerebbe 0
      // stringhe COMPLETE da un candidato vero, scartandolo in silenzio.
      const assaggio = provaArray(fd, dim, off, conteggio, 65536);
      if (!assaggio || assaggio.lette < Math.min(minStringhe, 3)) continue;
      const esito = provaArray(fd, dim, off, conteggio, MAX_BLOB);
      if (esito && esito.lette >= minStringhe) candidati.push({ off, ...esito });
    }
  } finally {
    fs.closeSync(fd);
  }

  // Il verdetto è CONTENUTO, non forma: misurato il 31/07 sui dump veri, la
  // sola struttura promuove centinaia di falsi «752/752». Si separa per
  // leggibilità e si dice quanto rumore c'era — nasconderlo sarebbe il solito
  // referto che sembra una buona notizia.
  const SOGLIA_TESTO = 0.7;
  const veri = candidati.filter((c) => c.testo >= SOGLIA_TESTO);
  const rumore = candidati.length - veri.length;
  veri.sort((a, b) => b.lette - a.lette);

  // Candidati sovrapposti (stesso buffer visto da offset vicini): si tiene il
  // migliore per zona, gli altri sono la stessa scoperta ripetuta.
  const distinti = [];
  for (const c of veri) {
    const doppione = distinti.find((d) => Math.abs(d.off - c.off) < Math.max(d.byteValidi, c.byteValidi));
    if (!doppione) distinti.push(c);
  }

  console.log(`Candidati strutturalmente validi: ${candidati.length} · con TESTO leggibile (≥${SOGLIA_TESTO}): ${distinti.length} (${rumore} scartati come rumore binario)`);
  for (const c of distinti.slice(0, 12)) {
    console.log(`\n+ offset ${c.off} (0x${c.off.toString(16)}): ${c.lette}/${conteggio} stringhe · leggibilità ${c.testo.toFixed(2)} · ${c.byteValidi} byte validi`);
    for (const s of c.campione) console.log(`    «${s.replace(/\s+/g, ' ').slice(0, 70)}»`);
  }
  if (!distinti.length) {
    console.log('\nNessun array con testo leggibile: o la copia intera non esiste in');
    console.log('questo dump, o e\' spezzata su regioni non contigue nel file.');
    console.log('Prossima misura: un dump nuovo, preso in un momento diverso.');
  } else {
    console.log('\nIl candidato va RILETTO per indirizzo virtuale prima di fidarsi:');
    console.log(`  node scripts/ue-locres-from-dump.js "<dump>" --ricostruisci ${distinti[0].off} --bytes ${Math.max(distinti[0].byteValidi + 65536, 1048576)}`);
  }
  return distinti;
}

function cercaCopie(file, testo) {
  const forme = [
    { nome: 'ascii', ago: Buffer.from(testo, 'latin1') },
    { nome: 'utf16', ago: Buffer.from(testo, 'utf16le') },
  ];
  const sovr = Math.max(...forme.map((f) => f.ago.length)) - 1 + 16;
  const occorrenze = [];
  const magici = [];
  const dim = perChunk(file, sovr, (vista, base) => {
    let m = 0;
    while ((m = vista.indexOf(MAGIC, m)) !== -1) {
      magici.push(base + m);
      m++;
    }
    for (const f of forme) {
      let i = 0;
      while ((i = vista.indexOf(f.ago, i)) !== -1) {
        occorrenze.push({ off: base + i, forma: f.nome, lung: f.ago.length });
        i++;
      }
    }
  });

  const uniche = [];
  const visti = new Set();
  for (const o of occorrenze) {
    const k = `${o.forma}:${o.off}`;
    if (!visti.has(k)) {
      visti.add(k);
      uniche.push(o);
    }
  }
  uniche.sort((a, b) => a.off - b.off);
  const magiciUnici = [...new Set(magici)].sort((a, b) => a - b);

  console.log(`Dump: ${path.basename(file)} (${(dim / 1024 ** 3).toFixed(2)} GB)`);
  console.log(`Ancora: «${testo}» → ${uniche.length} occorrenze (ascii+utf16) · magic .locres nel dump: ${magiciUnici.length}`);

  const fd = fs.openSync(file, 'r');
  try {
    for (const o of uniche.slice(0, 40)) {
      // FString serializzato? L'int32 subito prima deve dichiarare la
      // lunghezza Col terminatore: ascii → n+1, utf16 → -(n+1).
      const testa = Buffer.alloc(4);
      let serializzato = false;
      if (o.off >= 4) {
        fs.readSync(fd, testa, 0, 4, o.off - 4);
        const len = testa.readInt32LE(0);
        const nUnita = o.forma === 'utf16' ? o.lung / 2 : o.lung;
        serializzato = o.forma === 'utf16' ? len === -(nUnita + 1) : len === nUnita + 1;
      }
      let prec = null;
      for (const m of magiciUnici) {
        if (m <= o.off) prec = m;
        else break;
      }
      const dist = prec === null ? null : o.off - prec;
      console.log(
        `  ${String(o.off).padStart(12)} (0x${o.off.toString(16)}) · ${o.forma}` +
          ` · ${serializzato ? 'SERIALIZZATO (blob .locres?)' : 'vivo/altro'}` +
          (dist === null ? ' · nessun magic prima' : ` · magic precedente a -${dist} byte`)
      );
    }
    if (uniche.length > 40) console.log(`  … e altre ${uniche.length - 40}.`);
  } finally {
    fs.closeSync(fd);
  }
  console.log('\nCOME LEGGERLO: un\'occorrenza SERIALIZZATA lontana dai magic noti è un');
  console.log('buffer che il magic scan non vede — ispezionala (--ispeziona <off>) e,');
  console.log('se promette, rileggila per indirizzo virtuale (--ricostruisci <off>).');
  return { occorrenze: uniche, magici: magiciUnici };
}

// ── Referto ───────────────────────────────────────────────────────────────

/**
 * Mostra i byte grezzi di un ritrovamento, campo per campo.
 *
 * PERCHÉ SERVE — 30/07/2026, Below, Rusted Gods. In DUE dump indipendenti, a
 * offset diversi, compare lo stesso blob con `versione 3` che il parser rifiuta
 * con «FString UTF-16 assurda: 37396165», sempre lo stesso numero. Un errore
 * identico in due catture diverse non è memoria sporca: è una STRUTTURA che il
 * parser non sa leggere. E poiché tutti i .locres decodificati finora sono del
 * motore (OnlineSubsystem, K2Node, NetworkErrors), il candidato più probabile
 * per il blob che NON si legge è proprio il Game.locres.
 *
 * Il parser è stato scritto sulla specifica di CUE4Parse, dove `Optimized_CRC32`
 * è l'ultima versione. Se UE ne ha aggiunta una dopo, il parser applica il
 * layout sbagliato e si schianta sul primo campo variabile — esattamente il
 * sintomo osservato. Qui non si indovina: si guardano i byte.
 */
function ispeziona(f, off) {
  const QUANTI = 512;
  const fd = fs.openSync(f, 'r');
  let buf;
  try {
    const dim = fs.statSync(f).size;
    const n = Math.min(QUANTI, dim - off);
    buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, off);
  } finally {
    fs.closeSync(fd);
  }

  console.log(`\nIspezione di ${path.basename(f)} a offset ${off} (0x${off.toString(16)})\n`);

  const magicOk = buf.subarray(0, 16).equals(MAGIC);
  console.log(`  magic GUID:  ${magicOk ? 'OK' : 'ASSENTE — non è un .locres'}`);
  if (!magicOk) return;

  const ver = buf[16];
  console.log(`  versione:    ${ver}  (${VERSIONI[ver] || 'SCONOSCIUTA — oltre la specifica implementata'})`);

  // Layout atteso per version >= 1, così come lo applica il parser.
  let p = 17;
  const offStringhe = buf.readBigInt64LE(p); p += 8;
  console.log(`  offset array stringhe: ${offStringhe}  ${offStringhe > 0n && offStringhe < 50000000n ? '(plausibile)' : '⚠ implausibile'}`);
  if (ver >= 2) {
    const conteggio = buf.readUInt32LE(p); p += 4;
    console.log(`  conteggio entry:       ${conteggio}  ${conteggio < 200000 ? '(plausibile)' : '⚠ implausibile'}`);
  }
  const numNs = buf.readUInt32LE(p); p += 4;
  console.log(`  numero namespace:      ${numNs}  ${numNs > 0 && numNs < 10000 ? '(plausibile)' : '⚠ implausibile'}`);
  console.log(`  → il parser prosegue da offset ${p} del blob; è lì che si rompe.\n`);

  for (let r = 0; r < buf.length; r += 16) {
    const riga = buf.subarray(r, Math.min(r + 16, buf.length));
    const hex = [...riga].map((b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(47);
    const asc = [...riga].map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.')).join('');
    const marca = r === 16 ? ' ← versione' : r === 0 ? ' ← magic' : '';
    console.log(`  ${(off + r).toString(16).padStart(9)}  ${hex} |${asc}|${marca}`);
  }

  console.log('\n  COSA GUARDARE: se nella colonna di destra si intravedono nomi di');
  console.log('  namespace o chiavi, il blob è un .locres vero e il layout va corretto.');
  console.log('  Se è rumore, il magic è una coincidenza e il blob non ci interessa.');
}

function main() {
  if (!file) {
    console.log('Uso: node scripts/ue-locres-from-dump.js "<file.DMP>" [--out cartella] [--json]');
    console.log('  --cerca-array N     cerca copie dell\'array stringhe (N = conteggio atteso,');
    console.log('                      es. 752 per Below) [--min-stringhe 8]');
    console.log('  --copie "testo"     occorrenze di una chiave/frase nota, ascii+utf16,');
    console.log('                      con verdetto serializzato/vivo e distanza dal magic');
    console.log('  --ispeziona OFF     esadecimale commentato di un ritrovamento');
    console.log('  --estrai OFF        salva il blob grezzo [--bytes N]');
    console.log('  --ricostruisci OFF  come --estrai ma per indirizzo virtuale (corretto)');
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

  // --cerca-array: la misura diretta per le stringhe mancanti di Below.
  const idxArr = args.indexOf('--cerca-array');
  if (idxArr >= 0) {
    const conteggio = parseInt(args[idxArr + 1], 10);
    if (!Number.isFinite(conteggio) || conteggio <= 0) {
      console.error('--cerca-array vuole il conteggio atteso dell\'array (per Below: 752).');
      process.exitCode = 2;
      return;
    }
    const idxMin = args.indexOf('--min-stringhe');
    const minS = idxMin >= 0 ? parseInt(args[idxMin + 1], 10) : 8;
    cercaArray(file, conteggio, minS);
    return;
  }

  // --copie: ancora testuale per trovare buffer che il magic scan non vede.
  const idxCopie = args.indexOf('--copie');
  if (idxCopie >= 0) {
    const testo = args[idxCopie + 1];
    if (!testo || testo.startsWith('--')) {
      console.error('--copie vuole un testo (una chiave dell\'indice o una frase nota).');
      process.exitCode = 2;
      return;
    }
    cercaCopie(file, testo);
    return;
  }

  // --ricostruisci: come --estrai, ma leggendo per INDIRIZZO VIRTUALE.
  // È la modalità corretta. --estrai legge il file di seguito e al confine fra
  // due regioni del dump finisce in un'altra zona di memoria del processo: da
  // lì i byte sono validi ma appartengono a un altro oggetto, e il parser si
  // schianta su quello che sembra rumore. Vedi scripts/minidump.js.
  const idxRic = args.indexOf('--ricostruisci');
  if (idxRic >= 0) {
    const off = parseInt(args[idxRic + 1], 10);
    const idxB2 = args.indexOf('--bytes');
    const quanti = idxB2 >= 0 ? parseInt(args[idxB2 + 1], 10) : 4 * 1024 * 1024;
    const { mappaRegioni, offsetAVirtuale, leggiVirtuale } = require('./minidump.js');

    const { regioni, tipo } = mappaRegioni(file);
    console.log(`Dump ${tipo}: ${regioni.length} regioni di memoria.`);

    const va = offsetAVirtuale(regioni, off);
    if (va === null) {
      console.error(`L'offset ${off} non cade in nessuna regione: non è memoria del processo.`);
      process.exitCode = 2;
      return;
    }
    console.log(`offset ${off} → indirizzo virtuale 0x${va.toString(16)}`);

    const res = leggiVirtuale(file, regioni, va, quanti);
    console.log(`letti ${res.letti} byte su ${quanti} richiesti${res.completo ? '' : ` — il dump si interrompe qui (${res.buchi} buco/hi)`}`);

    const dest = outDir || '.';
    fs.mkdirSync(dest, { recursive: true });
    const nome = path.join(dest, `va_${va.toString(16)}.locres`);
    fs.writeFileSync(nome, res.dati);
    console.log(`Salvato in ${path.resolve(nome)}`);
    return;
  }

  // --estrai: salva il blob grezzo su file, così il parser lo può masticare
  // offline quante volte serve senza rifare un dump da 6 GB ogni volta.
  // Il .DMP sta su un disco esterno e non è versionabile; il blob sì (è piccolo)
  // e diventa la FIXTURE VERA che finora mancava — le fixture attuali le genera
  // il nostro stesso writer, quindi provano solo che siamo coerenti con noi
  // stessi, non con Unreal. Vedi [locres-magic-sbagliato].
  const idxEstrai = args.indexOf('--estrai');
  if (idxEstrai >= 0) {
    const off = parseInt(args[idxEstrai + 1], 10);
    const idxB = args.indexOf('--bytes');
    const quanti = idxB >= 0 ? parseInt(args[idxB + 1], 10) : 1024 * 1024;
    if (!Number.isFinite(off) || off < 0) {
      console.error('--estrai vuole un offset numerico.');
      process.exitCode = 2;
      return;
    }
    const fd = fs.openSync(file, 'r');
    try {
      const dim = fs.statSync(file).size;
      const n = Math.min(quanti, dim - off);
      const buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, off);
      const dest = outDir || '.';
      fs.mkdirSync(dest, { recursive: true });
      const nome = path.join(dest, `blob_${off.toString(16)}.locres`);
      fs.writeFileSync(nome, buf);
      console.log(`Salvati ${n} byte da offset ${off} in ${path.resolve(nome)}`);
      console.log('Il file contiene quasi certamente coda di memoria estranea dopo');
      console.log('il .locres: è voluto, si taglia dopo aver capito dove finisce.');
    } finally {
      fs.closeSync(fd);
    }
    return;
  }

  const idxIsp = args.indexOf('--ispeziona');
  if (idxIsp >= 0) {
    const off = parseInt(args[idxIsp + 1], 10);
    if (!Number.isFinite(off) || off < 0) {
      console.error('--ispeziona vuole un offset numerico (quello riportato in "errori").');
      process.exitCode = 2;
      return;
    }
    ispeziona(file, off);
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
            // Un .locres recuperato da memoria è quasi sempre PARZIALE: queste
            // due righe sono la differenza fra un referto utile e un «fatto»
            // che nasconde metà del lavoro ancora da fare.
            conTesto: b.voci.length - (b.mancanti || 0),
            mancanti: b.mancanti || 0,
            troncatoA: b.stringheTroncate || null,
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
