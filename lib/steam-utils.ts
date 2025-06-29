import 'server-only';
import fs from 'fs/promises';
import path from 'path';
import * as vdf from 'vdf-parser';
import WinReg from 'winreg';

// --- Strategia di Ricerca Potenziata (Ispirata a RAI PAL) ---

/**
 * Cerca il percorso di installazione di Steam dal registro di Windows.
 * @returns {Promise<string | null>} Il percorso della cartella di installazione di Steam o null.
 */
async function getSteamInstallPathFromRegistry(): Promise<string | null> {
  try {
    const regKey = new WinReg({
      hive: WinReg.HKLM,
      key: '\\SOFTWARE\\WOW6432Node\\Valve\\Steam'
    });
    const installPathItem = await new Promise((resolve, reject) => {
      regKey.get('InstallPath', (err, item) => {
        if (err) return reject(err);
        resolve(item);
      });
    });
    // @ts-ignore
    return installPathItem?.value || null;
  } catch (error) {
    console.warn('[Registry] Impossibile trovare la chiave di registro di Steam:', error);
    return null;
  }
}

/**
 * Legge il file libraryfolders.vdf per ottenere tutte le cartelle della libreria di Steam.
 * @param {string} steamPath - Il percorso di installazione di Steam.
 * @returns {Promise<string[]>} Una lista di percorsi assoluti delle librerie Steam.
 */
async function getSteamLibraryFolders(steamPath: string): Promise<string[]> {
  const libraryFoldersVdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
  const libraryPaths: string[] = [path.join(steamPath)]; // La cartella principale è sempre una libreria

  try {
    const content = await fs.readFile(libraryFoldersVdfPath, 'utf-8');
    const data = vdf.parse(content);

    Object.values(data.libraryfolders || data.LibraryFolders).forEach((lib: any) => {
      if (typeof lib === 'object' && lib.path) {
        libraryPaths.push(lib.path);
      } else if (typeof lib === 'string') {
        // Per formati più vecchi
        libraryPaths.push(lib);
      }
    });

    console.log(`[VDF] Trovate ${libraryPaths.length} librerie Steam:`, libraryPaths);
    return [...new Set(libraryPaths)]; // Rimuovi duplicati
  } catch (error) {
    console.warn(`[VDF] Impossibile leggere o parsare libraryfolders.vdf. Uso solo la libreria principale. Errore:`, error);
    return libraryPaths;
  }
}

/**
 * Scansiona una cartella di libreria per trovare il percorso di un gioco tramite il suo file manifest .acf.
 * @param {string} libraryPath - Il percorso della libreria da scansionare.
 * @param {string} appid - L'ID dell'app da trovare.
 * @returns {Promise<string | null>} Il percorso di installazione del gioco o null.
 */
async function findGamePathInLibrary(libraryPath: string, appid: string): Promise<string | null> {
  const steamappsPath = path.join(libraryPath, 'steamapps');
  const manifestPath = path.join(steamappsPath, `appmanifest_${appid}.acf`);

  try {
    await fs.access(manifestPath);
    const content = await fs.readFile(manifestPath, 'utf-8');
    const data = vdf.parse(content);
    const installDirName = data?.AppState?.installdir;

    if (installDirName) {
      const gamePath = path.join(steamappsPath, 'common', installDirName);
      await fs.access(gamePath); // Verifica che la cartella esista
      console.log(`[ACF] Trovato percorso per appid ${appid} in ${libraryPath}: ${gamePath}`);
      return gamePath;
    }
    return null;
  } catch (error) {
    // Se il file non esiste (ENOENT) o altri errori, semplicemente non è qui.
    return null;
  }
}

/**
 * Trova il percorso di installazione di un gioco Steam specifico dato il suo appid, usando una strategia a cascata.
 */
