#!/usr/bin/env node
/**
 * Validazione statica dei pattern byte di FText::ToString sui giochi UE reali.
 *
 * PERCHÉ ESISTE
 * -------------
 * gs-hook aggancia il testo dei giochi Unreal con un hook su FText::ToString
 * (gs-hook/src/sources/source_unreal_ftext.cpp). L'indirizzo della funzione
 * viene trovato a runtime con un pattern scan, e i due pattern usati stanno in
 * unreal-translator/hook-dll/include/ue_types.h — dove il commento dice, testuale,
 * «(esempio)» e «Questi pattern vanno aggiornati per ogni versione UE».
 *
 * Il rischio non è che il pattern NON trovi nulla: quello è il caso benigno
 * (Activate ritorna Failed e dllmain scende al livello 2, GDI). Il rischio è che
 * trovi TROPPO. `GSTranslator::Utils::PatternScan` ritorna il PRIMO match e non
 * conta gli altri: se il pattern è un prologo generico che nel binario compare
 * centinaia di volte, l'hook si installa su una funzione qualsiasi con una
 * firma qualsiasi — e il gioco crasha, o peggio corrompe l'heap silenziosamente.
 *
 * Questo script misura quel numero PRIMA di iniettare qualcosa. Conta TUTTE le
 * occorrenze, non la prima.
 *
 * SOLA LETTURA: apre gli .exe, ne legge le sezioni eseguibili e li richiude.
 * Non scrive, non inietta, non lancia nessun gioco.
 *
 * LETTURA DEL VERDETTO
 *   0 match   → il pattern non aggancia su questa build: l'hook UE non si
 *               installa MAI e si finisce sempre al fallback GDI. Non crasha,
 *               ma "traduzione a livello engine" per questo gioco è una
 *               promessa che il codice non mantiene.
 *   1 match   → candidato unico: è la situazione in cui un pattern scan è
 *               legittimo. Resta da confermare che sia davvero FText::ToString.
 *   >1 match  → INUTILIZZABILE così com'è: PatternScan prende il primo, che ha
 *               1/N probabilità di essere quello giusto.
 *
 * LIMITE ONESTO: si scansiona il file su disco, non il modulo caricato in
 * memoria. Per i byte di un prologo di funzione le due cose coincidono (non
 * sono soggetti a rilocazione), quindi il conteggio è predittivo; ma un
 * confronto in-process resta l'unica prova definitiva.
 *
 * Uso:
 *   node scripts/ue-validate-ftext-pattern.js                  # cerca le librerie Steam
 *   node scripts/ue-validate-ftext-pattern.js "D:/Giochi"      # cartelle a mano
 *   node scripts/ue-validate-ftext-pattern.js --exe "C:/.../Game-Win64-Shipping.exe"
 *   node scripts/ue-validate-ftext-pattern.js --json
 */

const fs = require('fs');
const path = require('path');

// ── I pattern sotto esame ─────────────────────────────────────────────────
// Copiati DA ue_types.h. Se là cambiano, qui va rifatto il giro: sono la cosa
// che stiamo misurando, non una comodità locale.
// AGGIORNATO 30/07/2026: dopo questa misura il pattern UE4.27 è stato TOLTO dal
// codice (89-127 match) e in ue_types.h si chiama ora
// `FText_ToString_UE427_INUTILIZZABILE`. Resta qui perché questo script serve
// anche a provare firme candidate PRIMA di metterle nel codice: se qualcuno
// scrive un nuovo pattern UE4.2x, lo misura con questo nome e deve vedere 1.
const PATTERNS = {
  FText_ToString_UE427_INUTILIZZABILE:
    '48 89 5C 24 ?? 48 89 74 24 ?? 57 48 83 EC ?? 48 8B FA 48 8B F1',
  FText_ToString_UE5:
    '40 53 48 83 EC ?? 48 8B D9 48 85 C9 74 ?? 48 8B 01',
};

