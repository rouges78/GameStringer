'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, 
  Save, 
  RotateCcw, 
  Languages, 
  Search, 
  Filter,
  Edit3,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Copy,
  ArrowLeftRight,
  Download,
  Upload,
  Loader2,
  Trash2,
  BarChart3
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { TranslationImportDialog } from '@/components/translation-import-dialog';
import Link from 'next/link';

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

  // Carica i giochi disponibili
  useEffect(() => {
    fetchGames();
  }, []);

  // Carica le traduzioni
  useEffect(() => {
    fetchTranslations();
  }, [filterGame, filterStatus, searchTerm]);

  const fetchGames = async () => {
    try {
      const response = await fetch('/api/games');
      if (response.ok) {
        const data = await response.json();
        setGames(data.map((g: any) => ({
          id: g.id,
          title: g.title,
          platform: 'Unknown'
        })));
      }
    } catch (error) {
      console.error('Errore nel caricamento dei giochi:', error);
    }
  };

  const fetchTranslations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterGame !== 'all') params.append('gameId', filterGame);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/translations?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTranslations(data);
        
        // Se c'è una traduzione selezionata, aggiornala con i nuovi dati
        if (selectedTranslation) {
          const updated = data.find((t: Translation) => t.id === selectedTranslation.id);
          if (updated) {
            setSelectedTranslation(updated);
          }
        }
      }
    } catch (error) {
      console.error('Errore nel caricamento delle traduzioni:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare le traduzioni',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateTranslation = async (updates: Partial<Translation>) => {
    if (!selectedTranslation) return;
    
    setIsSaving(true);
    setHasUnsavedChanges(false);
    try {
      const response = await fetch('/api/translations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTranslation.id,
          ...updates,
          isManualEdit: true
        })
      });

      if (response.ok) {
        const updatedTranslation = await response.json();
        setSelectedTranslation(updatedTranslation);
        
        // Aggiorna anche la lista
        setTranslations(prev => prev.map(t => 
          t.id === updatedTranslation.id ? updatedTranslation : t
        ));
        
        toast({
          title: 'Salvato',
          description: 'Traduzione aggiornata con successo'
        });
      } else {
        throw new Error('Errore nel salvataggio');
      }
    } catch (error) {
      console.error('Errore nell\'aggiornamento della traduzione:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile salvare la traduzione',
        variant: 'destructive'
      });
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
        
        // Aggiorna la traduzione selezionata con i nuovi suggerimenti
        const updatedTranslation = {
          ...selectedTranslation,
          suggestions
        };
        
        setSelectedTranslation(updatedTranslation);
        setTranslations(prev => prev.map(t => 
          t.id === selectedTranslation.id ? updatedTranslation : t
        ));
        
        toast({
          title: 'Suggerimenti generati',
          description: `${suggestions.length} suggerimenti AI generati`
        });
      }
    } catch (error) {
      console.error('Errore nella generazione dei suggerimenti:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile generare suggerimenti',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const applySuggestion = (suggestion: string) => {
    updateTranslation({ translatedText: suggestion });
  };

  // Salvataggio automatico con debounce
  const handleTranslationChange = useCallback((newText: string) => {
    if (!selectedTranslation) return;
    
    // Aggiorna lo stato locale immediatamente
    setSelectedTranslation({
      ...selectedTranslation,
      translatedText: newText
    });
    
    setHasUnsavedChanges(true);
    
    // Cancella il timeout precedente se esiste
    if (saveTimeoutId) {
      clearTimeout(saveTimeoutId);
    }
    
    // Imposta un nuovo timeout per il salvataggio automatico dopo 2 secondi
    const newTimeoutId = setTimeout(() => {
      updateTranslation({ translatedText: newText });
    }, 2000);
    
    setSaveTimeoutId(newTimeoutId);
  }, [selectedTranslation, saveTimeoutId]);

  // Salvataggio manuale immediato
  const handleManualSave = () => {
    if (!selectedTranslation || !hasUnsavedChanges) return;
    
    // Cancella il timeout del salvataggio automatico
    if (saveTimeoutId) {
      clearTimeout(saveTimeoutId);
      setSaveTimeoutId(null);
    }
    
    updateTranslation({ translatedText: selectedTranslation.translatedText });
  };

  const deleteTranslation = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa traduzione?')) return;
    
    try {
      const response = await fetch(`/api/translations?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setTranslations(prev => prev.filter(t => t.id !== id));
        if (selectedTranslation?.id === id) {
          setSelectedTranslation(null);
        }
        
        toast({
          title: 'Eliminata',
          description: 'Traduzione eliminata con successo'
        });
      }
    } catch (error) {
      console.error('Errore nell\'eliminazione della traduzione:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile eliminare la traduzione',
        variant: 'destructive'
      });
    }
  };

  const exportTranslations = async (format: 'json' | 'csv' | 'po') => {
    if (!filterGame || filterGame === 'all') {
      toast({
        title: 'Seleziona un gioco',
        description: 'Devi selezionare un gioco specifico per esportare le traduzioni',
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
        
        toast({
          title: 'Esportazione completata',
          description: `Traduzioni esportate in formato ${format.toUpperCase()}`
        });
      }
    } catch (error) {
      console.error('Errore nell\'esportazione:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile esportare le traduzioni',
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-500';
      case 'reviewed': return 'bg-blue-500/10 text-blue-500';
      case 'edited': return 'bg-purple-500/10 text-purple-500';
      case 'pending': return 'bg-gray-500/10 text-gray-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-3 w-3" />;
      case 'reviewed': return <CheckCircle className="h-3 w-3" />;
      case 'edited': return <Edit3 className="h-3 w-3" />;
      case 'pending': return <AlertCircle className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Editor Traduzioni</h1>
          <p className="text-muted-foreground">Workspace collaborativo per revisione traduzioni</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Link href="/editor/dashboard">
            <Button variant="outline">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importa
          </Button>
          
          <Select onValueChange={(format) => exportTranslations(format as any)}>
            <SelectTrigger className="w-32">
              <Download className="h-4 w-4 mr-2" />
              <span>Esporta</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="po">PO (gettext)</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            disabled={!selectedTranslation || isSaving}
            onClick={() => selectedTranslation && updateTranslation({})}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salva
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Translation List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Traduzioni</span>
              <Badge variant="secondary">{translations.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca traduzioni..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti gli stati</SelectItem>
                    <SelectItem value="pending">In attesa</SelectItem>
                    <SelectItem value="completed">Completate</SelectItem>
                    <SelectItem value="reviewed">Revisionate</SelectItem>
                    <SelectItem value="edited">Modificate</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={filterGame} onValueChange={setFilterGame}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i giochi</SelectItem>
                    {games.map(game => (
                      <SelectItem key={game.id} value={game.id}>
                        {game.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Translation List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : translations.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  <Languages className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nessuna traduzione trovata</p>
                </div>
              ) : (
                translations.map((translation, index) => (
                  <motion.div
                    key={translation.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors group ${
                      selectedTranslation?.id === translation.id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedTranslation(translation)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(translation.status)} variant="secondary">
                          <span className="flex items-center space-x-1">
                            {getStatusIcon(translation.status)}
                            <span>{translation.status}</span>
                          </span>
                        </Badge>
                        {translation.confidence > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {Math.round(translation.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {translation.isManualEdit && (
                          <Edit3 className="h-3 w-3 text-purple-500" />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTranslation(translation.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <p className="text-sm font-medium mb-1 line-clamp-2">
                      {translation.originalText}
                    </p>
                    
                    <p className="text-xs text-muted-foreground mb-2">
                      {translation.game.title} • {translation.filePath.split('/').pop()}
                    </p>
                    
                    {translation.translatedText && (
                      <p className="text-xs text-primary line-clamp-2">
                        {translation.translatedText}
                      </p>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Editor Workspace */}
        <div className="lg:col-span-2 space-y-6">
          {selectedTranslation ? (
            <>
              {/* Translation Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <Languages className="h-5 w-5" />
                        <span>Editor Traduzione</span>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedTranslation.game.title} • {selectedTranslation.filePath}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(selectedTranslation.status)}>
                        {selectedTranslation.status}
                      </Badge>
                      <Badge variant="outline">
                        {selectedTranslation.sourceLanguage.toUpperCase()} → {selectedTranslation.targetLanguage.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Split View Editor */}
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Original Text */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Testo Originale ({selectedTranslation.sourceLanguage.toUpperCase()})</label>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedTranslation.originalText);
                            toast({
                              title: 'Copiato',
                              description: 'Testo originale copiato negli appunti'
                            });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        value={selectedTranslation.originalText}
                        readOnly
                        className="min-h-[120px] bg-muted/30 text-sm"
                      />
                      {selectedTranslation.context && (
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                          <span className="font-medium">Contesto: </span>
                          {selectedTranslation.context}
                        </div>
                      )}
                    </div>

                    {/* Translation */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Traduzione ({selectedTranslation.targetLanguage.toUpperCase()})</label>
                        <div className="flex items-center space-x-2">
                          {selectedTranslation.confidence > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {Math.round(selectedTranslation.confidence * 100)}% confidenza
                            </Badge>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={generateSuggestions}
                            disabled={isGeneratingSuggestions}
                          >
                            {isGeneratingSuggestions ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Lightbulb className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        value={selectedTranslation.translatedText}
                        onChange={(e) => handleTranslationChange(e.target.value)}
                        className="min-h-[120px] text-sm"
                        placeholder="Inserisci o modifica la traduzione..."
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <span>
                            {selectedTranslation.isManualEdit ? 'Modificato manualmente' : 'Traduzione AI'}
                          </span>
                          {hasUnsavedChanges && (
                            <Badge variant="outline" className="text-xs">
                              Modifiche non salvate
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={handleManualSave}
                          disabled={!hasUnsavedChanges || isSaving}
                          className="h-8"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Salvataggio...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Salva
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Ultimo aggiornamento: {new Date(selectedTranslation.updatedAt).toLocaleString('it-IT')}
                        {hasUnsavedChanges && ' • Salvataggio automatico in 2 secondi'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Suggestions */}
              {selectedTranslation.suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Lightbulb className="h-5 w-5" />
                        <span>Suggerimenti AI</span>
                        <Badge variant="secondary">{selectedTranslation.suggestions.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedTranslation.suggestions.map((suggestion, index) => (
                        <motion.div
                          key={suggestion.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="text-sm">{suggestion.suggestion}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {Math.round(suggestion.confidence * 100)}%
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {suggestion.provider}
                              </span>
                            </div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => applySuggestion(suggestion.suggestion)}
                          >
                            Applica
                          </Button>
                        </motion.div>
                      ))}
                      
                      {isGeneratingSuggestions && (
                        <div className="flex items-center justify-center p-6">
                          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                          <span className="text-sm text-muted-foreground">Generando nuovi suggerimenti...</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </>
          ) : (
            /* Empty State */
            <Card>
              <CardContent className="p-12 text-center">
                <Edit3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Seleziona una Traduzione</h3>
                <p className="text-muted-foreground mb-6">
                  Scegli una traduzione dalla lista per iniziare a modificarla nell'editor.
                </p>
                <Button 
                  onClick={() => setSelectedTranslation(translations[0])}
                  disabled={translations.length === 0}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Modifica Prima Traduzione
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
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
