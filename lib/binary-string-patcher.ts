/**
 * Binary String Patcher
 * 
 * Estrae stringhe leggibili da binari di gioco (.exe, .dll),
 * permette la traduzione e crea copie patchate.
 * 
 * Funzionalità:
 * - Estrazione stringhe UTF-8/ASCII con offset dal binario
 * - Filtro intelligente: separa testo di gioco da noise (debug, engine, librerie)
 * - Rilevamento lingua sorgente (EN, ES, DE, FR, PT, etc.)
 * - Traduzione rule-based ES↔IT / EN↔IT con dizionario gaming
 * - Vincolo lunghezza byte: traduzioni stessa dimensione dell'originale
 * - Rilevamento anti-cheat prima del patch
 * - Backup automatico + applicazione patch
 * - Import/Export progetto di traduzione (JSON)
 */

// ============================================================
// Types
// ============================================================

export interface BinaryString {
  offset: number;
  byteLen: number;
  original: string;
  translated?: string;
  language?: string;
  category?: 'gameplay' | 'ui' | 'item' | 'enemy' | 'ability' | 'stat' | 'dialogue' | 'debug' | 'engine' | 'unknown';
  isTranslated?: boolean;
}

export interface PatchProject {
  version: 1;
  gameName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileHash?: string;
  sourceLang: string;
  targetLang: string;
  strings: BinaryString[];
  createdAt: string;
  updatedAt: string;
}

export interface AntiCheatResult {
  safe: boolean;
  detected: string[];
  warnings: string[];
}

export interface ExtractionOptions {
  minLength?: number;
  includeUtf8?: boolean;
  filterNoise?: boolean;
  detectLanguage?: boolean;
}

export interface PatchResult {
  success: boolean;
  patchedCount: number;
  skippedCount: number;
  errors: string[];
  outputPath: string;
  backupPath?: string;
  patchedBuffer?: Uint8Array;
}

// ============================================================
// Anti-Cheat Detection
// ============================================================

const ANTICHEAT_SIGNATURES = [
  { name: 'EasyAntiCheat', files: ['EasyAntiCheat', 'eac_launcher', 'EasyAntiCheat.sys'] },
  { name: 'BattlEye', files: ['BEService', 'BEClient', 'BattlEye'] },
  { name: 'Valve Anti-Cheat', files: ['vac.dll', 'steamservice.dll'] },
  { name: 'nProtect GameGuard', files: ['GameGuard', 'nProtect', 'npgg'] },
  { name: 'PunkBuster', files: ['PunkBuster', 'pbsvc', 'PnkBstrA'] },
  { name: 'Denuvo', files: ['denuvo', 'Denuvo'] },
  { name: 'Arxan', files: ['arxan'] },
];

export function detectAntiCheat(fileList: string[]): AntiCheatResult {
  const detected: string[] = [];
  const warnings: string[] = [];

  for (const sig of ANTICHEAT_SIGNATURES) {
    for (const pattern of sig.files) {
      if (fileList.some(f => f.toLowerCase().includes(pattern.toLowerCase()))) {
        detected.push(sig.name);
        break;
      }
    }
  }

  // Steam API è normale, ma avvisiamo
  if (fileList.some(f => f.includes('steam_api'))) {
    warnings.push('Steam API presente — Steam potrebbe verificare integrità file. Disattiva "Verifica integrità" nelle proprietà del gioco.');
  }

  return {
    safe: detected.length === 0,
    detected,
    warnings,
  };
}

// ============================================================
// Noise Detection — filtra stringhe non di gioco
// ============================================================

