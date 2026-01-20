// Test di sincronizzazione libreria Steam per GameStringer
// Questo script testa i comandi Tauri per la sincronizzazione

async function testSteamSync() {
    console.log('=== TEST SINCRONIZZAZIONE STEAM ===');
    
    try {
        // 1. Test connessione Steam
        console.log('\n1. Testing connessione Steam...');
        const steamConnection = await window.__TAURI__.invoke('test_steam_connection');
        console.log('Risultato connessione Steam:', steamConnection);
        
        // 2. Carica credenziali Steam salvate
        console.log('\n2. Caricamento credenziali Steam...');
        const credentials = await window.__TAURI__.invoke('load_steam_credentials');
        console.log('Credenziali caricate:', credentials ? 'Sì' : 'No');
        
        // 3. Auto-connessione Steam
        console.log('\n3. Auto-connessione Steam...');
        const autoConnect = await window.__TAURI__.invoke('auto_connect_steam');
        console.log('Auto-connessione risultato:', autoConnect);
        
        // 4. Ottieni giochi Steam
        console.log('\n4. Recupero giochi Steam...');
        const steamGames = await window.__TAURI__.invoke('get_steam_games');
        console.log(`Trovati ${steamGames.length} giochi Steam`);
        
        // 5. Mostra primi 5 giochi come esempio
        if (steamGames.length > 0) {
            console.log('\nPrimi 5 giochi:');
            steamGames.slice(0, 5).forEach((game, index) => {
                console.log(`${index + 1}. ${game.title || game.name} (ID: ${game.steam_app_id})`);
                console.log(`   - Engine: ${game.engine || 'Non rilevato'}`);
                console.log(`   - Installato: ${game.is_installed ? 'Sì' : 'No'}`);
                console.log(`   - VR: ${game.is_vr ? 'Sì' : 'No'}`);
            });
        }
        
        // 6. Test libreria completa
        console.log('\n5. Recupero libreria completa...');
        const library = await window.__TAURI__.invoke('get_library_games');
        console.log(`Libreria totale: ${library.length} giochi da tutti gli store`);
        
        // Conta giochi per store
        const storeCount = {};
        library.forEach(game => {
            const store = game.store || 'Unknown';
            storeCount[store] = (storeCount[store] || 0) + 1;
        });
        
        console.log('\nGiochi per store:');
        Object.entries(storeCount).forEach(([store, count]) => {
            console.log(`- ${store}: ${count} giochi`);
        });
        
        console.log('\n=== TEST COMPLETATO CON SUCCESSO ===');
        
    } catch (error) {
        console.error('Errore durante il test:', error);
    }
}

// Esegui il test quando la pagina è pronta
if (window.__TAURI__) {
    console.log('Tauri API disponibile, avvio test...');
    testSteamSync();
} else {
    console.error('Tauri API non disponibile! Assicurati di eseguire questo test nell\'app Tauri.');
}
