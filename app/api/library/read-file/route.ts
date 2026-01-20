import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 📖 API per leggere il contenuto di un file
 * 
 * POST /api/library/read-file
 * Body: { filePath: string }
 * Response: { content: string }
 */

// Estensioni file permesse (sicurezza)
const ALLOWED_EXTENSIONS = new Set([
  // Localization
  '.po', '.pot', '.xlf', '.xliff', '.resx', '.strings', '.properties',
  // Data
  '.json', '.xml', '.ini', '.csv', '.yaml', '.yml',
  // Text
  '.txt', '.lang', '.loc', '.locale', '.localization',
  // Game-specific
  '.lng', '.tra', '.translation',
  // Subtitles
  '.srt', '.sub', '.ass', '.ssa', '.vtt'
]);

// Dimensione massima file (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath } = body;

    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json(
        { error: 'Percorso file non specificato' },
        { status: 400 }
      );
    }

    // Normalizza il percorso
    const normalizedPath = path.normalize(filePath);

    // Verifica estensione
    const ext = path.extname(normalizedPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Estensione file non supportata: ${ext}` },
        { status: 400 }
      );
    }

    // Verifica che il file esista
    try {
      const stats = await fs.stat(normalizedPath);
      
      if (!stats.isFile()) {
        return NextResponse.json(
          { error: 'Il percorso non è un file' },
          { status: 400 }
        );
      }

      if (stats.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File troppo grande (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: `File non trovato: ${normalizedPath}` },
        { status: 404 }
      );
    }

    // Leggi il contenuto del file
    const content = await fs.readFile(normalizedPath, 'utf-8');

    return NextResponse.json({ content });

  } catch (error) {
    console.error('Read file error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore durante la lettura del file' },
      { status: 500 }
    );
  }
}
