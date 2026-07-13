'use client';

/**
 * Font coverage — rileva i glifi mancanti nei font di un gioco.
 *
 * "La traduzione perfetta che rende □□□ in-game è comunque un fallimento":
 * questo modulo legge la tabella `cmap` di un font TTF/OTF/TTC (formati 4 e
 * 12, quelli usati dalla quasi totalità dei font di gioco) e verifica se i
 * caratteri richiesti dalla lingua di destinazione (cirillico, greco, CJK,
 * hangul, arabo, thai, vietnamita…) hanno un glifo reale.
 *
 * Tutto puro TypeScript su ArrayBuffer: nessuna dipendenza, testabile con
 * fixture reali nel corpus (__tests__/fixtures/engines/fonts/).
 */

// ── Scritture e caratteri campione ─────────────────────────

export type ScriptKey =
  | 'latin' | 'latinExt' | 'vietnamese'
  | 'cyrillic' | 'greek'
  | 'cjk' | 'hiragana' | 'katakana' | 'hangul'
  | 'arabic' | 'hebrew' | 'thai';

/**
 * Campioni rappresentativi per scrittura. Non serve TUTTO l'alfabeto: se un
 * font copre questi, copre la scrittura; se ne manca una parte consistente,
 * in gioco si vedranno i quadrati.
 */
export const SCRIPT_SAMPLES: Record<ScriptKey, string> = {
  latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  latinExt: 'àèéìòùÀÈÉÌÒÙâêîôûäëïöüßçñÇÑåøæÅØÆőűŐŰşğİąćęłńśźżĄĆĘŁŃŚŹŻčďěňřšťůžČŠŽ',
  vietnamese: 'ăâđêôơưĂÂĐÊÔƠƯạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ',
  cyrillic: 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюяЁёЇїІіЄєЎў',
  greek: 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψωάέήίόύώΆΈΉΊΌΎΏϊϋΐΰ',
  // Hanzi/kanji più frequenti (comuni a zh e ja): se mancano questi, il font
  // non ha copertura CJK utile.
  cjk: '的一是不了人我在有他这中大来上国个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可她里后小么心多天而能好都然没日于起还发成事只作当想看文无开手十用主行方又如前所本见经头面公同三已老从动两长知民样现分将外但身些与高意进把法此实回二理美点',
  hiragana: 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽっゃゅょ',
  katakana: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポッャュョー',
  // Sillabe hangul frequenti + jamo base
  hangul: '가나다라마바사아자차카타파하이그것은는을를에서와과도로하지않았습니다있는한국어게임번역다시',
  arabic: 'ابتثجحخدذرزسشصضطظعغفقكلمنهويأإآءئؤةى',
  hebrew: 'אבגדהוזחטיכלמנסעפצקרשתךםןףץ',
  thai: 'กขคงจฉชซญฎฏฐณดตถทธนบปผฝพฟภมยรลวศษสหอฮะัาำิีึืุูเแโใไ็่้๊๋์',
};

/** Scritture richieste da una lingua target (codice ISO, anche con regione). */
export function scriptsForLanguage(lang: string): ScriptKey[] {
  const base = (lang || '').split(/[-_]/)[0].toLowerCase();
  switch (base) {
    case 'ru': case 'uk': case 'be': case 'bg': case 'sr': case 'mk': case 'kk':
      return ['cyrillic', 'latin'];
    case 'el':
      return ['greek', 'latin'];
    case 'ja':
      return ['hiragana', 'katakana', 'cjk', 'latin'];
    case 'zh':
      return ['cjk', 'latin'];
    case 'ko':
      return ['hangul', 'latin'];
    case 'ar': case 'fa': case 'ur':
      return ['arabic', 'latin'];
    case 'he':
      return ['hebrew', 'latin'];
    case 'th':
      return ['thai', 'latin'];
    case 'vi':
      return ['vietnamese', 'latinExt', 'latin'];
    case 'en':
      return ['latin'];
    default:
      // Lingue europee a base latina (it, es, fr, de, pt, pl, cs, tr, …)
      return ['latinExt', 'latin'];
  }
}

// ── Parser cmap (TTF / OTF / TTC) ──────────────────────────

export interface FontCoverage {
  /** true se il font ha un glifo reale per il code point. */
  hasGlyph: (codePoint: number) => boolean;
  /** 'format4' | 'format12' — sottotabella usata. */
  format: string;
}

function u16(view: DataView, o: number): number { return view.getUint16(o, false); }
function u32(view: DataView, o: number): number { return view.getUint32(o, false); }

/**
 * Estrae la copertura glifi dalla tabella cmap di un font.
 * Supporta sfnt TTF/OTF e collezioni TTC (primo font). Ritorna null se il
 * formato non è riconosciuto (il chiamante tratta il font come "non ispezionabile").
 */
