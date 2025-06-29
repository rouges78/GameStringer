import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface FoundFile {
    name: string;
    path: string;
    size: number;
}

const allowedExtensions = ['.txt', '.json', '.xml', '.ini'];

// Funzione ricorsiva per trovare i file con le estensioni desiderate
async function findFiles(dir: string, fileList: FoundFile[] = []): Promise<FoundFile[]> {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                // Continua la ricerca nelle sottocartelle, ignorando errori di permessi
                await findFiles(fullPath, fileList).catch(err => console.warn(`Impossibile leggere la cartella: ${fullPath}`, err));
            } else if (entry.isFile() && (entry.name.endsWith('.txt') || entry.name.endsWith('.json') || entry.name.endsWith('.xml'))) {
                const stats = await fs.stat(fullPath);
                fileList.push({
                    name: entry.name,
                    path: fullPath,
                    size: stats.size,
                });
            }
        }
    } catch (error) {
        console.warn(`Errore durante la scansione della cartella ${dir}:`, error);
    }
    return fileList;
}

export async function POST(req: NextRequest) {
    try {
        const { directoryPath } = await req.json();

        if (!directoryPath || typeof directoryPath !== 'string') {
            return NextResponse.json({ error: '`directoryPath` è richiesto e deve essere una stringa.' }, { status: 400 });
        }

        const files = await findFiles(directoryPath);
        return NextResponse.json(files);

    } catch (error: any) {
        console.error('Errore API in scan-files:', error);
        if (error.code === 'ENOENT') {
             return NextResponse.json({ error: `Cartella non trovata: ${error.path}` }, { status: 404 });
        }
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
