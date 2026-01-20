// Database traduzioni per giochi comuni
export interface GameTranslation {
  gameId: string;
  gameName: string;
  processName: string;
  translations: Record<string, string>;
  genre?: string;
  notes?: string;
}

export const gameTranslations: GameTranslation[] = [
  {
    gameId: 'decarnation',
    gameName: 'Decarnation',
    processName: 'Decarnation.exe',
    genre: 'Horror/Adventure',
    translations: {
      // Menu principale
      'New Game': 'Nuovo Gioco',
      'Continue': 'Continua',
      'Load Game': 'Carica Partita',
      'Options': 'Opzioni',
      'Settings': 'Impostazioni',
      'Exit': 'Esci',
      'Quit': 'Esci',
      'Back': 'Indietro',
      'Apply': 'Applica',
      'Save': 'Salva',
      'Cancel': 'Annulla',
      'Yes': 'Sì',
      'No': 'No',
      'OK': 'OK',
      
      // Gameplay
      'Examine': 'Esamina',
      'Talk': 'Parla',
      'Use': 'Usa',
      'Take': 'Prendi',
      'Open': 'Apri',
      'Close': 'Chiudi',
      'Look': 'Guarda',
      'Inventory': 'Inventario',
      
      // Impostazioni
      'Graphics': 'Grafica',
      'Audio': 'Audio',
      'Controls': 'Controlli',
      'Language': 'Lingua',
      'Subtitles': 'Sottotitoli',
      'Master Volume': 'Volume Principale',
      'Music Volume': 'Volume Musica',
      'SFX Volume': 'Volume Effetti',
      'Fullscreen': 'Schermo Intero',
      'Resolution': 'Risoluzione',
      'Quality': 'Qualità',
      'Low': 'Bassa',
      'Medium': 'Media',
      'High': 'Alta',
      'Ultra': 'Ultra',
    }
  },
  {
    gameId: 'hollowknight',
    gameName: 'Hollow Knight',
    processName: 'hollow_knight.exe',
    genre: 'Metroidvania',
    translations: {
      // Menu
      'Start Game': 'Inizia Gioco',
      'Continue': 'Continua',
      'Options': 'Opzioni',
      'Extras': 'Extra',
      'Quit Game': 'Esci dal Gioco',
      'Steel Soul Mode': 'Modalità Anima d\'Acciaio',
      
      // Gameplay
      'Health': 'Salute',
      'Soul': 'Anima',
      'Geo': 'Geo',
      'Map': 'Mappa',
      'Inventory': 'Inventario',
      'Charms': 'Amuleti',
      'Journal': 'Diario',
      'Save Game': 'Salva Partita',
      'Bench': 'Panchina',
      
      // Items
      'Mask Shard': 'Frammento di Maschera',
      'Vessel Fragment': 'Frammento di Vaso',
      'Pale Ore': 'Minerale Pallido',
      'Simple Key': 'Chiave Semplice',
      'Rancid Egg': 'Uovo Rancido',
      
      // NPCs
      'Elderbug': 'Coleottero Anziano',
      'Cornifer': 'Cornifer',
      'Sly': 'Sly',
      'Hornet': 'Hornet',
      'The Knight': 'Il Cavaliere',
    }
  },
  {
    gameId: 'celeste',
    gameName: 'Celeste',
    processName: 'Celeste.exe',
    genre: 'Platformer',
    translations: {
      // Menu
      'Play': 'Gioca',
      'Climb': 'Scala',
      'Options': 'Opzioni',
      'Credits': 'Crediti',
      'Exit': 'Esci',
      'Chapter Select': 'Selezione Capitolo',
      'New Game': 'Nuovo Gioco',
      'Continue': 'Continua',
      
      // Chapters
      'Prologue': 'Prologo',
      'Forsaken City': 'Città Abbandonata',
      'Old Site': 'Vecchio Sito',
      'Celestial Resort': 'Resort Celestiale',
      'Golden Ridge': 'Cresta Dorata',
      'Mirror Temple': 'Tempio dello Specchio',
      'Reflection': 'Riflesso',
      'The Summit': 'La Vetta',
      'Core': 'Nucleo',
      'Farewell': 'Addio',
      
      // Gameplay
      'Deaths': 'Morti',
      'Strawberries': 'Fragole',
      'Timer': 'Cronometro',
      'Dashes': 'Scatti',
      'Jump': 'Salta',
      'Grab': 'Afferra',
      'Dash': 'Scatta',
      'Pause': 'Pausa',
      'Retry': 'Riprova',
      'Skip': 'Salta',
      
      // UI
      'Assist Mode': 'Modalità Assistita',
      'Game Speed': 'Velocità di Gioco',
      'Infinite Stamina': 'Stamina Infinita',
      'Air Dashes': 'Scatti Aerei',
      'Invincibility': 'Invincibilità',
    }
  },
  {
    gameId: 'hades',
    gameName: 'Hades',
    processName: 'Hades.exe',
    genre: 'Roguelike',
    translations: {
      // Menu
      'New Game': 'Nuovo Gioco',
      'Continue': 'Continua',
      'Settings': 'Impostazioni',
      'Credits': 'Crediti',
      'Quit': 'Esci',
      
      // Gameplay
      'Health': 'Salute',
      'Attack': 'Attacco',
      'Special': 'Speciale',
      'Cast': 'Lancio',
      'Dash': 'Scatto',
      'Call': 'Invocazione',
      'Boons': 'Benedizioni',
      'Darkness': 'Oscurità',
      'Gems': 'Gemme',
      'Keys': 'Chiavi',
      'Nectar': 'Nettare',
      'Ambrosia': 'Ambrosia',
      
      // Gods
      'Zeus': 'Zeus',
      'Poseidon': 'Poseidone',
      'Athena': 'Atena',
      'Aphrodite': 'Afrodite',
      'Ares': 'Ares',
      'Artemis': 'Artemide',
      'Dionysus': 'Dioniso',
      'Hermes': 'Hermes',
      'Demeter': 'Demetra',
      'Chaos': 'Caos',
      
      // Weapons
      'Stygian Blade': 'Lama Stigia',
      'Eternal Spear': 'Lancia Eterna',
      'Shield of Chaos': 'Scudo del Caos',
      'Heart-Seeking Bow': 'Arco Cercacuori',
      'Twin Fists': 'Pugni Gemelli',
      'Adamant Rail': 'Fucile Adamantino',
    }
  },
  {
    gameId: 'stardewvalley',
    gameName: 'Stardew Valley',
    processName: 'Stardew Valley.exe',
    genre: 'Farming Sim',
    translations: {
      // Menu
      'New': 'Nuovo',
      'Load': 'Carica',
      'Co-op': 'Co-op',
      'Exit': 'Esci',
      'Options': 'Opzioni',
      
      // Seasons
      'Spring': 'Primavera',
      'Summer': 'Estate',
      'Fall': 'Autunno',
      'Winter': 'Inverno',
      
      // Days
      'Monday': 'Lunedì',
      'Tuesday': 'Martedì',
      'Wednesday': 'Mercoledì',
      'Thursday': 'Giovedì',
      'Friday': 'Venerdì',
      'Saturday': 'Sabato',
      'Sunday': 'Domenica',
      
      // UI
      'Inventory': 'Inventario',
      'Skills': 'Abilità',
      'Map': 'Mappa',
      'Crafting': 'Creazione',
      'Collections': 'Collezioni',
      'Social': 'Sociale',
      'Journal': 'Diario',
      
      // Skills
      'Farming': 'Agricoltura',
      'Mining': 'Estrazione',
      'Foraging': 'Raccolta',
      'Fishing': 'Pesca',
      'Combat': 'Combattimento',
      
      // Tools
      'Axe': 'Ascia',
      'Pickaxe': 'Piccone',
      'Scythe': 'Falce',
      'Hoe': 'Zappa',
      'Watering Can': 'Annaffiatoio',
      'Fishing Rod': 'Canna da Pesca',
    }
  },
  {
    gameId: 'terraria',
    gameName: 'Terraria',
    processName: 'Terraria.exe',
    genre: 'Sandbox',
    translations: {
      // Menu
      'Single Player': 'Giocatore Singolo',
      'Multiplayer': 'Multigiocatore',
      'Settings': 'Impostazioni',
      'Exit': 'Esci',
      'Create Character': 'Crea Personaggio',
      'Create World': 'Crea Mondo',
      
      // Difficulty
      'Journey': 'Viaggio',
      'Classic': 'Classica',
      'Expert': 'Esperto',
      'Master': 'Maestro',
      'Hardcore': 'Hardcore',
      
      // World Size
      'Small': 'Piccolo',
      'Medium': 'Medio',
      'Large': 'Grande',
      
      // UI
      'Inventory': 'Inventario',
      'Crafting': 'Creazione',
      'Equipment': 'Equipaggiamento',
      'Housing': 'Alloggi',
      'Map': 'Mappa',
      'Achievements': 'Obiettivi',
      
      // Items
      'Copper': 'Rame',
      'Iron': 'Ferro',
      'Silver': 'Argento',
      'Gold': 'Oro',
      'Wood': 'Legno',
      'Stone': 'Pietra',
      'Dirt': 'Terra',
      'Sand': 'Sabbia',
    }
  },
  {
    gameId: 'darksouls3',
    gameName: 'Dark Souls III',
    processName: 'DarkSoulsIII.exe',
    genre: 'Action RPG',
    translations: {
      // Menu
      'Continue': 'Continua',
      'New Game': 'Nuovo Gioco',
      'Load Game': 'Carica Partita',
      'Options': 'Opzioni',
      'Quit Game': 'Esci dal Gioco',
      
      // Gameplay
      'YOU DIED': 'SEI MORTO',
      'BONFIRE LIT': 'FALÒ ACCESO',
      'EMBER RESTORED': 'BRACE RIPRISTINATA',
      'HUMANITY RESTORED': 'UMANITÀ RIPRISTINATA',
      'SOUL ACQUIRED': 'ANIMA ACQUISITA',
      'ITEM DISCOVERY': 'SCOPERTA OGGETTI',
      
      // Stats
      'Level': 'Livello',
      'Vigor': 'Vigore',
      'Attunement': 'Sintonia',
      'Endurance': 'Resistenza',
      'Vitality': 'Vitalità',
      'Strength': 'Forza',
      'Dexterity': 'Destrezza',
      'Intelligence': 'Intelligenza',
      'Faith': 'Fede',
      'Luck': 'Fortuna',
      
      // Items
      'Estus Flask': 'Fiaschetta di Estus',
      'Ashen Estus Flask': 'Fiaschetta di Estus Cinereo',
      'Homeward Bone': 'Osso del Ritorno',
      'Ember': 'Brace',
      'Soul': 'Anima',
    }
  },
  {
    gameId: 'witcher3',
    gameName: 'The Witcher 3',
    processName: 'witcher3.exe',
    genre: 'Action RPG',
    translations: {
      // Menu
      'New Game': 'Nuovo Gioco',
      'Continue': 'Continua',
      'Load Game': 'Carica Partita',
      'Options': 'Opzioni',
      'Credits': 'Crediti',
      'Quit': 'Esci',
      
      // Gameplay
      'Quest Updated': 'Missione Aggiornata',
      'Quest Completed': 'Missione Completata',
      'New Quest': 'Nuova Missione',
      'Level Up': 'Livello Aumentato',
      'Ability Point': 'Punto Abilità',
      
      // UI
      'Inventory': 'Inventario',
      'Character': 'Personaggio',
      'Alchemy': 'Alchimia',
      'Crafting': 'Creazione',
      'Map': 'Mappa',
      'Quests': 'Missioni',
      'Glossary': 'Glossario',
      'Meditation': 'Meditazione',
      
      // Combat
      'Fast Attack': 'Attacco Veloce',
      'Strong Attack': 'Attacco Forte',
      'Dodge': 'Schivata',
      'Roll': 'Rotolamento',
      'Parry': 'Parata',
      'Signs': 'Segni',
      
      // Signs
      'Aard': 'Aard',
      'Igni': 'Igni',
      'Yrden': 'Yrden',
      'Quen': 'Quen',
      'Axii': 'Axii',
    }
  },
  {
    gameId: 'cyberpunk2077',
    gameName: 'Cyberpunk 2077',
    processName: 'Cyberpunk2077.exe',
    genre: 'Action RPG',
    translations: {
      // Menu
      'New Game': 'Nuovo Gioco',
      'Continue': 'Continua',
      'Load Game': 'Carica Partita',
      'Settings': 'Impostazioni',
      'Credits': 'Crediti',
      'Quit': 'Esci',
      
      // Character
      'Nomad': 'Nomade',
      'Street Kid': 'Ragazzo di Strada',
      'Corpo': 'Corporativo',
      
      // Stats
      'Body': 'Corpo',
      'Reflexes': 'Riflessi',
      'Technical Ability': 'Abilità Tecnica',
      'Intelligence': 'Intelligenza',
      'Cool': 'Sangue Freddo',
      
      // UI
      'Inventory': 'Inventario',
      'Character': 'Personaggio',
      'Crafting': 'Creazione',
      'Journal': 'Diario',
      'Map': 'Mappa',
      'Shards': 'Frammenti',
      'Messages': 'Messaggi',
      
      // Gameplay
      'Street Cred': 'Reputazione',
      'Level': 'Livello',
      'Attribute Points': 'Punti Attributo',
      'Perk Points': 'Punti Talento',
      'Cyberware': 'Cyberware',
      'Quickhacks': 'Quickhack',
    }
  },
  {
    gameId: 'eldenring',
    gameName: 'Elden Ring',
    processName: 'eldenring.exe',
    genre: 'Action RPG',
    translations: {
      // Menu
      'Continue': 'Continua',
      'New Game': 'Nuovo Gioco',
      'Load Game': 'Carica Partita',
      'System': 'Sistema',
      'Quit Game': 'Esci dal Gioco',
      
      // Gameplay
      'YOU DIED': 'SEI MORTO',
      'ENEMY FELLED': 'NEMICO ABBATTUTO',
      'GREAT ENEMY FELLED': 'GRANDE NEMICO ABBATTUTO',
      'SITE OF GRACE DISCOVERED': 'LUOGO DI GRAZIA SCOPERTO',
      'LOST GRACE DISCOVERED': 'GRAZIA PERDUTA SCOPERTA',
      
      // Stats
      'Vigor': 'Vigore',
      'Mind': 'Mente',
      'Endurance': 'Resistenza',
      'Strength': 'Forza',
      'Dexterity': 'Destrezza',
      'Intelligence': 'Intelligenza',
      'Faith': 'Fede',
      'Arcane': 'Arcano',
      
      // Items
      'Flask of Crimson Tears': 'Fiaschetta di Lacrime Cremisi',
      'Flask of Cerulean Tears': 'Fiaschetta di Lacrime Cerulee',
      'Runes': 'Rune',
      'Golden Rune': 'Runa Dorata',
      'Smithing Stone': 'Pietra da Forgia',
      'Somber Smithing Stone': 'Pietra da Forgia Tetra',
    }
  },
  {
    gameId: 'baldursgate3',
    gameName: "Baldur's Gate 3",
    processName: 'bg3.exe',
    genre: 'CRPG',
    translations: {
      // Menu
      'New Game': 'Nuovo Gioco',
      'Continue': 'Continua',
      'Load Game': 'Carica Partita',
      'Multiplayer': 'Multigiocatore',
      'Options': 'Opzioni',
      'Credits': 'Crediti',
      'Quit': 'Esci',
      
      // Character Creation
      'Origin': 'Origine',
      'Race': 'Razza',
      'Class': 'Classe',
      'Background': 'Background',
      'Abilities': 'Abilità',
      
      // Classes
      'Fighter': 'Guerriero',
      'Wizard': 'Mago',
      'Cleric': 'Chierico',
      'Rogue': 'Ladro',
      'Ranger': 'Ranger',
      'Warlock': 'Warlock',
      'Sorcerer': 'Stregone',
      'Barbarian': 'Barbaro',
      'Bard': 'Bardo',
      'Druid': 'Druido',
      'Monk': 'Monaco',
      'Paladin': 'Paladino',
      
      // UI
      'Inventory': 'Inventario',
      'Character Sheet': 'Scheda Personaggio',
      'Spellbook': 'Libro degli Incantesimi',
      'Journal': 'Diario',
      'Map': 'Mappa',
      'Camp': 'Accampamento',
      
      // Combat
      'Action': 'Azione',
      'Bonus Action': 'Azione Bonus',
      'Movement': 'Movimento',
      'Reaction': 'Reazione',
      'Advantage': 'Vantaggio',
      'Disadvantage': 'Svantaggio',
      'Critical Hit': 'Colpo Critico',
      'Critical Miss': 'Fallimento Critico',
    }
  },
  {
    gameId: 'persona5',
    gameName: 'Persona 5',
    processName: 'P5R.exe',
    genre: 'JRPG',
    translations: {
      // Menu
      'New Game': 'Nuovo Gioco',
      'Load Game': 'Carica Partita',
      'Config': 'Configurazione',
      'Network': 'Rete',
      
      // Calendar
      'Monday': 'Lunedì',
      'Tuesday': 'Martedì',
      'Wednesday': 'Mercoledì',
      'Thursday': 'Giovedì',
      'Friday': 'Venerdì',
      'Saturday': 'Sabato',
      'Sunday': 'Domenica',
      
      // Time
      'Morning': 'Mattina',
      'Afternoon': 'Pomeriggio',
      'After School': 'Dopo Scuola',
      'Evening': 'Sera',
      'Night': 'Notte',
      
      // Stats
      'Knowledge': 'Conoscenza',
      'Guts': 'Coraggio',
      'Proficiency': 'Competenza',
      'Kindness': 'Gentilezza',
      'Charm': 'Fascino',
      
      // Combat
      'Attack': 'Attacco',
      'Guard': 'Difesa',
      'Items': 'Oggetti',
      'Persona': 'Persona',
      'Tactics': 'Tattiche',
      'Escape': 'Fuga',
      
      // UI
      'All-Out Attack': 'Attacco Totale',
      'Hold Up': 'Resa',
      'Baton Pass': 'Passaggio del Testimone',
      'One More': 'Ancora Uno',
    }
  },
  {
    gameId: 'oriandtheblindforest',
    gameName: 'Ori and the Blind Forest',
    processName: 'oriDE.exe',
    genre: 'Metroidvania',
    translations: {
      // Menu
      'Start': 'Inizia',
      'Continue': 'Continua',
      'Options': 'Opzioni',
      'Extras': 'Extra',
      'Quit': 'Esci',
      
      // Abilities
      'Spirit Flame': 'Fiamma Spirituale',
      'Wall Jump': 'Salto a Muro',
      'Double Jump': 'Doppio Salto',
      'Charge Flame': 'Fiamma Carica',
      'Bash': 'Colpo',
      'Stomp': 'Pestata',
      'Glide': 'Planata',
      'Climb': 'Arrampicata',
      'Charge Jump': 'Salto Carico',
      'Dash': 'Scatto',
      
      // Items
      'Life Cell': 'Cellula Vitale',
      'Energy Cell': 'Cellula Energetica',
      'Ability Cell': 'Cellula Abilità',
      'Keystone': 'Pietra Chiave',
      'Map Stone': 'Pietra Mappa',
      
      // UI
      'Health': 'Salute',
      'Energy': 'Energia',
      'Soul Link': 'Legame Spirituale',
      'Save': 'Salva',
      'Map': 'Mappa',
    }
  },
  {
    gameId: 'deadcells',
    gameName: 'Dead Cells',
    processName: 'deadcells.exe',
    genre: 'Roguelike',
    translations: {
      // Menu
      'Play': 'Gioca',
      'Options': 'Opzioni',
      'Stats': 'Statistiche',
      'Quit': 'Esci',
      
      // Gameplay
      'Cells': 'Cellule',
      'Gold': 'Oro',
      'Scrolls': 'Pergamene',
      'Mutations': 'Mutazioni',
      'Weapons': 'Armi',
      'Skills': 'Abilità',
      
      // Stats
      'Brutality': 'Brutalità',
      'Tactics': 'Tattica',
      'Survival': 'Sopravvivenza',
      
      // Items
      'Health Flask': 'Fiaschetta Salute',
      'Blueprint': 'Progetto',
      'Rune': 'Runa',
      'Key': 'Chiave',
      
      // Areas
      'Prisoners Quarters': 'Quartieri dei Prigionieri',
      'Promenade': 'Passeggiata',
      'Ramparts': 'Bastioni',
      'Black Bridge': 'Ponte Nero',
      'Stilt Village': 'Villaggio su Palafitte',
      'Clock Tower': 'Torre dell\'Orologio',
      'Castle': 'Castello',
      'Throne Room': 'Sala del Trono',
    }
  },
  {
    gameId: 'cuphead',
    gameName: 'Cuphead',
    processName: 'Cuphead.exe',
    genre: 'Run and Gun',
    translations: {
      // Menu
      'Start': 'Inizia',
      'Options': 'Opzioni',
      'Exit': 'Esci',
      'Single Player': 'Giocatore Singolo',
      'Local Co-Op': 'Co-op Locale',
      
      // Gameplay
      'Ready?': 'Pronto?',
      'WALLOP!': 'SBERLA!',
      'KNOCKOUT!': 'K.O.!',
      'You Died': 'Sei Morto',
      'Try Again': 'Riprova',
      
      // Shop
      'Shop': 'Negozio',
      'Coins': 'Monete',
      'Buy': 'Compra',
      'Equip': 'Equipaggia',
      
      // Items
      'Heart': 'Cuore',
      'Coffee': 'Caffè',
      'Smoke Bomb': 'Bomba Fumogena',
      'P. Sugar': 'Zucchero P.',
      'Twin Heart': 'Cuore Gemello',
      'Whetstone': 'Cote',
    }
  },
  {
    gameId: 'inscryption',
    gameName: 'Inscryption',
    processName: 'Inscryption.exe',
    genre: 'Card Game/Horror',
    translations: {
      // Menu
      'New Game': 'Nuovo Gioco',
      'Continue': 'Continua',
      'Options': 'Opzioni',
      'Quit': 'Esci',
      
      // Gameplay
      'Draw': 'Pesca',
      'Play': 'Gioca',
      'Sacrifice': 'Sacrifica',
      'Attack': 'Attacca',
      'End Turn': 'Fine Turno',
      
      // Cards
      'Blood': 'Sangue',
      'Bones': 'Ossa',
      'Energy': 'Energia',
      'Damage': 'Danno',
      'Health': 'Salute',
      
      // UI
      'Deck': 'Mazzo',
      'Hand': 'Mano',
      'Board': 'Tavolo',
      'Scale': 'Bilancia',
      'Candle': 'Candela',
      
      // Items
      'Squirrel': 'Scoiattolo',
      'Wolf': 'Lupo',
      'Raven': 'Corvo',
      'Mantis': 'Mantide',
      'Grizzly': 'Grizzly',
    }
  }
];

