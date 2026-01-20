const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    // Conta i giochi nel database
    const gameCount = await prisma.game.count();
    console.log(`\n📊 Giochi nel database: ${gameCount}`);
    
    if (gameCount === 0) {
      console.log('\n⚠️  Nessun gioco trovato! Aggiungo alcuni giochi di test...\n');
      
      // Aggiungi alcuni giochi di test
      const testGames = [
        {
          title: 'The Witcher 3: Wild Hunt',
          platform: 'Steam',
          installPath: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\The Witcher 3',
          executablePath: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\The Witcher 3\\bin\\x64\\witcher3.exe',
          isInstalled: true,
          engine: 'REDengine 3',
          steamAppId: 292030
        },
        {
          title: 'Grand Theft Auto V',
          platform: 'Steam',
          installPath: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Grand Theft Auto V',
          executablePath: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Grand Theft Auto V\\GTA5.exe',
          isInstalled: true,
          engine: 'RAGE',
          steamAppId: 271590
        },
        {
          title: 'Cyberpunk 2077',
          platform: 'GOG',
          installPath: 'C:\\Games\\Cyberpunk 2077',
          executablePath: 'C:\\Games\\Cyberpunk 2077\\bin\\x64\\Cyberpunk2077.exe',
          isInstalled: false,
          engine: 'REDengine 4'
        },
        {
          title: 'Elden Ring',
          platform: 'Steam',
          installPath: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\ELDEN RING',
          executablePath: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\ELDEN RING\\Game\\eldenring.exe',
          isInstalled: true,
          engine: 'Custom Engine',
          steamAppId: 1245620
        }
      ];
      
      for (const game of testGames) {
        const created = await prisma.game.create({ data: game });
        console.log(`✅ Aggiunto: ${created.title}`);
      }
      
      console.log('\n✨ Giochi di test aggiunti con successo!');
    } else {
      // Mostra i primi 5 giochi
      const games = await prisma.game.findMany({ take: 5 });
      console.log('\n📋 Primi 5 giochi nel database:');
      games.forEach((game, index) => {
        console.log(`${index + 1}. ${game.title} (${game.platform}) - ${game.isInstalled ? '✅ Installato' : '❌ Non installato'}`);
      });
    }
    
    // Conta le patch
    const patchCount = await prisma.patch?.count() || 0;
    console.log(`\n📦 Patch nel database: ${patchCount}`);
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
