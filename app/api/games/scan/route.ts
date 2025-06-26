import { NextResponse } from 'next/server';
import { GameScanResult } from '@/lib/types';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import SteamGridDB from 'steamgriddb';
const steamGridDbClient = new SteamGridDB(process.env.STEAMGRIDDB_API_KEY || '');

// Funzione per analizzare il file libraryfolders.vdf di Steam e restituire i percorsi radice delle librerie
async function getSteamLibraryFolders(): Promise<string[]> {
    const steamPath = 'C:/Program Files (x86)/Steam';
    const libraryFoldersVdf = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
    const libraryPaths: string[] = [steamPath]; // La libreria di default

    try {
        const data = await fs.readFile(libraryFoldersVdf, 'utf-8');
        const lines = data.split('\n');
        lines.forEach(line => {
            const match = line.match(/"path"\s+"(.+?)"/);
            if (match && match[1]) {
                // Aggiunge il percorso radice della libreria, normalizzando i backslash
                libraryPaths.push(match[1].replace(/\\\\/g, '/'));
            }
        });
    } catch (error) {
        console.warn(`Impossibile leggere il file libraryfolders.vdf:`, error);
    }

    return Array.from(new Set(libraryPaths)); // Rimuove eventuali duplicati e converte in array
}

// Funzione per trovare l'eseguibile più grande in una cartella
async function findLargestExe(dir: string): Promise<{ path: string; size: number } | null> {
    try {
        const files = await fs.readdir(dir, { withFileTypes: true });
        let largestExe = null;
        for (const file of files) {
            if (file.isFile() && path.extname(file.name).toLowerCase() === '.exe') {
                const filePath = path.join(dir, file.name);
                const stats = await fs.stat(filePath);
                if (!largestExe || stats.size > largestExe.size) {
                    largestExe = { path: filePath, size: stats.size };
                }
            }
        }
        return largestExe;
    } catch (error) {
        console.warn(`Impossibile scansionare la directory ${dir}:`, error);
        return null;
    }
}

// Funzione per scansionare una directory alla ricerca di giochi
// Funzione per "pulire" il nome di un gioco per la ricerca
function normalizeGameName(name: string): string {
    return name
        .replace(/_/g, ' ') // Sostituisce underscore con spazi
        .replace(/-/g, ' ') // Sostituisce trattini con spazi
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Inserisce uno spazio tra camelCase (es. DreadDawn -> Dread Dawn)
        .replace(/\s+/g, ' ') // Rimuove spazi multipli
        .replace(/[^a-zA-Z0-9\s]/g, '') // Rimuove caratteri non alfanumerici (tranne spazi)
        .trim()
        .toLowerCase();
}

