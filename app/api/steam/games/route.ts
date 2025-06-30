import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import path from 'path';
import { promises as fs } from 'fs';
import { SteamGame } from '@/lib/types';
import { prisma } from '@/lib/prisma';
import { getInstalledSteamAppIds } from '@/app/utils/steam-local-files';
import { HowLongToBeatService, HowLongToBeatEntry } from 'howlongtobeat';

// --- Caching Configuration ---
const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const CACHE_FILE_PATH = path.join(CACHE_DIR, 'steam-games.json');
const CACHE_TTL_HOURS = 24;

// Helper to add timeout to a promise
function promiseWithTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  const timeout = new Promise<T>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(timeoutMessage));
    }, ms);
  });
  return Promise.race([promise, timeout]);
}

// Read from cache
async function readCache(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('force') === 'true') {
    console.log('[API/STEAM] Cache bypassed by query param.');
    return null;
  }
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const stats = await fs.stat(CACHE_FILE_PATH);
    const cacheAgeHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
    if (cacheAgeHours < CACHE_TTL_HOURS) {
      console.log('[API/STEAM] Serving from fresh cache.');
      const fileContent = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
      return JSON.parse(fileContent).games;
    }
    console.log('[API/STEAM] Cache is stale.');
    return null;
  } catch (error) {
    console.log('[API/STEAM] Cache not found or invalid.');
    return null;
  }
}

// Write to cache
async function writeCache(games: SteamGame[]) {
  try {
    await fs.writeFile(CACHE_FILE_PATH, JSON.stringify({ timestamp: Date.now(), games }, null, 2));
    console.log('[API/STEAM] Cache updated successfully.');
  } catch (error) {
    console.error('[API/STEAM] Failed to write cache:', error);
  }
}

// Parse shared games from local XML
async function parseSharedGamesXml(): Promise<{ appid: number; name: string }[]> {
  try {
    const xmlPath = path.join(process.cwd(), 'data', 'steam_shared_games.xml');
    const xmlContent = await fs.readFile(xmlPath, 'utf-8');
    const gameRegex = /<game>[\s\S]*?<appID>(\d+)<\/appID>[\s\S]*?<name><!\[CDATA\[([\s\S]*?)\]\]><\/name>[\s\S]*?<\/game>/g;
    const matches = [...xmlContent.matchAll(gameRegex)];
    return matches.map(match => ({ appid: parseInt(match[1], 10), name: match[2] }));
  } catch (error: any) {
    if (error.code !== 'ENOENT') console.error('[API/STEAM] Failed to parse shared games XML:', error);
    return [];
  }
}

// Save games to the database
async function saveGamesToDb(games: SteamGame[]) {
  if (games.length === 0) return;

  const upsertPromises = games.map(game => {
    // Mappatura esplicita per corrispondere a schema.prisma
    const gameDataForDb = {
      title: game.name,
      platform: 'Steam',
      imageUrl: `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/header.jpg`,
      isInstalled: game.is_installed || false,
      isVr: game.isVr || false,
      engine: game.engine || 'Unknown',
      lastPlayed: game.last_played ? new Date(game.last_played * 1000) : null,
      isShared: game.is_shared || false,
      // 'installPath' non viene aggiornato qui per non sovrascrivere i dati locali
    };

    return prisma.game.upsert({
      where: { steamAppId: game.appid },
      update: gameDataForDb,
      create: {
        steamAppId: game.appid,
        ...gameDataForDb,
        installPath: null, // Imposta a null alla creazione
      },
    });
  });

  try {
    await Promise.allSettled(upsertPromises);
    console.log(`[API/STEAM] Database update process completed for ${games.length} games.`);
  } catch (error) {
    // Poiché usiamo allSettled, gli errori individuali sono già gestiti.
    // Logghiamo un errore generico se il processo stesso fallisce.
    console.error('[API/STEAM] Critical error during bulk DB update:', error);
  }
}

