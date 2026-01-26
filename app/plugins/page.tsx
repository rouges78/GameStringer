'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Puzzle, 
  FileText, 
  Check, 
  RefreshCw,
  Info,
  Package
} from 'lucide-react';
import { pluginRegistry, PluginDefinition } from '@/lib/plugin-system';
import { ExtensionManager } from '@/components/extensions';
import { useTranslation } from '@/lib/i18n';

export default function PluginsPage() {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState<PluginDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlugins = () => {
    setIsLoading(true);
    const allPlugins = pluginRegistry.listPlugins();
    setPlugins(allPlugins);
    setIsLoading(false);
  };

  useEffect(() => {
    loadPlugins();
  }, []);

  const handleToggle = (pluginId: string, enabled: boolean) => {
    pluginRegistry.togglePlugin(pluginId, enabled);
    loadPlugins();
  };

  const formatPlugins = plugins.filter(p => p.type === 'format');
  const supportedExtensions = pluginRegistry.getSupportedExtensions();

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-3 overflow-y-auto">
      {/* Header con sfondo sfumato */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-4 text-white shrink-0">
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 shadow-lg shadow-black/40 border border-white/10">
              <span className="text-xs font-medium">{plugins.length} {t('plugins.title')}</span>
            </div>
            <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 shadow-lg shadow-black/40 border border-white/10">
              <Check className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{plugins.filter(p => p.enabled).length} {t('plugins.installed')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs per Parser e Estensioni */}
      <Tabs defaultValue="parsers" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-2 mb-3">
          <TabsTrigger value="parsers" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('plugins.formatPlugins')}
          </TabsTrigger>
          <TabsTrigger value="extensions" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t('plugins.supportedFormats')}
          </TabsTrigger>
        </TabsList>

        {/* Tab Parser */}
        <TabsContent value="parsers" className="flex-1 min-h-0 mt-0">
          <div className="flex gap-3 h-full">
            {/* Colonna sinistra - Estensioni */}
            <Card className="w-[280px] shrink-0 border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30 flex flex-col">
              <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              {t('plugins.formatPlugins')}
              <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 bg-red-500/10 text-red-400 border-red-500/30">
                {supportedExtensions.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 flex-1 overflow-y-auto">
            <div className="flex flex-wrap gap-1">
              {supportedExtensions.map(ext => (
                <Badge key={ext} variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-5 bg-slate-800/50">
                  {ext}
                </Badge>
              ))}
            </div>
            
            {/* Info box */}
            <div className="mt-3 p-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  I plugin builtin sono inclusi e non possono essere rimossi. Puoi disabilitarli temporaneamente.
                </p>
              </div>
            </div>
              </CardContent>
            </Card>

            {/* Colonna destra - Lista Plugin */}
            <Card className="flex-1 border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30 flex flex-col">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Puzzle className="w-4 h-4 text-sky-400" />
              Parser di Formato
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              {formatPlugins.map(plugin => (
                <div 
                  key={plugin.id} 
                  className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                    plugin.enabled 
                      ? 'bg-slate-800/30 border-green-500/30' 
                      : 'bg-slate-900/30 border-slate-800/50 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-1.5 h-8 rounded-full ${plugin.enabled ? 'bg-green-500' : 'bg-slate-600'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{plugin.name}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">v{plugin.version}</Badge>
                        {plugin.id.startsWith('builtin-') && (
                          <Badge className="text-[9px] px-1 py-0 bg-slate-700 shrink-0">Builtin</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{plugin.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={plugin.enabled}
                    onCheckedChange={(checked) => handleToggle(plugin.id, checked)}
                    className="shrink-0 ml-2"
                  />
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



