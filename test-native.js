// Test del modulo nativo
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

console.log('Test caricamento modulo nativo GameStringer...\n');

async function testNative() {
  try {
    // Prova a caricare il modulo
    const modulePath = path.join(__dirname, 'native', 'build', 'Release', 'gamestringer_injector.node');
    console.log('Percorso modulo:', modulePath);
    
    const native = require(modulePath);
    console.log('✅ Modulo caricato con successo!');
    console.log('Funzioni disponibili:', Object.keys(native));
    
    // Test privilegi admin con metodo Windows
    let isAdmin = false;
    try {
      await execAsync('net session', { windowsHide: true });
      isAdmin = true;
    } catch (e) {
      isAdmin = false;
    }
    
    console.log('\nPrivilegi amministratore:', isAdmin ? '✅ Sì' : '❌ No');
    
    if (!isAdmin) {
      console.log('\n⚠️  ATTENZIONE: Per l\'injection reale sono necessari privilegi di amministratore!');
      console.log('   Chiudi questo terminale e aprilo come amministratore.');
      return;
    }
    
    // Test injection con dati di esempio
    console.log('\n📝 Test injection con dati di esempio...');
    const testTranslations = [
      { original: 'New Game', translated: 'Nuovo Gioco' },
      { original: 'Continue', translated: 'Continua' }
    ];
    
    // Usa un PID fittizio per il test
    const testPid = 1234;
    console.log(`\nProvo injection nel processo ${testPid} (test)...`);
    
    try {
      const result = native.injectTranslations(testPid, testTranslations);
      console.log('Risultato injection:', result);
    } catch (err) {
      console.log('Errore injection (normale per PID di test):', err.message);
    }
    
  } catch (error) {
    console.error('❌ Errore nel caricamento del modulo:', error.message);
    console.error('\nDettagli:', error);
  }
}

testNative();
