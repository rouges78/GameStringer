'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { invoke } from '@/lib/tauri-api';

export function SimpleAuthTest() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testDirectAuth = async () => {
    setLoading(true);
    setResult('');
    
    try {
      console.log('🧪 Test diretto autenticazione...');
      
      // 1. Lista profili
      const profilesResponse = await invoke('list_profiles');
      console.log('📋 Profili:', profilesResponse);
      
      // 2. Profilo corrente
      const currentResponse = await invoke('get_current_profile');
      console.log('👤 Profilo corrente:', currentResponse);
      
      // 3. Se non c'è profilo corrente, prova ad autenticare il primo
      if (profilesResponse.success && profilesResponse.data?.length > 0) {
        const firstProfile = profilesResponse.data[0];
        console.log('🔐 Tentativo autenticazione:', firstProfile.name);
        
        // Prova con password vuota o "test"
        const authResponse = await invoke('authenticate_profile', {
          name: firstProfile.name,
          password: 'test'
        });
        
        console.log('✅ Risultato autenticazione:', authResponse);
        
        if (authResponse.success) {
          setResult(`✅ Autenticazione riuscita per ${firstProfile.name}`);
          
          // Ricarica la pagina per vedere se funziona
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          setResult(`❌ Autenticazione fallita: ${authResponse.error}`);
        }
      } else {
        setResult('❌ Nessun profilo trovato');
      }
      
    } catch (error) {
      console.error('❌ Errore test:', error);
      setResult(`❌ Errore: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const skipAuth = () => {
    console.log('🚀 Saltando autenticazione...');
    // Imposta una variabile di ambiente temporanea
    localStorage.setItem('skip_auth_debug', 'true');
    // Non ricaricare, naviga direttamente
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">🔧 Debug Autenticazione</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={testDirectAuth}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Testing...' : '🧪 Test Autenticazione Diretta'}
          </Button>
          
          <Button 
            onClick={skipAuth}
            variant="outline"
            className="w-full"
          >
            🚀 Salta Autenticazione (Debug)
          </Button>
          
          {result && (
            <div className="p-3 bg-slate-800 rounded text-sm">
              {result}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}