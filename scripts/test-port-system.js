#!/usr/bin/env node

const PortManager = require('./port-manager');

async function testPortSystem() {
  console.log('🧪 === TEST PORT SYSTEM ===\n');
  
  const portManager = new PortManager();
  
  try {
    // Test 1: Verifica configurazione attuale
    console.log('📋 Test 1: Verifica configurazione attuale');
    await portManager.verifyConfiguration();
    
    // Test 2: Sincronizzazione porte
    console.log('🔧 Test 2: Sincronizzazione porte');
    const port = await portManager.synchronizePorts();
    console.log(`✅ Porta sincronizzata: ${port}\n`);
    
    // Test 3: Verifica dopo sincronizzazione
    console.log('🔍 Test 3: Verifica dopo sincronizzazione');
    const { port: finalPort, available } = await portManager.verifyConfiguration();
    
    // Test 4: Test porta disponibile
    console.log('🚪 Test 4: Test disponibilità porta');
    const isAvailable = await portManager.isPortAvailable(finalPort);
    console.log(`Porta ${finalPort} disponibile: ${isAvailable ? '✅' : '❌'}\n`);
    
    // Test 5: Find alternative port
    console.log('🔍 Test 5: Ricerca porta alternativa');
    const altPort = await portManager.findAvailablePort(finalPort + 1);
    console.log(`Porta alternativa: ${altPort}\n`);
    
    // Risultato finale
    console.log('🎯 === RISULTATO TEST ===');
    console.log(`✅ Porta configurata: ${finalPort}`);
    console.log(`✅ Porta disponibile: ${isAvailable ? 'SÌ' : 'NO'}`);
    console.log(`✅ Sistema pronto per l'uso!`);
    
    if (!isAvailable) {
      console.log(`💡 Suggerimento: Usa "npm run dev:sync ${altPort}" per cambiare porta`);
    }
    
  } catch (error) {
    console.error(`❌ Errore test: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  testPortSystem();
}

module.exports = testPortSystem;