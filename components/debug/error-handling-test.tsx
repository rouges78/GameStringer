'use client';

import { useState, useCallback } from 'react';
import { invoke } from '@/lib/tauri-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';

interface ErrorTest {
  id: string;
  name: string;
  description: string;
  expectedError: string;
  status: 'idle' | 'running' | 'success' | 'error' | 'timeout';
  actualError?: string;
  duration?: number;
  timeoutMs?: number;
}

export function ErrorHandlingTest() {
  const [tests, setTests] = useState<ErrorTest[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const updateTest = useCallback((id: string, updates: Partial<ErrorTest>) => {
    setTests(prev => prev.map(test => 
      test.id === id ? { ...test, ...updates } : test
    ));
  }, []);

  const runErrorTest = useCallback(async (
    test: ErrorTest,
    command: string,
    params: any,
    timeoutMs: number = 5000
  ) => {
    const startTime = Date.now();
    
    updateTest(test.id, { 
      status: 'running',
      actualError: undefined,
      duration: undefined
    });

    try {
      // Crea una Promise con timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
      });

      const invokePromise = invoke(command, params);
      
      const response = await Promise.race([invokePromise, timeoutPromise]);
      const duration = Date.now() - startTime;

      // Se arriviamo qui, il comando non ha generato l'errore atteso
      updateTest(test.id, {
        status: 'error',
        actualError: 'Comando completato senza errore (errore atteso non generato)',
        duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';

      if (errorMessage === 'TIMEOUT') {
        updateTest(test.id, {
          status: 'timeout',
          actualError: `Timeout dopo ${timeoutMs}ms`,
          duration
        });
      } else {
        // Verifica se l'errore è quello atteso
        const isExpectedError = errorMessage.toLowerCase().includes(test.expectedError.toLowerCase()) ||
                               test.expectedError.toLowerCase().includes(errorMessage.toLowerCase());

        updateTest(test.id, {
          status: isExpectedError ? 'success' : 'error',
          actualError: errorMessage,
          duration
        });
      }
    }
  }, [updateTest]);

  const initializeTests = useCallback(() => {
    const errorTestSuite: ErrorTest[] = [
      {
        id: 'auth-invalid-credentials',
        name: 'Credenziali Invalide',
        description: 'Test autenticazione con credenziali errate',
        expectedError: 'profilo non trovato',
        status: 'idle'
      },
      {
        id: 'auth-empty-credentials',
        name: 'Credenziali Vuote',
        description: 'Test autenticazione con credenziali vuote',
        expectedError: 'nome profilo non può essere vuoto',
        status: 'idle'
      },
      {
        id: 'create-duplicate-profile',
        name: 'Profilo Duplicato',
        description: 'Test creazione profilo con nome già esistente',
        expectedError: 'profilo già esistente',
        status: 'idle'
      },
      {
        id: 'create-invalid-name',
        name: 'Nome Profilo Invalido',
        description: 'Test creazione profilo con nome non valido',
        expectedError: 'nome non valido',
        status: 'idle'
      },
      {
        id: 'create-weak-password',
        name: 'Password Debole',
        description: 'Test creazione profilo con password troppo debole',
        expectedError: 'password non sicura',
        status: 'idle'
      },
      {
        id: 'delete-nonexistent',
        name: 'Eliminazione Profilo Inesistente',
        description: 'Test eliminazione profilo che non esiste',
        expectedError: 'profilo non trovato',
        status: 'idle'
      },
      {
        id: 'delete-wrong-password',
        name: 'Eliminazione Password Errata',
        description: 'Test eliminazione profilo con password errata',
        expectedError: 'password non corretta',
        status: 'idle'
      },
      {
        id: 'malformed-json',
        name: 'Dati Malformati',
        description: 'Test invio dati JSON malformati',
        expectedError: 'dati non validi',
        status: 'idle'
      },
      {
        id: 'missing-required-fields',
        name: 'Campi Obbligatori Mancanti',
        description: 'Test creazione profilo senza campi obbligatori',
        expectedError: 'campo obbligatorio mancante',
        status: 'idle'
      },
      {
        id: 'timeout-test',
        name: 'Test Timeout',
        description: 'Test gestione timeout su operazione lenta',
        expectedError: 'timeout',
        status: 'idle',
        timeoutMs: 1000 // Timeout molto breve per forzare il timeout
      }
    ];

    setTests(errorTestSuite);
  }, []);

  const runAllErrorTests = useCallback(async () => {
    setIsRunning(true);
    setProgress(0);
    initializeTests();

    // Aspetta che i test siano inizializzati
    await new Promise(resolve => setTimeout(resolve, 100));

    const testSuite = [
      {
        id: 'auth-invalid-credentials',
        command: 'authenticate_profile',
        params: { name: 'profilo_inesistente_12345', password: 'password_errata_12345' }
      },
      {
        id: 'auth-empty-credentials',
        command: 'authenticate_profile',
        params: { name: '', password: '' }
      },
      {
        id: 'create-invalid-name',
        command: 'validate_profile_name',
        params: { name: '' }
      },
      {
        id: 'create-weak-password',
        command: 'validate_password',
        params: { password: '123' }
      },
      {
        id: 'delete-nonexistent',
        command: 'delete_profile',
        params: { profile_id: 'profilo_inesistente_12345', password: 'password_qualsiasi' }
      },
      {
        id: 'missing-required-fields',
        command: 'create_profile',
        params: { request: { name: '', password: '' } }
      }
    ];

    // Prima crea un profilo per i test di duplicazione e eliminazione
    let testProfileId: string | null = null;
    try {
      const createResponse = await invoke('create_profile', {
        request: {
          name: 'test_error_profile',
          password: 'TestPassword123!',
          settings: { theme: 'dark', language: 'it' }
        }
      });
      
      if (createResponse.success && createResponse.data) {
        testProfileId = createResponse.data.id;
      }
    } catch (error) {
      console.log('Errore creazione profilo di test (normale per test errori):', error);
    }

    // Aggiungi test che richiedono il profilo esistente
    if (testProfileId) {
      testSuite.push(
        {
          id: 'create-duplicate-profile',
          command: 'create_profile',
          params: {
            request: {
              name: 'test_error_profile',
              password: 'AnotherPassword123!',
              settings: { theme: 'light', language: 'en' }
            }
          }
        },
        {
          id: 'delete-wrong-password',
          command: 'delete_profile',
          params: { profile_id: testProfileId, password: 'password_errata' }
        }
      );
    }

    // Esegui tutti i test
    for (let i = 0; i < testSuite.length; i++) {
      const testCase = testSuite[i];
      const test = tests.find(t => t.id === testCase.id);
      
      if (test) {
        await runErrorTest(
          test,
          testCase.command,
          testCase.params,
          test.timeoutMs || 5000
        );
      }
      
      setProgress(((i + 1) / testSuite.length) * 100);
    }

    // Test timeout separato (simulato con delay molto breve)
    const timeoutTest = tests.find(t => t.id === 'timeout-test');
    if (timeoutTest) {
      await runErrorTest(
        timeoutTest,
        'list_profiles', // Comando che normalmente funziona
        {},
        100 // Timeout molto breve per forzare timeout
      );
    }

    // Pulizia: elimina il profilo di test se creato
    if (testProfileId) {
      try {
        await invoke('delete_profile', {
          profile_id: testProfileId,
          password: 'TestPassword123!'
        });
      } catch (error) {
        console.log('Errore pulizia profilo di test:', error);
      }
    }

    setIsRunning(false);
    setProgress(100);
  }, [tests, runErrorTest, initializeTests]);

  const getStatusIcon = (status: ErrorTest['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'timeout':
        return <Clock className="w-4 h-4 text-orange-500" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusBadge = (status: ErrorTest['status']) => {
    switch (status) {
      case 'running':
        return <Badge variant="secondary">In corso</Badge>;
      case 'success':
        return <Badge variant="default" className="bg-green-500">Errore Gestito</Badge>;
      case 'error':
        return <Badge variant="destructive">Errore Imprevisto</Badge>;
      case 'timeout':
        return <Badge variant="secondary" className="bg-orange-500">Timeout</Badge>;
      default:
        return <Badge variant="outline">In attesa</Badge>;
    }
  };

  const successCount = tests.filter(t => t.status === 'success').length;
  const errorCount = tests.filter(t => t.status === 'error').length;
  const timeoutCount = tests.filter(t => t.status === 'timeout').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Test Gestione Errori e Timeout
          </CardTitle>
          <div className="flex gap-4 text-sm">
            <span>Totali: {tests.length}</span>
            <span className="text-green-600">Errori Gestiti: {successCount}</span>
            <span className="text-red-600">Errori Imprevisti: {errorCount}</span>
            <span className="text-orange-600">Timeout: {timeoutCount}</span>
            {tests.length > 0 && (
              <span>Gestione Corretta: {((successCount / tests.length) * 100).toFixed(1)}%</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Button 
              onClick={runAllErrorTests} 
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Esecuzione test errori...
                </>
              ) : (
                'Esegui test gestione errori'
              )}
            </Button>
            
            <Button 
              variant="outline"
              onClick={initializeTests}
              disabled={isRunning}
            >
              Reset test
            </Button>
          </div>

          {isRunning && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">Progresso test:</span>
                <span className="text-sm font-medium">{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <div className="space-y-4">
            {tests.map((test) => (
              <Card key={test.id} className="border-l-4 border-l-orange-500">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(test.status)}
                      <div>
                        <h4 className="font-medium">{test.name}</h4>
                        <p className="text-sm text-gray-600">{test.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {test.duration && (
                        <span className="text-sm text-gray-500">{test.duration}ms</span>
                      )}
                      {getStatusBadge(test.status)}
                    </div>
                  </div>

                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <h5 className="font-medium text-blue-800 mb-1">Errore Atteso:</h5>
                    <p className="text-sm text-blue-700">{test.expectedError}</p>
                  </div>

                  {test.actualError && (
                    <div className={`mt-3 p-3 rounded-lg ${
                      test.status === 'success' 
                        ? 'bg-green-50' 
                        : test.status === 'timeout'
                        ? 'bg-orange-50'
                        : 'bg-red-50'
                    }`}>
                      <h5 className={`font-medium mb-1 ${
                        test.status === 'success' 
                          ? 'text-green-800' 
                          : test.status === 'timeout'
                          ? 'text-orange-800'
                          : 'text-red-800'
                      }`}>
                        Errore Ricevuto:
                      </h5>
                      <p className={`text-sm ${
                        test.status === 'success' 
                          ? 'text-green-700' 
                          : test.status === 'timeout'
                          ? 'text-orange-700'
                          : 'text-red-700'
                      }`}>
                        {test.actualError}
                      </p>
                    </div>
                  )}

                  {test.status === 'success' && (
                    <div className="mt-2 p-2 bg-green-100 rounded text-sm text-green-800">
                      ✅ Errore gestito correttamente come atteso
                    </div>
                  )}

                  {test.status === 'error' && (
                    <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-800">
                      ❌ Errore diverso da quello atteso o gestione non corretta
                    </div>
                  )}

                  {test.status === 'timeout' && (
                    <div className="mt-2 p-2 bg-orange-100 rounded text-sm text-orange-800">
                      ⏱️ Operazione terminata per timeout
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analisi Gestione Errori</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800">Errori Gestiti Correttamente</h4>
                <p className="text-2xl font-bold text-green-600">{successCount}</p>
                <p className="text-sm text-green-700">
                  Errori attesi ricevuti e gestiti correttamente
                </p>
              </div>
              
              <div className="p-4 bg-red-50 rounded-lg">
                <h4 className="font-medium text-red-800">Errori Imprevisti</h4>
                <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                <p className="text-sm text-red-700">
                  Errori diversi da quelli attesi o non gestiti
                </p>
              </div>
              
              <div className="p-4 bg-orange-50 rounded-lg">
                <h4 className="font-medium text-orange-800">Timeout</h4>
                <p className="text-2xl font-bold text-orange-600">{timeoutCount}</p>
                <p className="text-sm text-orange-700">
                  Operazioni terminate per timeout
                </p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Raccomandazioni:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Tutti gli errori dovrebbero essere gestiti correttamente dal backend</li>
                <li>• I messaggi di errore dovrebbero essere chiari e informativi</li>
                <li>• I timeout dovrebbero essere gestiti gracefully</li>
                <li>• Le operazioni lunghe dovrebbero fornire feedback di progresso</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}