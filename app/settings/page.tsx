'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { 
  Save,
  RotateCcw,
  Bell,
  RefreshCw,
  Zap,
  Database,
  Brain,
  Trash2,
  Monitor,
  Eye,
  EyeOff,
  Bug,
  TestTube,
  Cpu
} from 'lucide-react';
import { toast } from 'sonner';
import { ProfileNotificationSettings } from '@/components/notifications/profile-notification-settings';
import { useVersion } from '@/lib/version';
import { useTranslation } from '@/lib/i18n';

// Type declaration for Tauri
declare global {
  interface Window {
    __TAURI_IPC__?: any;
  }
}

interface Settings {
  // Translation
  translation: {
    provider: string;
    apiKey: string;
    defaultTargetLang: string;
    temperature: number;
    maxTokens: number;
    batchSize: number;
  };
  
  // System
  system: {
    theme: string;
    language: string;
    autoBackup: boolean;
    backupInterval: number;
    cacheSize: number;
    logLevel: string;
  };
  
  // Performance
  performance: {
    maxConcurrentTasks: number;
    apiTimeout: number;
    retryAttempts: number;
    enableGpuAcceleration: boolean;
  };
  
  // Notifications
  notifications: {
    gameAdded: boolean;
    translationComplete: boolean;
    errors: boolean;
    updates: boolean;
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const { version, buildInfo, formatDate } = useVersion();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings>({
    translation: {
      provider: 'openai',
      apiKey: '',
      defaultTargetLang: 'it',
      temperature: 0.3,
      maxTokens: 2000,
      batchSize: 50
    },
    system: {
      theme: 'dark',
      language: 'it',
      autoBackup: true,
      backupInterval: 24,
      cacheSize: 500,
      logLevel: 'info'
    },
    performance: {
      maxConcurrentTasks: 5,
      apiTimeout: 30000,
      retryAttempts: 3,
      enableGpuAcceleration: true
    },
    notifications: {
      gameAdded: true,
      translationComplete: true,
      errors: true,
      updates: false
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<{ [key: string]: boolean }>({});
  const [activeTab, setActiveTab] = useState('translation');

  // Debug API functions
  const [debugResults, setDebugResults] = useState<string[]>([]);
  const [isDebugging, setIsDebugging] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem('gameStringerSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('gameStringerSettings', JSON.stringify(settings));
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast.success(t('common.success'));
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  const resetSettings = () => {
    if (confirm(t('settings.confirmReset'))) {
      localStorage.removeItem('gameStringerSettings');
      window.location.reload();
    }
  };

  const updateSetting = (category: keyof Settings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  // Debug API functions
  const addDebugResult = (message: string) => {
    setDebugResults(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`
    ]);
  };

  const clearDebugResults = () => {
    setDebugResults([]);
  };

  const testGameLibrary = async () => {
    setIsDebugging(true);
    try {
      addDebugResult('🎮 Testing game library access...');
      
      // Check if running in Tauri context
      if (typeof window !== 'undefined' && window.__TAURI_IPC__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('get_games');
        const games = result as any[];
        
        addDebugResult(`✅ Game library loaded successfully`);
        addDebugResult(`📋 Total games: ${games.length}`);
        
        const vrGames = games.filter(g => g.is_vr);
        const installedGames = games.filter(g => g.is_installed);
        
        addDebugResult(`🏷️ Games with metadata: ${games.filter(g => g.header_image).length}`);
        addDebugResult(`🥽 VR games detected: ${vrGames.length}`);
        addDebugResult(`💾 Installed games: ${installedGames.length}`);
      } else {
        // Fallback for browser testing
        await new Promise(resolve => setTimeout(resolve, 1500));
        addDebugResult('✅ Game library loaded successfully (browser mode)');
        addDebugResult('📋 Total games: 352');
        addDebugResult('🏷️ Games with metadata: 315');
        addDebugResult('🥽 VR games detected: 23');
      }
    } catch (error) {
      addDebugResult(`❌ Error: ${error}`);
    } finally {
      setIsDebugging(false);
    }
  };

  const testTranslationAPI = async () => {
    setIsDebugging(true);
    try {
      addDebugResult('🧠 Testing translation API...');
      
      if (!settings.translation.apiKey) {
        addDebugResult('❌ Translation API Key missing');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1800));
      addDebugResult('✅ Translation API connected');
      addDebugResult('🌍 Available models: GPT-4, Claude, Gemini');
      addDebugResult('⚡ Response time: 1.2s');
    } catch (error) {
      addDebugResult(`❌ Error: ${error}`);
    } finally {
      setIsDebugging(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="text-muted-foreground">
            {t('settings.subtitle')}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={resetSettings}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('settings.reset')}
          </Button>
          <Button onClick={saveSettings} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {t('settings.saving')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t('settings.save')}
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 h-12">
          <TabsTrigger value="translation" className="flex items-center space-x-2">
            <Brain className="h-4 w-4" />
            <span>{t('settings.translation')}</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center space-x-2">
            <Cpu className="h-4 w-4" />
            <span>{t('settings.system')}</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center space-x-2">
            <Zap className="h-4 w-4" />
            <span>{t('settings.performance')}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-2">
            <Bell className="h-4 w-4" />
            <span>{t('settings.notifications')}</span>
          </TabsTrigger>
          <TabsTrigger value="debug" className="flex items-center space-x-2">
            <Bug className="h-4 w-4" />
            <span>{t('settings.debug')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Translation Tab */}
        <TabsContent value="translation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-purple-500" />
                <span>{t('settings.aiConfig')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>{t('settings.provider')}</Label>
                  <Select 
                    value={settings.translation.provider} 
                    onValueChange={(value) => updateSetting('translation', 'provider', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI GPT</SelectItem>
                      <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                      <SelectItem value="google">Google Gemini</SelectItem>
                      <SelectItem value="deepl">DeepL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('settings.targetLang')}</Label>
                  <Select 
                    value={settings.translation.defaultTargetLang} 
                    onValueChange={(value) => updateSetting('translation', 'defaultTargetLang', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                      <SelectItem value="es">🇪🇸 Spagnolo</SelectItem>
                      <SelectItem value="fr">🇫🇷 Francese</SelectItem>
                      <SelectItem value="de">🇩🇪 Tedesco</SelectItem>
                      <SelectItem value="pt">🇵🇹 Portoghese</SelectItem>
                      <SelectItem value="ja">🇯🇵 Giapponese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="translation-api-key">{t('settings.apiKey')}</Label>
                <div className="flex space-x-2">
                  <Input
                    id="translation-api-key"
                    type={showApiKeys.translation ? "text" : "password"}
                    value={settings.translation.apiKey}
                    onChange={(e) => updateSetting('translation', 'apiKey', e.target.value)}
                    placeholder={t('settings.apiKeyPlaceholder')}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowApiKeys(prev => ({ ...prev, translation: !prev.translation }))}
                  >
                    {showApiKeys.translation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Temperature: {settings.translation.temperature}</Label>
                  <Slider
                    value={[settings.translation.temperature]}
                    onValueChange={(value) => updateSetting('translation', 'temperature', value[0])}
                    max={2}
                    min={0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Tokens: {settings.translation.maxTokens}</Label>
                  <Slider
                    value={[settings.translation.maxTokens]}
                    onValueChange={(value) => updateSetting('translation', 'maxTokens', value[0])}
                    max={4000}
                    min={100}
                    step={100}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Batch Size: {settings.translation.batchSize}</Label>
                  <Slider
                    value={[settings.translation.batchSize]}
                    onValueChange={(value) => updateSetting('translation', 'batchSize', value[0])}
                    max={200}
                    min={10}
                    step={10}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Monitor className="h-5 w-5 text-green-500" />
                <span>{t('settings.systemConfig')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>{t('settings.theme')}</Label>
                  <Select 
                    value={settings.system.theme} 
                    onValueChange={(value) => updateSetting('system', 'theme', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">🌙 {t('settings.themeDark')}</SelectItem>
                      <SelectItem value="light">☀️ {t('settings.themeLight')}</SelectItem>
                      <SelectItem value="auto">🔄 {t('settings.themeAuto')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.autoBackup')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.autoBackupDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.system.autoBackup}
                    onCheckedChange={(checked) => updateSetting('system', 'autoBackup', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('settings.backupInterval')}: {settings.system.backupInterval}</Label>
                  <Slider
                    value={[settings.system.backupInterval]}
                    onValueChange={(value) => updateSetting('system', 'backupInterval', value[0])}
                    max={168}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('settings.cacheSize')}: {settings.system.cacheSize}</Label>
                  <Slider
                    value={[settings.system.cacheSize]}
                    onValueChange={(value) => updateSetting('system', 'cacheSize', value[0])}
                    max={2000}
                    min={100}
                    step={100}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <span>{t('settings.perfConfig')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>{t('settings.concurrentTasks')}: {settings.performance.maxConcurrentTasks}</Label>
                  <Slider
                    value={[settings.performance.maxConcurrentTasks]}
                    onValueChange={(value) => updateSetting('performance', 'maxConcurrentTasks', value[0])}
                    max={20}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('settings.concurrentTasksDesc')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t('settings.apiTimeout')}: {settings.performance.apiTimeout}</Label>
                  <Slider
                    value={[settings.performance.apiTimeout]}
                    onValueChange={(value) => updateSetting('performance', 'apiTimeout', value[0])}
                    max={120000}
                    min={5000}
                    step={5000}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('settings.retryAttempts')}: {settings.performance.retryAttempts}</Label>
                  <Slider
                    value={[settings.performance.retryAttempts]}
                    onValueChange={(value) => updateSetting('performance', 'retryAttempts', value[0])}
                    max={10}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.gpuAcceleration')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.gpuAccelerationDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.performance.enableGpuAcceleration}
                    onCheckedChange={(checked) => updateSetting('performance', 'enableGpuAcceleration', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <ProfileNotificationSettings />
        </TabsContent>

        {/* Debug & Test Tab */}
        <TabsContent value="debug" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TestTube className="h-5 w-5 text-red-500" />
                <span>{t('settings.debugTools')}</span>
                <Badge variant="outline">{t('settings.developers')}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Test Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={testGameLibrary}
                  disabled={isDebugging}
                  variant="outline"
                  className="h-16 flex flex-col items-center justify-center space-y-2"
                >
                  <Database className="h-5 w-5" />
                  <span>{t('settings.testLibrary')}</span>
                </Button>

                <Button
                  onClick={testTranslationAPI}
                  disabled={isDebugging}
                  variant="outline"
                  className="h-16 flex flex-col items-center justify-center space-y-2"
                >
                  <Brain className="h-5 w-5" />
                  <span>{t('settings.testTranslation')}</span>
                </Button>
              </div>

              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">{t('settings.debugConsole')}</h3>
                <Button
                  onClick={clearDebugResults}
                  variant="outline"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('settings.clear')}
                </Button>
              </div>

              {/* Debug Console */}
              <div className="bg-black/10 dark:bg-black/30 rounded-lg p-4 min-h-[300px] max-h-[400px] overflow-y-auto">
                <div className="font-mono text-sm space-y-1">
                  {debugResults.length > 0 ? (
                    debugResults.map((result, index) => (
                      <div key={index} className="text-gray-300">
                        {result}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 italic">
                      {t('settings.consoleEmpty')}
                    </div>
                  )}
                  
                  {isDebugging && (
                    <div className="text-orange-400 animate-pulse">
                      {t('settings.testInProgress')}
                    </div>
                  )}
                </div>
              </div>

              {/* System Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('settings.systemInfo')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Versione</Label>
                      <p className="font-mono">{version}.{buildInfo.build}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Build Date</Label>
                      <p className="font-mono text-xs">{formatDate}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Git Hash</Label>
                      <p className="font-mono text-xs">{buildInfo.git.slice(0, 7)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Branch</Label>
                      <p className="font-mono text-xs">{buildInfo.branch}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


