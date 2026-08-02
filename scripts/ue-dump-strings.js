#!/usr/bin/env node
/**
 * Cerca stringhe di testo (FString UTF-16LE) dentro un dump di memoria.
 *
 * PERCHÉ ESISTE
 * -------------
 * `ue-locres-from-dump.js` cerca il GUID magico dei .locres. Il 30/07/2026 su
 * il gioco di collaudo UE5 ha trovato UN SOLO .locres decodificabile, con 24 voci nei
 * namespace `OnlineError` e `OnlinePresence`: è il locres del MOTORE (plugin
 * OnlineSubsystem), non del gioco.
 *
 * Da quel risultato NON si può concludere niente sul gioco, perché due cause
 * diversissime producono lo stesso referto:
 *
 *   (a) il testo del gioco È in memoria, ma non più in forma .locres — UE legge
 *       il file in un buffer temporaneo, riversa tutto in FTextLocalizationManager
 *       e libera il buffer. Al menu principale il .locres è già stato distrutto,
 *       mentre le stringhe vivono come FString nella tabella del manager.
 *   (b) il testo del gioco NON è nel dump affatto — dump parziale, oppure preso
 *       troppo tardi, oppure i testi arrivano da un'altra via.
 *
 * Nel caso (a) la strada dell'override .locres resta viva e cambia solo il modo
 * di raccogliere le stringhe. Nel caso (b) va buttata e si cambia approccio.
 * Distinguerle costa una scansione; TIRARE A INDOVINARE COSTA GIORNI.
 *
 * Questo script quindi non "estrae la traduzione": risponde a una domanda sola,
 * e la risposta è un numero, non un'impressione.
 *
 * LIMITE ONESTO — cosa questo script NON dà
 *   Trova il TESTO, non le CHIAVI. Un .locres ha namespace+chiave+stringa; qui
 *   si recupera solo la stringa. Serve a decidere la strada, non a costruire
 *   direttamente il file di traduzione.
 *
 * SOLA LETTURA: apre il .DMP, lo legge a blocchi, non lo modifica.
 *
 * Uso:
 *   node scripts/ue-dump-strings.js "<file.DMP>"
 *   node scripts/ue-dump-strings.js "<file.DMP>" --cerca "Continue,Options,Quit"
 *   node scripts/ue-dump-strings.js "<file.DMP>" --min 12 --out stringhe.txt
 *   node scripts/ue-dump-strings.js "<file.DMP>" --json
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Argomenti ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const asJson = argv.includes('--json');

function opzione(nome, def) {
  const i = argv.indexOf(nome);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
}

const MIN_LEN = parseInt(opzione('--min', '8'), 10);
const OUT = opzione('--out', 'stringhe-dump.txt');
const ESATTO = opzione('--esatto', '');
const CERCA = opzione('--cerca', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Blocchi da 64 MB: un dump di gioco sta sui 6 GB e non entra in un Buffer.
// La sovrapposizione evita di tagliare a metà una stringa a cavallo di due
// blocchi (il taglio produrrebbe due frammenti plausibili: un errore che non
// si nota guardando l'output, ed è il peggior tipo).
const CHUNK = 64 * 1024 * 1024;
const OVERLAP = 4096;

// Tetto sulle stringhe raccolte: su 6 GB si arriva a milioni di frammenti e il
// processo muore per OOM proprio alla fine, dopo venti minuti di scansione.
const MAX_STRINGHE = 400000;

// ── Riconoscimento UTF-16LE ───────────────────────────────────────────────

/**
 * Una code unit è "testo" se è ASCII stampabile o latino accentato.
 * Restare stretti è voluto: allargare a tutto l'Unicode fa passare per testo
 * qualunque struttura binaria e il referto diventa inutile.
 */
function unitaTestuale(cu) {
  if (cu === 0x0a || cu === 0x0d || cu === 0x09) return true; // a capo, tab
  if (cu >= 0x20 && cu <= 0x7e) return true;                  // ASCII stampabile
  if (cu >= 0x00a0 && cu <= 0x024f) return true;              // latino esteso
  if (cu >= 0x2010 && cu <= 0x2027) return true;              // trattini, virgolette
  return false;
}