// Helper to normalize game names for HLTB search
function normalizeGameNameForHltb(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    // Remove legal symbols
    .replace(/®|™|©/g, '')
    // Remove edition suffixes in various forms
    .replace(/:\s(deluxe|definitive|special|gold|game of the year|goty|redux|remastered|hd|enhanced|vr) edition/g, '')
    .replace(/\s(deluxe|definitive|special|gold|game of the year|goty|redux|remastered|hd|enhanced|vr) edition/g, '')
    // Remove content descriptions in brackets or parentheses
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    // Remove standalone "demo"
    .replace(/\bdemo\b/g, '')
    // Remove content after a colon or hyphen, often indicating subtitles or DLC
    .replace(/[:–-].*$/, '')
    // Remove non-alphanumeric characters except spaces
    .replace(/[^\w\s]/gi, '')
    .trim();
}

// Main function to fetch and process all games
async function fetchAndProcessGames(apiKey: string, steamId: string): Promise<SteamGame[]> {
  console.time('[PERF] fetchAndProcessGames');

  // 1. Fetch owned games
  const ownedGamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json&include_appinfo=true&include_played_free_games=true`;
  const ownedGamesResponse = await fetch(ownedGamesUrl);
  if (!ownedGamesResponse.ok) throw new Error(`Steam API (GetOwnedGames) failed: ${ownedGamesResponse.status}`);
  const ownedGamesData = await ownedGamesResponse.json();
  const allGames: any[] = ownedGamesData.response?.games || [];
  
  const allAppIds = new Set(allGames.map(g => g.appid));
  const initialOwnedAppIds = new Set(allAppIds);

  // 2. Add shared games from XML
  const sharedGames = await parseSharedGamesXml();
  for (const sharedGame of sharedGames) {
    if (!allAppIds.has(sharedGame.appid)) {
      allGames.push(sharedGame);
      allAppIds.add(sharedGame.appid);
    }
  }
  console.log(`[API/STEAM] Total unique games to process: ${allGames.length}`);

  // 3. Get installed games
  const installedAppIds = await getInstalledSteamAppIds();

  // 4. Enrich games in parallel
  console.time('[PERF] Enrichment');
  const hltbService = new HowLongToBeatService();

  const enrichmentPromises = allGames.map(async (game): Promise<SteamGame> => {
    const enrichedGame: SteamGame = {
      appid: game.appid,
      name: game.name,
      playtime_forever: game.playtime_forever || 0,
      img_icon_url: game.img_icon_url || '',
      img_logo_url: game.img_logo_url || '',
      last_played: game.rtime_last_played || 0,
      is_installed: installedAppIds.has(game.appid),
      is_shared: !initialOwnedAppIds.has(game.appid),
      isVr: false,
      engine: 'Unknown',
    };

    let details: any = null;
    try {
      const detailsResponse = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.appid}&l=it`);
      if (detailsResponse.ok) {
        const responseData = await detailsResponse.json();
        if (responseData[game.appid] && responseData[game.appid].success) {
          details = responseData[game.appid].data;
          if (details.name) enrichedGame.name = details.name;
        }
      }
    } catch (e) { /* Ignore details fetch error, proceed with basic info */ }

    // HLTB Enrichment
    try {
      const normalizedName = normalizeGameNameForHltb(enrichedGame.name);
      const searchPromise = hltbService.search(normalizedName);
      const result = await promiseWithTimeout(searchPromise, 15000, `Timeout HLTB for ${enrichedGame.name}`);
      if (result && result.length > 0) {
        enrichedGame.howLongToBeat = {
          main: result[0].gameplayMain,
          mainExtra: result[0].gameplayMainExtra,
          completionist: result[0].gameplayCompletionist,
        };
      }
    } catch (e: any) {
      // Only log if it's not a 404, which is common and noisy
      if (!e.message?.includes('404')) {
          const normalizedName = normalizeGameNameForHltb(enrichedGame.name);
          console.warn(`[HLTB] Failed for \"${enrichedGame.name}\" (normalized: \"${normalizedName}\"): ${e.message}`);
      }
    }

    // Details-based Enrichment (VR, Engine, and more)
    if (details) {
      // VR Detection (more reliable)
      const vrCategoryIds = [31, 32]; // 31: VR Support, 32: VR Only
      const hasVRCategory = details.categories?.some((cat: any) => 
        cat.description.toLowerCase().includes('vr') ||
        cat.id === 31 || // VR Support
        cat.id === 401 // SteamVR Collectibles
      ) || false;
      
      const hasVRInTitle = enrichedGame.name.toLowerCase().includes(' vr') ||
                          enrichedGame.name.toLowerCase().includes('vr ') ||
                          enrichedGame.name.toLowerCase().endsWith('vr');
      
      enrichedGame.isVr = hasVRCategory || hasVRInTitle;

      // Engine Detection (advanced pattern matching)
      const dev = (details.developers?.[0] || '').toLowerCase();
      const publisher = (details.publishers?.[0] || '').toLowerCase();
      const about = (details.about_the_game || '').toLowerCase();
      const description = (details.short_description || '').toLowerCase();
      const title = enrichedGame.name.toLowerCase();
      
      // Combina tutti i testi per una ricerca più completa
      const searchText = `${dev} ${publisher} ${about} ${description} ${title}`;
      
      // Pattern matching avanzato per i motori
      if (searchText.includes('unreal engine 5') || searchText.includes('ue5')) {
        enrichedGame.engine = 'Unreal Engine 5';
      } else if (searchText.includes('unreal engine 4') || searchText.includes('ue4')) {
        enrichedGame.engine = 'Unreal Engine 4';
      } else if (searchText.includes('unreal engine') || searchText.includes('unreal') || dev.includes('epic games')) {
        enrichedGame.engine = 'Unreal Engine';
      } else if (searchText.includes('unity 3d') || searchText.includes('unity engine') || searchText.includes('made with unity')) {
        enrichedGame.engine = 'Unity';
      } else if (searchText.includes('godot')) {
        enrichedGame.engine = 'Godot';
      } else if (searchText.includes('cryengine') || dev.includes('crytek')) {
        enrichedGame.engine = 'CryEngine';
      } else if (searchText.includes('source 2')) {
        enrichedGame.engine = 'Source 2';
      } else if (searchText.includes('source engine') || (dev.includes('valve') && !searchText.includes('source 2'))) {
        enrichedGame.engine = 'Source';
      } else if (searchText.includes('id tech 7')) {
        enrichedGame.engine = 'id Tech 7';
      } else if (searchText.includes('id tech') || dev.includes('id software')) {
        enrichedGame.engine = 'id Tech';
      } else if (searchText.includes('frostbite')) {
        enrichedGame.engine = 'Frostbite';
      } else if (searchText.includes('rpg maker mz')) {
        enrichedGame.engine = 'RPG Maker MZ';
      } else if (searchText.includes('rpg maker mv')) {
        enrichedGame.engine = 'RPG Maker MV';
      } else if (searchText.includes('rpg maker')) {
        enrichedGame.engine = 'RPG Maker';
      } else if (searchText.includes('gamemaker') || searchText.includes('game maker')) {
        enrichedGame.engine = 'GameMaker';
      } else if (searchText.includes('construct 3')) {
        enrichedGame.engine = 'Construct 3';
      } else if (searchText.includes('construct 2')) {
        enrichedGame.engine = 'Construct 2';
      } else if (searchText.includes('renpy') || searchText.includes("ren'py")) {
        enrichedGame.engine = "Ren'Py";
      } else if (searchText.includes('xna')) {
        enrichedGame.engine = 'XNA/FNA';
      } else if (searchText.includes('monogame')) {
        enrichedGame.engine = 'MonoGame';
      } else if (searchText.includes('love2d') || searchText.includes('löve')) {
        enrichedGame.engine = 'LÖVE2D';
      } else if (searchText.includes('pico-8') || searchText.includes('pico8')) {
        enrichedGame.engine = 'PICO-8';
      } else if (searchText.includes('clickteam fusion')) {
        enrichedGame.engine = 'Clickteam Fusion';
      } else if (searchText.includes('adventure game studio') || searchText.includes('ags')) {
        enrichedGame.engine = 'AGS';
      } else if (searchText.includes('twine')) {
        enrichedGame.engine = 'Twine';
      } else if (searchText.includes('bitsy')) {
        enrichedGame.engine = 'Bitsy';
      } else if (searchText.includes('defold')) {
        enrichedGame.engine = 'Defold';
      } else if (searchText.includes('cocos2d') || searchText.includes('cocos creator')) {
        enrichedGame.engine = 'Cocos2d';
      } else if (searchText.includes('phaser')) {
        enrichedGame.engine = 'Phaser';
      } else if (searchText.includes('heaps')) {
        enrichedGame.engine = 'Heaps';
      } else if (searchText.includes('bevy')) {
        enrichedGame.engine = 'Bevy';
      } else if (searchText.includes('amethyst')) {
        enrichedGame.engine = 'Amethyst';
      } else if (searchText.includes('raylib')) {
        enrichedGame.engine = 'raylib';
      } else if (searchText.includes('pygame')) {
        enrichedGame.engine = 'Pygame';
      } else if (searchText.includes('libgdx')) {
        enrichedGame.engine = 'libGDX';
      } else if (searchText.includes('lwjgl')) {
        enrichedGame.engine = 'LWJGL';
      } else if (searchText.includes('openfl')) {
        enrichedGame.engine = 'OpenFL';
      } else if (searchText.includes('haxeflixel')) {
        enrichedGame.engine = 'HaxeFlixel';
      } else if (searchText.includes('stencyl')) {
        enrichedGame.engine = 'Stencyl';
      } else if (searchText.includes('buildbox')) {
        enrichedGame.engine = 'Buildbox';
      } else if (searchText.includes('gdevelop')) {
        enrichedGame.engine = 'GDevelop';
      } else if (searchText.includes('solar2d') || searchText.includes('corona sdk')) {
        enrichedGame.engine = 'Solar2D';
      } else if (searchText.includes('amazon lumberyard') || searchText.includes('lumberyard')) {
        enrichedGame.engine = 'Amazon Lumberyard';
      } else if (searchText.includes('o3de') || searchText.includes('open 3d engine')) {
        enrichedGame.engine = 'O3DE';
      } else if (dev.includes('bethesda') || searchText.includes('creation engine')) {
        enrichedGame.engine = 'Creation Engine';
      } else if (dev.includes('cd projekt') || searchText.includes('redengine')) {
        enrichedGame.engine = 'REDengine';
      } else if (dev.includes('rockstar') || searchText.includes('rage engine')) {
        enrichedGame.engine = 'RAGE';
      } else if (dev.includes('ubisoft') && (searchText.includes('anvil') || searchText.includes('assassin'))) {
        enrichedGame.engine = 'Anvil';
      } else if (dev.includes('ubisoft') && searchText.includes('snowdrop')) {
        enrichedGame.engine = 'Snowdrop';
      } else if (dev.includes('capcom') && searchText.includes('re engine')) {
        enrichedGame.engine = 'RE Engine';
      } else if (dev.includes('fromsoftware') || dev.includes('from software')) {
        enrichedGame.engine = 'FromSoftware Engine';
      } else if (searchText.includes('decima')) {
        enrichedGame.engine = 'Decima';
      } else if (searchText.includes('fox engine')) {
        enrichedGame.engine = 'Fox Engine';
      } else if (searchText.includes('luminous engine')) {
        enrichedGame.engine = 'Luminous Engine';
      } else if (searchText.includes('dunia')) {
        enrichedGame.engine = 'Dunia Engine';
      } else if (searchText.includes('clausewitz')) {
        enrichedGame.engine = 'Clausewitz';
      } else if (searchText.includes('irrlicht')) {
        enrichedGame.engine = 'Irrlicht';
      } else if (searchText.includes('ogre') || searchText.includes('ogre3d')) {
        enrichedGame.engine = 'OGRE';
      } else if (searchText.includes('torque')) {
        enrichedGame.engine = 'Torque';
      } else if (searchText.includes('leadwerks')) {
        enrichedGame.engine = 'Leadwerks';
      } else if (searchText.includes('armory3d') || searchText.includes('armory')) {
        enrichedGame.engine = 'Armory3D';
      } else if (searchText.includes('stride') || searchText.includes('xenko')) {
        enrichedGame.engine = 'Stride';
      } else if (searchText.includes('flax')) {
        enrichedGame.engine = 'Flax Engine';
      } else if (searchText.includes('wicked engine')) {
        enrichedGame.engine = 'Wicked Engine';
      } else if (searchText.includes('neoaxis')) {
        enrichedGame.engine = 'NeoAxis';
      }

      // Aggiungi altre informazioni dall'API Steam
      if (details.genres) {
        enrichedGame.genres = details.genres;
      }
      if (details.categories) {
        enrichedGame.categories = details.categories;
      }
      if (details.short_description) {
        enrichedGame.short_description = details.short_description;
      }
      if (details.is_free !== undefined) {
        enrichedGame.is_free = details.is_free;
      }
      if (details.header_image) {
        enrichedGame.header_image = details.header_image;
      }
      if (details.capsule_image) {
        enrichedGame.library_capsule = details.capsule_image;
      }
      // Aggiungi developer, publisher, release_date, supported_languages
      if (details.developers) {
        enrichedGame.developers = details.developers;
      }
      if (details.publishers) {
        enrichedGame.publishers = details.publishers;
      }
      if (details.release_date) {
        enrichedGame.release_date = details.release_date;
      }
      if (details.supported_languages) {
        enrichedGame.supported_languages = details.supported_languages;
      }
      if (details.pc_requirements) {
        enrichedGame.pc_requirements = details.pc_requirements;
      }
      enrichedGame.dlc = details.dlc || [];

    } else {
      // Fallback for VR if details fetch fails - controlla solo il titolo
      const hasVRInTitle = enrichedGame.name.toLowerCase().includes(' vr') ||
                          enrichedGame.name.toLowerCase().includes('vr ') ||
                          enrichedGame.name.toLowerCase().endsWith('vr');
      enrichedGame.isVr = hasVRInTitle;
    }
    
    return enrichedGame;
  });

  const settledGames = await Promise.allSettled(enrichmentPromises);
  const successfulGames = settledGames
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<SteamGame>).value);
  
  console.timeEnd('[PERF] Enrichment');
  console.timeEnd('[PERF] fetchAndProcessGames');
  return successfulGames;
}

// --- API Endpoint ---
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });

    const cachedGames = await readCache(req);
    if (cachedGames) return NextResponse.json(cachedGames);

    console.log('[API/STEAM] No fresh cache. Starting full fetch process...');
    const games = await fetchAndProcessGames(apiKey, session.user.steamId);

    games.sort((a, b) => {
      if (a.is_installed !== b.is_installed) return a.is_installed ? -1 : 1;
      if (a.last_played !== b.last_played) return (b.last_played || 0) - (a.last_played || 0);
      return a.name.localeCompare(b.name);
    });

    // Non-blocking cache and DB updates
    writeCache(games);
    saveGamesToDb(games);

    return NextResponse.json(games);

  } catch (error: any) {
    console.error('[API/STEAM] Critical error in GET handler:', error);
    return NextResponse.json({ error: 'Failed to fetch Steam games', details: error.message }, { status: 500 });
  }
}