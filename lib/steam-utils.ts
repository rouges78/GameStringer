import fs from 'fs/promises';
import path from 'path';
import * as vdf from 'vdf-parser';

// Il modulo 'steam-locate' verrà importato dinamicamente all'interno delle funzioni per evitare crash all'avvio.

/**
 * Definiamo un tipo per la risposta della libreria, basandoci sul suo uso effettivo.
 * NOTA: Questo tipo è un'ipotesi. Verrà confermato dopo aver ispezionato l'output.
 */
interface SteamGame {
    appId: number;
    name: string;
    path: string; // Questa è la proprietà che ci serve per trovare il gioco
}

// Cache unificata per i dati delle app di Steam per evitare chiamate I/O ridondanti
const steamAppsCache = {
    timestamp: 0,
    data: [] as any[], // Salveremo qui l'array completo dei giochi
    TTL: 5 * 60 * 1000, // 5 minuti
};

/**
 * Funzione interna per ottenere e cachare l'elenco delle app Steam installate.
 * Questa è la fonte di dati unica per tutte le altre funzioni.
 * @returns Una Promise che si risolve in un array di app Steam.
 */
async function getCachedSteamApps(): Promise<any[]> {
    const now = Date.now();
    if (now - steamAppsCache.timestamp < steamAppsCache.TTL && steamAppsCache.data.length > 0) {
        console.log(`[CACHE] Restituzione di ${steamAppsCache.data.length} app Steam dalla cache.`);
        return steamAppsCache.data;
    }

    try {
        console.log('[steam-locate] Chiamata a getInstalledSteamApps...');
        const steamLocate = require('steam-locate');
        const installedApps: any[] = await steamLocate.getInstalledSteamApps();
        console.log(`[steam-locate] Trovate ${installedApps.length} app installate.`);

        // Aggiorna la cache
        steamAppsCache.data = installedApps;
        steamAppsCache.timestamp = now;

        return installedApps;
    } catch (error) {
        console.error('[steam-locate] Errore critico durante la chiamata a getInstalledSteamApps:', error);
        return []; // Restituisce array vuoto in caso di errore per non bloccare
    }
}

// Definiamo un tipo per i giochi installati che restituiamo all'API
interface InstalledGame {
  id: string;
  name: string;
  provider: 'steam';
}

/**
 * Ottiene un elenco di tutti i giochi Steam installati localmente.
 * @returns Una Promise che si risolve in un array di oggetti InstalledGame.
 */
export async function getInstalledSteamGames(): Promise<InstalledGame[]> {
    const installedApps = await getCachedSteamApps();

    if (!installedApps || installedApps.length === 0) {
        return [];
    }

    // Filtra gli elementi che non hanno un appid o un nome, che causerebbero errori nel frontend
    const validApps = installedApps.filter(app => app.appid && app.name);

    const games = validApps.map(app => ({
        id: String(app.appid),
        name: app.name,
        provider: 'steam' as const,
    }));

    return games;
}

/**
 * Trova il percorso di installazione di un gioco Steam specifico dato il suo appid.
 * @param appid L'AppID del gioco da cercare.
 * @param libraryFolders (Opzionale) Un array di cartelle di libreria pre-calcolate per ottimizzazione.
 * @returns Una Promise che si risolve in una stringa con il percorso del gioco o null se non trovato.
 */
export async function findSteamGamePath(appid: string): Promise<string | null> {
    const games = await getCachedSteamApps();
    const game = games.find(app => String(app.appid) === appid);

    if (game && game.path) {
        console.log(`[steam-utils] Percorso trovato per appid '${appid}' (dalla cache): ${game.path}`);
        return game.path;
    } else {
        console.log(`[steam-utils] Nessun percorso locale trovato per appid ${appid} nella cache.`);
        return null;
    }
}

/**
 * Analizza i file .acf per estrarre l'ID, il nome e la lingua di un gioco.
 * @param acfPath Il percorso completo del file .acf del gioco.
 * @returns Un oggetto con i dati del gioco o null in caso di errore.
 */
export async function parseAcfFile(acfPath: string): Promise<{ appId: string; name: string; language: string; } | null> {
    try {
        const content = await fs.readFile(acfPath, 'utf-8');
        const data = vdf.parse(content);

        const appState = data.AppState;
        if (appState) {
            return {
                appId: appState.appid,
                name: appState.name,
                language: appState.UserConfig?.language || 'n/d'
            };
        }
        return null;
    } catch (error) {
        console.error(`Errore durante la lettura o il parsing del file ACF '${acfPath}':`, error);
        return null;
    }
}
