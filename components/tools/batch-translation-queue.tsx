'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Play, 
  Pause, 
  Square, 
  Trash2, 
  Plus, 
  FileText, 
  FolderOpen,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronUp,
  ChevronDown,
  Languages,
  Zap,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';
import { useDefaultTargetLang } from '@/lib/translation/use-default-target-lang';

// Types for translation queue
export interface TranslationJob {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  sourceLanguage: string;
  targetLanguage: string;
  status: 'pending' | 'translating' | 'completed' | 'failed' | 'paused';
  progress: number;
  totalStrings: number;
  translatedStrings: number;
  errorMessage?: string;
  startTime?: number;
  endTime?: number;
  estimatedTime?: number;
}

interface BatchTranslationQueueProps {
  onTranslateFile?: (job: TranslationJob) => Promise<void>;
}

export function BatchTranslationQueue({ onTranslateFile: _onTranslateFile }: BatchTranslationQueueProps) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<TranslationJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  
  // Batch settings
  const [targetLanguage, setTargetLanguage] = useState('en');
  useDefaultTargetLang(setTargetLanguage);

  // Statistics
  const completedJobs = queue.filter(j => j.status === 'completed').length;
  const failedJobs = queue.filter(j => j.status === 'failed').length;
  const pendingJobs = queue.filter(j => j.status === 'pending').length;
  const totalStrings = queue.reduce((acc, j) => acc + j.totalStrings, 0);
  const translatedStrings = queue.reduce((acc, j) => acc + j.translatedStrings, 0);
  const overallProgress = totalStrings > 0 ? (translatedStrings / totalStrings) * 100 : 0;

  // Add files to queue
  const addFilesToQueue = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const files = await open({
        multiple: true,
        filters: [
          { name: 'Translation Files', extensions: ['json', 'po', 'csv', 'resx', 'xliff', 'yaml', 'yml', 'txt', 'xml'] }
        ]
      });

      if (files && Array.isArray(files)) {
        const newJobs: TranslationJob[] = files.map((filePath, index) => {
          const fileName = filePath.split(/[/\\]/).pop() || 'unknown';
          const ext = fileName.split('.').pop()?.toLowerCase() || '';
          
          return {
            id: `job_${Date.now()}_${index}`,
            fileName,
            filePath: filePath as string,
            fileType: ext.toUpperCase(),
            sourceLanguage: 'auto',
            targetLanguage,
            status: 'pending',
            progress: 0,
            totalStrings: 0,
            translatedStrings: 0
          };
        });

        setQueue(prev => [...prev, ...newJobs]);
        toast.success(`${newJobs.length} ${t('batch.filesInQueue')}`);
      }
    } catch (error: unknown) {
      clientLogger.error('File selection error:', error);
      toast.error(t('common.error'));
    }
  }, [targetLanguage]);

  // Add folder to queue
  const addFolderToQueue = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const folder = await open({
        directory: true,
        multiple: false
      });

      if (folder) {
        const { invoke } = await import('@tauri-apps/api/core');
        const scan = await invoke<{ files: Array<{ path: string }> }>('scan_folder_for_translation', {
          folderPath: folder
        });
        const files = scan.files.map(f => f.path);

        if (files && files.length > 0) {
          const newJobs: TranslationJob[] = files.map((filePath, index) => {
            const fileName = filePath.split(/[/\\]/).pop() || 'unknown';
            const ext = fileName.split('.').pop()?.toLowerCase() || '';
            
            return {
              id: `job_${Date.now()}_${index}`,
              fileName,
              filePath,
              fileType: ext.toUpperCase(),
              sourceLanguage: 'auto',
              targetLanguage,
              status: 'pending',
              progress: 0,
              totalStrings: 0,
              translatedStrings: 0
            };
          });

          setQueue(prev => [...prev, ...newJobs]);
          toast.success(`${newJobs.length} ${t('batch.filesInQueue')}`);
        } else {
          toast.info(t('batch.noFiles'));
        }
      }
    } catch (error: unknown) {
      clientLogger.error('Folder scan error:', error);
      toast.error(t('common.error'));
    }
  }, [targetLanguage]);

  // Start queue processing
  const startProcessing = useCallback(async () => {
    if (queue.filter(j => j.status === 'pending').length === 0) {
      toast.info(t('batch.noFiles'));
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);

    const pendingJobsList = queue.filter(j => j.status === 'pending');
    // Contato QUI e non rileggendo `queue` alla fine: dentro questa callback
    // `queue` è lo stato catturato prima del loop, quindi i lavori appena
    // marcati falliti da setQueue non ci sarebbero ancora e il conteggio
    // tornerebbe zero — cioè si rimetterebbe il toast verde.
    let falliti = 0;

    for (const job of pendingJobsList) {
      if (isPaused) break;
      
      setCurrentJobId(job.id);
      
      // Update status to "translating"
      setQueue(prev => prev.map(j => 
        j.id === job.id ? { ...j, status: 'translating', startTime: Date.now() } : j
      ));

      try {
        // ⛔ 31/07/2026 — QUESTA CODA NON HA MAI TRADOTTO NIENTE.
        //
        // Il codice rimosso: `count_translatable_strings` non esiste lato Rust,
        // quindi il catch lasciava `stringCount` al DEFAULT INVENTATO di 100;
        // poi venti giri da 100 ms di `setTimeout` — due secondi netti di barra
        // che avanza — e infine `status: 'completed'`, `progress: 100`,
        // `translatedStrings: 100`. Nessun file letto, nessuna AI chiamata,
        // nessun byte scritto: solo un'animazione che finiva con "fatto".
        //
        // Meno dannosa del traduttore di cartelle (che i file falsi li scriveva
        // per davvero), ma la stessa bugia: dichiarare un lavoro mai svolto,
        // con tanto di conteggio di stringhe mai esistite.
        //
        // La coda resta perché è un pezzo di UI valido — aggiungere, mettere in
        // pausa, riordinare i lavori — ma finché non c'è un motore sotto deve
        // dire che non c'è.
        throw new Error("BATCH_NON_IMPLEMENTATO");

      } catch (error: unknown) {
        clientLogger.error('Translation error:', error);
        falliti++;
        const grezzo = error instanceof Error ? error.message : 'Unknown error';
        setQueue(prev => prev.map(j =>
          j.id === job.id ? {
            ...j,
            status: 'failed',
            errorMessage: grezzo === 'BATCH_NON_IMPLEMENTATO'
              ? t('batch.notImplemented')
              : grezzo,
            endTime: Date.now()
          } : j
        ));
      }
    }

    setIsProcessing(false);
    setCurrentJobId(null);

    // ⚠️ Qui c'era `toast.success(t('common.queueProcessingCompleted'))`
    // INCONDIZIONATO: anche con tutti i lavori falliti, l'ultima cosa che
    // l'utente vedeva era un messaggio verde di successo. Era la bugia che
    // sopravviveva a qualunque correzione fatta più a monte.
    if (!isPaused) {
      if (falliti > 0) {
        toast.error(t('batch.notImplemented'));
      } else {
        toast.success(t('common.queueProcessingCompleted'));
      }
    }
  }, [queue, isPaused, t]);

  // Pause processing
  const pauseProcessing = useCallback(() => {
    setIsPaused(true);
    toast.info(t('common.processingPaused'));
  }, []);

  // Resume processing
  const resumeProcessing = useCallback(() => {
    setIsPaused(false);
    startProcessing();
  }, [startProcessing]);

  // Stop processing
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    setIsPaused(false);
    setCurrentJobId(null);
    
    // Reset current job to pending
    setQueue(prev => prev.map(j => 
      j.status === 'translating' ? { ...j, status: 'pending', progress: 0 } : j
    ));
    
    toast.info(t('common.processingStopped'));
  }, []);

  // Remove job from queue
  const removeJob = useCallback((jobId: string) => {
    setQueue(prev => prev.filter(j => j.id !== jobId));
    setSelectedJobs(prev => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
  }, []);

  // Remove selected jobs
  const removeSelectedJobs = useCallback(() => {
    setQueue(prev => prev.filter(j => !selectedJobs.has(j.id)));
    setSelectedJobs(new Set());
    toast.success(t('common.selectedJobsRemoved'));
  }, [selectedJobs]);

  // Clear queue
  const clearQueue = useCallback(() => {
    if (isProcessing) {
      toast.error(t('batch.stopAll'));
      return;
    }
    setQueue([]);
    setSelectedJobs(new Set());
    toast.success(t('batch.clearQueue'));
  }, [isProcessing]);

  // Retry failed jobs
  const retryFailedJobs = useCallback(() => {
    setQueue(prev => prev.map(j => 
      j.status === 'failed' ? { ...j, status: 'pending', progress: 0, errorMessage: undefined } : j
    ));
    toast.info(t('batch.failed'));
  }, []);

  // Move job up/down
  const moveJob = useCallback((jobId: string, direction: 'up' | 'down') => {
    setQueue(prev => {
      const index = prev.findIndex(j => j.id === jobId);
      if (index === -1) return prev;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const newQueue = [...prev];
      [newQueue[index], newQueue[newIndex]] = [newQueue[newIndex], newQueue[index]];
      return newQueue;
    });
  }, []);

  // Toggle job selection
  const toggleJobSelection = useCallback((jobId: string) => {
    setSelectedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }, []);

  // Select all
  const selectAll = useCallback(() => {
    if (selectedJobs.size === queue.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(queue.map(j => j.id)));
    }
  }, [queue, selectedJobs]);

  // Format time
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Status icon
  const getStatusIcon = (status: TranslationJob['status']) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-gray-400" />;
      case 'translating': return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'paused': return <Pause className="h-4 w-4 text-yellow-400" />;
    }
  };

  // Status badge color
  const getStatusBadge = (status: TranslationJob['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-500/20 text-gray-400';
      case 'translating': return 'bg-blue-500/20 text-blue-400';
      case 'completed': return 'bg-green-500/20 text-green-400';
      case 'failed': return 'bg-red-500/20 text-red-400';
      case 'paused': return 'bg-yellow-500/20 text-yellow-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Detto PRIMA che l'utente accodi i file, non dopo avergli mostrato una
          barra che arriva al 100%: la coda gestisce i lavori davvero, ma sotto
          non c'è ancora un motore di traduzione. */}
      <div
        role="status"
        className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-sm text-amber-200/90">{t('batch.notImplemented')}</p>
      </div>

      {/* Header with statistics */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-950/80 via-orange-950/60 to-red-950/80 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-500/10 rounded-full blur-3xl" />
        
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
              <Languages className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-300 to-orange-300 bg-clip-text text-transparent">
                {t('batch.title')}
              </h1>
              <p className="text-sm text-amber-200/60 mt-1">
                {t('batch.subtitle')}
              </p>
            </div>
          </div>
          
          {/* Stats */}
          <div className="hidden md:flex gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-amber-400">
                <FileText className="h-4 w-4" />
                <span className="text-lg font-bold">{queue.length}</span>
              </div>
              <p className="text-xs text-amber-200/50">{t('batch.queue')}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-lg font-bold">{completedJobs}</span>
              </div>
              <p className="text-xs text-amber-200/50">{t('batch.completed')}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-orange-400">
                <Zap className="h-4 w-4" />
                <span className="text-lg font-bold">{translatedStrings.toLocaleString()}</span>
              </div>
              <p className="text-xs text-amber-200/50">{t('batch.totalStrings')}</p>
            </div>
          </div>
        </div>

        {/* Global progress bar */}
        {queue.length > 0 && (
          <div className="relative mt-4 pt-4 border-t border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-amber-200/70">{t('batch.progress')}</span>
              <span className="text-sm font-semibold text-amber-300">{overallProgress.toFixed(1)}%</span>
            </div>
            <Progress value={overallProgress} className="h-2 bg-amber-950/50" />
          </div>
        )}
      </div>

      {/* Controls */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Add files */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={addFilesToQueue}
              className="border-amber-500/30 hover:bg-amber-500/10"
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('batch.addFiles')}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={addFolderToQueue}
              className="border-amber-500/30 hover:bg-amber-500/10"
            >
              <FolderOpen className="h-4 w-4 mr-1" />
              {t('batch.addFiles')}
            </Button>

            <div className="h-6 w-px bg-amber-500/20" />

            {/* Processing controls */}
            {!isProcessing ? (
              <Button 
                size="sm" 
                onClick={startProcessing}
                disabled={pendingJobs === 0}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                <Play className="h-4 w-4 mr-1" />
                {t('batch.startAll')} ({pendingJobs})
              </Button>
            ) : (
              <>
                {!isPaused ? (
                  <Button size="sm" variant="outline" onClick={pauseProcessing}>
                    <Pause className="h-4 w-4 mr-1" />
                    {t('batch.pauseAll')}
                  </Button>
                ) : (
                  <Button size="sm" onClick={resumeProcessing} className="bg-green-600 hover:bg-green-700">
                    <Play className="h-4 w-4 mr-1" />
                    {t('batch.startAll')}
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={stopProcessing}>
                  <Square className="h-4 w-4 mr-1" />
                  {t('batch.stopAll')}
                </Button>
              </>
            )}

            <div className="h-6 w-px bg-amber-500/20" />

            {/* Batch actions */}
            {selectedJobs.size > 0 && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={removeSelectedJobs}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove ({selectedJobs.size})
              </Button>
            )}
            
            {failedJobs > 0 && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={retryFailedJobs}
                className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                {t('batch.failed')} ({failedJobs})
              </Button>
            )}

            <div className="flex-1" />

            {/* Settings */}
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                <SelectItem value="en">🇬🇧 English</SelectItem>
                <SelectItem value="es">🇪🇸 Español</SelectItem>
                <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                <SelectItem value="fr">🇫🇷 Français</SelectItem>
                <SelectItem value="pt">🇵🇹 Português</SelectItem>
                <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                <SelectItem value="ja">🇯🇵 日本語</SelectItem>
                <SelectItem value="zh">🇨🇳 中文</SelectItem>
                <SelectItem value="ko">🇰🇷 한국어</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              size="sm" 
              variant="ghost" 
              onClick={clearQueue}
              disabled={isProcessing}
              className="text-gray-400 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Queue list */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('batch.queue')}
            </CardTitle>
            {queue.length > 0 && (
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
                {selectedJobs.size === queue.length ? t('common.none') : t('common.all')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {queue.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Languages className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('batch.noFiles')}</p>
              <p className="text-xs mt-1">{t('batch.dropFiles')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-border/50">
                {queue.map((job, index) => (
                  <div 
                    key={job.id}
                    className={`p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors ${
                      currentJobId === job.id ? 'bg-blue-500/10' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <Checkbox 
                      checked={selectedJobs.has(job.id)}
                      onCheckedChange={() => toggleJobSelection(job.id)}
                    />

                    {/* Status icon */}
                    {getStatusIcon(job.status)}

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{job.fileName}</span>
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {job.fileType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {job.filePath}
                        </span>
                        {job.totalStrings > 0 && (
                          <span className="text-xs text-muted-foreground">
                            • {job.translatedStrings}/{job.totalStrings} strings
                          </span>
                        )}
                        {job.estimatedTime && job.status === 'translating' && (
                          <span className="text-xs text-blue-400">
                            • ~{formatTime(job.estimatedTime)} remaining
                          </span>
                        )}
                      </div>
                      
                      {/* Progress bar for current job */}
                      {(job.status === 'translating' || job.progress > 0) && (
                        <Progress value={job.progress} className="h-1 mt-2" />
                      )}
                      
                      {/* Error */}
                      {job.errorMessage && (
                        <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {job.errorMessage}
                        </p>
                      )}
                    </div>

                    {/* Status badge */}
                    <Badge className={`text-xs ${getStatusBadge(job.status)}`}>
                      {job.status === 'pending' && t('batch.pending')}
                      {job.status === 'translating' && `${job.progress.toFixed(0)}%`}
                      {job.status === 'completed' && t('batch.completed')}
                      {job.status === 'failed' && t('batch.failed')}
                      {job.status === 'paused' && t('batch.pauseAll')}
                    </Badge>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => moveJob(job.id, 'up')}
                        disabled={index === 0 || isProcessing}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => moveJob(job.id, 'down')}
                        disabled={index === queue.length - 1 || isProcessing}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-red-400 hover:text-red-300"
                        onClick={() => removeJob(job.id)}
                        disabled={job.status === 'translating'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BatchTranslationQueue;




