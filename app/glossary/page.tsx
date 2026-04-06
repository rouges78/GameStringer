'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  BookOpen, Plus, Search, Trash2, Edit, Download, Upload, Sparkles,
  Lock, RefreshCw, Unlock, Filter, X, Save, FileJson, FileSpreadsheet,
  Wand2, CheckCircle, AlertTriangle, Info, Settings, ChevronDown,
  Edit3, FolderTree,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  loadGlossary, saveGlossary, createGlossary, deleteGlossary, listGlossaries,
  addTerm, updateTerm, deleteTerm, searchTerms, extractTerms,
  exportToCsv, exportToJson, importFromCsv, importFromJson,
  addDefaultTerms, loadGlossaryConfig, saveGlossaryConfig, getGlossaryConfig,
  checkConsistency,
  type AutoGlossary, type AutoGlossaryEntry, type GlossaryTier, type GlossaryCategory,
  type AutoGlossaryConfig,
} from '@/lib/auto-glossary';
import { useTranslation } from '@/lib/i18n';

const TIER_COLORS: Record<GlossaryTier, string> = {
  locked: 'bg-red-500/20 text-red-400 border-red-500/30',
  synced: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  flexible: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const TIER_ICONS: Record<GlossaryTier, React.ReactNode> = {
  locked: <Lock className="h-3 w-3" />,
  synced: <RefreshCw className="h-3 w-3" />,
  flexible: <Unlock className="h-3 w-3" />,
};

const CATEGORIES: GlossaryCategory[] = [
  'character', 'location', 'item', 'skill', 'quest',
  'ui', 'system', 'lore', 'creature', 'faction', 'other',
];

const CATEGORY_EMOJI: Record<GlossaryCategory, string> = {
  character: '👤', location: '📍', item: '🎒', skill: '⚔️', quest: '📜',
  ui: '🖥️', system: '⚙️', lore: '📚', creature: '🐉', faction: '🏰', other: '📌',
};

export default function GlossaryPage() {
  const { t } = useTranslation();
  const [glossaries, setGlossaries] = useState<AutoGlossary[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<GlossaryTier | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<GlossaryCategory | ''>('');
  const [config, setConfig] = useState<AutoGlossaryConfig>(getGlossaryConfig());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [editingTerm, setEditingTerm] = useState<AutoGlossaryEntry | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [activeTab, setActiveTab] = useState('terms');

  // Form state per aggiunta/modifica termine
  const [formSource, setFormSource] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formTier, setFormTier] = useState<GlossaryTier>('flexible');
  const [formCategory, setFormCategory] = useState<GlossaryCategory>('other');
  const [formContext, setFormContext] = useState('');
  const [formDoNotTranslate, setFormDoNotTranslate] = useState(false);

  // Form create glossary
  const [createGameId, setCreateGameId] = useState('');
  const [createGameName, setCreateGameName] = useState('');
  const [createSourceLang, setCreateSourceLang] = useState('en');
  const [createTargetLang, setCreateTargetLang] = useState('it');

  useEffect(() => {
    const saved = localStorage.getItem('gameStringerSettings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.translation?.defaultTargetLang) setCreateTargetLang(s.translation.defaultTargetLang);
      } catch {}
    }
  }, []);

  useEffect(() => {
    const loaded = loadGlossaryConfig();
    setConfig(loaded);
    refreshGlossaries();
  }, []);

  function refreshGlossaries() {
    const all = listGlossaries();
    setGlossaries(all);
    if (all.length > 0 && !selectedGameId) {
      setSelectedGameId(all[0].gameId);
    }
  }

  const selectedGlossary = useMemo(() => {
    if (!selectedGameId) return null;
    return loadGlossary(selectedGameId);
  }, [selectedGameId, glossaries]);

  const filteredTerms = useMemo(() => {
    if (!selectedGameId) return [];
    return searchTerms(
      selectedGameId,
      searchQuery,
      tierFilter || undefined,
      categoryFilter || undefined
    );
  }, [selectedGameId, searchQuery, tierFilter, categoryFilter, glossaries]);

  function handleCreateGlossary() {
    if (!createGameId || !createGameName) {
      toast.error('Inserisci ID e nome del gioco');
      return;
    }
    createGlossary(createGameId, createGameName, createSourceLang, createTargetLang);
    toast.success(`Glossario creato per ${createGameName}`);
    setShowCreateDialog(false);
    setCreateGameId('');
    setCreateGameName('');
    refreshGlossaries();
    setSelectedGameId(createGameId);
  }

  function handleAddTerm() {
    if (!selectedGameId || !formSource || !formTarget) {
      toast.error('Compila termine e traduzione');
      return;
    }

    if (editingTerm) {
      updateTerm(selectedGameId, editingTerm.id, {
        targetTerm: formTarget,
        tier: formTier,
        category: formCategory,
        context: formContext || undefined,
        doNotTranslate: formDoNotTranslate,
      });
      toast.success('Termine aggiornato');
    } else {
      const result = addTerm(selectedGameId, {
        sourceTerm: formSource,
        targetTerm: formDoNotTranslate ? formSource : formTarget,
        tier: formTier,
        category: formCategory,
        context: formContext || undefined,
        doNotTranslate: formDoNotTranslate,
        caseSensitive: formCategory === 'character' || formCategory === 'location',
        confidence: 95,
        autoExtracted: false,
      });
      if (!result) {
        toast.error('Termine duplicato');
        return;
      }
      toast.success('Termine aggiunto');
    }

    resetForm();
    setShowAddDialog(false);
    setEditingTerm(null);
    refreshGlossaries();
  }

  function handleDeleteTerm(termId: string) {
    if (!selectedGameId) return;
    deleteTerm(selectedGameId, termId);
    toast.success('Termine eliminato');
    refreshGlossaries();
  }

  function handleEditTerm(term: AutoGlossaryEntry) {
    setEditingTerm(term);
    setFormSource(term.sourceTerm);
    setFormTarget(term.targetTerm);
    setFormTier(term.tier);
    setFormCategory(term.category);
    setFormContext(term.context || '');
    setFormDoNotTranslate(term.doNotTranslate);
    setShowAddDialog(true);
  }

  function resetForm() {
    setFormSource('');
    setFormTarget('');
    setFormTier('flexible');
    setFormCategory('other');
    setFormContext('');
    setFormDoNotTranslate(false);
  }

  async function handleExtractTerms() {
    if (!selectedGlossary) return;
    setExtracting(true);

    try {
      // Usa testi di esempio per l'estrazione (in produzione verrebbero dai file del gioco)
      const sampleTexts = [
        'Press Start to begin your adventure',
        'Save your progress before entering the dungeon',
        'Your HP is low! Use a potion.',
        'The quest "Dragon Slayer" has been completed.',
      ];

      toast.info('Estrazione termini in corso...');

      const result = await extractTerms(
        selectedGlossary.gameId,
        selectedGlossary.gameName,
        sampleTexts,
        selectedGlossary.sourceLang,
        selectedGlossary.targetLang
      );

      if (result.newTerms.length > 0) {
        toast.success(`${result.newTerms.length} nuovi termini estratti (${result.duplicates} duplicati) via ${result.provider}`);
      } else {
        toast.info('Nessun nuovo termine trovato');
      }

      refreshGlossaries();
    } catch (err) {
      toast.error('Errore durante l\'estrazione');
      console.error(err);
    } finally {
      setExtracting(false);
    }
  }

  function handleAddDefaults() {
    if (!selectedGlossary) return;
    const count = addDefaultTerms(
      selectedGlossary.gameId,
      selectedGlossary.targetLang,
      undefined // genre
    );
    if (count > 0) {
      toast.success(`${count} termini di default aggiunti`);
      refreshGlossaries();
    } else {
      toast.info('Tutti i termini di default sono già presenti');
    }
  }

  function handleExport(format: 'csv' | 'json') {
    if (!selectedGameId) return;
    const content = format === 'csv' ? exportToCsv(selectedGameId) : exportToJson(selectedGameId);
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glossary_${selectedGameId}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Glossario esportato in ${format.toUpperCase()}`);
  }

  function handleImport(format: 'csv' | 'json') {
    if (!selectedGameId) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = format === 'csv' ? '.csv' : '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const content = await file.text();
      const count = format === 'csv'
        ? importFromCsv(selectedGameId, content)
        : importFromJson(selectedGameId, content);
      toast.success(`${count} termini importati`);
      refreshGlossaries();
    };
    input.click();
  }

  function handleDeleteGlossary() {
    if (!selectedGameId) return;
    deleteGlossary(selectedGameId);
    toast.success('Glossario eliminato');
    setSelectedGameId(null);
    refreshGlossaries();
  }

  function handleSaveConfig(updates: Partial<AutoGlossaryConfig>) {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    saveGlossaryConfig(updates);
  }

  return (
      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-purple-400" />
            <div>
              <h1 className="text-xl font-bold">{t('glossaryPage.autoGlossary')}</h1>
              <p className="text-xs text-muted-foreground">
                Estrai e gestisci terminologia di gioco per traduzioni consistenti
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Link href="/editor">
              <Button variant="outline" size="sm" className="text-slate-400 hover:text-blue-400">
                <Edit3 className="h-3.5 w-3.5 mr-1" />{t('subtitleTranslator.editor')}</Button>
            </Link>
            <Link href="/batch">
              <Button variant="outline" size="sm" className="text-slate-400 hover:text-sky-400">
                <FolderTree className="h-3.5 w-3.5 mr-1" />{t('aiTranslator.batch')}</Button>
            </Link>
            <div className="h-5 w-px bg-slate-700" />
            <Button variant="outline" size="sm" onClick={() => setShowConfigDialog(true)}>
              <Settings className="h-3.5 w-3.5 mr-1" />
              Config
            </Button>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Glossary
            </Button>
          </div>
        </div>

        {/* Glossary Selector */}
        {glossaries.length > 0 && (
          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">{t('glossaryPage.game')}</Label>
            <Select value={selectedGameId || ''} onValueChange={setSelectedGameId}>
              <SelectTrigger className="max-w-xs h-8 text-xs">
                <SelectValue placeholder="Select a game" />
              </SelectTrigger>
              <SelectContent>
                {glossaries.map(g => (
                  <SelectItem key={g.gameId} value={g.gameId} className="text-xs">
                    {g.gameName} ({g.entries.length} terms)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedGlossary && (
              <div className="flex gap-1.5">
                <Badge variant="outline" className="text-2xs">
                  {selectedGlossary.sourceLang.toUpperCase()} → {selectedGlossary.targetLang.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-2xs">
                  <Lock className="h-2.5 w-2.5 mr-0.5" />
                  {selectedGlossary.stats.lockedTerms}
                </Badge>
                <Badge variant="outline" className="text-2xs">
                  <RefreshCw className="h-2.5 w-2.5 mr-0.5" />
                  {selectedGlossary.stats.syncedTerms}
                </Badge>
                <Badge variant="outline" className="text-2xs">
                  <Unlock className="h-2.5 w-2.5 mr-0.5" />
                  {selectedGlossary.stats.flexibleTerms}
                </Badge>
              </div>
            )}
          </div>
        )}

        {glossaries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h2 className="text-lg font-semibold mb-1">{t('glossaryPage.noGlossaryYet')}</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Create a glossary for a game to start managing terminology
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                New Glossary
              </Button>
            </CardContent>
          </Card>
        ) : selectedGlossary && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-8">
              <TabsTrigger value="terms" className="text-xs px-3 py-1">
                Terms ({selectedGlossary.entries.length})
              </TabsTrigger>
              <TabsTrigger value="extract" className="text-xs px-3 py-1">
                Estrazione AI
              </TabsTrigger>
              <TabsTrigger value="io" className="text-xs px-3 py-1">
                Import/Export
              </TabsTrigger>
            </TabsList>

            {/* === TERMS TAB === */}
            <TabsContent value="terms" className="space-y-3 mt-3">
              {/* Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search" placeholder="Search terms..."
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as GlossaryTier | '')}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue placeholder={t('glossaryPage.tier')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" className="text-xs">{t('glossaryPage.allTiers')}</SelectItem>
                    <SelectItem value="locked" className="text-xs">{t('glossaryPage.locked')}</SelectItem>
                    <SelectItem value="synced" className="text-xs">{t('glossaryPage.synced')}</SelectItem>
                    <SelectItem value="flexible" className="text-xs">{t('glossaryPage.flexible')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as GlossaryCategory | '')}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder={t('playerFeedback.category')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" className="text-xs">{t('activity.all')}</SelectItem>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat} className="text-xs">
                        {CATEGORY_EMOJI[cat]} {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleAddDefaults}>
                  <Wand2 className="h-3.5 w-3.5 mr-1" />
                  Default
                </Button>
                <Button size="xs" className="text-xs" onClick={() => { resetForm(); setEditingTerm(null); setShowAddDialog(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" />{t('glossaryManager.add')}</Button>
              </div>

              {/* Term List */}
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_80px_90px_40px_60px] gap-2 px-3 py-2 bg-muted/30 text-2xs font-semibold text-muted-foreground uppercase">
                  <span>{t('offlineTranslator.original')}</span>
                  <span>{t('offlineTranslator.translation')}</span>
                  <span>{t('glossaryPage.tier')}</span>
                  <span>{t('playerFeedback.category')}</span>
                  <span>{t('glossaryPage.score')}</span>
                  <span className="text-right">{t('commandPalette.actions')}</span>
                </div>
                <div className="max-h-[500px] overflow-y-auto divide-y divide-border/50">
                  {filteredTerms.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      {searchQuery ? 'No terms found' : 'Empty glossary — add terms or use AI extraction'}
                    </div>
                  ) : (
                    filteredTerms.map(term => (
                      <div key={term.id} className="grid grid-cols-[1fr_1fr_80px_90px_40px_60px] gap-2 px-3 py-2 items-center hover:bg-muted/20 text-xs">
                        <span className="font-medium truncate" title={term.sourceTerm}>
                          {term.sourceTerm}
                        </span>
                        <span className={`truncate ${term.doNotTranslate ? 'text-muted-foreground italic' : ''}`} title={term.targetTerm}>
                          {term.doNotTranslate ? `[${term.sourceTerm}]` : term.targetTerm}
                        </span>
                        <Badge variant="outline" className={`text-micro ${TIER_COLORS[term.tier]}`}>
                          {TIER_ICONS[term.tier]}
                          <span className="ml-0.5">{term.tier}</span>
                        </Badge>
                        <span className="text-2xs text-muted-foreground">
                          {CATEGORY_EMOJI[term.category]} {term.category}
                        </span>
                        <span className="text-2xs text-muted-foreground">{term.confidence}</span>
                        <div className="flex gap-0.5 justify-end">
                          <Button variant="ghost" size="icon" aria-label="Modifica" className="h-6 w-6" onClick={() => handleEditTerm(term)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Elimina" className="h-6 w-6 text-red-400" onClick={() => handleDeleteTerm(term.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Stats Bar */}
              {selectedGlossary && selectedGlossary.entries.length > 0 && (
                <div className="flex items-center gap-4 text-2xs text-muted-foreground px-1">
                  <span>{selectedGlossary.entries.length} total terms</span>
                  <span>{selectedGlossary.stats.autoExtracted} auto-extracted</span>
                  <span>{selectedGlossary.stats.manuallyAdded} manual</span>
                  {Object.entries(selectedGlossary.stats.byCategory).slice(0, 4).map(([cat, count]) => (
                    <span key={cat}>{CATEGORY_EMOJI[cat as GlossaryCategory] || ''} {cat}: {count}</span>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* === EXTRACTION TAB === */}
            <TabsContent value="extract" className="space-y-4 mt-3">
              <Card className="border-purple-500/30 bg-gradient-to-r from-purple-950/20 to-indigo-950/20">
                <CardHeader className="pb-3">
                  <CardTitle as="h2" className="flex items-center gap-2 text-base">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                    Automatic Term Extraction
                    <Badge className="text-2xs bg-purple-600/80 text-white border-0">AI</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Analizza i testi del gioco con un LLM per identificare automaticamente nomi di personaggi,
                    luoghi, oggetti, skill e altri termini da tradurre in modo consistente.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 border border-white/5">
                    <Info className="h-4 w-4 text-blue-400 flex-shrink-0" />
                    <p className="text-[11px] text-muted-foreground">
                      L'estrazione usa il provider attivo nella chain di traduzione.
                      I termini estratti vengono classificati automaticamente per tier e categoria.
                      Puoi poi rivederli e modificarli manualmente.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleExtractTerms}
                      disabled={extracting}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {extracting ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                          Estrazione in corso...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-1.5" />
                          Extract Terms from Game
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleAddDefaults}>
                      <Wand2 className="h-4 w-4 mr-1.5" />
                      Add Default Terms
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground">{t('glossaryPage.thirdTierSystem')}</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Lock className="h-3.5 w-3.5 text-red-400" />
                          <span className="text-xs font-semibold text-red-400">LOCKED</span>
                        </div>
                        <p className="text-2xs text-muted-foreground">
                          Nomi propri, luoghi. Mai modificabili. Sempre identici ovunque.
                        </p>
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <div className="flex items-center gap-1.5 mb-1">
                          <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
                          <span className="text-xs font-semibold text-amber-400">SYNCED</span>
                        </div>
                        <p className="text-2xs text-muted-foreground">
                          UI, menu, sistema. Aggiornati insieme per consistenza.
                        </p>
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Unlock className="h-3.5 w-3.5 text-green-400" />
                          <span className="text-xs font-semibold text-green-400">FLEXIBLE</span>
                        </div>
                        <p className="text-2xs text-muted-foreground">
                          Dialoghi, descrizioni. Possono adattarsi al contesto.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* === IMPORT/EXPORT TAB === */}
            <TabsContent value="io" className="space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle as="h2" className="text-sm flex items-center gap-1.5">
                      <Download className="h-4 w-4" />{t('projects.export')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => handleExport('csv')}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Esporta CSV
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => handleExport('json')}>
                      <FileJson className="h-4 w-4 mr-2" />
                      Esporta JSON
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle as="h2" className="text-sm flex items-center gap-1.5">
                      <Upload className="h-4 w-4" />{t('glossaryManager.import')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => handleImport('csv')}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Importa CSV
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => handleImport('json')}>
                      <FileJson className="h-4 w-4 mr-2" />
                      Importa JSON
                    </Button>
                    <p className="text-2xs text-muted-foreground mt-1">
                      CSV: source,target,tier,category,doNotTranslate,context
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-red-500/20">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-medium text-red-400">{t('glossaryPage.deleteGlossary')}</p>
                    <p className="text-2xs text-muted-foreground">
                      Rimuove il glossario e tutti i termini per questo gioco
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={handleDeleteGlossary}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />{t('projects.delete')}</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* === ADD/EDIT TERM DIALOG === */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTerm ? 'Modifica Termine' : 'Aggiungi Termine'}</DialogTitle>
              <DialogDescription>
                {editingTerm ? 'Modifica la traduzione e le proprietà del termine' : 'Aggiungi un nuovo termine al glossario'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('glossaryManager.originalTerm')}</Label>
                <Input
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value)}
                  placeholder="es. Dragon Slayer"
                  className="text-xs h-8"
                  disabled={!!editingTerm}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formDoNotTranslate} onCheckedChange={setFormDoNotTranslate} />
                <Label className="text-xs">{t('glossaryPage.doNotTranslate')}</Label>
              </div>
              {!formDoNotTranslate && (
                <div className="space-y-1">
                  <Label className="text-xs">{t('offlineTranslator.translation')}</Label>
                  <Input
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    placeholder="es. Uccisore di Draghi"
                    className="text-xs h-8"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('glossaryPage.tier')}</Label>
                  <Select value={formTier} onValueChange={(v) => setFormTier(v as GlossaryTier)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="locked" className="text-xs">{t('glossaryPage.lockedDesc')}</SelectItem>
                      <SelectItem value="synced" className="text-xs">{t('glossaryPage.syncedDesc')}</SelectItem>
                      <SelectItem value="flexible" className="text-xs">{t('glossaryPage.flexibleDesc')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('playerFeedback.category')}</Label>
                  <Select value={formCategory} onValueChange={(v) => setFormCategory(v as GlossaryCategory)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat} className="text-xs">
                          {CATEGORY_EMOJI[cat]} {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('glossaryPage.contextOptional')}</Label>
                <Input
                  value={formContext}
                  onChange={(e) => setFormContext(e.target.value)}
                  placeholder="es. Nome del boss finale"
                  className="text-xs h-8"
                />
              </div>
              <Button className="w-full" onClick={handleAddTerm}>
                <Save className="h-4 w-4 mr-1" />
                {editingTerm ? 'Salva Modifiche' : 'Aggiungi Termine'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* === CREATE GLOSSARY DIALOG === */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('glossaryPage.newGlossary')}</DialogTitle>
              <DialogDescription>{t('glossaryPage.createForGame')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('glossaryPage.gameId')}</Label>
                <Input
                  value={createGameId}
                  onChange={(e) => setCreateGameId(e.target.value)}
                  placeholder="es. steam_12345"
                  className="text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('communityHub.gameName')}</Label>
                <Input
                  value={createGameName}
                  onChange={(e) => setCreateGameName(e.target.value)}
                  placeholder="es. Danganronpa"
                  className="text-xs h-8"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('aiTranslation.sourceLanguage')}</Label>
                  <Select value={createSourceLang} onValueChange={setCreateSourceLang}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t('languages.en')}</SelectItem>
                      <SelectItem value="ja">{t('glossaryPage.japanese')}</SelectItem>
                      <SelectItem value="zh">{t('glossaryPage.chinese')}</SelectItem>
                      <SelectItem value="ko">{t('glossaryPage.korean')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('glossaryPage.targetLanguage')}</Label>
                  <Select value={createTargetLang} onValueChange={setCreateTargetLang}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                      <SelectItem value="es">🇪🇸 Español</SelectItem>
                      <SelectItem value="fr">🇫🇷 Français</SelectItem>
                      <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                      <SelectItem value="pt">🇵🇹 Português</SelectItem>
                      <SelectItem value="pl">🇵🇱 Polski</SelectItem>
                      <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                      <SelectItem value="zh">🇨🇳 中文</SelectItem>
                      <SelectItem value="ja">🇯🇵 日本語</SelectItem>
                      <SelectItem value="ko">🇰🇷 한국어</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full" onClick={handleCreateGlossary}>
                <Plus className="h-4 w-4 mr-1" />
                Create Glossary
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* === CONFIG DIALOG === */}
        <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('glossaryPage.glossaryConfig')}</DialogTitle>
              <DialogDescription>{t('glossaryPage.impostazioniPerLestrazioneAuto')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">{t('glossaryPage.activeGlossary')}</Label>
                  <p className="text-2xs text-muted-foreground">{t('glossaryPage.enableAutoGlossary')}</p>
                </div>
                <Switch checked={config.enabled} onCheckedChange={(enabled) => handleSaveConfig({ enabled })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">{t('glossaryPage.promptInjection')}</Label>
                  <p className="text-2xs text-muted-foreground">{t('glossaryPage.addToPrompt')}</p>
                </div>
                <Switch checked={config.injectInPrompt} onCheckedChange={(injectInPrompt) => handleSaveConfig({ injectInPrompt })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">{t('glossaryPage.autoExtract')}</Label>
                  <p className="text-2xs text-muted-foreground">{t('glossaryPage.autoExtractDesc')}</p>
                </div>
                <Switch checked={config.autoExtractOnFirstBatch} onCheckedChange={(autoExtractOnFirstBatch) => handleSaveConfig({ autoExtractOnFirstBatch })} />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Max termini per estrazione: {config.maxTermsPerExtraction}</Label>
                <Slider
                  value={[config.maxTermsPerExtraction]}
                  onValueChange={(v) => handleSaveConfig({ maxTermsPerExtraction: v[0] })}
                  min={10}
                  max={100}
                  step={5}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Max termini nel prompt: {config.maxTermsInPrompt}</Label>
                <Slider
                  value={[config.maxTermsInPrompt]}
                  onValueChange={(v) => handleSaveConfig({ maxTermsInPrompt: v[0] })}
                  min={5}
                  max={50}
                  step={5}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Confidence minima: {config.minConfidence}%</Label>
                <Slider
                  value={[config.minConfidence]}
                  onValueChange={(v) => handleSaveConfig({ minConfidence: v[0] })}
                  min={30}
                  max={95}
                  step={5}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
}
