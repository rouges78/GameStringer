'use client';

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  FolderOpen,
  Download,
  Upload,
  Search,
  Check,
  X,
  Gamepad2,
  Sparkles,
  ExternalLink,
  Loader2,
  Save,
  FileJson
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { generatePOString, entriesToGeneric, type PoMetadata } from '@/lib/po-export';
import { WizardStepper, type WizardStep } from '@/components/ui/wizard-stepper';
import { clientLogger } from '@/lib/client-logger';

interface RpgMakerGame {
  path: string;
  version: string;
  title: string;
  data_files: RpgMakerDataFile[];
}

interface RpgMakerDataFile {
  path: string;
  filename: string;
  file_type: string;
  size: number;
  string_count: number | null;
}

interface RpgMakerString {
  id: string;
  original: string;
  translated: string;
  context: string;
  file: string;
}

interface ExtractionResult {
  success: boolean;
  message: string;
  strings: RpgMakerString[];
  total_count: number;
}

interface RpgMakerStats {
  total: number;
  translated: number;
  untranslated: number;
  percentage: number;
  by_file: { file: string; total: number; translated: number }[];
}

interface TranslatorPlusInfo {
  available: boolean;
  download_url: string;
  description: string;
  supported_engines: string[];
}

export default function RpgMakerPatcherPage() {
  const { t } = useTranslation();
  const [game, setGame] = useState<RpgMakerGame | null>(null);
  const [strings, setStrings] = useState<RpgMakerString[]>([]);
  const [stats, setStats] = useState<RpgMakerStats | null>(null);
  const [translatorInfo, setTranslatorInfo] = useState<TranslatorPlusInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTranslation, setEditedTranslation] = useState('');
  const [filterFile, setFilterFile] = useState<string>('all');

  useEffect(() => {
    loadTranslatorInfo();
  }, []);

  useEffect(() => {
    if (strings.length > 0) {
      updateStats();
    }
  }, [strings]);

  const loadTranslatorInfo = async () => {
    try {
      const info = await invoke<TranslatorPlusInfo>('get_translator_plus_info');
      setTranslatorInfo(info);
    } catch (e: unknown) {
      clientLogger.error('Errore caricamento info Translator++:', e);
    }
  };

  const updateStats = async () => {
    try {
      const newStats = await invoke<RpgMakerStats>('get_rpgmaker_translation_stats', { strings });
      setStats(newStats);
    } catch (e: unknown) {
      clientLogger.error('Errore calcolo stats:', e);
    }
  };

  const selectGameFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        title: 'Seleziona cartella gioco RPG Maker',
      });
      
      if (selected) {
        setLoading(true);
        const detected = await invoke<RpgMakerGame>('detect_rpgmaker_game', {
          gamePath: selected,
        });
        setGame(detected);
        setStrings([]);
        setStats(null);
        toast.success(`Rilevato: ${detected.title} (${detected.version})`);
      }
    } catch (e: unknown) {
      toast.error(`Errore: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const extractAllStrings = async () => {
    if (!game) return;
    
    try {
      setExtracting(true);
      const result = await invoke<ExtractionResult>('extract_all_rpgmaker_strings', {
        gamePath: game.path,
      });
      
      if (result.success) {
        setStrings(result.strings);
        toast.success(`Estratte ${result.total_count} stringhe`);
      } else {
        toast.error(result.message);
      }
    } catch (e: unknown) {
      toast.error(`Errore estrazione: ${e}`);
    } finally {
      setExtracting(false);
    }
  };

  const saveTranslations = async () => {
    try {
      const filePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: `${game?.title || 'translations'}_translations.json`,
      });
      
      if (filePath) {
        const count = await invoke<number>('save_rpgmaker_translations', {
          outputPath: filePath,
          strings,
        });
        toast.success(`Salvate ${count} traduzioni`);
      }
    } catch (e: unknown) {
      toast.error(`Errore salvataggio: ${e}`);
    }
  };

  const loadTranslations = async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        title: 'Carica traduzioni',
      });
      
      if (filePath && typeof filePath === 'string') {
        const loaded = await invoke<RpgMakerString[]>('load_rpgmaker_translations', {
          inputPath: filePath,
        });
        setStrings(loaded);
        toast.success(`Caricate ${loaded.length} traduzioni`);
      }
    } catch (e: unknown) {
      toast.error(`Errore caricamento: ${e}`);
    }
  };

  const handleExportPO = useCallback(() => {
    const generic = entriesToGeneric(strings, 'rpgmaker');
    const metadata: PoMetadata = {
      project_name: game?.title || 'GameStringer Project',
      language: 'it',
      source_language: 'en',
      game_engine: 'rpgmaker',
      generator: 'GameStringer',
    };
    const poContent = generatePOString(generic, metadata);
    const blob = new Blob([poContent], { type: 'text/x-gettext; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${game?.title || 'translation'}.po`;
    a.click();
    URL.revokeObjectURL(url);
  }, [strings, game]);

  const updateTranslation = (id: string, translation: string) => {
    setStrings(prev => prev.map(s =>
      s.id === id ? { ...s, translated: translation } : s
    ));
    setEditingId(null);
  };

  const getVersionBadge = (version: string) => {
    const colors: Record<string, string> = {
      'MV': 'bg-blue-500',
      'MZ': 'bg-purple-500',
      'VXAce': 'bg-orange-500',
      'VX': 'bg-yellow-500',
      'XP': 'bg-red-500',
    };
    return <Badge className={colors[version] || 'bg-gray-500'}>{version}</Badge>;
  };

  const filteredStrings = strings.filter(s => {
    const matchesSearch = s.original.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.translated.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFile = filterFile === 'all' || s.file === filterFile;
    return matchesSearch && matchesFile;
  });

  const uniqueFiles = [...new Set(strings.map(s => s.file))];

  const RPGMAKER_STEPS: WizardStep[] = [
    { num: 1, label: 'Selezione Gioco' },
    { num: 2, label: 'Traduzioni' },
    { num: 3, label: 'Esporta' },
  ];
  const rpgmakerCurrentStep = stats && stats.translated > 0 ? 3 : strings.length > 0 ? 2 : 1;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-4 overflow-y-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-700 via-indigo-600 to-purple-700 p-4 shrink-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Gamepad2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{t('rpgmakerPatcherPage.title')}</h1>
              <p className="text-white/70 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{t('rpgmakerPatcherPage.subtitle')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {translatorInfo && (
              translatorInfo.available ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
                  <Check className="h-3.5 w-3.5 text-blue-300" />
                  <span className="text-sm font-bold text-white">T++</span>
                  <span className="text-2xs text-white/70">{t('workshop.installed')}</span>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="bg-black/30 border-white/20 text-white hover:bg-black/50" asChild>
                  <a href={translatorInfo.download_url} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-2" />
                    Translator++
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      <WizardStepper steps={RPGMAKER_STEPS} currentStep={rpgmakerCurrentStep} size="sm" />

      {/* Game Selection */}
      <Card variant="muted">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-blue-400" />{t('telltale.selectGame')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-3">
            <Button onClick={selectGameFolder} disabled={loading} size="xs" className="bg-blue-600 hover:bg-blue-500">
              {loading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <FolderOpen className="w-3 h-3 mr-2" />}
              Sfoglia
            </Button>
            
            {game && (
              <>
                <div className="flex items-center gap-2">
                  {getVersionBadge(game.version)}
                  <span className="font-medium">{game.title}</span>
                  <Badge variant="outline" className="text-xs">{game.data_files.length} file</Badge>
                </div>
                
                <Button 
                  onClick={extractAllStrings} 
                  disabled={extracting}
                  size="sm" 
                  className="h-8 bg-indigo-600 hover:bg-indigo-500 ml-auto"
                >
                  {extracting ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Sparkles className="w-3 h-3 mr-2" />}
                  Estrai Stringhe
                </Button>
              </>
            )}
          </div>
          
          {game && (
            <p className="text-2xs text-muted-foreground font-mono bg-slate-950/50 p-2 rounded mt-3 border border-slate-800/50 truncate">
              {game.path}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats & Actions */}
      {stats && (
        <Card variant="muted">
          <CardContent className="pt-4 px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-2xl font-bold text-blue-400">{stats.percentage}%</p>
                  <p className="text-xs text-muted-foreground">{t('batchTranslator.done')}</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{stats.translated} tradotte</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <X className="w-4 h-4 text-red-500" />
                    <span>{stats.untranslated} mancanti</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={loadTranslations} size="sm" className="h-8">
                  <Upload className="w-3 h-3 mr-1" />
                  Carica
                </Button>
                <Button onClick={saveTranslations} size="xs" className="bg-blue-600 hover:bg-blue-500">
                  <Save className="w-3 h-3 mr-1" />{t('glossaryManager.save')}</Button>
                <Button size="sm" variant="outline" onClick={handleExportPO} disabled={strings.length === 0} className="h-8" aria-label="Esporta file PO">
                  <Download className="h-4 w-4 mr-1.5" />
                  PO
                </Button>
              </div>
            </div>
            <Progress value={stats.percentage} className="h-2 bg-slate-800" />
          </CardContent>
        </Card>
      )}

      {/* Editor */}
      <Card variant="muted" className="flex-1">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileJson className="w-4 h-4 text-blue-400" />
              Editor Traduzioni
              {strings.length > 0 && (
                <Badge variant="outline" className="ml-2">{filteredStrings.length} / {strings.length}</Badge>
              )}
            </CardTitle>
          </div>
          
          {strings.length > 0 && (
            <div className="flex gap-3 mt-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  aria-label="Cerca" placeholder="Cerca testi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-8 bg-slate-950/50 border-slate-700"
                />
              </div>
              <select
                value={filterFile}
                onChange={(e) => setFilterFile(e.target.value)}
                className="h-8 px-3 rounded-md bg-slate-950/50 border border-slate-700 text-sm"
              >
                <option value="all">{t('rpgmakerPatcherPage.allFiles')}</option>
                {uniqueFiles.map(file => (
                  <option key={file} value={file}>{file}</option>
                ))}
              </select>
            </div>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ScrollArea className="h-[400px]">
            {filteredStrings.length > 0 ? (
              <div className="space-y-3">
                {filteredStrings.slice(0, 100).map((entry) => {
                  const isEditing = editingId === entry.id;
                  const isUntranslated = !entry.translated;
                  
                  return (
                    <div
                      key={entry.id}
                      className={`p-3 rounded-lg border ${isUntranslated ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-slate-800'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-2xs">{entry.file}</Badge>
                        <span className="text-2xs text-muted-foreground">{entry.context}</span>
                      </div>
                      
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground uppercase mb-1">{t('offlineTranslator.original')}</p>
                        <p className="text-sm font-mono bg-slate-950/50 p-2 rounded border border-slate-800">
                          {entry.original}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">{t('offlineTranslator.translation')}</p>
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editedTranslation}
                              onChange={(e) => setEditedTranslation(e.target.value)}
                              className="font-mono text-sm bg-slate-950/50 border-slate-700"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateTranslation(entry.id, editedTranslation)}
                                className="h-7 bg-blue-600 hover:bg-blue-500"
                              >
                                <Check className="w-3 h-3 mr-1" />{t('glossaryManager.save')}</Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingId(null)}
                                className="h-7"
                              >{t('workshop.unsubscribe')}</Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingId(entry.id);
                              setEditedTranslation(entry.translated);
                            }}
                            className={`p-2 rounded cursor-pointer hover:bg-slate-800/50 transition-colors text-sm ${
                              isUntranslated ? 'text-muted-foreground italic' : 'font-mono'
                            }`}
                          >
                            {entry.translated || 'Clicca per tradurre...'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredStrings.length > 100 && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    Mostrando 100 di {filteredStrings.length} stringhe. Usa la ricerca per filtrare.
                  </p>
                )}
              </div>
            ) : strings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Gamepad2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">{t('rpgmakerPatcherPage.noStrings')}</p>
                <p className="text-sm mt-1">
                  Seleziona un gioco RPG Maker e clicca &quot;Estrai Stringhe&quot;
                </p>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">{t('workshop.noResults')}</p>
                <p className="text-sm mt-1">
                  Prova con un altro termine di ricerca
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
