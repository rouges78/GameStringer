
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { 
  Settings as SettingsIcon, 
  Save, 
  RotateCcw, 
  Cpu, 
  HardDrive, 
  Shield,
  Bell,
  Languages,
  Folder,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  User,
  Key,
  Globe,
  Zap,
  Database,
  Gamepad2,
  Brain,
  FolderOpen,
  Trash2,
  Plus,
  Monitor,
  Palette,
  Volume2,
  Eye,
  EyeOff
} from 'lucide-react';

interface Settings {
  apiKeys: {
    openai: string;
    anthropic: string;
    google: string;
    deepl: string;
    azure: string;
  };
  translation: {
    provider: string;
    model: string;
    defaultSourceLang: string;
    defaultTargetLang: string;
    temperature: number;
    maxTokens: number;
    contextWindow: number;
    preserveFormatting: boolean;
    glossaryEnabled: boolean;
    cacheTranslations: boolean;
    batchSize: number;
  };
  injekt: {
    enabled: boolean;
    autoStart: boolean;
    hotkeyToggle: string;
    hotkeyPause: string;
    overlayOpacity: number;
    overlayPosition: string;
    fontSize: number;
    updateInterval: number;
    processWhitelist: string[];
    processBlacklist: string[];
    experimentalFeatures: boolean;
  };
  steam: {
    autoDetectPath: boolean;
    customSteamPath: string;
    scanOnStartup: boolean;
    includeNonSteamGames: boolean;
    downloadMetadata: boolean;
    cacheImages: boolean;
    updateInterval: number;
  };
  system: {
    language: string;
    theme: string;
    autoBackup: boolean;
    backupInterval: number;
    backupLocation: string;
    maxBackups: number;
    autoUpdate: boolean;
    betaChannel: boolean;
    hardwareAcceleration: boolean;
    logLevel: string;
    telemetry: boolean;
  };
  performance: {
    maxCpuUsage: number;
    maxMemoryUsage: number;
    gpuAcceleration: boolean;
    multiThreading: boolean;
    cacheSize: number;
    clearCacheOnExit: boolean;
  };
  directories: string[];
  backupDirectory: string;
  patchDirectory: string;
  excludePatterns: string[];
  maxConcurrentTranslations: number;
  apiTimeout: number;
  retryAttempts: number;
  notifyTranslationComplete: boolean;
  notifyPatchReady: boolean;
  notifyErrors: boolean;
  notifyUpdates: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    // API Keys
    apiKeys: {
      openai: '',
      anthropic: '',
      google: '',
      deepl: '',
      azure: ''
    },
    
