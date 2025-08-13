'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function LoginDebugMonitor() {
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    // Intercetta tutti i console.log
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = (...args) => {
      originalLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev, `[LOG] ${new Date().toISOString()}: ${message}`]);
    };
    
    console.error = (...args) => {
      originalError(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev, `[ERROR] ${new Date().toISOString()}: ${message}`]);
    };
    
    console.warn = (...args) => {
      originalWarn(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev, `[WARN] ${new Date().toISOString()}: ${message}`]);
    };
    
    // Monitora eventi di navigazione
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.error('🚨 ATTENZIONE: La pagina sta per essere ricaricata/chiusa!');
      console.error('Stack trace:', new Error().stack);
      // Previeni il reload per debug
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Intercetta location changes
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      console.log('🔄 history.pushState chiamato:', args);
      return originalPushState.apply(history, args);
    };
    
    history.replaceState = function(...args) {
      console.log('🔄 history.replaceState chiamato:', args);
      return originalReplaceState.apply(history, args);
    };
    
    // Intercetta window.location modifiche
    let locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      get: function() {
        return locationDescriptor?.get?.call(window);
      },
      set: function(value) {
        console.error('🚨 TENTATIVO DI MODIFICARE window.location:', value);
        console.error('Stack trace:', new Error().stack);
        // Blocca la modifica per debug
        // return locationDescriptor?.set?.call(window, value);
      }
    });
    
    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);
  
  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-96 overflow-auto z-50 bg-black/90 text-white">
      <CardHeader className="py-2">
        <CardTitle className="text-sm">🔍 Login Debug Monitor</CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        <div className="text-xs font-mono space-y-1 max-h-64 overflow-y-auto">
          {logs.slice(-20).map((log, i) => (
            <div 
              key={i} 
              className={
                log.includes('[ERROR]') || log.includes('🚨') ? 'text-red-400' : 
                log.includes('[WARN]') ? 'text-yellow-400' : 
                'text-green-400'
              }
            >
              {log}
            </div>
          ))}
        </div>
        <button 
          onClick={() => setLogs([])} 
          className="mt-2 text-xs bg-red-600 px-2 py-1 rounded"
        >
          Clear Logs
        </button>
      </CardContent>
    </Card>
  );
}
