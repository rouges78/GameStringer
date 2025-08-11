'use client';

import { useState, useCallback } from 'react';
import { invoke } from '@/lib/tauri-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, ArrowLeftRight, CheckCircle, XCircle } from 'lucide-react';

interface CommunicationTest {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'running' | 'success' | 'error';
  request?: any;
  response?: any;
  error?: string;
  duration?: number;
}

export function BidirectionalCommunicationTest() {
  const [tests, setTests] = useState<CommunicationTest[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [customData, setCustomData] = useState('');

  const updateTest = useCallback((id: string, updates: Partial<CommunicationTest>) => {
    setTests(prev => prev.map(test => 
      test.id === id ? { ...test, ...updates } : test
    ));
  }, []);

  const runCommunicationTest = useCallback(async (
    id: string,
    command: string,
    params: any,
    description: string
  ) => {
    const startTime = Date.now();
    
    updateTest(id, { 
      status: 'running',
      request: { command, params },
      response: undefined,
      error: undefined
    });

    try {
      const response = await invoke(command, params);
      const duration = Date.now() - startTime;
      
      updateTest(id, {
        status: 'success',
        response,
        duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTest(id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
        duration
      });
    }
  }, [updateTest]);

  const initializeTests = useCallback(() => {
    const testSuite: CommunicationTest[] = [
      {
        id: 'simple-data',
        name: 'Dati Semplici',
        description: 'Test invio/ricezione dati semplici (stringhe, numeri, boolean)',
        status: 'idle'
      },
      {
        id: 'complex-object',
        name: 'Oggetti Complessi',
        description: 'Test invio/ricezione oggetti con strutture annidate',
        status: 'idle'
      },
      {
        id: 'arrays',
        name: 'Array e Liste',
        description: 'Test invio/ricezione array e liste di dati',
        status: 'idle'
      },
      {
        id: 'unicode-special',
        name: 'Caratteri Speciali',
        description: 'Test invio/ricezione caratteri Unicode e speciali',
        status: 'idle'
      },
      {
        id: 'large-data',
        name: 'Dati Voluminosi',
        description: 'Test invio/ricezione dati di grandi dimensioni',
        status: 'idle'
      },
      {
        id: 'null-undefined',
        name: 'Valori Null/Undefined',
        description: 'Test gestione valori null, undefined e opzionali',
        status: 'idle'
      },
      {
        id: 'error-response',
        name: 'Risposte di Errore',
        description: 'Test gestione risposte di errore dal backend',
        status: 'idle'
      },
      {
        id: 'concurrent-requests',
        name: 'Richieste Concorrenti',
        description: 'Test gestione richieste multiple simultanee',
        status: 'idle'
      }
    ];

    setTests(testSuite);
  }, []);

  const runAllTests = useCallback(async () => {
    setIsRunning(true);
    initializeTests();

    // Test 1: Dati semplici
    await runCommunicationTest(
      'simple-data',
      'validate_profile_name',
      { name: 'test_simple' },
      'Validazione nome profilo semplice'
    );

    // Test 2: Oggetti complessi
    const complexProfile = {
      name: `complex_test_${Date.now()}`,
      password: 'ComplexPassword123!',
      avatar: null,
      settings: {
        theme: 'dark',
        language: 'it',
        auto_login: false,
        session_timeout: 3600,
        notifications: {
          enabled: true,
          sound: false,
          types: ['auth', 'system', 'updates']
        },
        advanced: {
          debug_mode: false,
          auto_backup: true,
          encryption_level: 'high',
          cache_settings: {
            max_size: 1024,
            ttl: 3600,
            compression: true
          }
        }
      }
    };

    await runCommunicationTest(
      'complex-object',
      'create_profile',
      { request: complexProfile },
      'Creazione profilo con oggetto complesso'
    );

    // Test 3: Array e liste
    await runCommunicationTest(
      'arrays',
      'list_profiles',
      {},
      'Ricezione lista profili (array)'
    );

    // Test 4: Caratteri speciali e Unicode
    const unicodeProfile = {
      name: `unicode_test_${Date.now()}`,
      password: 'UnicodeTest123!àèìòù',
      settings: {
        theme: 'dark',
        language: 'it',
        display_name: '🎮 Gamer Pro 🚀',
        bio: 'Testo con àccènti, ñ, ç, 中文, العربية, русский, 🎯⭐💻',
        tags: ['gaming', 'traduzione', 'italiano', '中文', 'العربية']
      }
    };

    await runCommunicationTest(
      'unicode-special',
      'create_profile',
      { request: unicodeProfile },
      'Creazione profilo con caratteri Unicode'
    );

    // Test 5: Dati voluminosi
    const largeSettings = {
      theme: 'dark',
      language: 'it',
      large_data: Array(1000).fill(0).map((_, i) => ({
        id: i,
        name: `item_${i}`,
        description: `Descrizione dettagliata per l'elemento numero ${i} con molti caratteri per testare la gestione di dati voluminosi`,
        metadata: {
          created: new Date().toISOString(),
          tags: [`tag1_${i}`, `tag2_${i}`, `tag3_${i}`],
          properties: {
            enabled: i % 2 === 0,
            priority: i % 5,
            category: `category_${i % 10}`
          }
        }
      }))
    };

    const largeProfile = {
      name: `large_test_${Date.now()}`,
      password: 'LargeTest123!',
      settings: largeSettings
    };

    await runCommunicationTest(
      'large-data',
      'create_profile',
      { request: largeProfile },
      'Creazione profilo con dati voluminosi'
    );

    // Test 6: Valori null/undefined
    const nullProfile = {
      name: `null_test_${Date.now()}`,
      password: 'NullTest123!',
      avatar: null,
      settings: {
        theme: 'dark',
        language: 'it',
        optional_field: null,
        undefined_field: undefined,
        empty_string: '',
        zero_value: 0,
        false_value: false
      }
    };

    await runCommunicationTest(
      'null-undefined',
      'create_profile',
      { request: nullProfile },
      'Creazione profilo con valori null/undefined'
    );

    // Test 7: Gestione errori
    await runCommunicationTest(
      'error-response',
      'authenticate_profile',
      { name: 'profilo_inesistente', password: 'password_errata' },
      'Autenticazione con credenziali errate (test errore)'
    );

    // Test 8: Richieste concorrenti
    const concurrentPromises = Array(5).fill(0).map((_, i) => 
      invoke('validate_profile_name', { name: `concurrent_test_${i}` })
    );

    const startTime = Date.now();
    updateTest('concurrent-requests', { status: 'running' });

    try {
      const results = await Promise.all(concurrentPromises);
      const duration = Date.now() - startTime;
      
      updateTest('concurrent-requests', {
        status: 'success',
        response: { results, count: results.length },
        duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTest('concurrent-requests', {
        status: 'error',
        error: error instanceof Error ? error.message : 'Errore richieste concorrenti',
        duration
      });
    }

    setIsRunning(false);
  }, [runCommunicationTest, initializeTests]);

  const runCustomTest = useCallback(async () => {
    if (!customData.trim()) return;

    try {
      const parsedData = JSON.parse(customData);
      const testId = `custom-${Date.now()}`;
      
      setTests(prev => [...prev, {
        id: testId,
        name: 'Test Personalizzato',
        description: 'Test con dati personalizzati dall\'utente',
        status: 'idle'
      }]);

      await runCommunicationTest(
        testId,
        'create_profile',
        { request: parsedData },
        'Test personalizzato utente'
      );
    } catch (error) {
      alert('Errore parsing JSON: ' + (error instanceof Error ? error.message : 'Errore sconosciuto'));
    }
  }, [customData, runCommunicationTest]);

  const getStatusIcon = (status: CommunicationTest['status']) => {
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

  const getStatusBadge = (status: CommunicationTest['status']) => {
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
            <ArrowLeftRight className="w-5 h-5" />
            Test Comunicazione Bidirezionale
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
          <div className="flex gap-4 mb-6">
            <Button 
              onClick={runAllTests} 
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Esecuzione test...
                </>
              ) : (
                'Esegui tutti i test'
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

          <div className="space-y-4">
            {tests.map((test) => (
              <Card key={test.id} className="border-l-4 border-l-blue-500">
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

                  {test.request && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <h5 className="font-medium text-blue-800 mb-1">Richiesta:</h5>
                      <pre className="text-xs text-blue-700 overflow-x-auto">
                        {JSON.stringify(test.request, null, 2)}
                      </pre>
                    </div>
                  )}

                  {test.response && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg">
                      <h5 className="font-medium text-green-800 mb-1">Risposta:</h5>
                      <pre className="text-xs text-green-700 overflow-x-auto max-h-32">
                        {JSON.stringify(test.response, null, 2)}
                      </pre>
                    </div>
                  )}

                  {test.error && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg">
                      <h5 className="font-medium text-red-800 mb-1">Errore:</h5>
                      <p className="text-sm text-red-700">{test.error}</p>
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
          <CardTitle>Test Personalizzato</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="custom-data">Dati JSON personalizzati:</Label>
              <Textarea
                id="custom-data"
                value={customData}
                onChange={(e) => setCustomData(e.target.value)}
                placeholder={`{
  "name": "test_personalizzato",
  "password": "TestPassword123!",
  "settings": {
    "theme": "dark",
    "language": "it"
  }
}`}
                rows={8}
                className="font-mono text-sm"
              />
            </div>
            <Button 
              onClick={runCustomTest}
              disabled={!customData.trim() || isRunning}
            >
              <Send className="w-4 h-4 mr-2" />
              Esegui test personalizzato
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}