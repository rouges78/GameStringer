#!/usr/bin/env node
/**
 * Trova il caricatore di .locres dentro un eseguibile Unreal, usando come ancora
 * il GUID magico del formato invece di un pattern di prologo.
 *
 * PERCHÉ QUESTO INVECE DEL PATTERN SCANNING
 * -----------------------------------------
 * Misurato il 30/07/2026 su 5 giochi UE reali: il pattern del prologo di
 * FText::ToString per UE4.27 compare 89-127 volte per binario, e PatternScan
 * ritorna il primo. Un'ancora su un PROLOGO è un indizio debole, perché i
 * prologhi si ripetono.
 *
 * Un GUID a 16 byte invece è unico per costruzione. `FTextLocalizationResource`
 * confronta il GUID letto dal file con la costante
 *
 *     FGuid(0x7574140E, 0xFC034A67, 0x9D90154A, 0x1B7F37C3)
 *
 * (fonte: CUE4Parse/UE4/Localization/FTextLocalizationResource.cs, che rispecchia
 * FTextLocalizationResourceVersion::LocResMagic di UE). Quella costante deve
 * stare nei dati dell'eseguibile, e il codice che la referenzia È il caricatore.
 * Da lì si risale alla funzione: un solo candidato, non centinaia.
 *
 * A COSA SERVE IL CARICATORE
 * --------------------------
 * Riceve il .locres GIÀ DECOMPRESSO (Oodle l'ha già sciolto il gioco, per conto
 * suo) e ne estrae namespace + key + stringa. Sono esattamente i tre dati che
 * servono per costruire un .locres di override, e che l'hook su FText::ToString
 * NON può dare: quello vede la stringa da mostrare, non la chiave.
 *
 * SOLA LETTURA: apre l'eseguibile, lo legge, lo richiude.
 *
 * Uso:
 *   node scripts/ue-find-locres-loader.js --exe "C:/.../Game-Win64-Shipping.exe"
 *   node scripts/ue-find-locres-loader.js --exe ... --json
 */

const fs = require('fs');
const path = require('path');

// Il GUID è serializzato come quattro uint32 little-endian, nell'ordine A,B,C,D.
const LOCRES_MAGIC_U32 = [0x7574140e, 0xfc034a67, 0x9d90154a, 0x1b7f37c3];
const LOCRES_MAGIC = Buffer.alloc(16);
LOCRES_MAGIC_U32.forEach((v, i) => LOCRES_MAGIC.writeUInt32LE(v, i * 4));

// Il magic a 4 byte che il progetto usa oggi in unreal_localization.rs. Lo
// cerchiamo per DIMOSTRARE che non c'è: se il GUID vero compare e questo no,
// il verdetto sul bug è misurato, non argomentato.
const MAGIC_PROGETTO = Buffer.from([0x7a, 0xda, 0x14, 0x0e]);

const CHUNK = 32 * 1024 * 1024;
const IMAGE_SCN_MEM_EXECUTE = 0x20000000;

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const exeIdx = args.indexOf('--exe');
const exePath = exeIdx >= 0 ? args[exeIdx + 1] : null;

// ── PE ────────────────────────────────────────────────────────────────────

function sezioni(fd) {
  const dos = Buffer.alloc(0x40);
  fs.readSync(fd, dos, 0, 0x40, 0);
  if (dos.readUInt16LE(0) !== 0x5a4d) throw new Error('non è un PE (manca MZ)');
  const peOff = dos.readUInt32LE(0x3c);
  const coff = Buffer.alloc(24);
  fs.readSync(fd, coff, 0, 24, peOff);
  if (coff.readUInt32LE(0) !== 0x00004550) throw new Error('firma PE assente');

  const numSezioni = coff.readUInt16LE(6);
  const sizeOptional = coff.readUInt16LE(20);
  const tabOff = peOff + 24 + sizeOptional;
  const tab = Buffer.alloc(40 * numSezioni);
  fs.readSync(fd, tab, 0, tab.length, tabOff);

  const out = [];
  for (let i = 0; i < numSezioni; i++) {
    const s = tab.subarray(i * 40, i * 40 + 40);
    out.push({
      nome: s.subarray(0, 8).toString('ascii').replace(/\0+$/, ''),
      virtualAddress: s.readUInt32LE(12),
      sizeOfRawData: s.readUInt32LE(16),
      pointerToRawData: s.readUInt32LE(20),
      eseguibile: !!(s.readUInt32LE(36) & IMAGE_SCN_MEM_EXECUTE),
    });
  }
  return { machine: coff.readUInt16LE(4), sezioni: out };
}

