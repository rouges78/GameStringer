/**
 * Translation Fixer
 * Rileva e corregge problemi comuni nelle traduzioni di giochi
 * come tag di markup visibili, placeholder corrotti, encoding errato
 */

export interface TranslationIssue {
  id: string;
  type: IssueType;
  severity: 'warning' | 'error' | 'info';
  originalText: string;
  problematicPart: string;
  suggestedFix: string;
  autoFixable: boolean;
  file?: string;
  line?: number;
}

export type IssueType = 
  | 'markup_tag_visible'      // Tag come <sprite>, <color>, <size> visibili
  | 'placeholder_corrupted'   // Placeholder {0}, %s corrotti
  | 'encoding_error'          // Caratteri illeggibili
  | 'untranslated_mixed'      // Mix di testo tradotto e non
  | 'html_entity'             // &nbsp; &amp; visibili
  | 'escape_sequence'         // \n \t visibili come testo
  | 'rpgmaker_tag'           // Tag RPG Maker specifici
  | 'unity_richtext'         // Tag Unity Rich Text
  | 'unreal_format';         // Tag Unreal {variabile}

export interface FixerConfig {
  autoFixMarkupTags: boolean;
  autoFixPlaceholders: boolean;
  autoFixEncoding: boolean;
  preserveOriginalBackup: boolean;
  xunityConfigPath?: string;
}

// Pattern per rilevare vari tipi di tag problematici
const MARKUP_PATTERNS: { pattern: RegExp; type: IssueType; description: string }[] = [
  // RPG Maker MV/MZ tags
  { pattern: /<indice\s+sprite=\d+[^>]*>/gi, type: 'rpgmaker_tag', description: 'Tag sprite RPG Maker' },
  { pattern: /<tinta=[^>]+>/gi, type: 'rpgmaker_tag', description: 'Tag tinta RPG Maker' },
  { pattern: /<colore=[^>]+>/gi, type: 'rpgmaker_tag', description: 'Tag colore RPG Maker' },
  { pattern: /<dimensione=[^>]+>/gi, type: 'rpgmaker_tag', description: 'Tag dimensione RPG Maker' },
  { pattern: /\\C\[\d+\]/gi, type: 'rpgmaker_tag', description: 'Codice colore RPG Maker' },
  { pattern: /\\I\[\d+\]/gi, type: 'rpgmaker_tag', description: 'Codice icona RPG Maker' },
  { pattern: /\\V\[\d+\]/gi, type: 'rpgmaker_tag', description: 'Codice variabile RPG Maker' },
  { pattern: /\\N\[\d+\]/gi, type: 'rpgmaker_tag', description: 'Codice nome RPG Maker' },
  
  // Unity Rich Text
  { pattern: /<color=[^>]+>/gi, type: 'unity_richtext', description: 'Tag colore Unity' },
  { pattern: /<size=\d+>/gi, type: 'unity_richtext', description: 'Tag dimensione Unity' },
  { pattern: /<b>|<\/b>|<i>|<\/i>/gi, type: 'unity_richtext', description: 'Tag stile Unity' },
  { pattern: /<sprite[^>]*>/gi, type: 'unity_richtext', description: 'Tag sprite Unity' },
  
  // Unreal Engine
  { pattern: /\{[A-Za-z_][A-Za-z0-9_]*\}/g, type: 'unreal_format', description: 'Placeholder Unreal' },
  
  // HTML entities
  { pattern: /&[a-z]+;/gi, type: 'html_entity', description: 'Entità HTML' },
  { pattern: /&#\d+;/g, type: 'html_entity', description: 'Entità HTML numerica' },
  
  // Escape sequences visibili
  { pattern: /\\n(?![a-z\[])/g, type: 'escape_sequence', description: 'Newline visibile' },
  { pattern: /\\t/g, type: 'escape_sequence', description: 'Tab visibile' },
  { pattern: /\\r/g, type: 'escape_sequence', description: 'Carriage return visibile' },
  
  // Placeholder comuni
  { pattern: /%[sdifx]/gi, type: 'placeholder_corrupted', description: 'Placeholder printf' },
  { pattern: /\{(\d+)\}/g, type: 'placeholder_corrupted', description: 'Placeholder numerico' },
];

/**
 * Analizza un testo e rileva problemi
 */
export function detectIssues(text: string, file?: string, line?: number): TranslationIssue[] {
  const issues: TranslationIssue[] = [];
  
  for (const { pattern, type, description } of MARKUP_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern.source, pattern.flags));
    
    for (const match of matches) {
      issues.push({
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type,
        severity: type === 'encoding_error' ? 'error' : 'warning',
        originalText: text,
        problematicPart: match[0],
        suggestedFix: getSuggestedFix(type, match[0]),
        autoFixable: isAutoFixable(type),
        file,
        line,
      });
    }
  }
  
  // Rileva problemi di encoding
  if (/[�□■◆]/.test(text)) {
    issues.push({
      id: `${Date.now()}_encoding`,
      type: 'encoding_error',
      severity: 'error',
      originalText: text,
      problematicPart: text.match(/[�□■◆]+/)?.[0] || '',
      suggestedFix: 'Verifica encoding file (UTF-8 raccomandato)',
      autoFixable: false,
      file,
      line,
    });
  }
  
  return issues;
}

/**
 * Suggerisce fix basato sul tipo di problema
 */
