
'use client';

import { useState, useEffect } from 'react';
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
  ArrowLeftRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { mockGames, mockTranslations } from '@/lib/mock-data';

interface TranslationEntry {
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
  aiSuggestions: string[];
  context?: string;
  lastModified: Date;
}

export default function EditorPage() {
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [selectedTranslation, setSelectedTranslation] = useState<TranslationEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterGame, setFilterGame] = useState<string>('all');
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  const [games] = useState(mockGames);

  // Initialize with mock data
  useEffect(() => {
    const mockEntries: TranslationEntry[] = [
      {
        id: '1',
        gameId: '1',
        filePath: 'localization/text_en.csv',
        originalText: 'Welcome to Night City, the most dangerous place on Earth.',
        translatedText: 'Benvenuto a Night City, il posto più pericoloso della Terra.',
        targetLanguage: 'it',
        sourceLanguage: 'en',
        status: 'completed',
        confidence: 0.95,
        isManualEdit: false,
        aiSuggestions: [
          'Benvenuti a Night City, il luogo più pericoloso del mondo.',
          'Benvenuto a Night City, la località più pericolosa sulla Terra.'
        ],
        context: 'Game intro message',
        lastModified: new Date()
      },
      {
        id: '2',
        gameId: '1',
        filePath: 'dialog/conversations.json',
        originalText: 'Your reputation in Night City will determine your story.',
        translatedText: 'La tua reputazione a Night City determinerà la tua storia.',
        targetLanguage: 'it',
        sourceLanguage: 'en',
        status: 'reviewed',
        confidence: 0.92,
        isManualEdit: true,
        aiSuggestions: [
          'La reputazione che avrai a Night City plasmerà la tua storia.',
          'La tua fama a Night City influenzerà il tuo destino.'
        ],
        context: 'Character progression dialog',
        lastModified: new Date(Date.now() - 3600000)
      },
      {
        id: '3',
        gameId: '3',
        filePath: 'BioGame/CookedPC/Localization/INT/GlobalTlk.pcc',
        originalText: 'Commander, we need to stop the Reapers before they destroy all organic life.',
        translatedText: 'Comandante, dobbiamo fermare i Razziatori prima che distruggano ogni forma di vita organica.',
        targetLanguage: 'it',
        sourceLanguage: 'en',
        status: 'reviewed',
        confidence: 0.88,
        isManualEdit: true,
        aiSuggestions: [
          'Comandante, bisogna fermare i Mietitori prima che annientino tutta la vita organica.',
          'Comandante, è necessario fermare i Razziatori prima che sterminino ogni vita organica.'
        ],
        context: 'Main story dialog',
        lastModified: new Date(Date.now() - 7200000)
      },
      {
        id: '4',
        gameId: '4',
        filePath: 'Localized/Text/en/strings.json',
        originalText: 'Hunt mechanical beasts in a lush, post-apocalyptic world.',
        translatedText: '',
        targetLanguage: 'it',
        sourceLanguage: 'en',
        status: 'pending',
        confidence: 0,
        isManualEdit: false,
        aiSuggestions: [],
        context: 'Game description',
        lastModified: new Date(Date.now() - 14400000)
      }
    ];
    
    setTranslations(mockEntries);
    setSelectedTranslation(mockEntries[0]);
  }, []);

  const filteredTranslations = translations.filter(t => {
    const matchesSearch = t.originalText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.translatedText.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesGame = filterGame === 'all' || t.gameId === filterGame;
    return matchesSearch && matchesStatus && matchesGame;
  });

  const updateTranslation = (updates: Partial<TranslationEntry>) => {
    if (!selectedTranslation) return;
    
    const updatedTranslation = {
      ...selectedTranslation,
      ...updates,
      lastModified: new Date(),
      isManualEdit: true,
      status: 'edited' as const
    };
    
    setSelectedTranslation(updatedTranslation);
    setTranslations(prev => prev.map(t => 
      t.id === updatedTranslation.id ? updatedTranslation : t
    ));
  };

  const generateSuggestions = async () => {
    if (!selectedTranslation) return;
    
    setIsGeneratingSuggestions(true);
    
    // Simulate AI API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newSuggestions = [
      "Caccia bestie meccaniche in un mondo post-apocalittico rigoglioso.",
      "Dai la caccia a creature meccaniche in un lussureggiante mondo post-apocalittico.",
      "Insegui bestie robotiche in un florido ambiente post-apocalittico."
    ];
    
    updateTranslation({ aiSuggestions: newSuggestions });
    setIsGeneratingSuggestions(false);
  };

  const applySuggestion = (suggestion: string) => {
    updateTranslation({ translatedText: suggestion });
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

  const getGameTitle = (gameId: string) => {
    return games.find(g => g.id === gameId)?.title || 'Unknown Game';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Editor Traduzioni</h1>
          <p className="text-muted-foreground">Workspace collaborativo stile DeepL per revisione traduzioni</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setSelectedTranslation(null)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button disabled={!selectedTranslation}>
            <Save className="h-4 w-4 mr-2" />
            Salva Modifiche
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
              <Badge variant="secondary">{filteredTranslations.length}</Badge>
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
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredTranslations.map((translation, index) => (
                <motion.div
                  key={translation.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedTranslation?.id === translation.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedTranslation(translation)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(translation.status)} variant="secondary">
                        {translation.status}
                      </Badge>
                      {translation.confidence > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {Math.round(translation.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    {translation.isManualEdit && (
                      <Edit3 className="h-3 w-3 text-purple-500" />
                    )}
                  </div>
                  
                  <p className="text-sm font-medium mb-1 line-clamp-2">
                    {translation.originalText}
                  </p>
                  
                  <p className="text-xs text-muted-foreground mb-2">
                    {getGameTitle(translation.gameId)} • {translation.filePath.split('/').pop()}
                  </p>
                  
                  {translation.translatedText && (
                    <p className="text-xs text-primary line-clamp-2">
                      {translation.translatedText}
                    </p>
                  )}
                </motion.div>
              ))}
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
                        {getGameTitle(selectedTranslation.gameId)} • {selectedTranslation.filePath}
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
                        <Button variant="ghost" size="sm">
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
                              <ArrowLeftRight className="h-4 w-4 animate-pulse" />
                            ) : (
                              <Lightbulb className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        value={selectedTranslation.translatedText}
                        onChange={(e) => updateTranslation({ translatedText: e.target.value })}
                        className="min-h-[120px] text-sm"
                        placeholder="Inserisci o modifica la traduzione..."
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {selectedTranslation.isManualEdit ? 'Modificato manualmente' : 'Traduzione AI'}
                        </span>
                        <span>
                          Ultimo aggiornamento: {selectedTranslation.lastModified.toLocaleString('it-IT')}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Suggestions */}
              {selectedTranslation.aiSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Lightbulb className="h-5 w-5" />
                        <span>Suggerimenti AI</span>
                        <Badge variant="secondary">{selectedTranslation.aiSuggestions.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedTranslation.aiSuggestions.map((suggestion, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <p className="text-sm flex-1">{suggestion}</p>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => applySuggestion(suggestion)}
                          >
                            Applica
                          </Button>
                        </motion.div>
                      ))}
                      
                      {isGeneratingSuggestions && (
                        <div className="flex items-center justify-center p-6">
                          <ArrowLeftRight className="h-6 w-6 animate-pulse text-primary mr-2" />
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
                  onClick={() => setSelectedTranslation(filteredTranslations[0])}
                  disabled={filteredTranslations.length === 0}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Modifica Prima Traduzione
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