// Nuova funzione specifica per la scansione dei giochi Steam tramite i file manifest
async function scanSteamGames(libraryPath: string): Promise<GameScanResult[]> {
    const steamAppsPath = path.join(libraryPath, 'steamapps');
    const commonPath = path.join(steamAppsPath, 'common');
    const games: GameScanResult[] = [];

    try {
        const files = await fs.readdir(steamAppsPath);
        const manifestFiles = files.filter(f => f.startsWith('appmanifest_') && f.endsWith('.acf'));

        for (const manifestFile of manifestFiles) {
            const filePath = path.join(steamAppsPath, manifestFile);
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                
                const appIdMatch = content.match(/"appid"\s+"(\d+)"/);
                const nameMatch = content.match(/"name"\s+"(.+?)"/);
                const installDirMatch = content.match(/"installdir"\s+"(.+?)"/);

                if (appIdMatch && nameMatch && installDirMatch) {
                    const steamAppId = parseInt(appIdMatch[1], 10);
                    const title = nameMatch[1];
                    const installDir = installDirMatch[1];
                    const gamePath = path.join(commonPath, installDir);

                    // Verifica se la cartella del gioco esiste effettivamente
                    try {
                        await fs.access(gamePath);
                    } catch {
                        console.warn(`Cartella di installazione non trovata per ${title} (${gamePath}), gioco saltato.`);
                        continue; // Salta questo gioco se la cartella non esiste
                    }

                    const executable = await findLargestExe(gamePath);
                    let imageUrl: string | undefined = undefined;

                    try {
                        const grids = await steamGridDbClient.getGrids({ type: 'steam' as any, id: steamAppId, styles: ['alternate'], dimensions: ['460x215', '920x430'] });
                        if (grids.length > 0) {
                            imageUrl = grids[0].url;
                        } else {
                             console.warn(`[SteamGridDB] Nessuna copertina trovata per Steam AppID ${steamAppId} ("${title}").`);
                        }
                    } catch (error: any) {
                        // Gestione intelligente degli errori di SteamGridDB
                        // Gli errori 404 sono comuni per demo o titoli minori e non devono causare un crash.
                        // Vengono gestiti come un avviso, mentre altri errori vengono loggati come criticità.
                        if (error.isAxiosError && error.response?.status === 404) {
                            console.warn(`[SteamGridDB] Copertina non trovata (404) per ${title} (AppID: ${steamAppId}).`);
                        } else {
                            console.error(`[SteamGridDB] Errore imprevisto per ${title}:`, error.message);
                        }
                    }

                    games.push({
                        id: `Steam-${steamAppId}`,
                        steamAppId: steamAppId,
                        title: title,
                        platform: 'Steam',
                        installPath: gamePath,
                        executablePath: executable ? executable.path : undefined,
                        imageUrl: imageUrl,
                        isInstalled: true,
                        createdAt: new Date().toISOString(),
                    });
                }
            } catch (error) {
                console.warn(`Impossibile leggere o analizzare il file manifest ${manifestFile}:`, error);
            }
        }
    } catch (error) {
        console.error(`Errore durante la scansione della directory Steam ${steamAppsPath}:`, error);
    }
    
    return games;
}

export async function POST() {
    try {
        console.log('Avvio scansione giochi...');

        const steamLibraryFolders = await getSteamLibraryFolders();

        // Scansiona solo Steam per ora, come da focus attuale
        const allScanPromises = [
            ...steamLibraryFolders.map(folder => scanSteamGames(folder)),
        ];

        const allGamesArrays = await Promise.all(allScanPromises);
        const allGames = allGamesArrays.flat();

        console.log(`Trovati ${allGames.length} giochi installati. Salvataggio nel database...`);

        // Aggiorna o crea i giochi nel database
        for (const game of allGames) {
            await prisma.game.upsert({
                where: { installPath: game.installPath },
                update: {
                    isInstalled: true,
                    executablePath: game.executablePath,
                    imageUrl: game.imageUrl,
                    steamAppId: game.steamAppId,
                },
                create: {
                    title: game.title,
                    platform: game.platform,
                    installPath: game.installPath,
                    executablePath: game.executablePath,
                    imageUrl: game.imageUrl,
                    isInstalled: true,
                    steamAppId: game.steamAppId,
                },
            });
        }
        
        // Imposta 'isInstalled' a false per i giochi che non sono più stati trovati
        const installedPaths = allGames.map(g => g.installPath);
        await prisma.game.updateMany({
            where: {
                platform: 'Steam', // Aggiorna solo lo stato dei giochi Steam
                installPath: {
                    notIn: installedPaths,
                },
            },
            data: {
                isInstalled: false,
            },
        });

        console.log('Scansione e salvataggio completati.');

        return NextResponse.json({ message: `Scansione completata. Trovati ${allGames.length} giochi installati.`, gamesFound: allGames.length });

    } catch (error) {
        console.error("Errore durante la scansione dei giochi:", error);
        return NextResponse.json({ error: 'Errore durante la scansione dei giochi' }, { status: 500 });
    }
}
