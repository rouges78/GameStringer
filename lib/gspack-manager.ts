/**
 * GameStringer Translation Pack (.gspack) Manager
 * 
 * Formato .gspack: JSON compresso (base64) contenente:
 * - Manifest con metadati (gioco, lingua, autore, versione)
 * - File di traduzione originali
 * - Glossario specifico del gioco
 * - Note del traduttore
 * - Hash di integrità
 */

import { safeGetItem, safeSetItem } from './safe-storage';

const PACKS_STORAGE_KEY = 'gspack_installed';

// ═══════════════════════════════════════════════════════════════════
// TIPI
// ═══════════════════════════════════════════════════════════════════

export interface GspackManifest {
  version: '1.0';
  packId: string;
  name: string;
  description: string;
  author: {
    name: string;
    profileId?: string;
    contact?: string;
  };
  game: {
    name: string;
    appId?: number;
    platform: string;
    engine?: string;
  };
  translation: {
    sourceLanguage: string;
    targetLanguage: string;
    totalStrings: number;
    translatedStrings: number;
    completionPercent: number;
    provider?: string;
    quality?: 'draft' | 'reviewed' | 'final';
  };
  createdAt: string;
  exportedWith: string;
  checksum: string;
}

export interface GspackFile {
  path: string;
  originalPath: string;
  content: string;
  format: string;
  stringCount: number;
  translatedCount: number;
}

export interface GspackGlossaryEntry {
  source: string;
  target: string;
  context?: string;
  category?: string;
}

export interface GspackData {
  manifest: GspackManifest;
  files: GspackFile[];
  glossary: GspackGlossaryEntry[];
  notes: string;
}

export interface InstalledPack {
  packId: string;
  name: string;
  gameName: string;
  gameAppId?: number;
  targetLanguage: string;
  completionPercent: number;
  installedAt: string;
  author: string;
  fileCount: number;
  stringCount: number;
}

export interface ExportOptions {
  gameName: string;
  gameAppId?: number;
  platform: string;
  engine?: string;
  sourceLanguage: string;
  targetLanguage: string;
  authorName: string;
  packName: string;
  description: string;
  quality: 'draft' | 'reviewed' | 'final';
  includeGlossary: boolean;
  includeNotes: boolean;
  notes?: string;
  files: Array<{
    path: string;
    content: string;
    format: string;
  }>;
  glossary?: GspackGlossaryEntry[];
}

// ═══════════════════════════════════════════════════════════════════
// UTILITÀ
// ═══════════════════════════════════════════════════════════════════

function generateId(): string {
  return `gspack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function countStrings(content: string, format: string): { total: number; translated: number } {
  let total = 0;
  let translated = 0;

  try {
    if (format === 'json') {
      const data = JSON.parse(content);
      const count = (obj: any) => {
        for (const val of Object.values(obj)) {
          if (typeof val === 'string') { total++; if (val.trim()) translated++; }
          else if (typeof val === 'object' && val !== null) count(val);
        }
      };
      count(data);
    } else if (format === 'csv' || format === 'tsv') {
      const lines = content.split('\n').filter(l => l.trim());
      total = Math.max(0, lines.length - 1);
      translated = total;
    } else if (format === 'po') {
      const msgidMatches = content.match(/^msgid\s+"/gm);
      const msgstrMatches = content.match(/^msgstr\s+"[^"]/gm);
      total = msgidMatches?.length ?? 0;
      translated = msgstrMatches?.length ?? 0;
    } else {
      // Fallback: conta righe non vuote
      const lines = content.split('\n').filter(l => l.trim());
      total = lines.length;
      translated = lines.length;
    }
  } catch {
    total = 1;
    translated = 1;
  }

  return { total, translated };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════

/**
 * Crea un pacchetto .gspack da opzioni di export
 * Ritorna una stringa JSON (il contenuto del file .gspack)
 */
export function createGspack(options: ExportOptions): { data: string; filename: string; manifest: GspackManifest } {
  const packId = generateId();

  // Processa file
  const files: GspackFile[] = options.files.map(f => {
    const stats = countStrings(f.content, f.format);
    return {
      path: f.path.replace(/\\/g, '/').split('/').pop() || f.path,
      originalPath: f.path,
      content: f.content,
      format: f.format,
      stringCount: stats.total,
      translatedCount: stats.translated,
    };
  });

  const totalStrings = files.reduce((s, f) => s + f.stringCount, 0);
  const translatedStrings = files.reduce((s, f) => s + f.translatedCount, 0);

  const manifest: GspackManifest = {
    version: '1.0',
    packId,
    name: options.packName,
    description: options.description,
    author: { name: options.authorName },
    game: {
      name: options.gameName,
      appId: options.gameAppId,
      platform: options.platform,
      engine: options.engine,
    },
    translation: {
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
      totalStrings,
      translatedStrings,
      completionPercent: totalStrings > 0 ? Math.round((translatedStrings / totalStrings) * 100) : 0,
      quality: options.quality,
    },
    createdAt: new Date().toISOString(),
    exportedWith: 'GameStringer',
    checksum: '',
  };

  const glossary = options.includeGlossary && options.glossary ? options.glossary : [];
  const notes = options.includeNotes && options.notes ? options.notes : '';

  const packData: GspackData = { manifest, files, glossary, notes };

  // Calcola checksum sul contenuto
  const contentForHash = JSON.stringify({ files: packData.files, glossary: packData.glossary });
  manifest.checksum = simpleHash(contentForHash);
  packData.manifest = manifest;

  const jsonStr = JSON.stringify(packData);

  // Encode in base64 per protezione
  let encoded: string;
  try {
    encoded = btoa(unescape(encodeURIComponent(jsonStr)));
  } catch {
    encoded = jsonStr;
  }

  // Nome file sicuro
  const safeName = options.gameName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  const safeLang = options.targetLanguage.toLowerCase();
  const filename = `${safeName}_${safeLang}_${packId.slice(-6)}.gspack`;

  return { data: encoded, filename, manifest };
}

// ═══════════════════════════════════════════════════════════════════
// IMPORT
// ═══════════════════════════════════════════════════════════════════

export interface ImportResult {
  success: boolean;
  manifest?: GspackManifest;
  files?: GspackFile[];
  glossary?: GspackGlossaryEntry[];
  notes?: string;
  error?: string;
  warnings: string[];
}

/**
 * Importa un file .gspack
 * @param rawContent Contenuto del file .gspack (base64 o JSON)
 */
export function importGspack(rawContent: string): ImportResult {
  const warnings: string[] = [];

  try {
    // Decodifica (può essere base64 o JSON raw)
    let jsonStr: string;
    try {
      jsonStr = decodeURIComponent(escape(atob(rawContent.trim())));
    } catch {
      jsonStr = rawContent.trim();
    }

    const data: GspackData = JSON.parse(jsonStr);

    // Validazione manifest
    if (!data.manifest || data.manifest.version !== '1.0') {
      return { success: false, error: 'Formato pack non riconosciuto o versione non supportata', warnings };
    }

    if (!data.files || !Array.isArray(data.files)) {
      return { success: false, error: 'Il pack non contiene file di traduzione', warnings };
    }

    if (data.files.length === 0) {
      warnings.push('Il pack non contiene file — potrebbe essere incompleto');
    }

    // Verifica checksum
    const contentForHash = JSON.stringify({ files: data.files, glossary: data.glossary || [] });
    const computedChecksum = simpleHash(contentForHash);
    if (data.manifest.checksum && data.manifest.checksum !== computedChecksum) {
      warnings.push('Checksum non corrispondente — il file potrebbe essere stato modificato');
    }

    // Validazione file
    for (const file of data.files) {
      if (!file.content || !file.path) {
        warnings.push(`File '${file.path || 'sconosciuto'}' è incompleto`);
      }
    }

    return {
      success: true,
      manifest: data.manifest,
      files: data.files,
      glossary: data.glossary || [],
      notes: data.notes || '',
      warnings,
    };
  } catch (e: any) {
    return { success: false, error: `Errore lettura pack: ${e.message}`, warnings };
  }
}

// ═══════════════════════════════════════════════════════════════════
// GESTIONE PACK INSTALLATI
// ═══════════════════════════════════════════════════════════════════

export function getInstalledPacks(): InstalledPack[] {
  return safeGetItem<InstalledPack[]>(PACKS_STORAGE_KEY) || [];
}

export function installPack(manifest: GspackManifest, fileCount: number): InstalledPack {
  const packs = getInstalledPacks();
  
  const installed: InstalledPack = {
    packId: manifest.packId,
    name: manifest.name,
    gameName: manifest.game.name,
    gameAppId: manifest.game.appId,
    targetLanguage: manifest.translation.targetLanguage,
    completionPercent: manifest.translation.completionPercent,
    installedAt: new Date().toISOString(),
    author: manifest.author.name,
    fileCount,
    stringCount: manifest.translation.totalStrings,
  };

  // Rimuovi pack vecchio dello stesso gioco/lingua se presente
  const filtered = packs.filter(p => 
    !(p.gameName === installed.gameName && p.targetLanguage === installed.targetLanguage)
  );
  filtered.push(installed);
  safeSetItem(PACKS_STORAGE_KEY, filtered);

  return installed;
}

export function uninstallPack(packId: string): boolean {
  const packs = getInstalledPacks();
  const filtered = packs.filter(p => p.packId !== packId);
  if (filtered.length === packs.length) return false;
  safeSetItem(PACKS_STORAGE_KEY, filtered);
  return true;
}

export function getInstalledPackForGame(gameName: string, targetLanguage: string): InstalledPack | null {
  const packs = getInstalledPacks();
  return packs.find(p => p.gameName === gameName && p.targetLanguage === targetLanguage) || null;
}

// ═══════════════════════════════════════════════════════════════════
// DOWNLOAD HELPER (per Tauri)
// ═══════════════════════════════════════════════════════════════════

/**
 * Salva .gspack su disco via Tauri dialog
 */
export async function saveGspackToFile(data: string, filename: string): Promise<boolean> {
  if (typeof window === 'undefined' || !(window as any).__TAURI__) {
    // Fallback: download via browser
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');

    const filePath = await save({
      defaultPath: filename,
      filters: [{ name: 'GameStringer Pack', extensions: ['gspack'] }],
    });

    if (filePath) {
      await writeTextFile(filePath, data);
      return true;
    }
    return false;
  } catch (e) {
    console.error('[GsPack] Errore salvataggio:', e);
    return false;
  }
}

/**
 * Carica .gspack da disco via Tauri dialog
 */
export async function loadGspackFromFile(): Promise<string | null> {
  if (typeof window === 'undefined' || !(window as any).__TAURI__) {
    // Fallback: file input
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.gspack';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file);
      };
      input.click();
    });
  }

  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readTextFile } = await import('@tauri-apps/plugin-fs');

    const filePath = await open({
      filters: [{ name: 'GameStringer Pack', extensions: ['gspack'] }],
      multiple: false,
    });

    if (filePath && typeof filePath === 'string') {
      return await readTextFile(filePath);
    }
    return null;
  } catch (e) {
    console.error('[GsPack] Errore caricamento:', e);
    return null;
  }
}