// Funzione per ottenere traduzioni per un processo
export function getTranslationsForProcess(processName: string): Record<string, string> {
  const game = gameTranslations.find(g => 
    g.processName.toLowerCase() === processName.toLowerCase()
  );
  return game?.translations || {};
}

// Funzione per ottenere info gioco
export function getGameInfo(processName: string): GameTranslation | undefined {
  if (!processName) return undefined;
  
  return gameTranslations.find(g => 
    g.processName && g.processName.toLowerCase() === processName.toLowerCase()
  );
}

// Traduzioni generiche per tutti i giochi
export const genericTranslations: Record<string, string> = {
  // Menu comuni
  'New Game': 'Nuovo Gioco',
  'Continue': 'Continua',
  'Load': 'Carica',
  'Save': 'Salva',
  'Options': 'Opzioni',
  'Settings': 'Impostazioni',
  'Exit': 'Esci',
  'Quit': 'Esci',
  'Back': 'Indietro',
  'Apply': 'Applica',
  'Cancel': 'Annulla',
  'Confirm': 'Conferma',
  'Yes': 'Sì',
  'No': 'No',
  'OK': 'OK',
  
  // Impostazioni comuni
  'Graphics': 'Grafica',
  'Audio': 'Audio',
  'Controls': 'Controlli',
  'Gameplay': 'Gameplay',
  'Video': 'Video',
  'Sound': 'Suono',
  'Music': 'Musica',
  'Effects': 'Effetti',
  'Language': 'Lingua',
  'Subtitles': 'Sottotitoli',
  
  // Gameplay comuni
  'Pause': 'Pausa',
  'Resume': 'Riprendi',
  'Restart': 'Ricomincia',
  'Help': 'Aiuto',
  'Tutorial': 'Tutorial',
  'Inventory': 'Inventario',
  'Map': 'Mappa',
  'Journal': 'Diario',
  'Quests': 'Missioni',
  'Skills': 'Abilità',
  'Stats': 'Statistiche',
  
  // Azioni comuni
  'Use': 'Usa',
  'Take': 'Prendi',
  'Drop': 'Lascia',
  'Equip': 'Equipaggia',
  'Unequip': 'Rimuovi',
  'Buy': 'Compra',
  'Sell': 'Vendi',
  'Talk': 'Parla',
  'Examine': 'Esamina',
  'Open': 'Apri',
  'Close': 'Chiudi',
  
  // Difficoltà
  'Easy': 'Facile',
  'Normal': 'Normale',
  'Hard': 'Difficile',
  'Nightmare': 'Incubo',
  'Casual': 'Casual',
  'Hardcore': 'Hardcore',
  
  // Stato
  'Health': 'Salute',
  'Mana': 'Mana',
  'Stamina': 'Stamina',
  'Energy': 'Energia',
  'Level': 'Livello',
  'Experience': 'Esperienza',
  'Score': 'Punteggio',
  'Time': 'Tempo',
  'Lives': 'Vite',
  'Game Over': 'Fine Partita',
  'Victory': 'Vittoria',
  'Defeat': 'Sconfitta',
};