export async function findSteamGamePath(appid: string): Promise<string | null> {
  console.log(`[Ricerca Potenziata] Inizio ricerca per appid: '${appid}'`);

  // Strategia 1: Prova con 'steam-locate' (veloce e basato su cache)
  try {
    const steamLocateModule = await import('steam-locate');
    const gamePath = await steamLocateModule.getAppPathById(Number(appid));
    if (gamePath) {
        await fs.access(gamePath);
        console.log(`[Strategia 1 - steam-locate] Successo! Percorso trovato: ${gamePath}`);
        return gamePath;
    }
  } catch (error) {
      console.warn('[Strategia 1 - steam-locate] Fallita o non ha trovato il gioco:', error);
  }

  console.log('[Ricerca Potenziata] Strategia 1 fallita. Avvio Strategia 2: Scansione manuale librerie.');

  // Strategia 2: Scansione manuale tramite registro e file VDF
  const steamPath = await getSteamInstallPathFromRegistry();
  if (!steamPath) {
    console.error('[Strategia 2] Fallimento critico: impossibile trovare la cartella di Steam nel registro.');
    return null;
  }

  const libraryFolders = await getSteamLibraryFolders(steamPath);
  for (const library of libraryFolders) {
    const gamePath = await findGamePathInLibrary(library, appid);
    if (gamePath) {
      console.log(`[Strategia 2 - Scansione ACF] Successo! Percorso trovato: ${gamePath}`);
      return gamePath;
    }
  }

  console.error(`[Ricerca Potenziata] Tutte le strategie sono fallite. Impossibile trovare il percorso per l'appid ${appid}.`);
  return null;
}



/**
 * Analizza i file .acf per estrarre i dati principali di un gioco.
 */
export async function parseAcfFile(acfPath: string): Promise<{ appId: string; name: string; language: string; installDir: string; } | null> {
    try {
        const content = await fs.readFile(acfPath, 'utf-8');
        const data = vdf.parse(content);

        const appState = data.AppState;
        if (appState && appState.appid && appState.name && appState.installdir) {
            return {
                appId: appState.appid,
                name: appState.name,
                language: appState.UserConfig?.language || 'n/d',
                installDir: appState.installdir,
            };
        }
        return null;
    } catch (error) {
        console.error(`Errore durante la lettura o il parsing del file ACF '${acfPath}':`, error);
        return null;
    }
}

// --- Funzioni per ottenere la lista completa dei giochi --- 

export interface InstalledGame {
  appId: string;
  name: string;
  installDir: string;
  path: string; // Full path to the installation directory
}

/**
 * Scansiona tutte le librerie di Steam per trovare tutti i giochi installati.
 * @returns Una promessa che si risolve in un array di oggetti InstalledGame.
 */
export async function getAllInstalledSteamGames(): Promise<InstalledGame[]> {
  console.log('[steam-utils] Avvio della ricerca di tutti i giochi Steam installati...');
  const allGames: InstalledGame[] = [];
  
  const steamPath = await getSteamInstallPathFromRegistry();
  if (!steamPath) {
    console.error('[steam-utils] Impossibile trovare il percorso di installazione di Steam dal registro.');
    return [];
  }

  const libraryFolders = await getSteamLibraryFolders(steamPath);

  for (const libraryPath of libraryFolders) {
    try {
      const steamappsPath = path.join(libraryPath, 'steamapps');
      const files = await fs.readdir(steamappsPath);
      const acfFiles = files.filter(f => f.startsWith('appmanifest_') && f.endsWith('.acf'));

      for (const acfFile of acfFiles) {
        const acfPath = path.join(steamappsPath, acfFile);
        const gameData = await parseAcfFile(acfPath);
        if (gameData) {
          allGames.push({
            ...gameData,
            path: path.join(steamappsPath, 'common', gameData.installDir),
          });
        }
      }
    } catch (error) {
      console.error(`[steam-utils] Errore durante la scansione della libreria ${libraryPath}:`, error);
    }
  }

  console.log(`[steam-utils] Ricerca completata. Trovati in totale ${allGames.length} giochi.`);
  return allGames;
}
