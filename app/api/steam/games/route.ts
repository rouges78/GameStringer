import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import path from 'path';
import { promises as fs } from 'fs';
import { SteamGame } from '@/lib/types';
import { prisma } from '@/lib/prisma';

// --- Caching Configuration ---
const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const CACHE_FILE_PATH = path.join(CACHE_DIR, 'steam-games.json');
const CACHE_TTL_HOURS = 24; // Time-to-live for the cache in hours

// Funzione per attendere un certo tempo (per il rate limiting)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Funzione per leggere la cache
async function readCache() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const fileContent = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
    const cacheData = JSON.parse(fileContent);
    
    const cacheAgeHours = (Date.now() - cacheData.timestamp) / (1000 * 60 * 60);
    if (cacheAgeHours < CACHE_TTL_HOURS) {
      console.log('[API/STEAM/GAMES] Serving from fresh cache.');
      return cacheData.games;
    }
    console.log('[API/STEAM/GAMES] Cache is stale.');
    return null;
  } catch (error) {
    console.log('[API/STEAM/GAMES] Cache not found or invalid. Fetching from source.');
    return null;
  }
}

// Funzione per scrivere nella cache
async function writeCache(games: any[]) {
  try {
    const cacheData = {
      timestamp: Date.now(),
      games: games,
    };
    await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2));
    console.log('[API/STEAM/GAMES] Cache updated successfully.');
  } catch (error) {
    console.error('[API/STEAM/GAMES] Failed to write cache:', error);
  }
}

// Funzione per parsare i giochi condivisi dal file XML (versione robusta e compatibile)
async function parseSharedGamesXml(): Promise<{ appid: number; name: string; owner_steamid?: string }[]> {
  try {
    const xmlPath = path.join(process.cwd(), 'data', 'steam_shared_games.xml');
    console.log(`[API/STEAM/GAMES] Attempting to read XML from: ${xmlPath}`);
    const xmlContent = await fs.readFile(xmlPath, 'utf-8');
    console.log(`[API/STEAM/GAMES] Successfully read XML file, length: ${xmlContent.length} characters.`);

    // Regex compatibile che usa [\s\S] al posto della flag 's' (dotAll)
    const gameRegex = /<game>[\s\S]*?<appID>(\d+)<\/appID>[\s\S]*?<name><!\[CDATA\[([\s\S]*?)\]\]><\/name>[\s\S]*?<\/game>/g;
    
    // Loop 'while' compatibile al posto di 'matchAll'
    const matches = [];
    let match;
    while ((match = gameRegex.exec(xmlContent)) !== null) {
        matches.push(match);
    }

    console.log(`[API/STEAM/GAMES] Found ${matches.length} game blocks in XML.`);

    if (matches.length === 0) {
      console.warn('[API/STEAM/GAMES] No valid <game> blocks found in XML. Check file content and format.');
      return [];
    }

    const sharedGames = matches.map(match => {
      const appid = parseInt(match[1], 10);
      const name = match[2];
      return { appid, name, owner_steamid: '76561198135965127' }; // Owner ID hardcoded
    }).filter(game => game.appid > 0);

    console.log(`[API/STEAM/GAMES] Parsed ${sharedGames.length} shared games from XML file.`);
    return sharedGames;

  } catch (error: any) {
    if (error.code === 'ENOENT') {
        console.warn('[API/STEAM/GAMES] steam_shared_games.xml not found in data directory. Skipping XML parse.');
    } else {
        console.error('[API/STEAM/GAMES] CRITICAL: Failed to read or parse shared games XML:', error.message);
    }
    return [];
  }
}

// Definisce un tipo di base per i giochi restituiti dalle API iniziali di Steam
interface SteamApiGame {
    appid: number;
    name: string;
    [key: string]: any; // Accetta altri campi non definiti
}

