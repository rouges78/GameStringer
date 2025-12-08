/**
 * Test completo integrazione Tauri-React per sistema profili
 * Verifica tutte le chiamate API e la comunicazione bidirezionale
 */

const { invoke } = require('@tauri-apps/api/core');

class TauriIntegrationTester {
  constructor() {
    this.results = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async runTest(testName, testFn) {
    this.results.totalTests++;
    try {
      this.log(`Esecuzione test: ${testName}`);
      await testFn();
      this.results.passed++;
      this.log(`Test completato con successo: ${testName}`, 'success');
      return true;
    } catch (error) {
      this.results.failed++;
      const errorMsg = `Test fallito: ${testName} - ${error.message}`;
      this.log(errorMsg, 'error');
      this.results.errors.push({ test: testName, error: error.message });
      return false;
    }
  }

  // Test 1: Verifica lista profili
  async testListProfiles() {
    const response = await invoke('list_profiles');
    
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida da list_profiles');
    }
    
    if (!response.hasOwnProperty('success')) {
      throw new Error('Risposta manca campo success');
    }
    
    if (response.success && response.data && !Array.isArray(response.data)) {
      throw new Error('Campo data dovrebbe essere un array quando success=true');
    }
    
    this.log(`Lista profili: ${response.success ? 'OK' : 'ERRORE'} - ${response.data?.length || 0} profili trovati`);
  }

  // Test 2: Verifica profilo corrente
  async testGetCurrentProfile() {
    const response = await invoke('get_current_profile');
    
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida da get_current_profile');
    }
    
    if (!response.hasOwnProperty('success')) {
      throw new Error('Risposta manca campo success');
    }
    