    // AI Translation Settings
    translation: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      defaultSourceLang: 'auto',
      defaultTargetLang: 'it',
      temperature: 0.3,
      maxTokens: 2000,
      contextWindow: 5,
      preserveFormatting: true,
      glossaryEnabled: true,
      cacheTranslations: true,
      batchSize: 50
    },
    
    // Injekt-Translator Settings
    injekt: {
      enabled: true,
      autoStart: false,
      hotkeyToggle: 'Ctrl+Shift+T',
      hotkeyPause: 'Ctrl+Shift+P',
      overlayOpacity: 0.9,
      overlayPosition: 'bottom',
      fontSize: 14,
      updateInterval: 100,
      processWhitelist: [],
      processBlacklist: ['chrome.exe', 'firefox.exe'],
      experimentalFeatures: false
    },
    
    // Steam Integration
    steam: {
      autoDetectPath: true,
      customSteamPath: '',
      scanOnStartup: true,
      includeNonSteamGames: false,
      downloadMetadata: true,
      cacheImages: true,
      updateInterval: 24
    },
    
    // System Settings
    system: {
      language: 'it',
      theme: 'dark',
      autoBackup: true,
      backupInterval: 24,
      backupLocation: 'C:\\GameStringer\\Backups',
      maxBackups: 10,
      autoUpdate: true,
      betaChannel: false,
      hardwareAcceleration: true,
      logLevel: 'info',
      telemetry: false
    },
    
    // Performance
    performance: {
      maxCpuUsage: 80,
      maxMemoryUsage: 2048,
      gpuAcceleration: true,
      multiThreading: true,
      cacheSize: 500,
      clearCacheOnExit: false
    },
    
    // Directories
    directories: [
      'C:\\Program Files (x86)\\Steam\\steamapps',
      'C:\\Program Files\\Epic Games',
      'C:\\Program Files (x86)\\GOG Galaxy\\Games'
    ],
    backupDirectory: 'C:\\GameStringer\\Backups',
    patchDirectory: 'C:\\GameStringer\\Patches',
    
    // Advanced
    excludePatterns: ['*.log', '*.tmp', '*.cache'],
    maxConcurrentTranslations: 5,
    apiTimeout: 30000,
    retryAttempts: 3,
    
    // Notifications
    notifyTranslationComplete: true,
    notifyPatchReady: true,
    notifyErrors: true,
    notifyUpdates: false
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<{ [key: string]: boolean }>({});

  // Carica impostazioni salvate
  useEffect(() => {
    const savedSettings = localStorage.getItem('gameStringerSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Errore nel caricamento delle impostazioni:', error);
      }
    }
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Salva le impostazioni nel localStorage
      localStorage.setItem('gameStringerSettings', JSON.stringify(settings));
      
      // Simula salvataggio su server
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Impostazioni salvate",
        description: "Le tue preferenze sono state salvate con successo.",
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetSettings = () => {
    if (confirm('Sei sicuro di voler ripristinare le impostazioni predefinite?')) {
      localStorage.removeItem('gameStringerSettings');
      window.location.reload();
    }
  };

  const updateSetting = (category: keyof Settings | 'root', key: string, value: any) => {
    setSettings(prev => {
      if (category === 'root') {
        return { ...prev, [key]: value };
      }
      
      const categoryData = prev[category];
      if (typeof categoryData === 'object' && !Array.isArray(categoryData)) {
        return {
          ...prev,
          [category]: {
            ...categoryData,
            [key]: value
          }
        };
      }
      
      return prev;
    });
  };

  const addDirectory = () => {
    const newDir = prompt('Inserisci il percorso della directory:');
    if (newDir) {
      setSettings(prev => ({
        ...prev,
        directories: [...prev.directories, newDir]
      }));
    }
  };

  const removeDirectory = (index: number) => {
    setSettings(prev => ({
      ...prev,
      directories: prev.directories.filter((_, i) => i !== index)
    }));
  };

  const addExcludePattern = () => {
    const pattern = prompt('Inserisci il pattern da escludere (es. *.log):');
    if (pattern) {
      setSettings(prev => ({
        ...prev,
        excludePatterns: [...prev.excludePatterns, pattern]
      }));
    }
  };

  const removeExcludePattern = (index: number) => {
    setSettings(prev => ({
      ...prev,
      excludePatterns: prev.excludePatterns.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Impostazioni</h1>
          <p className="text-muted-foreground">Configura il sistema di traduzione e le preferenze</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={resetSettings}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={saveSettings} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salva
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="ai" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="ai">AI & Traduzione</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
          <TabsTrigger value="directories">Directory</TabsTrigger>
          <TabsTrigger value="advanced">Avanzate</TabsTrigger>
          <TabsTrigger value="notifications">Notifiche</TabsTrigger>
          <TabsTrigger value="accounts">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-4">
          {/* API Keys Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5" />
                <span>API Keys</span>
              </CardTitle>
              <CardDescription>
                Configura le chiavi API per i vari servizi di traduzione AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {Object.entries(settings.apiKeys).map(([provider, key]) => (
                  <div key={provider}>
                    <label className="text-sm font-medium mb-2 block capitalize">
                      {provider} API Key
                    </label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type={showApiKeys[provider] ? "text" : "password"}
                        value={key}
                        onChange={(e) => updateSetting('apiKeys', provider, e.target.value)}
                        placeholder={`Inserisci la chiave API ${provider}`}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowApiKeys(prev => ({ ...prev, [provider]: !prev[provider] }))}
                      >
                        {showApiKeys[provider] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Le chiavi API sono salvate localmente. Assicurati di non condividere questi dati.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* AI Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5" />
                <span>Configurazione AI</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Provider AI</label>
                  <Select value={settings.translation.provider} onValueChange={(value) => updateSetting('translation', 'provider', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                      <SelectItem value="google">Google Gemini</SelectItem>
                      <SelectItem value="deepl">DeepL</SelectItem>
                      <SelectItem value="azure">Azure OpenAI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Lingua Default</label>
                  <Select value={settings.translation.defaultTargetLang} onValueChange={(value) => updateSetting('translation', 'defaultTargetLang', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">Italiano</SelectItem>
                      <SelectItem value="es">Spagnolo</SelectItem>
                      <SelectItem value="fr">Francese</SelectItem>
                      <SelectItem value="de">Tedesco</SelectItem>
                      <SelectItem value="pt">Portoghese</SelectItem>
                      <SelectItem value="ru">Russo</SelectItem>
                      <SelectItem value="ja">Giapponese</SelectItem>
                      <SelectItem value="ko">Coreano</SelectItem>
                      <SelectItem value="zh">Cinese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Temperature ({settings.translation.temperature})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.translation.temperature}
                    onChange={(e) => updateSetting('translation', 'temperature', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Max Tokens ({settings.translation.maxTokens})
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="4000"
                    step="100"
                    value={settings.translation.maxTokens}
                    onChange={(e) => updateSetting('translation', 'maxTokens', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Batch Size</label>
                  <Input
                    type="number"
                    value={settings.translation.batchSize}
                    onChange={(e) => updateSetting('translation', 'batchSize', parseInt(e.target.value))}
                    min="1"
                    max="500"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">System Prompt</label>
                <Textarea
                  defaultValue="You are a professional video game translator. Maintain context, tone, and gaming terminology."
                  onChange={(e) => updateSetting('translation', 'systemPrompt', e.target.value)}
                  className="min-h-[100px]"
                  placeholder="Prompt di sistema per l'AI..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Cpu className="h-5 w-5" />
                <span>Impostazioni Sistema</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Backup</h3>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.system.autoBackup}
                      onChange={(e) => updateSetting('system', 'autoBackup', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Backup automatico</span>
                  </label>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Intervallo Backup (ore)</label>
                    <Input
                      type="number"
                      value={settings.system.backupInterval}
                      onChange={(e) => updateSetting('system', 'backupInterval', parseInt(e.target.value))}
                      min="1"
                      max="168"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-semibold">Aggiornamenti</h3>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.system.autoUpdate}
                      onChange={(e) => updateSetting('system', 'autoUpdate', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Aggiornamenti automatici</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.injekt.enabled}
                      onChange={(e) => updateSetting('injekt', 'enabled', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Abilita Injekt-Translator</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Cache Size ({settings.performance.cacheSize} MB)
                </label>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={settings.performance.cacheSize}
                  onChange={(e) => updateSetting('performance', 'cacheSize', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="directories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Folder className="h-5 w-5" />
                <span>Directory di Scansione</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {settings.directories.map((dir: string, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm font-mono">{dir}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => removeDirectory(index)}
                    >
                      Rimuovi
                    </Button>
                  </div>
                ))}
              </div>
              <Button onClick={addDirectory} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi Directory
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <HardDrive className="h-5 w-5" />
                <span>Directory di Sistema</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Directory Backup</label>
                <Input
                  value={settings.backupDirectory}
                  onChange={(e) => updateSetting('root', 'backupDirectory', e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Directory Patch</label>
                <Input
                  value={settings.patchDirectory}
                  onChange={(e) => updateSetting('root', 'patchDirectory', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Impostazioni Avanzate</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Traduzioni Concorrenti</label>
                  <Input
                    type="number"
                    value={settings.maxConcurrentTranslations}
                    onChange={(e) => updateSetting('root', 'maxConcurrentTranslations', parseInt(e.target.value))}
                    min="1"
                    max="20"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Timeout API (ms)</label>
                  <Input
                    type="number"
                    value={settings.apiTimeout}
                    onChange={(e) => updateSetting('root', 'apiTimeout', parseInt(e.target.value))}
                    min="5000"
                    max="120000"
                    step="5000"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Tentativi Retry</label>
                  <Input
                    type="number"
                    value={settings.retryAttempts}
                    onChange={(e) => updateSetting('root', 'retryAttempts', parseInt(e.target.value))}
                    min="1"
                    max="10"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Pattern di Esclusione</label>
                <div className="space-y-2">
                  {settings.excludePatterns.map((pattern, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <Badge variant="secondary" className="font-mono">{pattern}</Badge>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => removeExcludePattern(index)}
                      >
                        Rimuovi
                      </Button>
                    </div>
                  ))}
                </div>
                <Button onClick={addExcludePattern} variant="outline" className="mt-2">
                  Aggiungi Pattern
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-900/20">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="h-5 w-5" />
                <span>Attenzione</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-yellow-700 dark:text-yellow-300">
              <p>Modificare le impostazioni avanzate può influire sulle prestazioni e sulla stabilità del sistema. Procedi solo se sai cosa stai facendo.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notifiche</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Traduzione Completata</div>
                    <div className="text-sm text-muted-foreground">Notifica quando una traduzione è completata</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifyTranslationComplete}
                    onChange={(e) => updateSetting('root', 'notifyTranslationComplete', e.target.checked)}
                    className="rounded"
                  />
                </label>
                
                <label className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Patch Pronta</div>
                    <div className="text-sm text-muted-foreground">Notifica quando una patch è pronta per l'export</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifyPatchReady}
                    onChange={(e) => updateSetting('root', 'notifyPatchReady', e.target.checked)}
                    className="rounded"
                  />
                </label>
                
                <label className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Errori</div>
                    <div className="text-sm text-muted-foreground">Notifica errori del sistema</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifyErrors}
                    onChange={(e) => updateSetting('root', 'notifyErrors', e.target.checked)}
                    className="rounded"
                  />
                </label>
                
                <label className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Aggiornamenti</div>
                    <div className="text-sm text-muted-foreground">Notifica aggiornamenti disponibili</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifyUpdates}
                    onChange={(e) => updateSetting('root', 'notifyUpdates', e.target.checked)}
                    className="rounded"
                  />
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Notifiche</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  Test Successo
                </Button>
                <Button variant="outline" size="sm">
                  <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                  Test Errore
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Account Collegati</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {
                  ['steam', 'epic', 'itchio'].map(provider => {
                    const isConnected = false; // Per ora non gestiamo sessioni
                    return (
                      <div key={provider} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Gamepad2 className="h-5 w-5" />
                          <span className="font-medium capitalize">{provider}</span>
                        </div>
                        {isConnected ? (
                          <Badge variant="default"><CheckCircle className="h-4 w-4 mr-1" />Connesso</Badge>
                        ) : (
                          <Badge variant="outline">Non Connesso</Badge>
                        )}
                      </div>
                    )
                  })
                }
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