async function saveGamesToDb(games: SteamGame[]) {
    if (games.length === 0) {
        console.log('[API/STEAM/GAMES] No games to save.');
        return;
    }

    try {
        console.log('[API/STEAM/GAMES] Clearing existing games...');
        await prisma.game.deleteMany({});
    } catch (error) {
        console.error('[API/STEAM/GAMES] Error clearing games from DB:', error);
    }

    const gamesToSave = games.map(game => ({
        steamAppId: game.appid, // Corretto: nome 'steamAppId' e tipo numerico
        title: game.name,
        platform: 'Steam',
        installPath: '',
        isVr: game.isVr,
        engine: game.engine,
        lastPlayed: game.last_played ? new Date(game.last_played * 1000) : null,
        isInstalled: game.is_installed,
        isShared: game.is_shared,
    }));

    try {
        console.log(`[API/STEAM/GAMES] Saving ${games.length} games to database...`);
        await prisma.game.createMany({
            data: gamesToSave,
        });
        console.log(`[API/STEAM/GAMES] Successfully saved ${games.length} games.`);
    } catch (error) {
        console.error('[API/STEAM/GAMES] Error saving games to DB:', error);
        if (process.env.NODE_ENV === 'development') {
            console.error('[API/STEAM/GAMES] Data that caused the error:', JSON.stringify(gamesToSave, null, 2));
        }
    }
}

