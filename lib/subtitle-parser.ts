/**
 * 🎬 Subtitle Parser & Translator
 * 
 * Supporta:
 * - SRT (SubRip)
 * - VTT (WebVTT)
 * - ASS/SSA (Advanced SubStation Alpha)
 */

export interface SubtitleEntry {
  id: number;
  startTime: string;      // Formato originale (es. "00:01:23,456")
  endTime: string;
  startMs: number;        // Millisecondi per calcoli
  endMs: number;
  text: string;           // Testo originale
  translatedText?: string; // Testo tradotto
  style?: string;         // Per ASS: nome stile
  actor?: string;         // Per ASS: nome attore
  marginL?: number;
  marginR?: number;
  marginV?: number;
  effect?: string;
}

export interface SubtitleFile {
  format: 'srt' | 'vtt' | 'ass' | 'ssa';
  entries: SubtitleEntry[];
  metadata?: {
    title?: string;
    author?: string;
    language?: string;
    // ASS specific
    styles?: AssStyle[];
    scriptInfo?: Record<string, string>;
  };
}

export interface AssStyle {
  name: string;
  fontName: string;
  fontSize: number;
  primaryColor: string;
  secondaryColor: string;
  outlineColor: string;
  backColor: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeOut: boolean;
  scaleX: number;
  scaleY: number;
  spacing: number;
  angle: number;
  borderStyle: number;
  outline: number;
  shadow: number;
  alignment: number;
  marginL: number;
  marginR: number;
  marginV: number;
  encoding: number;
}

// ============================================================================
// TIME PARSING
// ============================================================================

/**
 * Converte timestamp SRT (00:01:23,456) in millisecondi
 */
export function srtTimeToMs(time: string): number {
  const match = time.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) return 0;
  
  const [, hours, minutes, seconds, ms] = match;
  return (
    parseInt(hours) * 3600000 +
    parseInt(minutes) * 60000 +
    parseInt(seconds) * 1000 +
    parseInt(ms)
  );
}

/**
 * Converte millisecondi in timestamp SRT
 */
export function msToSrtTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Converte millisecondi in timestamp VTT
 */
export function msToVttTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Converte timestamp ASS (0:01:23.45) in millisecondi
 */
export function assTimeToMs(time: string): number {
  const match = time.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
  if (!match) return 0;
  
  const [, hours, minutes, seconds, centiseconds] = match;
  return (
    parseInt(hours) * 3600000 +
    parseInt(minutes) * 60000 +
    parseInt(seconds) * 1000 +
    parseInt(centiseconds) * 10
  );
}

/**
 * Converte millisecondi in timestamp ASS
 */
export function msToAssTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

// ============================================================================
// SRT PARSER
// ============================================================================

export function parseSrt(content: string): SubtitleFile {
  const entries: SubtitleEntry[] = [];
  const blocks = content.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    
    const id = parseInt(lines[0]);
    if (isNaN(id)) continue;
    
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
    if (!timeMatch) continue;
    
    const [, startTime, endTime] = timeMatch;
    const text = lines.slice(2).join('\n');
    
    entries.push({
      id,
      startTime,
      endTime,
      startMs: srtTimeToMs(startTime),
      endMs: srtTimeToMs(endTime),
      text
    });
  }
  
  return { format: 'srt', entries };
}

// ============================================================================
// VTT PARSER
// ============================================================================

export function parseVtt(content: string): SubtitleFile {
  const entries: SubtitleEntry[] = [];
  const lines = content.split('\n');
  
  let metadata: SubtitleFile['metadata'] = {};
  let i = 0;
  
  // Skip WEBVTT header
  if (lines[0]?.startsWith('WEBVTT')) {
    i = 1;
    // Parse header metadata
    while (i < lines.length && lines[i].trim() !== '') {
      const match = lines[i].match(/^([^:]+):\s*(.+)$/);
      if (match) {
        if (match[1].toLowerCase() === 'language') {
          metadata.language = match[2];
        }
      }
      i++;
    }
  }
  
  let id = 1;
  while (i < lines.length) {
    // Skip empty lines
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;
    
    // Optional cue identifier
    let cueId = id;
    if (!lines[i].includes('-->')) {
      const parsed = parseInt(lines[i]);
      if (!isNaN(parsed)) cueId = parsed;
      i++;
    }
    
    // Time line
    const timeMatch = lines[i]?.match(/(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})/);
    if (!timeMatch) {
      i++;
      continue;
    }
    
    const [, startTime, endTime] = timeMatch;
    i++;
    
    // Text lines until empty line
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      textLines.push(lines[i]);
      i++;
    }
    
    entries.push({
      id: cueId,
      startTime,
      endTime,
      startMs: srtTimeToMs(startTime.replace('.', ',')),
      endMs: srtTimeToMs(endTime.replace('.', ',')),
      text: textLines.join('\n')
    });
    
    id++;
  }
  
  return { format: 'vtt', entries, metadata };
}

