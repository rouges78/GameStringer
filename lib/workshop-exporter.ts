/**
 * Steam Workshop Export
 * 
 * Genera pacchetti di traduzione pronti per la pubblicazione su Steam Workshop.
 * Supporta:
 * - Struttura cartelle standard Workshop
 * - Generazione workshop_item.json (metadata)
 * - Preview image placeholder
 * - README con istruzioni
 * - Formati: Unity (BepInEx/XUnity), Unreal (.pak), Generic (file replacement)
 */

import JSZip from 'jszip';

// ─── Types ───────────────────────────────────────────────────

export interface WorkshopExportConfig {
  gameName: string;
  gameAppId: number;
  title: string;
  description: string;
  language: string;
  targetLanguage: string;
  author: string;
  version: string;
  tags: string[];
  engine: 'unity' | 'unreal' | 'generic';
  visibility: 'public' | 'friends_only' | 'private';
  changeNote?: string;
}

export interface WorkshopTranslatedFile {
  relativePath: string;
  content: string | Uint8Array;
  isBinary: boolean;
}

export interface WorkshopItemMetadata {
  publishedfileid?: string;
  appid: number;
  title: string;
  description: string;
  tags: string[];
  visibility: number;
  content_folder: string;
  preview_file: string;
  change_note: string;
  metadata: {
    version: string;
    language: string;
    author: string;
    tool: string;
    created: string;
  };
}

// ─── Constants ───────────────────────────────────────────────

const LANGUAGE_NAMES: Record<string, string> = {
  'it': 'Italian', 'en': 'English', 'es': 'Spanish', 'fr': 'French',
  'de': 'German', 'pt': 'Portuguese', 'pt-BR': 'Brazilian', 'ru': 'Russian',
  'pl': 'Polish', 'zh': 'Simplified Chinese', 'ja': 'Japanese', 'ko': 'Korean',
  'ar': 'Arabic', 'hi': 'Hindi', 'tr': 'Turkish', 'nl': 'Dutch',
  'sv': 'Swedish', 'uk': 'Ukrainian', 'th': 'Thai', 'vi': 'Vietnamese',
  'id': 'Indonesian', 'es-419': 'Latin American Spanish',
};

const VISIBILITY_MAP = { 'public': 0, 'friends_only': 1, 'private': 2 };

// ─── Workshop Item Generator ─────────────────────────────────

/**
 * Generate workshop_item.json metadata
 */
export function generateWorkshopMetadata(config: WorkshopExportConfig): WorkshopItemMetadata {
  const langName = LANGUAGE_NAMES[config.targetLanguage] || config.targetLanguage;
  
  return {
    appid: config.gameAppId,
    title: config.title || `${config.gameName} - ${langName} Translation`,
    description: config.description || generateDefaultDescription(config),
    tags: ['Translation', langName, ...config.tags],
    visibility: VISIBILITY_MAP[config.visibility],
    content_folder: 'content',
    preview_file: 'preview.jpg',
    change_note: config.changeNote || `v${config.version} - Initial release`,
    metadata: {
      version: config.version,
      language: config.targetLanguage,
      author: config.author,
      tool: 'GameStringer',
      created: new Date().toISOString(),
    },
  };
}

function generateDefaultDescription(config: WorkshopExportConfig): string {
  const langName = LANGUAGE_NAMES[config.targetLanguage] || config.targetLanguage;
  const engineInfo = config.engine === 'unity'
    ? '\n\n[b]Requisiti:[/b]\n- BepInEx + XUnity AutoTranslator (incluso nel pacchetto)'
    : config.engine === 'unreal'
    ? '\n\n[b]Requisiti:[/b]\n- Nessuno, i file .pak vengono caricati automaticamente dal gioco'
    : '';

  return [
    `[h1]${langName} Translation for ${config.gameName}[/h1]`,
    '',
    `Complete ${langName.toLowerCase()} translation for ${config.gameName}.`,
    `Translated with AI assistance and human review using GameStringer.`,
    '',
    `[b]Version:[/b] ${config.version}`,
    `[b]Author:[/b] ${config.author}`,
    `[b]Language:[/b] ${langName}`,
    engineInfo,
    '',
    '[b]Installation:[/b]',
    'Subscribe to this Workshop item. The translation will be applied automatically.',
    '',
    '[i]Created with GameStringer - AI Game Translation Tool[/i]',
    '[url=https://github.com/rouges78/GameStringer]https://github.com/rouges78/GameStringer[/url]',
  ].join('\n');
}

// ─── README Generator ────────────────────────────────────────

