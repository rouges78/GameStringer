'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, RefreshCw } from 'lucide-react';

interface MockProcess {
  pid: number;
  name: string;
  windowTitle: string;
  path: string;
}

interface Translation {
  original: string;
  translated: string;
  timestamp: number;
}

export default function InjektPOCPage() {
  const [processes, setProcesses] = useState<MockProcess[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<MockProcess | null>(null);
  const [isInjecting, setIsInjecting] = useState(false);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(false);

  // Carica processi reali dal sistema
  const loadProcesses = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/processes');
      const data = await response.json();
      if (data.success) {
        setProcesses(data.processes);
      } else {
        console.error('Errore:', data.error || data.message);
      }
    } catch (error) {
      console.error('Errore caricamento processi:', error);
    }
    setLoading(false);
  };

  // Avvia iniezione simulata
  const startInjection = async (process: MockProcess) => {
    try {
      const response = await fetch('/api/injekt/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          pid: process.pid,
          config: {
            sourceLang: 'en',
            targetLang: 'it',
            apiProvider: 'openai'
          }
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setIsInjecting(true);
        setSelectedProcess(process);
        
        // Simula traduzioni in arrivo
        if (data.translations) {
          data.translations.forEach((trans: Translation, index: number) => {
            setTimeout(() => {
              setTranslations(prev => [...prev, trans]);
            }, index * 2000);
          });
          
          // Continua ad aggiungere traduzioni simulate ogni 3 secondi
          const interval = setInterval(() => {
            const mockTranslations = [
              { original: "Quest completed!", translated: "Missione completata!" },
              { original: "Level up!", translated: "Livello aumentato!" },
              { original: "New item acquired", translated: "Nuovo oggetto acquisito" },
              { original: "Save game?", translated: "Salvare la partita?" },
              { original: "Loading...", translated: "Caricamento..." },
              { original: "Game Over", translated: "Fine del gioco" },
              { original: "Continue?", translated: "Continuare?" },
              { original: "Exit to main menu", translated: "Esci al menu principale" }
            ];
            
            const randomTranslation = mockTranslations[Math.floor(Math.random() * mockTranslations.length)];
            setTranslations(prev => [...prev, {
              ...randomTranslation,
              timestamp: Date.now()
            }]);
          }, 3000);
          
          // Salva l'interval ID per poterlo fermare quando si stoppa l'iniezione
          (window as any).translationInterval = interval;
        }
      }
    } catch (error) {
      console.error('Errore avvio iniezione:', error);
    }
  };

  // Ferma iniezione
  const stopInjection = async () => {
    try {
      await fetch('/api/injekt/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      
      // Ferma l'interval delle traduzioni simulate
      if ((window as any).translationInterval) {
        clearInterval((window as any).translationInterval);
        delete (window as any).translationInterval;
      }
      
      setIsInjecting(false);
      setSelectedProcess(null);
      setTranslations([]); // Pulisce le traduzioni quando si ferma
    } catch (error) {
      console.error('Errore stop iniezione:', error);
    }
  };

  useEffect(() => {
    loadProcesses();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🎮 Injekt-Translator POC</h1>
        <p className="text-muted-foreground">
          Proof of Concept per la traduzione in tempo reale dei giochi
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista Processi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Processi di Gioco Rilevati
              <Button 
                size="sm" 
                variant="outline"
                onClick={loadProcesses}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {processes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nessun processo trovato
              </p>
            ) : (
              <div className="space-y-3">
                {processes.map((process) => (
                  <div
                    key={process.pid}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedProcess?.pid === process.pid
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => !isInjecting && setSelectedProcess(process)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{process.windowTitle}</h3>
                        <p className="text-sm text-muted-foreground">
                          {process.name} (PID: {process.pid})
                        </p>
                      </div>
                      {selectedProcess?.pid === process.pid && isInjecting && (
                        <Badge variant="default" className="animate-pulse">
                          Traducendo...
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Controlli e Traduzioni */}
        <div className="space-y-6">
          {/* Controlli */}
          <Card>
            <CardHeader>
              <CardTitle>Controlli Traduzione</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedProcess ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Processo selezionato:
                    </p>
                    <p className="font-semibold">{selectedProcess.windowTitle}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    {!isInjecting ? (
                      <Button
                        onClick={() => startInjection(selectedProcess)}
                        className="flex-1"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Avvia Traduzione
                      </Button>
                    ) : (
                      <Button
                        onClick={stopInjection}
                        variant="destructive"
                        className="flex-1"
                      >
                        <Square className="mr-2 h-4 w-4" />
                        Ferma Traduzione
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Seleziona un processo per iniziare
                </p>
              )}
            </CardContent>
          </Card>

          {/* Live Traduzioni */}
          <Card>
            <CardHeader>
              <CardTitle>Traduzioni in Tempo Reale</CardTitle>
            </CardHeader>
            <CardContent>
              {translations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {isInjecting 
                    ? "In attesa di testi da tradurre..." 
                    : "Avvia la traduzione per vedere i risultati"}
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {translations.map((trans, index) => (
                    <div key={index} className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium mb-1">
                        🇬🇧 {trans.original}
                      </p>
                      <p className="text-sm text-primary">
                        🇮🇹 {trans.translated}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(trans.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Info POC */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-0.5">POC</Badge>
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">
                <strong>Nota:</strong> Questo è un Proof of Concept che simula il funzionamento 
                dell'Injekt-Translator. Nella versione finale:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>I processi saranno reali giochi in esecuzione sul sistema</li>
                <li>L'iniezione intercetterà effettivamente i testi del gioco</li>
                <li>Le traduzioni saranno applicate in tempo reale nel gioco</li>
                <li>Supporto per molteplici API di traduzione AI</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
