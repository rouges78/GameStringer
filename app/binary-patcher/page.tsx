'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { set, get, del } from 'idb-keyval';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { invoke } from '@/lib/tauri-api';
import {
  FileCode2, Upload, Languages, Play, Download, Save,
  Search, AlertTriangle,
  CheckCircle2, XCircle, Loader2, Binary, Zap,
  ArrowRight, Eye, EyeOff, BarChart3,
  Gamepad2, Bot, Sparkles, Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  extractStringsFromBuffer,
  detectAntiCheat,
  translateStrings,
  applyPatch,
  fitToByteLength,
  getProjectStats,
  createProject,
  exportProject,
  importProject,
  type PatchProject,
  type AntiCheatResult,
} from '@/lib/binary-string-patcher';
import {
  translateWithFallbackBatched,
  CHAIN_PRESETS,
  setChainPreset,
  getChainPreset,
  hasAvailableProviders,
  type ChainPreset,
} from '@/lib/ai-translate-direct';
import { addCorrection } from '@/lib/adaptive-mt';
import { clientLogger } from '@/lib/client-logger';

type Step = 'load' | 'extract' | 'translate' | 'review' | 'patch';

const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Español', de: 'Deutsch', fr: 'Français',
  it: 'Italiano', pt: 'Português', ja: '日本語', zh: '中文',
  ko: '한국어', ru: 'Русский', unknown: 'Sconosciuta',
};

const CATEGORY_COLORS: Record<string, string> = {
  enemy: 'bg-red-500/20 text-red-400',
  ability: 'bg-purple-500/20 text-purple-400',
  stat: 'bg-blue-500/20 text-blue-400',
  item: 'bg-amber-500/20 text-amber-400',
  ui: 'bg-green-500/20 text-green-400',
  dialogue: 'bg-cyan-500/20 text-cyan-400',
  gameplay: 'bg-orange-500/20 text-orange-400',
  debug: 'bg-zinc-500/20 text-zinc-400',
  engine: 'bg-zinc-500/20 text-zinc-400',
  unknown: 'bg-zinc-500/20 text-zinc-400',
};

const CATEGORY_NAMES: Record<string, string> = {
  enemy: 'Nemici', ability: 'Abilità', stat: 'Statistiche',
  item: 'Oggetti', ui: 'Interfaccia', dialogue: 'Dialoghi',
  gameplay: 'Gameplay', debug: 'Debug', engine: 'Engine', unknown: 'Altro',
};

