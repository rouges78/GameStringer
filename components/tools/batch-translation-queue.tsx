'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Settings,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';

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

export function BatchTranslationQueue({ onTranslateFile }: BatchTranslationQueueProps) {
  const [queue, setQueue] = useState<TranslationJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  
  // Batch settings
  const [targetLanguage, setTargetLanguage] = useState('it');
  const [translationService, setTranslationService] = useState('ollama');
  const [maxConcurrent, setMaxConcurrent] = useState(1);

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
        toast.success(`${newJobs.length} files added to queue`);
      }
    } catch (error) {
      console.error('File selection error:', error);
      toast.error('Error selecting files');
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
        const files = await invoke<string[]>('scan_folder_for_translation_files', {
          folderPath: folder
        });

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
          toast.success(`${newJobs.length} files found and added to queue`);
        } else {
          toast.info('No translation files found in folder');
        }
      }
    } catch (error) {
      console.error('Folder scan error:', error);
      toast.error('Error scanning folder');
    }
  }, [targetLanguage]);

  // Start queue processing
  const startProcessing = useCallback(async () => {
    if (queue.filter(j => j.status === 'pending').length === 0) {
      toast.info('No pending jobs in queue');
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);

    const pendingJobs = queue.filter(j => j.status === 'pending');
    
    for (const job of pendingJobs) {
      if (isPaused) break;
      
      setCurrentJobId(job.id);
      
      // Update status to "translating"
      setQueue(prev => prev.map(j => 
        j.id === job.id ? { ...j, status: 'translating', startTime: Date.now() } : j
      ));

      try {
        // Simulate file analysis to count strings
        const { invoke } = await import('@tauri-apps/api/core');
        
        // Count strings in file
        let stringCount = 100; // Default
        try {
          stringCount = await invoke<number>('count_translatable_strings', {
            filePath: job.filePath
          });
        } catch (e) {
          console.warn('Unable to count strings, using default:', e);
        }

        setQueue(prev => prev.map(j => 
          j.id === job.id ? { ...j, totalStrings: stringCount } : j
        ));

        // Simulate progressive translation
        for (let i = 0; i <= stringCount; i += Math.ceil(stringCount / 20)) {
          if (isPaused) {
            setQueue(prev => prev.map(j => 
              j.id === job.id ? { ...j, status: 'paused' } : j
            ));
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 100));
          
          const progress = Math.min((i / stringCount) * 100, 100);
          setQueue(prev => prev.map(j => 
            j.id === job.id ? { 
              ...j, 
              progress, 
              translatedStrings: i,
              estimatedTime: Math.ceil((stringCount - i) * 0.05)
            } : j
          ));
        }

        // If not paused, complete
        if (!isPaused) {
          setQueue(prev => prev.map(j => 
            j.id === job.id ? { 
              ...j, 
              status: 'completed', 
              progress: 100, 
              translatedStrings: stringCount,
              endTime: Date.now()
            } : j
          ));
        }

      } catch (error: any) {
        console.error('Translation error:', error);
        setQueue(prev => prev.map(j => 
          j.id === job.id ? { 
            ...j, 
            status: 'failed', 
            errorMessage: error?.message || 'Unknown error',
            endTime: Date.now()
          } : j
        ));
      }
    }

    setIsProcessing(false);
    setCurrentJobId(null);
    
    if (!isPaused) {
      toast.success('Queue processing completed!');
    }
  }, [queue, isPaused]);

  // Pause processing
  const pauseProcessing = useCallback(() => {
    setIsPaused(true);
    toast.info('Processing paused');
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
    
    toast.info('Processing stopped');
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
    toast.success('Selected jobs removed');
  }, [selectedJobs]);

  // Clear queue
  const clearQueue = useCallback(() => {
    if (isProcessing) {
      toast.error('Stop processing before clearing the queue');
      return;
    }
    setQueue([]);
    setSelectedJobs(new Set());
    toast.success('Queue cleared');
  }, [isProcessing]);

  // Retry failed jobs
  const retryFailedJobs = useCallback(() => {
    setQueue(prev => prev.map(j => 
      j.status === 'failed' ? { ...j, status: 'pending', progress: 0, errorMessage: undefined } : j
    ));
    toast.info('Failed jobs reset');
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
                Batch Translation
              </h1>
              <p className="text-sm text-amber-200/60 mt-1">
                Translate multiple files in automatic queue
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
              <p className="text-xs text-amber-200/50">In queue</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-lg font-bold">{completedJobs}</span>
              </div>
              <p className="text-xs text-amber-200/50">Completed</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-orange-400">
                <Zap className="h-4 w-4" />
                <span className="text-lg font-bold">{translatedStrings.toLocaleString()}</span>
              </div>
              <p className="text-xs text-amber-200/50">Strings</p>
            </div>
          </div>
        </div>

        {/* Global progress bar */}
        {queue.length > 0 && (
          <div className="relative mt-4 pt-4 border-t border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-amber-200/70">Total progress</span>
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
              Add Files
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={addFolderToQueue}
              className="border-amber-500/30 hover:bg-amber-500/10"
            >
              <FolderOpen className="h-4 w-4 mr-1" />
              Add Folder
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
                Start ({pendingJobs})
              </Button>
            ) : (
              <>
                {!isPaused ? (
                  <Button size="sm" variant="outline" onClick={pauseProcessing}>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </Button>
                ) : (
                  <Button size="sm" onClick={resumeProcessing} className="bg-green-600 hover:bg-green-700">
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={stopProcessing}>
                  <Square className="h-4 w-4 mr-1" />
                  Stop
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
                Retry failed ({failedJobs})
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
              Translation Queue
            </CardTitle>
            {queue.length > 0 && (
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
                {selectedJobs.size === queue.length ? 'Deselect all' : 'Select all'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {queue.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Languages className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No files in queue</p>
              <p className="text-xs mt-1">Add files or folders to start</p>
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
                      {job.status === 'pending' && 'Pending'}
                      {job.status === 'translating' && `${job.progress.toFixed(0)}%`}
                      {job.status === 'completed' && 'Completed'}
                      {job.status === 'failed' && 'Failed'}
                      {job.status === 'paused' && 'Paused'}
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



