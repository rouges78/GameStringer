'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Clock, Target, Trophy, Gamepad2, ExternalLink, Loader2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clientLogger } from '@/lib/client-logger';

interface HltbData {
  found: boolean;
  game_name?: string;
  main?: number;
  main_extra?: number;
  completionist?: number;
  all_styles?: number;
  url?: string;
  message?: string;
}

interface HltbStatsProps {
  gameName: string;
  className?: string;
}

// Cache HLTB globale per evitare doppi fetch (StrictMode + HMR)
const _hltbCache = ((globalThis as unknown as Record<string, unknown>).__gsHltbCache ??= new Map<string, HltbData>()) as Map<string, HltbData>;

export function HltbStats({ gameName, className }: HltbStatsProps) {
  const [data, setData] = useState<HltbData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameName) {
      setLoading(false);
      return;
    }

    // Check cache globale
    const cached = _hltbCache.get(gameName);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchHltb = async () => {
      setLoading(true);
      setError(null);
      
      try {
        clientLogger.debug('[HLTB] Fetching for:', gameName);
        const result = await invoke<HltbData>('get_howlongtobeat_info', { gameName });
        clientLogger.debug('[HLTB] Result:', JSON.stringify(result));
        _hltbCache.set(gameName, result);
        if (!cancelled) setData(result);
      } catch (e: unknown) {
        clientLogger.warn('[HLTB] Fetch failed:', e);
        if (!cancelled) setError('Impossibile caricare i dati');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHltb();
    return () => { cancelled = true; };
  }, [gameName]);

  // Formatta ore (backend già ritorna ore, non secondi)
  const formatHours = (hours: number | undefined): string => {
    if (!hours || hours === 0) return '--';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${Math.round(hours * 10) / 10}h`;
  };

  // Non mostrare se ancora in loading o nessun dato
  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2", className)}>
        <Clock className="h-3.5 w-3.5 text-purple-400" />
        <span className="text-xs text-white/70">HLTB</span>
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.found) {
    return null;
  }

  const stats = [
    { 
      icon: Target, 
      label: 'Main', 
      value: formatHours(data.main),
      color: 'text-blue-400',
    },
    { 
      icon: Gamepad2, 
      label: '+ Extra', 
      value: formatHours(data.main_extra),
      color: 'text-green-400',
    },
    { 
      icon: Trophy, 
      label: '100%', 
      value: formatHours(data.completionist),
      color: 'text-yellow-400',
    },
    { 
      icon: Layers, 
      label: 'All', 
      value: formatHours(data.all_styles),
      color: 'text-purple-400',
    },
  ];

  return (
    <div className={cn("flex items-center gap-3 bg-black/30 border border-white/10 rounded-lg px-3 py-2", className)}>
      {/* Icon + Label */}
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-purple-400" />
        <span className="text-xs font-medium text-white/70">HLTB</span>
      </div>

      {/* Stats inline */}
      <div className="flex items-center gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-1">
            <stat.icon className={cn("h-3 w-3", stat.color)} />
            <span className={cn("text-xs font-semibold", stat.color)}>
              {stat.value}
            </span>
            <span className="text-2xs text-muted-foreground">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Link */}
      {data.url && (
        <a 
          href={data.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="ml-auto text-2xs text-muted-foreground hover:text-purple-400 flex items-center gap-0.5 transition-colors"
        >
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
    </div>
  );
}
