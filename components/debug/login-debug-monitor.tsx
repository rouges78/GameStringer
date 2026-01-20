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
      
      // Usa setTimeout per evitare setState durante il rendering
      setTimeout(() => {
        setLogs(prev => [...prev, `[LOG] ${new Date().toISOString()}: ${message}`]);
      }, 0);
    };
    
    console.error = (...args) => {
      originalError(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      // Usa setTimeout per evitare setState durante il rendering
      setTimeout(() => {
        setLogs(prev => [...prev, `[ERROR] ${new Date().toISOString()}: ${message}`]);
      }, 0);
    };
    
    console.warn = (...args) => {
      originalWarn(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      // Usa setTimeout per evitare setState durante il rendering
      setTimeout(() => {
        setLogs(prev => [...prev, `[WARN] ${new Date().toISOString()}: ${message}`]);
      }, 0);
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
    
    // Intercetta tentativi di modificare window.location (solo se non già definito)
    try {
      const descriptor = Object.getOwnPropertyDescriptor(window, 'location');
      if (!descriptor || descriptor.configurable) {
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
          get() {
            return originalLocation;
          },
          set(value) {
            console.warn('🚫 [LoginDebugMonitor] Tentativo di modificare window.location bloccato:', value);
            setLogs(prev => [...prev, `[WARN] ${new Date().toISOString()}: Tentativo di modificare window.location: ${value}`]);
            // Non permettere la modifica
            return originalLocation;
          },
          configurable: true
        });
      }
    } catch (e) {
      console.log('⚠️ [LoginDebugMonitor] Non posso intercettare window.location:', e.message);
      setLogs(prev => [...prev, `[ERROR] ${new Date().toISOString()}: Non posso intercettare window.location: ${e.message}`]);
    }
    
    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const errorCount = logs.filter(l => l.includes('[ERROR]')).length;
  const warnCount = logs.filter(l => l.includes('[WARN]')).length;

  // Versione minimale: solo un piccolo indicatore
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 text-white text-xs hover:bg-black/90 transition-colors"
        title="Apri Debug Monitor"
      >
        <span>🔍</span>
        {errorCount > 0 && <span className="bg-red-500 px-1.5 rounded-full">{errorCount}</span>}
        {warnCount > 0 && <span className="bg-yellow-500 text-black px-1.5 rounded-full">{warnCount}</span>}
        {errorCount === 0 && warnCount === 0 && <span className="text-green-400">OK</span>}
      </button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 max-h-64 overflow-auto z-50 bg-black/95 text-white border-gray-700">
      <CardHeader className="py-1.5 px-3 flex flex-row items-center justify-between">
        <CardTitle className="text-xs">🔍 Debug</CardTitle>
        <button 
          onClick={() => setIsExpanded(false)}
          className="text-gray-400 hover:text-white text-sm"
        >
          ✕
        </button>
      </CardHeader>
      <CardContent className="py-1.5 px-3">
        <div className="text-[10px] font-mono space-y-0.5 max-h-40 overflow-y-auto">
          {logs.slice(-15).map((log, i) => (
            <div 
              key={i} 
              className={`truncate ${
                log.includes('[ERROR]') || log.includes('🚨') ? 'text-red-400' : 
                log.includes('[WARN]') ? 'text-yellow-400' : 
                'text-green-400'
              }`}
              title={log}
            >
              {log.substring(log.indexOf(']:') + 2).slice(0, 80)}
            </div>
          ))}
        </div>
        <button 
          onClick={() => setLogs([])} 
          className="mt-1 text-[10px] bg-red-600 px-2 py-0.5 rounded"
        >
          Clear
        </button>
      </CardContent>
    </Card>
  );
}



