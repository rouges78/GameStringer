'use client';

import { useState, useCallback } from 'react';
import { invoke } from '@/lib/tauri-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Play } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
}

export function TauriIntegrationTest() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testProfileId, setTestProfileId] = useState<string | null>(null);

  const updateTest = useCallback((name: string, updates: Partial<TestResult>) => {
    setTests(prev => prev.map(test => 
      test.name === name ? { ...test, ...updates } : test
    ));
  }, []);

  const runTest = useCallback(async (testName: string, testFn: () => Promise<void>) => {
    const startTime = Date.now();
    updateTest(testName, { status: 'running' });
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      updateTest(testName, { 
        status: 'success', 
        message: 'Test completato con successo',
        duration 
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTest(testName, { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
        duration 
      });
    }
  }, [updateTest]);

  // Test 1: Lista profili
  const testListProfiles = useCallback(async () => {
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
  }, []);

  // Test 2: Profilo corrente
  const testGetCurrentProfile = useCallback(async () => {
    const response = await invoke('get_current_profile');
    
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida da get_current_profile');
    }
    
    if (!response.hasOwnProperty('success')) {
      throw new Error('Risposta manca campo success');
    }
  }, []);

  // Test 3: Creazione profilo
  const testCreateProfile = useCallback(async () => {
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
    
    if (response.success && response.data) {
      const profile = response.data;
      if (!profile.id || !profile.name || !profile.created_at) {
        throw new Error('Struttura profilo creato non valida');
      }
      setTestProfileId(profile.id);
    } else if (!response.success) {
      throw new Error(response.error || 'Errore creazione profilo');
    }
  }, []);

  // Test 4: Autenticazione profilo
  const testAuthenticateProfile = useCallback(async () => {
    if (!testProfileId) {
      throw new Error('Nessun profilo di test disponibile');
    }

    // Prima ottieni il nome del profilo
    const listResponse = await invoke('list_profiles');
    if (!listResponse.success) {
      throw new Error('Impossibile ottenere lista profili');
    }

    const testProfile = listResponse.data.find((p: any) => p.id === testProfileId);
    if (!testProfile) {
      throw new Error('Profilo di test non trovato');
    }

    const response = await invoke('authenticate_profile', {
      name: testProfile.name,
      password: 'TestPassword123!'
    });
    
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida da authenticate_profile');
    }
    
    if (!response.success) {
      throw new Error(response.error || 'Errore autenticazione');
    }
  }, [testProfileId]);

  // Test 5: Logout
  const testLogout = useCallback(async () => {
    const response = await invoke('logout');
    
    if (!response || typeof response !== 'object') {
      throw new Error('Risposta non valida da logout');
    }
    
    if (!response.success) {
      throw new Error(response.error || 'Errore logout');
    }
  }, []);

  // Test 6: Validazione
  const testValidation = useCallback(async () => {
    const nameResponse = await invoke('validate_profile_name', { name: 'test_name' });
    if (!nameResponse || typeof nameResponse !== 'object') {
      throw new Error('Risposta non valida da validate_profile_name');
    }
    
    const passwordResponse = await invoke('validate_password', { password: 'TestPassword123!' });
    if (!passwordResponse || typeof passwordResponse !== 'object') {
      throw new Error('Risposta non valida da validate_password');
    }
  }, []);

  // Test 7: Gestione errori
  const testErrorHandling = useCallback(async () => {
    const response = await invoke('authenticate_profile', {
      name: 'profilo_inesistente',
      password: 'password_errata'
    });
    
    if (response.success) {
      throw new Error('Autenticazione dovrebbe fallire con credenziali errate');
    }
    
    if (!response.error) {
      throw new Error('Risposta di errore dovrebbe contenere messaggio');
    }
  }, []);

  // Test 8: Serializzazione dati complessi
  const testSerialization = useCallback(async () => {
    const complexData = {
      name: `serialization_test_${Date.now()}`,
      password: 'SerializationTest123!',
      settings: {
        theme: 'dark',
        language: 'it',
        nested: {
          deep: {
            value: 'test_deep_value',
            boolean: true,
            array: ['a', 'b', 'c']
          }
        },
        special_chars: 'àèìòù ñ ç 🎮',
        unicode: '🚀 ⭐ 💻 🎯'
      }
    };

    const createResponse = await invoke('create_profile', { request: complexData });
    if (!createResponse.success) {
      throw new Error(`Errore serializzazione: ${createResponse.error}`);
    }

    // Pulizia
    await invoke('delete_profile', {
      profile_id: createResponse.data.id,
      password: 'SerializationTest123!'
    });
  }, []);

  // Test 9: Pulizia profilo di test
  const testCleanup = useCallback(async () => {
    if (!testProfileId) {
      return; // Nessun profilo da pulire
    }

    const response = await invoke('delete_profile', {
      profile_id: testProfileId,
      password: 'TestPassword123!'
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Errore eliminazione profilo');
    }
    
    setTestProfileId(null);
  }, [testProfileId]);

  const runAllTests = useCallback(async () => {
    setIsRunning(true);
    
    const testSuite = [
      { name: 'Lista Profili', fn: testListProfiles },
      { name: 'Profilo Corrente', fn: testGetCurrentProfile },
      { name: 'Creazione Profilo', fn: testCreateProfile },
      { name: 'Autenticazione Profilo', fn: testAuthenticateProfile },
      { name: 'Logout', fn: testLogout },
      { name: 'Validazione', fn: testValidation },
      { name: 'Gestione Errori', fn: testErrorHandling },
      { name: 'Serializzazione', fn: testSerialization },
      { name: 'Pulizia', fn: testCleanup },
    ];

    // Inizializza tutti i test come pending
    setTests(testSuite.map(test => ({ 
      name: test.name, 
      status: 'pending' as const 
    })));

    // Esegui tutti i test in sequenza
    for (const test of testSuite) {
      await runTest(test.name, test.fn);
    }
    
    setIsRunning(false);
  }, [
    testListProfiles,
    testGetCurrentProfile,
    testCreateProfile,
    testAuthenticateProfile,
    testLogout,
    testValidation,
    testErrorHandling,
    testSerialization,
    testCleanup,
    runTest
  ]);

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'running':
        return <Badge variant="secondary">In corso</Badge>;
      case 'success':
        return <Badge variant="default" className="bg-green-500">Successo</Badge>;
      case 'error':
        return <Badge variant="destructive">Errore</Badge>;
      default:
        return <Badge variant="outline">In attesa</Badge>;
    }
  };

  const successCount = tests.filter(t => t.status === 'success').length;
  const errorCount = tests.filter(t => t.status === 'error').length;
  const totalTests = tests.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Test Integrazione Tauri-React
          </CardTitle>
          <div className="flex gap-4 text-sm">
            <span>Totali: {totalTests}</span>
            <span className="text-green-600">Successi: {successCount}</span>
            <span className="text-red-600">Errori: {errorCount}</span>
            {totalTests > 0 && (
              <span>Tasso successo: {((successCount / totalTests) * 100).toFixed(1)}%</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runAllTests} 
            disabled={isRunning}
            className="mb-4"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Esecuzione test...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Esegui tutti i test
              </>
            )}
          </Button>

          <div className="space-y-3">
            {tests.map((test, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(test.status)}
                  <span className="font-medium">{test.name}</span>
                  {test.duration && (
                    <span className="text-sm text-gray-500">({test.duration}ms)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(test.status)}
                </div>
              </div>
            ))}
          </div>

          {tests.some(t => t.status === 'error') && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">Errori dettagliati:</h4>
              <div className="space-y-2">
                {tests
                  .filter(t => t.status === 'error')
                  .map((test, index) => (
                    <div key={index} className="text-sm">
                      <span className="font-medium text-red-700">{test.name}:</span>
                      <span className="text-red-600 ml-2">{test.message}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}