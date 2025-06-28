import fs from 'fs/promises';
import path from 'path';
const Steam = require('steam-locate');
import { parse } from 'vdf-parser';

interface LibraryFoldersVdf {
  libraryfolders: { [key: string]: { path: string } };
}

interface AppManifestAcf {
  AppState?: { installdir?: string };
}

const steam = new Steam();

export async function getSteamLibraryFolders(): Promise<string[]> {
    try {
        const steamPath = await steam.find();
        if (!steamPath) {
            console.warn('Percorso di Steam non trovato da steam-locate.');
            return [];
        }

        const libraryFoldersVdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
        const libraryPaths: string[] = [steamPath];

        try {
            const content = await fs.readFile(libraryFoldersVdfPath, 'utf-8');
            let data: LibraryFoldersVdf;
            try {
                data = parse(content) as LibraryFoldersVdf;
            } catch (parseError) {
                console.error('Errore di parsing per libraryfolders.vdf, il file potrebbe essere corrotto:', parseError);
                data = { libraryfolders: {} }; // Procedi con un oggetto vuoto
            }
            
            if (data && data.libraryfolders && typeof data.libraryfolders === 'object') {
                const parsedPaths = Object.values(data.libraryfolders)
                    .map((lib: any) => lib && lib.path)
                    .filter((p): p is string => typeof p === 'string' && p.length > 0);
                libraryPaths.push(...parsedPaths);
            }
        } catch (e: any) {
             if (e.code !== 'ENOENT') {
                console.warn(`Errore durante la lettura di libraryfolders.vdf:`, e);
            } else {
                // File non trovato, è normale se l'utente non ha librerie custom
            }
        }

        // Normalizza e deduplica tutti i percorsi per sicurezza
        const normalizedPaths = new Set(libraryPaths.map(p => path.normalize(p).replace(/\\/g, '/')));
        return Array.from(normalizedPaths);

    } catch (error) {
        console.error('Errore critico in getSteamLibraryFolders:', error);
        throw new Error(`Fallimento critico durante la ricerca delle librerie Steam: ${error}`);
    }
}

export async function findSteamGamePath(appId: string, libraryFolders: string[]): Promise<string | null> {
    if (libraryFolders.length === 0) {
        return null;
    }

    const manifestFile = `appmanifest_${appId}.acf`;

    for (const libraryPath of libraryFolders) {
        try {
            const manifestPath = path.join(libraryPath, 'steamapps', manifestFile);
            const stats = await fs.stat(manifestPath);

            if (stats.isFile()) {
                const content = await fs.readFile(manifestPath, 'utf-8');
                let data: AppManifestAcf;
                try {
                    data = parse(content) as AppManifestAcf;
                } catch (parseError) {
                    console.error(`Errore di parsing per ${manifestFile}, il file potrebbe essere corrotto:`, parseError);
                    continue; // Salta questo gioco e passa al successivo
                }

                const installDir = data.AppState?.installdir;

                if (installDir) {
                    const gamePath = path.join(libraryPath, 'steamapps', 'common', installDir);
                    // Verifica l'esistenza della cartella prima di restituirla
                    try {
                        await fs.access(gamePath);
                        return gamePath;
                    } catch (accessError) {
                        // La cartella non esiste, anche se il manifest la dichiara
                        continue;
                    }
                }
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                // Non mostriamo warning per file non trovati, è normale durante la ricerca
            }
        }
    }

    return null;
}
