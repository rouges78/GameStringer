'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Pause, Play, X, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertTriangle, Clock, Zap,
  Minimize2, Maximize2, ExternalLink, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  getBackgroundTranslationManager,
  type BGTranslationJob,
} from '@/lib/batch/background-translation';

// ============================================================================
// MINI INDICATOR — always visible in header/sidebar
// ============================================================================

export function BackgroundJobsIndicator() {
  const [activeCount, setActiveCount] = useState(0);
  const [latestPercent, setLatestPercent] = useState(0);

  useEffect(() => {
    const mgr = getBackgroundTranslationManager();
    
    const update = () => {
      const active = mgr.getActiveJobs();
      setActiveCount(active.length);
      if (active.length > 0) {
        const running = active.find(j => j.status === 'running') || active[0];
        setLatestPercent(running.percent);
      }
    };

    update();
    const unsub = mgr.on(() => update());
    
    // Also listen for window events (cross-component)
    const handler = () => update();
    window.addEventListener('bg-translation-event', handler);
    
    return () => { unsub(); window.removeEventListener('bg-translation-event', handler); };
  }, []);

  if (activeCount === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 cursor-pointer hover:bg-indigo-500/25 transition-all">
            <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
            <span className="text-xs font-bold text-indigo-300">{activeCount}</span>
            {/* Mini progress ring */}
            <svg className="h-4 w-4 -rotate-90" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-700/50" />
              <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400"
                strokeDasharray={`${latestPercent * 0.503} 50.3`} strokeLinecap="round" />
            </svg>
            {/* Pulse animation */}
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{activeCount} traduzion{activeCount === 1 ? 'e' : 'i'} in background — {latestPercent}%</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// FLOATING WIDGET — persistent panel for background jobs
// ============================================================================

export function BackgroundJobsWidget() {
  const router = useRouter();
  const [jobs, setJobs] = useState<BGTranslationJob[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const refresh = useCallback(() => {
    const mgr = getBackgroundTranslationManager();
    setJobs(mgr.getJobs());
  }, []);

  useEffect(() => {
    const mgr = getBackgroundTranslationManager();
    refresh();
    
    const unsub = mgr.on(() => refresh());
    const handler = () => refresh();
    window.addEventListener('bg-translation-event', handler);
    
    // Poll for ETA updates
    const interval = setInterval(refresh, 2000);
    
    return () => { unsub(); window.removeEventListener('bg-translation-event', handler); clearInterval(interval); };
  }, [refresh]);

  const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'queued' || j.status === 'paused');
  const recentJobs = jobs.filter(j => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled').slice(0, 3);

  // No jobs at all → nothing to show
  if (jobs.length === 0) return null;

  const mgr = getBackgroundTranslationManager();

  // Minimized state — just a small pill
  if (minimized && activeJobs.length > 0) {
    return (
      <div
        className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-3 py-2 rounded-full bg-slate-900/95 border border-indigo-500/40 shadow-xl backdrop-blur-xl cursor-pointer hover:border-indigo-500/60 transition-all"
        onClick={() => setMinimized(false)}
      >
        <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
        <span className="text-xs font-bold text-indigo-300">
          {activeJobs.length} traduzion{activeJobs.length === 1 ? 'e' : 'i'}
        </span>
        <span className="text-xs text-slate-400">
          {activeJobs[0]?.percent || 0}%
        </span>
        <Maximize2 className="h-3 w-3 text-slate-500" />
      </div>
    );
  }

  // No active + no recent → hide
  if (activeJobs.length === 0 && recentJobs.length === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-[60] w-[380px] bg-slate-950/95 border border-slate-700/60 rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden transition-all",
      expanded ? "max-h-[500px]" : "max-h-[260px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/50 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-bold text-slate-200">Traduzioni in Background</span>
          {activeJobs.length > 0 && (
            <Badge variant="outline" className="text-2xs px-1.5 py-0 h-4 border-indigo-500/40 text-indigo-300">
              {activeJobs.length} attiv{activeJobs.length === 1 ? 'a' : 'e'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {recentJobs.length > 0 && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMinimized(true)}>
            <Minimize2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ScrollArea className={expanded ? "max-h-[440px]" : "max-h-[220px]"}>
        <div className="p-3 space-y-2">
          {/* Active Jobs */}
          {activeJobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onPause={() => mgr.pauseJob(job.id)}
              onResume={() => { mgr.resumeJob(job.id); }}
              onCancel={() => mgr.cancelJob(job.id)}
              onOpenResults={() => {
                router.push(`/auto-translate?gameId=${encodeURIComponent(job.gameId)}&bgJobId=${encodeURIComponent(job.id)}`);
              }}
            />
          ))}

          {/* Recent completed/failed */}
          {expanded && recentJobs.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-2">
                <div className="h-px flex-1 bg-slate-800" />
                <span className="text-2xs text-slate-600 uppercase tracking-wider">Recenti</span>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              {recentJobs.map(job => (
                <CompletedJobCard
                  key={job.id}
                  job={job}
                  onRemove={() => mgr.removeJob(job.id)}
                  onOpenResults={() => {
                    router.push(`/auto-translate?gameId=${encodeURIComponent(job.gameId)}&bgJobId=${encodeURIComponent(job.id)}`);
                  }}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// JOB CARD — Active job with controls
// ============================================================================

function JobCard({ job, onPause, onResume, onCancel }: {
  job: BGTranslationJob;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onOpenResults: () => void;
}) {
  const mgr = getBackgroundTranslationManager();
  const isRunning = job.status === 'running';
  const isPaused = job.status === 'paused';

  const statusColor = isRunning ? 'text-indigo-400' : isPaused ? 'text-yellow-400' : 'text-slate-400';
  const statusBg = isRunning ? 'bg-indigo-500/10 border-indigo-500/30' : isPaused ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-slate-800/50 border-slate-700/30';

  return (
    <div className={cn("rounded-lg border p-3 space-y-2 transition-all", statusBg)}>
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {job.gameImage && (
            <img src={job.gameImage} alt="" className="h-6 w-10 rounded object-cover flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-200 truncate">{job.gameName}</p>
            <p className="text-2xs text-slate-500">
              {job.sourceLang.toUpperCase()} → {job.targetLang.toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isRunning && (
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-yellow-500/20" onClick={onPause}>
              <Pause className="h-3 w-3 text-yellow-400" />
            </Button>
          )}
          {isPaused && (
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-green-500/20" onClick={onResume}>
              <Play className="h-3 w-3 text-green-400" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-red-500/20" onClick={onCancel}>
            <X className="h-3 w-3 text-red-400" />
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <Progress value={job.percent} className="h-1.5" />
        <div className="flex items-center justify-between text-2xs">
          <span className={statusColor}>
            {isRunning && <Loader2 className="inline h-3 w-3 animate-spin mr-1" />}
            {isPaused && <Pause className="inline h-3 w-3 mr-1" />}
            {job.percent}% — {job.translatedCount}/{job.totalStrings}
          </span>
          <span className="text-slate-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {isRunning ? `~${mgr.formatTime(job.estimatedRemainingMs)}` : mgr.formatTime(job.elapsedMs)}
          </span>
        </div>
      </div>

      {/* Current activity */}
      {job.currentFile && isRunning && (
        <p className="text-2xs text-slate-500 truncate">
          📄 {job.currentFile} {job.currentBatch && job.totalBatches ? `(batch ${job.currentBatch}/${job.totalBatches})` : ''}
          {job.lastProvider && <span className="text-indigo-400/60 ml-1">via {job.lastProvider}</span>}
        </p>
      )}

      {/* Last translated preview */}
      {job.lastTranslated && isRunning && (
        <div className="text-2xs bg-slate-900/50 rounded px-2 py-1 space-y-0.5">
          <p className="text-slate-500 truncate">&quot;{job.lastTranslated.original}&quot;</p>
          <p className="text-emerald-400/80 truncate">→ &quot;{job.lastTranslated.translation}&quot;</p>
        </div>
      )}

      {/* Errors */}
      {job.errors.length > 0 && (
        <p className="text-2xs text-red-400/70 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {job.errors[job.errors.length - 1]}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// COMPLETED JOB CARD
// ============================================================================

function CompletedJobCard({ job, onRemove, onOpenResults }: {
  job: BGTranslationJob;
  onRemove: () => void;
  onOpenResults: () => void;
}) {
  const mgr = getBackgroundTranslationManager();
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  return (
    <div className={cn(
      "rounded-lg border p-2.5 flex items-center gap-2",
      isCompleted ? "bg-emerald-500/5 border-emerald-500/20" :
      isFailed ? "bg-red-500/5 border-red-500/20" :
      "bg-slate-800/30 border-slate-700/20"
    )}>
      {isCompleted ? <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" /> :
       isFailed ? <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" /> :
       <X className="h-4 w-4 text-slate-500 flex-shrink-0" />}
      
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-300 truncate">{job.gameName}</p>
        <p className="text-2xs text-slate-500">
          {job.translatedCount}/{job.totalStrings} — {mgr.formatTime(job.elapsedMs)}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {isCompleted && (
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-emerald-500/20" onClick={onOpenResults}>
            <ExternalLink className="h-3 w-3 text-emerald-400" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-red-500/20" onClick={onRemove}>
          <Trash2 className="h-3 w-3 text-slate-500" />
        </Button>
      </div>
    </div>
  );
}

