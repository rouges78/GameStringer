
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, 
  Play, 
  Square, 
  Activity, 
  Cpu, 
  FileText, 
  Settings,
  Monitor,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Eye
} from 'lucide-react';
import { motion } from 'framer-motion';
import { mockGames } from '@/lib/mock-data';

interface InjectionStatus {
  isActive: boolean;
  gameProcess: string;
  translationsApplied: number;
  memoryPatches: number;
  hookPoints: number;
  status: 'idle' | 'injecting' | 'hooked' | 'active' | 'error';
}

interface MemoryPatch {
  id: string;
  address: string;
  originalText: string;
  translatedText: string;
  status: 'pending' | 'applied' | 'failed';
  timestamp: Date;
}

export default function RealtimePage() {
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [injectionStatus, setInjectionStatus] = useState<InjectionStatus>({
    isActive: false,
    gameProcess: '',
    translationsApplied: 0,
    memoryPatches: 0,
    hookPoints: 0,
    status: 'idle'
  });
  
  const [memoryPatches, setMemoryPatches] = useState<MemoryPatch[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);

  const [games] = useState(mockGames.filter(g => g.isInstalled));

  // Simulate real-time monitoring
  useEffect(() => {
    if (isMonitoring) {
      const interval = setInterval(() => {
        setCpuUsage(Math.random() * 30 + 10);
        setMemoryUsage(Math.random() * 40 + 20);
        
        // Simulate new translations being applied
        if (injectionStatus.isActive && Math.random() > 0.7) {
          setInjectionStatus(prev => ({
            ...prev,
            translationsApplied: prev.translationsApplied + 1
          }));
          
          // Add new memory patch
          const newPatch: MemoryPatch = {
            id: `patch_${Date.now()}`,
            address: `0x${Math.random().toString(16).substr(2, 8).toUpperCase()}`,
            originalText: "Sample text found in memory",
            translatedText: "Testo di esempio trovato in memoria",
            status: 'applied',
            timestamp: new Date()
          };
          
          setMemoryPatches(prev => [newPatch, ...prev.slice(0, 9)]);
        }
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [isMonitoring, injectionStatus.isActive]);

  const startInjection = async () => {
    if (!selectedGame) return;
    
    setInjectionStatus(prev => ({ ...prev, status: 'injecting', gameProcess: selectedGame.executablePath }));
    
    // Simulate injection process
    await new Promise(resolve => setTimeout(resolve, 1000));
    setInjectionStatus(prev => ({ ...prev, status: 'hooked', hookPoints: 5 }));
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    setInjectionStatus(prev => ({ 
      ...prev, 
      status: 'active', 
      isActive: true,
      memoryPatches: 0,
      translationsApplied: 0
    }));
    
    setIsMonitoring(true);
  };

  const stopInjection = () => {
    setInjectionStatus({
      isActive: false,
      gameProcess: '',
      translationsApplied: 0,
      memoryPatches: 0,
      hookPoints: 0,
      status: 'idle'
    });
    setIsMonitoring(false);
    setMemoryPatches([]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'bg-gray-500/10 text-gray-500';
      case 'injecting': return 'bg-yellow-500/10 text-yellow-500';
      case 'hooked': return 'bg-blue-500/10 text-blue-500';
      case 'active': return 'bg-green-500/10 text-green-500';
      case 'error': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'idle': return 'Inattivo';
      case 'injecting': return 'Injection in corso...';
      case 'hooked': return 'Hook applicati';
      case 'active': return 'Attivo';
      case 'error': return 'Errore';
      default: return 'Sconosciuto';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Modalità Tempo Reale</h1>
          <p className="text-muted-foreground">Sistema di traduzione live con memory injection simulato</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge className={getStatusColor(injectionStatus.status)}>
            <Activity className="h-3 w-3 mr-1" />
            {getStatusText(injectionStatus.status)}
          </Badge>
        </div>
      </div>

      {/* Warning */}
      <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-900/20">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Modalità Sperimentale</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Questa funzionalità è in fase di prototipo e simula le tecnologie RAI-PAL per l'injection in memoria. 
                Assicurati di aver fatto un backup prima di procedere.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Game Selection & Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Configurazione Injection</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Gioco Target</label>
              <Select 
                value={selectedGame?.id || ''} 
                onValueChange={(gameId) => {
                  const game = games.find(g => g.id === gameId);
                  setSelectedGame(game);
                }}
                disabled={injectionStatus.isActive}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona gioco installato..." />
                </SelectTrigger>
                <SelectContent>
                  {games.map(game => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Processo Target</label>
              <div className="flex items-center space-x-2">
                <div className="flex-1 p-2 bg-muted/50 rounded text-sm">
                  {selectedGame?.executablePath || 'Nessun processo selezionato'}
                </div>
                <Button variant="outline" size="icon" disabled>
                  <Monitor className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-4">
              {!injectionStatus.isActive ? (
                <Button 
                  onClick={startInjection} 
                  disabled={!selectedGame}
                  className="min-w-[120px]"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Avvia Injection
                </Button>
              ) : (
                <Button 
                  onClick={stopInjection} 
                  variant="destructive"
                  className="min-w-[120px]"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Ferma Injection
                </Button>
              )}
            </div>
            
            {injectionStatus.gameProcess && (
              <div className="text-sm text-muted-foreground">
                Processo: {injectionStatus.gameProcess.split('\\').pop()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Overview */}
      {injectionStatus.status !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Hook Points</p>
                  <div className="text-2xl font-bold">{injectionStatus.hookPoints}</div>
                </div>
                <Zap className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Traduzioni</p>
                  <div className="text-2xl font-bold">{injectionStatus.translationsApplied}</div>
                </div>
                <FileText className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">CPU Usage</p>
                  <div className="text-2xl font-bold">{cpuUsage.toFixed(1)}%</div>
                </div>
                <Cpu className="h-8 w-8 text-orange-500" />
              </div>
              <Progress value={cpuUsage} className="mt-2 h-1" />
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Memory</p>
                  <div className="text-2xl font-bold">{memoryUsage.toFixed(1)}%</div>
                </div>
                <Activity className="h-8 w-8 text-purple-500" />
              </div>
              <Progress value={memoryUsage} className="mt-2 h-1" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Injection Process Simulation */}
      {injectionStatus.status === 'injecting' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <span>Injection in Corso</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Attaching al processo...</span>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Scanning memoria per stringhe...</span>
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-sm">Applicando hook API...</span>
                  <div className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-sm">Inizializzando traduttore live...</span>
                  <div className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Live Translation Feed */}
      {injectionStatus.isActive && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Feed Traduzioni Live</span>
                <Badge variant="secondary">{memoryPatches.length} patch attive</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memoryPatches.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {memoryPatches.map((patch, index) => (
                    <motion.div
                      key={patch.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-3 border rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded">{patch.address}</code>
                          <Badge variant={patch.status === 'applied' ? 'default' : 'secondary'}>
                            {patch.status}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {patch.timestamp.toLocaleTimeString('it-IT')}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground mb-1">Originale:</p>
                          <p className="bg-muted/50 p-2 rounded">{patch.originalText}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Tradotto:</p>
                          <p className="bg-primary/5 p-2 rounded">{patch.translatedText}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    In attesa di rilevamento testi nel gioco...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Monitor className="h-5 w-5" />
                <span>Monitor Sistema</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>CPU Usage</span>
                  <span>{cpuUsage.toFixed(1)}%</span>
                </div>
                <Progress value={cpuUsage} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Memory Usage</span>
                  <span>{memoryUsage.toFixed(1)}%</span>
                </div>
                <Progress value={memoryUsage} className="h-2" />
              </div>
              
              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span>Hook Status</span>
                  <Badge variant="default">Attivo</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>API Intercepted</span>
                  <span>DrawText, TextOut, ExtTextOut</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Translation Engine</span>
                  <Badge variant="secondary">AI Real-time</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Response Time</span>
                  <span>~120ms</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Idle State */}
      {injectionStatus.status === 'idle' && (
        <Card>
          <CardContent className="p-12 text-center">
            <Zap className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Modalità Tempo Reale Inattiva</h3>
            <p className="text-muted-foreground mb-6">
              Seleziona un gioco installato e avvia l'injection per tradurre in tempo reale.
            </p>
            <Button 
              onClick={startInjection} 
              disabled={!selectedGame}
              size="lg"
            >
              <Play className="h-5 w-5 mr-2" />
              Avvia Traduzione Live
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
