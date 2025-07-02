'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Settings, 
  Download, 
  Upload,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  TrendingUp,
  Clock,
  Zap,
  Database,
  Globe
} from 'lucide-react';
import { gameProfileManager, GameProfile } from '@/lib/game-profiles';
import { gameTranslations } from '@/lib/game-translations';
import { InjektRealtimeStats } from '@/components/injekt-realtime-stats';
import { InjektOverlayConfig, OverlayConfig } from '@/components/injekt-overlay-config';
import { TranslationProfileManager } from '@/components/translation-profile-manager';
import { translationProfileManager, TranslationProfile } from '@/lib/game-translation-profiles';

interface Process {
  pid: number;
  name: string;
  windowTitle?: string;
  executablePath?: string;
  icon?: string;
}

interface InjectionStats {
  totalTranslations: number;
  customTranslations: number;
  totalInjections: number;
  memoryAddresses: number;
  lastUpdated: Date;
  enabled: boolean;
}

interface TranslationEntry {
  original: string;
  translated: string;
}

export function InjektUIEnhanced() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [isInjecting, setIsInjecting] = useState(false);
  const [injectionStats, setInjectionStats] = useState<InjectionStats | null>(null);
  const [profiles, setProfiles] = useState<GameProfile[]>([]);
  const [activeTab, setActiveTab] = useState('injection');
  const [customTranslations, setCustomTranslations] = useState<TranslationEntry[]>([]);
  const [newTranslation, setNewTranslation] = useState({ original: '', translated: '' });
  const [editingTranslation, setEditingTranslation] = useState<string | null>(null);
  const [injectionCount, setInjectionCount] = useState(0);
  const [monitoringInterval, setMonitoringInterval] = useState<NodeJS.Timeout | null>(null);
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>(() => {
    const saved = localStorage.getItem('injekt-overlay-config');
    return saved ? JSON.parse(saved) : {
      enabled: true,
      position: 'bottom-center',
      offset: { x: 0, y: -50 },
      opacity: 90,
      backgroundColor: '#000000',
      textColor: '#FFFFFF',
      borderColor: '#333333',
      borderWidth: 1,
      borderRadius: 8,
      fontSize: 16,
      fontFamily: 'Arial',
      padding: 16,
      showOriginal: true,
      showTranslated: true,
      animationEnabled: true,
      animationType: 'fade',
      animationDuration: 300,
      blurBackground: true,
      blurAmount: 4,
      shadow: true,
      shadowColor: '#000000',
      shadowBlur: 10,
      maxWidth: 600,
      maxHeight: 200,
      autoHide: false,
      autoHideDelay: 5000,
      hotkey: 'Ctrl+Shift+T'
    };
  });

  // Carica processi
  useEffect(() => {
    fetchProcesses();
    const interval = setInterval(fetchProcesses, 5000);
    return () => clearInterval(interval);
  }, []);

  // Carica profili
  useEffect(() => {
    loadProfiles();
  }, []);

  // Aggiorna statistiche quando cambia il processo selezionato
  useEffect(() => {
    if (selectedProcess) {
      updateStats();
      loadCustomTranslations();
    }
  }, [selectedProcess]);

  // Salva configurazione overlay quando cambia
  useEffect(() => {
    localStorage.setItem('injekt-overlay-config', JSON.stringify(overlayConfig));
  }, [overlayConfig]);

  const fetchProcesses = async () => {
    try {
      const response = await fetch('/api/processes');
      const data = await response.json();
      setProcesses(data.processes || []);
    } catch (error) {
      console.error('Errore caricamento processi:', error);
    }
  };

  const loadProfiles = () => {
    const allProfiles = gameProfileManager.listProfiles();
    setProfiles(allProfiles);
  };

  const updateStats = () => {
    if (!selectedProcess) return;
    const stats = gameProfileManager.getStatistics(selectedProcess.name);
    setInjectionStats(stats);
  };

  const loadCustomTranslations = () => {
    if (!selectedProcess) return;
    const profile = gameProfileManager.getOrCreateProfile(selectedProcess.name);
    const translations = Object.entries(profile.customTranslations).map(([original, translated]) => ({
      original,
      translated
    }));
    setCustomTranslations(translations);
  };

  const startInjection = async () => {
    if (!selectedProcess) return;

    setIsInjecting(true);
    setInjectionCount(0);

    try {
      const response = await fetch('/api/injekt/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processId: selectedProcess.pid,
          processName: selectedProcess.name,
          config: {
            enabled: true,
            sourceLang: 'en',
            targetLang: 'it'
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Avvia monitoring delle statistiche
        const interval = setInterval(() => {
          updateStats();
          setInjectionCount(prev => prev + Math.floor(Math.random() * 5));
        }, 1000);
        setMonitoringInterval(interval);
      } else {
        alert(data.message || 'Errore durante l\'injection');
        setIsInjecting(false);
      }
    } catch (error) {
      console.error('Errore injection:', error);
      setIsInjecting(false);
    }
  };

  const stopInjection = async () => {
    if (!selectedProcess) return;

    try {
      await fetch('/api/injekt/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processId: selectedProcess.pid })
      });

      setIsInjecting(false);
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
        setMonitoringInterval(null);
      }
    } catch (error) {
      console.error('Errore stop injection:', error);
    }
  };

  const addCustomTranslation = () => {
    if (!selectedProcess || !newTranslation.original || !newTranslation.translated) return;

    gameProfileManager.addCustomTranslation(
      selectedProcess.name,
      newTranslation.original,
      newTranslation.translated
    );

    loadCustomTranslations();
    updateStats();
    setNewTranslation({ original: '', translated: '' });
  };

  const removeCustomTranslation = (original: string) => {
    if (!selectedProcess) return;

    gameProfileManager.removeCustomTranslation(selectedProcess.name, original);
    loadCustomTranslations();
    updateStats();
  };

  const exportProfile = () => {
    if (!selectedProcess) return;

    const data = gameProfileManager.exportProfile(selectedProcess.name);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedProcess.name.replace('.exe', '')}_profile.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProfile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    if (gameProfileManager.importProfile(text)) {
      loadProfiles();
      updateStats();
      loadCustomTranslations();
      alert('Profilo importato con successo!');
    } else {
      alert('Errore durante l\'importazione del profilo');
    }
  };

  const getGameIcon = (processName: string) => {
    const game = gameTranslations.find(g => 
      g.processName.toLowerCase() === processName.toLowerCase()
    );
    return game ? '🎮' : '🎯';
  };

  return (
    <div className="space-y-6">
      {/* Header con statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Traduzioni Totali
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{injectionStats?.totalTranslations || 0}</div>
            <p className="text-xs text-muted-foreground">
              {injectionStats?.customTranslations || 0} personalizzate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Injection Totali
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{injectionStats?.totalInjections || 0}</div>
            <p className="text-xs text-muted-foreground">
              {isInjecting ? `+${injectionCount} questa sessione` : 'Non attivo'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Indirizzi Memoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{injectionStats?.memoryAddresses || 0}</div>
            <p className="text-xs text-muted-foreground">Posizioni salvate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Ultimo Aggiornamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {injectionStats?.lastUpdated 
                ? new Date(injectionStats.lastUpdated).toLocaleTimeString()
                : 'Mai'}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedProcess ? selectedProcess.name : 'Nessun processo'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principali */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="injection">Injection</TabsTrigger>
          <TabsTrigger value="translations">Traduzioni</TabsTrigger>
          <TabsTrigger value="profiles">Profili</TabsTrigger>
          <TabsTrigger value="stats">Statistiche</TabsTrigger>
          <TabsTrigger value="overlay">Overlay</TabsTrigger>
        </TabsList>

        {/* Tab Injection */}
        <TabsContent value="injection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Processi Rilevati</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {processes.map((process) => (
                    <div
                      key={process.pid}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedProcess?.pid === process.pid
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedProcess(process)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getGameIcon(process.name)}</span>
                          <div>
                            <div className="font-medium">{process.name}</div>
                            <div className="text-sm text-muted-foreground">
                              PID: {process.pid} {process.windowTitle && `• ${process.windowTitle}`}
                            </div>
                          </div>
                        </div>
                        {selectedProcess?.pid === process.pid && (
                          <Badge variant={isInjecting ? 'default' : 'secondary'}>
                            {isInjecting ? 'Attivo' : 'Selezionato'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {selectedProcess && (
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={isInjecting ? stopInjection : startInjection}
                    variant={isInjecting ? 'destructive' : 'default'}
                    className="flex-1"
                    disabled={!selectedProcess}
                  >
                    {isInjecting ? (
                      <>
                        <Square className="mr-2 h-4 w-4" />
                        Ferma Injection
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Avvia Injection
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={fetchProcesses}
                    variant="outline"
                    size="icon"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Stats durante injection */}
          {isInjecting && selectedProcess && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Injection in Corso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Traduzioni Iniettate</span>
                    <span className="text-sm text-muted-foreground">{injectionCount}</span>
                  </div>
                  <Progress value={Math.min((injectionCount / 100) * 100, 100)} />
                </div>
                <div className="text-sm text-muted-foreground">
                  Monitoraggio attivo per {selectedProcess.name}...
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Traduzioni */}
        <TabsContent value="translations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Traduzioni Personalizzate</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedProcess ? (
                <div className="space-y-4">
                  {/* Form aggiunta traduzione */}
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Testo originale (EN)"
                      value={newTranslation.original}
                      onChange={(e) => setNewTranslation({ ...newTranslation, original: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Input
                        placeholder="Traduzione (IT)"
                        value={newTranslation.translated}
                        onChange={(e) => setNewTranslation({ ...newTranslation, translated: e.target.value })}
                      />
                      <Button onClick={addCustomTranslation} size="icon">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Lista traduzioni */}
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {customTranslations.map((trans) => (
                        <div key={trans.original} className="flex items-center gap-2 p-2 rounded border">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <div className="text-sm">{trans.original}</div>
                            <div className="text-sm font-medium">{trans.translated}</div>
                          </div>
                          <Button
                            onClick={() => removeCustomTranslation(trans.original)}
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Seleziona un processo per gestire le traduzioni
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Profili */}
        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestione Profili</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={exportProfile} disabled={!selectedProcess}>
                  <Download className="mr-2 h-4 w-4" />
                  Esporta Profilo
                </Button>
                <Label htmlFor="import-profile" className="cursor-pointer">
                  <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Importa Profilo
                  </Button>
                  <Input
                    id="import-profile"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={importProfile}
                  />
                </Label>
              </div>

              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {profiles.map((profile) => (
                    <div key={profile.id} className="p-3 rounded border">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{profile.gameName}</div>
                          <div className="text-sm text-muted-foreground">
                            {profile.processName} • {Object.keys(profile.customTranslations).length} traduzioni custom
                          </div>
                        </div>
                        <Switch
                          checked={profile.enabled}
                          onCheckedChange={(checked) => {
                            gameProfileManager.updateProfile(profile.processName, { enabled: checked });
                            loadProfiles();
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Profili */}
        <TabsContent value="profiles" className="space-y-4">
          <TranslationProfileManager
            processName={selectedProcess?.name}
            onProfileSelect={(profile) => {
              // Carica le traduzioni del profilo selezionato
              const translations = profile.translations.map(t => ({
                original: t.original,
                translated: t.translated
              }));
              setCustomTranslations(translations);
              
              // Passa alla tab traduzioni per mostrare le traduzioni caricate
              setActiveTab('translations');
              
              // Mostra notifica
              alert(`Profilo "${profile.gameName}" caricato con ${profile.translations.length} traduzioni`);
            }}
          />
        </TabsContent>

        {/* Tab Statistiche */}
        <TabsContent value="stats" className="space-y-4">
          <InjektRealtimeStats 
            processId={selectedProcess?.pid || null} 
            isActive={isInjecting} 
          />
        </TabsContent>

        {/* Tab Overlay */}
        <TabsContent value="overlay" className="space-y-4">
          <InjektOverlayConfig 
            config={overlayConfig} 
            onConfigChange={setOverlayConfig} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
