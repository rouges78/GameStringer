'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Languages, 
  Upload, 
  Download, 
  Wand2, 
  FileText, 
  Settings,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Play,
  Pause,
  Square
} from 'lucide-react';
import { useProgressOperations } from '@/hooks/use-progress-operations';
import { useProgressBatch } from '@/hooks/use-progress-batch';
import { ProgressBar } from '@/components/progress/progress-bar';
import { useProgressDisplay } from '@/hooks/use-progress-ui';

interface TranslationFile {
  id: string;
  name: string;
  content: string;
  size: number;
  type: string;
}

interface TranslationTask {
  id: string;
  text: string;
  translatedText?: string;
  status: 'pending' | 'translating' | 'completed' | 'error';
  error?: string;
}

export default function EnhancedTranslatorPage() {
  // Stati base
  const [files, setFiles] = useState<TranslationFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<TranslationFile | null>(null);
  const [translationTasks, setTranslationTasks] = useState<TranslationTask[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('openai');
  const [targetLanguage, setTargetLanguage] = useState('it');
  
  // Stati per operazioni
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Hooks per progresso
  const { executeOperation, executeWithRetry } = useProgressOperations();
  const { executeTranslationBatch } = useProgressBatch();
  const { operation: currentOperation, isActive } = useProgressDisplay(currentOperationId || undefined);

  // Carica file
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(event.target.files || []);
    
    try {
      const operationId = await executeOperation(
        async (updateProgress) => {
          const newFiles: TranslationFile[] = [];
          
          for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            updateProgress((i / uploadedFiles.length) * 100, `Caricamento ${file.name}...`);
            
            const content = await file.text();
            newFiles.push({
              id: `file-${Date.now()}-${i}`,
              name: file.name,
              content,
              size: file.size,
              type: file.type
            });
            
            // Simula tempo di elaborazione
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          setFiles(prev => [...prev, ...newFiles]);
          return newFiles;
        },
        {
          title: `Caricamento di ${uploadedFiles.length} file`,
          description: 'Lettura e analisi file in corso...',
          canCancel: false
        }
      );
      
      setCurrentOperationId(operationId);
    } catch (error) {
      console.error('Errore nel caricamento file:', error);
    }
  };

  // Prepara tasks di traduzione da file
  const prepareTranslationTasks = (file: TranslationFile): TranslationTask[] => {
    // Divide il contenuto in segmenti traducibili
    const segments = file.content
      .split(/\n+/)
      .filter(line => line.trim().length > 0)
      .map((text, index) => ({
        id: `task-${file.id}-${index}`,
        text: text.trim(),
        status: 'pending' as const
      }));
    
    return segments;
  };

  // Traduce un singolo segmento
  const translateSegment = async (text: string, targetLang: string): Promise<string> => {
    // Simula chiamata API di traduzione
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Mock translation
    const mockTranslations: Record<string, string> = {
      'Hello': 'Ciao',
      'World': 'Mondo',
      'Game': 'Gioco',
      'Start': 'Inizia',
      'Options': 'Opzioni',
      'Quit': 'Esci'
    };
    
    return mockTranslations[text] || `[${targetLang.toUpperCase()}] ${text}`;
  };

  // Avvia traduzione file
  const handleTranslateFile = async (file: TranslationFile) => {
    if (!apiKey) {
      alert('Inserisci la chiave API');
      return;
    }

    const tasks = prepareTranslationTasks(file);
    setTranslationTasks(tasks);
    setIsProcessing(true);

    try {
      const translations = tasks.map(task => ({
        id: task.id,
        text: task.text,
        targetLanguage
      }));

      const result = await executeTranslationBatch(
        translations,
        async (text, targetLang) => {
          return translateSegment(text, targetLang);
        }
      );

      // Aggiorna tasks con risultati
      setTranslationTasks(prev => prev.map(task => {
        const resultItem = result.results.find(r => r.itemId === task.id);
        if (resultItem?.success) {
          return {
            ...task,
            translatedText: resultItem.result.translatedText,
            status: 'completed'
          };
        } else if (resultItem?.error) {
          return {
            ...task,
            status: 'error',
            error: resultItem.error
          };
        }
        return task;
      }));

    } catch (error) {
      console.error('Errore nella traduzione:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Traduzione batch di tutti i file
  const handleTranslateAllFiles = async () => {
    if (!apiKey || files.length === 0) {
      alert('Inserisci la chiave API e carica almeno un file');
      return;
    }

    setIsProcessing(true);

    try {
      await executeOperation(
        async (updateProgress) => {
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            updateProgress((i / files.length) * 100, `Traduzione ${file.name}...`);
            
            await handleTranslateFile(file);
          }
        },
        {
          title: `Traduzione di ${files.length} file`,
          description: 'Traduzione batch in corso...',
          canCancel: true,
          isBackground: files.length > 3
        }
      );
    } catch (error) {
      console.error('Errore nella traduzione batch:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Esporta risultati
  const handleExportResults = async () => {
    if (translationTasks.length === 0) {
      alert('Nessuna traduzione da esportare');
      return;
    }

    try {
      await executeOperation(
        async (updateProgress) => {
          updateProgress(25, 'Preparazione dati...');
          
          const exportData = {
            timestamp: new Date().toISOString(),
            sourceLanguage: 'en',
            targetLanguage,
            translations: translationTasks.map(task => ({
              original: task.text,
              translated: task.translatedText || '',
              status: task.status
            }))
          };

          updateProgress(50, 'Generazione file...');
          await new Promise(resolve => setTimeout(resolve, 1000));

          updateProgress(75, 'Preparazione download...');
          const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
          });

          updateProgress(100, 'Download avviato');
          
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `translations-${targetLanguage}-${Date.now()}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          return { exported: translationTasks.length };
        },
        {
          title: 'Esportazione traduzioni',
          description: 'Generazione file di esportazione...',
          canCancel: false
        }
      );
    } catch (error) {
      console.error('Errore nell\'esportazione:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Languages className="h-8 w-8" />
            Enhanced AI Translator
          </h1>
          <p className="text-muted-foreground">
            Sistema di traduzione avanzato con indicatori di progresso
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={isProcessing ? "default" : "secondary"}>
            {isProcessing ? "In elaborazione" : "Pronto"}
          </Badge>
        </div>
      </div>

      {/* Configurazione */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurazione
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">API Key</label>
              <Input
                type="password"
                placeholder="Inserisci la tua API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Provider</label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="google">Google Translate</SelectItem>
                  <SelectItem value="deepl">DeepL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Lingua Target</label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="it">Italiano</SelectItem>
                  <SelectItem value="es">Spagnolo</SelectItem>
                  <SelectItem value="fr">Francese</SelectItem>
                  <SelectItem value="de">Tedesco</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Caricamento File */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Caricamento File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              type="file"
              multiple
              accept=".txt,.json,.csv"
              onChange={handleFileUpload}
              disabled={isProcessing}
            />
            
            {files.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">File caricati ({files.length})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {files.map(file => (
                    <div
                      key={file.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => setSelectedFile(file)}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm font-medium truncate">{file.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Operazioni */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Operazioni di Traduzione
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={() => selectedFile && handleTranslateFile(selectedFile)}
              disabled={!selectedFile || !apiKey || isProcessing}
            >
              <Play className="h-4 w-4 mr-2" />
              Traduci File Selezionato
            </Button>
            
            <Button
              onClick={handleTranslateAllFiles}
              disabled={files.length === 0 || !apiKey || isProcessing}
              variant="outline"
            >
              <Languages className="h-4 w-4 mr-2" />
              Traduci Tutti i File
            </Button>
            
            <Button
              onClick={handleExportResults}
              disabled={translationTasks.length === 0 || isProcessing}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Esporta Risultati
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progresso Operazione Corrente */}
      {currentOperation && isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Operazione in Corso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">{currentOperation.title}</span>
                <span className="text-sm text-muted-foreground">
                  {currentOperation.progress.toFixed(1)}%
                </span>
              </div>
              
              <ProgressBar
                progress={currentOperation.progress}
                showPercentage={false}
                showTimeRemaining={true}
                estimatedTimeRemaining={
                  currentOperation.estimatedEndTime ? 
                  currentOperation.estimatedEndTime.getTime() - Date.now() : 
                  undefined
                }
                animated={true}
                striped={true}
              />
              
              <p className="text-sm text-muted-foreground">
                {currentOperation.status}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risultati Traduzione */}
      {translationTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Risultati Traduzione
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <span>Totale: {translationTasks.length}</span>
                <span className="text-green-600">
                  Completate: {translationTasks.filter(t => t.status === 'completed').length}
                </span>
                <span className="text-red-600">
                  Errori: {translationTasks.filter(t => t.status === 'error').length}
                </span>
                <span className="text-yellow-600">
                  In attesa: {translationTasks.filter(t => t.status === 'pending').length}
                </span>
              </div>
              
              <div className="max-h-96 overflow-y-auto space-y-2 no-scrollbar">
                {translationTasks.map(task => (
                  <div
                    key={task.id}
                    className="p-3 border rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        variant={
                          task.status === 'completed' ? 'default' :
                          task.status === 'error' ? 'destructive' :
                          task.status === 'translating' ? 'secondary' : 'outline'
                        }
                      >
                        {task.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">Originale</div>
                        <div>{task.text}</div>
                      </div>
                      
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">Traduzione</div>
                        <div>
                          {task.translatedText || (task.error ? (
                            <span className="text-red-600">{task.error}</span>
                          ) : (
                            <span className="text-muted-foreground">In attesa...</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}