'use client';

import { useState } from 'react';
import { invoke } from '@/lib/tauri-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Play, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
}

export function SimpleIntegrationTest() {
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Lista Profili', status: 'idle' },
    { name: 'Profilo Corrente', status: 'idle' },
    { name: 'Validazione Nome', status: 'idle' },
    { name: 'Gestione Errori', status: 'idle' },
    { name: 'Creazione/Eliminazione Profilo', status: 'idle' }
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [overallResult, setOverallResult] = useState<'idle' | 'success' | 'error'>('idle');

  const updateTest = (index: number, updates: Partial<TestResult>) => {
    setTests(prev => prev.map((test, i) => 
      i === index ? { ...test, ...updates } : test
    ));
  };

  const runTest = async (index: number, testFn: () => Promise<void>) => {
    const startTime = Date.now();
    updateTest(index, { status: 'running' });
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      updateTest(index, { 
        status: 'success', 
        message: 'Test completato con successo',
        duration 
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTest(index, { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
        duration 
      });
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setOverallResult('idle');
    
    // Reset tutti i test
    setTests(prev => prev.map(test => ({ ...test, status: 'idle' as const, message: undefined, duration: undefined })));
    
    let allPassed = true;

    // Test 1: Lista profili
    await runTest(0, async () => {
      const response = await invoke('list_profiles');
      if (!response || typeof response !== 'object') {
        throw new Error('Risposta non valida da list_profiles');
      }
      if (!response.hasOwnProperty('success')) {
        throw new Error('Risposta manca campo success');
      }
    });
    if (tests[0]?.status === 'error') allPassed = false;

    // Test 2: Profilo corrente
    await runTest(1, async () => {
      const response = await invoke('get_current_profile');
      if (!response || typeof response !== 'object') {
        throw new Error('Risposta non valida da get_current_profile');
      }
      if (!response.hasOwnProperty('success')) {
        throw new Error('Risposta manca campo success');
      }
    });
    if (tests[1]?.status === 'error') allPassed = false;

    // Test 3: Validazione nome
    await runTest(2, async () => {
      const response = await invoke('validate_profile_name', { name: 'test_name' });
      if (!response || typeof response !== 'object') {
        throw new Error('Risposta non valida da validate_profile_name');
      }
    });
    if (tests[2]?.status === 'error') allPassed = false;

    // Test 4: Gestione errori
    await runTest(3, async () => {
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
    });
    if (tests[3]?.status === 'error') allPassed = false;

    // Test 5: Creazione e eliminazione profilo
    await runTest(4, async () => {
      const testProfileName = `integration_test_${Date.now()}`;
      const testPassword = 'IntegrationTest123!';
      
      // Crea profilo
      const createResponse = await invoke('create_profile', {
        request: {
          name: testProfileName,
          password: testPassword,
          settings: {
            theme: 'dark',
            language: 'it'
          }
        }
      });
      
      if (!createResponse.success) {
        throw new Error(`Creazione profilo fallita: ${createResponse.error}`);
      }
      
      const profileId = createResponse.data.id;
      
      // Elimina profilo
      const deleteResponse = await invoke('delete_profile', {
        profile_id: profileId,
        password: testPassword
      });
      
      if (!deleteResponse.success) {
        throw new Error(`Eliminazione profilo fallita: ${deleteResponse.error}`);
      }
    });
    if (tests[4]?.status === 'error') allPassed = false;

    setOverallResult(allPassed ? 'success' : 'error');
    setIsRunning(false);
  };

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Test Integrazione Tauri-React (Semplificato)
          </CardTitle>
          <div className="flex gap-4 text-sm">
            <span>Totali: {tests.length}</span>
            <span className="text-green-600">Successi: {successCount}</span>
            <span className="text-red-600">Errori: {errorCount}</span>
            {tests.length > 0 && (
              <span>Tasso successo: {((successCount / tests.length) * 100).toFixed(1)}%</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              onClick={runAllTests} 
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Esecuzione test in corso...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Esegui Test Integrazione
                </>
              )}
            </Button>

            {overallResult !== 'idle' && (
              <Alert className={overallResult === 'success' ? 'border-green-500' : 'border-red-500'}>
                <div className="flex items-center gap-2">
                  {overallResult === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                  <AlertDescription>
                    {overallResult === 'success' 
                      ? 'Tutti i test sono stati completati con successo! L\'integrazione Tauri-React funziona correttamente.'
                      : 'Alcuni test sono falliti. Verificare l\'integrazione Tauri-React.'
                    }
                  </AlertDescription>
                </div>
              </Alert>
            )}

            <div className="space-y-3">
              {tests.map((test, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(test.status)}
                    <div>
                      <span className="font-medium">{test.name}</span>
                      {test.duration && (
                        <span className="text-sm text-gray-500 ml-2">({test.duration}ms)</span>
                      )}
                      {test.message && (
                        <p className="text-sm text-gray-600 mt-1">{test.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(test.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informazioni Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p>
              <strong>Obiettivo:</strong> Verificare che l'integrazione tra frontend React e backend Tauri 
              funzioni correttamente per il sistema profili.
            </p>
            <p>
              <strong>Test inclusi:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Chiamata API per ottenere lista profili</li>
              <li>Verifica profilo corrente autenticato</li>
              <li>Test validazione input utente</li>
              <li>Verifica gestione errori dal backend</li>
              <li>Test completo creazione ed eliminazione profilo</li>
            </ul>
            <p>
              <strong>Risultato atteso:</strong> Tutti i test dovrebbero passare se l'integrazione 
              Tauri-React è configurata correttamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}