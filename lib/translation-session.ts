/**
 * Translation Session Manager
 * Gestisce checkpoint, resume, statistiche e backup incrementale
 */

import { invoke } from '@tauri-apps/api/core';

/** Statistiche di una sessione di traduzione */
export interface TranslationStats {
  startTime: number;
  endTime?: number;
  totalStrings: number;
  translatedStrings: number;
  failedStrings: number;
  skippedStrings: number;
  /** Breakdown per provider: quante stringhe ha tradotto ciascuno */
  providerUsage: Record<string, number>;
  /** Costo stimato in USD */
  estimatedCost: number;
  /** Caratteri totali tradotti */
  totalChars: number;
  /** Token totali stimati */
  totalTokens: number;
  /** Velocità media (stringhe/secondo) */
  avgSpeed: number;
  /** Chain preset usato */
  chainPreset: string;
  /** Lingua sorgente */
  sourceLang: string;
  /** Lingua target */
  targetLang: string;
  /** Nome del gioco */
  gameName: string;
}

/** Checkpoint per resume traduzione */
export interface TranslationCheckpoint {
  version: 1;
  gamePath: string;
  gameName: string;
  createdAt: number;
  updatedAt: number;
  /** Indice del prossimo batch da tradurre (i nel loop) */
  nextBatchIndex: number;
  /** Batch size usato */
  batchSize: number;
  /** Dialoghi con traduzioni parziali */
  dialogues: Array<{
    id: string;
    speaker: string;
    original: string;
    translated: string;
    file: string;
    line_index: number;
  }>;
  /** Stringhe totali dopo filtro */
  totalFiltered: number;
  /** Statistiche parziali */
  stats: TranslationStats;
}

/** Risultato validazione post-traduzione */
export interface ValidationResult {
  totalChecked: number;
  issues: ValidationIssue[];
  score: number; // 0-100
}

export interface ValidationIssue {
  index: number;
  original: string;
  translated: string;
  type: 'length_ratio' | 'missing_variable' | 'identical' | 'encoding' | 'empty' | 'truncated';
  severity: 'error' | 'warning';
  message: string;
}

/** Voce glossario */
export interface GlossaryEntry {
  source: string;
  target: string;
  context?: string;
  caseSensitive?: boolean;
}

/** Glossario per-gioco */
export interface GameGlossary {
  gameId: string;
  gameName: string;
  sourceLang: string;
  targetLang: string;
  entries: GlossaryEntry[];
  updatedAt: number;
}

// =========== CHECKPOINT / RESUME ===========

const CHECKPOINT_FILENAME = 'translation_checkpoint.json';

function getCheckpointPath(gamePath: string): string {
  return `${gamePath}/GameStringer_Translation/${CHECKPOINT_FILENAME}`;
}

/** Salva checkpoint (backup incrementale) */
export async function saveCheckpoint(checkpoint: TranslationCheckpoint): Promise<void> {
  checkpoint.updatedAt = Date.now();
  try {
    await invoke('write_text_file', {
      path: getCheckpointPath(checkpoint.gamePath),
      content: JSON.stringify(checkpoint, null, 2),
    });
  } catch (err) {
    console.warn('[Checkpoint] Errore salvataggio:', err);
  }
}

/** Carica checkpoint esistente */
export async function loadCheckpoint(gamePath: string): Promise<TranslationCheckpoint | null> {
  try {
    const content = await invoke<string>('read_text_file', {
      path: getCheckpointPath(gamePath),
    });
    const cp = JSON.parse(content) as TranslationCheckpoint;
    if (cp.version === 1 && cp.dialogues?.length > 0) {
      return cp;
    }
    return null;
  } catch {
    return null;
  }
}

/** Verifica se esiste un checkpoint */
export async function hasCheckpoint(gamePath: string): Promise<boolean> {
  const cp = await loadCheckpoint(gamePath);
  return cp !== null;
}