function generateReadme(config: WorkshopExportConfig): string {
  const langName = LANGUAGE_NAMES[config.targetLanguage] || config.targetLanguage;
  
  return [
    `# ${config.gameName} - ${langName} Translation`,
    '',
    `**Version:** ${config.version}`,
    `**Author:** ${config.author}`,
    `**Language:** ${langName}`,
    `**Tool:** GameStringer`,
    '',
    '## Installation',
    '',
    config.engine === 'unity' ? [
      '### Steam Workshop (Recommended)',
      'Subscribe to this Workshop item. The files will be downloaded automatically.',
      '',
      '### Manual Installation',
      '1. Install BepInEx (included in the `bepinex` folder)',
      '2. Copy the contents of `content/` to your game folder',
      '3. Launch the game',
    ].join('\n') : config.engine === 'unreal' ? [
      '### Steam Workshop (Recommended)',
      'Subscribe to this Workshop item.',
      '',
      '### Manual Installation',
      '1. Copy the .pak file from `content/` to your game\'s Paks folder',
      '   Typical path: `<Game>/Content/Paks/`',
      '2. Name it with `_P` suffix if needed (e.g., `Translation_P.pak`)',
      '3. Launch the game',
    ].join('\n') : [
      '### Steam Workshop (Recommended)',
      'Subscribe to this Workshop item.',
      '',
      '### Manual Installation',
      '1. Copy all files from `content/` to your game installation folder',
      '2. Overwrite existing files when prompted',
      '3. Launch the game',
    ].join('\n'),
    '',
    '## Credits',
    '',
    `Translated by ${config.author} using GameStringer.`,
    'https://github.com/rouges78/GameStringer',
  ].join('\n');
}

// ─── Preview Image ───────────────────────────────────────────

function generatePreviewSVG(config: WorkshopExportConfig): string {
  const langName = LANGUAGE_NAMES[config.targetLanguage] || config.targetLanguage;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#7c3aed"/>
      <stop offset="100%" style="stop-color:#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <rect x="0" y="0" width="640" height="4" fill="url(#accent)"/>
  <text x="320" y="100" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="42" font-weight="bold">${escapeXml(config.gameName)}</text>
  <text x="320" y="160" text-anchor="middle" fill="#a855f7" font-family="Arial, sans-serif" font-size="28">${langName} Translation</text>
  <text x="320" y="220" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="18">v${config.version}</text>
  <text x="320" y="310" text-anchor="middle" fill="#475569" font-family="Arial, sans-serif" font-size="14">Created with GameStringer</text>
</svg>`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Main Export Function ────────────────────────────────────

/**
 * Generate a Steam Workshop-ready ZIP package
 */
export async function exportForWorkshop(
  config: WorkshopExportConfig,
  files: WorkshopTranslatedFile[]
): Promise<Blob> {
  const zip = new JSZip();

  // 1. Workshop metadata
  const metadata = generateWorkshopMetadata(config);
  zip.file('workshop_item.json', JSON.stringify(metadata, null, 2));

  // 2. README
  zip.file('README.md', generateReadme(config));

  // 3. Preview image (SVG)
  zip.file('preview.svg', generatePreviewSVG(config));

  // 4. Content folder with translated files
  const contentFolder = zip.folder('content');
  if (contentFolder) {
    for (const file of files) {
      if (file.isBinary) {
        contentFolder.file(file.relativePath, file.content as Uint8Array);
      } else {
        contentFolder.file(file.relativePath, file.content as string);
      }
    }
  }

  // 5. Install script (optional, for manual installation)
  zip.file('install.bat', generateInstallBat(config));
  zip.file('install.sh', generateInstallSh(config));

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

function generateInstallBat(config: WorkshopExportConfig): string {
  return [
    '@echo off',
    `echo === ${config.gameName} - ${LANGUAGE_NAMES[config.targetLanguage] || config.targetLanguage} Translation ===`,
    'echo.',
    'echo This will copy translated files to the game folder.',
    'echo.',
    'set /p GAME_PATH="Enter game installation path: "',
    'echo.',
    'echo Copying files...',
    'xcopy /s /y "content\\*" "%GAME_PATH%\\"',
    'echo.',
    'echo Done! Launch the game to see the translation.',
    'pause',
  ].join('\r\n');
}

function generateInstallSh(config: WorkshopExportConfig): string {
  return [
    '#!/bin/bash',
    `echo "=== ${config.gameName} - ${LANGUAGE_NAMES[config.targetLanguage] || config.targetLanguage} Translation ==="`,
    'echo ""',
    'echo "This will copy translated files to the game folder."',
    'echo ""',
    'read -p "Enter game installation path: " GAME_PATH',
    'echo ""',
    'echo "Copying files..."',
    'cp -r content/* "$GAME_PATH/"',
    'echo ""',
    'echo "Done! Launch the game to see the translation."',
  ].join('\n');
}

// ─── Validation ──────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate Workshop export configuration
 */
export function validateWorkshopConfig(config: WorkshopExportConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.gameName) errors.push('Game name is required');
  if (!config.gameAppId || config.gameAppId <= 0) errors.push('Valid Steam App ID is required');
  if (!config.title) warnings.push('Title will be auto-generated');
  if (!config.author) errors.push('Author name is required');
  if (!config.targetLanguage) errors.push('Target language is required');
  if (!config.version) warnings.push('Version defaults to 1.0.0');
  if (config.description && config.description.length > 8000) errors.push('Description exceeds 8000 character limit');
  if (config.tags.length > 10) warnings.push('Too many tags, Steam Workshop allows max 10');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
