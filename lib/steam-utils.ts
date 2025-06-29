import fs from 'fs/promises';
import path from 'path';
// Usiamo la sintassi require per la massima compatibilità con moduli CJS come questo.
const steamLocate = require('steam-locate'); 
import { parse } from 'vdf-parser';

// Definiamo un tipo per la risposta della libreria, basandoci sul suo uso effettivo.
interface SteamGame {
    appid: string;
    path: string;
    // Aggiungere altre proprietà se necessario
}

interface AcfFile {
  AppState?: { installdir?: string };
}

/**
 * Trova tutte le cartelle della libreria di Steam.
 * Questa implementazione si basa su un esempio funzionante e gestisce le eccentricità del pacchetto.
 */
export async function getSteamLibraryFolders(): Promise<string[]> {
    try {
        // La funzione `getInstalledGames` è un metodo dell'oggetto importato.
                const games: SteamGame[] = await steamLocate.getInstalledSteamApps();
        
        if (!Array.isArray(games) || games.length === 0) {
            console.warn('Nessun gioco Steam installato trovato o formato dati non corretto.');
            return [];
        }

        const libraryPaths = new Set<string>();

        for (const game of games) {
            if (game && game.path) {
                const libraryPath = path.dirname(path.dirname(path.dirname(game.path)));
                libraryPaths.add(libraryPath);
            }
        }
        
        const uniquePaths = Array.from(libraryPaths);
        console.log('Cartelle della libreria di Steam trovate:', uniquePaths);
        return uniquePaths;

    } catch (error) {
        console.error('Errore durante il recupero delle cartelle della libreria di Steam:', error);
        return [];
    }
}

/**
 * Trova il percorso di installazione di un gioco Steam specifico dato il suo AppID.
 */
export async function findSteamGamePath(gameId: string): Promise<string | null> {
    try {
        const libraryFolders = await getSteamLibraryFolders();
        if (libraryFolders.length === 0) {
            console.warn('Nessuna cartella della libreria di Steam trovata.');
            return null;
        }

        for (const folder of libraryFolders) {
            const acfPath = path.join(folder, 'steamapps', `appmanifest_${gameId}.acf`);
            try {
                await fs.access(acfPath);
                const acfContent = await fs.readFile(acfPath, 'utf-8');
                const acfData = parse(acfContent) as AcfFile;
                if (acfData.AppState?.installdir) {
                    const gamePath = path.join(folder, 'steamapps', 'common', acfData.AppState.installdir);
                    await fs.access(gamePath);
                    return gamePath;
                }
            } catch (error) {
                continue;
            }
        }

        console.warn(`Percorso di gioco non trovato per l'AppID: ${gameId}`);
        return null;
    } catch (error) {
        console.error(`Errore nella ricerca del percorso per l'AppID ${gameId}:`, error);
        return null;
    }
}