/** Elimina checkpoint (traduzione completata) — sovrascrive con oggetto vuoto */
export async function clearCheckpoint(gamePath: string): Promise<void> {
  try {
    await invoke('write_text_file', {
      path: getCheckpointPath(gamePath),
      content: '{}',
    });
  } catch {
    // Ignora
  }
}

// =========== STATISTICHE ===========

/** Crea statistiche iniziali */
export function createStats(opts: {
  totalStrings: number;
  chainPreset: string;
  sourceLang: string;
  targetLang: string;
  gameName: string;
}): TranslationStats {
  return {
    startTime: Date.now(),
    totalStrings: opts.totalStrings,
    translatedStrings: 0,
    failedStrings: 0,
    skippedStrings: 0,
    providerUsage: {},
    estimatedCost: 0,
    totalChars: 0,
    totalTokens: 0,
    avgSpeed: 0,
    chainPreset: opts.chainPreset,
    sourceLang: opts.sourceLang,
    targetLang: opts.targetLang,
    gameName: opts.gameName,
  };
}

/** Aggiorna statistiche dopo un batch tradotto */
export function updateStats(
  stats: TranslationStats,
  provider: string,
  translatedCount: number,
  chars: number
): TranslationStats {
  const updated = { ...stats };
  updated.translatedStrings += translatedCount;
  updated.totalChars += chars;
  updated.totalTokens = Math.ceil(updated.totalChars / 4);
  updated.providerUsage[provider] = (updated.providerUsage[provider] || 0) + translatedCount;
  
  const elapsed = (Date.now() - updated.startTime) / 1000;
  updated.avgSpeed = elapsed > 0 ? updated.translatedStrings / elapsed : 0;
  
  // Stima costo basata su provider
  const costPerMToken: Record<string, number> = {
    gemini: 0.375, groq: 0.10, deepseek: 0.42, openai: 2.0,
    anthropic: 1.50, cerebras: 0.10, mistral: 0.55, cohere: 0.50,
    together: 0.30, fireworks: 0.20, openrouter: 0.50, deepl: 5.0,
    translategemma: 0, hymt: 0, mymemory: 0, lingva: 0,
  };
  const rate = costPerMToken[provider] || 0.50;
  updated.estimatedCost += (chars / 4 / 1_000_000) * rate * 2; // input + output
  
  return updated;
}

/** Finalizza statistiche */
export function finalizeStats(stats: TranslationStats): TranslationStats {
  return {
    ...stats,
    endTime: Date.now(),
    avgSpeed: stats.translatedStrings / Math.max((Date.now() - stats.startTime) / 1000, 1),
  };
}

/** Formatta durata in MM:SS */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/** Formatta costo */
export function formatCost(usd: number): string {
  if (usd === 0) return 'Gratuito';
  if (usd < 0.01) return '< $0.01';
  return `~$${usd.toFixed(2)}`;
}

// =========== VALIDAZIONE ===========