/** Scorre una sezione a blocchi sovrapposti, chiamando `fn(vista, offsetAssoluto)`. */
function perBlocchi(fd, sez, sovrapposizione, fn) {
  let letto = 0;
  while (letto < sez.sizeOfRawData) {
    const inizio = letto === 0 ? 0 : letto - sovrapposizione;
    const quanti = Math.min(CHUNK, sez.sizeOfRawData - inizio);
    if (quanti <= sovrapposizione && letto !== 0) break;
    const buf = Buffer.alloc(quanti);
    const n = fs.readSync(fd, buf, 0, quanti, sez.pointerToRawData + inizio);
    if (n <= 0) break;
    fn(buf.subarray(0, n), sez.pointerToRawData + inizio);
    letto = inizio + n;
  }
}

/** Offset di file → RVA. */
function faiRva(sezs, off) {
  for (const s of sezs) {
    if (off >= s.pointerToRawData && off < s.pointerToRawData + s.sizeOfRawData) {
      return { rva: s.virtualAddress + (off - s.pointerToRawData), sezione: s.nome };
    }
  }
  return null;
}

// ── Strategia 2: i quattro immediati ravvicinati ──────────────────────────
//
// Un FGuid sono quattro uint32. `if (Magic == LocResMagic)` non richiede al
// compilatore di materializzare una costante da 16 byte: la via più naturale è
// confrontare i quattro campi con altrettanti IMMEDIATI nel flusso di
// istruzioni (`cmp dword ptr [rcx], 7574140Eh` e così via). In quel caso la
// costante da 16 byte NON esiste da nessuna parte, ed è ciò che abbiamo
// osservato su BelowRustedGods.
//
// Quindi cerchiamo i quattro valori separatamente nelle sezioni ESEGUIBILI e poi
// i punti dove almeno due valori DISTINTI cadono in una finestra ravvicinata.
// Preso da solo, `0E 14 74 75` è un indizio debole; due o più dei quattro a
// pochi byte di distanza no: quella è la sequenza di confronto.

const FINESTRA = 96; // byte entro cui i confronti di un GUID stanno insieme

function cercaImmediati(fd, sezs) {
  const perValore = new Map(); // valore → [offset di file]
  for (const v of LOCRES_MAGIC_U32) perValore.set(v, []);

  const ago = new Map();
  for (const v of LOCRES_MAGIC_U32) {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(v, 0);
    ago.set(v, b);
  }

  for (const s of sezs) {
    if (!s.eseguibile || !s.sizeOfRawData) continue;
    perBlocchi(fd, s, 4, (vista, base) => {
      for (const [v, b] of ago) {
        let i = 0;
        while ((i = vista.indexOf(b, i)) !== -1) {
          perValore.get(v).push(base + i);
          i++;
        }
      }
    });
  }

  // Dedup e raggruppamento in cluster.
  const tutti = [];
  for (const [v, offs] of perValore) {
    for (const o of [...new Set(offs)]) tutti.push({ valore: v, off: o });
  }
  tutti.sort((a, b) => a.off - b.off);

  const cluster = [];
  let corrente = [];
  for (const t of tutti) {
    if (corrente.length && t.off - corrente[corrente.length - 1].off > FINESTRA) {
      if (new Set(corrente.map((x) => x.valore)).size >= 2) cluster.push(corrente);
      corrente = [];
    }
    corrente.push(t);
  }
  if (corrente.length && new Set(corrente.map((x) => x.valore)).size >= 2) {
    cluster.push(corrente);
  }

  return {
    conteggi: [...perValore].map(([v, offs]) => ({
      valore: v,
      n: new Set(offs).size,
    })),
    cluster,
  };
}

// ── Risalita all'inizio della funzione ────────────────────────────────────
//
// MSVC separa le funzioni con padding `int3` (0xCC). Dall'istruzione che
// referenzia il GUID si torna indietro fino a trovarne una sequenza: quello che
// segue è l'inizio della funzione. Limite dichiarato: se il compilatore non ha
// messo padding (funzioni contigue), questo sbaglia — perciò riportiamo anche
// quanto siamo tornati indietro, così un risultato assurdo si vede.