/**
 * Spezza un run grezzo dove il "testo" è in realtà padding binario.
 *
 * ⚠️ DIFETTO TROVATO DALLA FIXTURE, non dalla lettura del codice. Il primo
 * giro accettava tutto il latino esteso (0x00A0-0x024F), ma una sequenza di
 * byte `01 01 01 …` si legge come `0x0101` = 'ā', che sta in quel range: due
 * stringhe separate da trenta byte di padding uscivano FUSE in una sola. Su
 * 6 GB questo avrebbe gonfiato i conteggi e riempito il campione di frasi che
 * nel gioco non esistono — un referto sbagliato che sembra giusto.
 *
 * Regola: tre o più caratteri non-ASCII di fila sono un separatore, non testo.
 * L'italiano vero ("perché", "città") ha accenti ISOLATI fra lettere ASCII,
 * mai a blocchi. Poi si pretende che il pezzo sia ASCII per almeno il 70%.
 */
function spezzaSuPadding(grezzo) {
  return grezzo
    .split(/[^\x20-\x7E\n\r\t]{3,}/)
    .map((p) => p.trim())
    .filter((p) => {
      if (!p) return false;
      const ascii = (p.match(/[\x20-\x7E]/g) || []).length;
      return ascii / p.length >= 0.7;
    });
}

/** Scarta i frammenti che sono chiaramente identificatori, non testo da leggere. */
function sembraTestoUmano(s) {
  if (s.length < MIN_LEN) return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  // Percorsi, nomi di classe UE, GUID: rumore che sommerge il segnale.
  if (/^[\/\\]/.test(s)) return false;
  if (/\.(uasset|umap|pak|utoc|ucas|dll|exe|png|wav|ogg)$/i.test(s)) return false;
  if (/^[0-9A-F]{16,}$/i.test(s)) return false;
  // Testo di gioco quasi sempre ha uno spazio; senza, teniamo solo i lunghi.
  if (!s.includes(' ') && s.length < MIN_LEN * 2) return false;
  return true;
}

function estraiDaBlocco(buf, n, trovate) {
  let i = 0;
  let inizio = -1;
  const unita = [];

  while (i + 1 < n) {
    const cu = buf[i] | (buf[i + 1] << 8);
    if (unitaTestuale(cu)) {
      if (inizio === -1) inizio = i;
      unita.push(cu);
      i += 2;
      continue;
    }
    if (inizio !== -1) {
      if (unita.length >= MIN_LEN) {
        const grezzo = String.fromCharCode(...unita.slice(0, 2000));
        for (const s of spezzaSuPadding(grezzo)) {
          if (sembraTestoUmano(s)) trovate.add(s);
        }
      }
      unita.length = 0;
      inizio = -1;
    }
    // Avanza di 1, non di 2: una stringa UTF-16 può cominciare a offset dispari
    // rispetto al punto in cui ci troviamo. Saltare di 2 ne perde metà.
    i += 1;
  }

  if (inizio !== -1 && unita.length >= MIN_LEN) {
    const grezzo = String.fromCharCode(...unita.slice(0, 2000));
    for (const s of spezzaSuPadding(grezzo)) {
      if (sembraTestoUmano(s)) trovate.add(s);
    }
  }
}

// ── Ricerca esatta con contorno ───────────────────────────────────────────

/**
 * Cerca una frase come sequenza UTF-16LE nel dump GREZZO e mostra i byte
 * attorno. Nessun filtro, nessuna soglia: qui non si può essere ingannati
 * da MIN_LEN o da `sembraTestoUmano`.
 *
 * PERCHÉ IL CONTORNO CONTA PIÙ DELLA STRINGA. Sapere che "Other games" è in
 * memoria dice solo che il testo c'è. Per ricostruire un .locres servono
 * NAMESPACE e CHIAVE, e se il testo vive dentro la tabella di
 * FTextLocalizationManager, chiave e namespace stanno a poca distanza. Se
 * invece attorno c'è solo un int32 di lunghezza e poi dati scorrelati, è una
 * FString nuda: il testo si può leggere ma non si sa a quale voce appartenga,
 * e la strada dell'override .locres non si chiude da qui.
 */