/** Valida traduzioni post-completamento */
export function validateTranslations(
  dialogues: Array<{ original: string; translated: string }>
): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < dialogues.length; i++) {
    const { original, translated } = dialogues[i];

    // Stringa vuota
    if (!translated || translated.trim() === '') {
      issues.push({
        index: i, original, translated,
        type: 'empty', severity: 'error',
        message: 'Traduzione vuota',
      });
      continue;
    }

    // Identica all'originale
    if (translated.trim() === original.trim()) {
      issues.push({
        index: i, original, translated,
        type: 'identical', severity: 'warning',
        message: 'Traduzione identica all\'originale',
      });
    }

    // Ratio lunghezza anomala (traduzione > 3x o < 0.2x dell'originale)
    const ratio = translated.length / Math.max(original.length, 1);
    if (ratio > 3.0) {
      issues.push({
        index: i, original, translated,
        type: 'length_ratio', severity: 'warning',
        message: `Traduzione troppo lunga (${Math.round(ratio * 100)}% dell'originale)`,
      });
    } else if (ratio < 0.2 && original.length > 10) {
      issues.push({
        index: i, original, translated,
        type: 'length_ratio', severity: 'warning',
        message: `Traduzione troppo corta (${Math.round(ratio * 100)}% dell'originale)`,
      });
    }

    // Variabili mancanti ({0}, %s, %d, {name}, etc.)
    const varPatterns = [
      /\{(\d+|[a-zA-Z_]+)\}/g,  // {0}, {name}
      /%[sd]/g,                   // %s, %d
      /\$\{[^}]+\}/g,            // ${var}
      /\\n/g,                     // \n newlines
      /<[^>]+>/g,                 // <tags>
    ];

    for (const pattern of varPatterns) {
      const origVars: string[] = original.match(pattern) || [];
      const transVars: string[] = translated.match(pattern) || [];

      for (const v of origVars) {
        if (!transVars.includes(v)) {
          issues.push({
            index: i, original, translated,
            type: 'missing_variable', severity: 'error',
            message: `Variabile mancante: ${v}`,
          });
          break; // Una sola segnalazione per stringa
        }
      }
    }

    // Troncamento (traduzione che finisce con ... quando l'originale no)
    if (translated.endsWith('...') && !original.endsWith('...') && translated.length > 20) {
      issues.push({
        index: i, original, translated,
        type: 'truncated', severity: 'warning',
        message: 'Possibile troncamento (termina con ...)',
      });
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const score = Math.max(0, Math.round(100 - (errorCount * 5) - (warningCount * 1)));

  return {
    totalChecked: dialogues.length,
    issues,
    score,
  };
}

// =========== GLOSSARIO ===========

const GLOSSARY_STORAGE_KEY = 'gs_glossaries';

