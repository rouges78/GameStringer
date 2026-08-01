#!/usr/bin/env node
/**
 * Cerca i BLOCCHI DECOMPRESSI SUCCESSIVI di un array di stringhe .locres
 * dentro un dump di memoria (o dentro un blob grezzo, per collaudo).
 *
 * PERCHÉ ESISTE — misurato il 01/08/2026 su Below, Rusted Gods
 * ------------------------------------------------------------
 * Il buffer del .locres trovato nel dump contiene **65.536 byte esatti** di dati
 * decompressi (64 KiB tondi, rottura su VA allineato, entropia 3,5 → 7,97 al
 * confine): non è un file troncato, è la **finestra di decompressione di
 * Oodle/IoStore**. Il resto dell'array — 549 stringhe su 752 — non sta lì.
 *
 * `--cerca-array N` non può trovare i blocchi successivi **per costruzione**:
 * cerca l'int32 del conteggio, che sta solo in testa all'array, cioè nel primo
 * blocco. Il blocco 2 comincia *a metà di una stringa* e non ha intestazione.
 *
 * IL MARCATORE — struttura, non parole
 * ------------------------------------
 * Una parola cercata a tappeto trova soprattutto le FString VIVE della mappa di
 * FTextLocalizationManager, che non ci servono (lezione del 30/07: il testo in
 * memoria c'è, ma senza chiavi accanto). Il segno distintivo di un blocco
 * SERIALIZZATO è invece strutturale:
 *
 *   una CATENA di record consecutivi   int32 len · dati · int32 refCount
 *   con len < 0 (UTF-16, |len| unità incluso il terminatore), testo plausibile,
 *   e — dato che l'array .locres è ordinato — in ordine ALFABETICO non calante.
 *
 * Una FString viva è un'allocazione a sé: non ha un vicino che si incastra.
 * Servono `--min-record` record di fila perché il caso valga come ritrovamento.
 *
 * COME LAVORA
 *   1. prefiltro veloce: cerca le àncore testuali in UTF-16LE (Buffer.indexOf)
 *   2. per ogni riscontro risale all'inizio del record che lo contiene
 *      (un int32 di lunghezza che cade ESATTO su quella posizione)
 *   3. da lì avanza contando i record validi, e misura l'ordinamento
 *   4. riporta solo le catene lunghe, con VA, e segnala quelle già note
 *
 * ⚠️ ONESTÀ SUL COLLAUDO: il controllo positivo è la fixture AUTENTICA
 * (`__tests__/fixtures/engines/unreal/below-rusted-gods-Game-es.locres`, presa
 * dalla memoria di un gioco vero) e il blob riletto per indirizzo virtuale —
 * NON un file generato da questo script. Vedi [locres-magic-sbagliato] e la
 * lezione delle fixture che si validavano da sole.
 *
 * Uso:
 *   node scripts/ue-cerca-blocchi-locres.js "<file.DMP>"
 *   node scripts/ue-cerca-blocchi-locres.js "<file.DMP>" --ancore "Operador,misión"
 *   node scripts/ue-cerca-blocchi-locres.js "<blob>" --grezzo      (collaudo)
 *   node scripts/ue-cerca-blocchi-locres.js "<blob>" --grezzo --autotest
 *
 *   --min-record N   record consecutivi minimi perché sia un ritrovamento (12)
 *   --noto VA        VA del blocco già noto, per marcarlo invece di riproporlo
 *   --out CARTELLA   salva i blocchi trovati (rilettura per indirizzo virtuale)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── argomenti ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const GREZZO = args.includes('--grezzo');
const AUTOTEST = args.includes('--autotest');

function opz(nome, def) {
  const i = args.indexOf(nome);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
}

const MIN_RECORD = parseInt(opz('--min-record', '12'), 10);
const OUT_DIR = opz('--out', '');
// Il blocco 1 di Below, per non riproporlo come scoperta.
const NOTO = opz('--noto', '0x1d01f750000');
const ANCORE = opz('--ancore', 'Operador,misión,protocolo,ascensor,abismo,control')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Un record .locres v>=2: int32 len · dati · int32 refCount.
const MAX_UNITA = 4000;   // stringhe più lunghe di così: sospette
const MAX_REFCOUNT = 1 << 24;

/**
 * Prova a leggere UN record a `p`. Ritorna {testo, fine} oppure null.
 * Severo di proposito: preferisce dire "non è un record" che indovinare.
 */
