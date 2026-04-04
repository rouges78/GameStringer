'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Puzzle, 
  FileText, 
  Check, 
  RefreshCw,
  Info,
  Package,
  Upload,
  Trash2,
  Cpu,
  AlertTriangle,
  Globe,
  Loader2,
  Cog,
  X
} from 'lucide-react';
import { pluginRegistry, type PluginDefinition, type EnginePlugin } from '@/lib/plugin-system';
import { ExtensionManager } from '@/components/extensions';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';

export default function PluginsPage() {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState<PluginDefinition[]>([]);
  const [enginePlugins, setEnginePlugins] = useState<EnginePlugin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [manifestInput, setManifestInput] = useState('');
  const [installing, setInstalling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPlugins = () => {
    setIsLoading(true);
    const allPlugins = pluginRegistry.listPlugins();
    setPlugins(allPlugins);
    setEnginePlugins(pluginRegistry.listEnginePlugins());
    setIsLoading(false);
  };

  useEffect(() => {
    loadPlugins();
    const unsub = pluginRegistry.onPluginEvent(() => loadPlugins());
    return unsub;
  }, []);

  const handleToggle = (pluginId: string, enabled: boolean) => {
    pluginRegistry.togglePlugin(pluginId, enabled);
    loadPlugins();
  };

  const handleRemove = (pluginId: string) => {
    if (pluginRegistry.removePlugin(pluginId)) {
      toast.success(t('plugins.pluginRemoved'));
      loadPlugins();
    } else {
      toast.error(t('plugins.cannotRemoveBuiltin'));
    }
  };

  const handleInstall = async () => {
    if (!manifestInput.trim()) return;
    setInstalling(true);
    try {
      const result = await pluginRegistry.loadExternalPlugin(manifestInput.trim());
      if (result.success) {
        toast.success(`${result.pluginId} ${t('plugins.pluginInstalled')}`);
        setManifestInput('');
        setShowInstallDialog(false);
        loadPlugins();
      } else {
        toast.error(result.error || t('plugins.installError'));
      }
    } catch (e: unknown) {
      toast.error(e.message);
    }
    setInstalling(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setManifestInput(reader.result as string);
      setShowInstallDialog(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formatPlugins = plugins.filter(p => p.type === 'format');
  const externalPlugins = plugins.filter(p => !p.id.startsWith('builtin-'));
  const supportedExtensions = pluginRegistry.getSupportedExtensions();

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-3 overflow-y-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-4 text-white shrink-0">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Puzzle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t('plugins.title')}</h1>
              <p className="text-white/80 text-xs">{t('plugins.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 border border-white/10">
              <span className="text-xs font-medium">{plugins.length} {t('plugins.pluginCount')}</span>
            </div>
            <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 border border-white/10">
              <Cpu className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{enginePlugins.length} {t('plugins.engineCount')}</span>
            </div>
            <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 border border-white/10">
              <Check className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{plugins.filter(p => p.enabled).length} {t('plugins.active')}</span>
            </div>
            <input ref={fileInputRef} type="file" accept=".gsplugin,.json" className="hidden" onChange={handleFileUpload} />
            <Button 
              size="sm" variant="secondary" 
              className="h-8 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" /> {t('plugins.installPlugin')}
            </Button>
          </div>
        </div>
      </div>

      {/* Install Dialog */}
      {showInstallDialog && (
        <Card className="border-indigo-500/30 bg-indigo-500/[0.03] shrink-0">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-indigo-400" />
                <span className="text-sm font-bold text-slate-200">{t('plugins.installExternal')}</span>
              </div>
              <button onClick={() => { setShowInstallDialog(false); setManifestInput(''); }} className="p-1 hover:bg-white/5 rounded-lg">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <Textarea
              value={manifestInput}
              onChange={(e) => setManifestInput(e.target.value)}
              placeholder={t('plugins.pasteManifest')}
              className="h-32 text-xs font-mono bg-slate-950/50 border-slate-700/50"
            />
            <div className="flex items-center gap-2">
              <div className="flex items-start gap-2 flex-1 p-2 rounded-lg bg-amber-500/[0.05] border border-amber-500/15">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-2xs text-amber-400/80 leading-relaxed">
                  {t('plugins.externalWarning')}
                </p>
              </div>
              <Button size="sm" onClick={handleInstall} disabled={installing || !manifestInput.trim()} className="h-9 px-4">
                {installing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                {t('plugins.install')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="parsers" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 mb-3">
          <TabsTrigger value="parsers" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('plugins.formats')} ({formatPlugins.length})
          </TabsTrigger>
          <TabsTrigger value="engines" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            {t('plugins.engines')} ({enginePlugins.length})
          </TabsTrigger>
          <TabsTrigger value="extensions" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t('plugins.extensions')}
          </TabsTrigger>
        </TabsList>

        {/* Tab Format Parsers */}
        <TabsContent value="parsers" className="flex-1 min-h-0 mt-0">
          <div className="flex gap-3 h-full">
            {/* Colonna sinistra - Estensioni */}
            <Card variant="muted" className="w-[260px] shrink-0 flex flex-col">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-400" />
                  {t('plugins.supportedExtensions')}
                  <Badge variant="outline" className="ml-auto text-2xs px-1.5 py-0 bg-sky-500/10 text-sky-400 border-sky-500/30">
                    {supportedExtensions.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0 flex-1 overflow-y-auto">
                <div className="flex flex-wrap gap-1">
                  {supportedExtensions.map(ext => (
                    <Badge key={ext} variant="secondary" className="font-mono text-2xs px-1.5 py-0 h-5 bg-slate-800/50">
                      {ext}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 p-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-2xs text-muted-foreground leading-relaxed">
                      {t('plugins.builtinInfo')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Colonna destra - Lista Plugin */}
            <Card variant="muted" className="flex-1 flex flex-col">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Puzzle className="w-4 h-4 text-sky-400" />
                  {t('plugins.formatParsers')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0 flex-1 overflow-y-auto">
                <div className="space-y-1.5">
                  {formatPlugins.map(plugin => (
                    <div 
                      key={plugin.id} 
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                        plugin.enabled 
                          ? 'bg-slate-800/30 border-emerald-500/20' 
                          : 'bg-slate-900/30 border-slate-800/50 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-1.5 h-8 rounded-full shrink-0 ${plugin.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">{plugin.name}</span>
                            <Badge variant="outline" className="text-micro px-1 py-0 shrink-0">v{plugin.version}</Badge>
                            {plugin.id.startsWith('builtin-') && (
                              <Badge className="text-micro px-1 py-0 bg-slate-700 shrink-0">Builtin</Badge>
                            )}
                          </div>
                          <p className="text-2xs text-muted-foreground truncate">{plugin.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {!plugin.id.startsWith('builtin-') && (
                          <button onClick={() => handleRemove(plugin.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        )}
                        <Switch
                          checked={plugin.enabled}
                          onCheckedChange={(checked) => handleToggle(plugin.id, checked)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Engine Plugins */}
        <TabsContent value="engines" className="flex-1 min-h-0 mt-0">
          <div className="space-y-3">
            {enginePlugins.length === 0 ? (
              <Card variant="muted">
                <CardContent className="p-8 text-center">
                  <Cpu className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-400 mb-1">{t('plugins.noEnginePlugins')}</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                    {t('plugins.noEngineDesc')}{' '}
                    {t('plugins.loadGsplugin')} <code className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-400 text-2xs">.gsplugin</code> {t('plugins.toStart')}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" /> {t('plugins.loadEnginePlugin')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {enginePlugins.map(plugin => (
                  <Card key={plugin.id} variant="muted" className={`transition-all ${plugin.enabled ? '' : 'opacity-50'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                            {plugin.icon ? (
                              <span className="text-lg">{plugin.icon}</span>
                            ) : (
                              <Cpu className="h-5 w-5 text-sky-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-200">{plugin.name}</span>
                              <Badge variant="outline" className="text-micro px-1 py-0">v{plugin.version}</Badge>
                            </div>
                            <p className="text-2xs text-slate-500">{t('plugins.by')} {plugin.author}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!plugin.id.startsWith('builtin-') && (
                            <button onClick={() => handleRemove(plugin.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors">
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </button>
                          )}
                          <Switch checked={plugin.enabled} onCheckedChange={(checked) => handleToggle(plugin.id, checked)} />
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mb-3">{plugin.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="text-micro bg-sky-500/10 text-sky-400 border-sky-500/20">
                          {plugin.engineName}
                        </Badge>
                        {plugin.supportedExtensions.map(ext => (
                          <Badge key={ext} variant="secondary" className="font-mono text-micro px-1.5 py-0 bg-slate-800/50">
                            {ext}
                          </Badge>
                        ))}
                        {plugin.website && (
                          <a href={plugin.website} target="_blank" rel="noopener noreferrer" className="ml-auto">
                            <Globe className="h-3.5 w-3.5 text-slate-500 hover:text-sky-400 transition-colors" />
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Built-in Engine Support Info */}
            <Card variant="muted">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs flex items-center gap-2 text-slate-500">
                  <Cog className="h-3.5 w-3.5" /> {t('plugins.nativeEngines')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { name: 'Unity', ext: '.asset, .unity', color: 'text-slate-300' },
                    { name: 'Unreal Engine', ext: '.locres, .pak', color: 'text-blue-400' },
                    { name: 'RPG Maker', ext: '.json (MV/MZ)', color: 'text-amber-400' },
                    { name: "Ren'Py", ext: '.rpy', color: 'text-pink-400' },
                    { name: 'Godot', ext: '.tres, .tscn', color: 'text-sky-400' },
                    { name: 'Telltale', ext: '.langdb, .dlog', color: 'text-violet-400' },
                    { name: 'GameMaker', ext: '.csv, .json', color: 'text-emerald-400' },
                    { name: 'Wolf RPG', ext: '.wolf', color: 'text-orange-400' },
                  ].map(eng => (
                    <div key={eng.name} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <span className={`text-xs font-bold ${eng.color}`}>{eng.name}</span>
                      <span className="text-micro text-slate-600 ml-auto font-mono">{eng.ext}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Estensioni */}
        <TabsContent value="extensions" className="flex-1 min-h-0 mt-0 overflow-y-auto">
          <ExtensionManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