async function fetchGamesFromSteam(apiKey: string, steamId: string, steamLoginSecureCookie: string | undefined): Promise<SteamGame[]> {
    console.time('[PERF] fetchGamesFromSteam total');

    // 1. Get owned games with retry logic
    console.time('[PERF] GetOwnedGames');
    console.log('[API/STEAM/GAMES] Fetching owned games...');
    const ownedGamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json&include_appinfo=true&include_played_free_games=true`;
    
    let ownedGamesResponseData: any;
    let attempts = 0;
    const maxAttempts = 5;
    while (attempts < maxAttempts) {
        try {
            const ownedGamesResponse = await fetch(ownedGamesUrl);
            if (ownedGamesResponse.status === 429) {
                const delay = Math.pow(2, attempts) * 1000;
                console.warn(`[API/STEAM/GAMES] Rate limited on GetOwnedGames. Retrying in ${delay / 1000}s...`);
                await sleep(delay);
                attempts++;
                continue;
            }
            if (!ownedGamesResponse.ok) {
                throw new Error(`Steam API (GetOwnedGames) failed with status: ${ownedGamesResponse.status}`);
            }
            ownedGamesResponseData = await ownedGamesResponse.json();
            break; // Success
        } catch (error: any) {
            console.error(`[API/STEAM/GAMES] Attempt ${attempts + 1} to fetch owned games failed: ${error.message}`);
            if (attempts >= maxAttempts - 1) {
                console.error('[API/STEAM/GAMES] Final attempt to fetch owned games failed.');
                throw error;
            }
            attempts++;
            await sleep(Math.pow(2, attempts) * 1000);
        }
    }
    const ownedGames = ownedGamesResponseData.response?.games || [];
    console.log(`[API/STEAM/GAMES] Found ${ownedGames.length} owned games.`);
    console.timeEnd('[PERF] GetOwnedGames');

    const allGames: SteamApiGame[] = [...ownedGames];
    const allAppIds = new Set(allGames.map(g => g.appid));
    const initialOwnedAppIds = new Set(allAppIds);

    // 2. Get shared games using the new Family Sharing API
    console.time('[PERF] GetSharedLibraryApps');
    let sharedGamesFound = 0;

    // Prima prova a leggere dal file XML locale
    const xmlSharedGames = await parseSharedGamesXml();
    if (xmlSharedGames.length > 0) {
        console.log('[API/STEAM/GAMES] Using shared games from XML file...');
        for (const sharedGame of xmlSharedGames) {
            if (!allAppIds.has(sharedGame.appid)) {
                allGames.push(sharedGame);
                allAppIds.add(sharedGame.appid);
                sharedGamesFound++;
            }
        }
        console.log(`[API/STEAM/GAMES] Added ${sharedGamesFound} unique shared games from XML file.`);
    } else if (steamLoginSecureCookie) {
        // Fallback alla Family API se il file XML non è disponibile o è vuoto
        console.log('[API/STEAM/GAMES] XML file not available or empty, trying Family API as fallback...');
        try {
            const cookie = steamLoginSecureCookie;
            
            const familyGroupUrl = `https://api.steampowered.com/IFamilyGroupsService/GetFamilyGroupForUser/v1/?steamid=${steamId}`;
            const familyGroupResponse = await fetch(familyGroupUrl, { headers: { 'Cookie': cookie } });
            
            if (!familyGroupResponse.ok) {
                throw new Error(`Failed to fetch family group: ${familyGroupResponse.statusText} (${familyGroupResponse.status})`);
            }
            const familyGroupData = await familyGroupResponse.json();
            const familyGroupId = familyGroupData.response?.family_groupid;

            if (!familyGroupId) {
                console.warn('[API/STEAM/GAMES] Could not retrieve Family Group ID via API. User may not be in a family, or the cookie is invalid/expired.');
            } else {
                console.log(`[API/STEAM/GAMES] Found Family Group ID via API: ${familyGroupId}`);
                const sharedAppsUrl = `https://api.steampowered.com/IFamilyGroupsService/GetSharedLibraryApps/v1/?family_groupid=${familyGroupId}&include_own=false`;
                const sharedAppsResponse = await fetch(sharedAppsUrl, { headers: { 'Cookie': cookie } });

                if (!sharedAppsResponse.ok) {
                    throw new Error(`Failed to fetch shared library apps: ${sharedAppsResponse.statusText} (${sharedAppsResponse.status})`);
                }
                const sharedAppsData = await sharedAppsResponse.json();
                const sharedApps = sharedAppsData.response?.apps || [];
                
                for (const app of sharedApps) {
                    if (app.appid && !allAppIds.has(app.appid)) {
                        allGames.push({ appid: app.appid, name: app.name || 'Unknown Shared Game', owner_steamid: app.owner_steamid });
                        allAppIds.add(app.appid);
                        sharedGamesFound++;
                    }
                }
                console.log(`[API/STEAM/GAMES] Found and added ${sharedGamesFound} unique shared games from Family API.`);
            }
        } catch (e: any) {
            console.error('[API/STEAM/GAMES] CRITICAL: Fallback to Family API also failed.', e.message);
        }
    } else {
        console.warn('[API/STEAM/GAMES] No XML file and no STEAM_LOGIN_SECURE_COOKIE set. Skipping shared games fetch.');
    }
    console.timeEnd('[PERF] GetSharedLibraryApps');

    // 3. Enrich games with details (robust batching with single-file fallback)
    console.time('[PERF] Enrichment');
    console.log(`[API/STEAM/GAMES] Total unique games to process: ${allGames.length}. Starting enrichment...`);
    
    const enrichedDetailsMap = new Map<number, any>();
    const batchSize = 50;
    const batchDelay = 2000; // 2 seconds between batches

    for (let i = 0; i < allGames.length; i += batchSize) {
        const batch = allGames.slice(i, i + batchSize);
        const appids = batch.map(g => g.appid).join(',');
        const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${appids}&cc=us&l=en`;
        
        console.log(`[API/STEAM/GAMES] Enriching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allGames.length / batchSize)}...`);
        
        try {
            const detailsResponse = await fetch(detailsUrl);
            if (!detailsResponse.ok) throw new Error(`Batch fetch failed with status ${detailsResponse.status}`);

            const detailsData = await detailsResponse.json();
            let allSuccess = true;
            for (const appid in detailsData) {
                if (!detailsData[appid].success) {
                    allSuccess = false;
                    break;
                }
            }

            if (allSuccess) {
                for (const appid in detailsData) {
                    enrichedDetailsMap.set(Number(appid), detailsData[appid].data);
                }
            } else {
                throw new Error('At least one AppID in batch failed, falling back to single requests.');
            }

        } catch (error: any) {
            console.warn(`[API/STEAM/GAMES] Batch enrichment failed: ${error.message}. Falling back to single requests for this batch.`);
            for (const game of batch) {
                try {
                    await sleep(200); // Small delay between single requests
                    const singleUrl = `https://store.steampowered.com/api/appdetails?appids=${game.appid}&cc=us&l=en`;
                    const singleResponse = await fetch(singleUrl);
                    if (singleResponse.ok) {
                        const singleData = await singleResponse.json();
                        if (singleData[String(game.appid)]?.success) {
                            enrichedDetailsMap.set(game.appid, singleData[String(game.appid)].data);
                        }
                    }
                } catch (singleError: any) {
                    console.error(`[API/STEAM/GAMES] Failed to fetch single AppID ${game.appid}: ${singleError.message}`);
                }
            }
        }

        if (i + batchSize < allGames.length) {
            console.log(`[API/STEAM/GAMES] Batch processed. Waiting for ${batchDelay / 1000}s...`);
            await sleep(batchDelay);
        }
    }
    console.timeEnd('[PERF] Enrichment');

    // 4. Map, detect VR/engine, filter, and sort
    console.time('[PERF] Final Mapping and Sorting');
    const enrichedGames = allGames.map((game): SteamGame | null => {
        const details = enrichedDetailsMap.get(game.appid);
        if (!details) {
            return null; // Skip if enrichment failed
        }

        const categories = details.categories || [];
        const isVr = categories.some((cat: { id: number }) => cat.id === 28 || cat.id === 38);

        let engine = 'Unknown';
        const textCorpus = [
            (details.name || ''),
            (details.short_description || ''),
            (details.detailed_description || ''),
            (details.about_the_game || ''),
            ...categories.map((c: { description: string }) => c.description)
        ].join(' ').toLowerCase();

        if (textCorpus.includes('unreal')) engine = 'Unreal Engine';
        else if (textCorpus.includes('unity')) engine = 'Unity';
        else if (textCorpus.includes('source 2')) engine = 'Source 2';
        else if (textCorpus.includes('source')) engine = 'Source Engine';
        else if (textCorpus.includes('id tech')) engine = 'id Tech';
        else if (textCorpus.includes('cryengine')) engine = 'CryEngine';

        return {
            appid: game.appid,
            name: details.name || game.name,
            playtime_forever: game.playtime_forever || 0,
            img_icon_url: game.img_icon_url || '',
            img_logo_url: game.img_logo_url || '',
            isVr: isVr,
            engine: engine,
            last_played: (game as any).rtime_last_played || 0,
            is_installed: false, // Placeholder
            is_shared: !initialOwnedAppIds.has(game.appid),
        };
    }).filter((game): game is SteamGame => game !== null && !!game.name && game.name.trim() !== '');
    
    const finalGames = enrichedGames.sort((a, b) => a.name.localeCompare(b.name));

    const skippedCount = allGames.length - finalGames.length;
    if (skippedCount > 0) {
        console.warn(`[API/STEAM/GAMES] Skipped ${skippedCount} games that could not be enriched or had no name.`);
    }
    console.timeEnd('[PERF] Final Mapping and Sorting');

    console.log(`\n[API/STEAM/GAMES] Enrichment process completed. Returning ${finalGames.length} games.`);
    console.timeEnd('[PERF] fetchGamesFromSteam total');
    return finalGames;
}