const MAX_DEPTH = 6;
const CHUNK = 32 * 1024 * 1024; // 32 MB per lettura
const IMAGE_SCN_MEM_EXECUTE = 0x20000000;

// Oltre questa soglia il pattern non discrimina: non serve confermare i
// candidati uno per uno, serve un pattern diverso.
const SOGLIA_CONFERMA = 8;

const args = process.argv.slice(2);
const asJson = args.includes('--json');
// La conferma (allineamento + conteggio xref) è attiva per default: costa una
// seconda passata sulle sezioni eseguibili e cambia il verdetto. --no-confirm
// per il solo conteggio.
const conferma = !args.includes('--no-confirm');
// --dump[=N] stampa N byte (default 96) all'indirizzo di ogni candidato, per
// poter DISASSEMBLARE il corpo e dire QUALE funzione è. Un candidato con un solo
// chiamante può essere (a) la funzione sbagliata, oppure (b) quella giusta ma
// INLINE-ata in tutti gli altri punti dal compilatore: la differenza si vede dal
// corpo, e cambia completamente la conclusione.
const dumpArg = args.find((a) => a === '--dump' || a.startsWith('--dump='));
const dumpBytes = dumpArg
  ? Math.max(16, Math.min(512, parseInt(dumpArg.split('=')[1] || '96', 10) || 96))
  : 0;
const exeIdx = args.indexOf('--exe');
const exeDaArgs = exeIdx >= 0 ? args[exeIdx + 1] : null;
const rootsFromArgs = args.filter(
  (a, i) => !a.startsWith('--') && i !== exeIdx + 1
);

// ── Parsing del pattern ───────────────────────────────────────────────────

/** "48 8B ?? 01" → [0x48, 0x8b, -1, 0x01]  (-1 = wildcard) */
function parsePattern(sig) {
  const out = [];
  for (const tok of sig.trim().split(/\s+/)) {
    if (tok === '??' || tok === '?') out.push(-1);
    else out.push(parseInt(tok, 16));
  }
  if (out.some((b) => b !== -1 && (Number.isNaN(b) || b < 0 || b > 255))) {
    throw new Error(`pattern non valido: ${sig}`);
  }
  return out;
}

/**
 * Aggiunge a `trovati` (Set di offset ASSOLUTI) le occorrenze di `pat` in `buf`,
 * dove `buf` inizia all'offset di file `offsetBase`. Usa il primo byte concreto
 * come ancora (indexOf è nativo e salta in fretta), poi verifica il resto.
 *
 * Il Set è la ragione per cui i chunk possono sovrapporsi senza contabilità
 * aggiuntiva: un match visto due volte è lo stesso offset assoluto, quindi
 * collassa da sé. Deduplicare per costruzione costa un po' di memoria e mi
 * risparmia una classe di errori di off-by-one che qui falserebbe il verdetto.
 */
function raccogliOccorrenze(buf, pat, offsetBase, trovati) {
  const ancora = pat.findIndex((b) => b !== -1);
  if (ancora === -1) throw new Error('pattern di soli wildcard');

  let from = 0;
  const ultimoInizio = buf.length - pat.length;

  for (;;) {
    const i = buf.indexOf(pat[ancora], from);
    if (i === -1) break;
    from = i + 1;
    const start = i - ancora;
    if (start < 0) continue;
    if (start > ultimoInizio) break;

    let ok = true;
    for (let j = 0; j < pat.length; j++) {
      if (pat[j] !== -1 && buf[start + j] !== pat[j]) {
        ok = false;
        break;
      }
    }
    if (ok) trovati.add(offsetBase + start);
  }
}

// ── PE: sezioni eseguibili ────────────────────────────────────────────────

/**
 * Legge l'header PE e ritorna le sezioni eseguibili (dove vive il codice).
 * Scansionare solo queste evita di contare match dentro dati/risorse, che a
 * runtime non sarebbero mai il bersaglio di un hook.
 */
