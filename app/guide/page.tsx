'use client';

import React, { useState, useMemo } from 'react';
import { useVersion } from '@/lib/version';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Keyboard, BookOpen, Zap, ChevronRight } from 'lucide-react';
import { getShortcutsList } from '@/lib/keyboard-shortcuts';
import { useTranslation, translations } from '@/lib/i18n';
import {
  getToolsRegistry,
  categoryMeta,
  subcategoryLabels,
  type ToolDefinition,
} from '@/lib/tools-registry';

export default function GuidePage() {
  const { t, language } = useTranslation();
  const { version } = useVersion();
  const shortcuts = getShortcutsList();
  const [activeTab, setActiveTab] = useState('translation');

  const guideTrans = translations[language]?.guidePage || translations.it.guidePage;

  // Legge i tool dal registry centralizzato e li raggruppa per categoria → subcategory
  const registry = useMemo(() => getToolsRegistry(), []);

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, { subcategory: string; tools: ToolDefinition[] }[]> = {};
    for (const tool of registry) {
      if (!groups[tool.category]) groups[tool.category] = [];
      const sub = tool.subcategory || '_root';
      let existing = groups[tool.category].find((g) => g.subcategory === sub);
      if (!existing) {
        existing = { subcategory: sub, tools: [] };
        groups[tool.category].push(existing);
      }
      existing.tools.push(tool);
    }
    return groups;
  }, [registry]);

  const tabCategories = ['translation', 'tools', 'resources'] as const;

  const renderToolCard = (tool: ToolDefinition) => {
    const color = tool.color;
    const Icon = tool.icon;
    return (
      <Card key={tool.id} className="border-slate-800/50 bg-slate-900/30">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className={`p-1.5 rounded-lg bg-${color}-500/20`}>
              <Icon className={`h-4 w-4 text-${color}-400`} />
            </div>
            <span className={`text-${color}-400`}>{tool.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3">
          <ul className="space-y-1">
            {tool.features.map((f, j) => (
              <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                <ChevronRight className="h-3 w-3 mt-0.5 text-slate-600 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-3 overflow-y-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800/50 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-orange-950/30 p-3 shrink-0">
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/20">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-orange-400">{t('guidePage.detailedGuide')}</h1>
              <p className="text-xs text-muted-foreground">{t('guidePage.everythingAbout')} v{version}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/30">
            {registry.length} strumenti
          </Badge>
        </div>
      </div>

      {/* Tabs — una per ogni categoria + scorciatoie */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-4 w-full h-9 shrink-0">
          {tabCategories.map((cat) => (
            <TabsTrigger key={cat} value={cat} className="text-xs">
              {categoryMeta[cat]?.label}
              <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0 h-4">
                {groupedByCategory[cat]?.reduce((acc, g) => acc + g.tools.length, 0) || 0}
              </Badge>
            </TabsTrigger>
          ))}
          <TabsTrigger value="shortcuts" className="text-xs">
            ⌨️ {t('guidePage.shortcuts')}
          </TabsTrigger>
        </TabsList>

        {/* Tab dinamiche per ogni categoria */}
        {tabCategories.map((cat) => (
          <TabsContent key={cat} value={cat} className="flex-1 overflow-hidden mt-3">
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-3">
                {groupedByCategory[cat]?.map((group) => (
                  <div key={group.subcategory}>
                    {group.subcategory !== '_root' && (
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                        {subcategoryLabels[group.subcategory] || group.subcategory}
                      </h3>
                    )}
                    <div className="space-y-2">
                      {group.tools.map(renderToolCard)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}

        {/* Tab: Scorciatoie */}
        <TabsContent value="shortcuts" className="flex-1 overflow-hidden mt-3">
          <Card className="h-full border-slate-800/50 bg-slate-900/30">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-red-400" />
                {guideTrans.keyboardShortcutsTitle || 'Scorciatoie da Tastiera'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { shortcut: 'Ctrl + F', description: guideTrans.openSearch || 'Apri ricerca' },
                  { shortcut: 'Esc', description: guideTrans.closeModal || 'Chiudi modale/pannello' },
                  { shortcut: 'Ctrl + R', description: guideTrans.refreshLibrary || 'Aggiorna libreria' },
                  { shortcut: 'Ctrl + ,', description: guideTrans.openSettings || 'Apri impostazioni' },
                  { shortcut: 'Shift + ?', description: guideTrans.showShortcutHelp || 'Mostra scorciatoie' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-800/30">
                    <kbd className="px-2 py-1 bg-slate-900 rounded border border-slate-700 text-xs font-mono text-red-400">
                      {s.shortcut}
                    </kbd>
                    <span className="text-xs text-muted-foreground">{s.description}</span>
                  </div>
                ))}

                {/* Hotkey globali */}
                <div className="col-span-2 mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-medium text-green-400">
                      {guideTrans.globalHotkeysAlwaysWork || 'Hotkey Globali (sempre attive)'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <kbd className="px-2 py-1 bg-slate-900 rounded border border-green-500/30 text-xs font-mono text-green-400">
                        Ctrl+Shift+T
                      </kbd>
                      <span className="text-xs text-muted-foreground">
                        {guideTrans.startOcrTranslator || 'Avvia OCR Translator'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <kbd className="px-2 py-1 bg-slate-900 rounded border border-green-500/30 text-xs font-mono text-green-400">
                        Ctrl+Shift+Q
                      </kbd>
                      <span className="text-xs text-muted-foreground">
                        {guideTrans.quickTranslate || 'Traduzione Rapida'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <kbd className="px-2 py-1 bg-slate-900 rounded border border-green-500/30 text-xs font-mono text-green-400">
                        Ctrl+Alt+O
                      </kbd>
                      <span className="text-xs text-muted-foreground">
                        {guideTrans.toggleOverlay || 'Toggle Overlay'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
