#!/usr/bin/env node

/**
 * Debug Test per verificare perché i giochi condivisi non appaiono
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 DEBUGGING STEAM FAMILY SHARING VISIBILITY');
console.log('='.repeat(60));

// 1. Verifica se i file di test esistono
console.log('\n1. 📁 VERIFICA FILE DI TEST:');
const testVdfFile = path.join(__dirname, 'test-family-sharing-data.vdf');
if (fs.existsSync(testVdfFile)) {
  console.log('✅ File VDF di test trovato');
  const content = fs.readFileSync(testVdfFile, 'utf8');
  console.log(`📊 Dimensione file: ${content.length} caratteri`);
} else {
  console.log('❌ File VDF di test NON trovato');
}

// 2. Verifica i comandi Tauri registrati
console.log('\n2. 🔧 VERIFICA COMANDI TAURI:');
const mainRsPath = path.join(__dirname, 'src-tauri', 'src', 'main.rs');
if (fs.existsSync(mainRsPath)) {
  const mainRsContent = fs.readFileSync(mainRsPath, 'utf8');
  
  const familySharingCommands = [
    'get_steam_games_with_family_sharing',
    'get_family_sharing_games', 
    'parse_shared_config_vdf'
  ];
  
  familySharingCommands.forEach(cmd => {
    if (mainRsContent.includes(cmd)) {
      console.log(`✅ Comando ${cmd} registrato`);
    } else {
      console.log(`❌ Comando ${cmd} NON registrato`);
    }
  });
} else {
  console.log('❌ File main.rs non trovato');
}

// 3. Verifica la pagina games
console.log('\n3. 🎮 VERIFICA PAGINA GAMES:');
const gamesPagePath = path.join(__dirname, 'app', 'games', 'page.tsx');
if (fs.existsSync(gamesPagePath)) {
  const gamesContent = fs.readFileSync(gamesPagePath, 'utf8');
  
  if (gamesContent.includes('get_steam_games_with_family_sharing')) {
    console.log('✅ Pagina games usa il comando Family Sharing');
  } else if (gamesContent.includes('get_steam_games')) {
    console.log('⚠️ Pagina games usa il comando vecchio');
  } else {
    console.log('❌ Nessun comando Steam trovato');
  }
  
  if (gamesContent.includes('isShared')) {
    console.log('✅ Pagina games gestisce il campo isShared');
  } else {
    console.log('❌ Pagina games NON gestisce il campo isShared');
  }
} else {
  console.log('❌ File games page non trovato');
}

// 4. Verifica il componente GameCard
console.log('\n4. 🃏 VERIFICA GAME CARD:');
const gameCardPath = path.join(__dirname, 'components', 'game-card.tsx');
if (fs.existsSync(gameCardPath)) {
  const gameCardContent = fs.readFileSync(gameCardPath, 'utf8');
  
  if (gameCardContent.includes('isShared')) {
    console.log('✅ GameCard gestisce il campo isShared');
  } else {
    console.log('❌ GameCard NON gestisce il campo isShared');
  }
  
  if (gameCardContent.includes('Condiviso')) {
    console.log('✅ GameCard mostra il badge "Condiviso"');
  } else {
    console.log('❌ GameCard NON mostra il badge "Condiviso"');
  }
} else {
  console.log('❌ File game-card.tsx non trovato');
}

// 5. Verifica tipi TypeScript
console.log('\n5. 📝 VERIFICA TIPI TYPESCRIPT:');
const typesPath = path.join(__dirname, 'lib', 'types.ts');
if (fs.existsSync(typesPath)) {
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  
  if (typesContent.includes('is_shared')) {
    console.log('✅ Tipi includono is_shared');
  } else {
    console.log('❌ Tipi NON includono is_shared');
  }
} else {
  console.log('⚠️ File types.ts non trovato (normale se usi modelli inline)');
}

// 6. Suggerimenti per il debug
console.log('\n6. 💡 SUGGERIMENTI DEBUG:');
console.log('📋 Per verificare se i giochi condivisi vengono caricati:');
console.log('   1. Apri DevTools (F12) nella pagina /games');
console.log('   2. Vai alla tab Console');
console.log('   3. Cerca log che contengono "get_steam_games_with_family_sharing"');
console.log('   4. Verifica se ci sono errori Tauri');
console.log('');
console.log('📋 Per testare manualmente:');
console.log('   1. Vai a /stores');
console.log('   2. Sezione "Steam Family Sharing"');
console.log('   3. Clicca "Rilevamento Automatico"');
console.log('   4. Verifica se vengono trovati giochi condivisi');
console.log('');
console.log('📋 Se non hai giochi realmente condivisi:');
console.log('   1. Condividi la tua libreria Steam con un altro account');
console.log('   2. Oppure testa caricando il file VDF di esempio');

// 7. Controlla se esistono file Steam reali
console.log('\n7. 🔍 VERIFICA INSTALLAZIONE STEAM:');
const possibleSteamPaths = [
  'C:\\Program Files (x86)\\Steam',
  'C:\\Program Files\\Steam',
  process.env.PROGRAMFILES + '\\Steam',
  process.env['PROGRAMFILES(X86)'] + '\\Steam'
];

let steamFound = false;
possibleSteamPaths.forEach(steamPath => {
  if (steamPath && fs.existsSync(steamPath)) {
    console.log(`✅ Steam trovato in: ${steamPath}`);
    steamFound = true;
    
    // Controlla userdata
    const userdataPath = path.join(steamPath, 'userdata');
    if (fs.existsSync(userdataPath)) {
      console.log('✅ Cartella userdata trovata');
      
      try {
        const userDirs = fs.readdirSync(userdataPath);
        console.log(`📊 Trovate ${userDirs.length} cartelle utente`);
        
        // Cerca file sharedconfig.vdf
        let sharedConfigFound = false;
        for (const userDir of userDirs) {
          const sharedConfigPath = path.join(userdataPath, userDir, '7', 'remote', 'sharedconfig.vdf');
          if (fs.existsSync(sharedConfigPath)) {
            console.log(`✅ sharedconfig.vdf trovato per utente ${userDir}`);
            sharedConfigFound = true;
            
            const configContent = fs.readFileSync(sharedConfigPath, 'utf8');
            if (configContent.includes('SharedLibraryUsers')) {
              console.log('✅ File contiene dati Family Sharing');
            } else {
              console.log('⚠️ File non contiene dati Family Sharing');
            }
          }
        }
        
        if (!sharedConfigFound) {
          console.log('⚠️ Nessun file sharedconfig.vdf trovato');
          console.log('💡 Questo significa che Family Sharing non è configurato');
        }
      } catch (error) {
        console.log(`⚠️ Errore lettura userdata: ${error.message}`);
      }
    } else {
      console.log('❌ Cartella userdata non trovata');
    }
  }
});

if (!steamFound) {
  console.log('❌ Steam non trovato nei percorsi standard');
  console.log('💡 Verifica che Steam sia installato');
}

console.log('\n' + '='.repeat(60));
console.log('🎯 PROSSIMI PASSI:');
console.log('1. Se hai giochi realmente condivisi, ricompila con: npm run tauri:build');
console.log('2. Se non hai giochi condivisi, testa con il file VDF di esempio');
console.log('3. Controlla i log della console per errori Tauri');
console.log('4. Verifica che Family Sharing sia attivo nel tuo Steam');