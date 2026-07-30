'use strict';
/**
 * Lettore minimo di file MINIDUMP (.DMP di Windows), quel tanto che basta per
 * leggere la memoria di un processo PER INDIRIZZO VIRTUALE invece che per
 * offset di file.
 *
 * PERCHÉ ESISTE — 30/07/2026, Below, Rusted Gods.
 * -----------------------------------------------
 * Cercando il `Game.locres` dentro il dump lo si trovava, se ne leggeva l'indice
 * per intero (811 chiavi su 811, perfette), e poi l'array delle stringhe si
 * interrompeva alla 204ª su 752 con byte incomprensibili. La diagnosi ovvia era
 * «memoria liberata e riciclata dall'allocatore».
 *
 * ERA SBAGLIATA, e a smontarla è stato un fatto, non un ragionamento: DUE dump
 * presi in momenti diversi, a offset diversi, sono risultati BYTE-IDENTICI fino
 * al punto di rottura — stesso punto, stesso valore. Il riciclo di memoria non
 * si ripete uguale due volte. Un layout di file sì.
 *
 * La causa vera: **un .DMP non è un'immagine lineare della memoria.** È un
 * elenco di regioni, ciascuna con il proprio indirizzo virtuale, concatenate
 * nel file. Un'allocazione contigua in memoria può essere spezzata su più
 * regioni, e quelle regioni nel FILE non sono adiacenti. Leggendo il file di
 * seguito, al confine si finisce in un'altra zona di memoria del processo: dati
 * validissimi, ma di un altro oggetto. Ecco perché i byte sembravano rumore ed
 * erano deterministici.
 *
 * (Ho anche escluso il confine di pagina osservando che l'offset non era
 * multiplo di 4096. Anche quello era un errore: ad essere allineato alle pagine
 * è l'indirizzo VIRTUALE, non la posizione nel file.)
 *
 * Con la mappa delle regioni si legge per indirizzo virtuale e la lettura non
 * si spezza più.
 *
 * FORMATO (documentazione Microsoft, struttura MINIDUMP_HEADER e seguenti)
 *   header:    'MDMP' (4) · versione (4) · numeroStream (4) · rvaDirectory (4)
 *   directory: per stream → tipo (4) · dimensione (4) · rva (4)
 *   stream 9 = Memory64List:  numeroRegioni (8) · rvaBase (8) ·
 *                             per regione → indirizzoVirtuale (8) · dimensione (8)
 *              I dati stanno di seguito a partire da rvaBase, nell'ordine delle
 *              regioni. È il formato dei dump "con memoria completa", quelli
 *              che produce Gestione attività.
 *   stream 5 = MemoryList (dump piccoli):
 *                             numeroRegioni (4) ·
 *                             per regione → indirizzoVirtuale (8) ·
 *                                           dimensione (4) · rva (4)
 */

const fs = require('fs');

const TIPO_MEMORY_LIST = 5;
const TIPO_MEMORY64_LIST = 9;

/**
 * Costruisce la mappa delle regioni di memoria del dump.
 * @returns {{regioni: Array<{va: bigint, dim: bigint, off: bigint}>, tipo: string}}
 */
