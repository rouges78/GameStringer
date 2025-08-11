/**
 * Test di integrazione Tauri-React eseguibile dalla console del browser
 * Apri la console del browser e digita: testIntegration()
 */

window.testIntegration = async function() {
  console.clear();
  console.log('🧪 TEST INTEGRAZIONE TAURI-REACT');
  console.log('='.repeat(50));
  
  const results = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  async function runTest(testName, testFn) {
    results.totalTests++;
    console.log(`\n📋 Test: ${testName}`);
    
    try {
      const startTime = Date.now();
      await testFn();
      const duration = Date.now() - startTime;
      results.passed++;
      console.log(`✅ ${testName}: SUCCESSO (${duration}ms)`);
      return true;
    } catch (error) {
      results.failed++;
      const errorMsg = error.message || 'Errore sconosciuto';
      console.error(`❌ ${testName}: FALLITO - ${errorMsg}`);
      results.errors.push({ test: testName, error: errorMsg });
      return false;
    }
  }

  // Verifica ambiente Tauri
  if (typeof window === 'undefined' || !window.__TAURI__) {
    console.error('❌ Ambiente Tauri non disponibile');
    console.log('💡 Assicurati di essere nell\'app Tauri desktop');
    return { success: false, error: 'Ambiente Tauri non disponibile' };
  }

  const { invoke } = window.__TAURI__.tauri;

  // Test 1: Lista profili
  await runTest('Lista Profili', async () => {
    const response = await invoke('list_profiles');
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida');
    }
    if (!response.hasOwnProperty('success')) {
      throw new Error('Risposta manca campo success');
    }
    console.log('📊 Lista profili:', response);
  });

  // Test 2: Profilo corrente
  await runTest('Profilo Corrente', async () => {
    const response = await invoke('get_current_profile');
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida');
    }
    console.log('👤 Profilo corrente:', response);
  });

  // Test 3: Validazione
  await runTest('Validazione Nome', async () => {
    const response = await invoke('validate_profile_name', { name: 'test_name' });
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida');
    }
    console.log('✔️ Validazione:', response);
  });

  // Test 4: Gestione errori
  await runTest('Gestione Errori', async () => {
    const response = await invoke('authenticate_profile', {
      name: 'profilo_inesistente',
      password: 'password_errata'
    });
    
    if (response.success) {
      throw new Error('Autenticazione dovrebbe fallire');
    }
    
    if (!response.error) {
      throw new Error('Risposta di errore dovrebbe contenere messaggio');
    }
    
    console.log('🚫 Errore gestito:', response.error);
  });

  // Test 5: Creazione e eliminazione profilo
  await runTest('Creazione/Eliminazione Profilo', async () => {
    const testName = `test_integration_${Date.now()}`;
    const testPassword = 'TestPassword123!';
    
    // Crea profilo
    const createResponse = await invoke('create_profile', {
      request: {
        name: testName,
        password: testPassword,
        settings: {
          theme: 'dark',
          language: 'it'
        }
      }
    });
    
    if (!createResponse.success) {
      throw new Error(`Creazione fallita: ${createResponse.error}`);
    }
    
    console.log('➕ Profilo creato:', createResponse.data.id);
    
    // Elimina profilo
    const deleteResponse = await invoke('delete_profile', {
      profile_id: createResponse.data.id,
      password: testPassword
    });
    
    if (!deleteResponse.success) {
      throw new Error(`Eliminazione fallita: ${deleteResponse.error}`);
    }
    
    console.log('🗑️ Profilo eliminato');
  });

  // Risultati finali
  console.log('\n' + '='.repeat(50));
  console.log('📊 RISULTATI FINALI');
  console.log('='.repeat(50));
  console.log(`📈 Test totali: ${results.totalTests}`);
  console.log(`✅ Test superati: ${results.passed}`);
  console.log(`❌ Test falliti: ${results.failed}`);
  console.log(`📊 Tasso di successo: ${((results.passed / results.totalTests) * 100).toFixed(1)}%`);
  
  if (results.errors.length > 0) {
    console.log('\n🚨 ERRORI DETTAGLIATI:');
    results.errors.forEach(error => {
      console.log(`❌ ${error.test}: ${error.error}`);
    });
  }
  
  const success = results.failed === 0;
  
  if (success) {
    console.log('\n🎉 TUTTI I TEST SONO PASSATI!');
    console.log('✅ L\'integrazione Tauri-React funziona correttamente.');
  } else {
    console.log('\n⚠️ ALCUNI TEST SONO FALLITI');
    console.log('❌ Verificare l\'integrazione Tauri-React.');
  }
  
  return {
    success,
    results
  };
};

// Messaggio di benvenuto
console.log('🔧 Test di integrazione Tauri-React caricato!');
console.log('💡 Digita testIntegration() nella console per eseguire i test');

// Auto-esecuzione se richiesto
if (window.location.search.includes('autotest=true')) {
  setTimeout(() => {
    window.testIntegration();
  }, 1000);
}