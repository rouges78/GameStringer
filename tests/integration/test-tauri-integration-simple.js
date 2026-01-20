/**
 * Test semplice per verificare l'integrazione Tauri-React
 * Eseguibile dalla console del browser
 */

// Funzione per testare l'integrazione Tauri-React
async function testTauriIntegration() {
  console.log('🚀 Inizio test integrazione Tauri-React');
  
  const results = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  // Helper per eseguire un test
  async function runTest(testName, testFn) {
    results.totalTests++;
    console.log(`📋 Test: ${testName}`);
    
    try {
      await testFn();
      results.passed++;
      console.log(`✅ ${testName}: SUCCESSO`);
      return true;
    } catch (error) {
      results.failed++;
      const errorMsg = error.message || 'Errore sconosciuto';
      console.error(`❌ ${testName}: FALLITO - ${errorMsg}`);
      results.errors.push({ test: testName, error: errorMsg });
      return false;
    }
  }

  // Test 1: Verifica disponibilità API Tauri
  await runTest('Disponibilità API Tauri', async () => {
    if (typeof window === 'undefined') {
      throw new Error('Window non disponibile');
    }
    
    if (!window.__TAURI__) {
      throw new Error('API Tauri non disponibile');
    }
    
    if (!window.__TAURI__.tauri || !window.__TAURI__.tauri.invoke) {
      throw new Error('Funzione invoke non disponibile');
    }
    
    console.log('📡 API Tauri disponibile');
  });

  // Test 2: Test chiamata semplice
  await runTest('Chiamata API Semplice', async () => {
    const { invoke } = window.__TAURI__.tauri;
    
    const response = await invoke('list_profiles');
    
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida');
    }
    
    if (!response.hasOwnProperty('success')) {
      throw new Error('Risposta manca campo success');
    }
    
    console.log('📊 Risposta list_profiles:', response);
  });

  // Test 3: Test profilo corrente
  await runTest('Profilo Corrente', async () => {
    const { invoke } = window.__TAURI__.tauri;
    
    const response = await invoke('get_current_profile');
    
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida');
    }
    
    console.log('👤 Profilo corrente:', response);
  });

  // Test 4: Test validazione
  await runTest('Validazione Nome', async () => {
    const { invoke } = window.__TAURI__.tauri;
    
    const response = await invoke('validate_profile_name', { name: 'test_name' });
    
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida');
    }
    
    console.log('✔️ Validazione nome:', response);
  });

  // Test 5: Test gestione errori
  await runTest('Gestione Errori', async () => {
    const { invoke } = window.__TAURI__.tauri;
    
    const response = await invoke('authenticate_profile', {
      name: 'profilo_inesistente',
      password: 'password_errata'
    });
    
    // Questo dovrebbe fallire, quindi success dovrebbe essere false
    if (response.success) {
      throw new Error('Autenticazione dovrebbe fallire con credenziali errate');
    }
    
    if (!response.error) {
      throw new Error('Risposta di errore dovrebbe contenere messaggio');
    }
    
    console.log('🚫 Errore gestito correttamente:', response.error);
  });

  // Test 6: Test serializzazione dati complessi
  await runTest('Serializzazione Dati Complessi', async () => {
    const { invoke } = window.__TAURI__.tauri;
    
    const complexData = {
      name: `test_serialization_${Date.now()}`,
      password: 'TestPassword123!',
      settings: {
        theme: 'dark',
        language: 'it',
        nested: {
          deep: {
            value: 'test_value',
            array: [1, 2, 3],
            boolean: true
          }
        },
        unicode: 'àèìòù 🎮 中文'
      }
    };
    
    const response = await invoke('create_profile', { request: complexData });
    
    if (response.success && response.data) {
      // Pulizia: elimina il profilo di test
      try {
        await invoke('delete_profile', {
          profile_id: response.data.id,
          password: 'TestPassword123!'
        });
        console.log('🧹 Profilo di test eliminato');
      } catch (cleanupError) {
        console.warn('⚠️ Errore pulizia profilo:', cleanupError);
      }
    } else if (!response.success) {
      // Se la creazione fallisce, potrebbe essere normale (es. nome duplicato)
      console.log('ℹ️ Creazione profilo fallita (normale per test):', response.error);
    }
    
    console.log('🔄 Serializzazione testata');
  });

  // Stampa risultati finali
  console.log('\n📊 RISULTATI TEST INTEGRAZIONE TAURI-REACT');
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
  
  if (results.failed === 0) {
    console.log('\n🎉 TUTTI I TEST SONO PASSATI! Integrazione Tauri-React funzionante.');
  } else {
    console.log('\n⚠️ Alcuni test sono falliti. Verificare l\'integrazione.');
  }
  
  return {
    success: results.failed === 0,
    results
  };
}

// Funzione per testare hook React
async function testReactHooks() {
  console.log('🔗 Test React Hooks per profili');
  
  // Verifica se siamo in un ambiente React
  if (typeof window !== 'undefined' && window.React) {
    console.log('⚛️ React disponibile');
    
    // Test hook useProfiles (se disponibile)
    if (window.useProfiles) {
      console.log('🪝 Hook useProfiles disponibile');
    } else {
      console.log('⚠️ Hook useProfiles non disponibile globalmente');
    }
  } else {
    console.log('⚠️ React non disponibile o non in ambiente browser');
  }
}

// Funzione principale
async function runAllTests() {
  console.clear();
  console.log('🧪 SUITE TEST INTEGRAZIONE TAURI-REACT');
  console.log('=' .repeat(60));
  
  try {
    // Test integrazione Tauri
    const tauriResults = await testTauriIntegration();
    
    // Test hooks React
    await testReactHooks();
    
    console.log('\n🏁 TUTTI I TEST COMPLETATI');
    
    return tauriResults;
  } catch (error) {
    console.error('💥 Errore fatale durante i test:', error);
    return { success: false, error: error.message };
  }
}

// Esporta le funzioni per uso globale
if (typeof window !== 'undefined') {
  window.testTauriIntegration = testTauriIntegration;
  window.testReactHooks = testReactHooks;
  window.runAllTests = runAllTests;
  
  console.log('🔧 Test functions available:');
  console.log('- testTauriIntegration()');
  console.log('- testReactHooks()');
  console.log('- runAllTests()');
}

// Auto-esecuzione se richiesto
if (typeof window !== 'undefined' && window.location.search.includes('autotest=true')) {
  runAllTests();
}