function inizioFunzione(fd, sez, offRif, maxIndietro = 4096) {
  const quanti = Math.min(maxIndietro, offRif - sez.pointerToRawData);
  if (quanti <= 0) return null;
  const buf = Buffer.alloc(quanti);
  fs.readSync(fd, buf, 0, quanti, offRif - quanti);
  // Dalla fine verso l'inizio: cerca >= 2 byte 0xCC consecutivi.
  for (let i = buf.length - 1; i >= 1; i--) {
    if (buf[i] === 0xcc && buf[i - 1] === 0xcc) {
      return { off: offRif - quanti + i + 1, indietro: quanti - i - 1 };
    }
  }
  return null;
}

// ── Analisi ───────────────────────────────────────────────────────────────

function analizza(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const { machine, sezioni: sezs } = sezioni(fd);

    // (1) Dov'è la costante GUID?
    const occorrenzeGuid = [];
    const occorrenzeProgetto = [];
    for (const s of sezs) {
      if (!s.sizeOfRawData) continue;
      perBlocchi(fd, s, 16, (vista, base) => {
        let i = 0;
        while ((i = vista.indexOf(LOCRES_MAGIC, i)) !== -1) {
          occorrenzeGuid.push(base + i);
          i++;
        }
        let j = 0;
        while ((j = vista.indexOf(MAGIC_PROGETTO, j)) !== -1) {
          occorrenzeProgetto.push(base + j);
          j++;
        }
      });
    }

    const guidRva = new Map();
    for (const off of [...new Set(occorrenzeGuid)]) {
      const r = faiRva(sezs, off);
      if (r) guidRva.set(r.rva, { off, sezione: r.sezione });
    }

    // (2) Chi la referenzia? Scansione rip-relative sulle sezioni eseguibili.
    //
    // Ogni posizione è trattata come possibile displacement a 32 bit di un
    // indirizzamento rip-relative: target = RVA(pos) + 4 + disp. Copre lea/mov/
    // movdqu (il caso tipico per confrontare un GUID a 16 byte). LIMITE: le
    // istruzioni che hanno un immediato DOPO il displacement hanno rip più
    // avanti, e quelle non le prende.
    const riferimenti = [];
    for (const s of sezs) {
      if (!s.eseguibile || !s.sizeOfRawData) continue;
      perBlocchi(fd, s, 8, (vista, base) => {
        const limite = vista.length - 4;
        for (let i = 0; i <= limite; i++) {
          const disp = vista.readInt32LE(i);
          if (disp === 0) continue;
          const rvaDisp = s.virtualAddress + (base - s.pointerToRawData) + i;
          const target = rvaDisp + 4 + disp;
          if (guidRva.has(target)) {
            riferimenti.push({ offDisp: base + i, rvaDisp, target, sezione: s.nome });
          }
        }
      });
    }

    // (3) Per ogni riferimento, la funzione che lo contiene.
    for (const r of riferimenti) {
      const s = sezs.find(
        (x) =>
          r.offDisp >= x.pointerToRawData &&
          r.offDisp < x.pointerToRawData + x.sizeOfRawData
      );
      const fn = s ? inizioFunzione(fd, s, r.offDisp) : null;
      if (fn) {
        const rr = faiRva(sezs, fn.off);
        r.funzioneOff = fn.off;
        r.funzioneRva = rr ? rr.rva : null;
        r.distanzaDallInizio = fn.indietro;
      }
    }

    // (4) Strategia 2: si applica quando la costante da 16 byte non esiste.
    const immediati = cercaImmediati(fd, sezs);
    for (const cl of immediati.cluster) {
      const primo = cl[0].off;
      const s = sezs.find(
        (x) => primo >= x.pointerToRawData && primo < x.pointerToRawData + x.sizeOfRawData
      );
      const fn = s ? inizioFunzione(fd, s, primo) : null;
      cl.funzione = fn ? faiRva(sezs, fn.off) : null;
      cl.distanzaDallInizio = fn ? fn.indietro : null;
      cl.rvaPrimo = faiRva(sezs, primo);
    }

    return {
      file,
      x64: machine === 0x8664,
      sezioni: sezs.map((s) => `${s.nome}${s.eseguibile ? '(x)' : ''}`),
      guid: [...guidRva.entries()].map(([rva, v]) => ({ rva, ...v })),
      magicProgetto: [...new Set(occorrenzeProgetto)].length,
      riferimenti,
      immediati,
    };
  } finally {
    fs.closeSync(fd);
  }
}

// ── Referto ───────────────────────────────────────────────────────────────

