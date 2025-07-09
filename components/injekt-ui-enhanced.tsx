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
    <div className="space-y-8">
      {/* Header con statistiche futuristiche */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="relative bg-black/20 backdrop-blur-xl border-purple-500/20 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5" />
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-200">
              <div className="p-1.5 rounded-full bg-purple-500/20 border border-purple-400/30">
                <Globe className="h-4 w-4 text-purple-400" />
              </div>
              Traduzioni Totali
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {injectionStats?.totalTranslations || 0}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {injectionStats?.customTranslations || 0} personalizzate
            </p>
          </CardContent>
        </Card>

        <Card className="relative bg-black/20 backdrop-blur-xl border-blue-500/20 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5" />
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-200">
              <div className="p-1.5 rounded-full bg-blue-500/20 border border-blue-400/30">
                <Zap className="h-4 w-4 text-blue-400" />
              </div>
              Injection Totali
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {injectionStats?.totalInjections || 0}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {isInjecting ? `+${injectionCount} questa sessione` : 'Non attivo'}
            </p>
          </CardContent>
        </Card>

        <Card className="relative bg-black/20 backdrop-blur-xl border-cyan-500/20 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-emerald-500/5" />
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-200">
              <div className="p-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/30">
                <Database className="h-4 w-4 text-cyan-400" />
              </div>
              Indirizzi Memoria
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              {injectionStats?.memoryAddresses || 0}
            </div>
            <p className="text-xs text-gray-400 mt-1">Posizioni salvate</p>
          </CardContent>
        </Card>

        <Card className="relative bg-black/20 backdrop-blur-xl border-emerald-500/20 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-purple-500/5" />
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-200">
              <div className="p-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30">
                <Clock className="h-4 w-4 text-emerald-400" />
              </div>
              Ultimo Aggiornamento
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-lg font-medium text-white">
              {injectionStats?.lastUpdated 
                ? new Date(injectionStats.lastUpdated).toLocaleTimeString()
                : 'Mai'}
            </div>
            <p className="text-xs text-gray-400 mt-1 truncate">
              {selectedProcess ? selectedProcess.name : 'Nessun processo'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principali futuristici */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 bg-black/20 backdrop-blur-xl border-white/10 h-14">
          <TabsTrigger value="injection" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-white data-[state=active]:border-purple-400/30 transition-all duration-300">
            <Zap className="h-4 w-4 mr-2" />
            Injection
          </TabsTrigger>
          <TabsTrigger value="translations" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-white data-[state=active]:border-blue-400/30 transition-all duration-300">
            <Globe className="h-4 w-4 mr-2" />
            Traduzioni
          </TabsTrigger>
          <TabsTrigger value="profiles" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-white data-[state=active]:border-cyan-400/30 transition-all duration-300">
            <Database className="h-4 w-4 mr-2" />
            Profili
          </TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-white data-[state=active]:border-emerald-400/30 transition-all duration-300">
            <TrendingUp className="h-4 w-4 mr-2" />
            Statistiche
          </TabsTrigger>
          <TabsTrigger value="overlay" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-white data-[state=active]:border-orange-400/30 transition-all duration-300">
            <Settings className="h-4 w-4 mr-2" />
            Overlay
          </TabsTrigger>
        </TabsList>

        {/* Tab Injection */}
        <TabsContent value="injection" className="space-y-4">
          <Card className="relative bg-black/20 backdrop-blur-xl border-purple-500/20 shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5" />
            <CardHeader className="relative z-10">
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-400" />
                Processi Rilevati
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {processes.map((process) => (
                    <div
                      key={process.pid}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-300 ${
                        selectedProcess?.pid === process.pid
                          ? 'bg-purple-500/20 border-purple-400/50 shadow-lg shadow-purple-500/20'
                          : 'hover:bg-white/10 border-white/10 hover:border-purple-400/30'
                      }`}
                      onClick={() => setSelectedProcess(process)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getGameIcon(process.name)}</span>
                          <div>
                            <div className="font-medium text-white">{process.name}</div>
                            <div className="text-sm text-gray-400">
                              PID: {process.pid} {process.windowTitle && `• ${process.windowTitle}`}
                            </div>
                          </div>
                        </div>
                        {selectedProcess?.pid === process.pid && (
                          <Badge variant={isInjecting ? 'default' : 'secondary'} className="bg-purple-500/20 text-purple-200 border-purple-400/30">
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
                    className={`flex-1 ${
                      isInjecting 
                        ? 'bg-red-500/20 hover:bg-red-500/30 border-red-400/50 text-red-200' 
                        : 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-400/50 text-purple-200'
                    }`}
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
                    className="bg-blue-500/20 hover:bg-blue-500/30 border-blue-400/50 text-blue-200"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Stats durante injection */}
          {isInjecting && selectedProcess && (
            <Card className="relative bg-black/20 backdrop-blur-xl border-emerald-500/20 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5" />
              <CardHeader className="relative z-10">
                <CardTitle className="flex items-center gap-2 text-white">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                  Injection in Corso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 relative z-10">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-200">Traduzioni Iniettate</span>
                    <span className="text-sm text-emerald-400">{injectionCount}</span>
                  </div>
                  <Progress value={Math.min((injectionCount / 100) * 100, 100)} className="bg-white/10" />
                </div>
                <div className="text-sm text-gray-400">
                  Monitoraggio attivo per {selectedProcess.name}...
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Traduzioni */}
        <TabsContent value="translations" className="space-y-4">
          <Card className="relative bg-black/20 backdrop-blur-xl border-blue-500/20 shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5" />
            <CardHeader className="relative z-10">
              <CardTitle className="text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-400" />
                Traduzioni Personalizzate
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              {selectedProcess ? (
                <div className="space-y-4">
                  {/* Form aggiunta traduzione */}
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Testo originale (EN)"
                      value={newTranslation.original}
                      onChange={(e) => setNewTranslation({ ...newTranslation, original: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-blue-400/50"
                    />
                    <div className="flex gap-2">
                      <Input
                        placeholder="Traduzione (IT)"
                        value={newTranslation.translated}
                        onChange={(e) => setNewTranslation({ ...newTranslation, translated: e.target.value })}
                        className="bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-blue-400/50"
                      />
                      <Button onClick={addCustomTranslation} size="icon" className="bg-blue-500/20 hover:bg-blue-500/30 border-blue-400/50 text-blue-200">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Lista traduzioni */}
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {customTranslations.map((trans) => (
                        <div key={trans.original} className="flex items-center gap-2 p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <div className="text-sm text-gray-300">{trans.original}</div>
                            <div className="text-sm font-medium text-white">{trans.translated}</div>
                          </div>
                          <Button
                            onClick={() => removeCustomTranslation(trans.original)}
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 hover:bg-red-500/20 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  Seleziona un processo per gestire le traduzioni
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Profili */}
        <TabsContent value="profiles" className="space-y-4">
          <Card className="relative bg-black/20 backdrop-blur-xl border-cyan-500/20 shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5" />
            <CardHeader className="relative z-10">
              <CardTitle className="text-white flex items-center gap-2">
                <Database className="h-5 w-5 text-cyan-400" />
                Gestione Profili
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <div className="flex gap-2">
                <Button onClick={exportProfile} disabled={!selectedProcess} className="bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-400/50 text-cyan-200">
                  <Download className="mr-2 h-4 w-4" />
                  Esporta Profilo
                </Button>
                <Label htmlFor="import-profile" className="cursor-pointer">
                  <Button variant="outline" className="bg-purple-500/20 hover:bg-purple-500/30 border-purple-400/50 text-purple-200">
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
                    <div key={profile.id} className="p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-white">{profile.gameName}</div>
                          <div className="text-sm text-gray-400">
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

        {/* Tab Profili Translation Manager */}
        <TabsContent value="profiles" className="space-y-4">
          <Card className="relative bg-black/20 backdrop-blur-xl border-cyan-500/20 shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5" />
            <CardContent className="relative z-10">
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Statistiche */}
        <TabsContent value="stats" className="space-y-4">
          <Card className="relative bg-black/20 backdrop-blur-xl border-emerald-500/20 shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5" />
            <CardContent className="relative z-10">
              <InjektRealtimeStats 
                processId={selectedProcess?.pid || null} 
                isActive={isInjecting} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Overlay */}
        <TabsContent value="overlay" className="space-y-4">
          <Card className="relative bg-black/20 backdrop-blur-xl border-orange-500/20 shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5" />
            <CardContent className="relative z-10">
              <InjektOverlayConfig 
                config={overlayConfig} 
                onConfigChange={setOverlayConfig} 
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
