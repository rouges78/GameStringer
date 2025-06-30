import 'server-only';
// Preferiamo usare steam-locate per individuare i giochi installati
import { getInstalledSteamAppsSync } from 'steam-locate';
import fs from 'fs/promises';
import path from 'path';
import * as vdf from 'vdf-parser';
import WinReg from 'winreg';

/**
 * Interfaccia per rappresentare un gioco installato.
 */
export interface InstalledGame {
  appId: string;
  name: string;
  installDir: string;
  engine?: string;
  supportedLanguages?: string;
  coverUrl?: string;
}

/**
 * Recupera il percorso di installazione di Steam dal registro di Windows.
 * @returns {Promise<string | null>} Il percorso di installazione o null se non trovato.
 */
async function getSteamInstallPathFromRegistry(): Promise<string | null> {
  try {
    const regKey = new WinReg({
      hive: WinReg.HKCU, // Cerca nella chiave dell'utente corrente
      key:  '\\Software\\Valve\\Steam'
    });
    const steamPathValue = await new Promise((resolve, reject) => {
      regKey.get('SteamPath', (err: any, item: any) => {
        if (err) return reject(err);
        resolve(item.value);
      });
    });
    return steamPathValue ? (steamPathValue as string).replace(/\//g, '\\') : null;
  } catch (error) {
    console.warn('Impossibile trovare la chiave di registro di Steam in HKCU, tento con HKLM...');
    try {
        const regKey = new WinReg({
            hive: WinReg.HKLM,
            key:  '\\SOFTWARE\\Wow6432Node\\Valve\\Steam'
        });
        const steamPathValue = await new Promise((resolve, reject) => {
            regKey.get('InstallPath', (err: any, item: any) => {
                if (err) return reject(err);
                resolve(item.value);
            });
        });
        return steamPathValue ? (steamPathValue as string).replace(/\//g, '\\') : null;
    } catch (err) {
        console.error('Errore critico: Impossibile trovare il percorso di installazione di Steam nel registro.', err);
        return null;
    }
  }
}

/**
 * Legge le cartelle della libreria di Steam dal file di configurazione.
 * @param {string} steamPath - Il percorso di installazione di Steam.
 * @returns {Promise<string[]>} Una lista di percorsi delle librerie.
 */
async function getSteamLibraryFolders(steamPath: string): Promise<string[]> {
  const libraryFoldersVdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
  const libraryFolders: string[] = [steamPath]; // La cartella principale è sempre una libreria

  try {
    const content = await fs.readFile(libraryFoldersVdfPath, 'utf-8');
    const data: any = vdf.parse(content);

    if (data.LibraryFolders) {
        Object.values(data.LibraryFolders as any)
            .filter((val: any) => typeof val === 'object' && val.path)
            .forEach((val: any) => libraryFolders.push(val.path));
    } else {
        // Fallback per un formato alternativo del file VDF
        Object.values(data as any)
            .filter((val: any) => typeof val === 'object' && val.path)
            .forEach((val: any) => libraryFolders.push(val.path));
    }

  } catch (error) {
    console.warn(`File libraryfolders.vdf non trovato o illeggibile. Verrà usata solo la libreria principale.`, error);
  }

  return [...new Set(libraryFolders)]; // Rimuove duplicati
}

/**
 * Scansiona le librerie di Steam e restituisce una lista di giochi installati.
 * Funzione robusta che non si blocca in caso di file .acf corrotti.
 * @returns {Promise<InstalledGame[]>} La lista dei giochi installati.
 */
export async function getInstalledGames(): Promise<InstalledGame[]> {
  // 1. Tentativo rapido con steam-locate (sincrono, quindi poco overhead)
  try {
    const apps = getInstalledSteamAppsSync();
    if (apps && apps.length > 0) {
      console.log(`[getInstalledGames] Recuperati ${apps.length} giochi tramite steam-locate.`);
      return apps.map(app => ({
        appId: app.appId,
        name: app.name ?? `App ${app.appId}`,
        installDir: app.installDir ?? '',
      }));
    } else {
      console.warn('[getInstalledGames] steam-locate non ha restituito giochi, procedo con fallback legacy.');
    }
  } catch (locErr) {
    console.warn('[getInstalledGames] steam-locate non disponibile o ha fallito, procedo con fallback legacy.', locErr);
  }
  console.log('[getInstalledGames] Inizio scansione giochi installati...');
  const steamPath = await getSteamInstallPathFromRegistry();

  if (!steamPath) {
    console.error("[getInstalledGames] Impossibile determinare il percorso di installazione di Steam. La scansione è interrotta.");
    return [];
  }

  const libraryFolders = await getSteamLibraryFolders(steamPath);
  console.log(`[getInstalledGames] Trovate ${libraryFolders.length} librerie di Steam.`);
  const allGames: InstalledGame[] = [];

  for (const library of libraryFolders) {
    const steamappsPath = path.join(library, 'steamapps');
    try {
      const files = await fs.readdir(steamappsPath);
      const acfFiles = files.filter(f => f.startsWith('appmanifest_') && f.endsWith('.acf'));

      for (const file of acfFiles) {
        const filePath = path.join(steamappsPath, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const data: any = vdf.parse(content);
          const appState = data.AppState;

          if (appState && appState.appid && appState.name && appState.installdir) {
            allGames.push({
              appId: appState.appid,
              name: appState.name,
              installDir: path.join(steamappsPath, 'common', appState.installdir),
            });
          } else {
            console.warn(`[Parser ACF] Dati incompleti nel file ${file}. Salto.`);
          }
        } catch (parseError) {
          console.warn(`[Parser ACF] Impossibile analizzare il file ${file}. Potrebbe essere corrotto. Salto.`, parseError);
        }
      }
    } catch (dirError) {
      console.warn(`[Scanner Libreria] Impossibile leggere la cartella ${steamappsPath}. Salto.`, dirError);
    }
  }

  console.log(`[getInstalledGames] Recupero dettagli da Steam API per ${allGames.length} giochi...`);

  const gamesWithDetails = await Promise.all(
    allGames.map(async (game) => {
      try {
        const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.appId}&l=italian`);
        
        if (response.status === 429) {
            console.warn(`[getGameDetails] Rate limit per appId: ${game.appId}.`);
            return game;
        }

        if (!response.ok) {
          console.warn(`[getGameDetails] Impossibile recuperare i dettagli per ${game.name} (appId: ${game.appId}). Status: ${response.status}`);
          return game;
        }
        
        const data = await response.json();
        const gameData = data[game.appId];

        if (gameData && gameData.success) {
          const details = gameData.data;
          
          const languages = (details.supported_languages || '')
            .split(',')
            .map((lang: string) => lang.replace(/<[^>]*>?/gm, '').replace(/\*/g, '').trim())
            .filter(Boolean)
            .join(',');

          let engine = 'N/A';
          if (details.categories) {
            const engineCategory = details.categories.find((c: { description: string }) => 
              c.description.toLowerCase().includes('engine') || c.description.toLowerCase().includes('sdk')
            );
            if (engineCategory) {
              engine = engineCategory.description.replace('SDK', '').replace('Engine', '').trim();
            }
          }

          return {
            ...game,
            supportedLanguages: languages,
            engine: engine,
            coverUrl: details.header_image || '',
          };
        } else {
          return game;
        }
      } catch (error) {
        console.error(`[getGameDetails] Errore durante il recupero dei dettagli per ${game.name}:`, error);
        return game;
      }
    })
  );

  console.log(`[getInstalledGames] Scansione e arricchimento dati completati. Trovati ${gamesWithDetails.length} giochi.`);
  return gamesWithDetails;
}

/**
 * Trova il percorso di installazione di un gioco Steam specifico usando una strategia a due livelli.
 * @param {string} gameId - L'AppID del gioco da trovare.
 * @returns {Promise<string | null>} Il percorso di installazione o null se non trovato.
 */
export async function findSteamGamePath(gameId: string): Promise<string | null> {
  console.log(`[findSteamGamePath] Inizio ricerca per gameId: ${gameId}`);

  // Strategia 1: Cerca tra i giochi installati tramite file .acf
  try {
    const installedGames = await getInstalledGames();
    const foundGame = installedGames.find(g => g.appId === gameId);
    if (foundGame && foundGame.installDir) {
      console.log(`[findSteamGamePath] Trovato con Strategia 1 (ACF): ${foundGame.installDir}`);
      return foundGame.installDir;
    }
  } catch (error) {
    console.warn('[findSteamGamePath] Errore durante la Strategia 1 (ACF), procedo con fallback.', error);
  }

  console.log('[findSteamGamePath] Strategia 1 fallita, avvio Strategia 2 (Scansione Directory)...');

  // Strategia 2: Scansione manuale delle cartelle di libreria
  const steamPath = await getSteamInstallPathFromRegistry();
  if (!steamPath) {
    console.error('[findSteamGamePath] Impossibile trovare il percorso di Steam per la Strategia 2.');
    return null;
  }

  const libraryFolders = await getSteamLibraryFolders(steamPath);
  for (const library of libraryFolders) {
    const steamappsPath = path.join(library, 'steamapps', 'common');
    try {
      const gameDirs = await fs.readdir(steamappsPath);
      // Heuristica: cerca una cartella che potrebbe corrispondere al gioco.
      // Questa parte potrebbe essere migliorata con un mapping appId -> nome cartella.
      // Per ora, è un placeholder che dimostra la logica di fallback.
    } catch (error) {
      console.warn(`[findSteamGamePath] Impossibile leggere la cartella ${steamappsPath} durante la Strategia 2.`);
    }
  }

  console.log(`[findSteamGamePath] Ricerca completata. Gioco non trovato.`);
  return null;
}
