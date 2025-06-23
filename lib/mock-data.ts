
export const mockGames = [
  {
    id: '1',
    title: 'Cyberpunk 2077',
    description: 'Open-world action-adventure RPG',
    coverUrl: 'https://cdnb.artstation.com/p/assets/covers/images/033/037/923/large/artur-tarnowski-artur-tarnowski-coverart-thumbnail.jpg?1608208435',
    platform: 'Steam',
    storeId: '1091500',
    engine: 'REDengine 4',
    installPath: 'C:/Games/Steam/steamapps/common/Cyberpunk 2077',
    executablePath: 'C:/Games/Steam/steamapps/common/Cyberpunk 2077/bin/x64/Cyberpunk2077.exe',
    isInstalled: true,
    detectedFiles: ['localization/text_en.csv', 'dialog/conversations.json', 'ui/interface_strings.txt'],
    lastScanned: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    title: 'The Witcher 3: Wild Hunt',
    description: 'Fantasy RPG adventure',
    coverUrl: 'https://i.pinimg.com/originals/3a/cd/0f/3acd0f8f1a3865e3b03ed80ebf8202a6.jpg',
    platform: 'GOG',
    storeId: '1207664663',
    engine: 'REDengine 3',
    installPath: 'C:/Games/GOG Galaxy/Games/The Witcher 3 Wild Hunt',
    executablePath: null,
    isInstalled: false,
    detectedFiles: [],
    lastScanned: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    title: 'Mass Effect Legendary Edition',
    description: 'Sci-fi RPG trilogy remaster',
    coverUrl: 'https://upload.wikimedia.org/wikipedia/en/d/df/Commander_Shepard.png',
    platform: 'Epic Games',
    storeId: 'ebb1b2a5e2ba4e27b499c91a6825c3bf',
    engine: 'Unreal Engine 3',
    installPath: 'C:/Games/Epic Games/MassEffectLegendaryEdition',
    executablePath: 'C:/Games/Epic Games/MassEffectLegendaryEdition/Game/Binaries/Win64/MassEffect1.exe',
    isInstalled: true,
    detectedFiles: ['BioGame/CookedPC/Localization/INT/GlobalTlk.pcc', 'BioGame/CookedPC/Localization/INT/Conversations.pcc'],
    lastScanned: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '4',
    title: 'Horizon Zero Dawn',
    description: 'Post-apocalyptic action RPG',
    coverUrl: 'https://i.pinimg.com/originals/cd/51/83/cd51838b54314c40e11fb351b5b5eb74.jpg',
    platform: 'Steam',
    storeId: '1151640',
    engine: 'Guerrilla Engine',
    installPath: 'C:/Games/Steam/steamapps/common/Horizon Zero Dawn',
    executablePath: 'C:/Games/Steam/steamapps/common/Horizon Zero Dawn/HorizonZeroDawn.exe',
    isInstalled: true,
    detectedFiles: ['Localized/Text/en/strings.json', 'Localized/Audio/en/dialog.bank'],
    lastScanned: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '5',
    title: 'Sekiro: Shadows Die Twice',
    description: 'Action-adventure game set in feudal Japan',
    coverUrl: 'https://i.pinimg.com/originals/b1/37/23/b13723e735b17473a00d422ec5319629.jpg',
    platform: 'Steam',
    storeId: '814380',
    engine: 'FromSoftware Engine',
    installPath: 'C:/Games/Steam/steamapps/common/Sekiro',
    executablePath: 'C:/Games/Steam/steamapps/common/Sekiro/sekiro.exe',
    isInstalled: false,
    detectedFiles: [],
    lastScanned: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const mockTranslations = [
  {
    id: '1',
    gameId: '1',
    filePath: 'localization/text_en.csv',
    originalText: 'Welcome to Night City, the most dangerous place on Earth.',
    translatedText: 'Benvenuto a Night City, il posto più pericoloso della Terra.',
    targetLanguage: 'it',
    sourceLanguage: 'en',
    status: 'COMPLETED' as const,
    confidence: 0.95,
    isManualEdit: false,
    aiSuggestions: [
      'Benvenuti a Night City, il luogo più pericoloso del mondo.',
      'Benvenuto a Night City, la località più pericolosa sulla Terra.'
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    gameId: '3',
    filePath: 'BioGame/CookedPC/Localization/INT/GlobalTlk.pcc',
    originalText: 'Commander, we need to stop the Reapers before they destroy all organic life.',
    translatedText: 'Comandante, dobbiamo fermare i Razziatori prima che distruggano ogni forma di vita organica.',
    targetLanguage: 'it',
    sourceLanguage: 'en',
    status: 'REVIEWED' as const,
    confidence: 0.92,
    isManualEdit: true,
    aiSuggestions: [
      'Comandante, bisogna fermare i Mietitori prima che annientino tutta la vita organica.',
      'Comandante, è necessario fermare i Razziatori prima che sterminino ogni vita organica.'
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const mockPatches = [
  {
    id: '1',
    gameId: '1',
    name: 'Cyberpunk 2077 - Traduzione Italiana Completa',
    description: 'Traduzione completa in italiano di tutti i testi di gioco',
    version: '2.1.0',
    targetLanguage: 'it',
    patchType: 'REPLACEMENT' as const,
    filePath: 'C:/Patches/cyberpunk_2077_it_v2.1.0.exe',
    fileSize: 45670000,
    installCount: 1247,
    isPublished: true,
    translationCount: 15420,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    gameId: '3',
    name: 'Mass Effect LE - Patch Italiana',
    description: 'Traduzione italiana per la trilogia completa',
    version: '1.5.2',
    targetLanguage: 'it',
    patchType: 'HYBRID' as const,
    filePath: null,
    fileSize: null,
    installCount: 892,
    isPublished: false,
    translationCount: 8934,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const mockStoreConnections = [
  {
    platform: 'Steam',
    isConnected: true,
    username: 'GameTranslator_User',
    gamesCount: 156,
    lastSync: new Date(Date.now() - 3600000)
  },
  {
    platform: 'Epic Games',
    isConnected: true,
    username: 'EpicUser123',
    gamesCount: 42,
    lastSync: new Date(Date.now() - 7200000)
  },
  {
    platform: 'GOG',
    isConnected: false,
    gamesCount: 0,
    lastSync: null
  },
  {
    platform: 'EA App',
    isConnected: false,
    gamesCount: 0,
    lastSync: null
  }
];