function sezioniEseguibili(fd) {
  const dos = Buffer.alloc(0x40);
  fs.readSync(fd, dos, 0, 0x40, 0);
  if (dos.readUInt16LE(0) !== 0x5a4d) throw new Error('non è un PE (manca MZ)');

  const peOff = dos.readUInt32LE(0x3c);
  const coff = Buffer.alloc(24);
  fs.readSync(fd, coff, 0, 24, peOff);
  if (coff.readUInt32LE(0) !== 0x00004550) throw new Error('firma PE assente');

  const machine = coff.readUInt16LE(4);
  const numSezioni = coff.readUInt16LE(6);
  const sizeOptional = coff.readUInt16LE(20);

  const tabOff = peOff + 24 + sizeOptional;
  const tab = Buffer.alloc(40 * numSezioni);
  fs.readSync(fd, tab, 0, tab.length, tabOff);

  const sezioni = [];
  for (let i = 0; i < numSezioni; i++) {
    const s = tab.subarray(i * 40, i * 40 + 40);
    const caratteristiche = s.readUInt32LE(36);
    if (!(caratteristiche & IMAGE_SCN_MEM_EXECUTE)) continue;
    sezioni.push({
      nome: s.subarray(0, 8).toString('ascii').replace(/\0+$/, ''),
      virtualAddress: s.readUInt32LE(12),
      sizeOfRawData: s.readUInt32LE(16),
      pointerToRawData: s.readUInt32LE(20),
    });
  }
  return { machine, sezioni };
}

/** true se il PE è x64. I pattern in esame hanno prefissi REX.W: su x86 non hanno senso. */
function isX64(machine) {
  return machine === 0x8664;
}

// ── Conferma di un candidato ──────────────────────────────────────────────
//
// «1 match» dice che il pattern è specifico, NON che ha trovato FText::ToString.
// Due controlli, entrambi statici, che alzano o abbassano molto la fiducia:
//
//   1. È l'inizio di una funzione? MSVC riempie lo spazio fra funzioni con
//      `int3` (0xCC). Se il byte precedente è 0xCC/0x90 o una fine di flusso
//      (ret/jmp), il candidato è allineato come una funzione vera. Se è in mezzo
//      a istruzioni, abbiamo trovato la coda di un'altra funzione — e hookarla
//      significa piantare una trampoline in mezzo al codice.
//
//   2. Quanti la chiamano? FText::ToString è fra le funzioni più chiamate di un
//      gioco UE. Contiamo le `call rel32` (E8) e le `jmp rel32` (E9, tail call)
//      che puntano esattamente al candidato. Zero chiamanti = quasi certamente
//      la funzione sbagliata (o una copia mai usata). Molti chiamanti = il
//      profilo che ci aspettiamo.
//
// Resta un limite: nessuno dei due prova che sia *quella* funzione. Provano che
// è una funzione plausibile e molto usata. La prova definitiva è in-process.

const OPCODE_CALL = 0xe8;
const OPCODE_JMP = 0xe9;

