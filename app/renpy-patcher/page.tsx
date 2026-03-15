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
import { 
  FolderOpen, 
  FileText, 
  Download, 
  Upload, 
  Search,
  Check,
  X,
  Heart,
  Sparkles,
  Loader2,
  Save,
  Globe,
  MessageSquare,
  User,
  List
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';

interface RenpyGame {
  path: string;
  title: string;
  version: string | null;
  script_files: RenpyScriptFile[];
  has_translations: boolean;
  available_languages: string[];
}

interface RenpyScriptFile {
  path: string;
  filename: string;
  size: number;
  string_count: number | null;
}

interface RenpyString {
  id: string;
  original: string;
  translated: string;
  file: string;
  line_number: number;
  string_type: string;
  character: string | null;
}

interface RenpyExtractionResult {
  success: boolean;
  message: string;
  strings: RenpyString[];
  total_count: number;
}

interface RenpyStats {
  total: number;
  translated: number;
  untranslated: number;
  percentage: number;
  by_type: Record<string, number>;
}

export default function RenpyPatcherPage() {
  const { t } = useTranslation();
  const [game, setGame] = useState<RenpyGame | null>(null);
  const [strings, setStrings] = useState<RenpyString[]>([]);
  const [stats, setStats] = useState<RenpyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTranslation, setEditedTranslation] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [targetLanguage, setTargetLanguage] = useState('italian');

  useEffect(() => {
    if (strings.length > 0) {
      updateStats();
    }
  }, [strings]);

  const updateStats = async () => {
    try {
      const newStats = await invoke<RenpyStats>('get_renpy_translation_stats', { strings });
      setStats(newStats);
    } catch (e) {
      console.error('Errore calcolo stats:', e);
    }
  };

  const selectGameFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        title: "Seleziona cartella gioco Ren'Py",
      });
      
      if (selected) {
        setLoading(true);
        const detected = await invoke<RenpyGame>('detect_renpy_game', {
          gamePath: selected,
        });
        setGame(detected);
        setStrings([]);
        setStats(null);
        toast.success(`Rilevato: ${detected.title}`);
      }
    } catch (e) {
      toast.error(`Errore: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const extractAllStrings = async () => {
    if (!game) return;
    
    try {
      setExtracting(true);
      const result = await invoke<RenpyExtractionResult>('extract_all_renpy_strings', {
        gamePath: game.path,
      });
      
      if (result.success) {
        setStrings(result.strings);
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

  const generateTranslation = async () => {
    if (!game || strings.length === 0) return;
    
    try {
      setGenerating(true);
      const result = await invoke<string>('generate_renpy_translation', {
        gamePath: game.path,
        language: targetLanguage,
        strings,
      });
      toast.success(result);
    } catch (e) {
      toast.error(`Errore generazione: ${e}`);
    } finally {
      setGenerating(false);
    }
  };

  const saveTranslations = async () => {
    try {
      const filePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: `${game?.title || 'renpy'}_translations.json`,
      });
      
      if (filePath) {
        const count = await invoke<number>('save_renpy_translations', {
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
        const loaded = await invoke<RenpyString[]>('load_renpy_translations', {
          inputPath: filePath,
        });
        setStrings(loaded);
        toast.success(`Caricate ${loaded.length} traduzioni`);
      }
    } catch (e) {
      toast.error(`Errore caricamento: ${e}`);
    }
  };

  const updateTranslation = (id: string, translation: string) => {
    setStrings(prev => prev.map(s => 
      s.id === id ? { ...s, translated: translation } : s
    ));
    setEditingId(null);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Dialogue': return <MessageSquare className="w-3 h-3" />;
      case 'Menu': return <List className="w-3 h-3" />;
      case 'Narration': return <FileText className="w-3 h-3" />;
      default: return <FileText className="w-3 h-3" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'Dialogue': return 'bg-pink-500';
      case 'Menu': return 'bg-purple-500';
      case 'Narration': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const filteredStrings = strings.filter(s => {
    const matchesSearch = s.original.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.translated.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.character?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesType = filterType === 'all' || s.string_type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-4 overflow-y-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-pink-600 via-rose-500 to-red-600 p-4 shrink-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Heart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">Ren'Py Patcher</h1>
              <p className="text-white/70 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">Estrai e traduci visual novel Ren'Py</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <a 
              href="https://www.renpy.org/doc/html/translation.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10 text-white text-xs hover:bg-black/50 transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              Docs
            </a>
          </div>
        </div>
      </div>

      {/* Game Selection */}
      <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-pink-400" />
            Seleziona Gioco
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-3">
            <Button onClick={selectGameFolder} disabled={loading} size="sm" className="h-8 bg-pink-600 hover:bg-pink-500">
              {loading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <FolderOpen className="w-3 h-3 mr-2" />}
              Sfoglia
            </Button>
            
            {game && (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{game.title}</span>
                  {game.version && <Badge variant="outline" className="text-xs">v{game.version}</Badge>}
                  <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30">{game.script_files.length} script</Badge>
                  {game.has_translations && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      {game.available_languages.length} lingue
                    </Badge>
                  )}
                </div>
                
                <Button 
                  onClick={extractAllStrings} 
                  disabled={extracting}
                  size="sm" 
                  className="h-8 bg-rose-600 hover:bg-rose-500 ml-auto"
                >
                  {extracting ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Sparkles className="w-3 h-3 mr-2" />}
                  Estrai Stringhe
                </Button>
              </>
            )}
          </div>
          
          {game && (
            <p className="text-[10px] text-muted-foreground font-mono bg-slate-950/50 p-2 rounded mt-3 border border-slate-800/50 truncate">
              {game.path}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats & Actions */}
      {stats && (
        <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
          <CardContent className="pt-4 px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-2xl font-bold text-pink-400">{stats.percentage}%</p>
                  <p className="text-xs text-muted-foreground">Completato</p>
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
                <div className="flex gap-2 text-xs">
                  {Object.entries(stats.by_type).map(([type, count]) => (
                    <Badge key={type} variant="outline" className="text-[10px]">
                      {type}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={loadTranslations} size="sm" className="h-8">
                  <Upload className="w-3 h-3 mr-1" />
                  Carica
                </Button>
                <Button onClick={saveTranslations} size="sm" className="h-8 bg-pink-600 hover:bg-pink-500">
                  <Save className="w-3 h-3 mr-1" />
                  Salva
                </Button>
              </div>
            </div>
            <Progress value={stats.percentage} className="h-2 bg-slate-800" />
            
            {/* Generate Translation */}
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-800">
              <span className="text-sm text-muted-foreground">Genera file tl/:</span>
              <Input
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                placeholder="es: italian"
                className="w-32 h-8 bg-slate-950/50 border-slate-700 text-sm"
              />
              <Button 
                onClick={generateTranslation} 
                disabled={generating || stats.translated === 0}
                size="sm" 
                className="h-8 bg-green-600 hover:bg-green-500"
              >
                {generating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                Genera .rpy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Editor */}
      <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30 flex-1">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-pink-400" />
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
                  placeholder="Cerca testi o personaggi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-8 bg-slate-950/50 border-slate-700"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-8 px-3 rounded-md bg-slate-950/50 border border-slate-700 text-sm"
              >
                <option value="all">Tutti i tipi</option>
                <option value="Dialogue">Dialoghi</option>
                <option value="Menu">Menu</option>
                <option value="Narration">Narrazione</option>
              </select>
            </div>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ScrollArea className="h-[350px]">
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
                        <div className="flex items-center gap-2">
                          <Badge className={`${getTypeBadgeColor(entry.string_type)} text-[10px] flex items-center gap-1`}>
                            {getTypeIcon(entry.string_type)}
                            {entry.string_type}
                          </Badge>
                          {entry.character && (
                            <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                              <User className="w-2.5 h-2.5" />
                              {entry.character}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{entry.file}:{entry.line_number}</span>
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
                                className="h-7 bg-pink-600 hover:bg-pink-500"
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Salva
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingId(null)}
                                className="h-7"
                              >
                                Annulla
                              </Button>
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
                <Heart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nessuna stringa estratta</p>
                <p className="text-sm mt-1">
                  Seleziona un gioco Ren'Py e clicca "Estrai Stringhe"
                </p>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nessun risultato</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