// ============================================================================
// ASS/SSA PARSER
// ============================================================================

export function parseAss(content: string): SubtitleFile {
  const entries: SubtitleEntry[] = [];
  const styles: AssStyle[] = [];
  const scriptInfo: Record<string, string> = {};
  
  const lines = content.split('\n');
  let currentSection = '';
  let eventFormat: string[] = [];
  let styleFormat: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Section headers
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1).toLowerCase();
      continue;
    }
    
    // Script Info
    if (currentSection === 'script info') {
      const match = trimmed.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        scriptInfo[match[1]] = match[2];
      }
    }
    
    // Styles
    if (currentSection === 'v4+ styles' || currentSection === 'v4 styles') {
      if (trimmed.startsWith('Format:')) {
        styleFormat = trimmed.slice(7).split(',').map(s => s.trim().toLowerCase());
      } else if (trimmed.startsWith('Style:')) {
        const values = trimmed.slice(6).split(',').map(s => s.trim());
        const style: Partial<AssStyle> = {};
        
        styleFormat.forEach((key, idx) => {
          const val = values[idx];
          switch (key) {
            case 'name': style.name = val; break;
            case 'fontname': style.fontName = val; break;
            case 'fontsize': style.fontSize = parseInt(val); break;
            case 'primarycolour': style.primaryColor = val; break;
            case 'secondarycolour': style.secondaryColor = val; break;
            case 'outlinecolour': style.outlineColor = val; break;
            case 'backcolour': style.backColor = val; break;
            case 'bold': style.bold = val === '-1' || val === '1'; break;
            case 'italic': style.italic = val === '-1' || val === '1'; break;
            case 'underline': style.underline = val === '-1' || val === '1'; break;
            case 'strikeout': style.strikeOut = val === '-1' || val === '1'; break;
            case 'scalex': style.scaleX = parseFloat(val); break;
            case 'scaley': style.scaleY = parseFloat(val); break;
            case 'spacing': style.spacing = parseFloat(val); break;
            case 'angle': style.angle = parseFloat(val); break;
            case 'borderstyle': style.borderStyle = parseInt(val); break;
            case 'outline': style.outline = parseFloat(val); break;
            case 'shadow': style.shadow = parseFloat(val); break;
            case 'alignment': style.alignment = parseInt(val); break;
            case 'marginl': style.marginL = parseInt(val); break;
            case 'marginr': style.marginR = parseInt(val); break;
            case 'marginv': style.marginV = parseInt(val); break;
            case 'encoding': style.encoding = parseInt(val); break;
          }
        });
        
        if (style.name) {
          styles.push(style as AssStyle);
        }
      }
    }
    
    // Events (Dialogue)
    if (currentSection === 'events') {
      if (trimmed.startsWith('Format:')) {
        eventFormat = trimmed.slice(7).split(',').map(s => s.trim().toLowerCase());
      } else if (trimmed.startsWith('Dialogue:')) {
        const values = trimmed.slice(9).split(',');
        const entry: Partial<SubtitleEntry> = { id: entries.length + 1 };
        
        // Text field may contain commas, so join remaining values
        const textIdx = eventFormat.indexOf('text');
        const textParts = values.slice(textIdx);
        
        eventFormat.forEach((key, idx) => {
          if (idx >= textIdx) return;
          const val = values[idx]?.trim();
          
          switch (key) {
            case 'start':
              entry.startTime = val;
              entry.startMs = assTimeToMs(val);
              break;
            case 'end':
              entry.endTime = val;
              entry.endMs = assTimeToMs(val);
              break;
            case 'style':
              entry.style = val;
              break;
            case 'name':
              entry.actor = val;
              break;
            case 'marginl':
              entry.marginL = parseInt(val);
              break;
            case 'marginr':
              entry.marginR = parseInt(val);
              break;
            case 'marginv':
              entry.marginV = parseInt(val);
              break;
            case 'effect':
              entry.effect = val;
              break;
          }
        });
        
        // Clean ASS tags from text for translation
        entry.text = textParts.join(',').replace(/\{[^}]*\}/g, '').replace(/\\N/g, '\n').trim();
        
        if (entry.startTime && entry.endTime && entry.text) {
          entries.push(entry as SubtitleEntry);
        }
      }
    }
  }
  
  return {
    format: 'ass',
    entries,
    metadata: {
      title: scriptInfo['Title'],
      author: scriptInfo['Original Script'],
      styles,
      scriptInfo
    }
  };
}

