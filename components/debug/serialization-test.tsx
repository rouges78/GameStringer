'use client';

import { useState, useCallback } from 'react';
import { invoke } from '@/lib/tauri-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Database, CheckCircle, XCircle, ArrowRightLeft } from 'lucide-react';

interface SerializationTest {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'running' | 'success' | 'error';
  originalData?: any;
  serializedData?: string;
  deserializedData?: any;
  isDataIntact?: boolean;
  error?: string;
  duration?: number;
}

export function SerializationTest() {
  const [tests, setTests] = useState<SerializationTest[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateTest = useCallback((id: string, updates: Partial<SerializationTest>) => {
    setTests(prev => prev.map(test => 
      test.id === id ? { ...test, ...updates } : test
    ));
  }, []);

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

  const runSerializationTest = useCallback(async (
    test: SerializationTest,
    testData: any
  ) => {
    const startTime = Date.now();
    
    updateTest(test.id, { 
      status: 'running',
      originalData: testData,
      error: undefined
    });

    try {
      // Crea un profilo con i dati di test
      const profileName = `serialization_test_${test.id}_${Date.now()}`;
      const profileData = {
        name: profileName,
        password: 'SerializationTest123!',
        settings: testData
      };

      // Invia i dati al backend
      const createResponse = await invoke('create_profile', { request: profileData });
      
      if (!createResponse.success) {
        throw new Error(createResponse.error || 'Errore creazione profilo');
      }

      // Recupera i dati dal backend
      const listResponse = await invoke('list_profiles');
      
      if (!listResponse.success) {
        throw new Error('Errore recupero profili');
      }

      const createdProfile = listResponse.data.find((p: any) => p.name === profileName);
      
      if (!createdProfile) {
        throw new Error('Profilo creato non trovato');
      }

      // Confronta i dati originali con quelli deserializzati
      const isDataIntact = deepEqual(testData, createdProfile.settings || {});
      const duration = Date.now() - startTime;

      updateTest(test.id, {
        status: 'success',
        deserializedData: createdProfile.settings,
        isDataIntact,
        duration
      });

      // Pulizia: elimina il profilo di test
      try {
        await invoke('delete_profile', {
          profile_id: createdProfile.id,
          password: 'SerializationTest123!'
        });
      } catch (cleanupError) {
        console.warn('Errore pulizia profilo test:', cleanupError);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      updateTest(test.id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
        duration
      });
    }
  }, [updateTest, deepEqual]);

  const initializeTests = useCallback(() => {
    const serializationTestSuite: SerializationTest[] = [
      {
        id: 'primitive-types',
        name: 'Tipi Primitivi',
        description: 'Test serializzazione tipi primitivi (string, number, boolean)',
        status: 'idle'
      },
      {
        id: 'null-undefined',
        name: 'Valori Null/Undefined',
        description: 'Test serializzazione valori null, undefined e opzionali',
        status: 'idle'
      },
      {
        id: 'arrays',
        name: 'Array e Liste',
        description: 'Test serializzazione array semplici e complessi',
        status: 'idle'
      },
      {
        id: 'nested-objects',
        name: 'Oggetti Annidati',
        description: 'Test serializzazione oggetti con strutture annidate profonde',
        status: 'idle'
      },
      {
        id: 'unicode-special',
        name: 'Caratteri Unicode',
        description: 'Test serializzazione caratteri Unicode e speciali',
        status: 'idle'
      },
      {
        id: 'large-data',
        name: 'Dati Voluminosi',
        description: 'Test serializzazione grandi quantità di dati',
        status: 'idle'
      },
      {
        id: 'mixed-types',
        name: 'Tipi Misti',
        description: 'Test serializzazione strutture con tipi di dati misti',
        status: 'idle'
      },
      {
        id: 'edge-cases',
        name: 'Casi Limite',
        description: 'Test serializzazione casi limite e valori estremi',
        status: 'idle'
      }
    ];

    setTests(serializationTestSuite);
  }, []);

  const runAllSerializationTests = useCallback(async () => {
    setIsRunning(true);
    initializeTests();

    // Aspetta che i test siano inizializzati
    await new Promise(resolve => setTimeout(resolve, 100));

    const testData = [
      {
        id: 'primitive-types',
        data: {
          stringValue: 'test string',
          numberValue: 42,
          floatValue: 3.14159,
          booleanTrue: true,
          booleanFalse: false,
          zeroValue: 0,
          emptyString: ''
        }
      },
      {
        id: 'null-undefined',
        data: {
          nullValue: null,
          undefinedValue: undefined,
          optionalField: null,
          presentField: 'present',
          emptyObject: {},
          emptyArray: []
        }
      },
      {
        id: 'arrays',
        data: {
          simpleArray: [1, 2, 3, 4, 5],
          stringArray: ['a', 'b', 'c'],
          mixedArray: [1, 'two', true, null, { nested: 'object' }],
          nestedArrays: [[1, 2], [3, 4], [5, 6]],
          objectArray: [
            { id: 1, name: 'first' },
            { id: 2, name: 'second' },
            { id: 3, name: 'third' }
          ]
        }
      },
      {
        id: 'nested-objects',
        data: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    deepValue: 'very deep',
                    deepNumber: 12345,
                    deepArray: [1, 2, 3]
                  }
                }
              }
            }
          },
          parallelBranch: {
            branch1: { value: 'branch1' },
            branch2: { value: 'branch2' }
          }
        }
      },
      {
        id: 'unicode-special',
        data: {
          italian: 'àèìòù ñ ç',
          chinese: '中文测试',
          arabic: 'العربية',
          russian: 'русский',
          emoji: '🎮 🚀 ⭐ 💻 🎯',
          specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
          quotes: '"single" \'double\' `backtick`',
          unicode: '\u0041\u0042\u0043', // ABC
          escapeChars: '\n\t\r\\\/'
        }
      },
      {
        id: 'large-data',
        data: {
          largeArray: Array(1000).fill(0).map((_, i) => ({
            id: i,
            name: `item_${i}`,
            description: `Descrizione dettagliata per l'elemento ${i}`,
            metadata: {
              created: new Date().toISOString(),
              tags: [`tag1_${i}`, `tag2_${i}`],
              properties: {
                enabled: i % 2 === 0,
                priority: i % 5,
                category: `category_${i % 10}`
              }
            }
          })),
          largeString: 'x'.repeat(10000),
          deepNesting: Array(50).fill(0).reduce((acc, _, i) => ({
            [`level_${i}`]: acc
          }), { finalValue: 'deep' })
        }
      },
      {
        id: 'mixed-types',
        data: {
          configuration: {
            theme: 'dark',
            language: 'it',
            version: 1.2,
            features: {
              notifications: true,
              autoSave: false,
              advanced: {
                debugMode: false,
                logLevel: 'info',
                cacheSize: 1024,
                supportedFormats: ['json', 'xml', 'yaml'],
                metadata: {
                  author: 'GameStringer',
                  created: '2024-01-01T00:00:00Z',
                  tags: ['gaming', 'translation', 'utility']
                }
              }
            }
          },
          userPreferences: [
            { key: 'theme', value: 'dark', type: 'string' },
            { key: 'volume', value: 0.8, type: 'number' },
            { key: 'enabled', value: true, type: 'boolean' },
            { key: 'lastLogin', value: null, type: 'date' }
          ]
        }
      },
      {
        id: 'edge-cases',
        data: {
          extremeNumbers: {
            maxSafeInteger: Number.MAX_SAFE_INTEGER,
            minSafeInteger: Number.MIN_SAFE_INTEGER,
            positiveInfinity: Number.POSITIVE_INFINITY,
            negativeInfinity: Number.NEGATIVE_INFINITY,
            notANumber: NaN
          },
          extremeStrings: {
            veryLongString: 'a'.repeat(100000),
            emptyString: '',
            whitespaceOnly: '   \n\t\r   ',
            specialUnicode: '\u0000\u0001\u0002\u0003'
          },
          circularReference: null, // Evitato per prevenire errori di serializzazione
          functionValue: null, // Le funzioni non possono essere serializzate
          symbolValue: null // I symbol non possono essere serializzati
        }
      }
    ];

    // Esegui tutti i test
    for (const testCase of testData) {
      const test = tests.find(t => t.id === testCase.id);
      if (test) {
        await runSerializationTest(test, testCase.data);
      }
    }

    setIsRunning(false);
  }, [tests, runSerializationTest, initializeTests]);

  const getStatusIcon = (status: SerializationTest['status']) => {
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

  const getStatusBadge = (status: SerializationTest['status'], isDataIntact?: boolean) => {
    switch (status) {
      case 'running':
        return <Badge variant="secondary">In corso</Badge>;
      case 'success':
        return (
          <Badge 
            variant="default" 
            className={isDataIntact ? "bg-green-500" : "bg-yellow-500"}
          >
            {isDataIntact ? 'Dati Integri' : 'Dati Modificati'}
          </Badge>
        );
      case 'error':
        return <Badge variant="destructive">Errore</Badge>;
      default:
        return <Badge variant="outline">In attesa</Badge>;
    }
  };

  const successCount = tests.filter(t => t.status === 'success').length;
  const errorCount = tests.filter(t => t.status === 'error').length;
  const intactCount = tests.filter(t => t.status === 'success' && t.isDataIntact).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Test Serializzazione/Deserializzazione
          </CardTitle>
          <div className="flex gap-4 text-sm">
            <span>Totali: {tests.length}</span>
            <span className="text-green-600">Successi: {successCount}</span>
            <span className="text-red-600">Errori: {errorCount}</span>
            <span className="text-blue-600">Dati Integri: {intactCount}</span>
            {tests.length > 0 && (
              <span>Integrità: {((intactCount / tests.length) * 100).toFixed(1)}%</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Button 
              onClick={runAllSerializationTests} 
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Esecuzione test serializzazione...
                </>
              ) : (
                'Esegui test serializzazione'
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
              <Card key={test.id} className="border-l-4 border-l-purple-500">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-4">
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
                      {getStatusBadge(test.status, test.isDataIntact)}
                    </div>
                  </div>

                  {test.originalData && (
                    <Tabs defaultValue="comparison" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="comparison">Confronto</TabsTrigger>
                        <TabsTrigger value="original">Dati Originali</TabsTrigger>
                        <TabsTrigger value="deserialized">Dati Deserializzati</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="comparison" className="mt-4">
                        <div className="space-y-3">
                          {test.isDataIntact !== undefined && (
                            <div className={`p-3 rounded-lg ${
                              test.isDataIntact 
                                ? 'bg-green-50 border border-green-200' 
                                : 'bg-yellow-50 border border-yellow-200'
                            }`}>
                              <div className="flex items-center gap-2">
                                <ArrowRightLeft className={`w-4 h-4 ${
                                  test.isDataIntact ? 'text-green-600' : 'text-yellow-600'
                                }`} />
                                <span className={`font-medium ${
                                  test.isDataIntact ? 'text-green-800' : 'text-yellow-800'
                                }`}>
                                  {test.isDataIntact 
                                    ? 'Dati serializzati/deserializzati correttamente' 
                                    : 'Dati modificati durante serializzazione/deserializzazione'
                                  }
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {test.error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                              <h5 className="font-medium text-red-800 mb-1">Errore:</h5>
                              <p className="text-sm text-red-700">{test.error}</p>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="original" className="mt-4">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <h5 className="font-medium text-blue-800 mb-2">Dati Originali:</h5>
                          <pre className="text-xs text-blue-700 overflow-x-auto max-h-64 overflow-y-auto">
                            {JSON.stringify(test.originalData, null, 2)}
                          </pre>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="deserialized" className="mt-4">
                        {test.deserializedData ? (
                          <div className="p-3 bg-green-50 rounded-lg">
                            <h5 className="font-medium text-green-800 mb-2">Dati Deserializzati:</h5>
                            <pre className="text-xs text-green-700 overflow-x-auto max-h-64 overflow-y-auto">
                              {JSON.stringify(test.deserializedData, null, 2)}
                            </pre>
                          </div>
                        ) : (
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">Nessun dato deserializzato disponibile</p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analisi Serializzazione</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-800">Test Completati</h4>
              <p className="text-2xl font-bold text-green-600">{successCount}</p>
              <p className="text-sm text-green-700">
                Test di serializzazione completati con successo
              </p>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800">Integrità Dati</h4>
              <p className="text-2xl font-bold text-blue-600">{intactCount}</p>
              <p className="text-sm text-blue-700">
                Test con dati completamente integri
              </p>
            </div>
            
            <div className="p-4 bg-red-50 rounded-lg">
              <h4 className="font-medium text-red-800">Errori</h4>
              <p className="text-2xl font-bold text-red-600">{errorCount}</p>
              <p className="text-sm text-red-700">
                Test falliti per errori di serializzazione
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}