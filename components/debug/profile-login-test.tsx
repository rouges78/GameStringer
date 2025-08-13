'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  TestTube, 
  User, 
  LogIn, 
  LogOut, 
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Zap
} from 'lucide-react';
import { useProfiles } from '@/hooks/use-profiles';
import { useProfileAuth } from '@/lib/profile-auth';

export const ProfileLoginTest: React.FC = () => {
  const { 
    profiles, 
    currentProfile, 
    isLoading, 
    error,
    authenticateProfile,
    switchProfile,
    logout,
    refreshProfiles
  } = useProfiles();
  
  const { 
    isAuthenticated, 
    sessionTimeRemaining,
    isSessionExpired 
  } = useProfileAuth();

  const [testResults, setTestResults] = useState<string[]>([]);
  const [testProfileName, setTestProfileName] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [isTestingLogin, setIsTestingLogin] = useState(false);
  const [isTestingSwitch, setIsTestingSwitch] = useState(false);

  const addTestResult = (result: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev, `${timestamp}: ${result}`]);
  };

  const testLogin = async () => {
    if (!testProfileName.trim() || !testPassword.trim()) {
      addTestResult('❌ Inserisci nome profilo e password');
      return;
    }

    setIsTestingLogin(true);
    addTestResult('🧪 Inizio test login...');
    
    try {
      // Test 1: Tentativo di login
      addTestResult(`🔐 Tentativo login per profilo: ${testProfileName}`);
      const loginSuccess = await authenticateProfile(testProfileName, testPassword);
      
      if (loginSuccess) {
        addTestResult('✅ Login riuscito!');
        
        // Test 2: Verifica che non ci sia stato riavvio
        addTestResult('🔍 Verifica assenza riavvio...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (currentProfile?.name === testProfileName) {
          addTestResult('✅ Profilo attivo senza riavvio');
        } else {
          addTestResult('❌ Profilo non attivo o riavvio rilevato');
        }
        
        // Test 3: Verifica session persistence
        addTestResult('🔍 Verifica session persistence...');
        try {
          const { sessionPersistence } = await import('@/lib/session-persistence');
          const session = sessionPersistence.loadSession();
          if (session && session.profileId === currentProfile?.id) {
            addTestResult('✅ Session persistence funzionante');
          } else {
            addTestResult('⚠️ Session persistence non trovata');
          }
        } catch (error) {
          addTestResult('❌ Errore verifica session persistence');
        }
        
        addTestResult('🎉 Test login completato con successo!');
      } else {
        addTestResult('❌ Login fallito');
      }
    } catch (error) {
      addTestResult(`❌ Errore durante test login: ${error}`);
    } finally {
      setIsTestingLogin(false);
    }
  };

  const testProfileSwitch = async () => {
    if (!testProfileName.trim() || !testPassword.trim()) {
      addTestResult('❌ Inserisci nome profilo e password per switch');
      return;
    }

    setIsTestingSwitch(true);
    addTestResult('🧪 Inizio test cambio profilo...');
    
    try {
      const currentProfileName = currentProfile?.name;
      addTestResult(`🔄 Cambio da "${currentProfileName}" a "${testProfileName}"`);
      
      const switchSuccess = await switchProfile(testProfileName, testPassword);
      
      if (switchSuccess) {
        addTestResult('✅ Switch profilo riuscito!');
        
        // Verifica transizione fluida
        addTestResult('🔍 Verifica transizione fluida...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (currentProfile?.name === testProfileName) {
          addTestResult('✅ Transizione fluida completata');
        } else {
          addTestResult('❌ Transizione non completata');
        }
        
        addTestResult('🎉 Test switch completato con successo!');
      } else {
        addTestResult('❌ Switch profilo fallito');
      }
    } catch (error) {
      addTestResult(`❌ Errore durante test switch: ${error}`);
    } finally {
      setIsTestingSwitch(false);
    }
  };

  const testLogout = async () => {
    addTestResult('🧪 Inizio test logout...');
    
    try {
      const logoutSuccess = await logout();
      
      if (logoutSuccess) {
        addTestResult('✅ Logout riuscito!');
        
        // Verifica che il profilo sia stato rimosso
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!currentProfile) {
          addTestResult('✅ Profilo rimosso correttamente');
        } else {
          addTestResult('❌ Profilo ancora attivo dopo logout');
        }
        
        addTestResult('🎉 Test logout completato!');
      } else {
        addTestResult('❌ Logout fallito');
      }
    } catch (error) {
      addTestResult(`❌ Errore durante test logout: ${error}`);
    }
  };

  const runFullTest = async () => {
    setTestResults([]);
    addTestResult('🚀 Inizio test completo sistema profili...');
    
    // Test 1: Login
    await testLogin();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Switch (se c'è un altro profilo)
    if (profiles.length > 1) {
      const otherProfile = profiles.find(p => p.name !== currentProfile?.name);
      if (otherProfile) {
        setTestProfileName(otherProfile.name);
        await testProfileSwitch();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Test 3: Logout
    await testLogout();
    
    addTestResult('🏁 Test completo terminato!');
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const formatSessionTime = (ms: number | null) => {
    if (!ms) return 'N/A';
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return '<1m';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TestTube className="h-5 w-5 text-blue-500" />
            <span>Test Sistema Login Profili</span>
          </CardTitle>
          <CardDescription>
            Test per verificare che il login/switch profili funzioni senza riavvii o chiusure dell'app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Corrente */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
              <User className="h-8 w-8 text-blue-500 mb-2" />
              <span className="text-2xl font-bold">{profiles.length}</span>
              <span className="text-sm text-muted-foreground">Profili</span>
            </div>
            
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
              <LogIn className="h-8 w-8 text-green-500 mb-2" />
              <Badge variant={isAuthenticated ? "default" : "secondary"}>
                {isAuthenticated ? 'Autenticato' : 'Non Autenticato'}
              </Badge>
              <span className="text-sm text-muted-foreground">Stato</span>
            </div>
            
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
              <Clock className="h-8 w-8 text-orange-500 mb-2" />
              <span className="text-sm font-medium">
                {formatSessionTime(sessionTimeRemaining)}
              </span>
              <span className="text-sm text-muted-foreground">Sessione</span>
            </div>
            
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
              <Zap className="h-8 w-8 text-purple-500 mb-2" />
              <Badge variant={isLoading ? "secondary" : "default"}>
                {isLoading ? 'Caricamento' : 'Pronto'}
              </Badge>
              <span className="text-sm text-muted-foreground">Sistema</span>
            </div>
          </div>

          {/* Profilo Corrente */}
          {currentProfile && (
            <Alert>
              <User className="h-4 w-4" />
              <AlertDescription>
                <strong>Profilo Attivo:</strong> {currentProfile.name} (ID: {currentProfile.id.slice(0, 8)}...)
                {isSessionExpired && <span className="text-red-500 ml-2">⚠️ Sessione Scaduta</span>}
              </AlertDescription>
            </Alert>
          )}

          {/* Errori */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Errore:</strong> {error}
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Controlli Test */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Controlli Test</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome Profilo</Label>
                <Input
                  value={testProfileName}
                  onChange={(e) => setTestProfileName(e.target.value)}
                  placeholder="Inserisci nome profilo"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  placeholder="Inserisci password"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button
                onClick={testLogin}
                disabled={isTestingLogin || !testProfileName.trim() || !testPassword.trim()}
                variant="outline"
                className="h-16 flex flex-col items-center justify-center space-y-2"
              >
                <LogIn className="h-5 w-5" />
                <span className="text-sm">Test Login</span>
              </Button>

              <Button
                onClick={testProfileSwitch}
                disabled={isTestingSwitch || !testProfileName.trim() || !testPassword.trim()}
                variant="outline"
                className="h-16 flex flex-col items-center justify-center space-y-2"
              >
                <RefreshCw className="h-5 w-5" />
                <span className="text-sm">Test Switch</span>
              </Button>

              <Button
                onClick={testLogout}
                disabled={!currentProfile}
                variant="outline"
                className="h-16 flex flex-col items-center justify-center space-y-2"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-sm">Test Logout</span>
              </Button>

              <Button
                onClick={runFullTest}
                disabled={isTestingLogin || isTestingSwitch || !testProfileName.trim() || !testPassword.trim()}
                className="h-16 flex flex-col items-center justify-center space-y-2"
              >
                <TestTube className="h-5 w-5" />
                <span className="text-sm">Test Completo</span>
              </Button>
            </div>

            <div className="flex space-x-4">
              <Button onClick={refreshProfiles} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Ricarica Profili
              </Button>
              <Button onClick={clearResults} variant="outline">
                Pulisci Risultati
              </Button>
            </div>
          </div>

          <Separator />

          {/* Risultati Test */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Risultati Test</h3>
              <Badge variant="outline">
                {testResults.length} risultati
              </Badge>
            </div>

            <div className="bg-black/10 dark:bg-black/30 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
              <div className="font-mono text-sm space-y-1">
                {testResults.length > 0 ? (
                  testResults.map((result, index) => (
                    <div key={index} className="text-gray-300">
                      {result}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 italic">
                    Nessun test eseguito - Configura i parametri e clicca un pulsante per iniziare...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lista Profili Disponibili */}
          {profiles.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Profili Disponibili</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className={`p-3 rounded-lg border ${
                        currentProfile?.id === profile.id 
                          ? 'border-primary bg-primary/10' 
                          : 'border-muted bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{profile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            ID: {profile.id.slice(0, 8)}...
                          </p>
                        </div>
                        {currentProfile?.id === profile.id && (
                          <Badge variant="default">Attivo</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileLoginTest;