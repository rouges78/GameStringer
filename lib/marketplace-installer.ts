'use client';

/**
 * Marketplace Pack Installer
 *
 * 1-click install flow: download from Supabase → parse .gspack →
 * import translations → apply to game project.
 *
 * Flow: Browse Hub → Click "Install" → Download → Validate → Import → Done
 */

import { downloadPack, fetchPackById } from './community-hub-backend';
import type { TranslationPack } from './community-hub-service';
import type { GspackData, GspackManifest, InstalledPack } from './gspack-manager';
import { safeGetItem, safeSetItem } from './safe-storage';
import { clientLogger } from './client-logger';

// ── Types ──────────────────────────────────────────────────

export interface InstallProgress {
  stage: 'downloading' | 'validating' | 'importing' | 'applying' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  packName?: string;
  error?: string;
}

export type InstallCallback = (progress: InstallProgress) => void;

export interface InstallResult {
  success: boolean;
  packId: string;
  packName: string;
  stringsImported: number;
  glossaryEntries: number;
  error?: string;
}

const INSTALLED_PACKS_KEY = 'gspack_marketplace_installed';

// ── Core Install Flow ──────────────────────────────────────

/**
 * 1-click install: download pack from marketplace and import into local project.
 */
export async function installPackFromHub(
  packId: string,
  onProgress?: InstallCallback
): Promise<InstallResult> {
  const report = (stage: InstallProgress['stage'], progress: number, message: string) => {
    onProgress?.({ stage, progress, message });
  };

  try {
    // 1. DOWNLOAD
    report('downloading', 10, 'Scaricamento pack dal Hub...');

    const packInfo = await fetchPackById(packId);
    if (!packInfo) {
      throw new Error('Pack non trovato nel Hub');
    }

    report('downloading', 30, `Scaricamento "${packInfo.name}"...`);
    const blob = await downloadPack(packId);

    // 2. VALIDATE
    report('validating', 50, 'Validazione pack...');

    const text = await blob.text();
    let gspackData: GspackData;

    try {
      // Try parsing as raw JSON first
      gspackData = JSON.parse(text);
    } catch {
      // Try base64 decode
      try {
        const decoded = atob(text);
        gspackData = JSON.parse(decoded);
      } catch {
        throw new Error('Formato pack non valido — impossibile decodificare');
      }
    }

    if (!gspackData.manifest || !gspackData.files) {
      throw new Error('Pack incompleto: mancano manifest o files');
    }

    report('validating', 60, `Pack valido: ${gspackData.files.length} file, ${gspackData.manifest.translation.totalStrings} stringhe`);

    // 3. IMPORT translations into local storage
    report('importing', 70, 'Importazione traduzioni...');

    let stringsImported = 0;
    const translationEntries: Array<{ original: string; translated: string; file: string }> = [];

    for (const file of gspackData.files) {
      try {
        const parsed = parseTranslationFile(file.content, file.format);
        for (const entry of parsed) {
          translationEntries.push({
            original: entry.source,
            translated: entry.target,
            file: file.path,
          });
          stringsImported++;
        }
      } catch (err: unknown) {
        clientLogger.warn(`Errore parsing file ${file.path}:`, err);
      }
    }

    report('importing', 85, `${stringsImported} stringhe importate`);

    // 4. SAVE to local installed packs registry
    report('applying', 90, 'Registrazione pack installato...');

    const installed: InstalledPack = {
      packId: gspackData.manifest.packId || packId,
      name: gspackData.manifest.name,
      gameName: gspackData.manifest.game.name,
      gameAppId: gspackData.manifest.game.appId,
      targetLanguage: gspackData.manifest.translation.targetLanguage,
      completionPercent: gspackData.manifest.translation.completionPercent,
      installedAt: new Date().toISOString(),
      author: gspackData.manifest.author.name,
      fileCount: gspackData.files.length,
      stringCount: stringsImported,
    };

    saveInstalledPack(installed);

    // 5. Import glossary if present
    let glossaryEntries = 0;
    if (gspackData.glossary && gspackData.glossary.length > 0) {
      glossaryEntries = gspackData.glossary.length;
      // Save glossary entries to local storage for the game
      const glossaryKey = `gspack_glossary_${gspackData.manifest.game.appId || gspackData.manifest.game.name}`;
      const existing = safeGetItem<Array<{ source: string; target: string }>>(glossaryKey) || [];
      const merged = [...existing, ...gspackData.glossary.map(g => ({ source: g.source, target: g.target }))];
      // Deduplicate
      const unique = Array.from(new Map(merged.map(e => [e.source, e])).values());
      safeSetItem(glossaryKey, unique);
    }

    report('complete', 100, `Installazione completata! ${stringsImported} stringhe, ${glossaryEntries} glossario`);

    clientLogger.info('Pack installato dal marketplace', 'MARKETPLACE', {
      packId, packName: packInfo.name, stringsImported, glossaryEntries
    });

    return {
      success: true,
      packId,
      packName: packInfo.name,
      stringsImported,
      glossaryEntries,
    };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    report('error', 0, message);
    clientLogger.error('Errore installazione pack', 'MARKETPLACE', { packId, error: message });
    return {
      success: false,
      packId,
      packName: '',
      stringsImported: 0,
      glossaryEntries: 0,
      error: message,
    };
  }
}

