import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

interface ExtractedString {
  file: string;
  string: string;
}

// Limiti di sicurezza per evitare timeout e crash
const MAX_STRINGS_EXTRACT = 20000; // Limite massimo di stringhe da estrarre
const MAX_FILES_SCAN = 5000;     // Limite massimo di file da analizzare
const MAX_FILE_SIZE_MB = 10;       // Limite di dimensione per singolo file in MB

const TEXT_FILE_EXTENSIONS = ['.txt', '.json', '.xml', '.ini', '.cfg', '.log', '.md', '.csv'];

interface ScanState {
    strings: ExtractedString[];
    filesScanned: number;
    limitReached: boolean;
}

async function scanDirectory(dir: string, basePath: string, state: ScanState): Promise<void> {
  if (state.limitReached) return;

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (dirError) {
    console.warn(`Impossibile accedere alla directory: ${dir}`, dirError);
    return;
  }

  for (const entry of entries) {
    if (state.limitReached) break;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await scanDirectory(fullPath, basePath, state);
    } else if (TEXT_FILE_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
      if (state.filesScanned >= MAX_FILES_SCAN) {
        console.log('Limite massimo di file scansionati raggiunto.');
        state.limitReached = true;
        continue;
      }
      state.filesScanned++;

      try {
        const stats = await fs.stat(fullPath);
        if (stats.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            console.warn(`File ignorato perché troppo grande (${(stats.size / 1024 / 1024).toFixed(2)} MB): ${fullPath}`);
            continue;
        }

        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split(/\r?\n/);
        const relativePath = path.relative(basePath, fullPath);

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.length > 3) {
            state.strings.push({ file: relativePath, string: trimmedLine });
            if (state.strings.length >= MAX_STRINGS_EXTRACT) {
              console.log('Limite massimo di stringhe estratte raggiunto.');
              state.limitReached = true;
              break;
            }
          }
        }
      } catch (readError) {
        console.warn(`Impossibile leggere il file: ${fullPath}`, readError);
      }
    }
  }
}

export async function POST(
  request: Request,
  { params }: { params: { gameId: string } }
) {
  try {
    const { gameId } = params;
    if (!gameId) return NextResponse.json({ message: 'ID del gioco non fornito.' }, { status: 400 });

    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game || !game.installPath) return NextResponse.json({ message: 'Gioco o percorso di installazione non trovato.' }, { status: 404 });

    console.log(`Inizio estrazione per: ${game.title} nel percorso ${game.installPath}`);

    const scanState: ScanState = {
        strings: [],
        filesScanned: 0,
        limitReached: false,
    };

    await scanDirectory(game.installPath, game.installPath, scanState);

    if (scanState.strings.length === 0) {
        return NextResponse.json({ message: 'Nessuna stringa di testo trovata nei file di gioco supportati.' }, { status: 404 });
    }

    let message = `Estrazione completata. Trovate ${scanState.strings.length} stringhe.`;
    if(scanState.limitReached) {
        message = `Estrazione parziale. Raggiunto il limite di scansione. Trovate ${scanState.strings.length} stringhe.`
    }

    return NextResponse.json({
      message,
      strings: scanState.strings
    });

  } catch (error) {
    console.error("Errore durante l'estrazione delle stringhe:", error);
    return NextResponse.json({ message: "Errore interno del server durante l'estrazione." }, { status: 500 });
  }
}
