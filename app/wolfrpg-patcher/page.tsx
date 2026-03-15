'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FolderOpen, 
  FileText, 
  Download, 
  Upload, 
  Search,
  Check,
  X,
  Sparkles,
  Loader2,
  Save,
  Database,
  Map,
  AlertTriangle,
  ExternalLink,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';

interface WolfRpgGame {
  path: string;
  title: string;
  data_files: WolfRpgDataFile[];
  map_files: WolfRpgMapFile[];
  has_game_dat: boolean;
}

interface WolfRpgDataFile {
  path: string;
  filename: string;
  size: number;
  file_type: string;
}

interface WolfRpgMapFile {
  path: string;
  filename: string;
  map_id: number;
  size: number;
}

interface WolfRpgString {
  id: string;
  original: string;
  translated: string;
  file: string;
  context: string;
  string_type: string;
}

interface WolfRpgExtractionResult {
  success: boolean;
  message: string;
  strings: WolfRpgString[];
  total_count: number;
  requires_decryption: boolean;
}

interface WolfRpgStats {
  total: number;
  translated: number;
  untranslated: number;
  percentage: number;
  by_type: Record<string, number>;
}

interface WolfTransInfo {
  available: boolean;
  download_url: string;
  description: string;
}

export default function WolfRpgPatcherPage() {
  const { t } = useTranslation();
  const [game, setGame] = useState<WolfRpgGame | null>(null);
  const [strings, setStrings] = useState<WolfRpgString[]>([]);
  const [stats, setStats] = useState<WolfRpgStats | null>(null);
  const [toolInfo, setToolInfo] = useState<WolfTransInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTranslation, setEditedTranslation] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    loadToolInfo();
  }, []);

  useEffect(() => {
    if (strings.length > 0) {
      updateStats();
    }
  }, [strings]);

  const loadToolInfo = async () => {
    try {
      const info = await invoke<WolfTransInfo>('get_wolftrans_info');
      setToolInfo(info);
    } catch (e) {
      console.error('Errore caricamento info:', e);
    }
  };

  const updateStats = async () => {
    try {
      const newStats = await invoke<WolfRpgStats>('get_wolfrpg_translation_stats', { strings });
      setStats(newStats);
    } catch (e) {
      console.error('Errore calcolo stats:', e);
    }
  };

  const selectGameFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        title: 'Seleziona cartella gioco Wolf RPG',
      });
      
      if (selected) {
        setLoading(true);
        const detected = await invoke<WolfRpgGame>('detect_wolfrpg_game', {
          gamePath: selected,
        });
        setGame(detected);
        setStrings([]);
        setStats(null);
        setSelectedFile(null);
        toast.success(`Rilevato: ${detected.title}`);
      }
    } catch (e) {
      toast.error(`Errore: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const extractFromFile = async (filePath: string) => {
    try {
      setExtracting(true);
      setSelectedFile(filePath);
      
      const result = await invoke<WolfRpgExtractionResult>('extract_wolfrpg_strings_basic', {
        filePath,
      });
      
      if (result.requires_decryption) {
        toast.warning(result.message);
      } else if (result.success) {
        setStrings(prev => [...prev, ...result.strings]);
        toast.success(`Estratte ${result.total_count} stringhe`);
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error(`Errore estrazione: ${e}`);
    } finally {
      setExtracting(false);
    }
  };

  const saveTranslations = async () => {
    try {
      const filePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: `${game?.title || 'wolfrpg'}_translations.json`,
      });
      
      if (filePath) {
        const count = await invoke<number>('save_wolfrpg_translations', {
          outputPath: filePath,
          strings,
        });
        toast.success(`Salvate ${count} traduzioni`);
      }
    } catch (e) {
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
        const loaded = await invoke<WolfRpgString[]>('load_wolfrpg_translations', {
          inputPath: filePath,
        });
        setStrings(loaded);
        toast.success(`Caricate ${loaded.length} traduzioni`);
      }
    } catch (e) {
      toast.error(`Errore caricamento: ${e}`);
    }
  };

  const exportCSV = async () => {
    try {
      const filePath = await save({
        filters: [{ name: 'CSV', extensions: ['csv'] }],
        defaultPath: `${game?.title || 'wolfrpg'}_export.csv`,
      });
      
      if (filePath) {
        const count = await invoke<number>('export_for_translator_plus', {
          strings,
          outputPath: filePath,
        });
        toast.success(`Esportate ${count} stringhe in CSV`);
      }
    } catch (e) {
      toast.error(`Errore esportazione: ${e}`);
    }
  };

  const importCSV = async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'CSV', extensions: ['csv'] }],
        title: 'Importa da CSV',
      });
      
      if (filePath && typeof filePath === 'string') {
        const imported = await invoke<WolfRpgString[]>('import_from_translator_plus', {
          inputPath: filePath,
        });
        setStrings(imported);
        toast.success(`Importate ${imported.length} stringhe`);
      }
    } catch (e) {
      toast.error(`Errore importazione: ${e}`);
    }
  };

  const updateTranslation = (id: string, translation: string) => {
    setStrings(prev => prev.map(s => 
      s.id === id ? { ...s, translated: translation } : s
    ));
    setEditingId(null);
  };

  const filteredStrings = strings.filter(s => 
    s.original.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.translated.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-4 overflow-y-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-600 via-amber-500 to-yellow-500 p-4 shrink-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">Wolf RPG Patcher</h1>
              <p className="text-white/70 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">Estrai e traduci giochi Wolf RPG Editor</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <a 
              href="https://dreamsavior.net/translator-plusplus/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10 text-white text-xs hover:bg-black/50 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Translator++
            </a>
          </div>
        </div>
      </div>

      {/* Game Selection */}
      <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-orange-400" />{t('telltale.selectGame')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-3">
            <Button onClick={selectGameFolder} disabled={loading} size="sm" className="h-8 bg-orange-600 hover:bg-orange-500">
              {loading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <FolderOpen className="w-3 h-3 mr-2" />}
              Sfoglia
            </Button>
            
            {game && (
              <div className="flex items-center gap-2">
                <span className="font-medium">{game.title}</span>
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                  {game.data_files.length} file
                </Badge>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {game.map_files.length} mappe
                </Badge>
                {game.has_game_dat && (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Game.dat
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          {game && (
            <p className="text-[10px] text-muted-foreground font-mono bg-slate-950/50 p-2 rounded mt-3 border border-slate-800/50 truncate">
              {game.path}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Warning for encrypted games */}
      {game?.has_game_dat && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-sm">
            Questo gioco usa <strong>Game.dat</strong> (pacchetto criptato). 
            Per estrarre i testi completi, usa <strong>Translator++</strong> con il plugin Wolf RPG.
            I file .dat singoli possono essere estratti con metodo euristico.
          </AlertDescription>
        </Alert>
      )}

      {/* File List & Extraction */}
      {game && (
        <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-orange-400" />
              File Dati
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ScrollArea className="h-[150px]">
              <div className="space-y-1">
                {game.data_files.map((file, i) => (
                  <div 
                    key={i}
                    className={`flex items-center justify-between p-2 rounded text-sm border transition-all ${
                      selectedFile === file.path 
                        ? 'bg-orange-500/20 border-orange-500/40' 
                        : 'hover:bg-slate-800/50 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono text-xs">{file.filename}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {(file.size / 1024).toFixed(1)} KB
                      </Badge>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => extractFromFile(file.path)}
                      disabled={extracting || file.filename.toLowerCase() === 'game.dat'}
                      className="h-6 text-xs"
                    >
                      {extracting && selectedFile === file.path ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Stats & Actions */}
      {stats && stats.total > 0 && (
        <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
          <CardContent className="pt-4 px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-2xl font-bold text-orange-400">{stats.percentage}%</p>
                  <p className="text-xs text-muted-foreground">{t('batchTranslator.done')}</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{stats.translated}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <X className="w-4 h-4 text-red-500" />
                    <span>{stats.untranslated}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={importCSV} size="sm" className="h-8">
                  <FileSpreadsheet className="w-3 h-3 mr-1" />
                  CSV
                </Button>
                <Button variant="outline" onClick={loadTranslations} size="sm" className="h-8">
                  <Upload className="w-3 h-3 mr-1" />
                  Carica
                </Button>
                <Button onClick={saveTranslations} size="sm" className="h-8 bg-orange-600 hover:bg-orange-500">
                  <Save className="w-3 h-3 mr-1" />{t('glossaryManager.save')}</Button>
                <Button onClick={exportCSV} size="sm" className="h-8 bg-amber-600 hover:bg-amber-500">
                  <Download className="w-3 h-3 mr-1" />{t('projects.export')}</Button>
              </div>
            </div>
            <Progress value={stats.percentage} className="h-2 bg-slate-800" />
          </CardContent>
        </Card>
      )}

      {/* Editor */}
      <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30 flex-1">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-400" />
              Editor Traduzioni
              {strings.length > 0 && (
                <Badge variant="outline" className="ml-2">{filteredStrings.length} / {strings.length}</Badge>
              )}
            </CardTitle>
          </div>
          
          {strings.length > 0 && (
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cerca testi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-8 bg-slate-950/50 border-slate-700"
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ScrollArea className="h-[300px]">
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
                        <Badge variant="outline" className="text-[10px]">{entry.file}</Badge>
                      </div>
                      
                      <div className="mb-2">
                        <p className="text-sm font-mono bg-slate-950/50 p-2 rounded border border-slate-800">
                          {entry.original}
                        </p>
                      </div>
                      
                      <div>
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
                                className="h-7 bg-orange-600 hover:bg-orange-500"
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
                    Mostrando 100 di {filteredStrings.length} stringhe
                  </p>
                )}
              </div>
            ) : strings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nessuna stringa estratta</p>
                <p className="text-sm mt-1">
                  Seleziona un file .dat e clicca l'icona ✨ per estrarre
                </p>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">{t('workshop.noResults')}</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
