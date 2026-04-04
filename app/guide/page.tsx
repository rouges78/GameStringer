'use client';

import React, { useState, useMemo } from 'react';
import { useVersion } from '@/lib/version';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import {
  Keyboard, BookOpen, Zap, ChevronRight, Rocket, ArrowRight,
  Gamepad2, Settings, Sparkles, Brain, Scan, Mic, FolderTree,
  Database, Wand2, ShieldCheck, AlertTriangle, HelpCircle,
  CheckCircle2, Info, Globe, Monitor, Target, Eye, Wrench,
  Package, Heart, Cpu, Film, Layers, AudioLines, User,
  FileArchive, ShoppingBag, Users, MessageSquare, Glasses,
  Subtitles, Play, FileText,
} from 'lucide-react';
import { useTranslation, translations } from '@/lib/i18n';
import { getGuideTranslations } from '@/lib/i18n/guide-translations';
import {
  getToolsRegistry,
  categoryMeta,
  subcategoryLabels,
  type ToolDefinition,
} from '@/lib/tools-registry';

// ============================================================================
// STEP COMPONENT — usato per ogni passo di un flusso di lavoro
// ============================================================================
function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
          {number}
        </div>
        <div className="flex-1 w-px bg-slate-700/50 mt-1" />
      </div>
      <div className="pb-6 flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
        <div className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

// ============================================================================
// TIP COMPONENT — box colorato per suggerimenti
// ============================================================================
function Tip({ children, variant = 'info' }: { children: React.ReactNode; variant?: 'info' | 'warning' | 'success' }) {
  const styles = {
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  };
  const icons = {
    info: <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
  };
  return (
    <div className={`flex gap-2 p-2.5 rounded-lg border text-xs leading-relaxed ${styles[variant]}`}>
      {icons[variant]}
      <div>{children}</div>
    </div>
  );
}

