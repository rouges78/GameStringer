'use client';

import { useState, useCallback } from 'react';
import { invoke } from '@/lib/tauri-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Loader2, Play, CheckCircle, XCircle, User, Lock, Settings, Trash2 } from 'lucide-react';

interface FlowStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  result?: any;
  error?: string;
  duration?: number;
}

interface FlowTest {
  id: string;
  name: string;
  description: string;
  steps: FlowStep[];
  status: 'idle' | 'running' | 'success' | 'error';
  totalDuration?: number;
}

export function EndToEndFlowTest() {
  const [flows, setFlows] = useState<FlowTest[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [testProfiles, setTestProfiles] = useState<string[]>([]);

  const updateFlow = useCallback((flowId: string, updates: Partial<FlowTest>) => {
    setFlows(prev => prev.map(flow => 
      flow.id === flowId ? { ...flow, ...updates } : flow
    ));
  }, []);

  const updateStep = useCallback((flowId: string, stepId: string, updates: Partial<FlowStep>) => {
    setFlows(prev => prev.map(flow => 
      flow.id === flowId 
        ? {
            ...flow,
            steps: flow.steps.map(step => 
              step.id === stepId ? { ...step, ...updates } : step
            )
          }
        : flow
    ));
  }, []);

  const runStep = useCallback(async (
    flowId: string,
    step: FlowStep,
    stepFn: () => Promise<any>
  ) => {
    const startTime = Date.now();
    
    updateStep(flowId, step.id, { status: 'running' });

    try {
      const result = await stepFn();
      const duration = Date.now() - startTime;
      
      updateStep(flowId, step.id, {
        status: 'success',
        result,
        duration
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      updateStep(flowId, step.id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
        duration
      });
      throw error;
    }
  }, [updateStep]);

  const initializeFlows = useCallback(() => {
    const flowTestSuite: FlowTest[] = [
      {
        id: 'basic-profile-flow',
        name: 'Flusso Base Profilo',
        description: 'Creazione, autenticazione, logout ed eliminazione profilo',
        status: 'idle',
        steps: [
          {
            id: 'validate-name',
            name: 'Validazione Nome',
            description: 'Valida nome profilo prima della creazione',
            status: 'pending'
          },
          {
            id: 'validate-password',
            name: 'Validazione Password',
            description: 'Valida password prima della creazione',
            status: 'pending'
          },
          {
            id: 'create-profile',
            name: 'Creazione Profilo',
            description: 'Crea nuovo profilo utente',
            status: 'pending'
          },
          {
            id: 'verify-creation',
            name: 'Verifica Creazione',
            description: 'Verifica che il profilo sia stato creato correttamente',
            status: 'pending'
          },
          {
            id: 'authenticate',
            name: 'Autenticazione',
            description: 'Autentica il profilo creato',
            status: 'pending'
          },
          {
            id: 'verify-auth',
            name: 'Verifica Autenticazione',
            description: 'Verifica che l\'autenticazione sia avvenuta',
            status: 'pending'
          },
          {
            id: 'logout',
            name: 'Logout',
            description: 'Effettua logout dal profilo',
            status: 'pending'
          },
          {
            id: 'verify-logout',
            name: 'Verifica Logout',
            description: 'Verifica che il logout sia avvenuto',
            status: 'pending'
          },
          {
            id: 'delete-profile',
            name: 'Eliminazione Profilo',
            description: 'Elimina il profilo di test',
            status: 'pending'
          }
        ]
      },
      {
        id: 'advanced-profile-flow',
        name: 'Flusso Avanzato Profilo',
        description: 'Test funzionalità avanzate: impostazioni, switch, backup',
        status: 'idle',
        steps: [
          {
            id: 'create-profile-advanced',
            name: 'Creazione Profilo Avanzato',
            description: 'Crea profilo con impostazioni complesse',
            status: 'pending'
          },
          {
            id: 'authenticate-advanced',
            name: 'Autenticazione Avanzata',
            description: 'Autentica profilo avanzato',
            status: 'pending'
          },
          {
            id: 'update-settings',
            name: 'Aggiornamento Impostazioni',
            description: 'Modifica impostazioni profilo',
            status: 'pending'
          },
          {
            id: 'create-second-profile',
            name: 'Secondo Profilo',
            description: 'Crea secondo profilo per test switch',
            status: 'pending'
          },
          {
            id: 'switch-profile',
            name: 'Cambio Profilo',
            description: 'Cambia dal primo al secondo profilo',
            status: 'pending'
          },
          {
            id: 'verify-switch',
            name: 'Verifica Cambio',
            description: 'Verifica che il cambio sia avvenuto',
            status: 'pending'
          },
          {
            id: 'create-backup',
            name: 'Backup Profilo',
            description: 'Crea backup del profilo corrente',
            status: 'pending'
          },
          {
            id: 'cleanup-advanced',
            name: 'Pulizia Avanzata',
            description: 'Elimina tutti i profili di test',
            status: 'pending'
          }
        ]
      },
      {
        id: 'error-recovery-flow',
        name: 'Flusso Recupero Errori',
        description: 'Test gestione errori e recupero da situazioni anomale',
        status: 'idle',
        steps: [
          {
            id: 'create-valid-profile',
            name: 'Profilo Valido',
            description: 'Crea profilo valido per test errori',
            status: 'pending'
          },
          {
            id: 'test-wrong-password',
            name: 'Password Errata',
            description: 'Testa autenticazione con password errata',
            status: 'pending'
          },
          {
            id: 'test-nonexistent-profile',
            name: 'Profilo Inesistente',
            description: 'Testa autenticazione profilo inesistente',
            status: 'pending'
          },
          {
            id: 'test-duplicate-creation',
            name: 'Creazione Duplicata',
            description: 'Testa creazione profilo con nome esistente',
            status: 'pending'
          },
          {
            id: 'recover-valid-auth',
            name: 'Recupero Autenticazione',
            description: 'Recupera con autenticazione valida',
            status: 'pending'
          },
          {
            id: 'cleanup-error-test',
            name: 'Pulizia Test Errori',
            description: 'Pulisce profili di test errori',
            status: 'pending'
          }
        ]
      },
      {
        id: 'concurrent-operations-flow',
        name: 'Operazioni Concorrenti',
        description: 'Test operazioni multiple simultanee',
        status: 'idle',
        steps: [
          {
            id: 'create-multiple-profiles',
            name: 'Creazione Multipla',
            description: 'Crea più profili contemporaneamente',
            status: 'pending'
          },
          {
            id: 'concurrent-auth',
            name: 'Autenticazioni Concorrenti',
            description: 'Testa autenticazioni simultanee',
            status: 'pending'
          },
          {
            id: 'concurrent-operations',
            name: 'Operazioni Miste',
            description: 'Esegue operazioni diverse contemporaneamente',
            status: 'pending'
          },
          {
            id: 'verify-consistency',
            name: 'Verifica Consistenza',
            description: 'Verifica consistenza dati dopo operazioni concorrenti',
            status: 'pending'
          },
          {
            id: 'cleanup-concurrent',
            name: 'Pulizia Concorrente',
            description: 'Pulisce tutti i profili di test',
            status: 'pending'
          }
        ]
      }
    ];

    setFlows(flowTestSuite);
  }, []);

  const runBasicProfileFlow = useCallback(async (flow: FlowTest) => {
    const profileName = `basic_test_${Date.now()}`;
    const profilePassword = 'BasicTest123!';
    let profileId: string | null = null;

    // Step 1: Validazione nome
    await runStep(flow.id, flow.steps[0], async () => {
      const response = await invoke('validate_profile_name', { name: profileName });
      if (!response.success) {
        throw new Error(response.error || 'Validazione nome fallita');
      }
      return response;
    });

    // Step 2: Validazione password
    await runStep(flow.id, flow.steps[1], async () => {
      const response = await invoke('validate_password', { password: profilePassword });
      if (!response.success) {
        throw new Error(response.error || 'Validazione password fallita');
      }
      return response;
    });

    // Step 3: Creazione profilo
    const createResult = await runStep(flow.id, flow.steps[2], async () => {
      const response = await invoke('create_profile', {
        request: {
          name: profileName,
          password: profilePassword,
          settings: {
            theme: 'dark',
            language: 'it',
            auto_login: false,
            session_timeout: 3600
          }
        }
      });
      if (!response.success) {
        throw new Error(response.error || 'Creazione profilo fallita');
      }
      profileId = response.data.id;
      setTestProfiles(prev => [...prev, profileId!]);
      return response;
    });

    // Step 4: Verifica creazione
    await runStep(flow.id, flow.steps[3], async () => {
      const response = await invoke('list_profiles');
      if (!response.success) {
        throw new Error('Impossibile verificare creazione profilo');
      }
      const profile = response.data.find((p: any) => p.id === profileId);
      if (!profile) {
        throw new Error('Profilo creato non trovato nella lista');
      }
      return profile;
    });

    // Step 5: Autenticazione
    await runStep(flow.id, flow.steps[4], async () => {
      const response = await invoke('authenticate_profile', {
        name: profileName,
        password: profilePassword
      });
      if (!response.success) {
        throw new Error(response.error || 'Autenticazione fallita');
      }
      return response;
    });

    // Step 6: Verifica autenticazione
    await runStep(flow.id, flow.steps[5], async () => {
      const response = await invoke('get_current_profile');
      if (!response.success || !response.data) {
        throw new Error('Nessun profilo autenticato trovato');
      }
      if (response.data.id !== profileId) {
        throw new Error('Profilo autenticato non corrisponde');
      }
      return response;
    });

    // Step 7: Logout
    await runStep(flow.id, flow.steps[6], async () => {
      const response = await invoke('logout');
      if (!response.success) {
        throw new Error(response.error || 'Logout fallito');
      }
      return response;
    });

    // Step 8: Verifica logout
    await runStep(flow.id, flow.steps[7], async () => {
      const response = await invoke('get_current_profile');
      if (!response.success) {
        throw new Error('Errore verifica logout');
      }
      if (response.data) {
        throw new Error('Profilo ancora autenticato dopo logout');
      }
      return response;
    });

    // Step 9: Eliminazione profilo
    await runStep(flow.id, flow.steps[8], async () => {
      if (!profileId) {
        throw new Error('Nessun profilo da eliminare');
      }
      const response = await invoke('delete_profile', {
        profile_id: profileId,
        password: profilePassword
      });
      if (!response.success) {
        throw new Error(response.error || 'Eliminazione profilo fallita');
      }
      setTestProfiles(prev => prev.filter(id => id !== profileId));
      return response;
    });
  }, [runStep]);

  const runAdvancedProfileFlow = useCallback(async (flow: FlowTest) => {
    const profile1Name = `advanced_test_1_${Date.now()}`;
    const profile2Name = `advanced_test_2_${Date.now()}`;
    const profilePassword = 'AdvancedTest123!';
    let profile1Id: string | null = null;
    let profile2Id: string | null = null;

    // Step 1: Creazione profilo avanzato
    await runStep(flow.id, flow.steps[0], async () => {
      const response = await invoke('create_profile', {
        request: {
          name: profile1Name,
          password: profilePassword,
          settings: {
            theme: 'dark',
            language: 'it',
            auto_login: true,
            session_timeout: 7200,
            notifications: {
              enabled: true,
              sound: false,
              types: ['auth', 'system', 'updates']
            },
            advanced: {
              debug_mode: false,
              auto_backup: true,
              encryption_level: 'high'
            }
          }
        }
      });
      if (!response.success) {
        throw new Error(response.error || 'Creazione profilo avanzato fallita');
      }
      profile1Id = response.data.id;
      setTestProfiles(prev => [...prev, profile1Id!]);
      return response;
    });

    // Step 2: Autenticazione avanzata
    await runStep(flow.id, flow.steps[1], async () => {
      const response = await invoke('authenticate_profile', {
        name: profile1Name,
        password: profilePassword
      });
      if (!response.success) {
        throw new Error(response.error || 'Autenticazione avanzata fallita');
      }
      return response;
    });

    // Step 3: Aggiornamento impostazioni
    await runStep(flow.id, flow.steps[2], async () => {
      const newSettings = {
        theme: 'light',
        language: 'en',
        auto_login: false,
        session_timeout: 1800,
        notifications: {
          enabled: false,
          sound: true,
          types: ['auth']
        }
      };
      const response = await invoke('update_settings', {
        settings: newSettings,
        password: profilePassword
      });
      if (!response.success) {
        throw new Error(response.error || 'Aggiornamento impostazioni fallito');
      }
      return response;
    });

    // Step 4: Creazione secondo profilo
    await runStep(flow.id, flow.steps[3], async () => {
      const response = await invoke('create_profile', {
        request: {
          name: profile2Name,
          password: profilePassword,
          settings: {
            theme: 'auto',
            language: 'es',
            auto_login: false,
            session_timeout: 3600
          }
        }
      });
      if (!response.success) {
        throw new Error(response.error || 'Creazione secondo profilo fallita');
      }
      profile2Id = response.data.id;
      setTestProfiles(prev => [...prev, profile2Id!]);
      return response;
    });

    // Step 5: Cambio profilo
    await runStep(flow.id, flow.steps[4], async () => {
      const response = await invoke('switch_profile', {
        name: profile2Name,
        password: profilePassword
      });
      if (!response.success) {
        throw new Error(response.error || 'Cambio profilo fallito');
      }
      return response;
    });

    // Step 6: Verifica cambio
    await runStep(flow.id, flow.steps[5], async () => {
      const response = await invoke('get_current_profile');
      if (!response.success || !response.data) {
        throw new Error('Nessun profilo corrente dopo cambio');
      }
      if (response.data.id !== profile2Id) {
        throw new Error('Cambio profilo non avvenuto correttamente');
      }
      return response;
    });

    // Step 7: Backup profilo
    await runStep(flow.id, flow.steps[6], async () => {
      if (!profile2Id) {
        throw new Error('Nessun profilo per backup');
      }
      const response = await invoke('create_profile_backup', {
        profile_id: profile2Id,
        password: profilePassword
      });
      if (!response.success) {
        throw new Error(response.error || 'Creazione backup fallita');
      }
      return response;
    });

    // Step 8: Pulizia
    await runStep(flow.id, flow.steps[7], async () => {
      const results = [];
      
      if (profile1Id) {
        const response1 = await invoke('delete_profile', {
          profile_id: profile1Id,
          password: profilePassword
        });
        results.push(response1);
        setTestProfiles(prev => prev.filter(id => id !== profile1Id));
      }
      
      if (profile2Id) {
        const response2 = await invoke('delete_profile', {
          profile_id: profile2Id,
          password: profilePassword
        });
        results.push(response2);
        setTestProfiles(prev => prev.filter(id => id !== profile2Id));
      }
      
      return results;
    });
  }, [runStep]);

  const runErrorRecoveryFlow = useCallback(async (flow: FlowTest) => {
    const profileName = `error_test_${Date.now()}`;
    const profilePassword = 'ErrorTest123!';
    let profileId: string | null = null;

    // Step 1: Crea profilo valido
    await runStep(flow.id, flow.steps[0], async () => {
      const response = await invoke('create_profile', {
        request: {
          name: profileName,
          password: profilePassword,
          settings: { theme: 'dark', language: 'it' }
        }
      });
      if (!response.success) {
        throw new Error(response.error || 'Creazione profilo valido fallita');
      }
      profileId = response.data.id;
      setTestProfiles(prev => [...prev, profileId!]);
      return response;
    });

    // Step 2: Test password errata (dovrebbe fallire)
    await runStep(flow.id, flow.steps[1], async () => {
      const response = await invoke('authenticate_profile', {
        name: profileName,
        password: 'password_errata'
      });
      if (response.success) {
        throw new Error('Autenticazione dovrebbe fallire con password errata');
      }
      // Questo è il comportamento atteso
      return { expected_error: response.error };
    });

    // Step 3: Test profilo inesistente (dovrebbe fallire)
    await runStep(flow.id, flow.steps[2], async () => {
      const response = await invoke('authenticate_profile', {
        name: 'profilo_inesistente_12345',
        password: profilePassword
      });
      if (response.success) {
        throw new Error('Autenticazione dovrebbe fallire con profilo inesistente');
      }
      return { expected_error: response.error };
    });

    // Step 4: Test creazione duplicata (dovrebbe fallire)
    await runStep(flow.id, flow.steps[3], async () => {
      const response = await invoke('create_profile', {
        request: {
          name: profileName, // Stesso nome del profilo esistente
          password: 'AnotherPassword123!',
          settings: { theme: 'light', language: 'en' }
        }
      });
      if (response.success) {
        throw new Error('Creazione dovrebbe fallire con nome duplicato');
      }
      return { expected_error: response.error };
    });

    // Step 5: Recupero con autenticazione valida
    await runStep(flow.id, flow.steps[4], async () => {
      const response = await invoke('authenticate_profile', {
        name: profileName,
        password: profilePassword
      });
      if (!response.success) {
        throw new Error(response.error || 'Recupero autenticazione fallito');
      }
      return response;
    });

    // Step 6: Pulizia
    await runStep(flow.id, flow.steps[5], async () => {
      if (!profileId) {
        return { message: 'Nessun profilo da pulire' };
      }
      const response = await invoke('delete_profile', {
        profile_id: profileId,
        password: profilePassword
      });
      if (!response.success) {
        throw new Error(response.error || 'Pulizia fallita');
      }
      setTestProfiles(prev => prev.filter(id => id !== profileId));
      return response;
    });
  }, [runStep]);

  const runConcurrentOperationsFlow = useCallback(async (flow: FlowTest) => {
    const profileNames = Array(3).fill(0).map((_, i) => `concurrent_test_${i}_${Date.now()}`);
    const profilePassword = 'ConcurrentTest123!';
    const createdProfiles: string[] = [];

    // Step 1: Creazione multipla
    await runStep(flow.id, flow.steps[0], async () => {
      const createPromises = profileNames.map(name => 
        invoke('create_profile', {
          request: {
            name,
            password: profilePassword,
            settings: { theme: 'dark', language: 'it' }
          }
        })
      );

      const results = await Promise.all(createPromises);
      
      for (const result of results) {
        if (!result.success) {
          throw new Error(`Creazione multipla fallita: ${result.error}`);
        }
        createdProfiles.push(result.data.id);
      }
      
      setTestProfiles(prev => [...prev, ...createdProfiles]);
      return results;
    });

    // Step 2: Autenticazioni concorrenti
    await runStep(flow.id, flow.steps[1], async () => {
      const authPromises = profileNames.map(name => 
        invoke('authenticate_profile', {
          name,
          password: profilePassword
        })
      );

      const results = await Promise.all(authPromises);
      
      // Solo l'ultima autenticazione dovrebbe essere quella attiva
      const successfulAuths = results.filter(r => r.success);
      if (successfulAuths.length === 0) {
        throw new Error('Nessuna autenticazione riuscita');
      }
      
      return results;
    });

    // Step 3: Operazioni miste
    await runStep(flow.id, flow.steps[2], async () => {
      const operations = [
        invoke('list_profiles'),
        invoke('get_current_profile'),
        invoke('get_auth_stats'),
        invoke('validate_profile_name', { name: 'test_concurrent' }),
        invoke('validate_password', { password: 'TestPassword123!' })
      ];

      const results = await Promise.all(operations);
      return results;
    });

    // Step 4: Verifica consistenza
    await runStep(flow.id, flow.steps[3], async () => {
      const listResponse = await invoke('list_profiles');
      if (!listResponse.success) {
        throw new Error('Impossibile verificare consistenza');
      }

      const foundProfiles = listResponse.data.filter((p: any) => 
        profileNames.includes(p.name)
      );

      if (foundProfiles.length !== profileNames.length) {
        throw new Error(`Consistenza fallita: trovati ${foundProfiles.length} profili su ${profileNames.length}`);
      }

      return { profiles_found: foundProfiles.length, expected: profileNames.length };
    });

    // Step 5: Pulizia concorrente
    await runStep(flow.id, flow.steps[4], async () => {
      const deletePromises = createdProfiles.map(profileId => 
        invoke('delete_profile', {
          profile_id: profileId,
          password: profilePassword
        })
      );

      const results = await Promise.all(deletePromises);
      
      for (const result of results) {
        if (!result.success) {
          console.warn('Errore pulizia profilo:', result.error);
        }
      }
      
      setTestProfiles(prev => prev.filter(id => !createdProfiles.includes(id)));
      return results;
    });
  }, [runStep]);

  const runAllFlows = useCallback(async () => {
    setIsRunning(true);
    setProgress(0);
    initializeFlows();

    // Aspetta che i flussi siano inizializzati
    await new Promise(resolve => setTimeout(resolve, 100));

    const flowRunners = [
      { id: 'basic-profile-flow', runner: runBasicProfileFlow },
      { id: 'advanced-profile-flow', runner: runAdvancedProfileFlow },
      { id: 'error-recovery-flow', runner: runErrorRecoveryFlow },
      { id: 'concurrent-operations-flow', runner: runConcurrentOperationsFlow }
    ];

    for (let i = 0; i < flowRunners.length; i++) {
      const { id, runner } = flowRunners[i];
      const flow = flows.find(f => f.id === id);
      
      if (flow) {
        const startTime = Date.now();
        updateFlow(id, { status: 'running' });
        
        try {
          await runner(flow);
          const totalDuration = Date.now() - startTime;
          updateFlow(id, { status: 'success', totalDuration });
        } catch (error) {
          const totalDuration = Date.now() - startTime;
          updateFlow(id, { 
            status: 'error', 
            totalDuration
          });
          console.error(`Errore flusso ${id}:`, error);
        }
      }
      
      setProgress(((i + 1) / flowRunners.length) * 100);
    }

    setIsRunning(false);
  }, [flows, runBasicProfileFlow, runAdvancedProfileFlow, runErrorRecoveryFlow, runConcurrentOperationsFlow, updateFlow, initializeFlows]);

  const cleanupAllTestProfiles = useCallback(async () => {
    if (testProfiles.length === 0) return;

    try {
      const deletePromises = testProfiles.map(profileId => 
        invoke('delete_profile', {
          profile_id: profileId,
          password: 'TestPassword123!' // Password generica per pulizia
        }).catch(error => ({ success: false, error: error.message }))
      );

      await Promise.all(deletePromises);
      setTestProfiles([]);
    } catch (error) {
      console.error('Errore pulizia profili di test:', error);
    }
  }, [testProfiles]);

  const getStepIcon = (status: FlowStep['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'skipped':
        return <div className="w-4 h-4 rounded-full bg-yellow-400" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
    }
  };

  const getFlowIcon = (flowId: string) => {
    switch (flowId) {
      case 'basic-profile-flow':
        return <User className="w-5 h-5" />;
      case 'advanced-profile-flow':
        return <Settings className="w-5 h-5" />;
      case 'error-recovery-flow':
        return <XCircle className="w-5 h-5" />;
      case 'concurrent-operations-flow':
        return <Play className="w-5 h-5" />;
      default:
        return <Play className="w-5 h-5" />;
    }
  };

  const getStatusBadge = (status: FlowTest['status']) => {
    switch (status) {
      case 'running':
        return <Badge variant="secondary">In corso</Badge>;
      case 'success':
        return <Badge variant="default" className="bg-green-500">Completato</Badge>;
      case 'error':
        return <Badge variant="destructive">Errore</Badge>;
      default:
        return <Badge variant="outline">In attesa</Badge>;
    }
  };

  const totalFlows = flows.length;
  const completedFlows = flows.filter(f => f.status === 'success').length;
  const errorFlows = flows.filter(f => f.status === 'error').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Test Flusso End-to-End Sistema Profili
          </CardTitle>
          <div className="flex gap-4 text-sm">
            <span>Flussi totali: {totalFlows}</span>
            <span className="text-green-600">Completati: {completedFlows}</span>
            <span className="text-red-600">Errori: {errorFlows}</span>
            <span className="text-blue-600">Profili di test attivi: {testProfiles.length}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Button 
              onClick={runAllFlows} 
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Esecuzione flussi...
                </>
              ) : (
                'Esegui tutti i flussi'
              )}
            </Button>
            
            <Button 
              variant="outline"
              onClick={initializeFlows}
              disabled={isRunning}
            >
              Reset flussi
            </Button>

            {testProfiles.length > 0 && (
              <Button 
                variant="destructive"
                onClick={cleanupAllTestProfiles}
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
                <span className="text-sm">Progresso flussi:</span>
                <span className="text-sm font-medium">{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <div className="space-y-6">
            {flows.map((flow) => (
              <Card key={flow.id} className="border-l-4 border-l-indigo-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getFlowIcon(flow.id)}
                      <div>
                        <h3 className="font-medium">{flow.name}</h3>
                        <p className="text-sm text-gray-600">{flow.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {flow.totalDuration && (
                        <span className="text-sm text-gray-500">{flow.totalDuration}ms</span>
                      )}
                      {getStatusBadge(flow.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {flow.steps.map((step, index) => (
                      <div key={step.id}>
                        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            {getStepIcon(step.status)}
                            <div>
                              <span className="text-sm font-medium">{step.name}</span>
                              <p className="text-xs text-gray-500">{step.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {step.duration && (
                              <span className="text-xs text-gray-400">{step.duration}ms</span>
                            )}
                            {step.status === 'error' && step.error && (
                              <span className="text-xs text-red-600 max-w-xs truncate" title={step.error}>
                                {step.error}
                              </span>
                            )}
                          </div>
                        </div>
                        {index < flow.steps.length - 1 && (
                          <Separator className="my-1" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riepilogo Test End-to-End</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800">Flussi Totali</h4>
              <p className="text-2xl font-bold text-blue-600">{totalFlows}</p>
              <p className="text-sm text-blue-700">Flussi di test configurati</p>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-800">Completati</h4>
              <p className="text-2xl font-bold text-green-600">{completedFlows}</p>
              <p className="text-sm text-green-700">Flussi completati con successo</p>
            </div>
            
            <div className="p-4 bg-red-50 rounded-lg">
              <h4 className="font-medium text-red-800">Errori</h4>
              <p className="text-2xl font-bold text-red-600">{errorFlows}</p>
              <p className="text-sm text-red-700">Flussi falliti</p>
            </div>
            
            <div className="p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-medium text-yellow-800">Profili Test</h4>
              <p className="text-2xl font-bold text-yellow-600">{testProfiles.length}</p>
              <p className="text-sm text-yellow-700">Profili di test attivi</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}