export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const apiKey = process.env.STEAM_API_KEY;
  const steamId = session?.user?.steam?.steamid;

  if (!steamId || !apiKey) {
    console.error('[API/STEAM/GAMES] Authentication error: Missing Steam ID or API Key.');
    return NextResponse.json(
      { error: 'Not authenticated or server is missing API key.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get('force') === 'true';

  if (!forceRefresh) {
    const cachedGames = await readCache();
    if (cachedGames) {
      return NextResponse.json(cachedGames);
    }
  }
  
  if (forceRefresh) {
    console.log('[API/STEAM/GAMES] Force refresh requested. Bypassing and rebuilding cache...');
  }

  try {
    console.log('[API/STEAM/GAMES] Cache empty, stale, or bypassed. Fetching from Steam API...');
    const steamLoginSecureCookie = process.env.STEAM_LOGIN_SECURE_COOKIE;
    const games = await fetchGamesFromSteam(apiKey, steamId, steamLoginSecureCookie);

    await saveGamesToDb(games);
    await writeCache(games);
    return NextResponse.json(games);
  } catch (error: any) {
    console.error('[API/STEAM/GAMES] An error occurred while fetching from Steam:', error);
    return NextResponse.json({ error: error.message || 'An unknown error occurred' }, { status: 500 });
  }
}