export default function BinaryPatcherPage() {
  const { t, language } = useTranslation();
  const searchParams = useSearchParams();

  // State
  const [step, setStep] = useState<Step>('load');
  const [fileName, setFileName] = useState('');
  const [fileBuffer, setFileBuffer] = useState<Uint8Array | null>(null);
  const [_gameFiles, _setGameFiles] = useState<string[]>([]);
  const [antiCheat, setAntiCheat] = useState<AntiCheatResult | null>(null);
  const [project, setProject] = useState<PatchProject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLang, setFilterLang] = useState<string>('all');
  const [showTranslatedOnly, setShowTranslatedOnly] = useState(false);
  const [targetLang, setTargetLang] = useState('it');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [gameName, setGameName] = useState('');
  const [gamePath, setGamePath] = useState('');
  const [_detectedBinaries, setDetectedBinaries] = useState<{name: string; path: string; size: number}[]>([]);
  const [autoLoadLog, setAutoLoadLog] = useState<string[]>([]);
  const [translationMode, setTranslationMode] = useState<'ai' | 'rule'>('ai');
  const [chainPreset, setChainPresetState] = useState<ChainPreset>(getChainPreset() as ChainPreset);
  const [translationLog, setTranslationLog] = useState<string[]>([]);
  const [translationStopped, setTranslationStopped] = useState(false);
  const cancelTranslationRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const autoLoadedRef = useRef(false);
  const resumePendingRef = useRef(false);
  const [savedCheckpoint, setSavedCheckpoint] = useState<{
    project: PatchProject; translatedCount: number; totalCount: number;
    savedAt: number; targetLang: string; fileName: string;
  } | null>(null);

  // ============================================================
  // CHECKPOINT: SAVE / LOAD / CLEAR
  // ============================================================
  const getCheckpointKey = useCallback(() => {
    const name = gameName || fileName;
    if (!name) return null;
    return `gs_binpatch_checkpoint_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${targetLang}`;
  }, [gameName, fileName, targetLang]);

  const saveBinCheckpoint = useCallback(async (proj: PatchProject) => {
    const key = getCheckpointKey();
    if (!key) return;
    try {
      const translatedCount = proj.strings.filter(s => s.translated).length;
      await set(key, {
        project: proj,
        fileName: proj.fileName,
        gameName: proj.gameName,
        targetLang: proj.targetLang,
        totalCount: proj.strings.length,
        translatedCount,
        savedAt: Date.now(),
      });
      clientLogger.debug(`[BinPatch Checkpoint] Salvato: ${translatedCount} stringhe tradotte`);
    } catch (e: unknown) {
      clientLogger.warn('[BinPatch Checkpoint] Errore salvataggio:', e);
    }
  }, [getCheckpointKey]);

  const loadBinCheckpoint = useCallback(async () => {
    const name = gameName || fileName;
    if (!name) return;
    // Cerca checkpoint per qualsiasi lingua target
    const langs = ['it', 'en', 'es', 'de', 'fr', 'pt', 'ja', 'ko', 'zh', 'ru'];
    for (const lang of langs) {
      const key = `gs_binpatch_checkpoint_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${lang}`;
      try {
        const saved = await get(key);
        if (saved?.project?.strings?.length > 0 && saved.translatedCount > 0) {
          setSavedCheckpoint(saved);
          clientLogger.debug(`[BinPatch Checkpoint] Trovato: ${saved.translatedCount}/${saved.totalCount} (${lang})`);
          return;
        }
      } catch {}
    }
  }, [gameName, fileName]);

  const clearBinCheckpoint = useCallback(async () => {
    const key = getCheckpointKey();
    if (key) await del(key);
    setSavedCheckpoint(null);
  }, [getCheckpointKey]);

  // ============================================================
  // Auto-detect dal URL params (?game=X&path=Y)
  // ============================================================
  const addLog = useCallback((msg: string) => {
    setAutoLoadLog(prev => [...prev, msg]);
  }, []);

  const autoLoadFromPath = useCallback(async (installPath: string, name: string) => {
    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;

    setGameName(name);
    setGamePath(installPath);
    setIsProcessing(true);
    addLog(`🎮 Gioco: ${name}`);
    addLog(`📁 Path: ${installPath}`);

    try {
      // 1. Scan per file nella cartella
      addLog('🔍 Scansione file binari...');
      let allFiles: { path: string; name: string; size: number; extension: string }[] = [];
      try {
        allFiles = await invoke<typeof allFiles>('scan_localization_files', {
          path: installPath, extensions: ['exe', 'dll'], maxDepth: 2
        }) || [];
      } catch {
        addLog('⚠️ Scan Tauri fallita, provo alternativa...');
        try {
          const exes = await invoke<string[]>('find_executables_in_folder', { folderPath: installPath });
          allFiles = (exes || []).map(p => ({
            path: p, name: p.split('\\').pop() || p, size: 0, extension: 'exe'
          }));
        } catch { /* fallback below */ }
      }

      if (allFiles.length === 0) {
        addLog('❌ Nessun binario trovato nella cartella');
        setIsProcessing(false);
        setStep('load');
        return;
      }

      // Filtra: ignora crash handler, launcher, steam_api, uninstaller
      const IGNORE = ['crash', 'launcher', 'unins', 'steam_api', 'vc_redist', 'dxsetup', 'dotnet'];
      const binaries = allFiles
        .filter(f => !IGNORE.some(ig => f.name.toLowerCase().includes(ig)))
        .sort((a, b) => b.size - a.size);

      setDetectedBinaries(binaries.map(f => ({ name: f.name, path: f.path, size: f.size })));
      addLog(`📦 Trovati ${binaries.length} binari (${allFiles.length} totali)`);

      // 2. Anti-cheat check
      const fileNames = allFiles.map(f => f.name);
      const acResult = detectAntiCheat(fileNames);
      setAntiCheat(acResult);
      if (!acResult.safe) {
        addLog(`⚠️ Anti-cheat rilevato: ${acResult.detected.join(', ')}`);
      } else {
        addLog('✅ Nessun anti-cheat rilevato');
      }

      // 3. Prendi il binario più grande (probabile exe di gioco)
      const mainBin = binaries[0];
      if (!mainBin) {
        addLog('❌ Nessun binario valido trovato');
        setIsProcessing(false);
        setStep('load');
        return;
      }

      addLog(`📖 Caricamento ${mainBin.name} (${(mainBin.size / 1024 / 1024).toFixed(1)} MB)...`);
      setFileName(mainBin.name);

      // 4. Leggi il file via Tauri
      let buffer: Uint8Array;
      try {
        // Prova prima read_binary_file_base64 (se backend ricompilato)
        const base64 = await invoke<string>('read_binary_file_base64', { path: mainBin.path });
        const binaryStr = atob(base64);
        buffer = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) buffer[i] = binaryStr.charCodeAt(i);
      } catch {
        addLog('⚠️ read_binary_file_base64 non disponibile, uso read_text_file...');
        try {
          // Fallback: read_text_file legge con from_utf8_lossy — perdiamo byte non-UTF8
          // ma per stringhe di testo funziona bene
          const rawText = await invoke<string>('read_text_file', { path: mainBin.path, maxBytes: 50000000 });
          const encoder = new TextEncoder();
          buffer = encoder.encode(rawText);
          addLog(`⚠️ Letto via text fallback (${(buffer.length / 1024 / 1024).toFixed(1)} MB) — alcuni byte non-UTF8 potrebbero essere persi`);
        } catch (e2) {
          addLog(`❌ Impossibile leggere il binario: ${e2 instanceof Error ? e2.message : String(e2)}`);
          addLog('📁 Caricalo manualmente con il bottone qui sotto.');
          setIsProcessing(false);
          setStep('load');
          return;
        }
      }

      setFileBuffer(buffer);
      addLog(`✅ File caricato: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

      // 5. Estrai stringhe
      addLog('🔍 Estrazione stringhe...');
      setProgress({ current: 50, total: 100, label: 'Estrazione stringhe...' });

      await new Promise<void>(resolve => {
        setTimeout(() => {
          const strings = extractStringsFromBuffer(buffer, {
            minLength: 8, includeUtf8: true, filterNoise: true, detectLanguage: true,
          });

          // Rileva lingua dominante
          const langCounts: Record<string, number> = {};
          for (const s of strings) {
            const lang = s.language || 'unknown';
            langCounts[lang] = (langCounts[lang] || 0) + 1;
          }
          const sourceLang = Object.entries(langCounts)
            .filter(([k]) => k !== 'unknown')
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'en';

          addLog(`✅ ${strings.length} stringhe estratte`);
          addLog(`🌍 Lingua rilevata: ${LANG_NAMES[sourceLang] || sourceLang} (${langCounts[sourceLang] || 0} stringhe)`);
          if (Object.keys(langCounts).length > 1) {
            addLog(`   Altre lingue: ${Object.entries(langCounts).filter(([k]) => k !== sourceLang).map(([k, v]) => `${LANG_NAMES[k] || k}: ${v}`).join(', ')}`);
          }

          const proj = createProject(name, mainBin.name, mainBin.path, buffer, sourceLang, targetLang);
          proj.strings = strings;
          setProject(proj);
          setStep('translate');
          setProgress({ current: 100, total: 100, label: `${strings.length} stringhe estratte` });
          resolve();
        }, 50);
      });
    } catch (err: unknown) {
      addLog(`❌ Errore: ${err instanceof Error ? err.message : String(err)}`);
      setStep('load');
    } finally {
      setIsProcessing(false);
    }
  }, [addLog, targetLang]);

  // Auto-load on mount se URL params presenti
  useEffect(() => {
    const path = searchParams.get('path');
    const game = searchParams.get('game');
    if (path && !autoLoadedRef.current) {
      autoLoadFromPath(path, game || 'Game');
    }
  }, [searchParams, autoLoadFromPath]);

  // Carica checkpoint quando gameName/fileName cambia
  useEffect(() => {
    if (gameName || fileName) {
      loadBinCheckpoint();
    }
  }, [gameName, fileName, loadBinCheckpoint]);

  // Trigger traduzione dopo restore checkpoint (project cambia async)
  useEffect(() => {
    if (resumePendingRef.current && project && !isProcessing) {
      resumePendingRef.current = false;
      handleTranslate();
    }
  }, [project, isProcessing]);

  // ============================================================
  // File Loading
  // ============================================================
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: 1, label: 'Caricamento file...' });

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      setFileName(file.name);
      setFileBuffer(buffer);

      // Detect anti-cheat from filename patterns
      const acResult = detectAntiCheat([file.name]);
      setAntiCheat(acResult);

      setStep('extract');
      setProgress({ current: 1, total: 1, label: 'File caricato!' });
    } catch (err: unknown) {
      clientLogger.error('Errore caricamento:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // ============================================================
  // String Extraction
  // ============================================================
  const handleExtract = useCallback(async () => {
    if (!fileBuffer) return;
    setIsProcessing(true);
    setProgress({ current: 0, total: 100, label: 'Estrazione stringhe...' });

    // Run extraction in a setTimeout to not block UI
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const strings = extractStringsFromBuffer(fileBuffer, {
          minLength: 8,
          includeUtf8: true,
          filterNoise: true,
          detectLanguage: true,
        });

        // Detect dominant source language
        const langCounts: Record<string, number> = {};
        for (const s of strings) {
          const lang = s.language || 'unknown';
          langCounts[lang] = (langCounts[lang] || 0) + 1;
        }
        const sourceLang = Object.entries(langCounts)
          .filter(([k]) => k !== 'unknown')
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'en';

        const proj = createProject(
          fileName.replace(/\.(exe|dll)$/i, ''),
          fileName,
          '',
          fileBuffer,
          sourceLang,
          targetLang,
        );
        proj.strings = strings;
        setProject(proj);
        setStep('translate');
        setProgress({ current: 100, total: 100, label: `${strings.length} stringhe estratte` });
        resolve();
      }, 50);
    });

    setIsProcessing(false);
  }, [fileBuffer, fileName, targetLang]);

  // ============================================================
  // Translation
  // ============================================================
  const handleTranslate = useCallback(async () => {
    if (!project) return;
    setIsProcessing(true);
    setTranslationLog([]);

    if (translationMode === 'rule') {
      // Rule-based translation (offline, veloce)
      setTranslationLog(prev => [...prev, '⚡ Traduzione rule-based...']);
      const translated = translateStrings(
        project.strings,
        project.sourceLang,
        targetLang,
        (current, total) => {
          if (current % 50 === 0 || current === total) {
            setProgress({ current, total, label: `Traduzione ${current}/${total}...` });
          }
        }
      );
      setTranslationLog(prev => [...prev, `✅ ${translated.filter(s => s.translated).length} stringhe tradotte`]);
      setProject({ ...project, strings: translated, targetLang, updatedAt: new Date().toISOString() });
      setStep('review');
      setIsProcessing(false);
      return;
    }

    // AI Translation
    cancelTranslationRef.current = false;
    setTranslationStopped(false);
    setChainPreset(chainPreset);
    const { available, providers } = hasAvailableProviders();
    setTranslationLog(prev => [...prev, `🤖 Traduzione AI — Preset: ${CHAIN_PRESETS.find(p => p.id === chainPreset)?.name || chainPreset}`]);
    setTranslationLog(prev => [...prev, `📡 Provider disponibili: ${available ? providers.join(', ') : 'nessuno — verrà usato fallback gratuito'}`]);

    // Filtro aggressivo: solo testo reale, no garbage binario/assembly
    const isTranslatableText = (s: string): boolean => {
      if (s.length < 6) return false;
      // DOS/PE header, sezioni binarie
      if (/DOS mode|This program|\.text|\.rdata|\.data|\.reloc|\.rsrc/i.test(s)) return false;
      // Solo maiuscole (registri assembly)
      if (/^[A-Z\s$|@#!]{4,}$/.test(s.trim())) return false;
      // Inizia con char speciali + garbage
      if (/^[\x00-\x1f|$@#%^&*\\{}[\]!]+/.test(s)) return false;
      // Cluster consonanti maiuscole tipiche assembly (UATAUAVAWH, WAVAWH, etc.)
      if (/[A-Z]{3,}[^a-zà-ÿ\s]/.test(s) && !/[a-zà-ÿ]{3,}/.test(s)) return false;
      // Parole ALL-CAPS senza vocali minuscole → assembly
      const upperWords = s.match(/\b[A-Z]{3,}\b/g) || [];
      const assemblyLike = upperWords.filter(w => !/[AEIOU]/.test(w) || /^[A-Z]{5,}$/.test(w));
      if (assemblyLike.length > 0 && !/[a-zà-ÿ]{3,}/.test(s)) return false;
      // Deve avere vocali
      if (!/[aeiouáéíóúàèìòùäëïöü]/i.test(s)) return false;
      // Rapporto lettere/totale alto
      const letters = s.replace(/[^a-zA-ZÀ-ÿ]/g, '').length;
      if (letters / s.length < 0.5) return false;
      // Almeno 2 parole reali (3+ lettere) o 1 parola con minuscole (non assembly)
      const realWords = s.split(/\s+/).filter(w => /[a-zA-ZÀ-ÿ]{3,}/.test(w));
      const hasLowercase = /[a-zà-ÿ]{3,}/.test(s);
      if (realWords.length < 2 && !hasLowercase) return false;
      return true;
    };

    // Solo stringhe non ancora tradotte (per supporto Riprendi)
    const translatableStrings = project.strings.filter(s =>
      s.category !== 'debug' && s.category !== 'engine' && !s.translated && isTranslatableText(s.original)
    );
    setTranslationLog(prev => [...prev, `📝 ${translatableStrings.length} stringhe da tradurre (${project.strings.length} totali)`]);

    const BATCH_SIZE = 15;
    const batches = [];
    for (let i = 0; i < translatableStrings.length; i += BATCH_SIZE) {
      batches.push(translatableStrings.slice(i, i + BATCH_SIZE));
    }

    let translated = 0;
    let failed = 0;
    const updatedStrings = [...project.strings];

    for (let bi = 0; bi < batches.length; bi++) {
      // Check cancel
      if (cancelTranslationRef.current) {
        setTranslationLog(prev => [...prev, `⏸️ Traduzione interrotta al batch ${bi + 1}/${batches.length} — ${translated} tradotte finora`]);
        setTranslationStopped(true);
        break;
      }

      const batch = batches[bi];
      const texts = batch.map(s => s.original);
      setProgress({ current: bi * BATCH_SIZE, total: translatableStrings.length, label: `Batch ${bi + 1}/${batches.length}...` });

      try {
        const result = await translateWithFallbackBatched(
          { texts, targetLanguage: targetLang, sourceLanguage: project.sourceLang, context: `Game: ${gameName || project.gameName}` },
          BATCH_SIZE,
          (done) => {
            setProgress({ current: bi * BATCH_SIZE + done, total: translatableStrings.length, label: `Traduzione ${bi * BATCH_SIZE + done}/${translatableStrings.length}...` });
          },
          true // preferWebApis: MyMemory/Lingva prima di HY-MT/Ollama per velocità
        );

        if (result.success && result.translations.length === texts.length) {
          for (let j = 0; j < batch.length; j++) {
            const idx = updatedStrings.findIndex(s => s.offset === batch[j].offset);
            if (idx !== -1 && result.translations[j] && result.translations[j] !== texts[j]) {
              updatedStrings[idx] = {
                ...updatedStrings[idx],
                translated: fitToByteLength(result.translations[j], updatedStrings[idx].byteLen),
              };
              translated++;
            }
          }
          if (bi === 0) {
            setTranslationLog(prev => [...prev, `✅ Batch 1 — Provider: ${result.provider}`]);
          }
        } else {
          failed += batch.length;
          setTranslationLog(prev => [...prev, `⚠️ Batch ${bi + 1} fallito (provider: ${result.provider})`]);
        }
      } catch (err: unknown) {
        failed += batch.length;
        setTranslationLog(prev => [...prev, `❌ Batch ${bi + 1} errore: ${err instanceof Error ? err.message : String(err)}`]);
      }

      // Salva progresso intermedio nel project + checkpoint
      const updatedProject = { ...project, strings: [...updatedStrings], targetLang, updatedAt: new Date().toISOString() };
      setProject(updatedProject);
      saveBinCheckpoint(updatedProject);

      if (bi < batches.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    const finalProject = { ...project, strings: [...updatedStrings], targetLang, updatedAt: new Date().toISOString() };
    setProject(finalProject);
    if (!cancelTranslationRef.current) {
      setTranslationLog(prev => [...prev, `🏁 Completato: ${translated} tradotte, ${failed} fallite`]);
      setStep('review');
      // Traduzione completata al 100% → salva checkpoint finale
      saveBinCheckpoint(finalProject);
    } else {
      // Fermata dall'utente → salva checkpoint per resume
      saveBinCheckpoint(finalProject);
      setTranslationLog(prev => [...prev, `💾 Checkpoint salvato — riprendi quando vuoi`]);
    }
    setIsProcessing(false);
  }, [project, targetLang, translationMode, chainPreset, gameName, saveBinCheckpoint]);

  const handleStopTranslation = useCallback(() => {
    cancelTranslationRef.current = true;
    setTranslationLog(prev => [...prev, '⏸️ Arresto in corso... (completamento batch corrente)']);
  }, []);

  // ============================================================
  // Patch Application
  // ============================================================
  const handlePatch = useCallback(async () => {
    if (!project || !fileBuffer) return;
    setIsProcessing(true);
    setProgress({ current: 0, total: 1, label: 'Applicazione patch...' });

    const result = applyPatch(fileBuffer, project.strings);

    // Download patched file
    const ab = new ArrayBuffer(fileBuffer.length);
    new Uint8Array(ab).set(fileBuffer);
    const blob = new Blob([ab], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = fileName.match(/\.[^.]+$/)?.[0] || '.exe';
    a.download = fileName.replace(ext, `_${targetLang.toUpperCase()}${ext}`);
    a.click();
    URL.revokeObjectURL(url);

    setProgress({
      current: 1, total: 1,
      label: `Patch completata! ${result.patchedCount} stringhe patchate, ${result.skippedCount} saltate`,
    });
    setStep('patch');
    setIsProcessing(false);
  }, [project, fileBuffer, fileName, targetLang]);

  // ============================================================
  // Import/Export Project
  // ============================================================
  const handleExportProject = useCallback(() => {
    if (!project) return;
    const json = exportProject(project);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.gameName}-patch-${project.sourceLang}-${project.targetLang}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project]);

  const handleImportProject = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = await file.text();
      const proj = importProject(json);
      setProject(proj);
      setFileName(proj.fileName);
      setTargetLang(proj.targetLang);
      setStep('review');
    } catch (err: unknown) {
      clientLogger.error('Errore import:', err);
    }
  }, []);

  // ============================================================
  // Inline Edit
  // ============================================================
  const handleStartEdit = (idx: number) => {
    if (!project) return;
    setEditingIdx(idx);
    setEditValue(project.strings[idx].translated || project.strings[idx].original);
  };

  const handleSaveEdit = () => {
    if (!project || editingIdx === null) return;
    const strings = [...project.strings];
    const s = strings[editingIdx];
    const fitted = fitToByteLength(editValue, s.byteLen);
    // Adaptive MT: salva correzione se diversa dalla traduzione AI
    if (s.translated && fitted !== s.translated && fitted !== s.original) {
      addCorrection({
        sourceText: s.original,
        aiTranslation: s.translated,
        humanCorrection: fitted,
        sourceLanguage: project.sourceLang,
        targetLanguage: targetLang,
        gameId: gameName || project.gameName,
        contentType: s.category,
      });
    }
    strings[editingIdx] = { ...s, translated: fitted, isTranslated: fitted !== s.original };
    setProject({ ...project, strings, updatedAt: new Date().toISOString() });
    setEditingIdx(null);
  };

  // ============================================================
  // Filtered Strings
  // ============================================================
  const filteredStrings = useMemo(() => {
    if (!project) return [];
    return project.strings.filter((s, _i) => {
      if (searchQuery && !s.original.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !(s.translated || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterCategory !== 'all' && s.category !== filterCategory) return false;
      if (filterLang !== 'all' && s.language !== filterLang) return false;
      if (showTranslatedOnly && !s.isTranslated) return false;
      return true;
    });
  }, [project, searchQuery, filterCategory, filterLang, showTranslatedOnly]);

  const stats = useMemo(() => project ? getProjectStats(project) : null, [project]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg border border-orange-500/30">
              <Binary className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{t('binaryPatcherPage.title')}</h1>
              <p className="text-xs text-white/50">
                {language === 'it' ? 'Traduci giochi con stringhe nel binario' : 'Translate games with strings in binary'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {project && (
              <>
                <Button variant="ghost" size="sm" onClick={handleExportProject} className="text-white/60 hover:text-white">
                  <Download className="h-4 w-4 mr-1" />{t('projects.export')}</Button>
              </>
            )}
            <input ref={projectInputRef} type="file" accept=".json" className="hidden" onChange={handleImportProject} />
            <Button variant="ghost" size="sm" onClick={() => projectInputRef.current?.click()} className="text-white/60 hover:text-white">
              <Upload className="h-4 w-4 mr-1" />{t('glossaryManager.import')}</Button>
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-1 mt-3">
          {(['load', 'extract', 'translate', 'review', 'patch'] as Step[]).map((s, i) => {
            const labels = ['Carica', 'Estrai', 'Traduci', 'Revisiona', 'Patcha'];
            const icons = [Upload, FileCode2, Languages, Eye, Zap];
            const Icon = icons[i];
            const isActive = step === s;
            const isDone = ['load', 'extract', 'translate', 'review', 'patch'].indexOf(step) > i;
            return (
              <React.Fragment key={s}>
                {i > 0 && <ArrowRight className="h-3 w-3 text-white/20" />}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  isActive ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                  isDone ? 'bg-green-500/10 text-green-400' : 'text-white/30'
                }`}>
                  {isDone ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  {labels[i]}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* STEP: Load */}
        {step === 'load' && (
          <div className="max-w-2xl mx-auto mt-4">
            {/* Auto-load in corso */}
            {autoLoadLog.length > 0 && (
              <div className="mb-4">
                {gameName && (
                  <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-white/5 border border-white/10">
                    <Gamepad2 className="h-5 w-5 text-orange-400" />
                    <div>
                      <p className="font-medium text-white">{gameName}</p>
                      {gamePath && <p className="text-2xs text-white/40 font-mono">{gamePath}</p>}
                    </div>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-zinc-900/50 border border-white/10 max-h-[200px] overflow-auto">
                  {autoLoadLog.map((log, i) => (
                    <p key={i} className="text-xs text-white/70 font-mono py-0.5">{log}</p>
                  ))}
                  {isProcessing && (
                    <div className="flex items-center gap-2 mt-1">
                      <Loader2 className="h-3 w-3 animate-spin text-orange-400" />
                      <span className="text-xs text-orange-400">{t('mangaTranslator.processing')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Upload manuale (sempre visibile) */}
            {!isProcessing && (
              <>
                <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-orange-500/30 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}>
                  <Binary className="h-12 w-12 mx-auto text-white/20 mb-3" />
                  <h2 className="text-lg font-bold text-white mb-1">{autoLoadLog.length > 0 ? 'Oppure carica manualmente' : 'Carica un file binario'}</h2>
                  <p className="text-white/50 text-sm mb-3">
                    Seleziona un .exe o .dll di gioco per estrarre le stringhe traducibili
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Badge variant="outline" className="text-xs">.exe</Badge>
                    <Badge variant="outline" className="text-xs">.dll</Badge>
                    <Badge variant="outline" className="text-xs">.bin</Badge>
                    <Badge variant="outline" className="text-xs">.dat</Badge>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".exe,.dll,.bin,.dat,.so" className="hidden" onChange={handleFileSelect} />
                </div>

                <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-none" />
                    <div className="text-xs text-amber-300/80">
                      <p className="font-medium mb-1">{t('binaryPatcherPage.antiCheatWarning')}</p>
                      <p>I giochi con protezioni anti-cheat (EAC, BattlEye, VAC) potrebbero non funzionare dopo il patch.</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP: Extract */}
        {step === 'extract' && (
          <div className="max-w-2xl mx-auto mt-4">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <FileCode2 className="h-5 w-5 text-orange-400" />
                <div>
                  <p className="font-medium text-white">{fileName}</p>
                  <p className="text-xs text-white/50">{fileBuffer ? `${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB` : ''}</p>
                </div>
              </div>

              {/* Anti-cheat result */}
              {antiCheat && (
                <div className={`p-3 rounded-md mb-3 ${antiCheat.safe ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                  <div className="flex items-center gap-2">
                    {antiCheat.safe ? (
                      <><CheckCircle2 className="h-4 w-4 text-green-400" /><span className="text-sm text-green-400">{t('binaryPatcherPage.noAntiCheat')}</span></>
                    ) : (
                      <><XCircle className="h-4 w-4 text-red-400" /><span className="text-sm text-red-400">Anti-cheat rilevato: {antiCheat.detected.join(', ')}</span></>
                    )}
                  </div>
                  {antiCheat.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-400/80 mt-1 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 flex-none" /> {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Target language selector */}
              <div className="flex items-center gap-3 mb-4">
                <label className="text-sm text-white/60">{t('binaryPatcherPage.targetLang')}</label>
                <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}
                  className="border border-white/10 rounded px-3 py-1.5 text-sm text-white" style={{backgroundColor: '#1a1a2e'}}>
                  <option value="it">🇮🇹 Italiano</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="es">🇪🇸 Español</option>
                  <option value="de">🇩🇪 Deutsch</option>
                  <option value="fr">🇫🇷 Français</option>
                  <option value="pt">🇵🇹 Português</option>
                </select>
              </div>

              <Button onClick={handleExtract} disabled={isProcessing} className="w-full bg-orange-600 hover:bg-orange-700">
                {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Estrai stringhe dal binario
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Translate */}
        {step === 'translate' && project && stats && (
          <div className="max-w-2xl mx-auto mt-4">
            {/* Stats compatti */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-white/50">{t('binaryPatcherPage.stringsFound')}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                <p className="text-2xl font-bold text-orange-400">{Object.keys(stats.byLanguage).length}</p>
                <p className="text-xs text-white/50">{t('binaryPatcherPage.detectedLanguages')}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                <p className="text-2xl font-bold text-blue-400">{Object.keys(stats.byCategory).length}</p>
                <p className="text-xs text-white/50">{t('culturalAdaptation.categories')}</p>
              </div>
            </div>

            {/* Lingue + Categorie inline */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {Object.entries(stats.byLanguage).sort((a, b) => b[1] - a[1]).map(([lang, count]) => (
                <Badge key={lang} variant="outline" className="text-2xs">
                  {LANG_NAMES[lang] || lang}: {count}
                </Badge>
              ))}
              <span className="text-white/20 mx-1">|</span>
              {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, count]) => (
                <Badge key={cat} className={`text-2xs ${CATEGORY_COLORS[cat] || ''}`}>
                  {CATEGORY_NAMES[cat] || cat}: {count}
                </Badge>
              ))}
            </div>

            {/* Banner Riprendi Traduzione (checkpoint trovato) */}
            {savedCheckpoint && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Save className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-amber-200">{t('binaryPatcherPage.progressFound')}</h3>
                    <p className="text-xs text-amber-300/70 mt-0.5">
                      {savedCheckpoint.translatedCount}/{savedCheckpoint.totalCount} stringhe tradotte
                      ({savedCheckpoint.targetLang.toUpperCase()})
                      — salvato il {new Date(savedCheckpoint.savedAt).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="xs" className="text-xs bg-amber-600 hover:bg-amber-700" onClick={() => {
                      setProject(savedCheckpoint.project);
                      setTargetLang(savedCheckpoint.targetLang);
                      setFileName(savedCheckpoint.fileName);
                      setSavedCheckpoint(null);
                      setStep('review');
                    }}>
                      <Eye className="h-3 w-3 mr-1" /> Review
                    </Button>
                    <Button size="xs" className="text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                      setProject(savedCheckpoint.project);
                      setTargetLang(savedCheckpoint.targetLang);
                      setFileName(savedCheckpoint.fileName);
                      setSavedCheckpoint(null);
                      resumePendingRef.current = true;
                    }}>
                      <Play className="h-3 w-3 mr-1" />{t('ueTranslator.resumeTranslator')}</Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/20" onClick={clearBinCheckpoint}>
                      <XCircle className="h-3 w-3 mr-1" /> Ricomincia
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Direzione traduzione */}
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 mb-4 flex items-center gap-3">
              <Languages className="h-5 w-5 text-orange-400 flex-none" />
              <div className="flex-1">
                <span className="text-sm text-white font-medium">{LANG_NAMES[project.sourceLang]}</span>
                <ArrowRight className="inline h-4 w-4 mx-2 text-white/30" />
                <span className="text-sm text-orange-400 font-medium">{LANG_NAMES[targetLang]}</span>
              </div>
              <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}
                className="border border-white/10 rounded px-2 py-1 text-xs text-white" style={{backgroundColor: '#1a1a2e'}}>
                <option value="it" style={{backgroundColor: '#1a1a2e'}}>🇮🇹 Italiano</option>
                <option value="en" style={{backgroundColor: '#1a1a2e'}}>🇬🇧 English</option>
                <option value="es" style={{backgroundColor: '#1a1a2e'}}>🇪🇸 Español</option>
                <option value="de" style={{backgroundColor: '#1a1a2e'}}>🇩🇪 Deutsch</option>
                <option value="fr" style={{backgroundColor: '#1a1a2e'}}>🇫🇷 Français</option>
                <option value="pt" style={{backgroundColor: '#1a1a2e'}}>🇵🇹 Português</option>
                <option value="ja" style={{backgroundColor: '#1a1a2e'}}>🇯🇵 日本語</option>
                <option value="ko" style={{backgroundColor: '#1a1a2e'}}>🇰🇷 한국어</option>
                <option value="zh" style={{backgroundColor: '#1a1a2e'}}>🇨🇳 中文</option>
                <option value="ru" style={{backgroundColor: '#1a1a2e'}}>🇷🇺 Русский</option>
              </select>
            </div>

            {/* Metodo traduzione */}
            <div className="p-4 rounded-lg bg-white/5 border border-white/10 mb-4">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-orange-400" />
                Metodo di traduzione
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* AI Mode */}
                <div
                  onClick={() => setTranslationMode('ai')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    translationMode === 'ai'
                      ? 'border-purple-500/50 bg-purple-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Bot className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-white">{t('binaryPatcherPage.aiLlm')}</span>
                    <Sparkles className="h-3 w-3 text-purple-400" />
                  </div>
                  <p className="text-2xs text-white/50">{t('binaryPatcherPage.geminiDeepseekOpenaiOllamaDeep')}</p>
                </div>
                {/* Rule-based Mode */}
                <div
                  onClick={() => setTranslationMode('rule')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    translationMode === 'rule'
                      ? 'border-orange-500/50 bg-orange-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-4 w-4 text-orange-400" />
                    <span className="text-sm font-medium text-white">{t('binaryPatcherPage.ruleBased')}</span>
                  </div>
                  <p className="text-2xs text-white/50">{t('binaryPatcherPage.offlineDict')}</p>
                </div>
              </div>

              {/* AI Chain Preset selector */}
              {translationMode === 'ai' && (
                <div className="space-y-2">
                  <label className="text-xs text-white/60">{t('binaryPatcherPage.aiPreset')}</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {CHAIN_PRESETS.map(preset => (
                      <div
                        key={preset.id}
                        onClick={() => { setChainPresetState(preset.id as ChainPreset); setChainPreset(preset.id as ChainPreset); }}
                        className={`p-2 rounded-md border cursor-pointer transition-all flex items-center gap-3 ${
                          chainPreset === preset.id
                            ? 'border-purple-500/50 bg-purple-500/10'
                            : 'border-white/5 hover:border-white/15'
                        }`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white">{preset.name}</span>
                            <span className="text-2xs text-white/30">{preset.cost}</span>
                            <span className="text-2xs text-white/30">{preset.quality}</span>
                          </div>
                          <p className="text-2xs text-white/40">{preset.description}</p>
                        </div>
                        {chainPreset === preset.id && <CheckCircle2 className="h-4 w-4 text-purple-400 flex-none" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Translation Log */}
            {translationLog.length > 0 && (
              <div className="p-3 rounded-lg bg-zinc-900/50 border border-white/10 mb-4 max-h-[150px] overflow-auto">
                {translationLog.map((log, i) => (
                  <p key={i} className="text-xs text-white/70 font-mono py-0.5">{log}</p>
                ))}
                {isProcessing && (
                  <div className="flex items-center gap-2 mt-1">
                    <Loader2 className="h-3 w-3 animate-spin text-purple-400" />
                    <span className="text-xs text-purple-400">{t('offlineTranslator.translating')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Progress bar */}
            {isProcessing && progress.total > 0 && (
              <div className="mb-4">
                <Progress value={(progress.current / progress.total) * 100} className="h-2 mb-1" />
                <p className="text-2xs text-white/40 text-center">{progress.label}</p>
              </div>
            )}

            {/* Translate / Stop / Resume buttons */}
            <div className="flex gap-2">
              {isProcessing ? (
                <Button onClick={handleStopTranslation} className="w-full bg-red-600 hover:bg-red-700 h-10">
                  <XCircle className="h-4 w-4 mr-2" />
                  Ferma traduzione
                </Button>
              ) : translationStopped ? (
                <>
                  <Button onClick={handleTranslate} className="flex-1 bg-orange-600 hover:bg-orange-700 h-10">
                    <Play className="h-4 w-4 mr-2" />
                    Riprendi traduzione
                  </Button>
                  <Button onClick={() => { setTranslationStopped(false); setStep('review'); }} variant="outline" className="h-10 border-white/10">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Vai a Review
                  </Button>
                </>
              ) : (
                <Button onClick={handleTranslate} className="w-full bg-orange-600 hover:bg-orange-700 h-10">
                  {translationMode === 'ai' ? <Bot className="h-4 w-4 mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                  Traduci {stats.total} stringhe ({project.sourceLang.toUpperCase()} → {targetLang.toUpperCase()})
                </Button>
              )}
            </div>
          </div>
        )}

        {/* STEP: Review */}
        {(step === 'review' || step === 'patch') && project && stats && (
          <div className="flex flex-col h-full">
            {/* Stats bar */}
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-orange-400" />
                <span className="text-sm text-white">
                  <span className="font-bold">{stats.translated}</span>
                  <span className="text-white/40">/{stats.total}</span>
                  <span className="text-white/40 ml-1">({stats.percentage}%)</span>
                </span>
              </div>
              <Progress value={stats.percentage} className="flex-1 h-2" />
              <Button onClick={handlePatch} disabled={isProcessing || stats.translated === 0} size="sm" className="bg-green-600 hover:bg-green-700">
                {isProcessing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                Applica Patch
              </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                <Input
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Cerca" placeholder="Cerca stringhe..."
                  className="pl-8 h-8 text-sm bg-white/5 border-white/10"
                />
              </div>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                className="h-8 border border-white/10 rounded px-2 text-xs text-white" style={{backgroundColor: '#1a1a2e'}}>
                <option value="all" style={{backgroundColor: '#1a1a2e'}}>{t('binaryPatcherPage.allCategories')}</option>
                {Object.entries(CATEGORY_NAMES).map(([k, v]) => (
                  <option key={k} value={k} style={{backgroundColor: '#1a1a2e'}}>{v}</option>
                ))}
              </select>
              <select value={filterLang} onChange={(e) => setFilterLang(e.target.value)}
                className="h-8 border border-white/10 rounded px-2 text-xs text-white" style={{backgroundColor: '#1a1a2e'}}>
                <option value="all" style={{backgroundColor: '#1a1a2e'}}>{t('communityHub.allLanguages')}</option>
                {Object.entries(stats.byLanguage).map(([k]) => (
                  <option key={k} value={k}>{LANG_NAMES[k] || k}</option>
                ))}
              </select>
              <Button variant="ghost" size="sm" onClick={() => setShowTranslatedOnly(!showTranslatedOnly)}
                className={showTranslatedOnly ? 'text-orange-400' : 'text-white/40'}>
                {showTranslatedOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Badge variant="outline" className="text-xs">{filteredStrings.length}</Badge>
            </div>

            {/* String list */}
            <div className="flex-1 overflow-auto rounded-lg border border-white/10 bg-white/[0.02]">
              <div className="divide-y divide-white/5">
                {filteredStrings.slice(0, 200).map((s, _i) => {
                  const realIdx = project.strings.indexOf(s);
                  const isEditing = editingIdx === realIdx;
                  const byteLenOk = s.translated ? new TextEncoder().encode(s.translated).length === s.byteLen : true;

                  return (
                    <div key={realIdx} className={`px-3 py-2 hover:bg-white/5 transition-colors ${s.isTranslated ? '' : 'opacity-60'}`}>
                      <div className="flex items-start gap-2">
                        {/* Category badge */}
                        <Badge className={`text-2xs mt-0.5 flex-none ${CATEGORY_COLORS[s.category || 'unknown']}`}>
                          {(CATEGORY_NAMES[s.category || 'unknown'] || '').slice(0, 4)}
                        </Badge>

                        <div className="flex-1 min-w-0">
                          {/* Original */}
                          <p className="text-xs text-white/50 font-mono truncate">{s.original}</p>

                          {/* Translation (editable) */}
                          {isEditing ? (
                            <div className="flex items-center gap-1 mt-1">
                              <Input value={editValue} onChange={(e) => setEditValue(e.target.value)}
                                className="h-7 text-xs bg-white/10 border-orange-500/30 font-mono" autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingIdx(null); }} />
                              <Button size="sm" variant="ghost" onClick={handleSaveEdit} className="h-7 px-2">
                                <CheckCircle2 className="h-3 w-3 text-green-400" />
                              </Button>
                              <span className={`text-2xs ${new TextEncoder().encode(editValue).length === s.byteLen ? 'text-green-400' : 'text-red-400'}`}>
                                {new TextEncoder().encode(editValue).length}/{s.byteLen}b
                              </span>
                            </div>
                          ) : (
                            <p className={`text-xs font-mono mt-0.5 cursor-pointer hover:text-orange-300 ${s.isTranslated ? 'text-orange-400' : 'text-white/30 italic'}`}
                              onClick={() => handleStartEdit(realIdx)}>
                              {s.translated || '(clicca per tradurre)'}
                            </p>
                          )}
                        </div>

                        {/* Byte length indicator */}
                        <div className="flex items-center gap-1 flex-none">
                          <span className={`text-2xs ${byteLenOk ? 'text-white/20' : 'text-red-400'}`}>{s.byteLen}b</span>
                          {s.language && <span className="text-2xs text-white/20">{s.language}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredStrings.length > 200 && (
                  <div className="px-3 py-4 text-center text-xs text-white/30">
                    Mostrate 200 di {filteredStrings.length} — usa la ricerca per filtrare
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Progress overlay */}
        {isProcessing && (
          <div className="fixed bottom-4 right-4 bg-zinc-900 border border-white/10 rounded-lg p-3 shadow-xl z-50 min-w-[250px]">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
              <span className="text-sm text-white">{progress.label}</span>
            </div>
            {progress.total > 1 && (
              <Progress value={(progress.current / progress.total) * 100} className="h-1.5" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