// ============================================================================
// AUTO-DETECT & PARSE
// ============================================================================

export function detectFormat(content: string): 'srt' | 'vtt' | 'ass' | 'ssa' | null {
  const trimmed = content.trim();
  
  if (trimmed.startsWith('WEBVTT')) {
    return 'vtt';
  }
  
  if (trimmed.includes('[Script Info]') || trimmed.includes('[V4+ Styles]') || trimmed.includes('[V4 Styles]')) {
    if (trimmed.includes('[V4+ Styles]')) {
      return 'ass';
    }
    return 'ssa';
  }
  
  // SRT: starts with number, then timestamp
  if (/^\d+\s*\n\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(trimmed)) {
    return 'srt';
  }
  
  return null;
}

export function parseSubtitles(content: string, format?: 'srt' | 'vtt' | 'ass' | 'ssa'): SubtitleFile | null {
  const detectedFormat = format || detectFormat(content);
  
  switch (detectedFormat) {
    case 'srt':
      return parseSrt(content);
    case 'vtt':
      return parseVtt(content);
    case 'ass':
    case 'ssa':
      return parseAss(content);
    default:
      return null;
  }
}

// ============================================================================
// EXPORT/SERIALIZE
// ============================================================================

export function serializeToSrt(file: SubtitleFile): string {
  return file.entries.map((entry, idx) => {
    const startTime = entry.translatedText !== undefined ? entry.startTime : msToSrtTime(entry.startMs);
    const endTime = entry.translatedText !== undefined ? entry.endTime : msToSrtTime(entry.endMs);
    const text = entry.translatedText || entry.text;
    
    return `${idx + 1}\n${startTime.replace('.', ',')} --> ${endTime.replace('.', ',')}\n${text}`;
  }).join('\n\n');
}

export function serializeToVtt(file: SubtitleFile): string {
  const lines = ['WEBVTT', ''];
  
  if (file.metadata?.language) {
    lines[0] = `WEBVTT - Language: ${file.metadata.language}`;
  }
  
  file.entries.forEach((entry, idx) => {
    const startTime = msToVttTime(entry.startMs);
    const endTime = msToVttTime(entry.endMs);
    const text = entry.translatedText || entry.text;
    
    lines.push(`${idx + 1}`);
    lines.push(`${startTime} --> ${endTime}`);
    lines.push(text);
    lines.push('');
  });
  
  return lines.join('\n');
}

