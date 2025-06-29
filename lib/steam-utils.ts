import fs from 'fs/promises';
import path from 'path';
import * as vdf from 'vdf-parser';

// Cache unificata per i dati delle app di Steam per evitare chiamate I/O ridondanti
const steamAppsCache = {
    timestamp: 0,
    data: [] as any[], // Salveremo qui l'array completo dei giochi
    TTL: 5 * 60 * 1000, // 5 minuti
};

/**
 * Funzione helper per importare dinamicamente 'steam-locate' in modo sicuro.
 */
async function getSteamLocateModule() {
  try {
    // Importiamo l'intero modulo per accedere a tutti i suoi export
    const steamLocateModule = await import('steam-locate');
    return steamLocateModule;
  } catch (error) {
    console.error("[steam-utils] Errore critico: impossibile caricare il modulo 'steam-locate'.", error);
    throw new Error("Modulo 'steam-locate' non trovato o corrotto.");
  }
}

/**
 * Funzione interna per ottenere e cachare l'elenco delle app Steam installate.
 */
async function getCachedSteamApps(): Promise<any[]> {
    const now = Date.now();
    if (now - steamAppsCache.timestamp < steamAppsCache.TTL && steamAppsCache.data.length > 0) {
        console.log(`[CACHE] Restituzione di ${steamAppsCache.data.length} app Steam dalla cache.`);
        return steamAppsCache.data;
    }

    try {
        console.log('[steam-locate] Chiamata a getInstalledSteamApps...');
        const steamLocate = await getSteamLocateModule();
        // Chiamiamo 'getInstalledSteamApps' come funzione esportata dal modulo
        const installedApps: any[] = await steamLocate.getInstalledSteamApps();
        console.log(`[steam-locate] Trovate ${installedApps.length} app installate.`);

        steamAppsCache.data = installedApps || []; // Assicura che sia sempre un array
        steamAppsCache.timestamp = now;

        return steamAppsCache.data;
    } catch (error) {
        console.error('[steam-locate] Errore durante la chiamata a getInstalledSteamApps:', error);
        steamAppsCache.data = []; // Svuota la cache in caso di errore
        steamAppsCache.timestamp = now; // Aggiorna il timestamp per evitare tentativi falliti a raffica
        return [];
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
 */
export async function getInstalledSteamGames(): Promise<InstalledGame[]> {
    const installedApps = await getCachedSteamApps();

    if (!installedApps || installedApps.length === 0) {
        return [];
    }

    const validApps = installedApps.filter(app => app && app.appId && app.name);

    return validApps.map(app => ({
        id: String(app.appId),
        name: app.name,
        provider: 'steam' as const,
    }));
}

/**
 * Trova il percorso di installazione di un gioco Steam specifico dato il suo appid.
 */
export async function findSteamGamePath(appid: string): Promise<string | null> {
    console.log(`[findSteamGamePath] Inizio ricerca per appid: '${appid}'`);
    try {
        const steamApps = await getCachedSteamApps();
        
        if (!steamApps || steamApps.length === 0) {
            console.warn('[findSteamGamePath] La lista di app da steam-locate è vuota. Impossibile procedere.');
            return null;
        }

        // Normalizziamo il confronto per evitare problemi di case-sensitivity
        // e logghiamo i tipi per un debug più facile.
        const game = steamApps.find(app => {
            const cachedAppId = app.appId || app.appid; // Prova entrambi i possibili case
            // console.log(`[DEBUG] Confronto: cache ID (${cachedAppId}, type: ${typeof cachedAppId}) vs. richiesto ID (${appid}, type: ${typeof appid})`);
            return String(cachedAppId).toLowerCase() === String(appid).toLowerCase();
        });

        if (game && game.installDir) {
            console.log(`[findSteamGamePath] Percorso trovato per appid '${appid}': ${game.installDir}`);
            // Aggiungiamo una verifica di esistenza del percorso
            try {
                await fs.access(game.installDir);
                return game.installDir;
            } catch (e) {
                console.error(`[findSteamGamePath] Errore: la directory '${game.installDir}' per il gioco '${game.name}' non è accessibile o non esiste.`);
                return null;
            }
        } else {
            const availableAppIds = steamApps.map(app => app.appId).join(', ');
            console.warn(`[findSteamGamePath] Gioco con appid '${appid}' non trovato nella cache.`);
            console.log(`[findSteamGamePath] AppID disponibili nella cache: [${availableAppIds}]`);
            return null;
        }
    } catch (error) {
        console.error('[findSteamGamePath] Errore imprevisto durante la ricerca del percorso:', error);
        return null;
    }
}

/**
 * Analizza i file .acf per estrarre l'ID, il nome e la lingua di un gioco.
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
