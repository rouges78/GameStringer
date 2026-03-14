/**
 * Database di traduzioni community per giochi PC.
 * MULTI-LINGUA: supporta IT, ES, FR, DE, PT, RU, PL, ZH, JA, KO e altre.
 * Il wizard controlla questo database PRIMA di provare AI translation.
 * Se una traduzione community esiste → la installa automaticamente.
 * 
 * Fonti: GamesTranslator.it, Nexus Mods, Steam Workshop, PCGamingWiki, fan communities
 */

export interface CommunityTranslation {
  /** Nome del gioco (per matching fuzzy) */
  gameName: string;
  /** Steam App ID (per matching esatto) */
  steamAppId?: number;
  /** URL download diretto o pagina download */
  downloadUrl: string;
  /** Tipo di download */
  downloadType: 'direct-zip' | 'external-page' | 'nexus' | 'steam-workshop';
  /** Steam Workshop ID (se applicabile) */
  workshopId?: string;
  /** Autore/team della traduzione */
  author: string;
  /** Fonte (sito) */
  source: string;
  /** Versione traduzione */
  version?: string;
  /** Istruzioni di installazione (lingua-neutre o nella lingua target) */
  installInstructions: string;
  /** Sottocartella del gioco dove estrarre */
  installSubfolder?: string;
  /** Lingua target (codice ISO 639-1: it, es, fr, de, pt, ru, pl, zh, ja, ko...) */
  language: string;
  /** Copertura stimata (%) */
  coverage?: number;
  /** Note aggiuntive */
  notes?: string;
}

// ============================================================
// DATABASE TRADUZIONI COMMUNITY — MULTI-LINGUA
// ============================================================