function confermaCandidati(fd, sezioni, candidati) {
  if (!candidati.length) return;

  // (1) Contesto precedente → allineamento di funzione.
  for (const c of candidati) {
    const quanti = Math.min(16, c.off);
    const pre = Buffer.alloc(quanti);
    if (quanti > 0) fs.readSync(fd, pre, 0, quanti, c.off - quanti);
    c.byteprima = [...pre].map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const ultimo = quanti ? pre[quanti - 1] : null;
    c.iniziaFunzione =
      ultimo !== null && [0xcc, 0x90, 0xc3, 0xc2, 0xe9, 0xeb].includes(ultimo);
    c.xrefCall = 0;
    c.xrefJmp = 0;

    if (dumpBytes) {
      const corpo = Buffer.alloc(dumpBytes);
      const n = fs.readSync(fd, corpo, 0, dumpBytes, c.off);
      c.dump = [...corpo.subarray(0, n)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
    }
  }

  const perRva = new Map();
  for (const c of candidati) {
    if (!perRva.has(c.rva)) perRva.set(c.rva, []);
    perRva.get(c.rva).push(c);
  }

  // (2) Scansione delle sezioni eseguibili in cerca di E8/E9 verso i candidati.
  for (const sez of sezioni) {
    if (!sez.sizeOfRawData) continue;
    let letto = 0;
    while (letto < sez.sizeOfRawData) {
      const inizio = letto === 0 ? 0 : letto - 4; // un rel32 non deve spezzarsi
      const quanti = Math.min(CHUNK, sez.sizeOfRawData - inizio);
      if (quanti <= 5) break;
      const buf = Buffer.alloc(quanti);
      const n = fs.readSync(fd, buf, 0, quanti, sez.pointerToRawData + inizio);
      if (n <= 5) break;
      const vista = buf.subarray(0, n);

      for (const op of [OPCODE_CALL, OPCODE_JMP]) {
        let from = 0;
        for (;;) {
          const i = vista.indexOf(op, from);
          if (i === -1 || i + 5 > vista.length) break;
          from = i + 1;
          const disp = vista.readInt32LE(i + 1);
          // RVA del byte dell'opcode, poi target = fine istruzione + disp.
          const rvaOp = sez.virtualAddress + (inizio + i);
          const target = rvaOp + 5 + disp;
          const lista = perRva.get(target);
          if (lista) {
            for (const c of lista) {
              if (op === OPCODE_CALL) c.xrefCall++;
              else c.xrefJmp++;
            }
          }
        }
      }

      letto = inizio + n;
    }
  }
}

// ── Scansione di un eseguibile ────────────────────────────────────────────

function analizzaExe(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const { machine, sezioni } = sezioniEseguibili(fd);
    const dimensione = fs.statSync(file).size;

    const patParsed = Object.fromEntries(
      Object.entries(PATTERNS).map(([n, s]) => [n, parsePattern(s)])
    );
    const patLenMax = Math.max(...Object.values(patParsed).map((p) => p.length));

    // Un Set di offset assoluti per pattern: dedup automatico fra chunk.
    const trovati = {};
    for (const nome of Object.keys(PATTERNS)) trovati[nome] = new Set();
    // Mappa offset-di-file → RVA, per tradurre i primi match in indirizzi.
    const mappaRva = [];

    for (const sez of sezioni) {
      if (!sez.sizeOfRawData) continue;
      mappaRva.push(sez);

      let letto = 0;
      while (letto < sez.sizeOfRawData) {
        // Sovrapposizione fra chunk: un pattern a cavallo non va perso.
        const inizio = letto === 0 ? 0 : letto - (patLenMax - 1);
        const quanti = Math.min(CHUNK, sez.sizeOfRawData - inizio);
        if (quanti <= 0) break;
        const buf = Buffer.alloc(quanti);
        const n = fs.readSync(fd, buf, 0, quanti, sez.pointerToRawData + inizio);
        if (n <= 0) break;
        const vista = buf.subarray(0, n);

        for (const [nome, pat] of Object.entries(patParsed)) {
          raccogliOccorrenze(vista, pat, sez.pointerToRawData + inizio, trovati[nome]);
        }

        letto = inizio + n;
      }
    }

    /** la sezione che contiene l'offset di file `off`, o null. */
    const sezioneDi = (off) => {
      for (const s of mappaRva) {
        if (off >= s.pointerToRawData && off < s.pointerToRawData + s.sizeOfRawData) {
          return s.nome;
        }
      }
      return null;
    };

    /** offset di file → RVA, usando la sezione che lo contiene. */
    const aRva = (off) => {
      for (const s of mappaRva) {
        if (off >= s.pointerToRawData && off < s.pointerToRawData + s.sizeOfRawData) {
          return s.virtualAddress + (off - s.pointerToRawData);
        }
      }
      return null;
    };

    const risultati = {};
    const daConfermare = [];
    for (const nome of Object.keys(PATTERNS)) {
      const ordinati = [...trovati[nome]].sort((a, b) => a - b);
      const primi = ordinati.slice(0, 8);
      risultati[nome] = {
        match: ordinati.length,
        offsets: primi,
        rva: primi.map(aRva),
        candidati: [],
      };
      // Confermare ha senso solo dove il pattern discrimina: su 100+ match il
      // conteggio xref di ognuno non aiuta a scegliere, il pattern va rifatto.
      if (ordinati.length > 0 && ordinati.length <= SOGLIA_CONFERMA) {
        for (const off of primi) {
          const c = { pattern: nome, off, rva: aRva(off), sezione: sezioneDi(off) };
          risultati[nome].candidati.push(c);
          daConfermare.push(c);
        }
      }
    }

    if (conferma) confermaCandidati(fd, sezioni, daConfermare);

    return {
      file,
      dimensione,
      arch: isX64(machine) ? 'x64' : `non-x64 (machine 0x${machine.toString(16)})`,
      x64: isX64(machine),
      sezioni: sezioni.map((s) => s.nome),
      risultati,
    };
  } catch (e) {
    return { file, errore: e.message };
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* già chiuso */ }
  }
}

