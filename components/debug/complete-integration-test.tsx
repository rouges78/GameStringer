'use client';

import { useState, useCallback } from 'react';
import { invoke } from '@/lib/tauri-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle, XCircle, AlertTriangle, ArrowLeftRight, Database, Clock, Play } from 'lucide-react';

interface IntegrationTestResult {
  id: string;
  name: string;
  description: string;
  category: 'api_calls' | 'bidirectional' | 'error_handling' | 'serialization' | 'end_to_end';
  status: 'pending' | 'running' | 'success' | 'error' | 'timeout';
  request?: any;
  response?: any;
  error?: string;
  duration?: number;
  expectedBehavior?: string;
  actualBehavior?: string;
}

export function CompleteIntegrationTest() {
  const [tests, setTests] = useState<IntegrationTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [testProfiles, setTestProfiles] = useState<string[]>([]);

  // Helper per generare nomi profilo validi (evita nomi riservati)
  const generateValidProfileName = useCallback((prefix: string) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}_${timestamp}_${random}`;
  }, []);

  const updateTest = useCallback((id: string, updates: Partial<IntegrationTestResult>) => {
    setTests(prev => prev.map(test => 
      test.id === id ? { ...test, ...updates } : test
    ));
  }, []);

  const runIntegrationTest = useCallback(async (
    test: IntegrationTestResult,
    testFn: () => Promise<any>,
    timeoutMs: number = 10000
  ) => {
    const startTime = Date.now();
    
    updateTest(test.id, { 
      status: 'running',
      error: undefined,
      response: undefined
    });

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
      });

      const result = await Promise.race([testFn(), timeoutPromise]);
      const duration = Date.now() - startTime;
      
      updateTest(test.id, {
        status: 'success',
        response: result,
        duration,
        actualBehavior: 'Completato con successo'
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';

      if (errorMessage === 'TIMEOUT') {
        updateTest(test.id, {
          status: 'timeout',
          error: `Timeout dopo ${timeoutMs}ms`,
          duration,
          actualBehavior: 'Operazione terminata per timeout'
        });
      } else {
        updateTest(test.id, {
          status: 'error',
          error: errorMessage,
          duration,
          actualBehavior: `Errore: ${errorMessage}`
        });
      }
      throw error;
    }
  }, [updateTest]);

  const initializeTests = useCallback(() => {
    const integrationTestSuite: IntegrationTestResult[] = [
      // Test chiamate API Tauri
      {
        id: 'api-list-profiles',
        name: 'Lista Profili',
        description: 'Test chiamata API list_profiles',
        category: 'api_calls',
        status: 'pending',
        expectedBehavior: 'Restituisce lista profili con struttura corretta'
      },
      {
        id: 'api-get-current',
        name: 'Profilo Corrente',
        description: 'Test chiamata API get_current_profile',
        category: 'api_calls',
        status: 'pending',
        expectedBehavior: 'Restituisce profilo corrente o null se non autenticato'
      },
      {
        id: 'api-validate-name',
        name: 'Validazione Nome',
        description: 'Test chiamata API validate_profile_name',
        category: 'api_calls',
        status: 'pending',
        expectedBehavior: 'Valida nome profilo secondo le regole definite'
      },
      {
        id: 'api-validate-password',
        name: 'Validazione Password',
        description: 'Test chiamata API validate_password',
        category: 'api_calls',
        status: 'pending',
        expectedBehavior: 'Valida password secondo criteri di sicurezza'
      },
      {
        id: 'api-create-profile',
        name: 'Creazione Profilo',
        description: 'Test chiamata API create_profile',
        category: 'api_calls',
        status: 'pending',
        expectedBehavior: 'Crea nuovo profilo e restituisce dati completi'
      },
      {
        id: 'api-authenticate',
        name: 'Autenticazione',
        description: 'Test chiamata API authenticate_profile',
        category: 'api_calls',
        status: 'pending',
        expectedBehavior: 'Autentica profilo con credenziali valide'
      },
      {
        id: 'api-logout',
        name: 'Logout',
        description: 'Test chiamata API logout',
        category: 'api_calls',
        status: 'pending',
        expectedBehavior: 'Effettua logout e pulisce sessione'
      },
      {
        id: 'api-delete-profile',
        name: 'Eliminazione Profilo',
        description: 'Test chiamata API delete_profile',
        category: 'api_calls',
        status: 'pending',
        expectedBehavior: 'Elimina profilo con conferma password'
      },

      // Test comunicazione bidirezionale
      {
        id: 'bidirectional-simple',
        name: 'Comunicazione Semplice',
        description: 'Test invio/ricezione dati semplici',
        category: 'bidirectional',
        status: 'pending',
        expectedBehavior: 'Dati inviati e ricevuti correttamente'
      },
      {
        id: 'bidirectional-complex',
        name: 'Dati Complessi',
        description: 'Test invio/ricezione oggetti complessi',
        category: 'bidirectional',
        status: 'pending',
        expectedBehavior: 'Oggetti complessi serializzati/deserializzati correttamente'
      },
      {
        id: 'bidirectional-unicode',
        name: 'Caratteri Unicode',
        description: 'Test invio/ricezione caratteri speciali e Unicode',
        category: 'bidirectional',
        status: 'pending',
        expectedBehavior: 'Caratteri Unicode preservati durante trasferimento'
      },
      {
        id: 'bidirectional-large',
        name: 'Dati Voluminosi',
        description: 'Test invio/ricezione grandi quantità di dati',
        category: 'bidirectional',
        status: 'pending',
        expectedBehavior: 'Dati voluminosi trasferiti senza perdite'
      },

      // Test gestione errori
      {
        id: 'error-invalid-credentials',
        name: 'Credenziali Invalide',
        description: 'Test gestione errore credenziali errate',
        category: 'error_handling',
        status: 'pending',
        expectedBehavior: 'Errore gestito con messaggio appropriato'
      },
      {
        id: 'error-missing-data',
        name: 'Dati Mancanti',
        description: 'Test gestione errore dati obbligatori mancanti',
        category: 'error_handling',
        status: 'pending',
        expectedBehavior: 'Errore validazione con dettagli specifici'
      },
      {
        id: 'error-duplicate-profile',
        name: 'Profilo Duplicato',
        description: 'Test gestione errore creazione profilo duplicato',
        category: 'error_handling',
        status: 'pending',
        expectedBehavior: 'Errore duplicazione con messaggio chiaro'
      },
      {
        id: 'error-timeout',
        name: 'Timeout Operazione',
        description: 'Test gestione timeout su operazione lenta',
        category: 'error_handling',
        status: 'pending',
        expectedBehavior: 'Timeout gestito gracefully'
      },

      // Test serializzazione
      {
        id: 'serialization-primitives',
        name: 'Tipi Primitivi',
        description: 'Test serializzazione tipi primitivi',
        category: 'serialization',
        status: 'pending',
        expectedBehavior: 'Tipi primitivi serializzati correttamente'
      },
      {
        id: 'serialization-nested',
        name: 'Oggetti Annidati',
        description: 'Test serializzazione oggetti annidati',
        category: 'serialization',
        status: 'pending',
        expectedBehavior: 'Strutture annidate preservate'
      },
      {
        id: 'serialization-arrays',
        name: 'Array e Liste',
        description: 'Test serializzazione array complessi',
        category: 'serialization',
        status: 'pending',
        expectedBehavior: 'Array serializzati mantenendo ordine e contenuto'
      },
      {
        id: 'serialization-null',
        name: 'Valori Null',
        description: 'Test serializzazione valori null/undefined',
        category: 'serialization',
        status: 'pending',
        expectedBehavior: 'Valori null gestiti correttamente'
      },

      // Test flusso end-to-end
      {
        id: 'e2e-complete-flow',
        name: 'Flusso Completo',
        description: 'Test flusso completo creazione/autenticazione/eliminazione',
        category: 'end_to_end',
        status: 'pending',
        expectedBehavior: 'Flusso completo funziona senza errori'
      },
      {
        id: 'e2e-profile-switch',
        name: 'Cambio Profilo',
        description: 'Test cambio profilo con pulizia stato',
        category: 'end_to_end',
        status: 'pending',
        expectedBehavior: 'Cambio profilo pulisce stato precedente'
      },
      {
        id: 'e2e-concurrent',
        name: 'Operazioni Concorrenti',
        description: 'Test operazioni multiple simultanee',
        category: 'end_to_end',
        status: 'pending',
        expectedBehavior: 'Operazioni concorrenti gestite correttamente'
      }
    ];

    setTests(integrationTestSuite);
  }, []);

  // Test API Calls
  const testApiCalls = useCallback(async () => {
    // Test list_profiles
    await runIntegrationTest(
      tests.find(t => t.id === 'api-list-profiles')!,
      async () => {
        const response = await invoke('list_profiles');
        if (!response || typeof response !== 'object' || !response.hasOwnProperty('success')) {
          throw new Error('Struttura risposta non valida');
        }
        return response;
      }
    );

    // Test get_current_profile
    await runIntegrationTest(
      tests.find(t => t.id === 'api-get-current')!,
      async () => {
        const response = await invoke('get_current_profile');
        if (!response || typeof response !== 'object' || !response.hasOwnProperty('success')) {
          throw new Error('Struttura risposta non valida');
        }
        return response;
      }
    );

    // Test validate_profile_name
    await runIntegrationTest(
      tests.find(t => t.id === 'api-validate-name')!,
      async () => {
        const response = await invoke('validate_profile_name', { name: 'validazione_nome' });
        if (!response || typeof response !== 'object' || !response.hasOwnProperty('success')) {
          throw new Error('Struttura risposta non valida');
        }
        return response;
      }
    );

    // Test validate_password
    await runIntegrationTest(
      tests.find(t => t.id === 'api-validate-password')!,
      async () => {
        const response = await invoke('validate_password', { password: 'TestPassword123!' });
        if (!response || typeof response !== 'object' || !response.hasOwnProperty('success')) {
          throw new Error('Struttura risposta non valida');
        }
        return response;
      }
    );

    // Test create_profile
    const profileName = `integrazione_${Date.now()}`;
    let profileId: string | null = null;

    await runIntegrationTest(
      tests.find(t => t.id === 'api-create-profile')!,
      async () => {
        const response = await invoke('create_profile', {
          request: {
            name: profileName,
            password: 'IntegrationTest123!',
            settings: {
              theme: 'dark',
              language: 'it',
              auto_login: false,
              session_timeout: 3600
            }
          }
        });
        if (!response || !response.success) {
          throw new Error(response?.error || 'Creazione profilo fallita');
        }
        profileId = response.data.id;
        setTestProfiles(prev => [...prev, profileId!]);
        return response;
      }
    );

    // Test authenticate_profile
    await runIntegrationTest(
      tests.find(t => t.id === 'api-authenticate')!,
      async () => {
        const response = await invoke('authenticate_profile', {
          name: profileName,
          password: 'IntegrationTest123!'
        });
        if (!response || !response.success) {
          throw new Error(response?.error || 'Autenticazione fallita');
        }
        return response;
      }
    );

    // Test logout
    await runIntegrationTest(
      tests.find(t => t.id === 'api-logout')!,
      async () => {
        const response = await invoke('logout');
        if (!response || !response.success) {
          throw new Error(response?.error || 'Logout fallito');
        }
        return response;
      }
    );

    // Test delete_profile
    if (profileId) {
      await runIntegrationTest(
        tests.find(t => t.id === 'api-delete-profile')!,
        async () => {
          const response = await invoke('delete_profile', {
            profile_id: profileId,
            password: 'IntegrationTest123!'
          });
          if (!response || !response.success) {
            throw new Error(response?.error || 'Eliminazione fallita');
          }
          setTestProfiles(prev => prev.filter(id => id !== profileId));
          return response;
        }
      );
    }
  }, [tests, runIntegrationTest, generateValidProfileName]);

  // Test Bidirectional Communication
  const testBidirectionalCommunication = useCallback(async () => {
    // Test dati semplici
    await runIntegrationTest(
      tests.find(t => t.id === 'bidirectional-simple')!,
      async () => {
        const testData = {
          name: generateValidProfileName('semplice'),
          password: 'SimpleTest123!',
          settings: {
            theme: 'dark',
            language: 'it',
            enabled: true,
            count: 42
          }
        };

        const response = await invoke('create_profile', { request: testData });
        if (!response.success) {
          throw new Error('Test dati semplici fallito');
        }

        // Pulizia
        await invoke('delete_profile', {
          profile_id: response.data.id,
          password: 'SimpleTest123!'
        });

        return { sent: testData, received: response.data };
      }
    );

    // Test dati complessi
    await runIntegrationTest(
      tests.find(t => t.id === 'bidirectional-complex')!,
      async () => {
        const complexData = {
          name: generateValidProfileName('complesso'),
          password: 'ComplexTest123!',
          settings: {
            theme: 'dark',
            language: 'it',
            nested: {
              deep: {
                value: 'test_deep',
                array: [1, 2, 3, { nested: true }],
                boolean: true
              }
            },
            features: {
              notifications: {
                enabled: true,
                types: ['auth', 'system'],
                sound: false
              },
              advanced: {
                debug: false,
                cache_size: 1024
              }
            }
          }
        };

        const response = await invoke('create_profile', { request: complexData });
        if (!response.success) {
          throw new Error('Test dati complessi fallito');
        }

        // Pulizia
        await invoke('delete_profile', {
          profile_id: response.data.id,
          password: 'ComplexTest123!'
        });

        return { sent: complexData, received: response.data };
      }
    );

    // Test caratteri Unicode
    await runIntegrationTest(
      tests.find(t => t.id === 'bidirectional-unicode')!,
      async () => {
        const unicodeData = {
          name: generateValidProfileName('unicode'),
          password: 'UnicodeTest123!àèìòù',
          settings: {
            theme: 'dark',
            language: 'it',
            display_name: '🎮 Test Unicode 🚀',
            description: 'Testo con àccènti, ñ, ç, 中文, العربية, русский',
            tags: ['gaming', 'traduzione', 'italiano', '中文'],
            special_chars: '!@#$%^&*()_+-=[]{}|;:,.<>?'
          }
        };

        const response = await invoke('create_profile', { request: unicodeData });
        if (!response.success) {
          throw new Error('Test Unicode fallito');
        }

        // Pulizia
        await invoke('delete_profile', {
          profile_id: response.data.id,
          password: 'UnicodeTest123!àèìòù'
        });

        return { sent: unicodeData, received: response.data };
      }
    );

    // Test dati voluminosi
    await runIntegrationTest(
      tests.find(t => t.id === 'bidirectional-large')!,
      async () => {
        const largeData = {
          name: generateValidProfileName('voluminoso'),
          password: 'LargeTest123!',
          settings: {
            theme: 'dark',
            language: 'it',
            large_array: Array(500).fill(0).map((_, i) => ({
              id: i,
              name: `item_${i}`,
              description: `Descrizione dettagliata per l'elemento ${i}`,
              metadata: {
                created: new Date().toISOString(),
                tags: [`tag1_${i}`, `tag2_${i}`],
                enabled: i % 2 === 0
              }
            }))
          }
        };

        const response = await invoke('create_profile', { request: largeData });
        if (!response.success) {
          throw new Error('Test dati voluminosi fallito');
        }

        // Pulizia
        await invoke('delete_profile', {
          profile_id: response.data.id,
          password: 'LargeTest123!'
        });

        return { 
          sent_size: JSON.stringify(largeData).length,
          received_size: JSON.stringify(response.data).length,
          array_length: largeData.settings.large_array.length
        };
      }
    );
  }, [tests, runIntegrationTest, generateValidProfileName]);

  // Test Error Handling
  const testErrorHandling = useCallback(async () => {
    // Test credenziali invalide
    await runIntegrationTest(
      tests.find(t => t.id === 'error-invalid-credentials')!,
      async () => {
        const response = await invoke('authenticate_profile', {
          name: 'profilo_inesistente_12345',
          password: 'password_errata_12345'
        });
        
        if (response.success) {
          throw new Error('Autenticazione dovrebbe fallire con credenziali errate');
        }
        
        if (!response.error) {
          throw new Error('Risposta di errore dovrebbe contenere messaggio');
        }
        
        return { expected_error: true, error_message: response.error };
      }
    );

    // Test dati mancanti
    await runIntegrationTest(
      tests.find(t => t.id === 'error-missing-data')!,
      async () => {
        const response = await invoke('create_profile', {
          request: {
            name: '',
            password: ''
          }
        });
        
        if (response.success) {
          throw new Error('Creazione dovrebbe fallire con dati mancanti');
        }
        
        return { expected_error: true, error_message: response.error };
      }
    );

    // Test profilo duplicato
    const testProfileName = generateValidProfileName('duplicato');
    let testProfileId: string | null = null;

    // Prima crea un profilo
    const createResponse = await invoke('create_profile', {
      request: {
        name: testProfileName,
        password: 'DuplicateTest123!',
        settings: { theme: 'dark', language: 'it' }
      }
    });

    if (createResponse.success) {
      testProfileId = createResponse.data.id;
      setTestProfiles(prev => [...prev, testProfileId!]);
    }

    await runIntegrationTest(
      tests.find(t => t.id === 'error-duplicate-profile')!,
      async () => {
        const response = await invoke('create_profile', {
          request: {
            name: testProfileName, // Stesso nome
            password: 'AnotherPassword123!',
            settings: { theme: 'light', language: 'en' }
          }
        });
        
        if (response.success) {
          throw new Error('Creazione dovrebbe fallire con nome duplicato');
        }
        
        return { expected_error: true, error_message: response.error };
      }
    );

    // Pulizia profilo di test
    if (testProfileId) {
      await invoke('delete_profile', {
        profile_id: testProfileId,
        password: 'DuplicateTest123!'
      });
      setTestProfiles(prev => prev.filter(id => id !== testProfileId));
    }

    // Test timeout (con timeout molto breve)
    await runIntegrationTest(
      tests.find(t => t.id === 'error-timeout')!,
      async () => {
        // Simula operazione che potrebbe andare in timeout
        const response = await invoke('list_profiles');
        return response;
      },
      100 // Timeout molto breve per testare gestione timeout
    );
  }, [tests, runIntegrationTest, generateValidProfileName]);

  // Test Serialization
  const testSerialization = useCallback(async () => {
    const deepEqual = (obj1: any, obj2: any): boolean => {
      if (obj1 === obj2) return true;
      if (obj1 == null || obj2 == null) return obj1 === obj2;
      if (typeof obj1 !== typeof obj2) return false;
      if (typeof obj1 !== 'object') return obj1 === obj2;
      if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
      
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);
      
      if (keys1.length !== keys2.length) return false;
      
      for (const key of keys1) {
        if (!keys2.includes(key)) return false;
        if (!deepEqual(obj1[key], obj2[key])) return false;
      }
      
      return true;
    };

    // Test tipi primitivi
    await runIntegrationTest(
      tests.find(t => t.id === 'serialization-primitives')!,
      async () => {
        const primitiveData = {
          name: generateValidProfileName('primitivo'),
          password: 'PrimitiveTest123!',
          settings: {
            stringValue: 'test string',
            numberValue: 42,
            floatValue: 3.14159,
            booleanTrue: true,
            booleanFalse: false,
            zeroValue: 0,
            emptyString: ''
          }
        };

        const response = await invoke('create_profile', { request: primitiveData });
        if (!response.success) {
          throw new Error('Test tipi primitivi fallito');
        }

        const isIntact = deepEqual(primitiveData.settings, response.data.settings || {});

        // Pulizia
        await invoke('delete_profile', {
          profile_id: response.data.id,
          password: 'PrimitiveTest123!'
        });

        return { 
          data_intact: isIntact,
          original: primitiveData.settings,
          received: response.data.settings
        };
      }
    );

    // Test oggetti annidati
    await runIntegrationTest(
      tests.find(t => t.id === 'serialization-nested')!,
      async () => {
        const nestedData = {
          name: generateValidProfileName('annidato'),
          password: 'NestedTest123!',
          settings: {
            level1: {
              level2: {
                level3: {
                  deepValue: 'very deep',
                  deepNumber: 12345,
                  deepArray: [1, 2, 3]
                }
              }
            },
            parallel: {
              branch1: { value: 'branch1' },
              branch2: { value: 'branch2' }
            }
          }
        };

        const response = await invoke('create_profile', { request: nestedData });
        if (!response.success) {
          throw new Error('Test oggetti annidati fallito');
        }

        const isIntact = deepEqual(nestedData.settings, response.data.settings || {});

        // Pulizia
        await invoke('delete_profile', {
          profile_id: response.data.id,
          password: 'NestedTest123!'
        });

        return { 
          data_intact: isIntact,
          nesting_levels: 3,
          parallel_branches: 2
        };
      }
    );

    // Test array
    await runIntegrationTest(
      tests.find(t => t.id === 'serialization-arrays')!,
      async () => {
        const arrayData = {
          name: generateValidProfileName('array'),
          password: 'ArrayTest123!',
          settings: {
            simpleArray: [1, 2, 3, 4, 5],
            stringArray: ['a', 'b', 'c'],
            mixedArray: [1, 'two', true, null, { nested: 'object' }],
            objectArray: [
              { id: 1, name: 'first' },
              { id: 2, name: 'second' },
              { id: 3, name: 'third' }
            ]
          }
        };

        const response = await invoke('create_profile', { request: arrayData });
        if (!response.success) {
          throw new Error('Test array fallito');
        }

        const isIntact = deepEqual(arrayData.settings, response.data.settings || {});

        // Pulizia
        await invoke('delete_profile', {
          profile_id: response.data.id,
          password: 'ArrayTest123!'
        });

        return { 
          data_intact: isIntact,
          array_count: Object.keys(arrayData.settings).length,
          total_elements: arrayData.settings.simpleArray.length + 
                         arrayData.settings.stringArray.length + 
                         arrayData.settings.mixedArray.length + 
                         arrayData.settings.objectArray.length
        };
      }
    );

    // Test valori null
    await runIntegrationTest(
      tests.find(t => t.id === 'serialization-null')!,
      async () => {
        const nullData = {
          name: generateValidProfileName('nullo'),
          password: 'NullTest123!',
          settings: {
            nullValue: null,
            undefinedValue: undefined,
            emptyObject: {},
            emptyArray: [],
            zeroValue: 0,
            falseValue: false,
            emptyString: ''
          }
        };

        const response = await invoke('create_profile', { request: nullData });
        if (!response.success) {
          throw new Error('Test valori null fallito');
        }

        // Pulizia
        await invoke('delete_profile', {
          profile_id: response.data.id,
          password: 'NullTest123!'
        });

        return { 
          null_handled: response.data.settings?.nullValue === null,
          empty_object_handled: typeof response.data.settings?.emptyObject === 'object',
          empty_array_handled: Array.isArray(response.data.settings?.emptyArray)
        };
      }
    );
  }, [tests, runIntegrationTest, generateValidProfileName]);

  // Test End-to-End Flow
  const testEndToEndFlow = useCallback(async () => {
    // Test flusso completo
    await runIntegrationTest(
      tests.find(t => t.id === 'e2e-complete-flow')!,
      async () => {
        const profileName = generateValidProfileName('flusso');
        const profilePassword = 'E2ETest123!';
        let profileId: string | null = null;

        // 1. Validazione
        const validateName = await invoke('validate_profile_name', { name: profileName });
        if (!validateName.success) throw new Error('Validazione nome fallita');

        const validatePassword = await invoke('validate_password', { password: profilePassword });
        if (!validatePassword.success) throw new Error('Validazione password fallita');

        // 2. Creazione
        const createResponse = await invoke('create_profile', {
          request: {
            name: profileName,
            password: profilePassword,
            settings: { theme: 'dark', language: 'it' }
          }
        });
        if (!createResponse.success) throw new Error('Creazione profilo fallita');
        profileId = createResponse.data.id;

        // 3. Verifica creazione
        const listResponse = await invoke('list_profiles');
        if (!listResponse.success) throw new Error('Lista profili fallita');
        const createdProfile = listResponse.data.find((p: any) => p.id === profileId);
        if (!createdProfile) throw new Error('Profilo creato non trovato');

        // 4. Autenticazione
        const authResponse = await invoke('authenticate_profile', {
          name: profileName,
          password: profilePassword
        });
        if (!authResponse.success) throw new Error('Autenticazione fallita');

        // 5. Verifica autenticazione
        const currentResponse = await invoke('get_current_profile');
        if (!currentResponse.success || !currentResponse.data) {
          throw new Error('Verifica autenticazione fallita');
        }

        // 6. Logout
        const logoutResponse = await invoke('logout');
        if (!logoutResponse.success) throw new Error('Logout fallito');

        // 7. Verifica logout
        const afterLogoutResponse = await invoke('get_current_profile');
        if (!afterLogoutResponse.success) throw new Error('Verifica logout fallita');
        if (afterLogoutResponse.data) throw new Error('Profilo ancora autenticato');

        // 8. Eliminazione
        const deleteResponse = await invoke('delete_profile', {
          profile_id: profileId,
          password: profilePassword
        });
        if (!deleteResponse.success) throw new Error('Eliminazione fallita');

        return {
          steps_completed: 8,
          profile_created: true,
          authentication_worked: true,
          logout_worked: true,
          deletion_worked: true
        };
      }
    );

    // Test cambio profilo
    await runIntegrationTest(
      tests.find(t => t.id === 'e2e-profile-switch')!,
      async () => {
        const profile1Name = generateValidProfileName('cambio1');
        const profile2Name = generateValidProfileName('cambio2');
        const password = 'SwitchTest123!';
        let profile1Id: string | null = null;
        let profile2Id: string | null = null;

        // Crea due profili
        const create1 = await invoke('create_profile', {
          request: { name: profile1Name, password, settings: { theme: 'dark' } }
        });
        if (!create1.success) throw new Error('Creazione profilo 1 fallita');
        profile1Id = create1.data.id;
        setTestProfiles(prev => [...prev, profile1Id!]);

        const create2 = await invoke('create_profile', {
          request: { name: profile2Name, password, settings: { theme: 'light' } }
        });
        if (!create2.success) throw new Error('Creazione profilo 2 fallita');
        profile2Id = create2.data.id;
        setTestProfiles(prev => [...prev, profile2Id!]);

        // Autentica primo profilo
        const auth1 = await invoke('authenticate_profile', { name: profile1Name, password });
        if (!auth1.success) throw new Error('Autenticazione profilo 1 fallita');

        // Verifica primo profilo attivo
        const current1 = await invoke('get_current_profile');
        if (!current1.success || current1.data?.id !== profile1Id) {
          throw new Error('Profilo 1 non attivo');
        }

        // Cambia al secondo profilo
        const auth2 = await invoke('authenticate_profile', { name: profile2Name, password });
        if (!auth2.success) throw new Error('Cambio al profilo 2 fallito');

        // Verifica secondo profilo attivo
        const current2 = await invoke('get_current_profile');
        if (!current2.success || current2.data?.id !== profile2Id) {
          throw new Error('Profilo 2 non attivo dopo cambio');
        }

        // Pulizia
        await invoke('logout');
        await invoke('delete_profile', { profile_id: profile1Id, password });
        await invoke('delete_profile', { profile_id: profile2Id, password });
        setTestProfiles(prev => prev.filter(id => id !== profile1Id && id !== profile2Id));

        return {
          profiles_created: 2,
          switch_successful: true,
          state_cleaned: true
        };
      }
    );

    // Test operazioni concorrenti
    await runIntegrationTest(
      tests.find(t => t.id === 'e2e-concurrent')!,
      async () => {
        const profileNames = Array(3).fill(0).map((_, i) => generateValidProfileName(`concorrente${i}`));
        const password = 'ConcurrentTest123!';
        const createdIds: string[] = [];

        // Creazione concorrente
        const createPromises = profileNames.map(name => 
          invoke('create_profile', {
            request: { name, password, settings: { theme: 'dark' } }
          })
        );

        const createResults = await Promise.all(createPromises);
        
        for (const result of createResults) {
          if (!result.success) throw new Error('Creazione concorrente fallita');
          createdIds.push(result.data.id);
        }
        setTestProfiles(prev => [...prev, ...createdIds]);

        // Operazioni concorrenti miste
        const operations = [
          invoke('list_profiles'),
          invoke('get_current_profile'),
          invoke('validate_profile_name', { name: 'validazione_concorrente' }),
          invoke('validate_password', { password: 'TestPassword123!' })
        ];

        const operationResults = await Promise.all(operations);
        
        // Verifica che tutte le operazioni siano riuscite
        for (const result of operationResults) {
          if (!result.success) throw new Error('Operazione concorrente fallita');
        }

        // Pulizia concorrente
        const deletePromises = createdIds.map(id => 
          invoke('delete_profile', { profile_id: id, password })
        );

        await Promise.all(deletePromises);
        setTestProfiles(prev => prev.filter(id => !createdIds.includes(id)));

        return {
          concurrent_creates: profileNames.length,
          concurrent_operations: operations.length,
          all_successful: true
        };
      }
    );
  }, [tests, runIntegrationTest, generateValidProfileName]);

  const runAllIntegrationTests = useCallback(async () => {
    setIsRunning(true);
    setProgress(0);
    initializeTests();

    // Aspetta inizializzazione
    await new Promise(resolve => setTimeout(resolve, 100));

    const testCategories = [
      { name: 'API Calls', runner: testApiCalls, weight: 30 },
      { name: 'Bidirectional Communication', runner: testBidirectionalCommunication, weight: 25 },
      { name: 'Error Handling', runner: testErrorHandling, weight: 20 },
      { name: 'Serialization', runner: testSerialization, weight: 15 },
      { name: 'End-to-End Flow', runner: testEndToEndFlow, weight: 10 }
    ];

    let currentProgress = 0;

    for (const category of testCategories) {
      try {
        await category.runner();
        currentProgress += category.weight;
        setProgress(currentProgress);
      } catch (error) {
        console.error(`Errore categoria ${category.name}:`, error);
        currentProgress += category.weight;
        setProgress(currentProgress);
      }
    }

    setIsRunning(false);
    setProgress(100);
  }, [testApiCalls, testBidirectionalCommunication, testErrorHandling, testSerialization, testEndToEndFlow, initializeTests]);

  const getStatusIcon = (status: IntegrationTestResult['status']) => {
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

  const getCategoryIcon = (category: IntegrationTestResult['category']) => {
    switch (category) {
      case 'api_calls':
        return <Play className="w-4 h-4" />;
      case 'bidirectional':
        return <ArrowLeftRight className="w-4 h-4" />;
      case 'error_handling':
        return <AlertTriangle className="w-4 h-4" />;
      case 'serialization':
        return <Database className="w-4 h-4" />;
      case 'end_to_end':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Play className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: IntegrationTestResult['status']) => {
    switch (status) {
      case 'running':
        return <Badge variant="secondary">In corso</Badge>;
      case 'success':
        return <Badge variant="default" className="bg-green-500">Successo</Badge>;
      case 'error':
        return <Badge variant="destructive">Errore</Badge>;
      case 'timeout':
        return <Badge variant="secondary" className="bg-orange-500">Timeout</Badge>;
      default:
        return <Badge variant="outline">In attesa</Badge>;
    }
  };

  const testsByCategory = tests.reduce((acc, test) => {
    if (!acc[test.category]) acc[test.category] = [];
    acc[test.category].push(test);
    return acc;
  }, {} as Record<string, IntegrationTestResult[]>);

  const totalTests = tests.length;
  const successTests = tests.filter(t => t.status === 'success').length;
  const errorTests = tests.filter(t => t.status === 'error').length;
  const timeoutTests = tests.filter(t => t.status === 'timeout').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            Test Completo Integrazione Tauri-React
          </CardTitle>
          <div className="flex gap-4 text-sm">
            <span>Totali: {totalTests}</span>
            <span className="text-green-600">Successi: {successTests}</span>
            <span className="text-red-600">Errori: {errorTests}</span>
            <span className="text-orange-600">Timeout: {timeoutTests}</span>
            <span className="text-blue-600">Profili attivi: {testProfiles.length}</span>
            {totalTests > 0 && (
              <span>Successo: {((successTests / totalTests) * 100).toFixed(1)}%</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Button 
              onClick={runAllIntegrationTests} 
              disabled={isRunning}
              size="lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Esecuzione test integrazione...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Esegui test completo integrazione
                </>
              )}
            </Button>
            
            <Button 
              variant="outline"
              onClick={initializeTests}
              disabled={isRunning}
            >
              Reset test
            </Button>

            {testProfiles.length > 0 && (
              <Button 
                variant="destructive"
                onClick={async () => {
                  for (const profileId of testProfiles) {
                    try {
                      await invoke('delete_profile', {
                        profile_id: profileId,
                        password: 'TestPassword123!'
                      });
                    } catch (error) {
                      console.warn('Errore pulizia profilo:', error);
                    }
                  }
                  setTestProfiles([]);
                }}
                disabled={isRunning}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Pulisci profili test ({testProfiles.length})
              </Button>
            )}
          </div>

          {isRunning && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">Progresso test integrazione:</span>
                <span className="text-sm font-medium">{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <Tabs defaultValue="api_calls" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="api_calls" className="flex items-center gap-1">
                <Play className="w-3 h-3" />
                API Calls
              </TabsTrigger>
              <TabsTrigger value="bidirectional" className="flex items-center gap-1">
                <ArrowLeftRight className="w-3 h-3" />
                Bidirectional
              </TabsTrigger>
              <TabsTrigger value="error_handling" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Error Handling
              </TabsTrigger>
              <TabsTrigger value="serialization" className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                Serialization
              </TabsTrigger>
              <TabsTrigger value="end_to_end" className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                End-to-End
              </TabsTrigger>
            </TabsList>

            {Object.entries(testsByCategory).map(([category, categoryTests]) => (
              <TabsContent key={category} value={category} className="mt-4">
                <div className="space-y-4">
                  {categoryTests.map((test) => (
                    <Card key={test.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(test.status)}
                            {getCategoryIcon(test.category)}
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
                          <h5 className="font-medium text-blue-800 mb-1">Comportamento Atteso:</h5>
                          <p className="text-sm text-blue-700">{test.expectedBehavior}</p>
                        </div>

                        {test.actualBehavior && (
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
                              Comportamento Effettivo:
                            </h5>
                            <p className={`text-sm ${
                              test.status === 'success' 
                                ? 'text-green-700' 
                                : test.status === 'timeout'
                                ? 'text-orange-700'
                                : 'text-red-700'
                            }`}>
                              {test.actualBehavior}
                            </p>
                          </div>
                        )}

                        {test.response && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <h5 className="font-medium text-gray-800 mb-1">Risposta:</h5>
                            <pre className="text-xs text-gray-700 overflow-x-auto max-h-32">
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
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riepilogo Integrazione Tauri-React</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-800">Test Riusciti</h4>
              <p className="text-2xl font-bold text-green-600">{successTests}</p>
              <p className="text-sm text-green-700">Integrazione funzionante</p>
            </div>
            
            <div className="p-4 bg-red-50 rounded-lg">
              <h4 className="font-medium text-red-800">Test Falliti</h4>
              <p className="text-2xl font-bold text-red-600">{errorTests}</p>
              <p className="text-sm text-red-700">Problemi da risolvere</p>
            </div>
            
            <div className="p-4 bg-orange-50 rounded-lg">
              <h4 className="font-medium text-orange-800">Timeout</h4>
              <p className="text-2xl font-bold text-orange-600">{timeoutTests}</p>
              <p className="text-sm text-orange-700">Operazioni lente</p>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800">Tasso Successo</h4>
              <p className="text-2xl font-bold text-blue-600">
                {totalTests > 0 ? ((successTests / totalTests) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-sm text-blue-700">Affidabilità integrazione</p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Stato Integrazione:</h4>
            <div className="space-y-2 text-sm text-blue-700">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>✅ Chiamate API Tauri: {testsByCategory.api_calls?.filter(t => t.status === 'success').length || 0}/{testsByCategory.api_calls?.length || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4" />
                <span>✅ Comunicazione Bidirezionale: {testsByCategory.bidirectional?.filter(t => t.status === 'success').length || 0}/{testsByCategory.bidirectional?.length || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>✅ Gestione Errori: {testsByCategory.error_handling?.filter(t => t.status === 'success').length || 0}/{testsByCategory.error_handling?.length || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                <span>✅ Serializzazione Dati: {testsByCategory.serialization?.filter(t => t.status === 'success').length || 0}/{testsByCategory.serialization?.length || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                <span>✅ Flusso End-to-End: {testsByCategory.end_to_end?.filter(t => t.status === 'success').length || 0}/{testsByCategory.end_to_end?.length || 0}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}