export function parseFontCoverage(buffer: ArrayBuffer): FontCoverage | null {
  try {
    const view = new DataView(buffer);
    if (buffer.byteLength < 12) return null;

    let sfntOffset = 0;
    const tag = u32(view, 0);
    if (tag === 0x74746366) { // 'ttcf' — TrueType Collection: primo font
      if (u32(view, 8) < 1) return null;
      sfntOffset = u32(view, 12);
    } else if (tag !== 0x00010000 && tag !== 0x4f54544f && tag !== 0x74727565) {
      // 0x00010000 TTF, 'OTTO' OTF/CFF, 'true' Apple
      return null;
    }

    // Table directory → tabella 'cmap'
    const numTables = u16(view, sfntOffset + 4);
    let cmapOffset = -1;
    for (let i = 0; i < numTables; i++) {
      const rec = sfntOffset + 12 + i * 16;
      if (u32(view, rec) === 0x636d6170) { // 'cmap'
        cmapOffset = u32(view, rec + 8);
        break;
      }
    }
    if (cmapOffset < 0 || cmapOffset + 4 > buffer.byteLength) return null;

    // Encoding records: preferisci Unicode full (fmt 12), poi BMP (fmt 4)
    const numRecords = u16(view, cmapOffset + 2);
    let best: { offset: number; score: number } | null = null;
    for (let i = 0; i < numRecords; i++) {
      const rec = cmapOffset + 4 + i * 8;
      const platform = u16(view, rec);
      const encoding = u16(view, rec + 2);
      const subOffset = cmapOffset + u32(view, rec + 4);
      if (subOffset + 4 > buffer.byteLength) continue;
      const format = u16(view, subOffset);
      let score = 0;
      if (platform === 3 && encoding === 10 && format === 12) score = 5;      // Windows Unicode full
      else if (platform === 0 && format === 12) score = 4;                     // Unicode full
      else if (platform === 3 && encoding === 1 && format === 4) score = 3;    // Windows BMP
      else if (platform === 0 && format === 4) score = 2;                      // Unicode BMP
      else if (format === 4 || format === 12) score = 1;
      if (score > 0 && (!best || score > best.score)) best = { offset: subOffset, score };
    }
    if (!best) return null;

    const subOffset = best.offset;
    const format = u16(view, subOffset);

    if (format === 12) {
      const nGroups = u32(view, subOffset + 12);
      const groups: Array<[number, number]> = [];
      for (let i = 0; i < nGroups; i++) {
        const g = subOffset + 16 + i * 12;
        if (g + 12 > buffer.byteLength) break;
        groups.push([u32(view, g), u32(view, g + 4)]);
      }
      return {
        format: 'format12',
        hasGlyph: (cp: number) => {
          // Ricerca binaria sui gruppi ordinati
          let lo = 0, hi = groups.length - 1;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const [start, end] = groups[mid];
            if (cp < start) hi = mid - 1;
            else if (cp > end) lo = mid + 1;
            else return true;
          }
          return false;
        },
      };
    }

    if (format === 4) {
      const segCountX2 = u16(view, subOffset + 6);
      const segCount = segCountX2 / 2;
      const endO = subOffset + 14;
      const startO = endO + segCountX2 + 2; // +2: reservedPad
      const deltaO = startO + segCountX2;
      const rangeO = deltaO + segCountX2;
      return {
        format: 'format4',
        hasGlyph: (cp: number) => {
          if (cp > 0xffff) return false;
          // Trova il primo segmento con endCode >= cp (ricerca binaria)
          let lo = 0, hi = segCount - 1, seg = -1;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (u16(view, endO + mid * 2) >= cp) { seg = mid; hi = mid - 1; }
            else lo = mid + 1;
          }
          if (seg < 0) return false;
          const start = u16(view, startO + seg * 2);
          if (cp < start) return false;
          const idRangeOffset = u16(view, rangeO + seg * 2);
          if (idRangeOffset === 0) {
            const delta = u16(view, deltaO + seg * 2);
            return ((cp + delta) & 0xffff) !== 0; // glyph 0 = .notdef
          }
          const glyphAddr = rangeO + seg * 2 + idRangeOffset + (cp - start) * 2;
          if (glyphAddr + 2 > buffer.byteLength) return false;
          const glyphId = u16(view, glyphAddr);
          if (glyphId === 0) return false;
          const delta = u16(view, deltaO + seg * 2);
          return ((glyphId + delta) & 0xffff) !== 0;
        },
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ── Analisi copertura ──────────────────────────────────────

export interface ScriptCoverage {
  script: ScriptKey;
  total: number;
  covered: number;
  percent: number;
  /** Primi caratteri mancanti (per mostrare esempi concreti all'utente). */
  missingSamples: string;
}

export function coverageForScript(font: FontCoverage, script: ScriptKey): ScriptCoverage {
  const sample = SCRIPT_SAMPLES[script];
  const chars = Array.from(sample);
  let covered = 0;
  const missing: string[] = [];
  for (const ch of chars) {
    const cp = ch.codePointAt(0);
    if (cp != null && font.hasGlyph(cp)) covered++;
    else if (missing.length < 12) missing.push(ch);
  }
  return {
    script,
    total: chars.length,
    covered,
    percent: chars.length ? Math.round((covered / chars.length) * 100) : 100,
    missingSamples: missing.join(''),
  };
}

export interface FontLanguageReport {
  /** true = il font copre (>=95%) tutte le scritture richieste dalla lingua. */
  ok: boolean;
  byScript: ScriptCoverage[];
}

export function analyzeFontForLanguage(buffer: ArrayBuffer, targetLang: string): FontLanguageReport | null {
  const font = parseFontCoverage(buffer);
  if (!font) return null;
  const byScript = scriptsForLanguage(targetLang).map(s => coverageForScript(font, s));
  return { ok: byScript.every(s => s.percent >= 95), byScript };
}