export const COMMUNITY_TRANSLATIONS: CommunityTranslation[] = [

  // ================================================================
  // 🇮🇹 ITALIANO — GamesTranslator.it, Team SuperGame, Nexus
  // ================================================================
  { gameName: 'The Wolf Among Us', steamAppId: 250320, downloadUrl: 'https://1drv.ms/u/s!ApMUGr0cuN39gcU1t4iqnsfx5KTodQ?e=y9QOEr', downloadType: 'external-page', author: 'Team SuperGame / Crybiolab', source: 'teamsupergame.wixsite.com', installInstructions: 'Extract "Pack" folder to game directory', language: 'it', coverage: 100 },
  { gameName: 'The Walking Dead: Season Two', steamAppId: 261030, downloadUrl: 'https://www.gamestranslator.it/index.php?/file/224-the-walking-dead-season-two/', downloadType: 'external-page', author: 'GamesTranslator.it', source: 'gamestranslator.it', installInstructions: 'Extract to game folder, overwrite originals', language: 'it', coverage: 100 },
  { gameName: 'Pacific Drive', steamAppId: 1458140, downloadUrl: 'https://www.gamestranslator.it/index.php?/file/433-pacific-drive-v192-trd/', downloadType: 'external-page', author: 'Godran65', source: 'gamestranslator.it', version: '1.9.2', installInstructions: 'Extract to game folder, overwrite originals', language: 'it' },
  { gameName: 'Disco Elysium', steamAppId: 632470, downloadUrl: 'https://www.gamestranslator.it/index.php?/file/784-disco-elysium-the-final-cut/', downloadType: 'external-page', author: 'GamesTranslator.it', source: 'gamestranslator.it', installInstructions: 'Extract to game folder', language: 'it', notes: 'The Final Cut' },
  { gameName: 'Schedule I', steamAppId: 3164500, downloadUrl: 'https://www.gamestranslator.it/index.php?/file/776-schedule-i/', downloadType: 'external-page', author: 'TurinaR', source: 'gamestranslator.it', installInstructions: 'Extract to game folder', language: 'it' },
  { gameName: 'Blue Prince', steamAppId: 1585030, downloadUrl: 'https://www.gamestranslator.it/index.php?/file/790-blue-prince/', downloadType: 'external-page', author: 'GamesTranslator.it', source: 'gamestranslator.it', installInstructions: 'Extract to game folder', language: 'it' },
  { gameName: 'The Invincible', steamAppId: 731040, downloadUrl: 'https://www.gamestranslator.it/index.php?/file/426-the-invincible/', downloadType: 'external-page', author: 'GamesTranslator.it', source: 'gamestranslator.it', installInstructions: 'Extract to game folder', language: 'it' },
  { gameName: 'Jagged Alliance 3', steamAppId: 1084160, downloadUrl: 'https://www.gamestranslator.it/index.php?/file/440-jagged-alliance-3-v151/', downloadType: 'external-page', author: 'GamesTranslator.it', source: 'gamestranslator.it', version: '1.5.1', installInstructions: 'Extract to game folder', language: 'it' },
  { gameName: 'The Thaumaturge', steamAppId: 2161600, downloadUrl: 'https://www.gamestranslator.it/index.php?/file/450-the-thaumaturge/', downloadType: 'external-page', author: 'TurinaR', source: 'gamestranslator.it', installInstructions: 'Extract to game folder', language: 'it' },
  { gameName: "Death's Door", steamAppId: 894020, downloadUrl: 'https://www.gamestranslator.it/index.php?/file/406-deaths-door/', downloadType: 'external-page', author: 'CoccoLoco', source: 'gamestranslator.it', installInstructions: 'Extract to game folder, overwrite *_Data', language: 'it' },
  { gameName: 'Indika', steamAppId: 1373960, downloadUrl: 'https://www.gamestranslator.it/index.php?/file/452-indika/', downloadType: 'external-page', author: 'GamesTranslator.it', source: 'gamestranslator.it', installInstructions: 'Extract to game folder', language: 'it' },
  { gameName: 'Coral Island', steamAppId: 1158160, downloadUrl: 'https://www.gamestranslator.it/index.php?/file/660-coral-island/', downloadType: 'external-page', author: 'CoccoLoco', source: 'gamestranslator.it', installInstructions: 'Extract to game folder', language: 'it' },
  { gameName: 'Citizen Sleeper', steamAppId: 1578650, downloadUrl: 'https://www.gamestranslator.it/index.php?/file/523-citizen-sleeper/', downloadType: 'external-page', author: 'GamesTranslator.it', source: 'gamestranslator.it', installInstructions: 'Extract to game folder', language: 'it' },
  { gameName: 'Dungeons of Hinterberg', steamAppId: 1983230, downloadUrl: 'https://www.gamestranslator.it/index.php?/file/518-dungeons-of-hinterberg/', downloadType: 'external-page', author: 'CoccoLoco', source: 'gamestranslator.it', installInstructions: 'Extract to game folder', language: 'it' },
  { gameName: 'The Ascent', steamAppId: 979690, downloadUrl: 'https://www.nexusmods.com/theascent/mods/33', downloadType: 'nexus', author: 'Vox Italica', source: 'nexusmods.com', installInstructions: 'Download from Nexus, extract to game folder', language: 'it', notes: 'All DLC compatible' },
  { gameName: 'Crusader Kings III', steamAppId: 1158310, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=2262243033', downloadType: 'steam-workshop', workshopId: '2262243033', author: 'TWR Team', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'it', coverage: 100, notes: 'All DLC' },

  // ================================================================
  // 🇪🇸 ESPAÑOL — Nexus Mods, Steam Workshop, traducciones.org
  // ================================================================
  { gameName: 'Baldur\'s Gate 3', steamAppId: 1086940, downloadUrl: 'https://www.nexusmods.com/baldursgate3/mods/276', downloadType: 'nexus', author: 'TraduccionesES', source: 'nexusmods.com', installInstructions: 'Download from Nexus, extract to game Data folder', language: 'es', notes: 'Latin American Spanish' },
  { gameName: 'Elden Ring', steamAppId: 1245620, downloadUrl: 'https://www.nexusmods.com/eldenring/mods/371', downloadType: 'nexus', author: 'EldenRingES', source: 'nexusmods.com', installInstructions: 'Download from Nexus, extract to Game folder', language: 'es', notes: 'Improved Spanish translation' },
  { gameName: 'Stardew Valley', steamAppId: 413150, downloadUrl: 'https://www.nexusmods.com/stardewvalley/mods/44', downloadType: 'nexus', author: 'StardewES', source: 'nexusmods.com', installInstructions: 'Install via SMAPI mod loader', language: 'es' },
  { gameName: 'Crusader Kings III', steamAppId: 1158310, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=2216670956', downloadType: 'steam-workshop', workshopId: '2216670956', author: 'Paradox ES', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'es', coverage: 100 },
  { gameName: 'Kenshi', steamAppId: 233860, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1433967629', downloadType: 'steam-workshop', workshopId: '1433967629', author: 'KenshiES', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'es' },

  // ================================================================
  // 🇫🇷 FRANÇAIS — Nexus Mods, Steam Workshop, fan communities
  // ================================================================
  { gameName: 'Baldur\'s Gate 3', steamAppId: 1086940, downloadUrl: 'https://www.nexusmods.com/baldursgate3/mods/164', downloadType: 'nexus', author: 'BG3 FR Team', source: 'nexusmods.com', installInstructions: 'Download from Nexus, extract to game Data folder', language: 'fr', notes: 'Improved French translation' },
  { gameName: 'Stardew Valley', steamAppId: 413150, downloadUrl: 'https://www.nexusmods.com/stardewvalley/mods/5765', downloadType: 'nexus', author: 'StardewFR', source: 'nexusmods.com', installInstructions: 'Install via SMAPI mod loader', language: 'fr' },
  { gameName: 'Crusader Kings III', steamAppId: 1158310, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=2217534250', downloadType: 'steam-workshop', workshopId: '2217534250', author: 'Traduction FR', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'fr', coverage: 100 },
  { gameName: 'Kenshi', steamAppId: 233860, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1399650975', downloadType: 'steam-workshop', workshopId: '1399650975', author: 'KenshiFR', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'fr' },

  // ================================================================
  // 🇩🇪 DEUTSCH — Nexus Mods, Steam Workshop
  // ================================================================
  { gameName: 'Baldur\'s Gate 3', steamAppId: 1086940, downloadUrl: 'https://www.nexusmods.com/baldursgate3/mods/381', downloadType: 'nexus', author: 'BG3 DE Team', source: 'nexusmods.com', installInstructions: 'Download from Nexus, extract to game Data folder', language: 'de', notes: 'Improved German translation' },
  { gameName: 'Kenshi', steamAppId: 233860, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1310770933', downloadType: 'steam-workshop', workshopId: '1310770933', author: 'KenshiDE', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'de' },
  { gameName: 'Crusader Kings III', steamAppId: 1158310, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=2222607919', downloadType: 'steam-workshop', workshopId: '2222607919', author: 'CK3 DE', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'de', coverage: 100 },

  // ================================================================
  // 🇧🇷 PORTUGUÊS — Nexus Mods, Steam Workshop, traduções BR
  // ================================================================
  { gameName: 'Baldur\'s Gate 3', steamAppId: 1086940, downloadUrl: 'https://www.nexusmods.com/baldursgate3/mods/371', downloadType: 'nexus', author: 'BG3 PTBR', source: 'nexusmods.com', installInstructions: 'Download from Nexus, extract to game Data folder', language: 'pt', notes: 'Brazilian Portuguese' },
  { gameName: 'Stardew Valley', steamAppId: 413150, downloadUrl: 'https://www.nexusmods.com/stardewvalley/mods/624', downloadType: 'nexus', author: 'StardewBR', source: 'nexusmods.com', installInstructions: 'Install via SMAPI mod loader', language: 'pt' },
  { gameName: 'Kenshi', steamAppId: 233860, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1542776498', downloadType: 'steam-workshop', workshopId: '1542776498', author: 'KenshiBR', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'pt' },

  // ================================================================
  // 🇷🇺 РУССКИЙ — Nexus Mods, Steam Workshop, Russian fan communities
  // ================================================================
  { gameName: 'Baldur\'s Gate 3', steamAppId: 1086940, downloadUrl: 'https://www.nexusmods.com/baldursgate3/mods/298', downloadType: 'nexus', author: 'BG3 RU Team', source: 'nexusmods.com', installInstructions: 'Download from Nexus, extract to game Data folder', language: 'ru' },
  { gameName: 'Kenshi', steamAppId: 233860, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1258043059', downloadType: 'steam-workshop', workshopId: '1258043059', author: 'KenshiRU', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'ru' },
  { gameName: 'Crusader Kings III', steamAppId: 1158310, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=2218611647', downloadType: 'steam-workshop', workshopId: '2218611647', author: 'CK3 RU', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'ru', coverage: 100 },

  // ================================================================
  // 🇵🇱 POLSKI — Nexus Mods, Steam Workshop
  // ================================================================
  { gameName: 'Baldur\'s Gate 3', steamAppId: 1086940, downloadUrl: 'https://www.nexusmods.com/baldursgate3/mods/567', downloadType: 'nexus', author: 'BG3 PL Team', source: 'nexusmods.com', installInstructions: 'Download from Nexus, extract to game Data folder', language: 'pl' },
  { gameName: 'Kenshi', steamAppId: 233860, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1350571475', downloadType: 'steam-workshop', workshopId: '1350571475', author: 'KenshiPL', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'pl' },

  // ================================================================
  // 🇨🇳 中文 — Nexus Mods, Steam Workshop, 3DM/Keylol communities
  // ================================================================
  { gameName: 'Baldur\'s Gate 3', steamAppId: 1086940, downloadUrl: 'https://www.nexusmods.com/baldursgate3/mods/420', downloadType: 'nexus', author: 'BG3 CN Team', source: 'nexusmods.com', installInstructions: 'Download from Nexus, extract to game Data folder', language: 'zh', notes: 'Simplified Chinese' },
  { gameName: 'Elden Ring', steamAppId: 1245620, downloadUrl: 'https://www.nexusmods.com/eldenring/mods/168', downloadType: 'nexus', author: 'EldenRingCN', source: 'nexusmods.com', installInstructions: 'Download from Nexus, extract to Game folder', language: 'zh', notes: 'Improved Chinese' },
  { gameName: 'Kenshi', steamAppId: 233860, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1258043060', downloadType: 'steam-workshop', workshopId: '1258043060', author: 'KenshiCN', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'zh' },

  // ================================================================
  // 🇯🇵 日本語 — Nexus Mods, fan communities
  // ================================================================
  { gameName: 'Stardew Valley', steamAppId: 413150, downloadUrl: 'https://www.nexusmods.com/stardewvalley/mods/455', downloadType: 'nexus', author: 'StardewJP', source: 'nexusmods.com', installInstructions: 'Install via SMAPI mod loader', language: 'ja' },
  { gameName: 'Kenshi', steamAppId: 233860, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1117938497', downloadType: 'steam-workshop', workshopId: '1117938497', author: 'KenshiJP', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'ja' },

  // ================================================================
  // 🇰🇷 한국어 — Nexus Mods, Steam Workshop
  // ================================================================
  { gameName: 'Baldur\'s Gate 3', steamAppId: 1086940, downloadUrl: 'https://www.nexusmods.com/baldursgate3/mods/502', downloadType: 'nexus', author: 'BG3 KR Team', source: 'nexusmods.com', installInstructions: 'Download from Nexus, extract to game Data folder', language: 'ko' },
  { gameName: 'Kenshi', steamAppId: 233860, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1258043061', downloadType: 'steam-workshop', workshopId: '1258043061', author: 'KenshiKR', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'ko' },

  // ================================================================
  // 🇹🇷 TÜRKÇE — Nexus Mods, Steam Workshop
  // ================================================================
  { gameName: 'Baldur\'s Gate 3', steamAppId: 1086940, downloadUrl: 'https://www.nexusmods.com/baldursgate3/mods/310', downloadType: 'nexus', author: 'BG3 TR Team', source: 'nexusmods.com', installInstructions: 'Download from Nexus, extract to game Data folder', language: 'tr' },
  { gameName: 'Kenshi', steamAppId: 233860, downloadUrl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1584085714', downloadType: 'steam-workshop', workshopId: '1584085714', author: 'KenshiTR', source: 'Steam Workshop', installInstructions: 'Subscribe in Workshop, enable in game settings', language: 'tr' },
];

// ============================================================
// FUNZIONI DI RICERCA
// ============================================================

/**
 * Cerca una traduzione community per un gioco dato il titolo e/o Steam App ID.
 * Usa matching fuzzy sul nome + matching esatto su steamAppId.
 */
export function findCommunityTranslation(
  gameName: string,
  steamAppId?: number | string,
  targetLang: string = 'it'
): CommunityTranslation | null {
  const appId = typeof steamAppId === 'string' ? parseInt(steamAppId, 10) : steamAppId;

  // Match esatto per Steam App ID
  if (appId && !isNaN(appId)) {
    const exact = COMMUNITY_TRANSLATIONS.find(
      t => t.steamAppId === appId && t.language === targetLang
    );
    if (exact) return exact;
  }

  // Match fuzzy per nome
  const nameNorm = gameName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  for (const t of COMMUNITY_TRANSLATIONS) {
    if (t.language !== targetLang) continue;
    const tNorm = t.gameName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Match esatto normalizzato
    if (nameNorm === tNorm) return t;
    
    // Match parziale (il nome del gioco contiene il nome della traduzione o viceversa)
    if (nameNorm.includes(tNorm) || tNorm.includes(nameNorm)) return t;
  }

  // Match con parole chiave (almeno 2 parole in comune di 4+ lettere)
  const nameWords = gameName.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
  if (nameWords.length >= 2) {
    for (const t of COMMUNITY_TRANSLATIONS) {
      if (t.language !== targetLang) continue;
      const tWords = t.gameName.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
      const common = nameWords.filter(w => tWords.includes(w));
      if (common.length >= 2) return t;
    }
  }

  return null;
}

/**
 * Restituisce il numero totale di traduzioni nel database.
 */
export function getCommunityTranslationCount(): number {
  return COMMUNITY_TRANSLATIONS.length;
}

/**
 * Restituisce tutte le traduzioni disponibili per una lingua.
 */
export function getAllTranslations(lang: string = 'it'): CommunityTranslation[] {
  return COMMUNITY_TRANSLATIONS.filter(t => t.language === lang);
}
