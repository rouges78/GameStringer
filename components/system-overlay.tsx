'use client';

import { useState, useEffect, useCallback } from 'react';
import { Cpu, MemoryStick, Monitor, Thermometer, ChevronDown, ChevronUp, Zap, Cloud, HardDrive } from 'lucide-react';
import { vramManager, type SystemStats, type VramTier } from '@/lib/vram-manager';

const TIER_COLORS: Record<VramTier, string> = {
  ultra: 'text-emerald-400',
  high: 'text-sky-400',
  medium: 'text-amber-400',
  low: 'text-orange-400',
  minimal: 'text-red-400',
  cloud: 'text-violet-400',
};

const TIER_BG: Record<VramTier, string> = {
  ultra: 'bg-emerald-500/10 border-emerald-500/20',
  high: 'bg-sky-500/10 border-sky-500/20',
  medium: 'bg-amber-500/10 border-amber-500/20',
  low: 'bg-orange-500/10 border-orange-500/20',
  minimal: 'bg-red-500/10 border-red-500/20',
  cloud: 'bg-violet-500/10 border-violet-500/20',
};

const TIER_LABELS: Record<VramTier, string> = {
  ultra: 'Ultra',
  high: 'Alto',
  medium: 'Medio',
  low: 'Basso',
  minimal: 'Minimo',
  cloud: 'Cloud',
};

function ProgressRing({ percent, size = 32, stroke = 3, color }: { percent: number; size?: number; stroke?: number; color: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-white/5" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        className="transition-all duration-500"
      />
    </svg>
  );
}

function UsageBar({ percent, label, color, detail }: { percent: number; label: string; color: string; detail?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={`text-2xs font-bold ${percent > 85 ? 'text-red-400' : percent > 65 ? 'text-amber-400' : 'text-slate-400'}`}>
          {percent.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(100, percent)}%`, backgroundColor: color }}
        />
      </div>
      {detail && <span className="text-micro text-slate-600">{detail}</span>}
    </div>
  );
}

interface SystemOverlayProps {
  position?: 'top-right' | 'bottom-right' | 'bottom-left';
  compact?: boolean;
}

export function SystemOverlay({ position = 'bottom-right', compact: initialCompact = true }: SystemOverlayProps) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [tier, setTier] = useState<VramTier>('cloud');
  const [expanded, setExpanded] = useState(!initialCompact);
  const [visible, setVisible] = useState(true);
  const [modelInfo, setModelInfo] = useState<{ provider: 'local' | 'cloud'; model: string } | null>(null);

  useEffect(() => {
    vramManager.init();

    const unsub = vramManager.on((event, data) => {
      if (event === 'stats-update') {
        setStats(data.stats);
        setTier(vramManager.getCurrentTier());
        setModelInfo(vramManager.getActiveModel());
      }
      if (event === 'tier-change') {
        setTier(data.to);
      }
    });

    // Stato iniziale
    const initial = vramManager.getCurrentStats();
    if (initial) {
      setStats(initial);
      setTier(vramManager.getCurrentTier());
      setModelInfo(vramManager.getActiveModel());
    }

    return () => {
      unsub();
    };
  }, []);

  const positionClasses = {
    'top-right': 'top-16 right-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  if (!visible || !stats) return null;

  const tierColor = TIER_COLORS[tier];
  const tierBg = TIER_BG[tier];

  // ── Compact Mode ──
  if (!expanded) {
    return (
      <div className={`fixed ${positionClasses[position]} z-50`}>
        <button
          onClick={() => setExpanded(true)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-xl shadow-xl transition-all hover:scale-105 ${tierBg}`}
        >
          {stats.gpu_available ? (
            <Monitor className={`h-3.5 w-3.5 ${tierColor}`} />
          ) : (
            <Cloud className={`h-3.5 w-3.5 ${tierColor}`} />
          )}
          <span className={`text-2xs font-bold ${tierColor}`}>
            {stats.gpu_available ? `VRAM ${stats.vram_usage_percent.toFixed(0)}%` : 'Cloud'}
          </span>
          {stats.vram_usage_percent > 85 && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          )}
          <ChevronUp className="h-3 w-3 text-slate-500" />
        </button>
      </div>
    );
  }

  // ── Expanded Mode ──
  return (
    <div className={`fixed ${positionClasses[position]} z-50 w-72`}>
      <div className="rounded-2xl border border-white/[0.08] bg-slate-950/90 backdrop-blur-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-300">Monitor Sistema</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-micro font-bold px-2 py-0.5 rounded-md border ${tierBg} ${tierColor}`}>
              {TIER_LABELS[tier]}
            </span>
            <button onClick={() => setExpanded(false)} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* GPU */}
        <div className="px-4 py-3 space-y-3">
          {stats.gpu_available ? (
            <>
              <div className="flex items-center gap-2">
                <Monitor className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-2xs font-semibold text-slate-400 truncate">{stats.gpu_name}</span>
              </div>

              <UsageBar
                percent={stats.vram_usage_percent}
                label="VRAM"
                color={stats.vram_usage_percent > 85 ? '#f87171' : stats.vram_usage_percent > 65 ? '#fbbf24' : '#34d399'}
                detail={`${stats.vram_used_mb}MB / ${stats.vram_total_mb}MB (${stats.vram_free_mb}MB liberi)`}
              />

              {stats.gpu_temp_celsius !== null && (
                <div className="flex items-center gap-2">
                  <Thermometer className={`h-3 w-3 ${stats.gpu_temp_celsius > 80 ? 'text-red-400' : stats.gpu_temp_celsius > 65 ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span className={`text-2xs font-semibold ${stats.gpu_temp_celsius > 80 ? 'text-red-400' : stats.gpu_temp_celsius > 65 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {stats.gpu_temp_celsius.toFixed(0)}°C
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 py-1">
              <Cloud className="h-4 w-4 text-violet-400" />
              <span className="text-xs text-slate-400">Nessuna GPU rilevata — modalità Cloud</span>
            </div>
          )}

          {/* RAM */}
          <UsageBar
            percent={stats.ram_usage_percent}
            label="RAM"
            color={stats.ram_usage_percent > 85 ? '#f87171' : stats.ram_usage_percent > 65 ? '#fbbf24' : '#60a5fa'}
            detail={`${stats.ram_used_mb}MB / ${stats.ram_total_mb}MB`}
          />
        </div>

        {/* Active Model */}
        {modelInfo && (
          <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-2">
            {modelInfo.provider === 'local' ? (
              <HardDrive className="h-3 w-3 text-emerald-400" />
            ) : (
              <Cloud className="h-3 w-3 text-violet-400" />
            )}
            <span className="text-2xs text-slate-500">Modello:</span>
            <span className={`text-2xs font-bold ${modelInfo.provider === 'local' ? 'text-emerald-400' : 'text-violet-400'}`}>
              {modelInfo.model}
            </span>
            <Zap className="h-2.5 w-2.5 text-amber-400 ml-auto" />
          </div>
        )}

        {/* Warning */}
        {stats.warning && (
          <div className="px-4 py-2 border-t border-red-500/10 bg-red-500/[0.03]">
            <p className="text-micro text-red-400 leading-relaxed">{stats.warning}</p>
          </div>
        )}
      </div>
    </div>
  );
}
