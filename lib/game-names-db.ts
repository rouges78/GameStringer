/**
 * Game Names Database
 * Lookup table per giochi non-Steam che non hanno un nome leggibile nell'ID.
 * Usato come fallback quando il titolo è generico (es. "Game 12345").
 * 
 * Formato: { [platform_id]: "Nome Gioco" }
 * Per Xbox: usa il package family name (es. "Microsoft.HaloInfinite")
 * Per Amazon: usa l'ASIN o l'ID interno
 * Per GOG: usa l'ID numerico GOG
 */

// ============================================================================
// XBOX / MICROSOFT STORE
// ============================================================================
const XBOX_NAMES: Record<string, string> = {
  // Halo
  'Microsoft.HaloInfinite': 'Halo Infinite',
  'microsoft_haloinfinite': 'Halo Infinite',
  'HaloInfinite': 'Halo Infinite',
  // Forza
  'Microsoft.ForzaHorizon5': 'Forza Horizon 5',
  'Microsoft.ForzaHorizon4': 'Forza Horizon 4',
  'Microsoft.ForzaMotorsport': 'Forza Motorsport',
  // Gears
  'Microsoft.GearsTactics': 'Gears Tactics',
  'Microsoft.Gears5': 'Gears 5',
  'Microsoft.GearsofWar4': 'Gears of War 4',
  // Minecraft
  'Microsoft.MinecraftUWP': 'Minecraft',
  'Microsoft.MinecraftDungeons': 'Minecraft Dungeons',
  'Microsoft.MinecraftLegends': 'Minecraft Legends',
  'Mojang.MinecraftBedrock': 'Minecraft',
  // Bethesda / ZeniMax
  'Bethesda.Starfield': 'Starfield',
  'Bethesda.DOOM2016': 'DOOM (2016)',
  'Bethesda.DOOMEternal': 'DOOM Eternal',
  'Bethesda.Fallout4': 'Fallout 4',
  'Bethesda.Fallout76': 'Fallout 76',
  'Bethesda.ElderScrollsOnline': 'The Elder Scrolls Online',
  'Bethesda.Skyrim': 'The Elder Scrolls V: Skyrim',
  'Bethesda.Deathloop': 'DEATHLOOP',
  'Bethesda.Wolfenstein2': 'Wolfenstein II: The New Colossus',
  'Bethesda.Redfall': 'Redfall',
  // Obsidian
  'Obsidian.Grounded': 'Grounded',
  'Obsidian.TheOuterWorlds': 'The Outer Worlds',
  'Obsidian.PentimentGame': 'Pentiment',
  'Obsidian.Avowed': 'Avowed',
  // inXile
  'inXile.WastelandRemastered': 'Wasteland Remastered',
  'inXile.Wasteland3': 'Wasteland 3',
  // Playground Games
  'PlaygroundGames.FableRPG': 'Fable',
  // Double Fine
  'DoubleFine.Psychonauts2': 'Psychonauts 2',
  // Activision / Blizzard
  'Activision.DiabloIV': 'Diablo IV',
  'Activision.CallofDutyModernWarfare3': 'Call of Duty: Modern Warfare III',
  // Age of Empires
  'Microsoft.AgeofEmpires4': 'Age of Empires IV',
  'Microsoft.AgeofEmpires2DE': 'Age of Empires II: Definitive Edition',
  'Microsoft.AgeofEmpires3DE': 'Age of Empires III: Definitive Edition',
  // Flight Simulator
  'Microsoft.FlightSimulator': 'Microsoft Flight Simulator',
  'Microsoft.FlightSimulator2024': 'Microsoft Flight Simulator 2024',
  // Sea of Thieves
  'RareLtd.SeaofThieves': 'Sea of Thieves',
  // Ori
  'MoonStudios.OriandtheWilloftheWisps': 'Ori and the Will of the Wisps',
  // Killer Instinct
  'Microsoft.KillerInstinct': 'Killer Instinct',
  // State of Decay
  'Undead.StateofDecay2': 'State of Decay 2',
  // Bleeding Edge
  'NinjaTheory.BleedingEdge': 'Bleeding Edge',
  // Senua
  'NinjaTheory.HellbladeII': "Senua's Saga: Hellblade II",
};

