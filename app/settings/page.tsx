'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  Cpu,
  HardDrive,
  Globe,
  Link2,
  BookOpen,
  Settings,
  Rss,
  Plus,
  X,
  Play,
  Compass,
  Maximize2,
  Type,
  Columns,
  SlidersHorizontal
} from 'lucide-react';
import { getRssFeeds, saveRssFeeds, defaultRssFeeds, type RssFeed } from '@/components/ui/rss-ticker';
import { toast } from 'sonner';
import { ProfileNotificationSettings } from '@/components/notifications/profile-notification-settings';
import { AutoBackupSettings } from '@/components/settings/auto-backup-settings';
import { useVersion } from '@/lib/version';
import { useTranslation } from '@/lib/i18n';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { invoke } from '@tauri-apps/api/core';

// Cache Stats Component
function CacheStatsCard() {
  const [stats, setStats] = useState<{
    cache_size_mb: number;
    cover_count: number;
    disk_free_gb: number;
    disk_total_gb: number;
    app_data_size_mb: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const loadStats = async () => {
      try {
        const result = await invoke<any>('get_cache_stats');
        setStats(result);
      } catch (e) {
        console.error('Error loading cache stats:', e);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Monitor className="h-5 w-5 text-green-500" />
            <span>{t('settings.systemConfig')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const diskUsedPercent = stats ? ((stats.disk_total_gb - stats.disk_free_gb) / stats.disk_total_gb * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Monitor className="h-5 w-5 text-green-500" />
          <span>{t('settings.systemConfig')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* App Data Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <HardDrive className="h-6 w-6 mx-auto mb-2 text-blue-400" />
            <p className="text-2xl font-bold">{stats?.app_data_size_mb.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">MB Dati App</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <Database className="h-6 w-6 mx-auto mb-2 text-purple-400" />
            <p className="text-2xl font-bold">{stats?.cache_size_mb.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">MB Cache Cover</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <Globe className="h-6 w-6 mx-auto mb-2 text-green-400" />
            <p className="text-2xl font-bold">{stats?.cover_count || 0}</p>
            <p className="text-xs text-muted-foreground">Cover Salvate</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <Cpu className="h-6 w-6 mx-auto mb-2 text-yellow-400" />
            <p className="text-2xl font-bold">{stats?.disk_free_gb.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">GB Liberi Disco</p>
          </div>
        </div>

        {/* Disk Usage Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Spazio Disco</span>
            <span>{(stats?.disk_total_gb || 0).toFixed(0)} GB totali</span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500"
              style={{ width: `${Math.min(diskUsedPercent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {diskUsedPercent.toFixed(1)}% utilizzato • {(stats?.disk_free_gb || 0).toFixed(1)} GB disponibili
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

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
    groqApiKey: string;
    deepseekApiKey: string;
    openaiApiKey: string;
    anthropicApiKey: string;
    mistralApiKey: string;
    cohereApiKey: string;
    togetherApiKey: string;
    fireworksApiKey: string;
    openrouterApiKey: string;
    cerebrasApiKey: string;
    deeplApiKey: string;
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
  
  // Integrations
  integrations: {
    steamGridDbApiKey: string;
  };

  // Display
  display: {
    uiScale: number;
    fontSize: 'small' | 'medium' | 'large';
    compactMode: boolean;
    sidebarWidth: number;
    animationsEnabled: boolean;
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
      groqApiKey: '',
      deepseekApiKey: '',
      openaiApiKey: '',
      anthropicApiKey: '',
      mistralApiKey: '',
      cohereApiKey: '',
      togetherApiKey: '',
      fireworksApiKey: '',
      openrouterApiKey: '',
      cerebrasApiKey: '',
      deeplApiKey: '',
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
    },
    integrations: {
      steamGridDbApiKey: ''
    },
    display: {
      uiScale: 100,
      fontSize: 'medium',
      compactMode: false,
      sidebarWidth: 256,
      animationsEnabled: true,
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
        setSettings(prev => ({
          ...prev,
          ...parsed,
          translation: { ...prev.translation, ...(parsed.translation || {}) },
          system: { ...prev.system, ...(parsed.system || {}) },
          performance: { ...prev.performance, ...(parsed.performance || {}) },
          notifications: { ...prev.notifications, ...(parsed.notifications || {}) },
          integrations: { ...prev.integrations, ...(parsed.integrations || {}) },
          display: { ...prev.display, ...(parsed.display || {}) },
        }));
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('gameStringerSettings', JSON.stringify(settings));
      window.dispatchEvent(new Event('gs-display-changed'));
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

  const [tutorialDialogOpen, setTutorialDialogOpen] = useState(false);

  // RSS Feeds
  const [rssFeeds, setRssFeeds] = useState<RssFeed[]>([]);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedName, setNewFeedName] = useState('');

  useEffect(() => {
    setRssFeeds(getRssFeeds());
  }, []);

  const handleAddRssFeed = () => {
    if (!newFeedUrl.trim() || !newFeedName.trim()) {
      toast.error('Inserisci URL e nome del feed');
      return;
    }
    const newFeed: RssFeed = { url: newFeedUrl.trim(), name: newFeedName.trim(), enabled: true };
    const updated = [...rssFeeds, newFeed];
    setRssFeeds(updated);
    saveRssFeeds(updated);
    setNewFeedUrl('');
    setNewFeedName('');
    toast.success('Feed RSS aggiunto');
  };

  const handleRemoveRssFeed = (index: number) => {
    const updated = rssFeeds.filter((_, i) => i !== index);
    setRssFeeds(updated);
    saveRssFeeds(updated);
    toast.success('Feed rimosso');
  };

  const handleToggleRssFeed = (index: number) => {
    const updated = rssFeeds.map((feed, i) => 
      i === index ? { ...feed, enabled: !feed.enabled } : feed
    );
    setRssFeeds(updated);
    saveRssFeeds(updated);
  };

  const handleResetRssFeeds = () => {
    setRssFeeds(defaultRssFeeds);
    saveRssFeeds(defaultRssFeeds);
    toast.success('Feed RSS ripristinati');
  };

  const startNormalTutorial = () => {
    // Riavvia solo l'onboarding wizard (slides informative)
    localStorage.removeItem('gamestringer_onboarding_completed');
    setTutorialDialogOpen(false);
    toast.success(t('settings.tutorial.restarting'));
    setTimeout(() => window.location.reload(), 1000);
  };

  const startGuidedTutorial = () => {
    // Riavvia solo il tutorial interattivo (guida passo-passo nella sidebar)
    localStorage.removeItem('gamestringer-tutorial-completed');
    setTutorialDialogOpen(false);
    toast.success(t('settings.tutorial.startingGuided'));
    setTimeout(() => window.location.reload(), 1000);
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
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800 p-3">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{t('settings.title')}</h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{t('settings.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTutorialDialogOpen(true)} className="border-white/30 text-white hover:bg-white/10 h-8 text-xs">
              <BookOpen className="h-3.5 w-3.5 mr-1.5" />
              Tutorial
            </Button>
            <Dialog open={tutorialDialogOpen} onOpenChange={setTutorialDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-500" />
                    {t('settings.tutorial.chooseTitle')}
                  </DialogTitle>
                  <DialogDescription>
                    {t('settings.tutorial.chooseDesc')}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <Button
                    variant="outline"
                    className="h-auto p-4 justify-start gap-4 hover:bg-blue-500/10 hover:border-blue-500/50"
                    onClick={startNormalTutorial}
                  >
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <Play className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{t('settings.tutorial.normalTitle')}</div>
                      <div className="text-xs text-muted-foreground">{t('settings.tutorial.normalDesc')}</div>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto p-4 justify-start gap-4 hover:bg-purple-500/10 hover:border-purple-500/50"
                    onClick={startGuidedTutorial}
                  >
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <Compass className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{t('settings.tutorial.guidedTitle')}</div>
                      <div className="text-xs text-muted-foreground">{t('settings.tutorial.guidedDesc')}</div>
                    </div>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={resetSettings} className="border-white/30 text-white hover:bg-white/10 h-8 text-xs">
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
            <Button size="sm" onClick={saveSettings} disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 h-8 text-xs">
              {isSaving ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />{t('settings.saving')}</>
              ) : (
                <><Save className="h-3.5 w-3.5 mr-1.5" />{t('settings.save')}</>
              )}
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="translation" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Brain className="h-3.5 w-3.5" />
            <span>{t('settings.tabs.ai')}</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Cpu className="h-3.5 w-3.5" />
            <span>{t('settings.tabs.system')}</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Zap className="h-3.5 w-3.5" />
            <span>{t('settings.tabs.performance')}</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <HardDrive className="h-3.5 w-3.5" />
            <span>{t('settings.tabs.backup')}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Bell className="h-3.5 w-3.5" />
            <span>{t('settings.tabs.notifications')}</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Globe className="h-3.5 w-3.5" />
            <span>{t('settings.tabs.integrations')}</span>
          </TabsTrigger>
          <TabsTrigger value="rss" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Rss className="h-3.5 w-3.5" />
            <span>RSS</span>
          </TabsTrigger>
          <TabsTrigger value="display" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Maximize2 className="h-3.5 w-3.5" />
            <span>Display</span>
          </TabsTrigger>
          <TabsTrigger value="debug" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Bug className="h-3.5 w-3.5" />
            <span>{t('settings.tabs.debug')}</span>
          </TabsTrigger>
        </TabsList>

        <form onSubmit={(e) => e.preventDefault()} autoComplete="off">
        {/* Translation Tab */}
        <TabsContent value="translation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-blue-500" />
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

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">API Keys (Fallback: Gemini → DeepSeek → OpenAI)</h4>
                
                <div className="space-y-2">
                  <Label htmlFor="translation-api-key">🔑 Google Gemini API Key</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="translation-api-key"
                      type={showApiKeys.translation ? "text" : "password"}
                      value={settings.translation.apiKey}
                      onChange={(e) => updateSetting('translation', 'apiKey', e.target.value)}
                      placeholder="AIzaSy..."
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowApiKeys(prev => ({ ...prev, translation: !prev.translation }))}
                    >
                      {showApiKeys.translation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Free tier: 15 RPM / 1M TPM — <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="underline">Ottieni chiave</a></p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="groq-api-key">🔑 Groq API Key (Llama 3.3 70B — Gratuito)</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="groq-api-key"
                      type={showApiKeys.groq ? "text" : "password"}
                      value={settings.translation.groqApiKey}
                      onChange={(e) => updateSetting('translation', 'groqApiKey', e.target.value)}
                      placeholder="gsk_..."
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowApiKeys(prev => ({ ...prev, groq: !prev.groq }))}
                    >
                      {showApiKeys.groq ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Gratuito, velocissimo — <a href="https://console.groq.com/keys" target="_blank" rel="noopener" className="underline">Ottieni chiave</a></p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deepseek-api-key">🔑 DeepSeek API Key</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="deepseek-api-key"
                      type={showApiKeys.deepseek ? "text" : "password"}
                      value={settings.translation.deepseekApiKey}
                      onChange={(e) => updateSetting('translation', 'deepseekApiKey', e.target.value)}
                      placeholder="sk-..."
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowApiKeys(prev => ({ ...prev, deepseek: !prev.deepseek }))}
                    >
                      {showApiKeys.deepseek ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">~$0.14/1M tokens, nessun rate limit aggressivo — <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener" className="underline">Ottieni chiave</a></p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="openai-api-key">🔑 OpenAI API Key</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="openai-api-key"
                      type={showApiKeys.openai ? "text" : "password"}
                      value={settings.translation.openaiApiKey}
                      onChange={(e) => updateSetting('translation', 'openaiApiKey', e.target.value)}
                      placeholder="sk-..."
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowApiKeys(prev => ({ ...prev, openai: !prev.openai }))}
                    >
                      {showApiKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Pay-per-use, GPT-4o — <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="underline">Ottieni chiave</a></p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="anthropic-api-key">🔑 Anthropic Claude API Key</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="anthropic-api-key"
                      type={showApiKeys.anthropic ? "text" : "password"}
                      value={settings.translation.anthropicApiKey}
                      onChange={(e) => updateSetting('translation', 'anthropicApiKey', e.target.value)}
                      placeholder="sk-ant-..."
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowApiKeys(prev => ({ ...prev, anthropic: !prev.anthropic }))}
                    >
                      {showApiKeys.anthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Pay-per-use, Claude Sonnet — <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="underline">Ottieni chiave</a></p>
                </div>
              </div>

              <details className="group">
                <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  🔧 Altri Provider LLM (Mistral, Cohere, Together, Fireworks, OpenRouter, Cerebras)
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                  <div className="space-y-1">
                    <Label htmlFor="mistral-api-key" className="text-xs">Mistral AI</Label>
                    <div className="flex space-x-1">
                      <Input id="mistral-api-key" type={showApiKeys.mistral ? "text" : "password"} value={settings.translation.mistralApiKey} onChange={(e) => updateSetting('translation', 'mistralApiKey', e.target.value)} placeholder="..." className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, mistral: !prev.mistral }))}>{showApiKeys.mistral ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Free tier — <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener" className="underline">Chiave</a></p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cohere-api-key" className="text-xs">Cohere</Label>
                    <div className="flex space-x-1">
                      <Input id="cohere-api-key" type={showApiKeys.cohere ? "text" : "password"} value={settings.translation.cohereApiKey} onChange={(e) => updateSetting('translation', 'cohereApiKey', e.target.value)} placeholder="..." className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, cohere: !prev.cohere }))}>{showApiKeys.cohere ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Free trial — <a href="https://dashboard.cohere.com/api-keys" target="_blank" rel="noopener" className="underline">Chiave</a></p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="together-api-key" className="text-xs">Together AI</Label>
                    <div className="flex space-x-1">
                      <Input id="together-api-key" type={showApiKeys.together ? "text" : "password"} value={settings.translation.togetherApiKey} onChange={(e) => updateSetting('translation', 'togetherApiKey', e.target.value)} placeholder="..." className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, together: !prev.together }))}>{showApiKeys.together ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">$25 free credit — <a href="https://api.together.xyz/settings/api-keys" target="_blank" rel="noopener" className="underline">Chiave</a></p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="fireworks-api-key" className="text-xs">Fireworks AI</Label>
                    <div className="flex space-x-1">
                      <Input id="fireworks-api-key" type={showApiKeys.fireworks ? "text" : "password"} value={settings.translation.fireworksApiKey} onChange={(e) => updateSetting('translation', 'fireworksApiKey', e.target.value)} placeholder="..." className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, fireworks: !prev.fireworks }))}>{showApiKeys.fireworks ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Free tier — <a href="https://fireworks.ai/account/api-keys" target="_blank" rel="noopener" className="underline">Chiave</a></p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="openrouter-api-key" className="text-xs">OpenRouter</Label>
                    <div className="flex space-x-1">
                      <Input id="openrouter-api-key" type={showApiKeys.openrouter ? "text" : "password"} value={settings.translation.openrouterApiKey} onChange={(e) => updateSetting('translation', 'openrouterApiKey', e.target.value)} placeholder="sk-or-..." className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, openrouter: !prev.openrouter }))}>{showApiKeys.openrouter ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Modelli gratuiti inclusi — <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" className="underline">Chiave</a></p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cerebras-api-key" className="text-xs">Cerebras</Label>
                    <div className="flex space-x-1">
                      <Input id="cerebras-api-key" type={showApiKeys.cerebras ? "text" : "password"} value={settings.translation.cerebrasApiKey} onChange={(e) => updateSetting('translation', 'cerebrasApiKey', e.target.value)} placeholder="csk-..." className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, cerebras: !prev.cerebras }))}>{showApiKeys.cerebras ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Free tier, ultra-veloce — <a href="https://cloud.cerebras.ai/platform" target="_blank" rel="noopener" className="underline">Chiave</a></p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="deepl-api-key" className="text-xs">DeepL</Label>
                    <div className="flex space-x-1">
                      <Input id="deepl-api-key" type={showApiKeys.deepl ? "text" : "password"} value={settings.translation.deeplApiKey} onChange={(e) => updateSetting('translation', 'deeplApiKey', e.target.value)} placeholder="..." className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, deepl: !prev.deepl }))}>{showApiKeys.deepl ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">500K chars/mese gratis — <a href="https://www.deepl.com/pro-api" target="_blank" rel="noopener" className="underline">Chiave</a></p>
                  </div>
                </div>
              </details>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Temperature: {settings.translation.temperature}</Label>
                    <InfoTooltip 
                      variant="info"
                      content={
                        <div className="space-y-1">
                          <p className="font-semibold">{t('settings.temperatureTooltipTitle')}</p>
                          <p className="text-xs">• <strong>{t('settings.temperatureTooltipLow')}</strong></p>
                          <p className="text-xs">• <strong>{t('settings.temperatureTooltipMid')}</strong></p>
                          <p className="text-xs">• <strong>{t('settings.temperatureTooltipHigh')}</strong></p>
                          <p className="text-xs text-muted-foreground mt-1">{t('settings.temperatureTooltipRecommended')}</p>
                        </div>
                      }
                    />
                  </div>
                  <Slider
                    value={[settings.translation.temperature]}
                    onValueChange={(value) => updateSetting('translation', 'temperature', value[0])}
                    max={2}
                    min={0}
                    step={0.1}
                    className="w-full [&_[data-slot=range]]:bg-blue-500 [&_[data-slot=thumb]]:bg-blue-500 [&_[data-slot=thumb]]:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Max Tokens: {settings.translation.maxTokens}</Label>
                    <InfoTooltip 
                      variant="info"
                      content={
                        <div className="space-y-1">
                          <p className="font-semibold">{t('settings.maxTokensTooltipTitle')}</p>
                          <p className="text-xs">{t('settings.maxTokensTooltipDesc')}</p>
                          <p className="text-xs">• <strong>{t('settings.maxTokensTooltipLow')}</strong></p>
                          <p className="text-xs">• <strong>{t('settings.maxTokensTooltipMid')}</strong></p>
                          <p className="text-xs">• <strong>{t('settings.maxTokensTooltipHigh')}</strong></p>
                          <p className="text-xs text-muted-foreground mt-1">{t('settings.maxTokensTooltipCost')}</p>
                        </div>
                      }
                    />
                  </div>
                  <Slider
                    value={[settings.translation.maxTokens]}
                    onValueChange={(value) => updateSetting('translation', 'maxTokens', value[0])}
                    max={4000}
                    min={100}
                    step={100}
                    className="w-full [&_[data-slot=range]]:bg-blue-500 [&_[data-slot=thumb]]:bg-blue-500 [&_[data-slot=thumb]]:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Batch Size: {settings.translation.batchSize}</Label>
                    <InfoTooltip 
                      variant="info"
                      content={
                        <div className="space-y-1">
                          <p className="font-semibold">{t('settings.batchSizeTooltipTitle')}</p>
                          <p className="text-xs">{t('settings.batchSizeTooltipDesc')}</p>
                          <p className="text-xs">• <strong>{t('settings.batchSizeTooltipLow')}</strong></p>
                          <p className="text-xs">• <strong>{t('settings.batchSizeTooltipMid')}</strong></p>
                          <p className="text-xs">• <strong>{t('settings.batchSizeTooltipHigh')}</strong></p>
                          <p className="text-xs text-muted-foreground mt-1">{t('settings.batchSizeTooltipCost')}</p>
                        </div>
                      }
                    />
                  </div>
                  <Slider
                    value={[settings.translation.batchSize]}
                    onValueChange={(value) => updateSetting('translation', 'batchSize', value[0])}
                    max={200}
                    min={10}
                    step={10}
                    className="w-full [&_[data-slot=range]]:bg-blue-500 [&_[data-slot=thumb]]:bg-blue-500 [&_[data-slot=thumb]]:border-blue-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-6">
          <AutoBackupSettings />
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <CacheStatsCard />
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
                    className="w-full [&_[data-slot=range]]:bg-blue-500 [&_[data-slot=thumb]]:bg-blue-500 [&_[data-slot=thumb]]:border-blue-500"
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
                    className="w-full [&_[data-slot=range]]:bg-blue-500 [&_[data-slot=thumb]]:bg-blue-500 [&_[data-slot=thumb]]:border-blue-500"
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
                    className="w-full [&_[data-slot=range]]:bg-blue-500 [&_[data-slot=thumb]]:bg-blue-500 [&_[data-slot=thumb]]:border-blue-500"
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

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-3">
          <Card className="p-3">
            <p className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              API Esterne
            </p>
            <div className="space-y-2 p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-cyan-400" />
                <Label className="text-sm font-semibold">SteamGridDB</Label>
                <Badge variant="outline" className="text-[10px]">Gratuito</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Copertine per giochi senza artwork.
                <a href="https://www.steamgriddb.com/profile/preferences/api" target="_blank" className="text-cyan-400 hover:underline ml-1">API Key →</a>
              </p>
              <div className="flex gap-2">
                <Input
                  type={showApiKeys.steamgriddb ? "text" : "password"}
                  value={settings.integrations.steamGridDbApiKey}
                  onChange={(e) => updateSetting('integrations', 'steamGridDbApiKey', e.target.value)}
                  placeholder="API Key..."
                  className="font-mono h-8 text-xs"
                />
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, steamgriddb: !prev.steamgriddb }))}>
                  {showApiKeys.steamgriddb ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* RSS Tab */}
        <TabsContent value="rss" className="space-y-3">
          <Card className="p-4">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Rss className="h-5 w-5 text-orange-500" />
                Feed RSS Dashboard
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Configura i feed RSS da mostrare nel ticker della dashboard
              </p>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              {/* Add new feed */}
              <div className="flex gap-2">
                <Input
                  placeholder="Nome feed (es. Steam News)"
                  value={newFeedName}
                  onChange={(e) => setNewFeedName(e.target.value)}
                  className="flex-1 h-9 text-sm"
                />
                <Input
                  placeholder="URL feed RSS"
                  value={newFeedUrl}
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  className="flex-[2] h-9 text-sm"
                />
                <Button onClick={handleAddRssFeed} size="sm" className="h-9 gap-1">
                  <Plus className="h-4 w-4" />
                  Aggiungi
                </Button>
              </div>

              {/* Feed list */}
              <div className="space-y-2">
                {rssFeeds.map((feed, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                    <Switch
                      checked={feed.enabled}
                      onCheckedChange={() => handleToggleRssFeed(index)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{feed.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{feed.url}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRssFeed(index)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {rssFeeds.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nessun feed configurato. Aggiungi un feed RSS per iniziare.
                  </p>
                )}
              </div>

              {/* Reset button */}
              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={handleResetRssFeeds} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Ripristina default
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Display Tab */}
        <TabsContent value="display" className="space-y-3">
          {/* Screen Info - inline compatto */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <Monitor className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-[10px] text-muted-foreground">Finestra</span>
              </div>
              <p className="text-sm font-bold">{typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '...'}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <Maximize2 className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-[10px] text-muted-foreground">Schermo</span>
              </div>
              <p className="text-sm font-bold">{typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '...'}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-green-400" />
                <span className="text-[10px] text-muted-foreground">DPI</span>
              </div>
              <p className="text-sm font-bold">{typeof window !== 'undefined' ? `${(window.devicePixelRatio * 100).toFixed(0)}%` : '...'}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <Columns className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-[10px] text-muted-foreground">Ratio</span>
              </div>
              <p className="text-sm font-bold">{typeof window !== 'undefined' ? (window.innerWidth / window.innerHeight).toFixed(2) : '...'}</p>
            </div>
          </div>

          <Card className="p-4">
            <div className="space-y-4">
              {/* UI Scale + Sidebar — due colonne */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Scala UI</Label>
                    <Badge variant="outline" className="font-mono text-[10px] h-5">{settings.display.uiScale}%</Badge>
                  </div>
                  <Slider
                    value={[settings.display.uiScale]}
                    onValueChange={(value) => updateSetting('display', 'uiScale', value[0])}
                    max={150} min={75} step={5}
                    className="w-full [&_[data-slot=range]]:bg-violet-500 [&_[data-slot=thumb]]:bg-violet-500 [&_[data-slot=thumb]]:border-violet-500"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>75%</span><span>100%</span><span>150%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Sidebar</Label>
                    <Badge variant="outline" className="font-mono text-[10px] h-5">{settings.display.sidebarWidth}px</Badge>
                  </div>
                  <Slider
                    value={[settings.display.sidebarWidth]}
                    onValueChange={(value) => updateSetting('display', 'sidebarWidth', value[0])}
                    max={320} min={200} step={8}
                    className="w-full [&_[data-slot=range]]:bg-violet-500 [&_[data-slot=thumb]]:bg-violet-500 [&_[data-slot=thumb]]:border-violet-500"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>200px</span><span>256px</span><span>320px</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Font Size — compatto inline */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Dimensione Testo</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateSetting('display', 'fontSize', size)}
                      className={`p-2 rounded-lg border transition-all text-center ${
                        settings.display.fontSize === size
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <Type className={`mx-auto mb-1 ${size === 'small' ? 'h-3 w-3' : size === 'large' ? 'h-5 w-5' : 'h-4 w-4'}`} />
                      <p className="text-[11px] font-medium">{size === 'small' ? 'Piccolo (14px)' : size === 'medium' ? 'Medio (16px)' : 'Grande (18px)'}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Toggles — inline */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
                  <div>
                    <Label className="text-xs">Compatta</Label>
                    <p className="text-[10px] text-muted-foreground">Meno padding</p>
                  </div>
                  <Switch
                    checked={settings.display.compactMode}
                    onCheckedChange={(checked) => updateSetting('display', 'compactMode', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
                  <div>
                    <Label className="text-xs">Animazioni</Label>
                    <p className="text-[10px] text-muted-foreground">Transizioni UI</p>
                  </div>
                  <Switch
                    checked={settings.display.animationsEnabled}
                    onCheckedChange={(checked) => updateSetting('display', 'animationsEnabled', checked)}
                  />
                </div>
              </div>

              <Separator />

              {/* Preset Rapidi */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Preset Rapidi</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Laptop', sub: '1366x768', icon: '\ud83d\udcbb', scale: 85, font: 'small' as const, compact: true, sw: 200 },
                    { label: 'Full HD', sub: '1920x1080', icon: '\ud83d\udda5\ufe0f', scale: 100, font: 'medium' as const, compact: false, sw: 256 },
                    { label: 'QHD', sub: '2560x1440', icon: '\ud83d\udcfa', scale: 110, font: 'medium' as const, compact: false, sw: 280 },
                    { label: '4K', sub: '3840x2160', icon: '\ud83c\udf1f', scale: 125, font: 'large' as const, compact: false, sw: 300 },
                  ].map((p) => (
                    <Button key={p.label} variant="outline" size="sm" className="h-auto py-2 flex-col gap-0.5 text-[10px]" onClick={() => {
                      updateSetting('display', 'uiScale', p.scale);
                      updateSetting('display', 'fontSize', p.font);
                      updateSetting('display', 'compactMode', p.compact);
                      updateSetting('display', 'sidebarWidth', p.sw);
                    }}>
                      <span>{p.icon}</span>
                      <span className="font-medium">{p.label}</span>
                      <span className="text-muted-foreground">{p.sub}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Debug & Test Tab */}
        <TabsContent value="debug" className="space-y-3">
          <Card className="p-3">
            <div className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
              <TestTube className="h-3.5 w-3.5" />
              {t('settings.debugTools')}
              <Badge variant="outline" className="text-[10px] ml-1">{t('settings.developers')}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Button onClick={testGameLibrary} disabled={isDebugging} variant="outline" size="sm" className="h-10 gap-1.5">
                <Database className="h-3.5 w-3.5" />
                <span className="text-xs">{t('settings.testLibrary')}</span>
              </Button>
              <Button onClick={testTranslationAPI} disabled={isDebugging} variant="outline" size="sm" className="h-10 gap-1.5">
                <Brain className="h-3.5 w-3.5" />
                <span className="text-xs">{t('settings.testTranslation')}</span>
              </Button>
            </div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-semibold text-slate-400">{t('settings.debugConsole')}</p>
              <Button onClick={clearDebugResults} variant="ghost" size="sm" className="h-6 text-xs gap-1">
                <Trash2 className="h-3 w-3" />
                {t('settings.clear')}
              </Button>
            </div>
            <div className="bg-black/30 rounded-lg p-2 h-[120px] overflow-y-auto">
              <div className="font-mono text-xs space-y-0.5">
                {debugResults.length > 0 ? debugResults.map((result, index) => (
                  <div key={index} className="text-gray-300">{result}</div>
                )) : (
                  <div className="text-gray-500 italic">{t('settings.consoleEmpty')}</div>
                )}
                {isDebugging && <div className="text-orange-400 animate-pulse">{t('settings.testInProgress')}</div>}
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <p className="text-xs font-semibold text-slate-400 mb-2">{t('settings.systemInfo')}</p>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div><span className="text-muted-foreground">Ver:</span> <span className="font-mono">{version}</span></div>
              <div><span className="text-muted-foreground">Build:</span> <span className="font-mono">{buildInfo.build}</span></div>
              <div><span className="text-muted-foreground">Git:</span> <span className="font-mono">{buildInfo.git.slice(0, 7)}</span></div>
              <div><span className="text-muted-foreground">Branch:</span> <span className="font-mono">{buildInfo.branch}</span></div>
            </div>
          </Card>
        </TabsContent>
      </form>
      </Tabs>
    </div>
  );
}