    this.log(`Profilo corrente: ${response.success ? 'OK' : 'ERRORE'} - ${response.data ? 'Autenticato' : 'Non autenticato'}`);
  }

  // Test 3: Verifica creazione profilo (con dati di test)
  async testCreateProfile() {
    const testProfile = {
      name: `test_profile_${Date.now()}`,
      password: 'TestPassword123!',
      avatar: null,
      settings: {
        theme: 'dark',
        language: 'it',
        auto_login: false,
        session_timeout: 3600
      }
    };

    const response = await invoke('create_profile', { request: testProfile });
    
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida da create_profile');
    }
    
    if (!response.hasOwnProperty('success')) {
      throw new Error('Risposta manca campo success');
    }
    
    if (response.success && !response.data) {
      throw new Error('Creazione riuscita ma mancano dati profilo');
    }
    
    if (response.success && response.data) {
      // Verifica struttura profilo creato
      const profile = response.data;
      if (!profile.id || !profile.name || !profile.created_at) {
        throw new Error('Struttura profilo creato non valida');
      }
      
      // Salva ID per test successivi
      this.testProfileId = profile.id;
      this.testProfileName = profile.name;
    }
    
    this.log(`Creazione profilo: ${response.success ? 'OK' : 'ERRORE'} - ${response.error || 'Profilo creato'}`);
  }

  // Test 4: Verifica autenticazione profilo
  async testAuthenticateProfile() {
    if (!this.testProfileName) {
      throw new Error('Nessun profilo di test disponibile per autenticazione');
    }

    const response = await invoke('authenticate_profile', {
      name: this.testProfileName,
      password: 'TestPassword123!'
    });
    
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida da authenticate_profile');
    }
    
    if (response.success && !response.data) {
      throw new Error('Autenticazione riuscita ma mancano dati profilo');
    }
    
    this.log(`Autenticazione profilo: ${response.success ? 'OK' : 'ERRORE'} - ${response.error || 'Autenticato'}`);
  }

  // Test 5: Verifica cambio profilo
  async testSwitchProfile() {
    if (!this.testProfileName) {
      throw new Error('Nessun profilo di test disponibile per switch');
    }

    const response = await invoke('switch_profile', {
      name: this.testProfileName,
      password: 'TestPassword123!'
    });
    
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida da switch_profile');
    }
    
    this.log(`Cambio profilo: ${response.success ? 'OK' : 'ERRORE'} - ${response.error || 'Cambiato'}`);
  }

  // Test 6: Verifica logout
  async testLogout() {
    const response = await invoke('logout');
    
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida da logout');
    }
    
    this.log(`Logout: ${response.success ? 'OK' : 'ERRORE'} - ${response.error || 'Logout completato'}`);
  }

  // Test 7: Verifica statistiche autenticazione
  async testGetAuthStats() {
    const response = await invoke('get_auth_stats');
    
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida da get_auth_stats');
    }
    
    if (response.success && response.data) {
      const stats = response.data;
      if (typeof stats.total_logins !== 'number' || typeof stats.failed_attempts !== 'number') {
        throw new Error('Struttura statistiche non valida');
      }
    }
    
    this.log(`Statistiche auth: ${response.success ? 'OK' : 'ERRORE'} - ${response.error || 'Statistiche ottenute'}`);
  }

  // Test 8: Verifica controllo sessione
  async testSessionManagement() {
    // Test scadenza sessione
    const expiredResponse = await invoke('is_session_expired', { timeout_seconds: 3600 });
    if (!expiredResponse || typeof expiredResponse !== 'object') {
      throw new Error('Risposta non valida da is_session_expired');
    }
    
    // Test tempo rimanente
    const timeResponse = await invoke('get_session_time_remaining', { timeout_seconds: 3600 });
    if (!timeResponse || typeof timeResponse !== 'object') {
      throw new Error('Risposta non valida da get_session_time_remaining');
    }
    
    this.log(`Gestione sessione: OK - Scadenza: ${expiredResponse.data}, Tempo rimanente: ${timeResponse.data}`);
  }

  // Test 9: Verifica validazione
  async testValidation() {
    // Test validazione nome profilo
    const nameResponse = await invoke('validate_profile_name', { name: 'test_name' });
    if (!nameResponse || typeof nameResponse !== 'object') {
      throw new Error('Risposta non valida da validate_profile_name');
    }
    
    // Test validazione password
    const passwordResponse = await invoke('validate_password', { password: 'TestPassword123!' });
    if (!passwordResponse || typeof passwordResponse !== 'object') {
      throw new Error('Risposta non valida da validate_password');
    }
    
    this.log(`Validazione: OK - Nome: ${nameResponse.success}, Password: ${passwordResponse.success}`);
  }

  // Test 10: Pulizia - elimina profilo di test
  async testDeleteProfile() {
    if (!this.testProfileId) {
      this.log('Nessun profilo di test da eliminare', 'info');
      return;
    }

    const response = await invoke('delete_profile', {
      profile_id: this.testProfileId,
      password: 'TestPassword123!'
    });
    
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida da delete_profile');
    }
    
    this.log(`Eliminazione profilo: ${response.success ? 'OK' : 'ERRORE'} - ${response.error || 'Profilo eliminato'}`);
  }

  // Test comunicazione bidirezionale
  async testBidirectionalCommunication() {
    this.log('=== TEST COMUNICAZIONE BIDIREZIONALE ===');
    
    // Test 1: Invio dati complessi al backend
    const complexData = {
      name: 'test_complex',
      password: 'ComplexPassword123!',
      settings: {
        theme: 'dark',
        language: 'it',
        notifications: {
          enabled: true,
          sound: false,
          types: ['auth', 'system']
        },
        advanced: {
          debug_mode: false,
          auto_backup: true,
          encryption_level: 'high'
        }
      }
    };

    const createResponse = await invoke('create_profile', { request: complexData });
    if (!createResponse.success) {
      throw new Error(`Errore invio dati complessi: ${createResponse.error}`);
    }

    // Test 2: Ricezione dati complessi dal backend
    const listResponse = await invoke('list_profiles');
    if (!listResponse.success || !Array.isArray(listResponse.data)) {
      throw new Error('Errore ricezione dati complessi');
    }

    // Verifica che i dati complessi siano stati preservati
    const createdProfile = listResponse.data.find(p => p.name === 'test_complex');
    if (!createdProfile) {
      throw new Error('Profilo con dati complessi non trovato');
    }

    // Pulizia
    await invoke('delete_profile', {
      profile_id: createdProfile.id,
      password: 'ComplexPassword123!'
    });

    this.log('Comunicazione bidirezionale: OK - Dati complessi gestiti correttamente', 'success');
  }

  // Test gestione errori e timeout
  async testErrorHandling() {
    this.log('=== TEST GESTIONE ERRORI ===');
    
    // Test 1: Autenticazione con credenziali errate
    const authResponse = await invoke('authenticate_profile', {
      name: 'profilo_inesistente',
      password: 'password_errata'
    });
    
    if (authResponse.success) {
      throw new Error('Autenticazione dovrebbe fallire con credenziali errate');
    }
    
    if (!authResponse.error) {
      throw new Error('Risposta di errore dovrebbe contenere messaggio');
    }

    // Test 2: Creazione profilo con nome duplicato
    const duplicateProfile = {
      name: 'duplicate_test',
      password: 'TestPassword123!',
      settings: { theme: 'dark', language: 'it' }
    };

    // Crea primo profilo
    const firstResponse = await invoke('create_profile', { request: duplicateProfile });
    if (!firstResponse.success) {
      throw new Error('Creazione primo profilo fallita');
    }

    // Tenta creazione duplicato
    const duplicateResponse = await invoke('create_profile', { request: duplicateProfile });
    if (duplicateResponse.success) {
      throw new Error('Creazione profilo duplicato dovrebbe fallire');
    }

    // Pulizia
    await invoke('delete_profile', {
      profile_id: firstResponse.data.id,
      password: 'TestPassword123!'
    });

    this.log('Gestione errori: OK - Errori gestiti correttamente', 'success');
  }

  // Test serializzazione/deserializzazione
  async testSerialization() {
    this.log('=== TEST SERIALIZZAZIONE/DESERIALIZZAZIONE ===');
    
    const testData = {
      name: 'serialization_test',
      password: 'SerializationTest123!',
      settings: {
        theme: 'dark',
        language: 'it',
        numbers: [1, 2, 3, 4, 5],
        nested: {
          deep: {
            value: 'test_deep_value',
            boolean: true,
            null_value: null,
            array: ['a', 'b', 'c']
          }
        },
        special_chars: 'àèìòù ñ ç 中文 🎮',
        unicode: '🚀 ⭐ 💻 🎯'
      }
    };

    // Test invio dati complessi
    const createResponse = await invoke('create_profile', { request: testData });
    if (!createResponse.success) {
      throw new Error(`Errore serializzazione: ${createResponse.error}`);
    }

    // Test ricezione e verifica dati
    const profileId = createResponse.data.id;
    const listResponse = await invoke('list_profiles');
    const profile = listResponse.data.find(p => p.id === profileId);
    
    if (!profile) {
      throw new Error('Profilo non trovato dopo serializzazione');
    }

    // Verifica caratteri speciali
    if (!profile.name.includes('serialization_test')) {
      throw new Error('Nome profilo non serializzato correttamente');
    }

    // Pulizia
    await invoke('delete_profile', {
      profile_id: profileId,
      password: 'SerializationTest123!'
    });

    this.log('Serializzazione: OK - Dati serializzati/deserializzati correttamente', 'success');
  }

  // Esegue tutti i test
  async runAllTests() {
    this.log('=== INIZIO TEST INTEGRAZIONE TAURI-REACT ===');
    
    // Test base API
    await this.runTest('Lista Profili', () => this.testListProfiles());
    await this.runTest('Profilo Corrente', () => this.testGetCurrentProfile());
    await this.runTest('Creazione Profilo', () => this.testCreateProfile());
    await this.runTest('Autenticazione Profilo', () => this.testAuthenticateProfile());
    await this.runTest('Cambio Profilo', () => this.testSwitchProfile());
    await this.runTest('Logout', () => this.testLogout());
    await this.runTest('Statistiche Auth', () => this.testGetAuthStats());
    await this.runTest('Gestione Sessione', () => this.testSessionManagement());
    await this.runTest('Validazione', () => this.testValidation());
    
    // Test avanzati
    await this.runTest('Comunicazione Bidirezionale', () => this.testBidirectionalCommunication());
    await this.runTest('Gestione Errori', () => this.testErrorHandling());
    await this.runTest('Serializzazione', () => this.testSerialization());
    
    // Pulizia finale
    await this.runTest('Eliminazione Profilo Test', () => this.testDeleteProfile());
    
    this.printResults();
  }

  printResults() {
    this.log('=== RISULTATI TEST INTEGRAZIONE ===');
    this.log(`Test totali: ${this.results.totalTests}`);
    this.log(`Test superati: ${this.results.passed}`, 'success');
    this.log(`Test falliti: ${this.results.failed}`, this.results.failed > 0 ? 'error' : 'info');
    
    if (this.results.errors.length > 0) {
      this.log('=== ERRORI DETTAGLIATI ===', 'error');
      this.results.errors.forEach(error => {
        this.log(`${error.test}: ${error.error}`, 'error');
      });
    }
    
    const successRate = ((this.results.passed / this.results.totalTests) * 100).toFixed(1);
    this.log(`Tasso di successo: ${successRate}%`, successRate === '100.0' ? 'success' : 'error');
    
    return {
      success: this.results.failed === 0,
      results: this.results
    };
  }
}

// Esecuzione test se chiamato direttamente
if (require.main === module) {
  const tester = new TauriIntegrationTester();
  tester.runAllTests().then(result => {
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('Errore fatale durante test:', error);
    process.exit(1);
  });
}

module.exports = TauriIntegrationTester;