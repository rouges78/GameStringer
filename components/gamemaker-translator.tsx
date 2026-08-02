'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@/lib/tauri-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';
import {
  Loader2, Search, Languages, Download, Upload, RotateCcw, 
  ChevronLeft, ChevronRight, FileText, Zap, Check, X,
  Filter, Edit3, Save, AlertTriangle, Database
} from 'lucide-react';

interface GmString {
  index: number;
  offset: number;
  data_offset: number;
  original: string;
  translated: string | null;
  length: number;
  is_translatable: boolean;
}

interface GmDataInfo {
  file_path: string;
  file_size: number;
  gm_version: string;
  total_strings: number;
  translatable_strings: number;
  chunks: string[];
  is_yyc: boolean;
  exe_path: string | null;
  has_language_files: boolean;
  language_dir: string | null;
  language_file_count: number;
  string_source: string; // "strg" | "exe" | "language_files"
}

/** Traduzione che non entrava nello spazio dell'originale (rif. GmTruncatedString lato Rust). */
interface GmTruncatedString {
  index: number;
  original: string;
  translated: string;
  written: string;
  available_bytes: number;
  needed_bytes: number;
}

interface GmPatchResult {
  success: boolean;
  patched_count: number;
  backup_path: string;
  message: string;
  truncated: GmTruncatedString[];
}

interface GameMakerTranslatorProps {
  gamePath: string;
  gameName: string;
  /**
   * Lingua di destinazione della traduzione. Prima era 'it' CABLATO nelle due
   * chiamate a translate_text_simple: con la UI in russo e target russo le
   * traduzioni uscivano in italiano (bug della famiglia "italiano forzato",
   * 28/07/2026). Il default 'it' resta solo per i mount legacy senza prop.
   */
  targetLang?: string;
}

const PAGE_SIZE = 50;

