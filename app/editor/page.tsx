'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FileText, Save, Languages, Search, Edit3, 
  CheckCircle, AlertCircle, Lightbulb, Copy, Download, Upload, 
  Loader2, Trash2, BarChart3, ChevronRight, Sparkles, 
  ArrowLeftRight, LayoutPanelLeft, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { TranslationImportDialog } from '@/components/translation-import-dialog';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ensureArray } from '@/lib/array-utils';
import { cn } from '@/lib/utils';

// --- Types ---
interface Game {
  id: string;
  title: string;
  platform: string;
}

interface AISuggestion {
  id: string;
  suggestion: string;
  confidence: number;
  provider: string;
}

interface Translation {
  id: string;
  gameId: string;
  filePath: string;
  originalText: string;
  translatedText: string;
  targetLanguage: string;
  sourceLanguage: string;
  status: 'pending' | 'completed' | 'reviewed' | 'edited';
  confidence: number;
  isManualEdit: boolean;
  context?: string;
  updatedAt: string;
  game: Game;
  suggestions: AISuggestion[];
}

export default function EditorPage() {
  // --- State ---
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [selectedTranslation, setSelectedTranslation] = useState<Translation | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterGame, setFilterGame] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveTimeoutId, setSaveTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // --- Derived State ---
  const filteredTranslations = useMemo(() => {
    return translations.filter(t => {
      const matchesGame = filterGame === 'all' || t.gameId === filterGame;
      const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
      const matchesSearch = !searchTerm || 
        t.originalText.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.translatedText.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesGame && matchesStatus && matchesSearch;
    });
  }, [translations, filterGame, filterStatus, searchTerm]);

  const stats = useMemo(() => {
    const total = filteredTranslations.length;
    const completed = filteredTranslations.filter(t => t.status === 'completed' || t.status === 'reviewed').length;
    const pending = filteredTranslations.filter(t => t.status === 'pending').length;
    const edited = filteredTranslations.filter(t => t.status === 'edited').length;
    return { total, completed, pending, edited };
  }, [filteredTranslations]);

  // --- Effects ---
  useEffect(() => {
    fetchGames();
  }, []);

  useEffect(() => {
    fetchTranslations();
  }, [filterGame, filterStatus]);

  // Load from session storage (Neural Translator integration)
  useEffect(() => {
    const editorFileData = sessionStorage.getItem('editorFile');
    if (editorFileData) {
      try {
        const data = JSON.parse(editorFileData);
        const translatorTranslation: Translation = {
          id: `translator-${Date.now()}`,
          gameId: data.gameId || 'unknown',
          filePath: data.filePath || data.filename,
          originalText: data.originalContent || '',
          translatedText: data.content || '',
          targetLanguage: data.targetLanguage || 'it',
          sourceLanguage: data.sourceLanguage || 'en',
          status: 'pending',
          confidence: 85,
          isManualEdit: false,
          context: `Tradotto con Neural Translator - ${data.gameName || 'Gioco sconosciuto'}`,
          updatedAt: new Date().toISOString(),
          game: {
            id: data.gameId || 'unknown',
            title: data.gameName || 'Gioco sconosciuto',
            platform: 'Neural Translator'
          },
          suggestions: []
        };
        
        setTranslations([translatorTranslation]);
        setSelectedTranslation(translatorTranslation);
        sessionStorage.removeItem('editorFile');
        
        toast({
          title: "File caricato",
          description: `${data.filename} pronto per la modifica`,
        });
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading editor file:', err);
        sessionStorage.removeItem('editorFile');
      }
    }
  }, [toast]);

  // --- Actions ---
  const fetchGames = async () => {
    try {
      const response = await fetch('/api/games');
      if (response.ok) {
        const data = await response.json();
        setGames(ensureArray(data).map((g: any) => ({
          id: g.id,
          title: g.title,
          platform: 'Unknown'
        })));
      }
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };

  const fetchTranslations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterGame !== 'all') params.append('gameId', filterGame);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      
      const response = await fetch(`/api/translations?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTranslations(data);
        if (selectedTranslation) {
          const updated = data.find((t: Translation) => t.id === selectedTranslation.id);
          if (updated) setSelectedTranslation(updated);
        }
      }
    } catch (error) {
      console.error('Error loading translations:', error);
      toast({ title: 'Errore', description: 'Impossibile caricare le traduzioni', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateTranslation = async (updates: Partial<Translation>) => {
    if (!selectedTranslation) return;
    setIsSaving(true);
    setHasUnsavedChanges(false);
    
    try {
      const updatedTranslation = { ...selectedTranslation, ...updates, isManualEdit: true };
      setSelectedTranslation(updatedTranslation);
      setTranslations(prev => prev.map(t => t.id === updatedTranslation.id ? updatedTranslation : t));

      const response = await fetch('/api/translations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedTranslation.id, ...updates, isManualEdit: true })
      });

      if (!response.ok) throw new Error('Failed to save');
      
      toast({ title: 'Salvato', description: 'Traduzione aggiornata' });
    } catch (error) {
      console.error('Error saving translation:', error);
      toast({ title: 'Errore', description: 'Impossibile salvare le modifiche', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const generateSuggestions = async () => {
    if (!selectedTranslation) return;
    setIsGeneratingSuggestions(true);
    try {
      const response = await fetch('/api/translations/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          translationId: selectedTranslation.id,
          originalText: selectedTranslation.originalText,
          targetLanguage: selectedTranslation.targetLanguage
        })
      });

      if (response.ok) {
        const suggestions = await response.json();
        const updated = { ...selectedTranslation, suggestions };
        setSelectedTranslation(updated);
        setTranslations(prev => prev.map(t => t.id === updated.id ? updated : t));
        toast({ title: 'Suggerimenti generati', description: `${suggestions.length} suggerimenti trovati` });
      }
    } catch (error) {
      toast({ title: 'Errore', description: 'Impossibile generare suggerimenti', variant: 'destructive' });
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleTranslationChange = useCallback((newText: string) => {
    if (!selectedTranslation) return;
    setSelectedTranslation(prev => prev ? ({ ...prev, translatedText: newText }) : null);
    setHasUnsavedChanges(true);
    
    if (saveTimeoutId) clearTimeout(saveTimeoutId);
    
    const newTimeoutId = setTimeout(() => {
      updateTranslation({ translatedText: newText });
    }, 2000);
    setSaveTimeoutId(newTimeoutId);
  }, [selectedTranslation, saveTimeoutId]);

  const handleManualSave = () => {
    if (!selectedTranslation || !hasUnsavedChanges) return;
    if (saveTimeoutId) clearTimeout(saveTimeoutId);
    updateTranslation({ translatedText: selectedTranslation.translatedText });
  };

  const deleteTranslation = async (id: string) => {
    if (!confirm('Eliminare questa traduzione?')) return;
    try {
      const response = await fetch(`/api/translations?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        setTranslations(prev => prev.filter(t => t.id !== id));
        if (selectedTranslation?.id === id) setSelectedTranslation(null);
        toast({ title: 'Eliminata', description: 'Traduzione rimossa' });
      }
    } catch (error) {
      toast({ title: 'Errore', description: 'Impossibile eliminare', variant: 'destructive' });
    }
  };

  const exportTranslations = async (format: 'json' | 'csv' | 'po') => {
    if (!filterGame || filterGame === 'all') {
      toast({
        title: 'Seleziona un gioco',
        description: 'Devi selezionare un gioco specifico per esportare',
        variant: 'destructive'
      });
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append('gameId', filterGame);
      params.append('format', format);
      if (filterStatus !== 'all') params.append('status', filterStatus);

      const response = await fetch(`/api/translations/export?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || `translations.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({ title: 'Esportazione completata', description: `Traduzioni esportate in ${format.toUpperCase()}` });
      }
    } catch (error) {
      toast({ title: 'Errore', description: 'Impossibile esportare', variant: 'destructive' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'reviewed': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'edited': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': case 'reviewed': return <CheckCircle className="h-3 w-3" />;
      case 'edited': return <Edit3 className="h-3 w-3" />;
      case 'pending': return <AlertCircle className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-900 via-purple-900/5 to-slate-900 overflow-hidden">
      {/* --- SIDEBAR: LIST & FILTERS --- */}
      <div className="w-80 border-r border-border/40 bg-slate-900/50 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border/40 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-purple-400" />
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Explorer</span>
            </h2>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowImportDialog(true)}>
                      <Upload className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Importa file</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Select onValueChange={(format) => exportTranslations(format as any)}>
                      <SelectTrigger className="h-7 w-7 p-0 border-0 bg-transparent">
                        <Download className="h-4 w-4" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="po">PO (gettext)</SelectItem>
                      </SelectContent>
                    </Select>
                  </TooltipTrigger>
                  <TooltipContent>Esporta</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/editor/dashboard">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Dashboard</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Cerca..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs bg-slate-800/50 border-slate-700"
            />
            {searchTerm && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setSearchTerm('')}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-7 text-xs flex-1 bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="pending">In attesa</SelectItem>
                <SelectItem value="completed">Completati</SelectItem>
                <SelectItem value="edited">Modificati</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterGame} onValueChange={setFilterGame}>
              <SelectTrigger className="h-7 text-xs flex-1 bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="Gioco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i giochi</SelectItem>
                {games.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
            <span>{filteredTranslations.length} elementi</span>
            <div className="flex gap-2">
              <span className="text-green-400">{stats.completed} ✓</span>
              <span className="text-yellow-400">{stats.pending} ⏳</span>
            </div>
          </div>
        </div>

        {/* Translation List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
            </div>
          ) : filteredTranslations.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground text-sm">
              <Languages className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>Nessuna traduzione</p>
              <p className="text-xs mt-1 opacity-70">Importa file o usa Neural Translator</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredTranslations.map((t, index) => (
                <motion.button
                  key={t.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => setSelectedTranslation(t)}
                  className={cn(
                    "flex flex-col items-start p-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-all text-left group relative",
                    selectedTranslation?.id === t.id && "bg-purple-500/10 border-l-2 border-l-purple-500"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[10px] font-medium text-slate-500 truncate max-w-[140px]">
                      {t.game.title}
                    </span>
                    <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5 gap-0.5", getStatusColor(t.status))}>
                      {getStatusIcon(t.status)}
                      <span className="ml-0.5">{t.status}</span>
                    </Badge>
                  </div>
                  <p className={cn(
                    "text-sm line-clamp-1 w-full",
                    selectedTranslation?.id === t.id ? "text-white" : "text-slate-300"
                  )}>
                    {t.originalText}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 w-full">
                    {t.translatedText || <span className="italic opacity-50">— non tradotto —</span>}
                  </p>
                  
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-red-500/20" onClick={(e) => { e.stopPropagation(); deleteTranslation(t.id); }}>
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </Button>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* --- MAIN AREA: EDITOR --- */}
      <div className="flex-1 flex flex-col bg-slate-950/50 relative">
        {selectedTranslation ? (
          <>
            {/* Toolbar */}
            <div className="h-12 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/30">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-1.5 rounded-md bg-purple-500/20">
                  <Languages className="h-4 w-4 text-purple-400" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="truncate max-w-[150px]">{selectedTranslation.game.title}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="truncate max-w-[150px] text-slate-500">{selectedTranslation.filePath.split('/').pop()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-1 border-slate-700 text-slate-400">
                      {selectedTranslation.sourceLanguage.toUpperCase()} <ArrowLeftRight className="h-2.5 w-2.5" /> {selectedTranslation.targetLanguage.toUpperCase()}
                    </Badge>
                    {selectedTranslation.confidence > 0 && (
                      <span className="text-[10px] text-green-400">{Math.round(selectedTranslation.confidence * 100)}%</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={generateSuggestions} disabled={isGeneratingSuggestions}>
                  {isGeneratingSuggestions ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5 text-purple-400" />}
                  AI
                </Button>
                <Separator orientation="vertical" className="h-5 bg-slate-700" />
                <Button 
                  size="sm" 
                  className={cn("h-8 text-xs", hasUnsavedChanges ? "bg-purple-600 hover:bg-purple-700" : "bg-slate-700")}
                  onClick={handleManualSave} 
                  disabled={!hasUnsavedChanges || isSaving}
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  Salva
                </Button>
              </div>
            </div>

            {/* Split Editor */}
            <div className="flex-1 flex overflow-hidden">
              {/* Original Panel */}
              <div className="flex-1 flex flex-col border-r border-slate-800 min-w-[300px]">
                <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Originale</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                    navigator.clipboard.writeText(selectedTranslation.originalText);
                    toast({ title: 'Copiato negli appunti' });
                  }}>
                    <Copy className="h-3 w-3 text-slate-500" />
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-6">
                  <p className="text-base leading-relaxed text-slate-300 whitespace-pre-wrap">
                    {selectedTranslation.originalText}
                  </p>
                  
                  {selectedTranslation.context && (
                    <div className="mt-6 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-1.5 text-blue-400">
                        <Lightbulb className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Contesto</span>
                      </div>
                      <p className="text-xs text-slate-400 italic">
                        {selectedTranslation.context}
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Translation Panel */}
              <div className="flex-1 flex flex-col min-w-[300px] bg-slate-900/20">
                <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Traduzione</span>
                  {hasUnsavedChanges && (
                    <Badge variant="outline" className="text-[9px] h-4 border-yellow-500/30 text-yellow-400 animate-pulse">
                      Non salvato
                    </Badge>
                  )}
                </div>
                <div className="flex-1 p-4">
                  <Textarea
                    value={selectedTranslation.translatedText}
                    onChange={(e) => handleTranslationChange(e.target.value)}
                    className="w-full h-full min-h-[200px] resize-none border-slate-700 bg-slate-800/30 text-base leading-relaxed focus-visible:ring-purple-500/50 placeholder:text-slate-600"
                    placeholder="Inserisci la traduzione..."
                    spellCheck={false}
                  />
                </div>
                
                {/* Suggestions Panel */}
                {selectedTranslation.suggestions.length > 0 && (
                  <div className="border-t border-slate-800 bg-slate-900/30 p-3 max-h-[180px] overflow-y-auto">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-3 w-3 text-purple-400" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggerimenti AI</span>
                    </div>
                    <div className="space-y-1.5">
                      {selectedTranslation.suggestions.map((s, i) => (
                        <div key={i} className="flex items-center justify-between group p-2 rounded-md hover:bg-slate-800/50 border border-transparent hover:border-slate-700 transition-all">
                          <p className="text-xs text-slate-400 flex-1 line-clamp-2">{s.suggestion}</p>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-purple-400 hover:text-purple-300"
                            onClick={() => handleTranslationChange(s.suggestion)}
                          >
                            Usa
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
            <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-6 border border-slate-700">
              <LayoutPanelLeft className="h-8 w-8 opacity-50" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-slate-400">Nessuna selezione</h3>
            <p className="text-sm text-center max-w-xs opacity-70">
              Seleziona una stringa dalla lista per iniziare a modificare la traduzione
            </p>
          </div>
        )}
      </div>

      {/* Import Dialog */}
      <TranslationImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        games={games}
        onImportComplete={fetchTranslations}
      />
    </div>
  );
}