// ============================================================================
// NAV LINK — link cliccabile a una pagina dell'app
// ============================================================================
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 underline underline-offset-2 decoration-blue-400/30 hover:decoration-blue-300/60 transition-colors">
      {children} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function GuidePage() {
  const { t, language } = useTranslation();
  const { version } = useVersion();
  const [activeTab, setActiveTab] = useState('quickstart');

  const guideTrans = (translations[language] as unknown)?.guidePage || (translations.it as Record<string, unknown>)?.guidePage;
  const g = getGuideTranslations(language);
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

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-3 overflow-hidden">
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
          <Badge variant="outline" className="text-2xs bg-orange-500/10 text-orange-400 border-orange-500/30">
            {registry.length} {t('nav.tools').toLowerCase()}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-5 w-full h-9 shrink-0">
          <TabsTrigger value="quickstart" className="text-xs gap-1">
            <Rocket className="h-3 w-3" /> {g.tabQuickStart}
          </TabsTrigger>
          <TabsTrigger value="workflows" className="text-xs gap-1">
            <Target className="h-3 w-3" /> {g.tabWorkflows}
          </TabsTrigger>
          <TabsTrigger value="tools" className="text-xs gap-1">
            <Wrench className="h-3 w-3" /> {g.tabTools}
          </TabsTrigger>
          <TabsTrigger value="shortcuts" className="text-xs gap-1">
            <Keyboard className="h-3 w-3" /> {g.tabShortcuts}
          </TabsTrigger>
          <TabsTrigger value="faq" className="text-xs gap-1">
            <HelpCircle className="h-3 w-3" /> {g.tabFaq}
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* TAB: QUICK START                                                 */}
        {/* ================================================================ */}
        <TabsContent value="quickstart" className="flex-1 overflow-hidden mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-3 pb-6">
              <Card className="border-blue-500/20 bg-blue-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-blue-400">
                    <Rocket className="h-5 w-5" />
                    {g.qsTitle}
                  </CardTitle>
                  <CardDescription>
                    {g.qsSubtitle}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <Step number={1} title={g.qsStep1Title}>
                    <p>{g.qsStep1Line1} <NavLink href="/settings">{t('nav.settings')}</NavLink> {g.qsStep1Line1b} <strong>AI</strong>.</p>
                    <p>{g.qsStep1Line2}</p>
                    <p>{g.qsStep1Line3} <strong>{g.btnSave}</strong>{g.qsStep1Line3b}</p>
                    <Tip variant="info">{g.qsStep1Tip}</Tip>
                  </Step>

                  <Step number={2} title={g.qsStep2Title}>
                    <p>{g.qsStep2Line1} <NavLink href="/stores">{t('guidePage.stores')}</NavLink> {g.qsStep2Line1b}</p>
                    <p>{g.qsStep2Line2}</p>
                    <p>{g.qsStep2Line3}</p>
                  </Step>

                  <Step number={3} title={g.qsStep3Title}>
                    <p>{g.qsStep3Line1} <NavLink href="/library">{t('nav.library')}</NavLink>{g.qsStep3Line1b}</p>
                    <p>{g.qsStep3Line2}</p>
                    <p>{g.qsStep3Line3a} <strong>&quot;{g.btnTranslate}&quot;</strong> {g.qsStep3Line3b}</p>
                  </Step>

                  <Step number={4} title={g.qsStep4Title}>
                    <p>{g.qsStep4Line1} <NavLink href="/auto-translate">{t('guidePage.autotranslate')}</NavLink> {g.qsStep4Line1b}</p>
                    <p>{g.qsStep4Line2}</p>
                    <p>{g.qsStep4Line3a} <strong>&quot;{g.btnStartTranslation}&quot;</strong>.</p>
                    <p>{g.qsStep4Line4}</p>
                  </Step>

                  <Step number={5} title={g.qsStep5Title}>
                    <p>{g.qsStep5Line1}</p>
                    <p>{g.qsStep5Line2}</p>
                    <p>{g.qsStep5Line3}</p>
                    <Tip variant="success">{g.qsStep5Tip}</Tip>
                  </Step>
                </CardContent>
              </Card>

              {/* Cosa serve */}
              <Card className="border-slate-800/50 bg-slate-900/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    {g.needTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                      <p className="text-xs font-semibold text-white mb-1">{g.needApiTitle}</p>
                      <p className="text-[11px] text-muted-foreground">{g.needApiDesc}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                      <p className="text-xs font-semibold text-white mb-1">{g.needGamesTitle}</p>
                      <p className="text-[11px] text-muted-foreground">{g.needGamesDesc}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                      <p className="text-xs font-semibold text-white mb-1">{g.needInternetTitle}</p>
                      <p className="text-[11px] text-muted-foreground">{g.needInternetDesc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB: FLUSSI DI LAVORO                                            */}
        {/* ================================================================ */}
        <TabsContent value="workflows" className="flex-1 overflow-hidden mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-3 pb-6">

              {/* Workflow 1: Gioco Unity */}
              <Card className="border-emerald-500/20 bg-emerald-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-emerald-400">
                    <Wand2 className="h-4 w-4" />
                    {g.wfUnityTitle}
                  </CardTitle>
                  <CardDescription>{g.wfUnityDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <Step number={1} title={g.wfUnityStep1Title}>
                    <p>{g.wfUnityStep1Line1} <NavLink href="/library">{t('nav.library')}</NavLink> {g.wfUnityStep1Line1b}</p>
                    <p>{g.wfUnityStep1Line2}</p>
                  </Step>
                  <Step number={2} title={g.wfUnityStep2Title}>
                    <p>{g.wfUnityStep2Line1}</p>
                    <p>{g.wfUnityStep2Line2a} <strong>&quot;{g.btnInstall}&quot;</strong> {g.wfUnityStep2Line2b}</p>
                  </Step>
                  <Step number={3} title={g.wfUnityStep3Title}>
                    <p>{g.wfUnityStep3Line1}</p>
                    <p>{g.wfUnityStep3Line2}</p>
                  </Step>
                  <Step number={4} title={g.wfUnityStep4Title}>
                    <p>{g.wfUnityStep4Line1a} <strong>&quot;{g.btnRescan}&quot;</strong>{g.wfUnityStep4Line1b}</p>
                    <p>{g.wfUnityStep4Line2}</p>
                  </Step>
                  <Tip variant="info">{g.wfUnityTip}</Tip>
                </CardContent>
              </Card>

              {/* Workflow 2: Gioco generico con file */}
              <Card className="border-blue-500/20 bg-blue-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
                    <FileText className="h-4 w-4" />
                    {g.wfFilesTitle}
                  </CardTitle>
                  <CardDescription>{g.wfFilesDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <Step number={1} title={g.wfFilesStep1Title}>
                    <p>{g.wfFilesStep1Line1} <NavLink href="/library">{t('nav.library')}</NavLink> {g.wfFilesStep1Line1b} <strong>&quot;{g.btnTranslate}&quot;</strong>.</p>
                    <p>{g.wfFilesStep1Line2}</p>
                  </Step>
                  <Step number={2} title={g.wfFilesStep2Title}>
                    <p>{g.wfFilesStep2Line1}</p>
                    <p>{g.wfFilesStep2Line2}</p>
                  </Step>
                  <Step number={3} title={g.wfFilesStep3Title}>
                    <p>{g.wfFilesStep3Line1a} <strong>&quot;{g.btnStartTranslation}&quot;</strong>.</p>
                    <p>{g.wfFilesStep3Line2}</p>
                    <p>{g.wfFilesStep3Line3}</p>
                  </Step>
                  <Step number={4} title={g.wfFilesStep4Title}>
                    <p>{g.wfFilesStep4Line1}</p>
                    <p>{g.wfFilesStep4Line2}</p>
                  </Step>
                </CardContent>
              </Card>

              {/* Workflow 3: Traduzione Manuale / Pro */}
              <Card className="border-violet-500/20 bg-violet-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-violet-400">
                    <Brain className="h-4 w-4" />
                    {g.wfProTitle}
                  </CardTitle>
                  <CardDescription>{g.wfProDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <Step number={1} title={g.wfProStep1Title}>
                    <p>{g.wfProStep1Line1} <NavLink href="/translator/pro">{t('guidePage.neuralTranslator')}</NavLink>{g.wfProStep1Line1b}</p>
                  </Step>
                  <Step number={2} title={g.wfProStep2Title}>
                    <p>{g.wfProStep2Line1}</p>
                    <p>{g.wfProStep2Line2}</p>
                  </Step>
                  <Step number={3} title={g.wfProStep3Title}>
                    <p>{g.wfProStep3Line1}</p>
                  </Step>
                  <Step number={4} title={g.wfProStep4Title}>
                    <p>{g.wfProStep4Line1}</p>
                    <p>{g.wfProStep4Line2}</p>
                  </Step>
                </CardContent>
              </Card>

              {/* Workflow 4: OCR in tempo reale */}
              <Card className="border-amber-500/20 bg-amber-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
                    <Scan className="h-4 w-4" />
                    {g.wfOcrTitle}
                  </CardTitle>
                  <CardDescription>{g.wfOcrDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <Step number={1} title={g.wfOcrStep1Title}>
                    <p>{g.wfOcrStep1Line1} <NavLink href="/ocr-translator">{t('guidePage.ocrTranslator')}</NavLink> {g.wfOcrStep1Line1b} <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-600 text-2xs font-mono">{t('guidePage.ctrlshiftt')}</kbd> {g.wfOcrStep1Line1c}</p>
                  </Step>
                  <Step number={2} title={g.wfOcrStep2Title}>
                    <p>{g.wfOcrStep2Line1}</p>
                    <p>{g.wfOcrStep2Line2}</p>
                  </Step>
                  <Step number={3} title={g.wfOcrStep3Title}>
                    <p>{g.wfOcrStep3Line1}</p>
                    <p>{g.wfOcrStep3Line2}</p>
                  </Step>
                  <Tip variant="info">{g.wfOcrTip} <NavLink href="/live-ocr">{t('guidePage.liveOcr')}</NavLink> {g.wfOcrTipEnd}</Tip>
                </CardContent>
              </Card>

              {/* Workflow 5: Voce */}
              <Card className="border-orange-500/20 bg-orange-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-orange-400">
                    <Mic className="h-4 w-4" />
                    {g.wfVoiceTitle}
                  </CardTitle>
                  <CardDescription>{g.wfVoiceDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <Step number={1} title={g.wfVoiceStep1Title}>
                    <p>{g.wfVoiceStep1Line1} <NavLink href="/voice-translator">{t('guidePage.voiceTranslator')}</NavLink>{g.wfVoiceStep1Line1b}</p>
                    <p>{g.wfVoiceStep1Line2}</p>
                  </Step>
                  <Step number={2} title={g.wfVoiceStep2Title}>
                    <p>{g.wfVoiceStep2Line1}</p>
                  </Step>
                  <Step number={3} title={g.wfVoiceStep3Title}>
                    <p>{g.wfVoiceStep3Line1}</p>
                    <p>{g.wfVoiceStep3Line2} <NavLink href="/voice-clone">{t('guidePage.voiceCloneGuide')}</NavLink> {g.wfVoiceStep3Line2b}</p>
                  </Step>
                </CardContent>
              </Card>

            </div>
          </ScrollArea>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB: STRUMENTI (RIFERIMENTO)                                     */}
        {/* ================================================================ */}
        <TabsContent value="tools" className="flex-1 overflow-hidden mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-5 pr-3 pb-6">
              {(['core', 'translation', 'tools', 'resources'] as const).map((cat) => {
                const meta = categoryMeta[cat];
                if (!meta || !groupedByCategory[cat]) return null;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`h-1 w-8 rounded-full bg-${meta.color}-500`} />
                      <h2 className={`text-sm font-bold text-${meta.color}-400 uppercase tracking-wider`}>{meta.label}</h2>
                      <Badge variant="secondary" className="text-micro px-1.5 py-0 h-4">
                        {groupedByCategory[cat].reduce((acc, g) => acc + g.tools.length, 0)}
                      </Badge>
                    </div>
                    {groupedByCategory[cat].map((group) => (
                      <div key={group.subcategory} className="mb-3">
                        {group.subcategory !== '_root' && (
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                            {subcategoryLabels[group.subcategory] || group.subcategory}
                          </h3>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {group.tools.map((tool) => {
                            const Icon = tool.icon;
                            return (
                              <Link key={tool.id} href={tool.href}>
                                <Card className="border-slate-800/50 bg-slate-900/30 hover:bg-slate-800/40 hover:border-slate-700/60 transition-colors cursor-pointer h-full">
                                  <CardHeader className="py-2 px-3">
                                    <CardTitle className="text-xs flex items-center gap-2">
                                      <div className={`p-1 rounded bg-${tool.color}-500/20`}>
                                        <Icon className={`h-3.5 w-3.5 text-${tool.color}-400`} />
                                      </div>
                                      <span className="text-white">{tool.name}</span>
                                      {tool.isNew && <Badge className="text-2xs px-1 py-0 h-3.5 bg-amber-500/20 text-amber-400 border-amber-500/30">NEW</Badge>}
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="py-1 px-3 pb-2">
                                    <ul className="space-y-0.5">
                                      {tool.features.slice(0, 3).map((f, j) => (
                                        <li key={j} className="flex items-start gap-1.5 text-2xs text-muted-foreground">
                                          <ChevronRight className="h-2.5 w-2.5 mt-0.5 text-slate-600 shrink-0" />
                                          <span>{f}</span>
                                        </li>
                                      ))}
                                      {tool.features.length > 3 && (
                                        <li className="text-2xs text-slate-600 pl-4">+{tool.features.length - 3} {g.otherFunctions}</li>
                                      )}
                                    </ul>
                                  </CardContent>
                                </Card>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB: SCORCIATOIE                                                 */}
        {/* ================================================================ */}
        <TabsContent value="shortcuts" className="flex-1 overflow-hidden mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-3 pb-6">
              {/* Navigazione */}
              <Card className="border-slate-800/50 bg-slate-900/30">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-blue-400" />
                    {g.scNavTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      { shortcut: 'Ctrl + K', desc: g.scNavCmdPalette },
                      { shortcut: 'Ctrl + F', desc: g.scNavSearch },
                      { shortcut: 'Ctrl + ,', desc: g.scNavSettings },
                      { shortcut: 'Ctrl + R', desc: g.scNavRefresh },
                      { shortcut: 'Esc', desc: g.scNavClose },
                      { shortcut: 'Shift + ?', desc: g.scNavShortcuts },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-2 rounded bg-slate-800/30">
                        <kbd className="px-2 py-1 bg-slate-900 rounded border border-slate-700 text-2xs font-mono text-blue-400 whitespace-nowrap">
                          {s.shortcut}
                        </kbd>
                        <span className="text-[11px] text-muted-foreground text-right">{s.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Hotkey globali */}
              <Card className="border-green-500/20 bg-green-950/10">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-green-400" />
                    {g.scGlobalTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      { shortcut: 'Ctrl + Shift + T', desc: g.scGlobalOcr },
                      { shortcut: 'Ctrl + Shift + Q', desc: g.scGlobalQuick },
                      { shortcut: 'Ctrl + Alt + O', desc: g.scGlobalOverlay },
                      { shortcut: 'ALT + T', desc: g.scGlobalXunity },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-2 rounded bg-slate-800/30">
                        <kbd className="px-2 py-1 bg-slate-900 rounded border border-green-500/30 text-2xs font-mono text-green-400 whitespace-nowrap">
                          {s.shortcut}
                        </kbd>
                        <span className="text-[11px] text-muted-foreground text-right">{s.desc}</span>
                      </div>
                    ))}
                  </div>
                  <Tip variant="info">{g.scGlobalTip}</Tip>
                </CardContent>
              </Card>

              {/* Durante traduzione */}
              <Card className="border-slate-800/50 bg-slate-900/30">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    {g.scTransTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      { shortcut: 'Spazio', desc: g.scTransPause },
                      { shortcut: 'Tab', desc: g.scTransNext },
                      { shortcut: 'Shift + Tab', desc: g.scTransPrev },
                      { shortcut: 'Enter', desc: g.scTransConfirm },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-2 rounded bg-slate-800/30">
                        <kbd className="px-2 py-1 bg-slate-900 rounded border border-slate-700 text-2xs font-mono text-violet-400 whitespace-nowrap">
                          {s.shortcut}
                        </kbd>
                        <span className="text-[11px] text-muted-foreground text-right">{s.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB: FAQ                                                          */}
        {/* ================================================================ */}
        <TabsContent value="faq" className="flex-1 overflow-hidden mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-3 pr-3 pb-6">

              {/* FAQ — Generali */}
              <h2 className="text-sm font-bold text-white flex items-center gap-2 px-1">
                <HelpCircle className="h-4 w-4 text-orange-400" />
                {g.faqTitle}
              </h2>

              {[
                { q: g.faqCostQ, a: g.faqCostA },
                { q: g.faqProvidersQ, a: g.faqProvidersA },
                { q: g.faqLangsQ, a: g.faqLangsA },
                { q: g.faqFilesQ, a: g.faqFilesA },
                { q: g.faqMultiplayerQ, a: g.faqMultiplayerA },
              ].map((faq, i) => (
                <Card key={i} className="border-slate-800/50 bg-slate-900/30">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs text-white">{faq.q}</CardTitle>
                  </CardHeader>
                  <CardContent className="py-1 px-3 pb-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{faq.a}</p>
                  </CardContent>
                </Card>
              ))}

              <Separator className="my-2 bg-slate-800" />

              {/* Troubleshooting */}
              <h2 className="text-sm font-bold text-white flex items-center gap-2 px-1">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                {g.troubleTitle}
              </h2>

              {[
                { q: g.troubleNoFilesQ, a: g.troubleNoFilesA },
                { q: g.troubleApiQ, a: g.troubleApiA },
                { q: g.troubleBepinexQ, a: g.troubleBepinexA },
                { q: g.troubleCharsQ, a: g.troubleCharsA },
                { q: g.troubleBackupQ, a: g.troubleBackupA },
              ].map((faq, i) => (
                <Card key={i} className="border-amber-500/10 bg-slate-900/30">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs text-amber-300">{faq.q}</CardTitle>
                  </CardHeader>
                  <CardContent className="py-1 px-3 pb-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">{faq.a}</p>
                  </CardContent>
                </Card>
              ))}

              <Separator className="my-2 bg-slate-800" />

              {/* Engine specifici */}
              <h2 className="text-sm font-bold text-white flex items-center gap-2 px-1">
                <Gamepad2 className="h-4 w-4 text-emerald-400" />
                {g.engineGuideTitle}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { engine: 'Unity', tool: 'Unity Patcher', href: '/unity-patcher', desc: g.engineUnity, color: 'emerald' },
                  { engine: 'Unreal Engine 4/5', tool: 'UE Translator', href: '/unreal-translator', desc: g.engineUnreal, color: 'blue' },
                  { engine: 'RPG Maker (MV/MZ/VX)', tool: 'RPG Maker Patcher', href: '/rpgmaker-patcher', desc: g.engineRpgMaker, color: 'amber' },
                  { engine: "Ren'Py", tool: "Ren'Py Patcher", href: '/renpy-patcher', desc: g.engineRenpy, color: 'teal' },
                  { engine: 'Wolf RPG', tool: 'Wolf RPG Patcher', href: '/wolfrpg-patcher', desc: g.engineWolfRpg, color: 'orange' },
                  { engine: 'Telltale', tool: 'Telltale Patcher', href: '/telltale-patcher', desc: g.engineTelltale, color: 'violet' },
                  { engine: 'Godot', tool: 'Crawler + Fixer', href: '/crawler', desc: g.engineGodot, color: 'cyan' },
                  { engine: 'GameMaker', tool: 'Auto-Translate', href: '/auto-translate', desc: g.engineGameMaker, color: 'yellow' },
                ].map((e, i) => (
                  <Link key={i} href={e.href}>
                    <Card className="border-slate-800/50 bg-slate-900/30 hover:bg-slate-800/40 transition-colors cursor-pointer h-full">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-micro border-${e.color}-500/30 text-${e.color}-400 bg-${e.color}-500/10`}>
                            {e.engine}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-white">{e.tool}</p>
                        <p className="text-2xs text-muted-foreground mt-0.5">{e.desc}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