function cercaEsatto(f, frase) {
  const ago = Buffer.from(frase, 'utf16le');
  const fd = fs.openSync(f, 'r');
  const dim = fs.statSync(f).size;
  const occorrenze = [];
  const PRIMA = 128;
  const DOPO = 128;

  try {
    let letto = 0;
    while (letto < dim && occorrenze.length < 20) {
      const inizio = letto === 0 ? 0 : letto - ago.length;
      const quanti = Math.min(CHUNK, dim - inizio);
      if (quanti <= ago.length && letto !== 0) break;
      const buf = Buffer.alloc(quanti);
      const n = fs.readSync(fd, buf, 0, quanti, inizio);
      if (n <= 0) break;
      const vista = buf.subarray(0, n);
      let i = 0;
      while ((i = vista.indexOf(ago, i)) !== -1 && occorrenze.length < 20) {
        occorrenze.push(inizio + i);
        i += 2;
      }
      letto = inizio + n;
    }

    return occorrenze.map((off) => {
      const da = Math.max(0, off - PRIMA);
      const quanti = Math.min(PRIMA + ago.length + DOPO, dim - da);
      const buf = Buffer.alloc(quanti);
      const n = fs.readSync(fd, buf, 0, quanti, da);
      return { off, base: da, contorno: buf.subarray(0, n) };
    });
  } finally {
    fs.closeSync(fd);
  }
}

/** Rende i byte come UTF-16 leggibile, con i non-testo come punti. */
function comeTesto16(buf) {
  let s = '';
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const cu = buf[i] | (buf[i + 1] << 8);
    s += cu >= 0x20 && cu <= 0x7e ? String.fromCharCode(cu) : '.';
  }
  return s;
}

/** Rende i byte come ASCII a 8 bit: le chiavi .locres a volte sono ANSI. */
function comeTesto8(buf) {
  let s = '';
  for (const b of buf) s += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.';
  return s;
}

// ── Scansione ─────────────────────────────────────────────────────────────

function scansiona(f) {
  const fd = fs.openSync(f, 'r');
  const dim = fs.statSync(f).size;
  const trovate = new Set();
  let troncato = false;

  try {
    let letto = 0;
    let ultimaPerc = -1;
    while (letto < dim) {
      const inizio = letto === 0 ? 0 : letto - OVERLAP;
      const quanti = Math.min(CHUNK, dim - inizio);
      if (quanti <= OVERLAP && letto !== 0) break;

      const buf = Buffer.alloc(quanti);
      const n = fs.readSync(fd, buf, 0, quanti, inizio);
      if (n <= 0) break;

      estraiDaBlocco(buf, n, trovate);
      letto = inizio + n;

      if (trovate.size > MAX_STRINGHE) {
        troncato = true;
        break;
      }

      const perc = Math.floor((letto / dim) * 100);
      if (!asJson && perc !== ultimaPerc && perc % 5 === 0) {
        process.stdout.write(`\r  scansione: ${perc}%  ·  stringhe: ${trovate.size}   `);
        ultimaPerc = perc;
      }
    }
    if (!asJson) process.stdout.write('\r' + ' '.repeat(50) + '\r');
  } finally {
    fs.closeSync(fd);
  }

  return { dim, trovate, troncato };
}

// ── Referto ───────────────────────────────────────────────────────────────

