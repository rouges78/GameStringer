import { NextResponse } from 'next/server';
import { GameScanResult } from '@/lib/types';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import SteamGridDB from 'steamgriddb';
const steamGridDbClient = new SteamGridDB(process.env.STEAMGRIDDB_API_KEY || '');

// Funzione per analizzare il file libraryfolders.vdf di Steam
async function getSteamLibraryFolders(): Promise<string[]> {
    const steamPath = 'C:/Program Files (x86)/Steam';
    const libraryFoldersVdf = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
    const libraryFolders: string[] = [path.join(steamPath, 'steamapps', 'common')];

    try {
        const data = await fs.readFile(libraryFoldersVdf, 'utf-8');
        const lines = data.split('\n');
        lines.forEach(line => {
            const match = line.match(/"path"\s+"(.+?)"/);
            if (match && match[1]) {
                libraryFolders.push(path.join(match[1].replace(/\\/g, '/'), 'steamapps', 'common'));
            }
        });
    } catch (error) {
        console.warn(`Impossibile leggere il file libraryfolders.vdf:`, error);
    }

    return libraryFolders;
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

async function scanDirectoryForGames(dir: string, platform: 'Steam' | 'GOG' | 'Epic Games'): Promise<GameScanResult[]> {
    const games: GameScanResult[] = [];
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const gamePath = path.join(dir, entry.name);
                const executable = await findLargestExe(gamePath);

                if (executable) {
                    let imageUrl: string | undefined = undefined;
                    try {
                        const normalizedName = normalizeGameName(entry.name);
                        console.log(`[SteamGridDB] Searching for game: "${entry.name}" (normalized to: "${normalizedName}")`);
                        const searchResults = await steamGridDbClient.searchGame(normalizedName);
                        
                        // Log avanzato per il debug delle copertine
                        if (searchResults.length === 0) {
                            console.warn(`[SteamGridDB] Nessun risultato per "${normalizedName}".`);
                        } else {
                            // Loggo i primi 3 risultati per vedere cosa trova l'API
                            console.log(`[SteamGridDB] Trovati ${searchResults.length} risultati per "${normalizedName}". Primi 3:`, JSON.stringify(searchResults.slice(0, 3), null, 2));
                        }

                        if (searchResults.length > 0) {
                            const gameId = searchResults[0].id;
                            console.log(`[SteamGridDB] Found game ID ${gameId} for "${entry.name}". Fetching grids...`);
                            const grids = await steamGridDbClient.getGrids({ type: 'game', id: gameId, styles: ['alternate'], dimensions: ['460x215', '920x430'] });
                            
                            if (grids.length > 0) {
                                imageUrl = grids[0].url;
                                console.log(`[SteamGridDB] Found image URL for "${entry.name}": ${imageUrl}`);
                            } else {
                                console.warn(`[SteamGridDB] No grids found for game ID ${gameId} ("${entry.name}").`);
                            }
                        } else {
                            console.warn(`[SteamGridDB] No search results found for "${entry.name}".`);
                        }
                    } catch (error) {
                        console.error(`[SteamGridDB] Error fetching cover for ${entry.name}:`, error);
                    }

                    games.push({
                        id: `${platform}-${entry.name}`,
                        title: entry.name,
                        platform: platform,
                        installPath: gamePath,
                        executablePath: executable.path,
                        imageUrl: imageUrl,
                        isInstalled: true,
                        createdAt: new Date().toISOString(), // <-- FIX: Converto la data in stringa ISO
                    });
                }
            }
        }
    } catch (error) {
        console.error(`Errore durante la scansione della directory ${dir}:`, error);
    }
    return games;
}

export async function POST() {
    try {
        console.log('Avvio scansione giochi...');

        const steamLibraryFolders = await getSteamLibraryFolders();
        const gogPath = 'C:/Program Files (x86)/GOG Galaxy/Games';
        const epicGamesPath = 'C:/Program Files/Epic Games';

        const allScanPromises = [
            ...steamLibraryFolders.map(folder => scanDirectoryForGames(folder, 'Steam')),
            scanDirectoryForGames(gogPath, 'GOG'),
            scanDirectoryForGames(epicGamesPath, 'Epic Games'),
        ];

        const allGamesArrays = await Promise.all(allScanPromises);
        const allGames = allGamesArrays.flat();

        console.log(`Trovati ${allGames.length} giochi. Salvataggio nel database...`);

        for (const game of allGames) {
            await prisma.game.upsert({
                where: { installPath: game.installPath },
                update: {
                    isInstalled: true,
                    executablePath: game.executablePath,
                    imageUrl: game.imageUrl,
                },
                create: {
                    title: game.title,
                    platform: game.platform,
                    installPath: game.installPath,
                    executablePath: game.executablePath,
                    imageUrl: game.imageUrl,
                    isInstalled: true,
                },
            });
        }

        console.log('Scansione e salvataggio completati.');

        return NextResponse.json({ newGames: allGames, gamesFound: allGames.length });

    } catch (error) {
        console.error("Errore durante la scansione dei giochi:", error);
        return NextResponse.json({ error: 'Errore durante la scansione dei giochi' }, { status: 500 });
    }
}