function getSuggestedFix(type: IssueType, match: string): string {
  switch (type) {
    case 'rpgmaker_tag':
      return `Configura XUnity per ignorare tag RPG Maker. Aggiungi a config: IgnoreTextStartingWith=<`;
    case 'unity_richtext':
      return `Configura XUnity: RichTextSupport=True oppure ignora il tag`;
    case 'unreal_format':
      return `Mantieni il placeholder ${match} nella traduzione`;
    case 'html_entity':
      return `Converti entità HTML: ${match} → ${decodeHTMLEntity(match)}`;
    case 'escape_sequence':
      return `Converti escape sequence a carattere reale`;
    case 'placeholder_corrupted':
      return `Mantieni il placeholder ${match} intatto nella traduzione`;
    default:
      return 'Verifica manualmente';
  }
}

/**
 * Controlla se il problema è risolvibile automaticamente
 */
function isAutoFixable(type: IssueType): boolean {
  return ['html_entity', 'escape_sequence'].includes(type);
}

/**
 * Decodifica entità HTML
 */
function decodeHTMLEntity(entity: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
  };
  return entities[entity.toLowerCase()] || entity;
}

/**
 * Genera configurazione XUnity per ignorare tag problematici
 */
export function generateXUnityConfig(issues: TranslationIssue[]): string {
  const tagTypes = new Set(issues.map(i => i.type));
  
  let config = `; GameStringer Auto-Generated XUnity Config Fix
; Generato per risolvere problemi di tag visibili

[Behaviour]
`;

  if (tagTypes.has('rpgmaker_tag') || tagTypes.has('unity_richtext')) {
    config += `; Ignora stringhe che iniziano con tag
IgnoreTextStartingWith=<,[,{,\\

; Regex per escludere tag di markup
RegexToExclude=<[^>]+>|\\\\[A-Z]\\[\\d+\\]
`;
  }

  config += `
[TextFramework]
; Rimuovi whitespace extra
WhitespaceRemovalStrategy=TrimPerNewline
IgnoreWhitespaceInDialogue=True
`;

  if (tagTypes.has('unity_richtext')) {
    config += `
; Supporto Rich Text Unity
RichTextSupport=True
`;
  }

  config += `
[Service]
; Fallback per traduzioni mancanti
FallbackToOriginalText=True

[Debug]
; Log per debug
EnableConsole=False
`;

  return config;
}

/**
 * Genera patch per file di traduzione
 */
export function generateTranslationPatch(
  originalText: string, 
  issues: TranslationIssue[]
): string {
  let fixed = originalText;
  
  for (const issue of issues) {
    if (issue.autoFixable) {
      switch (issue.type) {
        case 'html_entity':
          fixed = fixed.replace(issue.problematicPart, decodeHTMLEntity(issue.problematicPart));
          break;
        case 'escape_sequence':
          fixed = fixed
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r');
          break;
      }
    }
  }
  
  return fixed;
}

/**
 * Analizza file di traduzione e rileva tutti i problemi
 */
export function analyzeTranslationFile(content: string, filename: string): {
  totalLines: number;
  issuesFound: number;
  issues: TranslationIssue[];
  summary: Record<IssueType, number>;
} {
  const lines = content.split('\n');
  const allIssues: TranslationIssue[] = [];
  const summary: Record<IssueType, number> = {
    markup_tag_visible: 0,
    placeholder_corrupted: 0,
    encoding_error: 0,
    untranslated_mixed: 0,
    html_entity: 0,
    escape_sequence: 0,
    rpgmaker_tag: 0,
    unity_richtext: 0,
    unreal_format: 0,
  };
  
  lines.forEach((line, index) => {
    const issues = detectIssues(line, filename, index + 1);
    allIssues.push(...issues);
    issues.forEach(issue => {
      summary[issue.type]++;
    });
  });
  
  return {
    totalLines: lines.length,
    issuesFound: allIssues.length,
    issues: allIssues,
    summary,
  };
}

/**
 * Suggerimenti specifici per gioco
 */
export const GAME_SPECIFIC_FIXES: Record<string, {
  description: string;
  configSnippet: string;
  instructions: string[];
}> = {
  'rpgmaker_mv': {
    description: 'RPG Maker MV/MZ con plugin custom',
    configSnippet: `[Behaviour]
IgnoreTextStartingWith=<,\\
RegexToExclude=<[^>]+>|\\\\[CIVSN]\\[\\d+\\]

[TextFramework]
WhitespaceRemovalStrategy=TrimPerNewline`,
    instructions: [
      'Apri BepInEx/config/AutoTranslatorConfig.ini',
      'Aggiungi le righe sopra nella sezione appropriata',
      'Riavvia il gioco',
    ],
  },
  'unity_generic': {
    description: 'Giochi Unity con Rich Text',
    configSnippet: `[Behaviour]
RichTextSupport=True
IgnoreTextStartingWith=<

[TextFramework]
EnableRichText=True`,
    instructions: [
      'Apri BepInEx/config/AutoTranslatorConfig.ini',
      'Imposta RichTextSupport=True',
      'Riavvia il gioco',
    ],
  },
  'renpy': {
    description: "Giochi Ren'Py",
    configSnippet: `# Non applicabile - Ren'Py usa sistema traduzioni interno`,
    instructions: [
      'Usa il sistema di traduzioni nativo di Ren\'Py',
      'Crea cartella game/tl/italian/',
      'Genera file con renpy.exe --compile',
    ],
  },
};

/**
 * Rileva il tipo di gioco dai problemi trovati
 */
export function detectGameType(issues: TranslationIssue[]): string {
  const types = issues.map(i => i.type);
  
  if (types.includes('rpgmaker_tag')) {
    return 'rpgmaker_mv';
  }
  if (types.includes('unity_richtext')) {
    return 'unity_generic';
  }
  
  return 'unknown';
}