/** Carica tutti i glossari */
export function loadGlossaries(): Record<string, GameGlossary> {
  try {
    const raw = localStorage.getItem(GLOSSARY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Salva glossario per un gioco */
export function saveGlossary(glossary: GameGlossary): void {
  const all = loadGlossaries();
  all[glossary.gameId] = glossary;
  localStorage.setItem(GLOSSARY_STORAGE_KEY, JSON.stringify(all));
}

/** Carica glossario per un gioco */
export function loadGlossary(gameId: string): GameGlossary | null {
  const all = loadGlossaries();
  return all[gameId] || null;
}

/** Applica glossario a un array di testi prima della traduzione */
export function applyGlossaryToPrompt(
  texts: string[],
  glossary: GameGlossary | null
): { texts: string[]; glossaryHint: string } {
  if (!glossary || glossary.entries.length === 0) {
    return { texts, glossaryHint: '' };
  }

  // Genera hint per il prompt AI
  const lines = glossary.entries.map(e => `"${e.source}" → "${e.target}"`);
  const glossaryHint = `GLOSSARIO (usa SEMPRE questi termini):\n${lines.join('\n')}`;

  return { texts, glossaryHint };
}

/** Glossario di default per giochi comuni */
export function getDefaultGlossaryEntries(genre?: string): GlossaryEntry[] {
  const common: GlossaryEntry[] = [
    { source: 'Save', target: 'Salva' },
    { source: 'Load', target: 'Carica' },
    { source: 'Settings', target: 'Impostazioni' },
    { source: 'Quit', target: 'Esci' },
    { source: 'New Game', target: 'Nuova Partita' },
    { source: 'Continue', target: 'Continua' },
  ];

  if (genre === 'RPG') {
    return [
      ...common,
      { source: 'HP', target: 'PV', context: 'Hit Points → Punti Vita' },
      { source: 'MP', target: 'PM', context: 'Magic Points → Punti Mana' },
      { source: 'XP', target: 'PE', context: 'Experience → Punti Esperienza' },
      { source: 'Guild', target: 'Gilda' },
      { source: 'Quest', target: 'Missione' },
      { source: 'Dungeon', target: 'Dungeon', context: 'Non tradurre' },
      { source: 'Party', target: 'Gruppo' },
      { source: 'Inventory', target: 'Inventario' },
    ];
  }

  if (genre === 'VN') {
    return [
      ...common,
      { source: 'Chapter', target: 'Capitolo' },
      { source: 'Auto', target: 'Auto' },
      { source: 'Skip', target: 'Salta' },
      { source: 'Log', target: 'Cronologia' },
      { source: 'Backlog', target: 'Cronologia' },
    ];
  }

  return common;
}

// =========== EXPORT ===========

/** Esporta traduzioni in formato .po (GNU gettext) */
export function exportToPO(
  dialogues: Array<{ original: string; translated: string; file?: string }>,
  targetLang: string,
  gameName: string
): string {
  const header = [
    `# ${gameName} — Translation by GameStringer`,
    `# Generated: ${new Date().toISOString()}`,
    `msgid ""`,
    `msgstr ""`,
    `"Content-Type: text/plain; charset=UTF-8\\n"`,
    `"Content-Transfer-Encoding: 8bit\\n"`,
    `"Language: ${targetLang}\\n"`,
    `"MIME-Version: 1.0\\n"`,
    ``,
  ].join('\n');

  const entries = dialogues.map((d, i) => {
    const comment = d.file ? `#: ${d.file}:${i}` : `#: string:${i}`;
    const msgid = d.original.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const msgstr = d.translated.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `${comment}\nmsgid "${msgid}"\nmsgstr "${msgstr}"`;
  }).join('\n\n');

  return header + '\n' + entries;
}

/** Esporta traduzioni in formato CSV */
export function exportToCSV(
  dialogues: Array<{ id?: string; original: string; translated: string; speaker?: string; file?: string }>
): string {
  const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
  const header = 'ID,Speaker,Original,Translated,File';
  const rows = dialogues.map((d, i) =>
    [escape(d.id || String(i)), escape(d.speaker || ''), escape(d.original), escape(d.translated), escape(d.file || '')].join(',')
  );
  return header + '\n' + rows.join('\n');
}

/** Esporta traduzioni in formato XLIFF 1.2 */
export function exportToXLIFF(
  dialogues: Array<{ id?: string; original: string; translated: string }>,
  sourceLang: string,
  targetLang: string,
  gameName: string
): string {
  const units = dialogues.map((d, i) => {
    const id = d.id || `s${i}`;
    const src = escapeXml(d.original);
    const tgt = escapeXml(d.translated);
    return `      <trans-unit id="${id}">\n        <source>${src}</source>\n        <target>${tgt}</target>\n      </trans-unit>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="${sourceLang}" target-language="${targetLang}" datatype="plaintext" original="${escapeXml(gameName)}">
    <header>
      <tool tool-id="GameStringer" tool-name="GameStringer" tool-version="1.0" />
    </header>
    <body>
${units}
    </body>
  </file>
</xliff>`;
}

/** Esporta traduzioni in formato RESX (.NET) */
export function exportToRESX(
  dialogues: Array<{ id?: string; original: string; translated: string }>
): string {
  const entries = dialogues.map((d, i) => {
    const name = escapeXml(d.id || `String${i}`);
    const value = escapeXml(d.translated);
    const comment = escapeXml(d.original);
    return `  <data name="${name}" xml:space="preserve">\n    <value>${value}</value>\n    <comment>${comment}</comment>\n  </data>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <resheader name="resmimetype"><value>text/microsoft-resx</value></resheader>
  <resheader name="version"><value>2.0</value></resheader>
  <resheader name="reader"><value>System.Resources.ResXResourceReader</value></resheader>
  <resheader name="writer"><value>System.Resources.ResXResourceWriter</value></resheader>
${entries}
</root>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