function leggiRecord(buf, p) {
  if (p < 0 || p + 4 > buf.length) return null;
  const len = buf.readInt32LE(p);
  let nb;
  let testo;
  if (len < 0) {
    const unita = -len;
    if (unita < 1 || unita > MAX_UNITA) return null;
    nb = unita * 2;
    if (p + 4 + nb + 4 > buf.length) return null;
    // terminatore UTF-16 obbligatorio
    if (buf.readUInt16LE(p + 4 + nb - 2) !== 0) return null;
    testo = buf.toString('utf16le', p + 4, p + 4 + nb - 2);
  } else if (len > 0) {
    if (len > MAX_UNITA) return null;
    nb = len;
    if (p + 4 + nb + 4 > buf.length) return null;
    if (buf[p + 4 + nb - 1] !== 0) return null;
    testo = buf.toString('latin1', p + 4, p + 4 + nb - 1);
  } else {
    return null; // len == 0: non lo consideriamo (troppi falsi positivi)
  }
  const refCount = buf.readInt32LE(p + 4 + nb);
  if (refCount < 0 || refCount > MAX_REFCOUNT) return null;
  return { testo, fine: p + 4 + nb + 4 };
}

/** Testo plausibile: quasi tutto stampabile e senza CJK/roba fuori posto. */
function plausibile(s) {
  if (s.length === 0) return true;
  let buoni = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 0x24f) || c === 0x2026) buoni++;
  }
  return buoni / s.length >= 0.9;
}

/** Catena di record a partire da p. */
function catena(buf, p) {
  const testi = [];
  let pos = p;
  for (;;) {
    const r = leggiRecord(buf, pos);
    if (!r || !plausibile(r.testo)) break;
    testi.push(r.testo);
    pos = r.fine;
  }
  return { testi, fine: pos };
}

/** Frazione di coppie consecutive in ordine non calante (l'array .locres è ordinato). */
function ordinamento(testi) {
  if (testi.length < 2) return 0;
  let ok = 0;
  for (let i = 1; i < testi.length; i++) {
    if (testi[i - 1].localeCompare(testi[i], 'es') <= 0) ok++;
  }
  return ok / (testi.length - 1);
}

/**
 * Dalla posizione di un'àncora risale all'inizio del record che la contiene:
 * cerca all'indietro un int32 di lunghezza che cada ESATTAMENTE su quel testo.
 */
function inizioRecord(buf, posTesto) {
  for (let d = 4; d <= MAX_UNITA * 2 + 8; d += 2) {
    const p = posTesto - d;
    if (p < 0) break;
    const r = leggiRecord(buf, p);
    if (r && p + 4 <= posTesto && posTesto < r.fine) return p;
  }
  return -1;
}

// ── ricerca su un buffer ─────────────────────────────────────────────────────
function cercaInBuffer(buf, baseVa, etichetta, visti) {
  const trovati = [];
  for (const parola of ANCORE) {
    const ago = Buffer.from(parola, 'utf16le');
    let da = 0;
    for (;;) {
      const i = buf.indexOf(ago, da);
      if (i < 0) break;
      da = i + 2;

      const inizio = inizioRecord(buf, i);
      if (inizio < 0) continue;
      // già coperto da una catena trovata prima?
      if (visti.some(([a, b]) => inizio >= a && inizio < b)) continue;

      const c = catena(buf, inizio);
      if (c.testi.length < MIN_RECORD) continue;

      visti.push([inizio, c.fine]);
      trovati.push({
        etichetta,
        offset: inizio,
        va: baseVa === null ? null : baseVa + BigInt(inizio),
        record: c.testi.length,
        byte: c.fine - inizio,
        ordine: ordinamento(c.testi),
        primi: c.testi.slice(0, 3),
        ultimi: c.testi.slice(-2),
      });
    }
  }
  return trovati;
}

// ── autotest: controllo positivo e negativo su dati REALI ────────────────────
function autotest(percorso) {
  console.log('AUTOTEST su dati reali (nessuna fixture generata da questo script)\n');
  const buf = fs.readFileSync(percorso);

  // Positivo: l'array noto deve produrre una catena lunga e ordinata.
  const visti = [];
  const t = cercaInBuffer(buf, null, 'positivo', visti);
  const migliore = t.sort((a, b) => b.record - a.record)[0];
  if (!migliore) {
    console.log('✗ POSITIVO FALLITO: nessuna catena trovata nel blocco noto.');
    process.exitCode = 1;
    return;
  }
  console.log(`✓ positivo: catena di ${migliore.record} record, ordine ${migliore.ordine.toFixed(2)}`);
  console.log(`  primi: ${migliore.primi.map((s) => JSON.stringify(s.slice(0, 40))).join(' · ')}`);
  if (migliore.ordine < 0.9) {
    console.log('  ⚠️ ordinamento basso: l\'array dovrebbe essere alfabetico — controllare.');
  }

  // Negativo: rumore casuale non deve produrre catene.
  const rumore = Buffer.alloc(buf.length);
  for (let i = 0; i + 4 <= rumore.length; i += 4) {
    rumore.writeUInt32LE((Math.random() * 0xffffffff) >>> 0, i);
  }
  const f = cercaInBuffer(rumore, null, 'negativo', []);
  if (f.length) {
    console.log(`✗ NEGATIVO FALLITO: ${f.length} catene su rumore casuale (soglia troppo bassa).`);
    process.exitCode = 1;
  } else {
    console.log('✓ negativo: zero catene su rumore casuale della stessa dimensione.');
  }

  // Negativo 2: testo UTF-16 senza struttura di record.
  const soloTesto = Buffer.from(ANCORE.join(' ').repeat(5000), 'utf16le');
  const g = cercaInBuffer(soloTesto, null, 'negativo2', []);
  if (g.length) {
    console.log(`✗ NEGATIVO2 FALLITO: ${g.length} catene su testo senza record.`);
    process.exitCode = 1;
  } else {
    console.log('✓ negativo2: zero catene su testo UTF-16 privo di int32 di lunghezza.');
  }
}

