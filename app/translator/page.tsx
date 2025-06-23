
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  Square, 
  Languages, 
  FileText, 
  Save,
  RotateCcw,
  Settings,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { mockGames, mockTranslations } from '@/lib/mock-data';

interface TranslationJob {
  id: string;
  filePath: string;
  originalText: string;
  translatedText: string;
  status: 'pending' | 'translating' | 'completed' | 'error';
  confidence: number;
  suggestions: string[];
}

export default function TranslatorPage() {
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState('it');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationJobs, setTranslationJobs] = useState<TranslationJob[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentJob, setCurrentJob] = useState<TranslationJob | null>(null);

  const [games] = useState(mockGames.filter(g => g.isInstalled && g.detectedFiles.length > 0));

  const languages = [
    { code: 'it', name: 'Italiano' },
    { code: 'es', name: 'Spagnolo' },
    { code: 'fr', name: 'Francese' },
    { code: 'de', name: 'Tedesco' },
    { code: 'pt', name: 'Portoghese' },
    { code: 'ru', name: 'Russo' },
    { code: 'ja', name: 'Giapponese' },
    { code: 'ko', name: 'Coreano' },
    { code: 'zh', name: 'Cinese' },
  ];

  // Mock text samples for different games
  const getTextSamples = (gameId: string) => {
    const samples: Record<string, string[]> = {
      '1': [ // Cyberpunk 2077
        "Welcome to Night City, the most dangerous place on Earth.",
        "Your reputation in Night City will determine your story.",
        "Customize your character's appearance, cyberware, and playstyle.",
        "The future is now, but at what cost?",
        "Every choice matters in this city of dreams and nightmares."
      ],
      '3': [ // Mass Effect
        "Commander, we need to stop the Reapers before they destroy all organic life.",
        "The fate of the galaxy rests in your hands.",
        "Your decisions will shape the destiny of entire civilizations.",
        "Unity is our strength against the coming darkness.",
        "Hope is what makes us human, even in the darkest times."
      ],
      '4': [ // Horizon Zero Dawn
        "In this post-apocalyptic world, machines rule the earth.",
        "Aloy must uncover the truth about her past to save her world.",
        "Hunt mechanical beasts in a lush, post-apocalyptic world.",
        "Technology and nature have become one in unexpected ways.",
        "The old world's sins have created new dangers."
      ]
    };
    return samples[gameId] || ["Sample text for translation testing."];
  };

  const startTranslation = async () => {
    if (!selectedGame || !selectedFile) return;

    setIsTranslating(true);
    setProgress(0);

    const textSamples = getTextSamples(selectedGame.id);
    const jobs: TranslationJob[] = textSamples.map((text, index) => ({
      id: `job_${index}`,
      filePath: selectedFile,
      originalText: text,
      translatedText: '',
      status: 'pending',
      confidence: 0,
      suggestions: []
    }));

    setTranslationJobs(jobs);

    // Simulate translation process
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      setCurrentJob(job);
      
      // Update job status to translating
      setTranslationJobs(prev => prev.map(j => 
        j.id === job.id ? { ...j, status: 'translating' } : j
      ));

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock translation result
      const translatedText = await mockTranslateText(job.originalText, targetLanguage);
      const confidence = 0.85 + Math.random() * 0.15;
      const suggestions = await mockGenerateSuggestions(job.originalText, targetLanguage);

      // Update job with results
      setTranslationJobs(prev => prev.map(j => 
        j.id === job.id ? { 
          ...j, 
          status: 'completed',
          translatedText,
          confidence,
          suggestions
        } : j
      ));

      setProgress(((i + 1) / jobs.length) * 100);
    }

    setIsTranslating(false);
    setCurrentJob(null);
  };

  const mockTranslateText = async (text: string, targetLang: string): Promise<string> => {
    // Mock translations for different languages
    const translations: Record<string, Record<string, string>> = {
      'it': {
        "Welcome to Night City, the most dangerous place on Earth.": "Benvenuto a Night City, il posto più pericoloso della Terra.",
        "Commander, we need to stop the Reapers before they destroy all organic life.": "Comandante, dobbiamo fermare i Razziatori prima che distruggano ogni forma di vita organica.",
        "In this post-apocalyptic world, machines rule the earth.": "In questo mondo post-apocalittico, le macchine dominano la Terra.",
        "Your reputation in Night City will determine your story.": "La tua reputazione a Night City determinerà la tua storia.",
        "The fate of the galaxy rests in your hands.": "Il destino della galassia è nelle tue mani."
      },
      'es': {
        "Welcome to Night City, the most dangerous place on Earth.": "Bienvenido a Night City, el lugar más peligroso de la Tierra.",
        "Commander, we need to stop the Reapers before they destroy all organic life.": "Comandante, debemos detener a los Segadores antes de que destruyan toda vida orgánica.",
        "In this post-apocalyptic world, machines rule the earth.": "En este mundo post-apocalíptico, las máquinas dominan la Tierra."
      }
    };

    return translations[targetLang]?.[text] || `[${targetLang.toUpperCase()}] ${text}`;
  };

  const mockGenerateSuggestions = async (text: string, targetLang: string): Promise<string[]> => {
    const baseSuggestions = await mockTranslateText(text, targetLang);
    return [
      baseSuggestions,
      baseSuggestions.replace(/\b\w+\b/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()),
      baseSuggestions.replace(/\./g, '...')
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
  };

  const stopTranslation = () => {
    setIsTranslating(false);
    setCurrentJob(null);
  };

  const resetTranslation = () => {
    setTranslationJobs([]);
    setProgress(0);
    setCurrentJob(null);
  };

  const saveTranslations = async () => {
    // Mock save operation
    console.log('Saving translations...', translationJobs);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Traduttore AI</h1>
          <p className="text-muted-foreground">Sistema di traduzione automatica con supporto AI</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={resetTranslation} disabled={isTranslating}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          {translationJobs.length > 0 && (
            <Button onClick={saveTranslations} disabled={isTranslating}>
              <Save className="h-4 w-4 mr-2" />
              Salva
            </Button>
          )}
        </div>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Configurazione Traduzione</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Gioco</label>
              <Select value={selectedGame?.id || ''} onValueChange={(gameId) => {
                const game = games.find(g => g.id === gameId);
                setSelectedGame(game);
                setSelectedFile('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona gioco..." />
                </SelectTrigger>
                <SelectContent>
                  {games.map(game => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">File</label>
              <Select value={selectedFile} onValueChange={setSelectedFile} disabled={!selectedGame}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona file..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedGame?.detectedFiles.map((file: string) => (
                    <SelectItem key={file} value={file}>
                      {file}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Lingua di Destinazione</label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-4">
              <Button 
                onClick={startTranslation} 
                disabled={!selectedGame || !selectedFile || isTranslating}
                className="min-w-[120px]"
              >
                {isTranslating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Traduzione...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Avvia
                  </>
                )}
              </Button>
              
              {isTranslating && (
                <Button variant="outline" onClick={stopTranslation}>
                  <Square className="h-4 w-4 mr-2" />
                  Ferma
                </Button>
              )}
            </div>
            
            {progress > 0 && (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-muted-foreground">
                  Progresso: {Math.round(progress)}%
                </span>
                <Progress value={progress} className="w-32" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Translation */}
      {currentJob && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <span>Traduzione in Corso</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Testo Originale (EN)</label>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm">{currentJob.originalText}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Traduzione ({targetLanguage.toUpperCase()})
                  </label>
                  <div className="p-3 bg-primary/5 rounded-lg min-h-[60px] flex items-center">
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Generazione traduzione...</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Translation Results */}
      {translationJobs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Languages className="h-5 w-5" />
                <span>Risultati Traduzione</span>
                <Badge variant="secondary">{translationJobs.length} elementi</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {translationJobs.map((job, index) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border rounded-lg p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{job.filePath}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {job.status === 'completed' && (
                        <>
                          <Badge variant="default">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completato
                          </Badge>
                          <Badge variant="secondary">
                            {Math.round(job.confidence * 100)}% confidenza
                          </Badge>
                        </>
                      )}
                      {job.status === 'translating' && (
                        <Badge variant="outline">
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Traduzione...
                        </Badge>
                      )}
                      {job.status === 'pending' && (
                        <Badge variant="secondary">In attesa</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Originale (EN)
                      </label>
                      <Textarea
                        value={job.originalText}
                        readOnly
                        className="text-sm min-h-[80px] bg-muted/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Traduzione ({targetLanguage.toUpperCase()})
                      </label>
                      <Textarea
                        value={job.translatedText}
                        onChange={(e) => {
                          setTranslationJobs(prev => prev.map(j => 
                            j.id === job.id ? { ...j, translatedText: e.target.value } : j
                          ));
                        }}
                        className="text-sm min-h-[80px]"
                        placeholder={job.status === 'pending' ? 'In attesa di traduzione...' : 'Traduzione generata'}
                      />
                    </div>
                  </div>
                  
                  {job.suggestions.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-2 block flex items-center">
                        <Lightbulb className="h-3 w-3 mr-1" />
                        Suggerimenti AI
                      </label>
                      <div className="space-y-2">
                        {job.suggestions.map((suggestion, idx) => (
                          <div 
                            key={idx}
                            className="p-2 bg-muted/30 rounded text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              setTranslationJobs(prev => prev.map(j => 
                                j.id === job.id ? { ...j, translatedText: suggestion } : j
                              ));
                            }}
                          >
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty State */}
      {translationJobs.length === 0 && !isTranslating && (
        <Card>
          <CardContent className="p-12 text-center">
            <Languages className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Pronto per Tradurre</h3>
            <p className="text-muted-foreground mb-6">
              Seleziona un gioco e un file per iniziare la traduzione automatica con AI.
            </p>
            <div className="flex justify-center">
              <Button 
                onClick={startTranslation} 
                disabled={!selectedGame || !selectedFile}
                size="lg"
              >
                <Play className="h-5 w-5 mr-2" />
                Avvia Prima Traduzione
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
