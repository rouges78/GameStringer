// Test rapido per verificare la sintassi del nuovo comando Steam local
const { invoke } = require('@tauri-apps/api/core');

async function testLocalSteamGames() {
    console.log('🧪 Testing get_all_local_steam_games...');
    
    try {
        const result = await invoke('get_all_local_steam_games');
        console.log('✅ Successo!');
        console.log('📊 Risultato:', result);
        console.log('📈 Totale giochi trovati:', result.length);
        
        // Mostra alcuni esempi
        if (result.length > 0) {
            console.log('\n🎮 Primi 5 giochi:');
            result.slice(0, 5).forEach((game, index) => {
                console.log(`${index + 1}. ${game.name} (${game.appid})`);
                console.log(`   Status: ${JSON.stringify(game.status)}`);
                if (game.install_dir) {
                    console.log(`   Install dir: ${game.install_dir}`);
                }
            });
        }
    } catch (error) {
        console.error('❌ Errore:', error);
    }
}

module.exports = { testLocalSteamGames };

// Se eseguito direttamente
if (require.main === module) {
    testLocalSteamGames();
}