// ── principale ───────────────────────────────────────────────────────────────
function main() {
  if (!file || !fs.existsSync(file)) {
    console.log('Uso: node scripts/ue-cerca-blocchi-locres.js "<file.DMP>" [--ancore "a,b"]');
    console.log('     [--min-record 12] [--noto 0x…] [--out cartella]');
    console.log('     [--grezzo] [--autotest]   (su un blob invece che su un dump)');
    process.exitCode = 2;
    return;
  }

  if (AUTOTEST) return autotest(file);

  console.log(`Àncore: ${ANCORE.join(', ')}  ·  catena minima: ${MIN_RECORD} record\n`);

  if (GREZZO) {
    const buf = fs.readFileSync(file);
    const t = cercaInBuffer(buf, null, path.basename(file), []);
    stampa(t, null);
    return;
  }

  const { mappaRegioni, leggiVirtuale } = require('./minidump.js');
  const { regioni, tipo } = mappaRegioni(file);
  console.log(`Dump ${tipo}: ${regioni.length} regioni.`);

  const notoVa = NOTO ? BigInt(NOTO) : null;
  const trovati = [];
  const fd = fs.openSync(file, 'r');
  try {
    let fatte = 0;
    for (const r of regioni) {
      fatte++;
      if (fatte % 1000 === 0) process.stdout.write(`  …${fatte}/${regioni.length} regioni\r`);
      const dim = Number(r.dim);
      if (dim < 4096 || dim > 256 * 1024 * 1024) continue;
      const buf = Buffer.alloc(dim);
      const n = fs.readSync(fd, buf, 0, dim, Number(r.off));
      if (n <= 0) continue;
      trovati.push(...cercaInBuffer(buf.subarray(0, n), r.va, `VA 0x${r.va.toString(16)}`, []));
    }
  } finally {
    fs.closeSync(fd);
  }
  process.stdout.write('                                        \r');
  stampa(trovati, notoVa);

  if (OUT_DIR && trovati.length) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const t of trovati) {
      if (!t.va) continue;
      const res = leggiVirtuale(file, regioni, t.va, Math.max(t.byte + 65536, 262144));
      const nome = path.join(OUT_DIR, `blocco_${t.va.toString(16)}.bin`);
      fs.writeFileSync(nome, res.dati);
      console.log(`  salvato ${nome} (${res.letti} byte)`);
    }
  }
}

function stampa(trovati, notoVa) {
  trovati.sort((a, b) => b.record - a.record);
  const nuovi = trovati.filter(
    (t) => !(notoVa !== null && t.va !== null && t.va >= notoVa && t.va < notoVa + 65536n)
  );

  console.log(`\nCatene trovate: ${trovati.length}  ·  fuori dal blocco già noto: ${nuovi.length}\n`);
  if (!nuovi.length) {
    console.log('Nessun blocco NUOVO. Se anche le catene totali sono 0 o solo quella nota,');
    console.log('i blocchi 2+ non sono più in memoria: la via del dump è chiusa davvero.');
    return;
  }
  for (const t of nuovi.slice(0, 20)) {
    const dove = t.va !== null ? `VA 0x${t.va.toString(16)}` : `offset ${t.offset}`;
    console.log(`+ ${dove} · ${t.record} record · ${t.byte} byte · ordine ${t.ordine.toFixed(2)}`);
    for (const s of t.primi) console.log(`    «${s.slice(0, 70)}»`);
    console.log(`    …`);
    for (const s of t.ultimi) console.log(`    «${s.slice(0, 70)}»`);
    console.log('');
  }
  console.log('Un ordine vicino a 1.00 su molti record = array .locres ordinato:');
  console.log('è la continuazione cercata. Ordine basso = stringhe vere ma non l\'array.');
}

main();
