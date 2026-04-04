'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Cpu, 
  MemoryStick, 
  Monitor, 
  Thermometer, 
  AlertTriangle, 
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { safeInvoke as invoke } from '@/lib/tauri-wrapper';

interface SystemStats {
  cpu_usage_percent: number;
  ram_total_mb: number;
  ram_used_mb: number;
  ram_usage_percent: number;
  gpu_name: string;
  vram_total_mb: number;
  vram_used_mb: number;
  vram_free_mb: number;
  vram_usage_percent: number;
  gpu_temp_celsius: number | null;
  gpu_available: boolean;
  warning: string | null;
}

function getUsageColor(percent: number): string {
  if (percent >= 90) return 'text-red-400';
  if (percent >= 75) return 'text-amber-400';
  if (percent >= 50) return 'text-yellow-400';
  return 'text-emerald-400';
}

function getProgressColor(percent: number): string {
  if (percent >= 90) return '[&>div]:bg-red-500';
  if (percent >= 75) return '[&>div]:bg-amber-500';
  if (percent >= 50) return '[&>div]:bg-yellow-500';
  return '[&>div]:bg-emerald-500';
}

export function SystemMonitor({ compact = false }: { compact?: boolean }) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(!compact);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const result = await invoke('get_system_stats') as SystemStats;
      setStats(result);
    } catch (err) {
      console.warn('System monitor not available:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    if (autoRefresh) {
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchStats, autoRefresh]);

  if (!stats) {
    return compact ? null : (
      <Card className="border-slate-500/20 bg-slate-950/30">
        <CardContent className="p-3 text-center text-xs text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1" />
          Caricamento monitor di sistema...
        </CardContent>
      </Card>
    );
  }

  // Compact mode: solo badge inline
  if (compact && !expanded) {
    return (
      <button 
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-900/50 border border-slate-700/30 hover:border-slate-600/50 transition-all text-xs"
      >
        <Monitor className="h-3 w-3 text-slate-400" />
        {stats.gpu_available && (
          <span className={getUsageColor(stats.vram_usage_percent)}>
            VRAM {Math.round(stats.vram_usage_percent)}%
          </span>
        )}
        <span className={getUsageColor(stats.ram_usage_percent)}>
          RAM {Math.round(stats.ram_usage_percent)}%
        </span>
        {stats.warning && <AlertTriangle className="h-3 w-3 text-amber-400" />}
        <ChevronDown className="h-3 w-3 text-slate-500" />
      </button>
    );
  }

  return (
    <Card className="border-slate-500/20 bg-slate-950/40 backdrop-blur-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            System Monitor
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={fetchStats}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {compact && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setExpanded(false)}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Warning */}
        {stats.warning && (
          <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <span className="text-xs text-amber-300">{stats.warning}</span>
          </div>
        )}

        <div className="space-y-2">
          {/* GPU / VRAM */}
          {stats.gpu_available ? (
            <div className="p-2 rounded-lg bg-violet-950/30 border border-violet-500/10">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Cpu className="h-3 w-3 text-violet-400" />
                  <span className="text-[11px] text-violet-300 font-medium">GPU</span>
                  <span className="text-2xs text-violet-400/50 truncate max-w-[180px]">{stats.gpu_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {stats.gpu_temp_celsius != null && (
                    <Badge variant="outline" className="text-micro px-1.5 py-0 h-4 border-violet-500/20">
                      <Thermometer className="h-2.5 w-2.5 mr-0.5" />
                      {stats.gpu_temp_celsius}°C
                    </Badge>
                  )}
                  <span className={`text-xs font-bold ${getUsageColor(stats.vram_usage_percent)}`}>
                    {Math.round(stats.vram_usage_percent)}%
                  </span>
                </div>
              </div>
              <Progress value={stats.vram_usage_percent} className={`h-1.5 ${getProgressColor(stats.vram_usage_percent)}`} />
              <div className="flex justify-between mt-1">
                <span className="text-micro text-violet-400/50">
                  VRAM: {(stats.vram_used_mb / 1024).toFixed(1)} / {(stats.vram_total_mb / 1024).toFixed(1)} GB
                </span>
                <span className="text-micro text-violet-400/50">
                  Libera: {(stats.vram_free_mb / 1024).toFixed(1)} GB
                </span>
              </div>
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-slate-950/30 border border-slate-500/10 text-center">
              <span className="text-2xs text-slate-500">Nessuna GPU NVIDIA rilevata</span>
            </div>
          )}

          {/* RAM */}
          <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/10">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <MemoryStick className="h-3 w-3 text-cyan-400" />
                <span className="text-[11px] text-cyan-300 font-medium">RAM</span>
              </div>
              <span className={`text-xs font-bold ${getUsageColor(stats.ram_usage_percent)}`}>
                {Math.round(stats.ram_usage_percent)}%
              </span>
            </div>
            <Progress value={stats.ram_usage_percent} className={`h-1.5 ${getProgressColor(stats.ram_usage_percent)}`} />
            <div className="flex justify-between mt-1">
              <span className="text-micro text-cyan-400/50">
                {(stats.ram_used_mb / 1024).toFixed(1)} / {(stats.ram_total_mb / 1024).toFixed(1)} GB
              </span>
              <span className="text-micro text-cyan-400/50">
                Libera: {((stats.ram_total_mb - stats.ram_used_mb) / 1024).toFixed(1)} GB
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SystemMonitor;