export function GameMakerTranslator({ gamePath, gameName, targetLang = 'it' }: GameMakerTranslatorProps) {
  // State
  const [dataInfo, setDataInfo] = useState<GmDataInfo | null>(null);
  const [strings, setStrings] = useState<GmString[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPatching, setIsPatching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [totalTranslatable, setTotalTranslatable] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translateProgress, setTranslateProgress] = useState(0);
  const [translateTotal, setTranslateTotal] = useState(0);
  const [showOnlyUntranslated, setShowOnlyUntranslated] = useState(false);
  // Traduzioni tagliate dall'ultima patch: data.win e l'EXE YYC riscrivono in
  // place, quindi una traduzione piu' lunga dell'originale non ci sta.
  const [truncated, setTruncated] = useState<GmTruncatedString[]>([]);
  const { t } = useTranslation();
  const abortRef = useRef(false);

  // Scan data.win on mount
  const scanDataWin = useCallback(async () => {
    setIsScanning(true);
    try {
      const info = await invoke<GmDataInfo>('gm_scan_data_win', { gamePath });
      setDataInfo(info);
      setTotalTranslatable(info.translatable_strings);
      const scanKey = info.string_source === 'language_json' ? 'scanJsonToast'
        : info.has_language_files ? 'scanJnToast'
          : info.is_yyc ? 'scanExeToast' : 'scanStrgToast';
      toast.success(t(`gameMakerTranslator.${scanKey}`)
        .replace('{n}', String(info.translatable_strings))
        .replace('{f}', String(info.language_file_count)));
    } catch (e: unknown) {
      toast.error(e?.toString() || 'data.win non trovato');
    } finally {
      setIsScanning(false);
    }
  }, [gamePath, t]);

  useEffect(() => {
    scanDataWin();
  }, [scanDataWin]);

  // Extract strings (paginated)
  const extractStrings = useCallback(async (pageNum: number = 0) => {
    setIsExtracting(true);
    try {
      const result = await invoke<GmString[]>('gm_extract_strings', {
        gamePath,
        onlyTranslatable: true,
        offset: pageNum * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setStrings(result);
      setPage(pageNum);
    } catch (e: unknown) {
      toast.error(e?.toString() || 'Errore estrazione stringhe');
    } finally {
      setIsExtracting(false);
    }
  }, [gamePath]);

  // Search strings
  const searchStrings = useCallback(async () => {
    if (!searchQuery.trim()) {
      extractStrings(0);
      return;
    }
    setIsExtracting(true);
    try {
      const result = await invoke<GmString[]>('gm_search_strings', {
        gamePath,
        query: searchQuery,
        onlyTranslatable: true,
      });
      setStrings(result);
      setPage(-1); // search mode
    } catch (e: unknown) {
      toast.error(e?.toString() || 'Errore ricerca');
    } finally {
      setIsExtracting(false);
    }
  }, [gamePath, searchQuery, extractStrings]);

  // Edit a string
  const startEdit = (s: GmString) => {
    setEditingIndex(s.index);
    setEditValue(translations[s.index] || s.translated || s.original);
  };

  const saveEdit = (index: number) => {
    if (editValue.trim()) {
      setTranslations(prev => ({ ...prev, [index]: editValue }));
    }
    setEditingIndex(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  // Translate all visible strings with AI
  const translateBatch = async () => {
    const toTranslate = strings.filter(s => !translations[s.index] && s.is_translatable);
    if (toTranslate.length === 0) {
      toast.info(t('common.tutteLeStringheVisibiliSonoGiàTradotte'));
      return;
    }

    setIsTranslating(true);
    setTranslateProgress(0);
    setTranslateTotal(toTranslate.length);
    abortRef.current = false;

    const newTranslations: Record<number, string> = { ...translations };
    let done = 0;
    // ⚠️ Contatori di QUESTA sessione. Prima il totale finale era
    // `Object.keys(newTranslations).length`, che parte da `{...translations}`:
    // contava anche le traduzioni già presenti da prima, e quindi restava alto
    // anche quando la rete era giù e non ne arrivava nessuna nuova. Il toast
    // usciva verde su zero lavoro fatto.
    let riuscite = 0;
    let fallite = 0;
    let primoErrore = '';

    // Batch translate in groups of 5
    for (let i = 0; i < toTranslate.length; i += 5) {
      if (abortRef.current) break;

      const batch = toTranslate.slice(i, i + 5);
      const promises = batch.map(async (s) => {
        try {
          const result = await invoke<{ translated_text: string }>('translate_text_simple', {
            text: s.original,
            targetLang,
          });
          if (result?.translated_text) {
            newTranslations[s.index] = result.translated_text;
            riuscite++;
          } else {
            fallite++;
          }
        } catch (err) {
          // Il `catch {}` vuoto che stava qui rendeva la rete assente
          // indistinguibile da una traduzione perfetta: nessun log, nessun
          // conteggio, e il successo dichiarato lo stesso.
          fallite++;
          if (!primoErrore) primoErrore = String(err);
          clientLogger.error('[GameMaker] stringa non tradotta:', String(err));
        }
      });

      await Promise.all(promises);
      done += batch.length;
      setTranslateProgress(done);
      setTranslations({ ...newTranslations });
    }

    setIsTranslating(false);
    if (riuscite === 0) {
      toast.error(
        t('gameMakerTranslator.noneTranslated')
          .replace('{f}', String(fallite))
          .replace('{n}', String(toTranslate.length)),
        primoErrore ? { description: primoErrore } : undefined
      );
      return;
    }
    if (fallite > 0) {
      toast.warning(
        t('gameMakerTranslator.translatedWithFailures')
          .replace('{n}', String(riuscite))
          .replace('{f}', String(fallite))
      );
    } else {
      toast.success(t('gameMakerTranslator.translatedToast').replace('{n}', String(riuscite)));
    }
  };

  // Translate ALL strings (not just visible page)
  const translateAll = async () => {
    if (!dataInfo) return;
    
    setIsTranslating(true);
    setTranslateProgress(0);
    setTranslateTotal(dataInfo.translatable_strings);
    abortRef.current = false;

    const newTranslations: Record<number, string> = { ...translations };
    let done = 0;
    let pageNum = 0;
    // Stessi contatori di translateBatch, e per la stessa ragione: il totale
    // finale non può essere la dimensione della mappa, che include il lavoro
    // di prima. Vedi il commento là sopra.
    let riuscite = 0;
    let fallite = 0;
    let primoErrore = '';
    // Guardia anti-loop: se il backend restituisce la stessa pagina due volte
    // (bug di paginazione, successo il 28/07 col ramo JSON che ignorava
    // offset), si esce invece di girare per sempre con la barra piena.
    let prevPageFirstIndex: number | null = null;

    while (!abortRef.current) {
      // Load page of strings
      let pageStrings: GmString[];
      try {
        pageStrings = await invoke<GmString[]>('gm_extract_strings', {
          gamePath,
          onlyTranslatable: true,
          offset: pageNum * 100,
          limit: 100,
        });
      } catch { break; }

      if (pageStrings.length === 0) break;
      if (prevPageFirstIndex !== null && pageStrings[0]?.index === prevPageFirstIndex) {
        toast.warning(t('gameMakerTranslator.samePageTwice'));
        break;
      }
      prevPageFirstIndex = pageStrings[0]?.index ?? null;

      // Translate in batches of 5
      for (let i = 0; i < pageStrings.length; i += 5) {
        if (abortRef.current) break;
        
        const batch = pageStrings.slice(i, i + 5).filter(s => !newTranslations[s.index]);
        if (batch.length === 0) {
          done += 5;
          setTranslateProgress(Math.min(done, dataInfo.translatable_strings));
          continue;
        }

        const promises = batch.map(async (s) => {
          try {
            const result = await invoke<{ translated_text: string }>('translate_text_simple', {
              text: s.original,
              targetLang,
            });
            if (result?.translated_text) {
              newTranslations[s.index] = result.translated_text;
              riuscite++;
            } else {
              fallite++;
            }
          } catch (err) {
            fallite++;
            if (!primoErrore) primoErrore = String(err);
            clientLogger.error('[GameMaker] stringa non tradotta:', String(err));
          }
        });

        await Promise.all(promises);
        done += batch.length;
        setTranslateProgress(Math.min(done, dataInfo.translatable_strings));
        
        // Update UI every 20 strings
        if (done % 20 === 0) {
          setTranslations({ ...newTranslations });
        }
      }

      pageNum++;
    }

    setTranslations({ ...newTranslations });
    setIsTranslating(false);

    if (riuscite === 0) {
      toast.error(
        t('gameMakerTranslator.noneTranslated')
          .replace('{f}', String(fallite))
          .replace('{n}', String(fallite)),
        primoErrore ? { description: primoErrore } : undefined
      );
      return;
    }
    if (fallite > 0) {
      toast.warning(
        t('gameMakerTranslator.translatedWithFailures')
          .replace('{n}', String(riuscite))
          .replace('{f}', String(fallite))
      );
    } else {
      toast.success(t('gameMakerTranslator.translatedToast').replace('{n}', String(riuscite)));
    }
  };

  // Patch data.win with translations
  const patchDataWin = async () => {
    if (Object.keys(translations).length === 0) {
      toast.error(t('common.nessunaTraduzioneDaApplicare'));
      return;
    }

    setIsPatching(true);
    try {
      const result = await invoke<GmPatchResult>('gm_patch_strings', {
        gamePath,
        translations,
      });
      const cut = result.truncated ?? [];
      setTruncated(cut);
      if (!result.success) {
        toast.error(result.message);
      } else if (cut.length > 0) {
        // Patch riuscita ma con testo tagliato: warning, non success — l'utente
        // deve sapere che la patch NON e' completa prima di pubblicarla.
        toast.warning(`${cut.length} ${t('gameMakerTranslator.truncatedCount')}`);
      } else {
        toast.success(result.message);
      }
    } catch (e: unknown) {
      toast.error(e?.toString() || 'Errore patching data.win');
    } finally {
      setIsPatching(false);
    }
  };

  // Restore backup
  const restoreBackup = async () => {
    try {
      const msg = await invoke<string>('gm_restore_backup', { gamePath });
      toast.success(msg);
      setTranslations({});
    } catch (e: unknown) {
      toast.error(e?.toString() || 'Errore ripristino backup');
    }
  };

  // Export translations as JSON
  const exportTranslations = () => {
    const data = {
      game: gameName,
      engine: dataInfo?.gm_version || 'GameMaker',
      date: new Date().toISOString(),
      translations: Object.entries(translations).map(([idx, text]) => {
        const s = strings.find(s => s.index === Number(idx));
        return { index: Number(idx), original: s?.original || '', translated: text };
      }),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gameName.replace(/[^a-zA-Z0-9]/g, '_')}_gm_translations.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.traduzioniEsportate'));
  };

  // Import translations from JSON
  const importTranslations = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.translations && Array.isArray(data.translations)) {
          const imported: Record<number, string> = {};
          for (const t of data.translations) {
            if (t.index !== undefined && t.translated) {
              imported[t.index] = t.translated;
            }
          }
          setTranslations(prev => ({ ...prev, ...imported }));
          toast.success(`${Object.keys(imported).length} traduzioni importate`);
        }
      } catch {
        toast.error(t('common.fileJsonNonValido'));
      }
    };
    input.click();
  };

  // Filtered strings
  const displayStrings = showOnlyUntranslated 
    ? strings.filter(s => !translations[s.index])
    : strings;

  const translatedCount = Object.keys(translations).length;
  const translationPercent = totalTranslatable > 0 
    ? Math.round((translatedCount / totalTranslatable) * 100) 
    : 0;

  const totalPages = Math.ceil(totalTranslatable / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">{t('gameMakerTranslator.title')}</h3>
          {dataInfo && (
            <>
              <Badge variant="outline" className="text-2xs border-amber-500/30 text-amber-400">
                {dataInfo.gm_version}
              </Badge>
              {dataInfo.is_yyc && (
                <Badge variant="outline" className="text-2xs border-purple-500/30 text-purple-400">
                  {t('gameMakerTranslator.exeStrings')}</Badge>
              )}
              {dataInfo.has_language_files && (
                <Badge variant="outline" className="text-2xs border-emerald-500/30 text-emerald-400">
                  {dataInfo.string_source === 'language_json'
                    ? t('gameMakerTranslator.jsonLang')
                    : t('gameMakerTranslator.jnFiles')} ({dataInfo.language_file_count})
                </Badge>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={importTranslations}>
            <Upload className="h-3 w-3 mr-1" /> {t('gameMakerTranslator.importBtn')}</Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={exportTranslations}
            disabled={translatedCount === 0}>
            <Download className="h-3 w-3 mr-1" /> {t('gameMakerTranslator.export')}</Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px] text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
            onClick={restoreBackup}>
            <RotateCcw className="h-3 w-3 mr-1" /> {t('gameMakerTranslator.restore')}</Button>
        </div>
      </div>

      {/* Scan / Info */}
      {isScanning ? (
        <div className="flex items-center gap-2 py-8 justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{t('gameMakerTranslator.analyzing')}</span>
        </div>
      ) : dataInfo ? (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-4 gap-2">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-2.5 text-center">
                <div className="text-lg font-bold text-white">{dataInfo.total_strings.toLocaleString()}</div>
                <div className="text-micro text-slate-400 uppercase">{t('gameMakerTranslator.total')}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-2.5 text-center">
                <div className="text-lg font-bold text-amber-400">{dataInfo.translatable_strings.toLocaleString()}</div>
                <div className="text-micro text-slate-400 uppercase">{t('common.traducibili')}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-2.5 text-center">
                <div className="text-lg font-bold text-emerald-400">{translatedCount}</div>
                <div className="text-micro text-slate-400 uppercase">{t('gameMakerTranslator.translated')}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-2.5 text-center">
                <div className="text-lg font-bold text-sky-400">{translationPercent}%</div>
                <div className="text-micro text-slate-400 uppercase">{t('common.progresso')}</div>
              </CardContent>
            </Card>
          </div>

          {/* Progress bar */}
          {translatedCount > 0 && (
            <Progress value={translationPercent} className="h-1.5" />
          )}

          {/* Translation progress */}
          {isTranslating && (
            <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                  <span className="text-sm text-sky-300">
                    {t('gameMakerTranslator.aiTranslationLabel')} {translateProgress}/{translateTotal}
                  </span>
                </div>
                <Button size="sm" variant="destructive" className="h-6 text-2xs"
                  onClick={() => { abortRef.current = true; }}>
                  <X className="h-3 w-3 mr-1" /> {t('gameMakerTranslator.stop')}</Button>
              </div>
              <Progress value={(translateProgress / Math.max(translateTotal, 1)) * 100} className="h-1.5" />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="xs" className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => extractStrings(0)}
              disabled={isExtracting}>
              {isExtracting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
              {t('gameMakerTranslator.extractStrings')}</Button>
            
            <Button size="xs" className="bg-sky-600 hover:bg-sky-700 text-white"
              onClick={translateBatch}
              disabled={isTranslating || strings.length === 0}>
              <Languages className="h-3.5 w-3.5 mr-1.5" />
              {t('gameMakerTranslator.translatePage')}</Button>

            <Button size="xs" className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={translateAll}
              disabled={isTranslating || !dataInfo}>
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              {t('gameMakerTranslator.translateAll')} ({dataInfo.translatable_strings})
            </Button>

            <Button size="xs" className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={patchDataWin}
              disabled={isPatching || translatedCount === 0}>
              {isPatching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              {(dataInfo?.has_language_files
                ? t('gameMakerTranslator.applyBtn')
                : dataInfo?.is_yyc
                  ? t('gameMakerTranslator.saveExeBtn')
                  : t('gameMakerTranslator.saveDataWinBtn')
              ).replace('{n}', String(translatedCount))}
            </Button>
          </div>

          {/* Traduzioni troncate dall'ultima patch */}
          {truncated.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-amber-300">
                    {truncated.length} {t('gameMakerTranslator.truncatedTitle')}
                  </p>
                  <p className="text-[11px] text-amber-200/80 mt-0.5">
                    {t('gameMakerTranslator.truncatedDesc')}
                  </p>
                </div>
                <Button size="xs" variant="outline" className="h-6 text-[10px] shrink-0"
                  onClick={() => setTruncated([])}>
                  {t('common.chiudi')}
                </Button>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {truncated.map((tr) => (
                  <div key={tr.index} className="rounded bg-slate-900/60 px-2 py-1.5 text-[11px] space-y-0.5">
                    <div className="flex items-center gap-2 text-slate-500 text-[10px]">
                      <span>#{tr.index}</span>
                      <span>{tr.needed_bytes} → {tr.available_bytes} {t('gameMakerTranslator.truncatedBytes')}</span>
                    </div>
                    <div className="text-slate-400 truncate" title={tr.original}>
                      {t('gameMakerTranslator.truncatedOriginal')}: {tr.original}
                    </div>
                    <div className="text-amber-200 truncate" title={tr.translated}>
                      {t('gameMakerTranslator.truncatedRequested')}: {tr.translated}
                    </div>
                    <div className="text-emerald-300/80 truncate" title={tr.written}>
                      {t('gameMakerTranslator.truncatedWritten')}: {tr.written || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search + Filter */}
          {strings.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  aria-label={t('common.cerca')} placeholder={t('gameMakerTranslator.searchPh')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') searchStrings(); }}
                  className="pl-8 h-8 text-sm bg-slate-800/50 border-slate-700/50"
                />
              </div>
              <Button size="sm" variant="outline" className="h-8" onClick={searchStrings}>
                <Search className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant={showOnlyUntranslated ? "default" : "outline"} className="h-8 text-[11px]"
                onClick={() => setShowOnlyUntranslated(!showOnlyUntranslated)}>
                <Filter className="h-3 w-3 mr-1" />
                {t('gameMakerTranslator.onlyUntranslated')}</Button>
            </div>
          )}

          {/* String list */}
          {strings.length > 0 && (
            <div className="border border-slate-700/50 rounded-lg overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[50px_1fr_1fr_60px] gap-2 px-3 py-2 bg-slate-800/80 text-2xs uppercase text-slate-400 font-bold tracking-wider">
                <span>#</span>
                <span>{t('gameMakerTranslator.original')}</span>
                <span>{t('common.traduzione')}</span>
                <span className="text-center">{t('gameMakerTranslator.actions')}</span>
              </div>

              {/* Rows */}
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar divide-y divide-slate-800/50">
                {displayStrings.map((s) => (
                  <div key={s.index} className={`grid grid-cols-[50px_1fr_1fr_60px] gap-2 px-3 py-2 text-xs hover:bg-slate-800/30 transition-colors ${translations[s.index] ? 'bg-emerald-500/5' : ''}`}>
                    <span className="text-slate-500 font-mono text-2xs">{s.index}</span>
                    
                    <div className="text-slate-300 break-words line-clamp-3 leading-relaxed" title={s.original}>
                      {s.original.length > 200 ? s.original.slice(0, 200) + '...' : s.original}
                    </div>
                    
                    <div className="min-w-0">
                      {editingIndex === s.index ? (
                        <div className="flex gap-1">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-7 text-xs flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(s.index);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                          />
                          <Button size="xs" className="w-7 p-0" onClick={() => saveEdit(s.index)}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : translations[s.index] ? (
                        <span className="text-emerald-400 break-words line-clamp-3 leading-relaxed cursor-pointer hover:underline"
                          onClick={() => startEdit(s)}
                          title={translations[s.index]}>
                          {translations[s.index].length > 200 ? translations[s.index].slice(0, 200) + '...' : translations[s.index]}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">—</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-center gap-0.5">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEdit(s)} title={t('common.modifica')}>
                        <Edit3 className="h-3 w-3 text-slate-400" />
                      </Button>
                      {translations[s.index] && (
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" 
                          onClick={() => {
                            const { [s.index]: _, ...rest } = translations;
                            setTranslations(rest);
                          }}
                          title={t('common.rimuoviTraduzione')}>
                          <X className="h-3 w-3 text-red-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {page >= 0 && totalPages > 1 && (
                <div className="flex items-center justify-between px-3 py-2 bg-slate-800/60 border-t border-slate-700/50">
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                    disabled={page === 0}
                    onClick={() => extractStrings(page - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> {t('gameMakerTranslator.previous')}</Button>
                  <span className="text-[11px] text-slate-400">
                    {t('gameMakerTranslator.page')} {page + 1}  {t('gameMakerTranslator.of')} {totalPages}
                  </span>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                    disabled={page >= totalPages - 1}
                    onClick={() => extractStrings(page + 1)}>
                    {t('gameMakerTranslator.next')}<ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {strings.length === 0 && !isExtracting && (
            <div className="text-center py-8 text-slate-500">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('gameMakerTranslator.clickExtractPrompt')}</p>
              <p className="text-[11px] mt-1">{t('gameMakerTranslator.willExtractDesc')}</p>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-[11px] text-amber-300/80 leading-relaxed">
              {/* La nota sui troncamenti vale per data.win/EXE (riscrittura in place).
                  Per i file di lingua JSON è FALSA: sono testo e possono crescere. */}
              <strong>{t('gameMakerTranslator.noteLabel')}</strong>  {dataInfo?.string_source === 'language_json'
                ? t('gameMakerTranslator.noteTextJson')
                : t('gameMakerTranslator.noteText')}</div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-slate-500">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('gameMakerTranslator.dataWinNotFound')}</p>
          <p className="text-[11px] mt-1">{gamePath}</p>
        </div>
      )}
    </div>
  );
}

