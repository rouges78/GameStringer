'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Eye,
  Search,
  Download,
  Upload,
  Trash2,
  Languages,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInjektTranslator, ProcessInfo, InjectionConfig } from '@/lib/injekt-translator';

export default function InjektTranslatorPage() {
  const { stats, translations, findProcesses, startInjection, stopInjection, clearCache, exportCache, importCache } = useInjektTranslator();
  
  const [availableProcesses, setAvailableProcesses] = useState<ProcessInfo[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<string>('it');
  const [provider, setProvider] = useState<'openai' | 'deepl' | 'google'>('openai');
  const [apiKey, setApiKey] = useState<string>('');
  const [hookMode, setHookMode] = useState<'aggressive' | 'safe' | 'minimal'>('safe');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [showConfig, setShowConfig] = useState(false);

  // Scan for game processes
  const scanForProcesses = async () => {
    setIsScanning(true);
    setError('');
    try {
      const processes = await findProcesses();
      setAvailableProcesses(processes);
      if (processes.length === 0) {
        setError('Nessun gioco in esecuzione trovato. Avvia un gioco e riprova.');
      }
    } catch (err) {
      setError('Errore durante la scansione dei processi');
    } finally {
      setIsScanning(false);
    }
  };

  // Start injection
  const handleStartInjection = async () => {
    if (!selectedProcess || !apiKey) {
      setError('Seleziona un processo e inserisci la chiave API');
      return;
    }

    const config: InjectionConfig = {
      targetProcess: selectedProcess,
      targetLanguage,
      provider,
      apiKey,
      hookMode,
      cacheEnabled: true
    };

    const success = await startInjection(config);
    if (!success) {
      setError('Errore durante l\'injection. Verifica che il gioco sia in esecuzione.');
    }
  };

  // Export cache to file
  const handleExportCache = () => {
    const cache = exportCache();
    const blob = new Blob([JSON.stringify(cache, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `injekt-cache-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // Import cache from file
  const handleImportCache = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        importCache(data);
        setError('');
      } catch (err) {
        setError('Errore durante l\'importazione della cache');
      }
    };
    reader.readAsText(file);
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500';
  };

  const getStatusText = (isActive: boolean) => {
    return isActive ? 'Attivo' : 'Inattivo';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Injekt-Translator</h1>
          <p className="text-muted-foreground">Sistema di traduzione in tempo reale con memory injection</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge className={getStatusColor(stats.isActive)}>
            <Activity className="h-3 w-3 mr-1" />
            {getStatusText(stats.isActive)}
          </Badge>
        </div>
      </div>

      {/* Warning */}
      <Alert className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-900/20">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Funzionalità Sperimentale:</strong> L'Injekt-Translator utilizza tecniche avanzate di memory injection. 
          Usa questa funzione solo con giochi di cui possiedi una copia legale.
        </AlertDescription>
      </Alert>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Process Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Monitor className="h-5 w-5" />
              <span>Selezione Processo</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={scanForProcesses}
              disabled={isScanning || stats.isActive}
            >
              {isScanning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Scansione...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Cerca Giochi
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Processo Gioco</Label>
            <Select 
              value={selectedProcess} 
              onValueChange={setSelectedProcess}
              disabled={stats.isActive}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona un processo di gioco..." />
              </SelectTrigger>
              <SelectContent>
                {availableProcesses.map(process => (
                  <SelectItem key={process.pid} value={process.name}>
                    {process.windowTitle || process.name} (PID: {process.pid})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Configuration Toggle */}
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
              className="w-full justify-between"
            >
              <span className="flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                Configurazione Avanzata
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
            </Button>
          </div>

          {/* Advanced Configuration */}
          <AnimatePresence>
            {showConfig && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <Label>Lingua di Destinazione</Label>
                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                        <SelectItem value="es">🇪🇸 Spagnolo</SelectItem>
                        <SelectItem value="fr">🇫🇷 Francese</SelectItem>
                        <SelectItem value="de">🇩🇪 Tedesco</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Provider AI</Label>
                    <Select value={provider} onValueChange={(v: any) => setProvider(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI GPT-4</SelectItem>
                        <SelectItem value="deepl">DeepL</SelectItem>
                        <SelectItem value="google">Google Translate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>API Key</Label>
                    <Input 
                      type="password" 
                      placeholder="Inserisci la tua API key..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Modalità Hook</Label>
                    <Select value={hookMode} onValueChange={(v: any) => setHookMode(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minimal">Minimale (Solo UI)</SelectItem>
                        <SelectItem value="safe">Sicura (Consigliata)</SelectItem>
                        <SelectItem value="aggressive">Aggressiva (Tutti i testi)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Control Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            {!stats.isActive ? (
              <Button 
                onClick={handleStartInjection} 
                disabled={!selectedProcess || !apiKey}
                className="min-w-[140px]"
              >
                <Play className="h-4 w-4 mr-2" />
                Avvia Injection
              </Button>
            ) : (
              <Button 
                onClick={stopInjection} 
                variant="destructive"
                className="min-w-[140px]"
              >
                <Square className="h-4 w-4 mr-2" />
                Ferma Injection
              </Button>
            )}

            <div className="flex items-center space-x-2">
              <Button variant="outline" size="icon" onClick={clearCache} title="Pulisci Cache">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleExportCache} title="Esporta Cache">
                <Download className="h-4 w-4" />
              </Button>
              <label>
                <Button variant="outline" size="icon" asChild title="Importa Cache">
                  <span>
                    <Upload className="h-4 w-4" />
                  </span>
                </Button>
                <input 
                  type="file" 
                  accept=".json"
                  className="hidden"
                  onChange={handleImportCache}
                />
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {stats.isActive && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Processo</p>
                  <p className="text-lg font-semibold truncate">{stats.currentProcess?.name || 'N/A'}</p>
                </div>
                <Monitor className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Hook Attivi</p>
                  <div className="text-2xl font-bold">{stats.activeHooks}</div>
                </div>
                <Zap className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Traduzioni</p>
                  <div className="text-2xl font-bold">{stats.translationsApplied}</div>
                </div>
                <Languages className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cache</p>
                  <div className="text-2xl font-bold">{stats.cachedTranslations}</div>
                </div>
                <FileText className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Live Translation Feed */}
      {stats.isActive && translations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Feed Traduzioni Live</span>
                </div>
                <Badge variant="secondary">{translations.length} traduzioni recenti</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {translations.map((translation, index) => (
                  <motion.div
                    key={`${translation.address}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{translation.address}</code>
                      <span className="text-xs text-muted-foreground">
                        {new Date(translation.timestamp).toLocaleTimeString('it-IT')}
                      </span>
                    </div>
                    
                    <div className="text-sm">
                      <p className="text-primary">{translation.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Instructions when inactive */}
      {!stats.isActive && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Come Funziona l'Injekt-Translator</h3>
              <div className="text-sm text-muted-foreground space-y-2 max-w-2xl mx-auto">
                <p>1. <strong>Avvia il gioco</strong> che vuoi tradurre</p>
                <p>2. <strong>Cerca i processi</strong> cliccando su "Cerca Giochi"</p>
                <p>3. <strong>Seleziona il processo</strong> del gioco dalla lista</p>
                <p>4. <strong>Configura le opzioni</strong> di traduzione (lingua, API, modalità)</p>
                <p>5. <strong>Avvia l'injection</strong> per iniziare la traduzione in tempo reale</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Missing import
import { ChevronDown } from 'lucide-react';