function main() {
  if (!exePath) {
    console.log('Uso: node scripts/ue-find-locres-loader.js --exe "<percorso exe>"');
    process.exitCode = 2;
    return;
  }
  let r;
  try {
    r = analizza(exePath);
  } catch (e) {
    console.log(`⚠ non analizzabile: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  if (asJson) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  console.log(path.basename(r.file));
  console.log(`  ${r.x64 ? 'x64' : 'NON x64'} · sezioni: ${r.sezioni.join(', ')}`);
  console.log('');

  console.log('GUID LocRes (16 byte, 0E 14 74 75 67 4A 03 FC 4A 15 90 9D C3 37 7F 1B)');
  if (!r.guid.length) {
    console.log('  ✗ NON trovato. Due possibilità: il gioco non carica .locres,');
    console.log('    oppure la costante è costruita a runtime invece che memorizzata.');
  } else {
    for (const g of r.guid) {
      console.log(`  ✓ RVA 0x${g.rva.toString(16)} [${g.sezione}] (offset file 0x${g.off.toString(16)})`);
    }
  }

  console.log('');
  console.log('Magic a 4 byte usato oggi da unreal_localization.rs (7a da 14 0e)');
  console.log(
    r.magicProgetto === 0
      ? '  ✗ ZERO occorrenze in tutto il binario → confermato: non è il magic di UE'
      : `  ${r.magicProgetto} occorrenze (da guardare: potrebbe essere coincidenza)`
  );

  console.log('');
  console.log('Chi referenzia il GUID (candidati caricatore .locres)');
  if (!r.riferimenti.length) {
    console.log('  ✗ nessun riferimento rip-relative trovato.');
    console.log('    Può dipendere dal limite dichiarato (istruzioni con immediato');
    console.log('    dopo il displacement) o dal GUID caricato via costante immediata.');
  } else {
    for (const x of r.riferimenti) {
      const fn =
        x.funzioneRva !== null && x.funzioneRva !== undefined
          ? `funzione @ RVA 0x${x.funzioneRva.toString(16)} (il riferimento è ${x.distanzaDallInizio} byte dopo l'inizio)`
          : 'inizio funzione non determinato (nessun padding int3 a monte)';
      console.log(`  · riferimento @ RVA 0x${x.rvaDisp.toString(16)} [${x.sezione}] → ${fn}`);
    }
    console.log('');
    console.log(`  ${r.riferimenti.length} riferimento/i. Uno o due è il profilo atteso:`);
    console.log('  il GUID si confronta nel caricatore e, al più, nel salvataggio.');
  }

  // ── Strategia 2 ──────────────────────────────────────────────────────────
  console.log('');
  console.log('STRATEGIA 2 — i quattro uint32 del GUID come immediati nel codice');
  const esa = (v) => '0x' + v.toString(16).padStart(8, '0');
  for (const c of r.immediati.conteggi) {
    console.log(`  ${esa(c.valore)}: ${c.n} occorrenze nelle sezioni eseguibili`);
  }
  console.log('');
  if (!r.immediati.cluster.length) {
    console.log('  ✗ Nessun punto con almeno DUE valori distinti ravvicinati.');
    console.log('    Il confronto del GUID non è nel codice in forma di immediati:');
    console.log('    il caricatore .locres non si trova per questa via.');
  } else {
    console.log(
      `  ✓ ${r.immediati.cluster.length} punto/i con ≥2 valori distinti entro ${FINESTRA} byte`
    );
    console.log('    (è la firma della sequenza di confronto del GUID)');
    for (const cl of r.immediati.cluster) {
      const quali = [...new Set(cl.map((x) => x.valore))].map(esa).join(', ');
      const dove = cl.rvaPrimo ? `RVA 0x${cl.rvaPrimo.rva.toString(16)}` : '?';
      console.log('');
      console.log(`    · ${dove} · valori: ${quali} (${cl.length} immediati)`);
      if (cl.funzione) {
        console.log(
          `      funzione @ RVA 0x${cl.funzione.rva.toString(16)} ` +
            `(primo immediato ${cl.distanzaDallInizio} byte dopo l'inizio)`
        );
      } else {
        console.log('      inizio funzione non determinato (nessun padding int3 a monte)');
      }
    }
    console.log('');
    console.log('  → Questo è il bersaglio per l\'hook di estrazione: riceve il');
    console.log('    .locres GIÀ decompresso, quindi dà chiavi E stringhe.');
  }
}

main();