const NOISE_PATTERNS = [
  // Engine / Runtime
  /^(Failed|Error|Warning|Assert|Cannot|Could not|Unable to)/i,
  /\.(dll|exe|pdb|obj|lib|hlsl|glsl|cso|fxc|png|jpg|wav|ogg|mp3|ttf|otf)$/i,
  /(shader|Shader|SHADER|compile|Compil|linker|LINKER)/,
  /(buffer|Buffer|BUFFER|framebuffer|rendertarget)/i,
  /(Window|WINDOW|HWND|CreateWindow|RegisterClass)/,
  /(monitor|Monitor|MONITOR|GetMonitor|EnumDisplay)/,
  /(malloc|calloc|realloc|free|alloc|dealloc|heap)/,
  /(fopen|fclose|fread|fwrite|fprintf|printf|sprintf|sscanf)/,
  /(assert|ASSERT|__FILE__|__LINE__|__FUNCTION__)/,
  /(mutex|Mutex|CRITICAL_SECTION|semaphore)/,
  /(socket|Socket|SOCKET|WSA|recv|send|connect)/,
  /api-ms-win|kernel32|ntdll|user32|gdi32|advapi32|ole32/i,
  /GetProcAddress|LoadLibrary|FreeLibrary|GetModuleHandle/,
  /Visual C|Runtime|CRT|MSVC|__crt|__scrt/,
  /(DXGI|D3D11|D3D12|OpenGL|Vulkan|DirectX)/i,
  // Image format internals
  /(IHDR|tRNS|PLTE|IDAT|IEND|JFIF|Adobe|Exif)/,
  /(huffman|zlib|deflate|inflate|PNG|JPEG|GIF89)/i,
  /(interlace|bit depth|color type|scanline|pixel format)/i,
  // Build artifacts
  /^[A-Z_]{8,}$/, // ALL_CAPS_CONSTANTS
  /^0x[0-9a-fA-F]+/,
  /^\s*[\d\.\-\+]+\s*$/,
  /\\x[0-9a-f]{2}/i,
];

function isNoiseString(s: string): boolean {
  return NOISE_PATTERNS.some(p => p.test(s));
}

// ============================================================
// Language Detection
// ============================================================

const LANG_MARKERS: Record<string, RegExp[]> = {
  es: [/[áéíóúñ¡¿]/i, /\b(los|las|del|que|con|por|para|una|puede|todos|más|muy|también|pero|cuando|este|esta)\b/i],
  de: [/[äöüß]/i, /\b(der|die|das|und|ist|ein|eine|nicht|mit|auf|für|von|werden|haben|kann|sehr|auch)\b/i],
  en: [/\b(the|and|is|are|was|with|for|that|this|from|they|have|can|will|not|but|all|been|when)\b/i],
  fr: [/[àâçèéêëîïôùûü]/i, /\b(les|des|une|est|sont|dans|pour|avec|pas|sur|tout|cette|mais|qui|que)\b/i],
  pt: [/[ãõçà]/i, /\b(são|está|para|com|uma|dos|das|não|mais|muito|também|pode|quando)\b/i],
  it: [/[àèéìòù]/i, /\b(gli|dei|delle|sono|nella|questo|anche|ogni|tutti|essere|viene|hanno|può|più)\b/i],
  ja: [/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/],
  zh: [/[\u4E00-\u9FFF]{2,}/],
  ko: [/[\uAC00-\uD7AF]/],
  ru: [/[\u0400-\u04FF]/],
};