// ── Scoperta dei giochi (stessa logica di ue-inspect-games.js) ────────────

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
      for (const m of testo.matchAll(/"path"\s+"([^"]+)"/g)) {
        const comuni = path.join(m[1].replace(/\\\\/g, '/'), 'steamapps', 'common');
        if (fs.existsSync(comuni)) out.push(comuni);
      }
    } catch { /* vdf illeggibile: si prosegue */ }
  }
  for (const lettera of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
    for (const nome of ['Games', 'Giochi', 'GOG Games', 'Epic Games']) {
      const p = `${lettera}:/${nome}`;
      if (fs.existsSync(p)) out.push(p);
    }
  }
  return [...new Set(out)];
}

/** Gli .exe che UE produce: <Gioco>-Win64-Shipping.exe e affini. */
const RE_SHIPPING = /-(Win64|Win32|WinGDK)-(Shipping|Development|Test)\.exe$/i;

function cercaExeUnreal(root, profondita = 0, trovati = []) {
  if (profondita > MAX_DEPTH || trovati.length > 200) return trovati;
  let voci;
  try {
    voci = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return trovati;
  }
  for (const v of voci) {
    const p = path.join(root, v.name);
    if (v.isDirectory()) {
      cercaExeUnreal(p, profondita + 1, trovati);
    } else if (RE_SHIPPING.test(v.name)) {
      trovati.push(p);
    }
  }
  return trovati;
}

// ── Referto ───────────────────────────────────────────────────────────────

function verdetto(n) {
  if (n === 0) return { esito: 'NON AGGANCIA', nota: 'hook mai installato → fallback GDI (L2)' };
  if (n === 1) return { esito: 'CANDIDATO UNICO', nota: 'da confermare che sia FText::ToString' };
  return { esito: 'AMBIGUO', nota: `PatternScan prende il primo di ${n}: rischio di hook sulla funzione sbagliata` };
}