// ============================================================================
// AMAZON GAMES / PRIME GAMING
// ============================================================================
const AMAZON_NAMES: Record<string, string> = {
  // Titoli comuni Amazon Prime Gaming
  'G3WTQ4WNQZ95R7VXZ3EXJWL7IQ': 'Lost Ark',
  'amazon_lostark': 'Lost Ark',
  'QNJNX9WTPVPV8KWCJPGK8HVFWZ': "New World",
  'amazon_newworld': 'New World',
  'PDTNLLVPZV8CZU8JNLHLBZZX7Z': 'Crucible',
};

// ============================================================================
// GOG
// ============================================================================
const GOG_NAMES: Record<string, string> = {
  // Witcher
  '1207658924': 'The Witcher',
  '1207658933': 'The Witcher 2: Assassins of Kings',
  '1207664643': 'The Witcher 3: Wild Hunt',
  // Cyberpunk
  '1423049311': 'Cyberpunk 2077',
  // CD Projekt
  '1436955639': 'Thronebreaker: The Witcher Tales',
  // Otros
  '1444136946': 'Disco Elysium',
  '1207665503': 'Baldur\'s Gate: Enhanced Edition',
  '1207666443': 'Baldur\'s Gate II: Enhanced Edition',
  '1252384207': 'Planescape: Torment Enhanced Edition',
  '1097893768': 'Pillars of Eternity',
  '1121952684': 'Pillars of Eternity II: Deadfire',
  '1430742444': 'Divinity: Original Sin 2',
  '1584145089': 'Hades',
  '1458058109': 'Hollow Knight',
  '1643760050': 'Ori and the Blind Forest: Definitive Edition',
  '1443067917': 'Ori and the Will of the Wisps',
};

// ============================================================================
// EPIC GAMES (titoli con ID non numerico)
// ============================================================================
const EPIC_NAMES: Record<string, string> = {
  'Fortnite': 'Fortnite',
  'Sugar': 'Fortnite',
  'CrabEA': 'Fortnite Battle Royale',
  'afb0f99bc9f44fd08a43b3edce3c723e': 'Rocket League',
  '9773aa1aa54f4f7b80e44bef04986cea': 'Fall Guys',
  'Andromeda': 'Unreal Tournament',
};

// ============================================================================
// API PUBBLICA
// ============================================================================

/**
 * Cerca il nome del gioco nella lookup table basandosi sull'ID e la piattaforma.
 * Ritorna null se non trovato (lasciando al chiamante la gestione del fallback).
 */
export function lookupGameName(id: string, platform?: string): string | null {
  if (!id) return null;

  const idLower = id.toLowerCase();

  // Prova lookup diretto
  if (XBOX_NAMES[id]) return XBOX_NAMES[id];
  if (AMAZON_NAMES[id]) return AMAZON_NAMES[id];
  if (GOG_NAMES[id]) return GOG_NAMES[id];
  if (EPIC_NAMES[id]) return EPIC_NAMES[id];

  // Strip prefisso piattaforma e riprova
  const stripped = id
    .replace(/^xbox_/i, '')
    .replace(/^amazon_/i, '')
    .replace(/^gog_/i, '')
    .replace(/^epic_/i, '');

  if (XBOX_NAMES[stripped]) return XBOX_NAMES[stripped];
  if (AMAZON_NAMES[stripped]) return AMAZON_NAMES[stripped];
  if (GOG_NAMES[stripped]) return GOG_NAMES[stripped];
  if (EPIC_NAMES[stripped]) return EPIC_NAMES[stripped];

  // Lookup parziale per Xbox (package family name può avere suffisso versione)
  if (!platform || platform === 'Xbox Game Pass') {
    for (const [key, name] of Object.entries(XBOX_NAMES)) {
      if (idLower.includes(key.toLowerCase()) || key.toLowerCase().includes(idLower.split('_')[1] || '')) {
        return name;
      }
    }
  }

  return null;
}

/**
 * Verifica se un titolo di gioco è generico/placeholder.
 */
export function isPlaceholderTitle(title: string): boolean {
  if (!title) return true;
  return /^(Game|Shared Game|Xbox Game|Unknown Game)\s+\d+$/.test(title.trim());
}

/**
 * Arricchisce il titolo di un gioco usando la lookup table se il titolo è generico.
 */
export function enrichGameTitle(id: string, currentTitle: string, platform?: string): string {
  if (!isPlaceholderTitle(currentTitle)) return currentTitle;
  return lookupGameName(id, platform) ?? currentTitle;
}
