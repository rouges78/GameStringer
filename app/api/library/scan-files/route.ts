import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 🔍 API per scansione file traducibili
 * 
 * Cerca ricorsivamente file di localizzazione comuni nei giochi:
 * - Formati standard: .po, .pot, .xliff, .resx, .strings, .properties
 * - Formati dati: .json, .xml, .ini, .csv, .yaml, .yml
 * - Testo: .txt, .lang, .loc, .locale
 * - Unity: .asset (con filtro)
 * - Unreal: .locres (binario, solo listing)
 */

// Estensioni file traducibili
const TRANSLATABLE_EXTENSIONS = new Set([
  // Standard localization
  '.po', '.pot', '.xlf', '.xliff', '.resx', '.strings', '.properties',
  // Data formats
  '.json', '.xml', '.ini', '.csv', '.yaml', '.yml',
  // Text/Language files
  '.txt', '.lang', '.loc', '.locale', '.localization',
  // Game-specific
  '.asset', '.locres', '.lng', '.tra', '.translation',
  // Subtitles
  '.srt', '.sub', '.ass', '.ssa', '.vtt'
]);

// Pattern di cartelle da cercare (case-insensitive)
const LOCALIZATION_FOLDERS = [
  'localization', 'localisation', 'locale', 'locales',
  'lang', 'language', 'languages',
  'i18n', 'translations', 'text', 'texts',
  'strings', 'dialog', 'dialogue', 'dialogues',
  'subtitles', 'subs', 'captions'
];

// Pattern di nomi file comuni per localizzazione
const LOCALIZATION_FILE_PATTERNS = [
  /^(en|it|de|fr|es|pt|ru|zh|ja|ko|pl|tr|ar|nl|sv|no|da|fi|cs|hu|ro|bg|uk|el|th|vi|id|ms|hi)[-_]?/i,
  /[-_](en|it|de|fr|es|pt|ru|zh|ja|ko|pl|tr|ar|nl|sv|no|da|fi|cs|hu|ro|bg|uk|el|th|vi|id|ms|hi)$/i,
  /^(english|italian|german|french|spanish|portuguese|russian|chinese|japanese|korean)/i,
  /(english|italian|german|french|spanish|portuguese|russian|chinese|japanese|korean)$/i,
  /^(text|string|dialog|dialogue|subtitle|caption|message|ui|menu|item|quest|npc|skill)/i,
  /locali[sz]ation/i,
  /^lang/i,
  /\.lang$/i
];

// Cartelle da escludere
const EXCLUDED_FOLDERS = new Set([
  'node_modules', '.git', '.svn', '__pycache__', '.cache',
  'build', 'dist', 'bin', 'obj', 'temp', 'tmp',
  'shader', 'shaders', 'texture', 'textures',
  'model', 'models', 'mesh', 'meshes',
  'audio', 'sound', 'sounds', 'music',
  'video', 'videos', 'movie', 'movies',
  'engine', 'plugins', 'thirdparty', 'third_party'
]);

interface FileInfo {
  name: string;
  path: string;
  size: number;
  relativePath: string;
  category: 'localization' | 'data' | 'text' | 'subtitle' | 'unknown';
  priority: number; // 1-5, più alto = più probabile che sia traducibile
}

interface ScanResult {
  files: FileInfo[];
  totalScanned: number;
  localizationFolders: string[];
  suggestions: string[];
}

function getFileCategory(filename: string): FileInfo['category'] {
  const ext = path.extname(filename).toLowerCase();
  
  if (['.po', '.pot', '.xlf', '.xliff', '.resx', '.strings', '.properties', '.locres'].includes(ext)) {
    return 'localization';
  }
  if (['.srt', '.sub', '.ass', '.ssa', '.vtt'].includes(ext)) {
    return 'subtitle';
  }
  if (['.json', '.xml', '.ini', '.csv', '.yaml', '.yml'].includes(ext)) {
    return 'data';
  }
  if (['.txt', '.lang', '.loc', '.locale'].includes(ext)) {
    return 'text';
  }
  return 'unknown';
}

function calculatePriority(filePath: string, filename: string): number {
  let priority = 1;
  const lowerPath = filePath.toLowerCase();
  const lowerName = filename.toLowerCase();
  
  // Bonus per cartelle di localizzazione
  for (const folder of LOCALIZATION_FOLDERS) {
    if (lowerPath.includes(`/${folder}/`) || lowerPath.includes(`\\${folder}\\`)) {
      priority += 2;
      break;
    }
  }
  
  // Bonus per pattern di nomi file
  for (const pattern of LOCALIZATION_FILE_PATTERNS) {
    if (pattern.test(lowerName)) {
      priority += 1;
      break;
    }
  }
  
  // Bonus per estensioni specifiche
  const ext = path.extname(filename).toLowerCase();
  if (['.po', '.pot', '.xliff', '.resx', '.strings'].includes(ext)) {
    priority += 2;
  } else if (['.lang', '.loc', '.locale', '.locres'].includes(ext)) {
    priority += 1;
  }
  
  return Math.min(priority, 5);
}

