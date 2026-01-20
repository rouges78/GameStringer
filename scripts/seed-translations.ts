import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding translations...');

  // Prima assicuriamoci di avere alcuni giochi
  const games = await prisma.game.findMany();
  
  if (games.length === 0) {
    console.log('Nessun gioco trovato. Creando giochi di esempio...');
    
    const cyberpunk = await prisma.game.create({
      data: {
        title: 'Cyberpunk 2077',
        platform: 'Steam',
        steamAppId: 1091500,
        installPath: 'C:/Games/Steam/steamapps/common/Cyberpunk 2077',
        executablePath: 'C:/Games/Steam/steamapps/common/Cyberpunk 2077/bin/x64/Cyberpunk2077.exe',
        isInstalled: true,
        engine: 'REDengine 4'
      }
    });

    const massEffect = await prisma.game.create({
      data: {
        title: 'Mass Effect Legendary Edition',
        platform: 'Epic Games',
        installPath: 'C:/Games/Epic Games/MassEffectLegendaryEdition',
        executablePath: 'C:/Games/Epic Games/MassEffectLegendaryEdition/Game/Binaries/Win64/MassEffect1.exe',
        isInstalled: true,
        engine: 'Unreal Engine 3'
      }
    });

    const horizon = await prisma.game.create({
      data: {
        title: 'Horizon Zero Dawn',
        platform: 'Steam',
        steamAppId: 1151640,
        installPath: 'C:/Games/Steam/steamapps/common/Horizon Zero Dawn',
        executablePath: 'C:/Games/Steam/steamapps/common/Horizon Zero Dawn/HorizonZeroDawn.exe',
        isInstalled: true,
        engine: 'Guerrilla Engine'
      }
    });

    games.push(cyberpunk, massEffect, horizon);
  }

  // Ora creiamo alcune traduzioni di esempio
  const translationData = [
    {
      gameId: games[0].id,
      filePath: 'localization/text_en.csv',
      originalText: 'Welcome to Night City, the most dangerous place on Earth.',
      translatedText: 'Benvenuto a Night City, il posto più pericoloso della Terra.',
      targetLanguage: 'it',
      sourceLanguage: 'en',
      status: 'completed',
      confidence: 0.95,
      isManualEdit: false,
      context: 'Game intro message'
    },
    {
      gameId: games[0].id,
      filePath: 'dialog/conversations.json',
      originalText: 'Your reputation in Night City will determine your story.',
      translatedText: 'La tua reputazione a Night City determinerà la tua storia.',
      targetLanguage: 'it',
      sourceLanguage: 'en',
      status: 'reviewed',
      confidence: 0.92,
      isManualEdit: true,
      context: 'Character progression dialog'
    },
    {
      gameId: games[0].id,
      filePath: 'ui/interface_strings.txt',
      originalText: 'Press F to interact',
      translatedText: 'Premi F per interagire',
      targetLanguage: 'it',
      sourceLanguage: 'en',
      status: 'completed',
      confidence: 0.98,
      isManualEdit: false,
      context: 'UI prompt'
    },
    {
      gameId: games[0].id,
      filePath: 'localization/text_en.csv',
      originalText: 'Choose your lifepath: Nomad, Street Kid, or Corpo',
      translatedText: '',
      targetLanguage: 'it',
      sourceLanguage: 'en',
      status: 'pending',
      confidence: 0,
      isManualEdit: false,
      context: 'Character creation'
    }
  ];

  // Se abbiamo Mass Effect, aggiungiamo traduzioni per quello
  if (games.length > 1) {
    translationData.push(
      {
        gameId: games[1].id,
        filePath: 'BioGame/CookedPC/Localization/INT/GlobalTlk.pcc',
        originalText: 'Commander, we need to stop the Reapers before they destroy all organic life.',
        translatedText: 'Comandante, dobbiamo fermare i Razziatori prima che distruggano ogni forma di vita organica.',
        targetLanguage: 'it',
        sourceLanguage: 'en',
        status: 'reviewed',
        confidence: 0.88,
        isManualEdit: true,
        context: 'Main story dialog'
      },
      {
        gameId: games[1].id,
        filePath: 'BioGame/CookedPC/Localization/INT/Conversations.pcc',
        originalText: 'I should go.',
        translatedText: 'Dovrei andare.',
        targetLanguage: 'it',
        sourceLanguage: 'en',
        status: 'completed',
        confidence: 0.99,
        isManualEdit: false,
        context: 'Shepard\'s iconic line'
      }
    );
  }

  // Se abbiamo Horizon, aggiungiamo traduzioni per quello
  if (games.length > 2) {
    translationData.push(
      {
        gameId: games[2].id,
        filePath: 'Localized/Text/en/strings.json',
        originalText: 'Hunt mechanical beasts in a lush, post-apocalyptic world.',
        translatedText: '',
        targetLanguage: 'it',
        sourceLanguage: 'en',
        status: 'pending',
        confidence: 0,
        isManualEdit: false,
        context: 'Game description'
      },
      {
        gameId: games[2].id,
        filePath: 'Localized/Text/en/strings.json',
        originalText: 'Focus activated',
        translatedText: 'Focus attivato',
        targetLanguage: 'it',
        sourceLanguage: 'en',
        status: 'edited',
        confidence: 0.95,
        isManualEdit: true,
        context: 'Ability notification'
      }
    );
  }

  // Crea le traduzioni
  for (const data of translationData) {
    const translation = await prisma.translation.create({
      data
    });

    // Aggiungi alcuni suggerimenti AI per le traduzioni completate
    if (translation.status !== 'pending') {
      const suggestions = getSuggestionsForText(translation.originalText, translation.targetLanguage);
      
      for (let i = 0; i < suggestions.length; i++) {
        await prisma.aISuggestion.create({
          data: {
            translationId: translation.id,
            suggestion: suggestions[i],
            confidence: 0.95 - (i * 0.05),
            provider: 'openai'
          }
        });
      }
    }
  }

  console.log('Seeding completato!');
}

function getSuggestionsForText(text: string, targetLanguage: string): string[] {
  if (targetLanguage !== 'it') return [];

  const suggestions: Record<string, string[]> = {
    'Welcome to Night City, the most dangerous place on Earth.': [
      'Benvenuti a Night City, il luogo più pericoloso del mondo.',
      'Benvenuto a Night City, la località più pericolosa sulla Terra.',
      'Ti diamo il benvenuto a Night City, il posto più rischioso del pianeta.'
    ],
    'Your reputation in Night City will determine your story.': [
      'La reputazione che avrai a Night City plasmerà la tua storia.',
      'La tua fama a Night City influenzerà il tuo destino.',
      'Il tuo prestigio a Night City definirà il tuo percorso.'
    ],
    'Commander, we need to stop the Reapers before they destroy all organic life.': [
      'Comandante, bisogna fermare i Mietitori prima che annientino tutta la vita organica.',
      'Comandante, è necessario fermare i Razziatori prima che sterminino ogni vita organica.',
      'Comandante, dobbiamo bloccare i Razziatori prima che eliminino ogni forma di vita.'
    ],
    'I should go.': [
      'Devo andare.',
      'È ora che vada.',
      'Meglio che vada.'
    ],
    'Focus activated': [
      'Focus attivo',
      'Concentrazione attivata',
      'Modalità focus attiva'
    ],
    'Press F to interact': [
      'Premi F per interazione',
      'Tasto F per interagire',
      'F - Interagisci'
    ]
  };

  return suggestions[text] || [];
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });