'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@/lib/tauri-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Loader2, Search, Languages, Download, Upload, RotateCcw, 
  ChevronLeft, ChevronRight, FileText, Zap, Check, X,
  Filter, ArrowUpDown, Edit3, Save, AlertTriangle, Database
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

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

interface GameMakerTranslatorProps {
  gamePath: string;
  gameName: string;
}

const PAGE_SIZE = 50;

export function GameMakerTranslator({ gamePath, gameName }: GameMakerTranslatorProps) {
  const { t, language } = useTranslation();
  
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
  const abortRef = useRef(false);

  // Scan data.win on mount
  const scanDataWin = useCallback(async () => {
    setIsScanning(true);
    try {
      const info = await invoke<GmDataInfo>('gm_scan_data_win', { gamePath });
      setDataInfo(info);
      setTotalTranslatable(info.translatable_strings);
      toast.success(info.has_language_files 
        ? `Language Files: ${info.translatable_strings} stringhe in ${info.language_file_count} file .jn`
        : info.is_yyc 
          ? `YYC: ${info.translatable_strings} stringhe traducibili dall'EXE` 
          : `data.win: ${info.translatable_strings} stringhe traducibili`);
    } catch (e: unknown) {
      toast.error(e?.toString() || 'data.win non trovato');
    } finally {
      setIsScanning(false);
    }
  }, [gamePath]);

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
      toast.info('Tutte le stringhe visibili sono già tradotte');
      return;
    }

    setIsTranslating(true);
    setTranslateProgress(0);
    setTranslateTotal(toTranslate.length);
    abortRef.current = false;

    const newTranslations: Record<number, string> = { ...translations };
    let done = 0;

    // Batch translate in groups of 5
    for (let i = 0; i < toTranslate.length; i += 5) {
      if (abortRef.current) break;
      
      const batch = toTranslate.slice(i, i + 5);
      const promises = batch.map(async (s) => {
        try {
          const result = await invoke<{ translated_text: string }>('translate_text_simple', {
            text: s.original,
            targetLang: 'it',
          });
          if (result?.translated_text) {
            newTranslations[s.index] = result.translated_text;
          }
        } catch {
          // Skip failed translations
        }
      });

      await Promise.all(promises);
      done += batch.length;
      setTranslateProgress(done);
      setTranslations({ ...newTranslations });
    }

    setIsTranslating(false);
    const translated = Object.keys(newTranslations).length;
    toast.success(`${translated} stringhe tradotte`);
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
              targetLang: 'it',
            });
            if (result?.translated_text) {
              newTranslations[s.index] = result.translated_text;
            }
          } catch {}
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
    
    const total = Object.keys(newTranslations).length;
    toast.success(`Traduzione completata: ${total} stringhe`);
  };

  // Patch data.win with translations
  const patchDataWin = async () => {
    if (Object.keys(translations).length === 0) {
      toast.error('Nessuna traduzione da applicare');
      return;
    }

    setIsPatching(true);
    try {
      const result = await invoke<{ success: boolean; patched_count: number; backup_path: string; message: string }>('gm_patch_strings', {
        gamePath,
        translations,
      });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
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
    toast.success('Traduzioni esportate');
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
        toast.error('File JSON non valido');
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
          <h3 className="text-base font-bold text-white">GameMaker Translator</h3>
          {dataInfo && (
            <>
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                {dataInfo.gm_version}
              </Badge>
              {dataInfo.is_yyc && (
                <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">
                  EXE Strings
                </Badge>
              )}
              {dataInfo.has_language_files && (
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                  .jn Files ({dataInfo.language_file_count})
                </Badge>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={importTranslations}>
            <Upload className="h-3 w-3 mr-1" /> Importa
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={exportTranslations}
            disabled={translatedCount === 0}>
            <Download className="h-3 w-3 mr-1" /> Esporta
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px] text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
            onClick={restoreBackup}>
            <RotateCcw className="h-3 w-3 mr-1" /> Ripristina
          </Button>
        </div>
      </div>

      {/* Scan / Info */}
      {isScanning ? (
        <div className="flex items-center gap-2 py-8 justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Analisi in corso...</span>
        </div>
      ) : dataInfo ? (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-4 gap-2">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-2.5 text-center">
                <div className="text-lg font-bold text-white">{dataInfo.total_strings.toLocaleString()}</div>
                <div className="text-[9px] text-slate-400 uppercase">Totali</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-2.5 text-center">
                <div className="text-lg font-bold text-amber-400">{dataInfo.translatable_strings.toLocaleString()}</div>
                <div className="text-[9px] text-slate-400 uppercase">Traducibili</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-2.5 text-center">
                <div className="text-lg font-bold text-emerald-400">{translatedCount}</div>
                <div className="text-[9px] text-slate-400 uppercase">Tradotte</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-2.5 text-center">
                <div className="text-lg font-bold text-sky-400">{translationPercent}%</div>
                <div className="text-[9px] text-slate-400 uppercase">Progresso</div>
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
                    Traduzione AI: {translateProgress}/{translateTotal}
                  </span>
                </div>
                <Button size="sm" variant="destructive" className="h-6 text-[10px]"
                  onClick={() => { abortRef.current = true; }}>
                  <X className="h-3 w-3 mr-1" /> Stop
                </Button>
              </div>
              <Progress value={(translateProgress / Math.max(translateTotal, 1)) * 100} className="h-1.5" />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" className="h-8 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => extractStrings(0)}
              disabled={isExtracting}>
              {isExtracting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
              Estrai Stringhe
            </Button>
            
            <Button size="sm" className="h-8 bg-sky-600 hover:bg-sky-700 text-white"
              onClick={translateBatch}
              disabled={isTranslating || strings.length === 0}>
              <Languages className="h-3.5 w-3.5 mr-1.5" />
              Traduci Pagina
            </Button>

            <Button size="sm" className="h-8 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={translateAll}
              disabled={isTranslating || !dataInfo}>
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Traduci Tutto ({dataInfo.translatable_strings})
            </Button>

            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={patchDataWin}
              disabled={isPatching || translatedCount === 0}>
              {isPatching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              {dataInfo?.has_language_files 
                ? `Applica Traduzioni (${translatedCount})` 
                : dataInfo?.is_yyc 
                  ? `Salva in EXE (${translatedCount})` 
                  : `Salva in data.win (${translatedCount})`}
            </Button>
          </div>

          {/* Search + Filter */}
          {strings.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Cerca stringhe..."
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
                Solo non tradotte
              </Button>
            </div>
          )}

          {/* String list */}
          {strings.length > 0 && (
            <div className="border border-slate-700/50 rounded-lg overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[50px_1fr_1fr_60px] gap-2 px-3 py-2 bg-slate-800/80 text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                <span>#</span>
                <span>Originale</span>
                <span>Traduzione</span>
                <span className="text-center">Azioni</span>
              </div>

              {/* Rows */}
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar divide-y divide-slate-800/50">
                {displayStrings.map((s) => (
                  <div key={s.index} className={`grid grid-cols-[50px_1fr_1fr_60px] gap-2 px-3 py-2 text-xs hover:bg-slate-800/30 transition-colors ${translations[s.index] ? 'bg-emerald-500/5' : ''}`}>
                    <span className="text-slate-500 font-mono text-[10px]">{s.index}</span>
                    
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
                          <Button size="sm" className="h-7 w-7 p-0" onClick={() => saveEdit(s.index)}>
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
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEdit(s)} title="Modifica">
                        <Edit3 className="h-3 w-3 text-slate-400" />
                      </Button>
                      {translations[s.index] && (
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" 
                          onClick={() => {
                            const { [s.index]: _, ...rest } = translations;
                            setTranslations(rest);
                          }}
                          title="Rimuovi traduzione">
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
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Precedente
                  </Button>
                  <span className="text-[11px] text-slate-400">
                    Pagina {page + 1} di {totalPages}
                  </span>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                    disabled={page >= totalPages - 1}
                    onClick={() => extractStrings(page + 1)}>
                    Successiva <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {strings.length === 0 && !isExtracting && (
            <div className="text-center py-8 text-slate-500">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Clicca "Estrai Stringhe" per iniziare</p>
              <p className="text-[11px] mt-1">Verranno estratte le stringhe traducibili dal data.win</p>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-[11px] text-amber-300/80 leading-relaxed">
              <strong>Nota:</strong> Viene creato un backup automatico (data.win.bak) prima di ogni modifica. 
              Usa "Ripristina" per tornare all'originale. Le traduzioni più lunghe dell'originale verranno 
              troncate per compatibilità con il formato GameMaker.
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-slate-500">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">data.win non trovato in questa cartella</p>
          <p className="text-[11px] mt-1">{gamePath}</p>
        </div>
      )}
    </div>
  );
}
