'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  HelpCircle, 
  Gamepad2, 
  Brain, 
  Scan, 
  Cpu, 
  Wand2,
  Settings,
  Keyboard,
  Puzzle,
  ExternalLink,
  BookOpen,
  Book,
  History,
  Globe,
  Zap,
  ChevronRight
} from 'lucide-react';
import { getShortcutsList } from '@/lib/keyboard-shortcuts';
import { useTranslation, translations } from '@/lib/i18n';

export default function GuidePage() {
  const { t, language } = useTranslation();
  const shortcuts = getShortcutsList();
  const [activeTab, setActiveTab] = useState('tools');

  // Accesso diretto alle traduzioni per gli array
  const guideTrans = translations[language]?.guidePage || translations.it.guidePage;

  const toolsGuide = [
    {
      icon: Gamepad2,
      name: guideTrans.gameLibrary || 'Game Library',
      color: 'teal',
      features: guideTrans.gameLibraryFeatures || [
        'Automatic scan for Steam, Epic, GOG, Origin, Ubisoft, Battle.net',
        'Filter by name, engine, supported language, genre',
        'Game details: engine detection, localization files, DLC',
        'Translation recommendations based on engine and available files',
      ],
    },
    {
      icon: Brain,
      name: guideTrans.neuralTranslator || 'Neural Translator Pro',
      color: 'violet',
      features: guideTrans.neuralTranslatorFeatures || [
        'AI translation with Claude, OpenAI, Gemini, DeepL',
        'Supports JSON, PO, RESX, CSV, XLIFF, Unity YAML, Unreal Locres',
        'Batch processing with progress tracking',
        'Cost and time estimation before starting',
        'Auto-save to Translation Memory',
      ],
    },
    {
      icon: Scan,
      name: guideTrans.ocrTranslator || 'OCR Translator',
      color: 'violet',
      features: guideTrans.ocrTranslatorFeatures || [
        'Capture text directly from game screen',
        'Real-time AI translation',
        'Transparent overlay on game',
        'Global hotkey: Ctrl+Shift+T for quick capture',
        'Smart cache to avoid duplicate translations',
      ],
    },
    {
      icon: Cpu,
      name: guideTrans.ueTranslator || 'UE Translator',
      color: 'violet',
      features: guideTrans.ueTranslatorFeatures || [
        '.locres file extraction from Unreal Engine 4/5 games',
        'In-memory translation without modifying original files',
        'Anti-cheat compatibility check',
        'Translation cache for performance',
      ],
    },
    {
      icon: Wand2,
      name: guideTrans.unityPatcher || 'Unity Patcher',
      color: 'emerald',
      features: guideTrans.unityPatcherFeatures || [
        'Automatic BepInEx + XUnity.AutoTranslator installation',
        'Supports Unity 5.x to latest versions',
        'Modes: Capture only, Google Translate, DeepL',
        'Status badge: 🥈 Silver (auto-translate) / 🥉 Bronze (capture)',
        'Activity tracking in Dashboard',
        'In-game hotkey: ALT+T for XUnity menu',
      ],
    },
    {
      icon: Gamepad2,
      name: guideTrans.telltalePatcher || 'Telltale Patcher',
      color: 'orange',
      features: guideTrans.telltalePatcherFeatures || [
        'Translations for Telltale games (Wolf Among Us, Walking Dead, Batman)',
        'Supports .langdb, .landb, .dlog files',
        'Automatic platform detection (Steam/GOG/Epic)',
        'Specific instructions for GOG version (batch script)',
        'Direct link to Italian translations download',
        'Credits to original translation teams',
      ],
    },
  ];

  const newFeatures = [
    {
      icon: Book,
      name: guideTrans.customGlossary || 'Custom Glossary',
      color: 'orange',
      desc: guideTrans.customGlossaryDesc || 'Define terms with specific translations',
      details: guideTrans.customGlossaryDetails || [
        'Create global or game-specific glossaries',
        'Categories: Names, Items, Abilities, Locations, UI, Lore',
        'Options: case sensitive, whole word',
        'Empty term = do not translate (e.g. proper names)',
        'Import/Export JSON to share glossaries',
        'Automatically applied in all tools',
      ],
    },
    {
      icon: History,
      name: guideTrans.translationHistory || 'Translation History',
      color: 'violet',
      desc: guideTrans.translationHistoryDesc || 'Complete log of all translations',
      details: guideTrans.translationHistoryDetails || [
        'History of every translation made',
        'Statistics: words, API cost, time, provider',
        'Filter by tool, provider, game, date',
        'Full-text search in translations',
        'Export to JSON or CSV',
        'Cache hit rate to optimize costs',
      ],
    },
    {
      icon: Globe,
      name: guideTrans.autoDetectLanguage || 'Auto-Detect Language',
      color: 'blue',
      desc: guideTrans.autoDetectLanguageDesc || 'Automatically detect source language',
      details: guideTrans.autoDetectLanguageDetails || [
        'Pattern matching for 15+ languages',
        'Character support: Latin, Asian, Cyrillic, Arabic',
        'Confidence score for reliability',
        'Smart fallback if uncertain',
        'Integrated in OCR and Neural Translator',
      ],
    },
    {
      icon: Keyboard,
      name: guideTrans.globalHotkeys || 'Global Hotkeys',
      color: 'green',
      desc: guideTrans.globalHotkeysDesc || 'Shortcuts active even in fullscreen',
      details: guideTrans.globalHotkeysDetails || [
        'Ctrl+Shift+T → Start OCR capture',
        'Works even with fullscreen games',
        'Customizable configuration',
        'Toast notification when activated',
      ],
    },
  ];

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
              <p className="text-xs text-muted-foreground">{t('guidePage.everythingAbout')} v0.9.8-beta</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-400 border-green-500/30">
              <Zap className="h-3 w-3 mr-1" />
              New features
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-3 w-full h-9 shrink-0">
          <TabsTrigger value="tools" className="text-xs">🛠️ {t('guidePage.tools')}</TabsTrigger>
          <TabsTrigger value="new" className="text-xs">✨ {t('guidePage.newInVersion')}</TabsTrigger>
          <TabsTrigger value="shortcuts" className="text-xs">⌨️ {t('guidePage.shortcuts')}</TabsTrigger>
        </TabsList>

        {/* Tab: Strumenti */}
        <TabsContent value="tools" className="flex-1 overflow-hidden mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-3 pr-3">
              {toolsGuide.map((tool, i) => (
                <Card key={i} className="border-slate-800/50 bg-slate-900/30">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg bg-${tool.color}-500/20`}>
                        <tool.icon className={`h-4 w-4 text-${tool.color}-400`} />
                      </div>
                      <span className={`text-${tool.color}-400`}>{tool.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-3">
                    <ul className="space-y-1">
                      {tool.features.map((f: string, j: number) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <ChevronRight className="h-3 w-3 mt-0.5 text-slate-600 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Tab: Novità */}
        <TabsContent value="new" className="flex-1 overflow-hidden mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-3 pr-3">
              {newFeatures.map((feature, i) => (
                <Card key={i} className="border-slate-800/50 bg-slate-900/30">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg bg-${feature.color}-500/20`}>
                        <feature.icon className={`h-4 w-4 text-${feature.color}-400`} />
                      </div>
                      <div>
                        <span className={`text-${feature.color}-400`}>{feature.name}</span>
                        <p className="text-[10px] text-muted-foreground font-normal">{feature.desc}</p>
                      </div>
                      <Badge className="ml-auto text-[9px] bg-green-500/20 text-green-400">NEW</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-3">
                    <ul className="space-y-1">
                      {feature.details.map((d, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <ChevronRight className="h-3 w-3 mt-0.5 text-slate-600 shrink-0" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Tab: Scorciatoie */}
        <TabsContent value="shortcuts" className="flex-1 overflow-hidden mt-3">
          <Card className="h-full border-slate-800/50 bg-slate-900/30">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-red-400" />
                {guideTrans.keyboardShortcutsTitle || 'Keyboard Shortcuts'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { shortcut: 'Ctrl + F', description: guideTrans.openSearch || 'Open search' },
                  { shortcut: 'Esc', description: guideTrans.closeModal || 'Close modal/panel' },
                  { shortcut: 'Ctrl + R', description: guideTrans.refreshLibrary || 'Refresh library' },
                  { shortcut: 'Ctrl + ,', description: guideTrans.openSettings || 'Open settings' },
                  { shortcut: 'Shift + ?', description: guideTrans.showShortcutHelp || 'Show shortcut help' },
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
                    <span className="text-sm font-medium text-green-400">{guideTrans.globalHotkeysAlwaysWork || 'Global Hotkeys (always work)'}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <kbd className="px-2 py-1 bg-slate-900 rounded border border-green-500/30 text-xs font-mono text-green-400">
                        Ctrl+Shift+T
                      </kbd>
                      <span className="text-xs text-muted-foreground">{guideTrans.startOcrTranslator || 'Start OCR Translator'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <kbd className="px-2 py-1 bg-slate-900 rounded border border-green-500/30 text-xs font-mono text-green-400">
                        Ctrl+Shift+Q
                      </kbd>
                      <span className="text-xs text-muted-foreground">{guideTrans.quickTranslate || 'Quick Translate'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <kbd className="px-2 py-1 bg-slate-900 rounded border border-green-500/30 text-xs font-mono text-green-400">
                        Ctrl+Alt+O
                      </kbd>
                      <span className="text-xs text-muted-foreground">{guideTrans.toggleOverlay || 'Toggle Overlay'}</span>
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