function main() {
  let exes = [];
  if (exeDaArgs) {
    // --exe accetta anche una CARTELLA: prima ci si finiva dentro con un
    // "EISDIR: illegal operation on a directory" per ogni file, che sembra un
    // difetto del binario invece che un argomento sbagliato.
    let stat = null;
    try {
      stat = fs.statSync(exeDaArgs);
    } catch (e) {
      console.error(`Percorso non leggibile: ${exeDaArgs}\n  ${e.message}`);
      process.exitCode = 2;
      return;
    }

    if (stat.isDirectory()) {
      if (!asJson) console.log(`--exe punta a una cartella: ci cerco dentro gli .exe Unreal.\n`);
      exes = cercaExeUnreal(exeDaArgs);
      if (!exes.length) {
        console.error(
          `Nessun eseguibile Unreal in ${exeDaArgs}.\n` +
          "L'exe di shipping sta di solito in <Gioco>\\Binaries\\Win64\\<Nome>-Win64-Shipping.exe"
        );
        process.exitCode = 2;
        return;
      }
    } else {
      exes = [exeDaArgs];
    }
  } else {
    const roots = rootsFromArgs.length ? rootsFromArgs : steamLibraries();
    if (!asJson) {
      console.log('Cartelle esaminate:');
      for (const r of roots) console.log('  ·', r);
      console.log('');
    }
    for (const r of roots) exes.push(...cercaExeUnreal(r));
    exes = [...new Set(exes)];
  }

  if (!exes.length) {
    const msg =
      'Nessun eseguibile Unreal trovato. Passa una cartella a mano, oppure ' +
      "l'exe diretto con --exe.";
    if (asJson) console.log(JSON.stringify({ exes: [], errore: msg }, null, 2));
    else console.log(msg);
    process.exitCode = 2;
    return;
  }

  const referti = exes.map(analizzaExe);

  if (asJson) {
    console.log(JSON.stringify({ referti }, null, 2));
    return;
  }

  console.log(`Eseguibili Unreal analizzati: ${referti.length}\n`);
  for (const r of referti) {
    console.log('─'.repeat(78));
    console.log(path.basename(r.file));
    console.log('  ' + r.file);
    if (r.errore) {
      console.log(`  ⚠ non analizzabile: ${r.errore}`);
      continue;
    }
    const mb = (r.dimensione / 1024 / 1024).toFixed(1);
    console.log(`  ${mb} MB · ${r.arch} · sezioni eseguibili: ${r.sezioni.join(', ')}`);
    if (!r.x64) {
      console.log('  ⚠ i pattern in esame sono x64 (prefissi REX.W): su questo binario non si applicano.');
    }
    for (const [nome, res] of Object.entries(r.risultati)) {
      const v = verdetto(res.match);
      console.log(`  ${nome}`);
      console.log(`      match: ${res.match}  →  ${v.esito} (${v.nota})`);
      if (res.offsets.length) {
        const primi = res.offsets
          .slice(0, 5)
          .map((o) => '0x' + o.toString(16))
          .join(', ');
        console.log(`      primi offset di file: ${primi}${res.match > 5 ? ', …' : ''}`);
      }
      if (conferma && res.candidati.length) {
        for (const c of res.candidati) {
          const rva = c.rva === null ? '?' : '0x' + c.rva.toString(16);
          const allineato = c.iniziaFunzione
            ? 'inizio di funzione'
            : '⚠ NON allineato (byte precedente non è padding/fine-flusso)';
          const chiamanti = c.xrefCall + c.xrefJmp;
          const giudizio =
            chiamanti === 0
              ? '⚠ NESSUN chiamante diretto'
              : chiamanti < 5
              ? `${chiamanti} chiamanti (pochi per FText::ToString)`
              : `${chiamanti} chiamanti`;
          console.log(
            `      · RVA ${rva} [${c.sezione}] · ${allineato} · ${giudizio}` +
              (c.xrefJmp ? ` (${c.xrefCall} call, ${c.xrefJmp} jmp)` : '')
          );
          console.log(`        byte prima: ${c.byteprima}`);
          if (c.dump) {
            // A blocchi di 16 byte, per poterlo incollare in un disassemblatore.
            const b = c.dump.split(' ');
            for (let k = 0; k < b.length; k += 16) {
              const riga = b.slice(k, k + 16).join(' ');
              console.log(
                `        ${k === 0 ? 'corpo:     ' : '           '}+${k
                  .toString()
                  .padStart(3, '0')}  ${riga}`
              );
            }
          }
        }
      }
    }
  }
  console.log('─'.repeat(78));

  // Sintesi: è la riga che decide se il percorso hook-a-runtime è praticabile.
  const ambigui = referti.filter(
    (r) => !r.errore && Object.values(r.risultati).some((x) => x.match > 1)
  ).length;
  const nessuno = referti.filter(
    (r) => !r.errore && Object.values(r.risultati).every((x) => x.match === 0)
  ).length;
  const unici = referti.filter(
    (r) => !r.errore && Object.values(r.risultati).some((x) => x.match === 1)
  ).length;

  console.log('\nSINTESI');
  console.log(`  binari con almeno un pattern AMBIGUO (>1 match): ${ambigui}`);
  console.log(`  binari con un CANDIDATO UNICO:                   ${unici}`);
  console.log(`  binari dove NESSUN pattern aggancia:             ${nessuno}`);
  if (ambigui) {
    console.log(
      '\n  ⚠ Con un pattern ambiguo, installare l\'hook significa agganciare una\n' +
      '    funzione scelta a caso fra i match. Prima di iniettare servono pattern\n' +
      '    più lunghi, ricavati dai binari reali, oppure un altro modo di\n' +
      '    localizzare FText::ToString.'
    );
  }

  // COSA SUCCEDE ORA A RUNTIME (aggiornato 30/07/2026).
  // Questa sezione descriveva l'ordine di prova UE5 → UE427 col "primo che
  // aggancia vince". Non è più così, ed erano proprio queste misure a dire che
  // non poteva restare così: il pattern UE4.27 è stato RIMOSSO dal codice e
  // `PatternScanUnique` accetta solo i match unici. Quindi oggi un pattern
  // ambiguo non è più "innocuo finché l'altro aggancia": è rifiutato e basta,
  // e si scende al livello 2 (GDI).
  const primo = 'FText_ToString_UE5';
  if (Object.keys(PATTERNS).includes(primo)) {
    // ⚠️ I binari NON ANALIZZABILI vanno contati a parte, mai dedotti per
    // differenza. Nella prima stesura di questo blocco il totale era
    // `referti.length - zero - ambigui`, quindi un file che non si era
    // nemmeno riusciti a leggere finiva nella casella "aggancerebbe": la
    // sintesi affermava una cosa che non era stata misurata. È lo stesso
    // difetto del '100% con 0 errori' del triage, dentro lo strumento che
    // dovrebbe smascherarlo.
    const illeggibili = referti.filter((r) => r.errore);
    const letti = referti.filter((r) => !r.errore);
    const zero = letti.filter((r) => r.risultati[primo].match === 0);
    const ambiguiUE5 = letti.filter((r) => r.risultati[primo].match > 1);
    const agganciano = letti.filter((r) => r.risultati[primo].match === 1);

    console.log('\nEFFETTO A RUNTIME (solo pattern UE5, match unico obbligatorio)');
    if (!letti.length) {
      console.log('  NIENTE DA DIRE: nessun binario è stato letto davvero.');
    } else {
      console.log(
        `  su ${letti.length} binario/i letti: ${agganciano.length} aggancerebbero, ` +
        `${zero.length} nessun match, ${ambiguiUE5.length} ambigui → rifiutati.`
      );
      for (const r of agganciano) {
        console.log(`     ✔ ${path.basename(r.file)} → hook engine`);
      }
      for (const r of [...zero, ...ambiguiUE5]) {
        console.log(`     · ${path.basename(r.file)} → fallback GDI`);
      }
      console.log(
        '  Nessuno di questi casi aggancia una funzione sbagliata: il caso\n' +
        '  peggiore è "non traduce a livello engine", non "crasha il gioco".'
      );
    }
    if (illeggibili.length) {
      console.log(`\n  ⚠ ${illeggibili.length} binario/i NON analizzati (nessun verdetto per questi):`);
      for (const r of illeggibili) {
        console.log(`     · ${path.basename(r.file)}: ${r.errore}`);
      }
    }
  }
}

main();
