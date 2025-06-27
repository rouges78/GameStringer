
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  User
} from 'lucide-react';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState({
    // AI Settings
    aiProvider: 'gpt-4o-mini',
    defaultTargetLanguage: 'it',
    confidenceThreshold: 0.8,
    batchSize: 100,
    temperature: 0.3,
    systemPrompt: 'You are a professional video game translator. Maintain context, tone, and gaming terminology.',
    
    // System Settings
    autoBackup: true,
    backupInterval: 24,
    maxFileSize: 10485760, // 10MB
    autoUpdate: true,
    realTimeMode: false,
    
    // Directories
    scanDirectories: [
      'C:\\Program Files (x86)\\Steam\\steamapps',
      'C:\\Program Files\\Epic Games',
      'C:\\Program Files (x86)\\GOG Galaxy\\Games'
    ],
    backupDirectory: 'C:\\GameTranslator\\Backups',
    patchDirectory: 'C:\\GameTranslator\\Patches',
    
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

  const handleItchIOConnect = () => {
    const clientId = process.env.NEXT_PUBLIC_ITCHIO_CLIENT_ID;
    const redirectUri = `${window.location.origin}/api/auth/callback/itchio`;
    const scope = 'profile:me';
    const authUrl = `https://itch.io/user/oauth?client_id=${clientId}&scope=${scope}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = authUrl;
  };

  const saveSettings = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSaving(false);
  };

  const resetSettings = () => {
    // Reset to defaults
    setSettings({
      ...settings,
      aiProvider: 'gpt-4o-mini',
      defaultTargetLanguage: 'it',
      confidenceThreshold: 0.8,
      temperature: 0.3
    });
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const addScanDirectory = () => {
    const newDir = prompt('Inserisci il percorso della directory:');
    if (newDir) {
      setSettings(prev => ({
        ...prev,
        scanDirectories: [...prev.scanDirectories, newDir]
      }));
    }
  };

  const removeScanDirectory = (index: number) => {
    setSettings(prev => ({
      ...prev,
      scanDirectories: prev.scanDirectories.filter((_, i) => i !== index)
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Languages className="h-5 w-5" />
                <span>Configurazione AI</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Provider AI</label>
                  <Select value={settings.aiProvider} onValueChange={(value) => updateSetting('aiProvider', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Lingua Default</label>
                  <Select value={settings.defaultTargetLanguage} onValueChange={(value) => updateSetting('defaultTargetLanguage', value)}>
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
                    Soglia Confidenza ({Math.round(settings.confidenceThreshold * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1"
                    step="0.05"
                    value={settings.confidenceThreshold}
                    onChange={(e) => updateSetting('confidenceThreshold', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Temperature ({settings.temperature})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) => updateSetting('temperature', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Batch Size</label>
                  <Input
                    type="number"
                    value={settings.batchSize}
                    onChange={(e) => updateSetting('batchSize', parseInt(e.target.value))}
                    min="1"
                    max="500"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">System Prompt</label>
                <Textarea
                  value={settings.systemPrompt}
                  onChange={(e) => updateSetting('systemPrompt', e.target.value)}
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
                      checked={settings.autoBackup}
                      onChange={(e) => updateSetting('autoBackup', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Backup automatico</span>
                  </label>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Intervallo Backup (ore)</label>
                    <Input
                      type="number"
                      value={settings.backupInterval}
                      onChange={(e) => updateSetting('backupInterval', parseInt(e.target.value))}
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
                      checked={settings.autoUpdate}
                      onChange={(e) => updateSetting('autoUpdate', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Aggiornamenti automatici</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.realTimeMode}
                      onChange={(e) => updateSetting('realTimeMode', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Modalità tempo reale (sperimentale)</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Dimensione Massima File ({(settings.maxFileSize / 1024 / 1024).toFixed(1)} MB)
                </label>
                <input
                  type="range"
                  min="1048576"
                  max="104857600"
                  step="1048576"
                  value={settings.maxFileSize}
                  onChange={(e) => updateSetting('maxFileSize', parseInt(e.target.value))}
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
                {settings.scanDirectories.map((dir, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm font-mono">{dir}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => removeScanDirectory(index)}
                    >
                      Rimuovi
                    </Button>
                  </div>
                ))}
              </div>
              <Button onClick={addScanDirectory} variant="outline">
                <Folder className="h-4 w-4 mr-2" />
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
                  onChange={(e) => updateSetting('backupDirectory', e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Directory Patch</label>
                <Input
                  value={settings.patchDirectory}
                  onChange={(e) => updateSetting('patchDirectory', e.target.value)}
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
                    onChange={(e) => updateSetting('maxConcurrentTranslations', parseInt(e.target.value))}
                    min="1"
                    max="20"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Timeout API (ms)</label>
                  <Input
                    type="number"
                    value={settings.apiTimeout}
                    onChange={(e) => updateSetting('apiTimeout', parseInt(e.target.value))}
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
                    onChange={(e) => updateSetting('retryAttempts', parseInt(e.target.value))}
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
                    onChange={(e) => updateSetting('notifyTranslationComplete', e.target.checked)}
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
                    onChange={(e) => updateSetting('notifyPatchReady', e.target.checked)}
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
                    onChange={(e) => updateSetting('notifyErrors', e.target.checked)}
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
                    onChange={(e) => updateSetting('notifyUpdates', e.target.checked)}
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
                    const isConnected = session?.user?.connectedProviders?.includes(provider);
                    return (
                      <div key={provider} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {/* Qui potresti aggiungere le icone dei provider */}
                          <span className="font-medium capitalize">{provider}</span>
                        </div>
                        {isConnected ? (
                          <Badge variant="success"><CheckCircle className="h-4 w-4 mr-1" />Connesso</Badge>
                        ) : provider === 'itchio' ? (
                          <Button onClick={handleItchIOConnect}>Connetti</Button>
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
