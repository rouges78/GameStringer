// Test di sincronizzazione Steam per GameStringer
// Da eseguire SOLO nella console DevTools della finestra desktop Tauri

async function testSteamSync() {
    console.log('🎮 TEST SINCRONIZZAZIONE STEAM - GAMESTRINGER');
    console.log('📅 Test avviato:', new Date().toLocaleString());
    
    try {
        // Usa il wrapper Tauri personalizzato di GameStringer
        const { invoke } = await import('/lib/tauri-api.js');
        
        // 1. Test connessione Steam
        console.log('\n1️⃣ Testing connessione Steam...');
        const connection = await invoke('test_steam_connection');
        console.log('✅ Connessione:', connection);
        
        // 2. Auto-connect Steam
        console.log('\n2️⃣ Auto-connessione Steam...');
        const autoConnect = await invoke('auto_connect_steam');
        console.log('✅ Auto-connect:', autoConnect);
        
        // 3. Scansione giochi
        console.log('\n3️⃣ Scansione libreria Steam...');
        const scanResult = await invoke('scan_games');
        console.log('✅ Scansione completata');
        
        // 4. Recupera giochi Steam
        console.log('\n4️⃣ Recupero giochi Steam...');
        const steamGames = await invoke('get_steam_games');
        console.log(`✅ Trovati ${steamGames.length} giochi Steam!`);
        
        // 5. Statistiche dettagliate
        const installed = steamGames.filter(g => g.is_installed).length;
        const owned = steamGames.length - installed;
        const vr = steamGames.filter(g => g.is_vr).length;
        const withEngine = steamGames.filter(g => g.engine && g.engine !== 'Unknown').length;
        
        console.log('\n📊 STATISTICHE:');
        console.log(`   📦 Totale giochi: ${steamGames.length}`);
        console.log(`   💾 Installati: ${installed}`);
        console.log(`   ☁️  Solo posseduti: ${owned}`);
        console.log(`   🥽 Giochi VR: ${vr}`);
        console.log(`   ⚙️  Con engine rilevato: ${withEngine}`);
        
        // 6. Mostra primi 5 giochi con dettagli
        console.log('\n📋 Primi 5 giochi:');
        steamGames.slice(0, 5).forEach((game, i) => {
            console.log(`${i+1}. ${game.title || game.name}`);
            console.log(`   - Engine: ${game.engine || 'Non rilevato'}`);
            console.log(`   - Installato: ${game.is_installed ? '✅' : '❌'}`);
            console.log(`   - VR: ${game.is_vr ? '🥽' : '❌'}`);
            if (game.languages?.length > 0) {
                console.log(`   - Lingue: ${game.languages.slice(0, 3).join(', ')}${game.languages.length > 3 ? '...' : ''}`);
            }
        });
        
        // 7. Verifica finale
        console.log('\n🎯 RISULTATO FINALE:');
        if (steamGames.length >= 1300) {
            console.log('✅ SUCCESSO TOTALE! Sincronizzazione Steam funziona perfettamente!');
            console.log(`   Rilevati ${steamGames.length} giochi (attesi ~1345)`);
            console.log('   La strategia RAI PAL è completamente funzionante! 🎉');
        } else if (steamGames.length > 100) {
            console.log('⚠️ Sincronizzazione parziale');
            console.log(`   Trovati ${steamGames.length} giochi, ma ne sono attesi ~1345`);
        } else {
            console.log('❌ Sincronizzazione fallita o incompleta');
            console.log(`   Solo ${steamGames.length} giochi trovati`);
        }
        
        return steamGames;
        
    } catch (error) {
        console.error('❌ ERRORE DURANTE IL TEST:', error);
        console.error('Stack trace:', error.stack);
        
        // Suggerimenti per risolvere l'errore
        if (error.message.includes('not a function')) {
            console.error('\n⚠️ ATTENZIONE: Sembra che tu stia eseguendo questo test nel browser normale.');
            console.error('   Questo test DEVE essere eseguito nella finestra desktop di GameStringer!');
        }
    }
}

// Esegui il test
testSteamSync().then(() => {
    console.log('\n✅ Test completato!');
}).catch(err => {
    console.error('\n❌ Test fallito:', err);
});