export function serializeToAss(file: SubtitleFile): string {
  const lines: string[] = [];
  
  // Script Info
  lines.push('[Script Info]');
  lines.push(`Title: ${file.metadata?.title || 'Translated Subtitles'}`);
  lines.push(`Original Script: ${file.metadata?.author || 'GameStringer'}`);
  lines.push('ScriptType: v4.00+');
  lines.push('Collisions: Normal');
  lines.push('PlayDepth: 0');
  lines.push('');
  
  // Styles
  lines.push('[V4+ Styles]');
  lines.push('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding');
  
  if (file.metadata?.styles?.length) {
    for (const s of file.metadata.styles) {
      lines.push(`Style: ${s.name},${s.fontName},${s.fontSize},${s.primaryColor},${s.secondaryColor},${s.outlineColor},${s.backColor},${s.bold ? -1 : 0},${s.italic ? -1 : 0},${s.underline ? -1 : 0},${s.strikeOut ? -1 : 0},${s.scaleX},${s.scaleY},${s.spacing},${s.angle},${s.borderStyle},${s.outline},${s.shadow},${s.alignment},${s.marginL},${s.marginR},${s.marginV},${s.encoding}`);
    }
  } else {
    lines.push('Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1');
  }
  lines.push('');
  
  // Events
  lines.push('[Events]');
  lines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');
  
  for (const entry of file.entries) {
    const startTime = msToAssTime(entry.startMs);
    const endTime = msToAssTime(entry.endMs);
    const text = (entry.translatedText || entry.text).replace(/\n/g, '\\N');
    const style = entry.style || 'Default';
    const actor = entry.actor || '';
    
    lines.push(`Dialogue: 0,${startTime},${endTime},${style},${actor},${entry.marginL || 0},${entry.marginR || 0},${entry.marginV || 0},${entry.effect || ''},${text}`);
  }
  
  return lines.join('\n');
}

export function serializeSubtitles(file: SubtitleFile, outputFormat?: 'srt' | 'vtt' | 'ass'): string {
  const format = outputFormat || file.format;
  
  switch (format) {
    case 'srt':
      return serializeToSrt(file);
    case 'vtt':
      return serializeToVtt(file);
    case 'ass':
    case 'ssa':
      return serializeToAss(file);
    default:
      return serializeToSrt(file);
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Estrae solo il testo traducibile (per batch translation)
 */
export function extractTexts(file: SubtitleFile): string[] {
  return file.entries.map(e => e.text);
}

/**
 * Applica traduzioni al file
 */
export function applyTranslations(file: SubtitleFile, translations: string[]): SubtitleFile {
  return {
    ...file,
    entries: file.entries.map((entry, idx) => ({
      ...entry,
      translatedText: translations[idx] || entry.text
    }))
  };
}

/**
 * Calcola statistiche del file
 */
export function getSubtitleStats(file: SubtitleFile): {
  totalEntries: number;
  totalDuration: string;
  totalCharacters: number;
  averageCharsPerSecond: number;
  format: string;
} {
  const totalEntries = file.entries.length;
  const totalMs = file.entries.reduce((acc, e) => acc + (e.endMs - e.startMs), 0);
  const totalCharacters = file.entries.reduce((acc, e) => acc + e.text.length, 0);
  const totalSeconds = totalMs / 1000;
  
  return {
    totalEntries,
    totalDuration: msToSrtTime(totalMs),
    totalCharacters,
    averageCharsPerSecond: totalSeconds > 0 ? Math.round(totalCharacters / totalSeconds * 10) / 10 : 0,
    format: file.format.toUpperCase()
  };
}

/**
 * Valida se i sottotitoli hanno problemi comuni
 */
export function validateSubtitles(file: SubtitleFile): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < file.entries.length; i++) {
    const entry = file.entries[i];
    const duration = entry.endMs - entry.startMs;
    const cps = entry.text.length / (duration / 1000);
    
    // Durata troppo corta
    if (duration < 500) {
      warnings.push(`#${entry.id}: Durata troppo breve (${duration}ms)`);
    }
    
    // Troppi caratteri per secondo (difficile da leggere)
    if (cps > 25) {
      warnings.push(`#${entry.id}: Troppi caratteri/sec (${cps.toFixed(1)} CPS)`);
    }
    
    // Overlap con il successivo
    if (i < file.entries.length - 1) {
      const next = file.entries[i + 1];
      if (entry.endMs > next.startMs) {
        warnings.push(`#${entry.id}: Overlap con #${next.id}`);
      }
    }
    
    // Testo vuoto
    if (!entry.text.trim()) {
      errors.push(`#${entry.id}: Testo vuoto`);
    }
    
    // Timestamp invalidi
    if (entry.startMs >= entry.endMs) {
      errors.push(`#${entry.id}: Timestamp invalidi (start >= end)`);
    }
  }
  
  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
}