async function scanDirectory(
  dirPath: string,
  basePath: string,
  results: FileInfo[],
  locFolders: Set<string>,
  maxDepth: number = 10,
  currentDepth: number = 0
): Promise<number> {
  if (currentDepth > maxDepth) return 0;
  
  let scanned = 0;
  
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);
      
      if (entry.isDirectory()) {
        const lowerName = entry.name.toLowerCase();
        
        // Skip excluded folders
        if (EXCLUDED_FOLDERS.has(lowerName)) continue;
        
        // Track localization folders
        if (LOCALIZATION_FOLDERS.includes(lowerName)) {
          locFolders.add(relativePath);
        }
        
        // Recurse
        scanned += await scanDirectory(fullPath, basePath, results, locFolders, maxDepth, currentDepth + 1);
      } else if (entry.isFile()) {
        scanned++;
        const ext = path.extname(entry.name).toLowerCase();
        
        if (TRANSLATABLE_EXTENSIONS.has(ext)) {
          try {
            const stats = await fs.promises.stat(fullPath);
            
            // Skip very large files (>50MB) and empty files
            if (stats.size > 50 * 1024 * 1024 || stats.size === 0) continue;
            
            const priority = calculatePriority(relativePath, entry.name);
            
            results.push({
              name: entry.name,
              path: fullPath,
              size: stats.size,
              relativePath,
              category: getFileCategory(entry.name),
              priority
            });
          } catch {
            // Skip files we can't stat
          }
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning ${dirPath}:`, err);
  }
  
  return scanned;
}

function generateSuggestions(result: ScanResult): string[] {
  const suggestions: string[] = [];
  
  if (result.localizationFolders.length > 0) {
    suggestions.push(`📁 Trovate ${result.localizationFolders.length} cartelle di localizzazione`);
  }
  
  const byCategory = {
    localization: result.files.filter(f => f.category === 'localization'),
    data: result.files.filter(f => f.category === 'data'),
    text: result.files.filter(f => f.category === 'text'),
    subtitle: result.files.filter(f => f.category === 'subtitle')
  };
  
  if (byCategory.localization.length > 0) {
    suggestions.push(`🎯 ${byCategory.localization.length} file di localizzazione standard (consigliati)`);
  }
  
  if (byCategory.subtitle.length > 0) {
    suggestions.push(`🎬 ${byCategory.subtitle.length} file sottotitoli`);
  }
  
  const highPriority = result.files.filter(f => f.priority >= 4);
  if (highPriority.length > 0 && highPriority.length < result.files.length) {
    suggestions.push(`⭐ ${highPriority.length} file con alta probabilità di contenere testo traducibile`);
  }
  
  if (result.files.length === 0) {
    suggestions.push('⚠️ Nessun file traducibile trovato. Prova a selezionare manualmente una cartella specifica.');
  }
  
  return suggestions;
}

export async function POST(request: NextRequest) {
  try {
    const { directoryPath, maxDepth = 10 } = await request.json();
    
    if (!directoryPath) {
      return NextResponse.json({ error: 'directoryPath è richiesto' }, { status: 400 });
    }
    
    // Verifica che il percorso esista
    try {
      await fs.promises.access(directoryPath, fs.constants.R_OK);
    } catch {
      return NextResponse.json({ 
        error: `Percorso non accessibile: ${directoryPath}` 
      }, { status: 404 });
    }
    
    const files: FileInfo[] = [];
    const locFolders = new Set<string>();
    
    const totalScanned = await scanDirectory(
      directoryPath, 
      directoryPath, 
      files, 
      locFolders,
      maxDepth
    );
    
    // Ordina per priorità (decrescente) e poi per nome
    files.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.name.localeCompare(b.name);
    });
    
    const result: ScanResult = {
      files,
      totalScanned,
      localizationFolders: Array.from(locFolders),
      suggestions: []
    };
    
    result.suggestions = generateSuggestions(result);
    
    // Per retrocompatibilità, restituisci anche il formato semplice
    // se ci sono pochi file
    if (files.length <= 100) {
      return NextResponse.json(files.map(f => ({
        name: f.name,
        path: f.path,
        size: f.size,
        category: f.category,
        priority: f.priority
      })));
    }
    
    // Per molti file, restituisci il risultato completo
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Errore durante la scansione' 
    }, { status: 500 });
  }
}