function main() {
  if (!file) {
    console.log('Uso: node scripts/ue-dump-strings.js "<file.DMP>" [--cerca "a,b"] [--min 8] [--out f.txt] [--json]');
    process.exitCode = 2;
    return;
  }
  if (!fs.existsSync(file)) {
    console.error(`File non trovato: ${file}`);
    process.exitCode = 2;
    return;
  }

  // Modalità mirata: nessuna scansione da dieci minuti, si va dritti alla frase.
  if (ESATTO) {
    const occ = cercaEsatto(file, ESATTO);
    console.log(`\nRicerca esatta di "${ESATTO}" (UTF-16LE) in ${path.basename(file)}`);
    if (!occ.length) {
      console.log('  Nessuna occorrenza. La frase non è nel dump in UTF-16LE:');
      console.log('  o non era caricata, o il gioco la tiene in un\'altra codifica.');
      return;
    }
    console.log(`  ${occ.length} occorrenza/e${occ.length === 20 ? ' (fermato a 20)' : ''}\n`);
    for (const o of occ) {
      const rel = o.off - o.base;
      console.log(`─── offset 0x${o.off.toString(16)} (${o.off}) ─────────────────────────`);
      const prima = o.contorno.subarray(0, rel);
      const dopo = o.contorno.subarray(rel + Buffer.from(ESATTO, 'utf16le').length);
      // ⚠️ ASPETTATIVA SBAGLIATA, CORRETTA IL 30/07/2026 DAI DATI VERI.
      // Questo controllo nasceva da «prima di una FString ci sono 4 byte di
      // lunghezza». È vero SU DISCO (serializzazione .locres), NON in memoria:
      // una FString è un TArray<TCHAR> in cui lunghezza e capacità stanno nella
      // struttura, mentre i caratteri vivono in un'ALLOCAZIONE HEAP SEPARATA.
      // Prima dei caratteri c'è l'header dell'allocatore, non la lunghezza.
      // Sui 4 riscontri del gioco di collaudo usciva 23199744 / 0 / 464 / 0: non combaciava
      // nessuno, ed era corretto così. Lo lascio perché distingue un blob
      // serializzato da uno vivo, ma senza far passare il "non combacia" per
      // un esito negativo — è la NORMA in un dump di memoria.
      if (prima.length >= 4) {
        const len = prima.readInt32LE(prima.length - 4);
        const atteso = ESATTO.length + 1; // UE conta il terminatore
        const combacia = len === atteso || len === -atteso;
        console.log(
          `  int32 prima del testo: ${len}   ` +
          (combacia
            ? '← combacia: blob SERIALIZZATO (.locres in memoria)'
            : '← non combacia: normale per una FString viva nell\'heap')
        );
      }
      console.log(`  PRIMA  utf16: ${comeTesto16(prima)}`);
      console.log(`  PRIMA  ascii: ${comeTesto8(prima)}`);
      console.log(`  DOPO   utf16: ${comeTesto16(dopo)}`);
      console.log(`  DOPO   ascii: ${comeTesto8(dopo)}`);
      console.log('');
    }
    console.log('COSA GUARDARE: se in PRIMA o DOPO compaiono nomi tipo un namespace');
    console.log('o una chiave (testo corto, senza spazi, stile identificatore), allora');
    console.log('le CHIAVI sono in memoria accanto al testo e il .locres si può');
    console.log('ricostruire. Se c\'è solo lunghezza + testo + binario, no.');
    return;
  }

  const { dim, trovate, troncato } = scansiona(file);
  const lista = [...trovate].sort();

  // Verifica mirata: le parole che DEVONO esserci se il dump contiene la UI.
  //
  // ⚠️ CORREZIONE 30/07/2026 — il primo giro di questo blocco produceva un
  // referto BUGIARDO. Con `--min 8` (default) una voce di menu come "Credits"
  // (7 caratteri) è scartata dallo scanner PRIMA di arrivare qui, e la verifica
  // stampava «✘ NON trovata»: una frase che suona come una misura ed è invece
  // un artefatto della soglia. Su questo referto si sarebbe concluso che il
  // dump non contiene la UI — falso, e nella direzione peggiore, perché avrebbe
  // fatto buttare una strada buona.
  //
  // Ora una parola più corta di MIN_LEN è dichiarata NON MISURABILE, che è la
  // verità: questo strumento, così configurato, non può dire niente su di lei.
  // Stessa forma del difetto di [post-translation-truth]: il problema non era
  // un errore, era un verdetto sicuro emesso senza i dati per emetterlo.
  const esiti = CERCA.map((parola) => {
    if (parola.length < MIN_LEN) {
      return { parola, misurabile: false, presente: null, campioni: [] };
    }
    const rx = new RegExp(parola.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const tutti = lista.filter((s) => rx.test(s));
    // Una voce di menu sta in memoria DA SOLA. Se la parola compare unicamente
    // dentro frasi lunghe (comandi console UE, testi di Windows), è rumore.
    const esatti = tutti.filter((s) => s.trim().toLowerCase() === parola.toLowerCase());
    return {
      parola,
      misurabile: true,
      presente: tutti.length > 0,
      esatta: esatti.length > 0,
      campioni: (esatti.length ? esatti : tutti).slice(0, 5),
    };
  });

  if (asJson) {
    console.log(JSON.stringify({
      file: file.replace(/\\/g, '/'),
      dimensione: dim,
      stringhe: lista.length,
      troncato,
      cerca: esiti,
      campione: lista.filter((s) => s.includes(' ')).slice(0, 40),
    }, null, 2));
  } else {
    console.log(`\nFile:      ${file}`);
    console.log(`Dimensione: ${(dim / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`Stringhe testuali distinte (>= ${MIN_LEN} caratteri): ${lista.length}`);
    if (troncato) {
      console.log(`⚠ Fermato a ${MAX_STRINGHE}: il conteggio è un minimo, non il totale.`);
    }

    if (esiti.length) {
      console.log('\nVERIFICA MIRATA');
      for (const e of esiti) {
        if (!e.misurabile) {
          console.log(`  ? "${e.parola}"  — NON MISURABILE: più corta di --min ${MIN_LEN}, mai raccolta.`);
          continue;
        }
        const segno = e.esatta ? '✔' : e.presente ? '~' : '✘';
        const nota = e.esatta
          ? ' (stringa a sé: è testo della UI)'
          : e.presente
            ? ' — solo DENTRO frasi più lunghe: probabile rumore, non la voce di menu'
            : ' — NON trovata';
        console.log(`  ${segno} "${e.parola}"${nota}`);
        for (const c of e.campioni) console.log(`       · ${c.slice(0, 100)}`);
      }

      const misurabili = esiti.filter((e) => e.misurabile);
      const corte = esiti.length - misurabili.length;
      if (corte) {
        console.log(`\n  ⚠ ${corte} parola/e più corte di ${MIN_LEN} caratteri: rilancia con --min 4`);
        console.log('    per averne un verdetto, oppure usa --esatto per cercarle nel dump grezzo.');
      }
      if (misurabili.length && misurabili.every((e) => !e.presente)) {
        console.log('\n  Nessuna delle parole misurabili è nel dump. Se erano a schermo');
        console.log('  quando l\'hai catturato, allora il dump NON contiene la UI:');
        console.log('  il problema è la cattura, non il formato del testo.');
      }
    }

    const conSpazio = lista.filter((s) => s.includes(' '));
    console.log(`\nCAMPIONE (${Math.min(30, conSpazio.length)} di ${conSpazio.length} con spazi)`);
    for (const s of conSpazio.slice(0, 30)) console.log(`  · ${s.slice(0, 110)}`);

    // Il salvataggio non deve buttare via venti minuti di scansione con uno
    // stack trace perché il percorso di --out non è scrivibile.
    try {
      fs.writeFileSync(OUT, lista.join('\n'), 'utf8');
      console.log(`\nTutte le stringhe salvate in ${path.resolve(OUT)}`);
    } catch (e) {
      console.error(`\n⚠ Non sono riuscito a scrivere ${path.resolve(OUT)}: ${e.message}`);
      console.error('  Il referto qui sopra è comunque valido. Riprova con --out su un percorso scrivibile.');
      process.exitCode = 1;
    }
  }
}

main();
