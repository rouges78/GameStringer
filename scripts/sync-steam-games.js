// Script per sincronizzare i giochi Steam dal JSON al database Prisma
// Risolve il problema dei nomi "Steam Game XXXXX" espandendo la copertura del database

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function syncSteamGames() {
  console.log('🎮 Avvio sincronizzazione giochi Steam...');
  
  try {
    // Leggi il file steam_owned_games.json
    const steamGamesPath = path.join(__dirname, '..', 'steam_owned_games.json');
    
    if (!fs.existsSync(steamGamesPath)) {
      console.error('❌ File steam_owned_games.json non trovato');
      return;
    }
    
    const steamGamesData = JSON.parse(fs.readFileSync(steamGamesPath, 'utf8'));
    console.log(`📊 Trovati ${steamGamesData.length} giochi Steam nel JSON`);
    
    let syncedCount = 0;
    let updatedCount = 0;
    
    for (const steamGame of steamGamesData) {
      try {
        // Verifica se il gioco esiste già nel database
        const existingGame = await prisma.game.findUnique({
          where: { steamAppId: steamGame.appid }
        });
        
        const gameData = {
          title: steamGame.name,
          platform: 'Steam',
          steamAppId: steamGame.appid,
          isInstalled: false, // Sarà aggiornato dalla scansione locale
          imageUrl: steamGame.img_icon_url ? 
            `https://media.steampowered.com/steamcommunity/public/images/apps/${steamGame.appid}/${steamGame.img_icon_url}.jpg` : 
            null,
          lastPlayed: steamGame.rtime_last_played > 0 ? 
            new Date(steamGame.rtime_last_played * 1000) : 
            null
        };
        
        if (existingGame) {
          // Aggiorna il gioco esistente solo se il nome è migliorato
          if (existingGame.title.startsWith('Steam Game ') || 
              existingGame.title.length < steamGame.name.length) {
            await prisma.game.update({
              where: { id: existingGame.id },
              data: gameData
            });
            updatedCount++;
            console.log(`🔄 Aggiornato: ${steamGame.name} (${steamGame.appid})`);
          }
        } else {
          // Crea nuovo gioco
          await prisma.game.create({
            data: {
              ...gameData,
              id: `steam_${steamGame.appid}` // ID consistente
            }
          });
          syncedCount++;
          console.log(`✅ Aggiunto: ${steamGame.name} (${steamGame.appid})`);
        }
        
        // Pausa piccola per evitare sovraccarico database
        if ((syncedCount + updatedCount) % 100 === 0) {
          console.log(`📈 Progresso: ${syncedCount + updatedCount}/${steamGamesData.length}`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ Errore sincronizzazione gioco ${steamGame.appid}:`, error.message);
      }
    }
    
    console.log(`🎯 Sincronizzazione completata:`);
    console.log(`   - Nuovi giochi aggiunti: ${syncedCount}`);
    console.log(`   - Giochi aggiornati: ${updatedCount}`);
    console.log(`   - Totale processati: ${syncedCount + updatedCount}/${steamGamesData.length}`);
    
    // Statistiche finali
    const totalGames = await prisma.game.count();
    const steamGames = await prisma.game.count({ where: { platform: 'Steam' } });
    
    console.log(`📊 Statistiche database:`);
    console.log(`   - Totale giochi: ${totalGames}`);
    console.log(`   - Giochi Steam: ${steamGames}`);
    
  } catch (error) {
    console.error('❌ Errore durante la sincronizzazione:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui la sincronizzazione se chiamato direttamente
if (require.main === module) {
  syncSteamGames()
    .then(() => {
      console.log('✅ Script completato con successo');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script fallito:', error);
      process.exit(1);
    });
}

module.exports = { syncSteamGames };
