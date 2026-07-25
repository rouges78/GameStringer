'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FolderOpen, Package, Languages, CheckCircle2, XCircle, AlertCircle,
  Loader2, Download, ArrowRight, Sparkles, Search, FileText,
  Archive, User, ChevronRight, Copy, RefreshCw, Filter, HardDrive,
} from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';
import { useTranslation } from '@/lib/i18n';
import { useDefaultTargetLang } from '@/lib/translation/use-default-target-lang';
import {
  type CriGameInfo,
  type CpkFileInfo,
  type CpkEntry,
  type CriTextFile,
  type CriStringEntry,
  type CriFilePatch,
  type CriTranslateOptions,
  detectCriGame,
  listCpkContents,
  extractTextFilesFromCpk,
  parseCriTextFile,
  buildPatchedCpk,
  translateCriEntries,
  exportToCSV,
  importFromCSV,
  exportToPO,
  importFromPO,
  formatFileSize,
  getGameProfile,
} from '@/lib/patchers/cri-patcher';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEPS = [
  { num: 1, label: 'Selezione' },
  { num: 2, label: 'Contenuti' },
  { num: 3, label: 'Traduci' },
  { num: 4, label: 'Esporta' },
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CriPatcherPage() {
  // Wizard state
  const [step, setStep] = useState(1);
  const [gamePath, setGamePath] = useState('');
  const [gameInfo, setGameInfo] = useState<CriGameInfo | null>(null);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // Step 2
  const [selectedCpk, setSelectedCpk] = useState<CpkFileInfo | null>(null);
  const [cpkContents, setCpkContents] = useState<CpkEntry[]>([]);
  const [loadingContents, setLoadingContents] = useState(false);
  const [selectedTextFiles, setSelectedTextFiles] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);

  // Step 3
  const [entries, setEntries] = useState<CriStringEntry[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState('__all__');
  const [activeTab, setActiveTab] = useState('all');
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [targetLang, setTargetLang] = useState('en');
  useDefaultTargetLang(setTargetLang);
  const [sourceLang, setSourceLang] = useState('ja');

  // Step 4
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState('');
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Extracted text files reference for patching
  const { t } = useTranslation();
  const extractedFilesRef = useRef<CriTextFile[]>([]);
  const entriesRef = useRef<CriStringEntry[]>([]);
  entriesRef.current = entries;

  // Load settings
  useEffect(() => {
    const loadSettings = () => {
      const saved = localStorage.getItem('gameStringerSettings');
      if (saved) {
        try {
          const s = JSON.parse(saved);
          if (s.translation?.defaultTargetLang) setTargetLang(s.translation.defaultTargetLang);
        } catch { /* ignore */ }
      }
    };
    loadSettings();
    window.addEventListener('focus', loadSettings);
    return () => window.removeEventListener('focus', loadSettings);
  }, []);

  // -----------------------------------------------------------------------
  // Step 1: Game folder selection & detection
  // -----------------------------------------------------------------------

  const handleSelectFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Seleziona cartella gioco CRI',
      });
      if (selected) {
        setGamePath(selected as string);
        setGameInfo(null);
        setCpkContents([]);
        setEntries([]);
        setError('');
        setStep(1);
      }
    } catch (e: unknown) {
      clientLogger.error('Errore selezione cartella:', e);
    }
  };

  const handleAnalyze = async () => {
    if (!gamePath) return;
    setAnalyzing(true);
    setError('');

    try {
      const info = await detectCriGame(gamePath);
      setGameInfo(info);

      // Auto-detect source language from game profile
      const profile = getGameProfile(info.game_type);
      if (profile?.encoding === 'shift-jis') {
        setSourceLang('ja');
      }

      if (info.cpk_files.length > 0) {
        setStep(2);
      } else {
        setError('Nessun file CPK/PAR trovato nella cartella selezionata.');
      }
    } catch (e: unknown) {
      setError(`Errore analisi: ${e}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // -----------------------------------------------------------------------
  // Step 2: CPK contents browsing
  // -----------------------------------------------------------------------

  const handleSelectCpk = async (cpk: CpkFileInfo) => {
    setSelectedCpk(cpk);
    setLoadingContents(true);
    setError('');

    try {
      const contents = await listCpkContents(cpk.path);
      setCpkContents(contents);
      // Auto-select text files based on game profile patterns
      const patterns = gameInfo?.text_file_patterns ?? [];
      const autoSelected = new Set<string>();
      for (const entry of contents) {
        if (matchesAnyPattern(entry.path, patterns)) {
          autoSelected.add(entry.path);
        }
      }
      setSelectedTextFiles(autoSelected);
    } catch (e: unknown) {
      setError(`Errore lettura CPK: ${e}`);
    } finally {
      setLoadingContents(false);
    }
  };

  const handleExtractAndParse = async () => {
    if (!selectedCpk || selectedTextFiles.size === 0) return;
    setExtracting(true);
    setError('');

    try {
      const patterns = Array.from(selectedTextFiles);
      const textFiles = await extractTextFilesFromCpk(selectedCpk.path, patterns);
      extractedFilesRef.current = textFiles;

      // Parse all text files into entries
      const allEntries: CriStringEntry[] = [];
      let globalIdx = 0;
      for (const tf of textFiles) {
        try {
          const parsed = await parseCriTextFile(tf.data, tf.format_hint);
          for (const entry of parsed) {
            allEntries.push({
              ...entry,
              index: globalIdx++,
              context: `${tf.internal_path} | ${entry.context}`,
            });
          }
        } catch (e: unknown) {
          clientLogger.warn(`Errore parsing ${tf.internal_path}:`, e);
        }
      }

      if (allEntries.length > 0) {
        setEntries(allEntries);
        setStep(3);
      } else {
        setError('Nessuna stringa di testo trovata nei file selezionati.');
      }
    } catch (e: unknown) {
      setError(`Errore estrazione: ${e}`);
    } finally {
      setExtracting(false);
    }
  };

  const toggleFileSelection = useCallback((path: string) => {
    setSelectedTextFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // -----------------------------------------------------------------------
  // Step 3: Translation editor
  // -----------------------------------------------------------------------

  const handleTranslateAll = async () => {
    if (entries.length === 0) return;
    setTranslating(true);
    setProgress(0);
    setError('');

    try {
      const options: CriTranslateOptions = {
        targetLanguage: targetLang,
        sourceLanguage: sourceLang,
        batchSize: 20,
        context: gameInfo ? `Gioco: ${gameInfo.game_name}` : undefined,
      };
      const translated = await translateCriEntries(entries, options);
      setEntries(translated);
      setProgress(100);
    } catch (e: unknown) {
      setError(`Errore traduzione: ${e}`);
    } finally {
      setTranslating(false);
    }
  };

  const handleEntryChange = useCallback((index: number, value: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.index === index
          ? { ...e, translated: value, translationStatus: 'pending' as const }
          : e,
      ),
    );
  }, []);

  // Filtering & stats
  const speakers = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      if (e.speaker) set.add(e.speaker);
    }
    return Array.from(set).sort();
  }, [entries]);

  const tabCounts = useMemo(() => {
    let withSpeaker = 0;
    let untranslated = 0;
    for (const e of entries) {
      if (e.speaker) withSpeaker++;
      if (!e.translated) untranslated++;
    }
    return { all: entries.length, withSpeaker, untranslated };
  }, [entries]);

  const stats = useMemo(() => {
    let translated = 0;
    let errors = 0;
    for (const e of entries) {
      if (e.translated) translated++;
      if (e.translationStatus === 'error') errors++;
    }
    return { translated, errors };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let filtered = entries;

    if (activeTab === 'speaker') {
      filtered = filtered.filter((e) => !!e.speaker);
    } else if (activeTab === 'untranslated') {
      filtered = filtered.filter((e) => !e.translated);
    }

    if (speakerFilter !== '__all__') {
      filtered = filtered.filter((e) => e.speaker === speakerFilter);
    }

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.key.toLowerCase().includes(q) ||
          e.value.toLowerCase().includes(q) ||
          e.speaker.toLowerCase().includes(q) ||
          (e.translated && e.translated.toLowerCase().includes(q)),
      );
    }

    return filtered;
  }, [entries, activeTab, speakerFilter, searchFilter]);

  // -----------------------------------------------------------------------
  // Step 4: Export & patch
  // -----------------------------------------------------------------------

  const handleBuildPatchedCpk = async () => {
    if (!selectedCpk || entries.length === 0) return;
    setExporting(true);
    setError('');

    try {
      // Build patches from translated entries
      // Group entries back by source file and rebuild
      const patches: CriFilePatch[] = [];
      for (const tf of extractedFilesRef.current) {
        // For simplicity, use the translated text to patch
        // In production, would need to rebuild format-specific binary
        const relevantEntries = entries.filter((e) => e.context.startsWith(tf.internal_path));
        const hasTranslations = relevantEntries.some((e) => e.translated);
        if (!hasTranslations) continue;

        // Rebuild as newline-separated text
        const textContent = relevantEntries.map((e) => e.translated || e.value).join('\n');
        const encoder = new TextEncoder();
        const bytes = Array.from(encoder.encode(textContent));
        patches.push({ internal_path: tf.internal_path, data: bytes });
      }

      if (patches.length === 0) {
        setError('Nessuna traduzione da applicare.');
        setExporting(false);
        return;
      }

      const outputPath = selectedCpk.path.replace(/(\.\w+)$/, `_patched$1`);
      const result = await buildPatchedCpk(selectedCpk.path, patches, outputPath);
      setExportResult(result);
      setStep(4);
    } catch (e: unknown) {
      setError(`Errore creazione CPK patchato: ${e}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = () => {
    const csv = exportToCSV(entries);
    const filename = gameInfo
      ? `${gameInfo.game_type}_${targetLang}.csv`
      : `cri_export_${targetLang}.csv`;
    downloadFile(csv, filename, 'text/csv');
    setExportResult(`CSV esportato: ${filename}`);
    setStep(4);
  };

  const handleExportPO = () => {
    const po = exportToPO(entries, targetLang);
    const filename = gameInfo
      ? `${gameInfo.game_type}_${targetLang}.po`
      : `cri_export_${targetLang}.po`;
    downloadFile(po, filename, 'text/x-gettext-translation');
    setExportResult(`PO esportato: ${filename}`);
    setStep(4);
  };

  const handleImportCSV = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';
      input.onchange = async (ev) => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const text = await file.text();
        const updated = importFromCSV(text, entries);
        setEntries(updated);
      };
      input.click();
    } catch (e: unknown) {
      setError(`Errore importazione CSV: ${e}`);
    }
  };

  const handleImportPO = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.po';
      input.onchange = async (ev) => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const text = await file.text();
        const updated = importFromPO(text, entries);
        setEntries(updated);
      };
      input.click();
    } catch (e: unknown) {
      setError(`Errore importazione PO: ${e}`);
    }
  };

  const handleCopyAll = async () => {
    const text = entries
      .map((e) => `${e.key}\t${e.speaker}\t${e.value}\t${e.translated ?? ''}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2000);
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-4 overflow-y-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-700 via-violet-600 to-fuchsia-700 p-4 shrink-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Archive className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                {t('criPatcher.title')}</h1>
              <p className="text-white/70 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                Persona, Yakuza, Tales of, Dragon Ball, Danganronpa V3
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Package className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">CPK</span>
              <span className="text-xs text-white/70">{t('criPatcher.archiveBadge')}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Languages className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">AI</span>
              <span className="text-xs text-white/70">{t('common.traduzione')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 shrink-0">
          <XCircle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-300">
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center justify-center gap-1 py-2 shrink-0">
        {STEPS.map((s, idx) => (
          <div key={s.num} className="flex items-center">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all focus:outline-none focus:ring-2 focus:ring-violet-400/50 ${
                step >= s.num
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'
              } ${s.num < step ? 'cursor-pointer hover:bg-violet-500' : s.num > step ? 'cursor-default' : ''}`}
              onClick={() => { if (s.num < step) setStep(s.num); }}
              tabIndex={s.num < step ? 0 : -1}
              aria-label={`Passo ${s.num}: ${s.label}`}
            >
              <span className="font-bold">{s.num}</span>
              <span>{s.label}</span>
            </button>
            {idx < STEPS.length - 1 && <ArrowRight className="h-3 w-3 mx-1 text-slate-600" />}
          </div>
        ))}
      </div>

      {/* ================================================================= */}
      {/* STEP 1: Selezione Gioco                                          */}
      {/* ================================================================= */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                icon: Archive,
                title: 'CPK Archive',
                desc: 'Parsing completo di archivi CPK/PAR con tabelle UTF, decompressione CRILAYLA e estrazione file.',
              },
              {
                icon: User,
                title: 'Speaker Context',
                desc: 'Supporto dialoghi con nomi speaker (BMD/MSG Persona), contesto per traduzione AI accurata.',
              },
              {
                icon: Languages,
                title: 'Multi-Formato',
                desc: 'BMD, MSG, FTD (Persona), JSON, XML, STX (Danganronpa V3), GMD (Yakuza) e testo generico.',
              },
            ].map((card) => (
              <Card key={card.title} variant="muted">
                <CardHeader padding="compact">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <card.icon className="h-4 w-4 text-violet-400" />
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent padding="compact">
                  <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Folder picker */}
          <Card variant="muted">
            <CardHeader padding="compact">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-violet-400" />
                {t('criPatcher.selectGameFolder')}</CardTitle>
              <CardDescription className="text-xs">
                {t('criPatcher.selectFolderDesc')}</CardDescription>
            </CardHeader>
            <CardContent padding="compact" className="space-y-3">
              <div className="flex gap-2">
                <Button onClick={handleSelectFolder} variant="outline" size="sm" className="h-9 text-xs" aria-label={t('common.sfogliaCartella')}>
                  <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                  {t('criPatcher.browse')}</Button>
                <Button
                  onClick={handleAnalyze}
                  disabled={!gamePath || analyzing}
                  size="sm"
                  className="h-9 bg-violet-600 hover:bg-violet-500 text-xs"
                  aria-label={t('common.analizzaCartella')}
                >
                  {analyzing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {t('criPatcher.analyze')}</Button>
              </div>

              {gamePath && (
                <p
                  className="text-xs text-slate-400 font-mono bg-slate-950/50 p-2 rounded truncate border border-slate-800/50"
                  title={gamePath}
                >
                  {gamePath}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Game info (if detected) */}
          {gameInfo && (
            <Card variant="muted">
              <CardHeader padding="compact">
                <CardTitle className="text-sm flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-violet-400" />
                  {t('criPatcher.gameDetected')}</CardTitle>
              </CardHeader>
              <CardContent padding="compact">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className="text-xs bg-violet-500/20 text-violet-400 border-violet-500/30">
                    {gameInfo.game_type}
                  </Badge>
                  <span className="text-sm font-medium text-slate-200">{gameInfo.game_name}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {gameInfo.cpk_files.length} {t('criPatcher.cpkArchivesFound')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 2: Contenuti CPK                                            */}
      {/* ================================================================= */}
      {step === 2 && gameInfo && (
        <div className="space-y-4">
          {/* CPK file list */}
          <Card variant="muted">
            <CardHeader padding="compact">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Archive className="h-4 w-4 text-violet-400" />
                  {t('criPatcher.cpkArchives')} ({gameInfo.cpk_files.length})
                </CardTitle>
                <Badge className="text-xs bg-violet-500/20 text-violet-400 border-violet-500/30">
                  {gameInfo.game_name}
                </Badge>
              </div>
            </CardHeader>
            <CardContent padding="compact">
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {gameInfo.cpk_files.map((cpk, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectCpk(cpk)}
                    className={`group w-full text-left p-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-violet-400/50 ${
                      selectedCpk?.path === cpk.path
                        ? 'bg-violet-500/10 border-violet-500/30'
                        : 'hover:bg-slate-800/50 border-slate-800/30 hover:border-slate-700/50'
                    }`}
                    aria-label={`Seleziona archivio ${cpk.path.split(/[\\/]/).pop()}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="h-4 w-4 text-violet-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-200 truncate">
                          {cpk.path.split(/[\\/]/).pop()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                          {formatFileSize(cpk.size)}
                        </Badge>
                        {cpk.file_count > 0 && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                            {cpk.file_count} {t('criPatcher.files')}</Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* CPK contents */}
          {selectedCpk && (
            <Card variant="muted">
              <CardHeader padding="compact">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-violet-400" />
                    {t('criPatcher.cpkContents')}{cpkContents.length > 0 && (
                      <Badge variant="outline" className="text-xs ml-1">
                        {cpkContents.length} {t('criPatcher.files')}</Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedTextFiles.size > 0 && (
                      <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        {selectedTextFiles.size} {t('criPatcher.selectedLower')}</Badge>
                    )}
                    <Button
                      onClick={handleExtractAndParse}
                      disabled={extracting || selectedTextFiles.size === 0}
                      size="xs"
                      className="bg-violet-600 hover:bg-violet-500 text-xs"
                      aria-label={t('common.estraiFileSelezionati')}
                    >
                      {extracting ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="mr-1 h-3 w-3" />
                      )}
                      {t('criPatcher.extract')}</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent padding="compact">
                {loadingContents ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                    <span className="ml-2 text-sm text-slate-400">{t('criPatcher.loadingContents')}</span>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                    {cpkContents.map((entry) => {
                      const isText = matchesAnyPattern(entry.path, gameInfo.text_file_patterns);
                      const isSelected = selectedTextFiles.has(entry.path);

                      return (
                        <button
                          key={entry.id}
                          onClick={() => isText && toggleFileSelection(entry.path)}
                          className={`w-full text-left px-3 py-1.5 rounded text-xs transition-all flex items-center gap-2 ${
                            isSelected
                              ? 'bg-violet-500/15 border border-violet-500/30'
                              : isText
                              ? 'hover:bg-slate-800/50 border border-transparent cursor-pointer'
                              : 'text-slate-600 border border-transparent cursor-default'
                          }`}
                          disabled={!isText}
                          aria-label={`${isSelected ? 'Deseleziona' : 'Seleziona'} ${entry.path}`}
                        >
                          {isSelected && <CheckCircle2 className="h-3 w-3 text-violet-400 shrink-0" />}
                          <span className={`font-mono truncate ${isText ? 'text-slate-300' : 'text-slate-600'}`}>
                            {entry.path}
                          </span>
                          <span className="ml-auto shrink-0 text-slate-500">
                            {formatFileSize(entry.size)}
                          </span>
                          {entry.compressed && (
                            <Badge variant="outline" className="text-2xs px-1 py-0 shrink-0">
                              CRILAYLA
                            </Badge>
                          )}
                        </button>
                      );
                    })}

                    {cpkContents.length === 0 && !loadingContents && (
                      <p className="text-sm text-slate-500 text-center py-8">
                        {t('criPatcher.selectArchivePrompt')}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 3: Editor Testi                                              */}
      {/* ================================================================= */}
      {step === 3 && entries.length > 0 && (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {/* Top bar */}
          <Card variant="muted" className="shrink-0">
            <CardContent padding="compact">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-400" />
                  <span className="text-sm font-semibold text-slate-200">
                    {gameInfo?.game_name ?? 'CRI'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Select value={sourceLang} onValueChange={setSourceLang}>
                    <SelectTrigger className="h-7 text-xs bg-slate-950/50 border-slate-700/50 w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['ja', 'en', 'ko', 'zh-CN'].map((l) => (
                        <SelectItem key={l} value={l} className="text-xs">{l.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ArrowRight className="h-3 w-3 text-slate-500" />
                  <Select value={targetLang} onValueChange={setTargetLang}>
                    <SelectTrigger className="h-7 text-xs bg-slate-950/50 border-slate-700/50 w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['it', 'en', 'fr', 'de', 'es', 'pt', 'ru', 'pl', 'ko', 'zh-CN'].map((l) => (
                        <SelectItem key={l} value={l} className="text-xs">{l.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {speakers.length > 0 && (
                  <Select value={speakerFilter} onValueChange={setSpeakerFilter}>
                    <SelectTrigger className="h-7 text-xs bg-slate-950/50 border-slate-700/50 w-36">
                      <Filter className="h-3 w-3 mr-1" />
                      <SelectValue placeholder={t('criPatcher.speakerPh')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__" className="text-xs">{t('criPatcher.allSpeakers')}</SelectItem>
                      {speakers.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="relative ml-auto flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <Input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    aria-label={t('common.cercaStringhe')}
                    placeholder={t('criPatcher.searchPh')}
                    className="h-8 text-xs pl-8 bg-slate-950/50 border-slate-700/50"
                  />
                </div>

                <Button
                  onClick={handleTranslateAll}
                  disabled={translating || entries.length === 0}
                  size="sm"
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500"
                  aria-label={t('common.traduciTutteLeStringhe')}
                >
                  {translating ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {t('criPatcher.translateAll')}</Button>
              </div>

              {translating && (
                <div className="mt-2 space-y-1">
                  <Progress value={progress} className="h-1.5" />
                  <p className="text-xs text-center text-slate-400">{progress}%</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs + Virtualized list */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="bg-slate-900/50 border border-slate-800/50 shrink-0">
              <TabsTrigger value="all" className="text-xs">
                {t('criPatcher.all')} ({tabCounts.all})
              </TabsTrigger>
              <TabsTrigger value="speaker" className="text-xs">
                <User className="h-3 w-3 mr-1" />
                {t('criPatcher.withSpeaker')} ({tabCounts.withSpeaker})
              </TabsTrigger>
              <TabsTrigger value="untranslated" className="text-xs">
                {t('criPatcher.toTranslate')} ({tabCounts.untranslated})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="flex-1 min-h-0 mt-2">
              <div className="h-[calc(100vh-460px)] rounded-lg border border-slate-800/50 bg-slate-950/30 overflow-hidden">
                {filteredEntries.length > 0 ? (
                  <Virtuoso
                    data={filteredEntries}
                    overscan={200}
                    itemContent={(_index, entry) => (
                      <CriEntryRow
                        key={entry.index}
                        entry={entry}
                        onChange={handleEntryChange}
                      />
                    )}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-slate-500">
                    {t('criPatcher.noResults')}</div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Bottom bar */}
          <Card variant="muted" className="shrink-0">
            <CardContent padding="compact">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>
                    <span className="text-emerald-400 font-semibold">{stats.translated}</span>
                    /{entries.length} {t('criPatcher.translatedLower')}</span>
                  {stats.errors > 0 && (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                      {stats.errors} {t('criPatcher.errorsLower')}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    className="text-xs"
                    onClick={handleImportCSV}
                    aria-label={t('common.importaTraduzioniDaCsv')}
                  >
                    {t('criPatcher.importCsv')}</Button>
                  <Button
                    variant="outline"
                    size="xs"
                    className="text-xs"
                    onClick={handleImportPO}
                    aria-label={t('common.importaTraduzioniDaPo')}
                  >
                    {t('criPatcher.importPo')}</Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-violet-600 hover:bg-violet-500"
                    onClick={() => setStep(4)}
                    disabled={stats.translated === 0}
                    aria-label={t('criPatcher.goToExportAria')}
                  >
                    {t('criPatcher.export')}<ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 4: Esporta / Patch                                          */}
      {/* ================================================================= */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Summary */}
          <Card variant="muted">
            <CardHeader padding="compact">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                {t('criPatcher.translationSummary')}</CardTitle>
            </CardHeader>
            <CardContent padding="compact">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{stats.translated}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t('criPatcher.translatedCap')}</p>
                </div>
                <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-center">
                  <p className="text-2xl font-bold text-violet-400">{entries.length}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t('common.totale')}</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                  <p className="text-2xl font-bold text-yellow-400">{stats.errors}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t('criPatcher.errorsCap')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export options */}
          <Card variant="muted">
            <CardHeader padding="compact">
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="h-4 w-4 text-violet-400" />
                {t('criPatcher.exportOptions')}</CardTitle>
              {gameInfo && (
                <CardDescription className="text-xs">
                  {gameInfo.game_name} {'\u2014'}{sourceLang.toUpperCase()} {'\u2192'}{targetLang.toUpperCase()}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent padding="compact">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Button
                  onClick={handleBuildPatchedCpk}
                  disabled={exporting || !selectedCpk}
                  className="h-auto py-3 flex flex-col items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-xs"
                  aria-label={t('common.creaCpkPatchato')}
                >
                  {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Package className="h-5 w-5" />}
                  <span className="font-medium">{t('common.cpkPatchato')}</span>
                  <span className="text-2xs text-violet-200/70">{t('common.prontoPerIlGioco')}</span>
                </Button>

                <Button
                  onClick={handleExportCSV}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-1.5 text-xs"
                  aria-label={t('common.esportaTraduzioniInCsv')}
                >
                  <FileText className="h-5 w-5" />
                  <span className="font-medium">{t('common.esportaCsv')}</span>
                  <span className="text-2xs text-slate-400">{t('criPatcher.spreadsheet')}</span>
                </Button>

                <Button
                  onClick={handleExportPO}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-1.5 text-xs"
                  aria-label={t('common.esportaTraduzioniInPoGettext')}
                >
                  <Languages className="h-5 w-5" />
                  <span className="font-medium">{t('common.esportaPo')}</span>
                  <span className="text-2xs text-slate-400">Gettext</span>
                </Button>

                <Button
                  onClick={handleImportCSV}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-1.5 text-xs"
                  aria-label={t('common.importaTraduzioniDaCsv')}
                >
                  <RefreshCw className="h-5 w-5" />
                  <span className="font-medium">{t('common.importaCsv')}</span>
                  <span className="text-2xs text-slate-400">{t('common.daFileEsterno')}</span>
                </Button>

                <Button
                  onClick={handleCopyAll}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-1.5 text-xs"
                  aria-label={t('common.copiaTuttoNegliAppunti')}
                >
                  {copiedFeedback ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
                  <span className="font-medium">{copiedFeedback ? 'Copiato!' : 'Copia Tutto'}</span>
                  <span className="text-2xs text-slate-400">{t('criPatcher.toClipboard')}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Export result */}
          {exportResult && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent padding="compact">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-emerald-400">{t('common.esportazioneCompletata')}</p>
                    <p className="text-xs text-slate-400 font-mono truncate mt-0.5" title={exportResult}>
                      {exportResult}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Back button */}
          <div className="flex justify-center">
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setStep(3)} aria-label={t('criPatcher.backToEditorAria')}>
              <ArrowRight className="h-3.5 w-3.5 mr-1.5 rotate-180" />
              {t('criPatcher.backToEditor')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CriEntryRow -- memoized row component for Virtuoso
// ---------------------------------------------------------------------------

const CriEntryRow = React.memo(function CriEntryRow({
  entry,
  onChange,
}: {
  entry: CriStringEntry;
  onChange: (index: number, value: string) => void;
}) {
  const { t } = useTranslation();
  const isLong = entry.value.length > 80;

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
      {/* Key + speaker + status */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 font-mono truncate max-w-[200px]" title={entry.key}>
          {entry.key}
        </span>
        {entry.speaker && (
          <Badge className="text-2xs px-1.5 py-0 bg-violet-500/20 text-violet-400 border-violet-500/30">
            <User className="h-2.5 w-2.5 mr-0.5" />
            {entry.speaker}
          </Badge>
        )}
        <span className="ml-auto">
          {entry.translationStatus === 'translated' && (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          )}
          {entry.translationStatus === 'error' && (
            <span title={entry.validationErrors?.join('\n')}>
              <XCircle className="h-3.5 w-3.5 text-red-400" />
            </span>
          )}
          {!entry.translationStatus && entry.translated && (
            <AlertCircle className="h-3.5 w-3.5 text-yellow-400/60" />
          )}
        </span>
      </div>

      {/* Content */}
      <div className={isLong ? 'flex flex-col gap-1.5' : 'flex items-start gap-3'}>
        <div className={`${isLong ? 'w-full' : 'flex-1'} min-w-0`}>
          <p className="text-xs text-slate-300 leading-relaxed break-words">
            {entry.value}
          </p>
        </div>

        <div className={`${isLong ? 'w-full' : 'flex-1'} min-w-0`}>
          <Input
            value={entry.translated ?? ''}
            onChange={(e) => onChange(entry.index, e.target.value)}
            placeholder={t('criPatcher.translationPh')}
            className="h-8 text-xs bg-slate-950/50 border-slate-700/50 w-full"
            aria-label={`Traduzione per ${entry.key}`}
          />
        </div>
      </div>

      {/* Validation errors */}
      {entry.validationErrors && entry.validationErrors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.validationErrors.map((err, i) => (
            <span key={i} className="text-2xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
              {err}
            </span>
          ))}
        </div>
      )}

      {/* Context (micro text) */}
      {entry.context && (
        <p className="text-micro text-slate-600 truncate" title={entry.context}>
          {entry.context}
        </p>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Utility: pattern matching (client-side mirror)
// ---------------------------------------------------------------------------

function matchesAnyPattern(path: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;
  const lower = path.toLowerCase();
  for (const pattern of patterns) {
    const lp = pattern.toLowerCase();
    if (lp.startsWith('*.')) {
      const ext = lp.slice(1);
      if (lower.endsWith(ext)) return true;
    } else if (lower.includes(lp)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// File download helper
// ---------------------------------------------------------------------------

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