export function detectLanguage(text: string): string {
  const scores: Record<string, number> = {};
  for (const [lang, patterns] of Object.entries(LANG_MARKERS)) {
    scores[lang] = 0;
    for (const p of patterns) {
      const matches = text.match(new RegExp(p, 'gi'));
      if (matches) scores[lang] += matches.length;
    }
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[1] > 0 ? sorted[0][0] : 'unknown';
}

// ============================================================
// String Categorization
// ============================================================

const CATEGORY_PATTERNS: Partial<Record<NonNullable<BinaryString['category']>, RegExp>> = {
  enemy: /\b(enemy|enemies|creature|monster|goblin|skeleton|zombie|rat|dragon|boss|undead|demon|orc|troll|spider|wolf|bat|ghost|slime|golem)\b/i,
  ability: /\b(ability|spell|skill|magic|cast|cooldown|mana|buff|debuff|aura|passive|active|ultimate)\b/i,
  stat: /\b(damage|health|armor|speed|range|duration|chance|resist|block|dodge|crit|attack|defense|heal|regen|bonus|multiplier|reduction)\b/i,
  item: /\b(sword|shield|ring|amulet|bow|staff|armor|helmet|boots|gloves|potion|scroll|gem|weapon|equip|inventory|slot)\b/i,
  ui: /\b(save|load|quit|exit|start|continue|restart|settings|options|menu|pause|resume|play|shop|store|buy|sell|upgrade|level|score|victory|defeat|tutorial)\b/i,
  dialogue: /["""]|said|says|\.\.\./,
  gameplay: /\b(wave|round|spawn|path|tower|defend|summon|unlock|deploy|place|build)\b/i,
};

function categorizeString(s: string): BinaryString['category'] {
  for (const [cat, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(s)) return cat as BinaryString['category'];
  }
  return 'unknown';
}

// ============================================================
// Core: String Extraction from Binary Buffer
// ============================================================

export function extractStringsFromBuffer(
  buffer: Uint8Array,
  options: ExtractionOptions = {}
): BinaryString[] {
  const {
    minLength = 8,
    includeUtf8 = true,
    filterNoise = true,
    detectLanguage: doDetectLang = true,
  } = options;

  const strings: BinaryString[] = [];
  let i = 0;
  const len = buffer.length;

  while (i < len) {
    const start = i;
    const chars: number[] = [];

    while (i < len) {
      const b = buffer[i];
      // ASCII printable
      if (b >= 0x20 && b <= 0x7E) {
        chars.push(b);
        i++;
      }
      // UTF-8 2-byte (accenti, diacritici)
      else if (includeUtf8 && b >= 0xC0 && b <= 0xDF && i + 1 < len && (buffer[i + 1] & 0xC0) === 0x80) {
        chars.push(b, buffer[i + 1]);
        i += 2;
      }
      // UTF-8 3-byte (CJK, etc.)
      else if (includeUtf8 && b >= 0xE0 && b <= 0xEF && i + 2 < len && (buffer[i + 1] & 0xC0) === 0x80 && (buffer[i + 2] & 0xC0) === 0x80) {
        chars.push(b, buffer[i + 1], buffer[i + 2]);
        i += 3;
      }
      else break;
    }

    const byteLen = chars.length;
    if (byteLen >= minLength) {
      const text = new TextDecoder('utf-8').decode(new Uint8Array(chars));

      // Deve contenere lettere minuscole (non solo simboli/numeri)
      if (/[a-z]{3,}/i.test(text) && /\s/.test(text)) {
        // Filtra noise
        if (!filterNoise || !isNoiseString(text)) {
          const entry: BinaryString = {
            offset: start,
            byteLen,
            original: text,
            category: categorizeString(text),
          };

          if (doDetectLang) {
            entry.language = detectLanguage(text);
          }

          strings.push(entry);
        }
      }
    }
    i++;
  }

  return strings;
}

// ============================================================
// Translation: Fit to byte length
// ============================================================

export function fitToByteLength(text: string, targetLen: number): string {
  const encoder = new TextEncoder();
  let buf = encoder.encode(text);

  if (buf.length === targetLen) return text;

  if (buf.length < targetLen) {
    // Pad con spazi
    const padded = new Uint8Array(targetLen);
    padded.set(buf);
    padded.fill(0x20, buf.length); // spazi
    return new TextDecoder().decode(padded);
  }

  // Tronca — taglia all'ultima parola che entra
  let s = text;
  while (encoder.encode(s).length > targetLen && s.length > 0) {
    s = s.slice(0, -1);
  }
  const diff = targetLen - encoder.encode(s).length;
  if (diff > 0) s += ' '.repeat(diff);
  return s;
}

// ============================================================
// Gaming Dictionary ES→IT (rule-based)
// ============================================================

interface TranslationRule {
  pattern: RegExp;
  replacement: string;
  priority: number; // 0=frasi, 1=tag, 2=parole, 3=preposizioni
}

function buildEsItRules(): TranslationRule[] {
  const rules: TranslationRule[] = [];
  
  // Priority 0: Frasi intere
  const phrases: [RegExp, string][] = [
    [/Se especializa en el combate cuerpo a cuerpo/g, 'Specializzato nel combattimento corpo a corpo'],
    [/Se especializa en el combate a distancia/g, 'Specializzato nel combattimento a distanza'],
    [/bolas de fuego letales/g, 'palle di fuoco letali'],
    [/bolas de fuego/g, 'palle di fuoco'],
    [/no muertos y venenosos/g, 'non-morti e velenosi'],
    [/no muertos/g, 'non-morti'],
    [/cuerpo a cuerpo/g, 'corpo a corpo'],
    [/a distancia/g, 'a distanza'],
    [/sin mente/g, 'senza mente'],
    [/bajo tierra/g, 'sottoterra'],
    [/de hielo puro/g, 'di ghiaccio puro'],
    [/de hielo/g, 'di ghiaccio'],
    [/de fuego/g, 'di fuoco'],
    [/de sangre/g, 'di sangue'],
  ];
  phrases.forEach(([p, r]) => rules.push({ pattern: p, replacement: r, priority: 0 }));

  // Priority 1: Tag expressions
  const tags: [RegExp, string][] = [
    [/\{b,inmunes al Daño de Frío\}/g, '{b,immuni al Danno da Gelo}'],
    [/\{b,Inmunes al Daño de Frío\}/g, '{b,Immuni al Danno da Gelo}'],
    [/\{b,Inmune al Daño de Frío\}/g, '{b,Immune al Danno da Gelo}'],
    [/\{b,Daño Mágico\}/g, '{b,Danno Magico}'],
    [/\{G,Armadura\}/g, '{G,Armatura}'],
    [/\{G,Daño Físico\}/g, '{G,Danno Fisico}'],
    [/\{r,Fuego\}/g, '{r,Fuoco}'],
    [/\{B,Frío\}/g, '{B,Gelo}'],
    [/\{b,Rayo\}/g, '{b,Fulmine}'],
    [/\{g,Veneno\}/g, '{g,Veleno}'],
    [/\{o,Naranjas\}/g, '{o,Arance}'],
    [/\{g,curar\}/g, '{g,curare}'],
    [/\{y,Proyectil\}/g, '{y,Proiettile}'],
    [/\{y,Habilidad\}/g, '{y,Abilità}'],
    [/\{y,Habilidades\}/g, '{y,Abilità}'],
    [/\{y,Daño\}/g, '{y,Danno}'],
    [/\{y,Objetivos\}/g, '{y,Bersagli}'],
  ];
  tags.forEach(([p, r]) => rules.push({ pattern: p, replacement: r, priority: 1 }));

  // Priority 2: Parole (sostantivi, verbi, aggettivi)
  const words: [string, string][] = [
    // Unità / Nomi
    ['Murciélago', 'Pipistrello'], ['Arquero', 'Arciere'], ['Esqueletos', 'Scheletri'],
    ['Esqueleto', 'Scheletro'], ['Chamán', 'Sciamano'], ['Nigromante', 'Negromante'],
    ['Caballero', 'Cavaliere'], ['Albóndiga', 'Polpetta'],
    // Sostantivi
    ['enemigos', 'nemici'], ['enemigo', 'nemico'], ['Enemigos', 'Nemici'],
    ['Defensores', 'Difensori'], ['Defensor', 'Difensore'],
    ['Héroes', 'Eroi'], ['Héroe', 'Eroe'], ['héroes', 'eroi'],
    ['Criaturas', 'Creature'], ['criaturas', 'creature'],
    ['aliados', 'alleati'], ['guerreros', 'guerrieri'], ['guerrero', 'guerriero'],
    ['objetivos', 'bersagli'], ['monstruo', 'mostro'], ['Monstruo', 'Mostro'],
    ['cofres', 'forzieri'], ['dientes', 'denti'], ['garras', 'artigli'],
    ['Proyectiles', 'Proiettili'], ['Proyectil', 'Proiettile'],
    ['hechizos', 'incantesimi'], ['escudo', 'scudo'], ['Escudo', 'Scudo'],
    ['veneno', 'veleno'], ['Veneno', 'Veleno'],
    ['Daño', 'Danno'], ['daño', 'danno'],
    ['Frío', 'Gelo'], ['frío', 'gelo'],
    ['Rayo', 'Fulmine'], ['Escarcha', 'Brina'],
    ['Sangrado', 'Emorragia'], ['armadura', 'armatura'],
    ['salud', 'salute'], ['Naranjas', 'Arance'],
    ['mejoras', 'migliorie'], ['mejora', 'miglioria'],
    ['nivel', 'livello'], ['Nivel', 'Livello'],
    ['Velocidad', 'Velocita'], ['Habilidad', 'Abilita'],
    ['Duración', 'Durata'], ['Probabilidad', 'Probabilita'],
    ['Efecto', 'Effetto'], ['Efectos', 'Effetti'],
    ['Alcance', 'Gittata'], ['Ataque', 'Attacco'],
    ['Bloqueo', 'Blocco'], ['Esquivar', 'Schivata'],
    ['Hielo', 'Ghiaccio'], ['hielo', 'ghiaccio'],
    ['Fuego', 'Fuoco'], ['fuego', 'fuoco'],
    ['Árbol', 'Albero'],
    ['Anillo', 'Anello'], ['Esmeralda', 'Smeraldo'],
    ['Hierro', 'Ferro'], ['Acero', 'Acciaio'],
    // Verbi
    ['atacar', 'attaccare'], ['atacan', 'attaccano'],
    ['dispara', 'spara'], ['disparar', 'sparare'],
    ['invocar', 'evocare'], ['invoca', 'evoca'], ['Invoca', 'Evoca'],
    ['reduce', 'riduce'], ['Reduce', 'Riduce'],
    ['infligir', 'infliggere'], ['inflige', 'infligge'],
    ['bloquear', 'bloccare'], ['derrotar', 'sconfiggere'],
    ['lanza', 'lancia'], ['aplica', 'applica'],
    ['desgarran', 'squarciano'], ['obtiene', 'ottiene'],
    ['sobrevolar', 'sorvolare'], ['regenerar', 'rigenerare'],
    ['también', 'anche'], ['También', 'Anche'],
    // Aggettivi
    ['cercanos', 'vicini'], ['cercano', 'vicino'],
    ['lejanos', 'lontani'], ['afilados', 'affilati'],
    ['venenosos', 'velenosi'], ['malvados', 'malvagi'], ['malvado', 'malvagio'],
    ['resistentes', 'resistenti'], ['repugnantes', 'ripugnanti'],
    ['feroces', 'feroci'], ['feroz', 'feroce'],
    ['rápidos', 'rapidi'], ['rápidas', 'rapide'],
    ['letales', 'letali'], ['aladas', 'alate'],
    ['voladoras', 'volanti'], ['volador', 'volante'],
    ['pequeños', 'piccoli'], ['frágil', 'fragile'],
    ['necesarias', 'necessarie'], ['inmunes', 'immuni'], ['inmune', 'immune'],
    ['difíciles', 'difficili'],
    ['Puede', 'Puo'], ['puede', 'puo'], ['pueden', 'possono'],
  ];
  words.forEach(([es, it]) => {
    if (es !== it) {
      rules.push({ pattern: new RegExp(escapeRegex(es), 'g'), replacement: it, priority: 2 });
    }
  });

  // Priority 3: Preposizioni e articoli
  const preps: [string, string][] = [
    [' que ', ' che '], [' y ', ' e '], [' los ', ' i '], [' las ', ' le '],
    [' del ', ' del '], [' de la ', ' della '], [' de los ', ' dei '],
    [' de las ', ' delle '], [' de ', ' di '], [' en ', ' in '],
    [' para ', ' per '], [' por ', ' per '], [' el ', ' il '],
    [' todos ', ' tutti '], [' todas ', ' tutte '],
    [' más ', ' piu '], [' muy ', ' molto '], [' pero ', ' ma '],
    [' sin ', ' senza '], [' cada ', ' ogni '], [' mientras ', ' mentre '],
    [' otros ', ' altri '], ['¡', ''], ['¿', ''],
  ];
  preps.forEach(([es, it]) => {
    if (es !== it) {
      rules.push({ pattern: new RegExp(escapeRegex(es), 'g'), replacement: it, priority: 3 });
    }
  });

  return rules.sort((a, b) => a.priority - b.priority);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Singleton rules cache
let _esItRules: TranslationRule[] | null = null;

export function translateEsIt(text: string): string {
  if (!_esItRules) _esItRules = buildEsItRules();
  
  let result = text;
  
  // Proteggi tag
  const tags: string[] = [];
  result = result.replace(/\{[a-zA-Z],[^}]+\}/g, (match) => {
    // Traduci contenuto tag
    let translated = match;
    for (const rule of _esItRules!.filter(r => r.priority === 1)) {
      translated = translated.replace(rule.pattern, rule.replacement);
    }
    const idx = tags.length;
    tags.push(translated);
    return `\x01T${idx}\x01`;
  });

  // Applica regole per priorità (frasi → parole → preposizioni)
  for (const rule of _esItRules!.filter(r => r.priority !== 1)) {
    result = result.replace(rule.pattern, rule.replacement);
  }

  // Ripristina tag
  result = result.replace(/\x01T(\d+)\x01/g, (_, idx) => tags[parseInt(idx)]);

  // Post-processing
  result = result.replace(/  +/g, ' ').replace(/ \./g, '.').replace(/ ,/g, ',');
  
  return result;
}

// ============================================================
// Batch Translation
// ============================================================

export function translateStrings(
  strings: BinaryString[],
  sourceLang: string,
  targetLang: string,
  onProgress?: (current: number, total: number) => void
): BinaryString[] {
  const total = strings.length;
  
  return strings.map((s, i) => {
    let translated = s.original;

    if (sourceLang === 'es' && targetLang === 'it') {
      translated = translateEsIt(s.original);
    }
    // Future: add more language pairs

    // Fit to byte length
    translated = fitToByteLength(translated, s.byteLen);

    if (onProgress) onProgress(i + 1, total);

    return {
      ...s,
      translated,
      isTranslated: translated !== s.original,
    };
  });
}

// ============================================================
// Patch Application (in-memory)
// ============================================================

export function applyPatch(
  buffer: Uint8Array,
  strings: BinaryString[]
): PatchResult {
  const output = new Uint8Array(buffer);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let patchedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const s of strings) {
    if (!s.translated || !s.isTranslated) {
      skippedCount++;
      continue;
    }

    const itBuf = encoder.encode(s.translated);
    if (itBuf.length !== s.byteLen) {
      errors.push(`@${s.offset}: lunghezza ${itBuf.length} ≠ ${s.byteLen}`);
      skippedCount++;
      continue;
    }

    // Verifica originale nel buffer
    const origSlice = buffer.slice(s.offset, s.offset + s.byteLen);
    const origText = decoder.decode(origSlice);
    if (origText !== s.original) {
      errors.push(`@${s.offset}: originale non corrisponde`);
      skippedCount++;
      continue;
    }

    // Scrivi traduzione
    output.set(itBuf, s.offset);
    patchedCount++;
  }

  return {
    success: patchedCount > 0,
    patchedCount,
    skippedCount,
    errors,
    outputPath: '',
    patchedBuffer: output,
  };
}

// ============================================================
// Project Management
// ============================================================

export function createProject(
  gameName: string,
  fileName: string,
  filePath: string,
  buffer: Uint8Array,
  sourceLang: string,
  targetLang: string,
  options?: ExtractionOptions
): PatchProject {
  const strings = extractStringsFromBuffer(buffer, options);

  return {
    version: 1,
    gameName,
    fileName,
    filePath,
    fileSize: buffer.length,
    sourceLang,
    targetLang,
    strings,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function exportProject(project: PatchProject): string {
  return JSON.stringify(project, null, 2);
}

export function importProject(json: string): PatchProject {
  const project = JSON.parse(json) as PatchProject;
  if (project.version !== 1) throw new Error('Versione progetto non supportata');
  return project;
}

// ============================================================
// Stats
// ============================================================

export function getProjectStats(project: PatchProject) {
  const total = project.strings.length;
  const translated = project.strings.filter(s => s.isTranslated).length;
  const byCategory: Record<string, number> = {};
  const byLanguage: Record<string, number> = {};

  for (const s of project.strings) {
    const cat = s.category || 'unknown';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    const lang = s.language || 'unknown';
    byLanguage[lang] = (byLanguage[lang] || 0) + 1;
  }

  return { total, translated, percentage: total > 0 ? Math.round((translated / total) * 100) : 0, byCategory, byLanguage };
}
