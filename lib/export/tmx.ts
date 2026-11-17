/**
 * TMX 1.4b (Translation Memory eXchange) builder.
 *
 * Funzione pura: chi la usa scrive il risultato su disco. La coppia di lingue
 * arriva dal chiamante (la coppia reale della TM), mai fissata qui, e valgono
 * gli stessi filtri degli export Rust (traduzioni vuote, contesto, note).
 */

export interface TmxEntry {
  id: string;
  source: string;
  target: string;
  context?: string;
  notes?: string;
}

export interface TmxOptions {
  sourceLang: string;
  targetLang: string;
  includeContext: boolean;
  includeNotes: boolean;
  includeEmpty: boolean;
}

export interface TmxDocument {
  content: string;
  /** Numero di <tu> scritte davvero, dopo i filtri. */
  count: number;
}

// Caratteri che XML 1.0 vieta anche come riferimento numerico: se restano,
// nessun CAT tool apre il file.
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function escapeXml(value: string): string {
  return value
    .replace(INVALID_XML_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Un CR nudo verrebbe normalizzato in LF dal parser: resta come riferimento.
    .replace(/\r/g, '&#13;');
}

function escapeXmlAttr(value: string): string {
  // Nei valori degli attributi il parser trasforma LF e TAB in spazi.
  return escapeXml(value).replace(/\n/g, '&#10;').replace(/\t/g, '&#9;');
}

export function buildTmx(entries: TmxEntry[], options: TmxOptions): TmxDocument {
  const srcLang = escapeXmlAttr(options.sourceLang.trim());
  const tgtLang = escapeXmlAttr(options.targetLang.trim());
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE tmx SYSTEM "tmx14.dtd">',
    '<tmx version="1.4">',
    `  <header creationtool="GameStringer" creationtoolversion="1.0" datatype="plaintext" segtype="sentence" adminlang="${srcLang}" srclang="${srcLang}" o-tmf="GameStringer"/>`,
    '  <body>',
  ];

  let count = 0;
  for (const entry of entries) {
    const hasTarget = entry.target.trim() !== '';
    if (!hasTarget && !options.includeEmpty) continue;

    lines.push(`    <tu tuid="${escapeXmlAttr(entry.id)}">`);
    if (options.includeNotes && entry.notes) {
      lines.push(`      <note>${escapeXml(entry.notes)}</note>`);
    }
    if (options.includeContext && entry.context) {
      lines.push(`      <prop type="x-context">${escapeXml(entry.context)}</prop>`);
    }
    lines.push(`      <tuv xml:lang="${srcLang}"><seg>${escapeXml(entry.source)}</seg></tuv>`);
    // In TMX non esiste una "traduzione vuota": la voce non tradotta porta solo l'originale.
    if (hasTarget) {
      lines.push(`      <tuv xml:lang="${tgtLang}"><seg>${escapeXml(entry.target)}</seg></tuv>`);
    }
    lines.push('    </tu>');
    count++;
  }

  lines.push('  </body>', '</tmx>', '');
  return { content: lines.join('\n'), count };
}