function mappaRegioni(percorso) {
  const fd = fs.openSync(percorso, 'r');
  try {
    const testa = Buffer.alloc(32);
    fs.readSync(fd, testa, 0, 32, 0);
    if (testa.toString('latin1', 0, 4) !== 'MDMP') {
      throw new Error('Non è un file MINIDUMP (firma MDMP assente).');
    }
    const numeroStream = testa.readUInt32LE(8);
    const rvaDirectory = testa.readUInt32LE(12);

    const dir = Buffer.alloc(numeroStream * 12);
    fs.readSync(fd, dir, 0, dir.length, rvaDirectory);

    let voce64 = null;
    let voce32 = null;
    for (let i = 0; i < numeroStream; i++) {
      const tipo = dir.readUInt32LE(i * 12);
      const dimensione = dir.readUInt32LE(i * 12 + 4);
      const rva = dir.readUInt32LE(i * 12 + 8);
      if (tipo === TIPO_MEMORY64_LIST) voce64 = { dimensione, rva };
      if (tipo === TIPO_MEMORY_LIST) voce32 = { dimensione, rva };
    }

    if (voce64) {
      const testata = Buffer.alloc(16);
      fs.readSync(fd, testata, 0, 16, voce64.rva);
      const numero = testata.readBigUInt64LE(0);
      const rvaBase = testata.readBigUInt64LE(8);

      const n = Number(numero);
      const elenco = Buffer.alloc(n * 16);
      fs.readSync(fd, elenco, 0, elenco.length, voce64.rva + 16);

      const regioni = [];
      let scorrimento = rvaBase;
      for (let i = 0; i < n; i++) {
        const va = elenco.readBigUInt64LE(i * 16);
        const dim = elenco.readBigUInt64LE(i * 16 + 8);
        regioni.push({ va, dim, off: scorrimento });
        scorrimento += dim;
      }
      return { regioni, tipo: 'Memory64List' };
    }

    if (voce32) {
      const testata = Buffer.alloc(4);
      fs.readSync(fd, testata, 0, 4, voce32.rva);
      const n = testata.readUInt32LE(0);
      const elenco = Buffer.alloc(n * 16);
      fs.readSync(fd, elenco, 0, elenco.length, voce32.rva + 4);
      const regioni = [];
      for (let i = 0; i < n; i++) {
        regioni.push({
          va: elenco.readBigUInt64LE(i * 16),
          dim: BigInt(elenco.readUInt32LE(i * 16 + 8)),
          off: BigInt(elenco.readUInt32LE(i * 16 + 12)),
        });
      }
      return { regioni, tipo: 'MemoryList' };
    }

    throw new Error('Nessuno stream di memoria nel dump (né Memory64List né MemoryList).');
  } finally {
    fs.closeSync(fd);
  }
}

/** Da posizione nel file all'indirizzo virtuale corrispondente. */
function offsetAVirtuale(regioni, offset) {
  const o = BigInt(offset);
  for (const r of regioni) {
    if (o >= r.off && o < r.off + r.dim) return r.va + (o - r.off);
  }
  return null;
}

/** Da indirizzo virtuale alla posizione nel file. */
function virtualeAOffset(regioni, va) {
  for (const r of regioni) {
    if (va >= r.va && va < r.va + r.dim) return { off: r.off + (va - r.va), r };
  }
  return null;
}

/**
 * Legge `quanti` byte a partire dall'indirizzo virtuale `va`, attraversando le
 * regioni: se in memoria sono contigue, il risultato è contiguo, anche quando
 * nel file stanno in punti distanti.
 *
 * Si ferma — e lo DICHIARA — appena l'indirizzo successivo non è coperto dal
 * dump: meglio dire «ho letto fin qui» che restituire byte di un altro oggetto
 * spacciandoli per i propri. È l'errore in cui siamo caduti leggendo il file in
 * modo lineare.
 */
function leggiVirtuale(percorso, regioni, va, quanti) {
  const fd = fs.openSync(percorso, 'r');
  const pezzi = [];
  let letti = 0;
  let corrente = va;
  let buchi = 0;
  try {
    while (letti < quanti) {
      const posizione = virtualeAOffset(regioni, corrente);
      if (!posizione) {
        buchi++;
        break;
      }
      const restoRegione = Number(posizione.r.va + posizione.r.dim - corrente);
      const daLeggere = Math.min(quanti - letti, restoRegione);
      const buf = Buffer.alloc(daLeggere);
      fs.readSync(fd, buf, 0, daLeggere, Number(posizione.off));
      pezzi.push(buf);
      letti += daLeggere;
      corrente += BigInt(daLeggere);
    }
  } finally {
    fs.closeSync(fd);
  }
  return { dati: Buffer.concat(pezzi), letti, completo: letti === quanti, buchi };
}

module.exports = { mappaRegioni, offsetAVirtuale, virtualeAOffset, leggiVirtuale };