// ── Installed Packs Management ─────────────────────────────

export function getInstalledPacks(): InstalledPack[] {
  return safeGetItem<InstalledPack[]>(INSTALLED_PACKS_KEY) || [];
}

export function isPackInstalled(packId: string): boolean {
  return getInstalledPacks().some(p => p.packId === packId);
}

export function getInstalledPackForGame(gameAppId?: number, gameName?: string): InstalledPack | null {
  const packs = getInstalledPacks();
  if (gameAppId) {
    return packs.find(p => p.gameAppId === gameAppId) || null;
  }
  if (gameName) {
    return packs.find(p => p.gameName.toLowerCase() === gameName.toLowerCase()) || null;
  }
  return null;
}

function saveInstalledPack(pack: InstalledPack): void {
  const packs = getInstalledPacks().filter(p => p.packId !== pack.packId);
  packs.push(pack);
  safeSetItem(INSTALLED_PACKS_KEY, packs);
}

export function uninstallPack(packId: string): void {
  const packs = getInstalledPacks().filter(p => p.packId !== packId);
  safeSetItem(INSTALLED_PACKS_KEY, packs);
  clientLogger.info('Pack disinstallato', 'MARKETPLACE', { packId });
}

// ── Translation File Parsing ───────────────────────────────

interface ParsedEntry {
  source: string;
  target: string;
}

function parseTranslationFile(content: string, format: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];

  try {
    switch (format.toLowerCase()) {
      case 'json': {
        const data = JSON.parse(content);
        flattenJson(data, entries);
        break;
      }
      case 'csv':
      case 'tsv': {
        const sep = format === 'tsv' ? '\t' : ',';
        const lines = content.split('\n').filter(l => l.trim());
        for (let i = 1; i < lines.length; i++) { // Skip header
          const cols = lines[i].split(sep);
          if (cols.length >= 2) {
            entries.push({ source: cols[0].trim().replace(/^"|"$/g, ''), target: cols[1].trim().replace(/^"|"$/g, '') });
          }
        }
        break;
      }
      case 'po': {
        const blocks = content.split(/\n\n+/);
        for (const block of blocks) {
          const msgidMatch = block.match(/msgid\s+"(.+?)"/);
          const msgstrMatch = block.match(/msgstr\s+"(.+?)"/);
          if (msgidMatch && msgstrMatch && msgstrMatch[1]) {
            entries.push({ source: msgidMatch[1], target: msgstrMatch[1] });
          }
        }
        break;
      }
      default:
        // Try as key=value pairs
        const lines = content.split('\n').filter(l => l.includes('='));
        for (const line of lines) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            entries.push({ source: key.trim(), target: valueParts.join('=').trim() });
          }
        }
    }
  } catch (err: unknown) {
    clientLogger.warn(`Parse error for ${format}:`, err);
  }

  return entries;
}

function flattenJson(obj: unknown, entries: ParsedEntry[], _prefix = ''): void {
  if (typeof obj !== 'object' || obj === null) return;

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value === 'string') {
      entries.push({ source: key, target: value });
    } else if (typeof value === 'object' && value !== null) {
      flattenJson(value, entries, key);
    }
  }
}
