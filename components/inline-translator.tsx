'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  
  // States for translation editor
  const [originalContent, setOriginalContent] = useState('');
  const [translatedContent, setTranslatedContent] = useState('');
  const [provider, setProvider] = useState<'openai' | 'deepl' | 'google'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('it');
  const [translatorError, setTranslatorError] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  
  // Simulate file scanning
  useEffect(() => {
    if (currentStep === 'scanning') {
      const interval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            // Simulate found files
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

  // Only select the file (highlight)
  const handleFileClick = (file: FileHandle) => {
    setSelectedFile(file);
  };

  // Load file and proceed to translation
  const handleProceed = async () => {
    if (!selectedFile) return;
    
    setIsLoadingFile(true);
    setTranslatorError(null);
    
    try {
      // Simulate file content loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Sample content based on file type
      const sampleContent = selectedFile.type === 'json' 
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
      setTranslatorError('Error loading file');
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleStartTranslation = async () => {
    if (!apiKey || !originalContent) return;
    
    setIsTranslating(true);
    setTranslatorError(null);
    
    try {
      // Here would go the real API call
      // For now we simulate the translation
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
      setTranslatorError('Error during translation: ' + error);
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

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-4xl"
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="border border-purple-500/30 bg-gradient-to-br from-gray-900/95 via-gray-900/98 to-purple-950/30 shadow-2xl shadow-purple-500/10">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500 shadow-lg shadow-purple-500/30">
                  <Languages className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                    Translation of {gameName}
                  </CardTitle>
                  <p className="text-xs text-gray-400 mt-0.5">Neural Translator</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            
            <CardContent className="space-y-6 pt-6">
              {/* Progress Steps - Stile moderno */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {[
                  { step: 'scanning', label: 'Scanning', num: 1 },
                  { step: 'select-file', label: 'File Selection', num: 2 },
                  { step: 'translate-editor', label: 'Translation', num: 3 }
                ].map((item, idx) => {
                  const isActive = currentStep === item.step || (item.step === 'translate-editor' && currentStep === 'complete');
                  const isPast = (item.num === 1 && currentStep !== 'scanning') || 
                                 (item.num === 2 && (currentStep === 'translate-editor' || currentStep === 'complete'));
                  return (
                    <div key={item.step} className="flex items-center gap-2">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
                        isActive 
                          ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/30' 
                          : isPast 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-gray-800/50 text-gray-500 border border-gray-700/50'
                      }`}>
                        <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                          {isPast ? '✓' : item.num}
                        </span>
                        <span className="text-xs font-medium">{item.label}</span>
                      </div>
                      {idx < 2 && <ChevronRight className="h-4 w-4 text-gray-600" />}
                    </div>
                  );
                })}
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
                    <h3 className="text-lg font-semibold mb-2">Scanning in progress...</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Searching for translatable files in the game
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
                    <Label className="text-sm text-gray-400 mb-3 block">Translatable files found</Label>
                    <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                      {files.map((file, index) => (
                        <motion.div
                          key={file.name}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.01, x: 4 }}
                          onClick={() => handleFileClick(file)}
                          className={`p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                            selectedFile?.name === file.name 
                              ? 'bg-purple-500/20 border border-purple-500/50 shadow-lg shadow-purple-500/10' 
                              : 'bg-gray-800/40 border border-gray-700/50 hover:bg-gray-800/60 hover:border-purple-500/30'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {/* Checkbox/Radio indicator */}
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                selectedFile?.name === file.name 
                                  ? 'border-purple-500 bg-purple-500' 
                                  : 'border-gray-600 bg-transparent'
                              }`}>
                                {selectedFile?.name === file.name && (
                                  <CheckCircle className="h-3 w-3 text-white" />
                                )}
                              </div>
                              <div className={`p-2 rounded-lg ${selectedFile?.name === file.name ? 'bg-purple-500/30' : 'bg-gray-700/50'}`}>
                                <FileText className={`h-4 w-4 ${selectedFile?.name === file.name ? 'text-purple-300' : 'text-gray-400'}`} />
                              </div>
                              <div>
                                <p className="font-medium text-sm text-white">{file.name}</p>
                                <p className="text-xs text-gray-500">{file.path}</p>
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-3">
                              <Badge className={`text-[10px] px-2 py-0.5 ${
                                file.type === 'json' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                file.type === 'xml' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                                file.type === 'subtitle' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                                'bg-gray-500/20 text-gray-300 border-gray-500/30'
                              } border`}>{file.type}</Badge>
                              <span className="text-xs text-gray-500 w-16 text-right">
                                {formatFileSize(file.size)}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-gray-800/50 mt-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Target language</Label>
                      <Select defaultValue="it">
                        <SelectTrigger className="w-[160px] bg-gray-800/50 border-gray-700/50 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-700">
                          <SelectItem value="it">
                            <span className="flex items-center gap-2">
                              <span className="text-base">🇮🇹</span>
                              Italian
                            </span>
                          </SelectItem>
                          <SelectItem value="es">
                            <span className="flex items-center gap-2">
                              <span className="text-base">🇪🇸</span>
                              Spanish
                            </span>
                          </SelectItem>
                          <SelectItem value="fr">
                            <span className="flex items-center gap-2">
                              <span className="text-base">🇫🇷</span>
                              French
                            </span>
                          </SelectItem>
                          <SelectItem value="de">
                            <span className="flex items-center gap-2">
                              <span className="text-base">🇩🇪</span>
                              German
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      onClick={handleProceed}
                      disabled={!selectedFile || isLoadingFile}
                      className="bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600 text-white shadow-lg shadow-purple-500/25 px-6"
                    >
                      {isLoadingFile ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...</>
                      ) : (
                        <><Wand2 className="h-4 w-4 mr-2" /> Proceed with Translation</>
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
                      <Label>Original Text</Label>
                      <Textarea
                        value={originalContent}
                        readOnly
                        className="h-[300px] font-mono text-sm bg-muted/50"
                        placeholder="File content will appear here"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Translation</Label>
                      <Textarea
                        value={translatedContent}
                        onChange={(e) => setTranslatedContent(e.target.value)}
                        className="h-[300px] font-mono text-sm"
                        placeholder="Translation will appear here"
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
                    <h4 className="font-semibold text-sm">AI Translation Configuration</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>AI Service</Label>
                        <Select value={provider} onValueChange={(value: 'openai' | 'deepl' | 'google') => setProvider(value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
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
                          placeholder="Enter your API key"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Target Language</Label>
                        <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="it">
                              <span className="flex items-center gap-2">
                                <img src="https://flagcdn.com/16x12/it.png" alt="IT" className="w-4 h-3" />
                                Italian
                              </span>
                            </SelectItem>
                            <SelectItem value="es">
                              <span className="flex items-center gap-2">
                                <img src="https://flagcdn.com/16x12/es.png" alt="ES" className="w-4 h-3" />
                                Spanish
                              </span>
                            </SelectItem>
                            <SelectItem value="fr">
                              <span className="flex items-center gap-2">
                                <img src="https://flagcdn.com/16x12/fr.png" alt="FR" className="w-4 h-3" />
                                French
                              </span>
                            </SelectItem>
                            <SelectItem value="de">
                              <span className="flex items-center gap-2">
                                <img src="https://flagcdn.com/16x12/de.png" alt="DE" className="w-4 h-3" />
                                German
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-sm text-muted-foreground">
                        Estimated cost: <strong className="text-foreground">${getEstimatedCost()}</strong>
                      </div>
                      
                      <Button
                        onClick={handleStartTranslation}
                        disabled={isTranslating || !apiKey || !originalContent}
                        size="lg"
                      >
                        {isTranslating ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Translating...</>
                        ) : (
                          <><Wand2 className="h-4 w-4 mr-2" /> Start AI Translation</>
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
                  <h3 className="text-lg font-semibold mb-2">Translation Complete!</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    File {selectedFile?.name} has been successfully translated
                  </p>
                  
                  <div className="max-w-2xl mx-auto mb-6">
                    <Label className="text-sm mb-2 block">Translation Preview:</Label>
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
                      Translate Other Files
                    </Button>
                    <Button variant="outline">
                      <Save className="h-4 w-4 mr-2" />
                      Save Translation
                    </Button>
                    <Button onClick={onClose}>
                      Close
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

  // Render in body via portal to cover entire screen
  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}



