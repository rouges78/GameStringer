'use client';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type QualityLevel = 'high' | 'medium' | 'low' | 'unknown';

interface QualityBadgeProps {
  confidence: number; // 0.0 - 1.0
  provider?: string;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/** Mappa confidenza → livello qualità */
export function getQualityLevel(confidence: number): QualityLevel {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.6) return 'medium';
  if (confidence > 0) return 'low';
  return 'unknown';
}

const QUALITY_CONFIG: Record<QualityLevel, {
  emoji: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}> = {
  high: {
    emoji: '🟢',
    label: 'Alta',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    description: 'Traduzione affidabile — provider premium o alta confidenza AI',
  },
  medium: {
    emoji: '🟡',
    label: 'Media',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    description: 'Traduzione accettabile — verifica consigliata per testi critici',
  },
  low: {
    emoji: '🔴',
    label: 'Bassa',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    description: 'Traduzione da verificare — fallback o provider meno affidabile',
  },
  unknown: {
    emoji: '⚪',
    label: '?',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
    description: 'Confidenza non disponibile',
  },
};

export function QualityBadge({ confidence, provider, className, showLabel = false, size = 'sm' }: QualityBadgeProps) {
  const level = getQualityLevel(confidence);
  const config = QUALITY_CONFIG[level];
  const pct = Math.round(confidence * 100);

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center rounded-md border font-medium cursor-default',
              config.bgColor,
              config.borderColor,
              config.color,
              sizeClasses[size],
              className
            )}
          >
            <span>{config.emoji}</span>
            {showLabel && <span>{config.label}</span>}
            <span className="opacity-70">{pct}%</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-semibold">{config.emoji} Qualità: {config.label} ({pct}%)</p>
          <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
          {provider && (
            <p className="text-xs text-muted-foreground mt-1">Provider: {provider}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Versione inline compatta — solo emoji */
export function QualityDot({ confidence, className }: { confidence: number; className?: string }) {
  const level = getQualityLevel(confidence);
  const config = QUALITY_CONFIG[level];
  return <span className={cn('cursor-default', className)} title={`${config.label} (${Math.round(confidence * 100)}%)`}>{config.emoji}</span>;
}
