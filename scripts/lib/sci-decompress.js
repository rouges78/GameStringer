/**
 * Decompressori delle risorse Sierra SCI (SCI0/SCI01).
 *
 * Metodi nel header di risorsa: 0 = nessuna, 1 = LZW, 2 = Huffman (COMP3),
 * 3 = LZW1, 4 = LZW1View. Larry 3 (misurato 05/08/2026): 88% LZW, 9% Huffman,
 * 3% nessuna — quindi senza questi due non si legge quasi niente.
 *
 * Gli algoritmi sono quelli implementati in ScummVM (engines/sci/resource/
 * decompressor.cpp, GPL) — qui riscritti in JS a partire dalla descrizione del
 * formato. Attenzione a una differenza sottile e velenosa: LZW legge i bit
 * dal meno significativo (LSB), Huffman dal più significativo (MSB).
 *
 * PROVA DI EFFETTO: un decoder sbagliato non "fallisce", produce spazzatura.
 * La verifica giusta non è il conteggio ma leggere frasi di senso compiuto.
 */

// ── lettore di bit ──────────────────────────────────────────────────────────
class BitReader {
  constructor(buf) {
    this.buf = buf;
    this.pos = 0;
    this.dwBits = 0; // registro
    this.nBits = 0;  // bit validi nel registro
  }
  _byte() {
    return this.pos < this.buf.length ? this.buf[this.pos++] : 0;
  }
  /** LZW: bit impacchettati dal meno significativo. */
  getBitsLSB(n) {
    while (this.nBits <= 24) {
      this.dwBits = (this.dwBits | (this._byte() << this.nBits)) >>> 0;
      this.nBits += 8;
    }
    const ret = this.dwBits & (n === 32 ? 0xffffffff : ((1 << n) - 1));
    this.dwBits = this.dwBits >>> n;
    this.nBits -= n;
    return ret >>> 0;
  }
  /** Huffman: bit impacchettati dal più significativo, registro allineato in alto. */
  getBitsMSB(n) {
    while (this.nBits < n) {
      this.dwBits = (this.dwBits | (this._byte() << (24 - this.nBits))) >>> 0;
      this.nBits += 8;
    }
    const ret = this.dwBits >>> (32 - n);
    this.dwBits = (this.dwBits << n) >>> 0;
    this.nBits -= n;
    return ret >>> 0;
  }
  finito() { return this.pos >= this.buf.length && this.nBits <= 0; }
}

// ── LZW (metodo 1) ──────────────────────────────────────────────────────────
function unpackLZW(src, szUnpacked) {
  const dest = Buffer.alloc(szUnpacked);
  let wrote = 0;
  const br = new BitReader(src);

  let numbits = 9;
  let endtoken = 0x1ff;
  let curtoken = 0x102;
  const tokenlist = new Uint16Array(4096);       // offset in dest
  const tokenlength = new Uint16Array(4096);     // lunghezza

  const putByte = (b) => { if (wrote < szUnpacked) dest[wrote++] = b & 0xff; };

  while (wrote < szUnpacked) {
    const token = br.getBitsLSB(numbits);

    if (token === 0x101) break;          // terminatore
    if (token === 0x100) {               // reset del dizionario
      numbits = 9; endtoken = 0x1ff; curtoken = 0x102;
      continue;
    }

    let lastlength;
    if (token > 0xff) {
      if (token >= curtoken) {
        // Token oltre il dizionario: flusso corrotto o decoder sbagliato.
        // Meglio fermarsi che scrivere spazzatura fingendo successo.
        throw new Error(`LZW: token ${token.toString(16)} oltre il dizionario (cur ${curtoken.toString(16)})`);
      }
      lastlength = tokenlength[token] + 1;
      const start = tokenlist[token];
      for (let i = 0; i < lastlength && wrote < szUnpacked; i++) putByte(dest[start + i]);
    } else {
      lastlength = 1;
      putByte(token);
    }

    if (curtoken > endtoken && numbits < 12) {
      numbits++;
      endtoken = (endtoken << 1) + 1;
    }
    if (curtoken <= endtoken) {
      tokenlist[curtoken] = wrote - lastlength;
      tokenlength[curtoken] = lastlength;
      curtoken++;
    }
    if (br.finito() && wrote < szUnpacked) break;
  }
  return { dati: dest, scritti: wrote };
}

// ── Huffman / COMP3 (metodo 2) ──────────────────────────────────────────────
function unpackHuffman(src, szUnpacked) {
  const dest = Buffer.alloc(szUnpacked);
  let wrote = 0;

  // header: numero di nodi, byte terminatore, poi i nodi (2 byte l'uno)
  const numnodes = src[0];
  const terminator = src[1] | 0x100;
  const nodi = src.subarray(2, 2 + numnodes * 2);
  const br = new BitReader(src.subarray(2 + numnodes * 2));

  const getc2 = () => {
    let n = 0; // indice del nodo (in coppie di byte)
    for (;;) {
      const b1 = nodi[n * 2 + 1];
      if (!b1) return nodi[n * 2] | (b1 << 8); // foglia
      let next;
      if (br.getBitsMSB(1)) {
        next = b1 & 0x0f;
        if (next === 0) return br.getBitsMSB(8) | 0x100; // letterale a 8 bit
      } else {
        next = b1 >> 4;
      }
      n += next;
    }
  };

  while (wrote < szUnpacked) {
    const c = getc2();
    if (c === terminator || c < 0) break;
    dest[wrote++] = c & 0xff;
    if (br.finito() && wrote < szUnpacked) break;
  }
  return { dati: dest, scritti: wrote };
}

/**
 * Decomprime secondo il metodo dichiarato nel header di risorsa.
 * Ritorna { dati, scritti, metodo } oppure lancia se il metodo non è gestito:
 * dichiarare "fatto" su un metodo ignoto sarebbe un fallimento muto.
 */
function decomprimi(src, szUnpacked, metodo) {
  switch (metodo) {
    case 0: return { dati: src.subarray(0, szUnpacked), scritti: Math.min(src.length, szUnpacked), metodo: 'nessuna' };
    case 1: return { ...unpackLZW(src, szUnpacked), metodo: 'LZW' };
    case 2: return { ...unpackHuffman(src, szUnpacked), metodo: 'Huffman' };
    default:
      throw new Error(`metodo di compressione ${metodo} non gestito (LZW1/LZW1View: da implementare)`);
  }
}

module.exports = { decomprimi, unpackLZW, unpackHuffman, BitReader };
