'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  X, 
  FileText, 
  Languages, 
  Wand2, 
  CheckCircle,
  FolderSearch,
  ChevronRight,
  AlertTriangle,
  Save,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface InlineTranslatorProps {
  gameId: string;
  gameName: string;
  gamePath?: string;
  onClose: () => void;
}

interface FileHandle {
  name: string;
  path: string;
  size: number;
  type?: string;
}

export default function InlineTranslator({ gameId, gameName, gamePath, onClose }: InlineTranslatorProps) {
  const [currentStep, setCurrentStep] = useState<'scanning' | 'select-file' | 'translate-editor' | 'complete'>('scanning');
  const [scanProgress, setScanProgress] = useState(0);
  const [files, setFiles] = useState<FileHandle[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileHandle | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  
  // Stati per l'editor di traduzione
  const [originalContent, setOriginalContent] = useState('');
  const [translatedContent, setTranslatedContent] = useState('');
  const [provider, setProvider] = useState<'openai' | 'deepl' | 'google'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('it');
  const [translatorError, setTranslatorError] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  
  // Simula la scansione dei file
  useEffect(() => {
    if (currentStep === 'scanning') {
      const interval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            // Simula file trovati
            setFiles([
              { name: 'dialogs.txt', path: '/game/data/dialogs.txt', size: 45678, type: 'text' },
              { name: 'ui_strings.json', path: '/game/data/ui_strings.json', size: 12345, type: 'json' },
              { name: 'subtitles.srt', path: '/game/data/subtitles.srt', size: 78901, type: 'subtitle' },
              { name: 'quests.xml', path: '/game/data/quests.xml', size: 34567, type: 'xml' },
            ]);
            setCurrentStep('select-file');
            return 100;
          }
          return prev + 10;
        });
      }, 200);
      
      return () => clearInterval(interval);
    }
  }, [currentStep]);

  const handleFileSelect = async (file: FileHandle) => {
    setSelectedFile(file);
    setIsLoadingFile(true);
    setTranslatorError(null);
    
    try {
      // Simula caricamento contenuto file
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Contenuto di esempio basato sul tipo di file
      const sampleContent = file.type === 'json' 
        ? `{
  "menu_start": "Start Game",
  "menu_options": "Options",
  "menu_quit": "Quit",
  "dialog_welcome": "Welcome to ${gameName}!",
  "quest_main_01": "Find the ancient artifact"
}`
        : `START_GAME=Start Game
OPTIONS=Options
QUIT=Quit
WELCOME_MESSAGE=Welcome to ${gameName}!
MAIN_QUEST_01=Find the ancient artifact`;
      
      setOriginalContent(sampleContent);
      setCurrentStep('translate-editor');
    } catch (error) {
      setTranslatorError('Errore nel caricamento del file');
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleStartTranslation = async () => {
    if (!apiKey || !originalContent) return;
    
    setIsTranslating(true);
    setTranslatorError(null);
    
    try {
      // Qui andrebbe la vera chiamata API
      // Per ora simuliamo la traduzione
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockTranslated = provider === 'openai' 
        ? originalContent.replace(/Start Game/g, 'Inizia Partita')
            .replace(/Options/g, 'Opzioni')
            .replace(/Quit/g, 'Esci')
            .replace(/Welcome to/g, 'Benvenuto in')
            .replace(/Find the ancient artifact/g, 'Trova l\'antico artefatto')
        : 'Traduzione simulata con ' + provider;
      
      setTranslatedContent(mockTranslated);
      setCurrentStep('complete');
    } catch (error) {
      setTranslatorError('Errore durante la traduzione: ' + error);
    } finally {
      setIsTranslating(false);
    }
  };
  
  const getEstimatedCost = () => {
    const chars = originalContent.length;
    if (chars === 0) return '0.0000';
    switch (provider) {
      case 'openai': return ((chars / 4) / 1000 * 0.50).toFixed(4);
      case 'deepl': return (chars / 1000000 * 25).toFixed(4);
      case 'google': return (chars / 1000000 * 20).toFixed(4);
      default: return '0.0000';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className="w-full max-w-4xl"
        >
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="h-5 w-5" />
                  Traduzione di {gameName}
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Progress Steps */}
              <div className="flex items-center justify-between mb-6">
                <div className={`flex items-center gap-2 ${currentStep === 'scanning' ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'scanning' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    1
                  </div>
                  <span className="text-sm font-medium">Scansione</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <div className={`flex items-center gap-2 ${currentStep === 'select-file' ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'select-file' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    2
                  </div>
                  <span className="text-sm font-medium">Selezione File</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <div className={`flex items-center gap-2 ${currentStep === 'translate-editor' || currentStep === 'complete' ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'translate-editor' || currentStep === 'complete' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    3
                  </div>
                  <span className="text-sm font-medium">Traduzione</span>
                </div>
              </div>

              {/* Scanning Step */}
              {currentStep === 'scanning' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-center py-8">
                    <FolderSearch className="h-16 w-16 text-muted-foreground animate-pulse" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">Scansione in corso...</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Ricerca dei file traducibili nel gioco
                    </p>
                    <Progress value={scanProgress} className="w-full max-w-xs mx-auto" />
                    <p className="text-xs text-muted-foreground mt-2">{scanProgress}%</p>
                  </div>
                </motion.div>
              )}

              {/* File Selection Step */}
              {currentStep === 'select-file' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div>
                    <Label className="text-base mb-3 block">File traducibili trovati</Label>
                    <div className="grid gap-3">
                      {files.map((file) => (
                        <motion.div
                          key={file.name}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => handleFileSelect(file)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                            selectedFile?.name === file.name 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{file.name}</p>
                                <p className="text-sm text-muted-foreground">{file.path}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="secondary">{file.type}</Badge>
                              <p className="text-sm text-muted-foreground mt-1">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4">
                    <div className="space-y-2">
                      <Label>Lingua di destinazione</Label>
                      <Select defaultValue="it">
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="it">
                            <span className="flex items-center gap-2">
                              <img src="https://flagcdn.com/16x12/it.png" alt="IT" />
                              Italiano
                            </span>
                          </SelectItem>
                          <SelectItem value="es">
                            <span className="flex items-center gap-2">
                              <img src="https://flagcdn.com/16x12/es.png" alt="ES" />
                              Spagnolo
                            </span>
                          </SelectItem>
                          <SelectItem value="fr">
                            <span className="flex items-center gap-2">
                              <img src="https://flagcdn.com/16x12/fr.png" alt="FR" />
                              Francese
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      onClick={() => handleFileSelect(selectedFile!)}
                      disabled={!selectedFile || isLoadingFile}
                      size="lg"
                    >
                      {isLoadingFile ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Caricamento...</>
                      ) : (
                        <><Wand2 className="h-4 w-4 mr-2" /> Procedi con la Traduzione</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Translation Editor Step */}
              {currentStep === 'translate-editor' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Testo Originale</Label>
                      <Textarea
                        value={originalContent}
                        readOnly
                        className="h-[300px] font-mono text-sm bg-muted/50"
                        placeholder="Il contenuto del file apparirà qui"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Traduzione</Label>
                      <Textarea
                        value={translatedContent}
                        onChange={(e) => setTranslatedContent(e.target.value)}
                        className="h-[300px] font-mono text-sm"
                        placeholder="La traduzione apparirà qui"
                        readOnly={isTranslating}
                      />
                    </div>
                  </div>

                  {translatorError && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{translatorError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                    <h4 className="font-semibold text-sm">Configurazione Traduzione AI</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Servizio AI</Label>
                        <Select value={provider} onValueChange={(value: 'openai' | 'deepl' | 'google') => setProvider(value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                            <SelectItem value="deepl">DeepL</SelectItem>
                            <SelectItem value="google">Google Translate</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>API Key</Label>
                        <Input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Inserisci la tua API key"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Lingua di Destinazione</Label>
                        <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="it">
                              <span className="flex items-center gap-2">
                                <img src="https://flagcdn.com/16x12/it.png" alt="IT" className="w-4 h-3" />
                                Italiano
                              </span>
                            </SelectItem>
                            <SelectItem value="es">
                              <span className="flex items-center gap-2">
                                <img src="https://flagcdn.com/16x12/es.png" alt="ES" className="w-4 h-3" />
                                Spagnolo
                              </span>
                            </SelectItem>
                            <SelectItem value="fr">
                              <span className="flex items-center gap-2">
                                <img src="https://flagcdn.com/16x12/fr.png" alt="FR" className="w-4 h-3" />
                                Francese
                              </span>
                            </SelectItem>
                            <SelectItem value="de">
                              <span className="flex items-center gap-2">
                                <img src="https://flagcdn.com/16x12/de.png" alt="DE" className="w-4 h-3" />
                                Tedesco
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-sm text-muted-foreground">
                        Costo stimato: <strong className="text-foreground">${getEstimatedCost()}</strong>
                      </div>
                      
                      <Button
                        onClick={handleStartTranslation}
                        disabled={isTranslating || !apiKey || !originalContent}
                        size="lg"
                      >
                        {isTranslating ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Traduzione in corso...</>
                        ) : (
                          <><Wand2 className="h-4 w-4 mr-2" /> Avvia Traduzione AI</>
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Complete Step */}
              {currentStep === 'complete' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Traduzione Completata!</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Il file {selectedFile?.name} è stato tradotto con successo
                  </p>
                  
                  <div className="max-w-2xl mx-auto mb-6">
                    <Label className="text-sm mb-2 block">Anteprima Traduzione:</Label>
                    <div className="bg-muted/50 p-4 rounded-lg max-h-40 overflow-y-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap">{translatedContent}</pre>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline" onClick={() => {
                      setSelectedFile(null);
                      setOriginalContent('');
                      setTranslatedContent('');
                      setCurrentStep('select-file');
                    }}>
                      Traduci Altri File
                    </Button>
                    <Button variant="outline">
                      <Save className="h-4 w-4 mr-2" />
                      Salva Traduzione
                    </Button>
                    <Button onClick={onClose}>
                      Chiudi
                    </Button>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
