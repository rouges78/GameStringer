'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  MessageSquare,
  FileText,
  Settings,
  Package,
  GraduationCap,
  Trophy,
  Subtitles,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap
} from 'lucide-react';
import { classifyContent, type ContentType } from '@/lib/content-classifier';
import { calculateQualityScore, getQualityCategory, type QualityScore } from '@/lib/translation-quality';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

// Icons per content type
const CONTENT_TYPE_ICONS: Record<ContentType, React.ElementType> = {
  ui: Settings,
  dialogue: MessageSquare,
  narrative: FileText,
  system: Zap,
  item: Package,
  tutorial: GraduationCap,
  achievement: Trophy,
  subtitle: Subtitles,
  unknown: HelpCircle
};

const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  ui: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  dialogue: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  narrative: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  system: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  item: 'bg-green-500/20 text-green-400 border-green-500/30',
  tutorial: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  achievement: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  subtitle: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  ui: 'UI',
  dialogue: 'Dialogo',
  narrative: 'Narrativa',
  system: 'Sistema',
  item: 'Oggetto',
  tutorial: 'Tutorial',
  achievement: 'Achievement',
  subtitle: 'Sottotitolo',
  unknown: 'Sconosciuto'
};

interface ContentTypeBadgeProps {
  type: ContentType;
  confidence?: number;
  showConfidence?: boolean;
  size?: 'sm' | 'md';
}

export function ContentTypeBadge({ type, confidence, showConfidence = false, size = 'sm' }: ContentTypeBadgeProps) {
  const { t } = useTranslation();
  const Icon = CONTENT_TYPE_ICONS[type];
  const colorClass = CONTENT_TYPE_COLORS[type];
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              colorClass,
              size === 'sm' ? 'text-2xs px-1.5 h-5' : 'text-xs px-2 h-6'
            )}
          >
            <Icon className={cn("mr-1", size === 'sm' ? "h-3 w-3" : "h-3.5 w-3.5")} />
            {CONTENT_TYPE_LABELS[type]}
            {showConfidence && confidence !== undefined && (
              <span className="ml-1 opacity-70">{Math.round(confidence * 100)}%</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{CONTENT_TYPE_LABELS[type]}</p>
          {confidence !== undefined && (
            <p className="text-xs text-muted-foreground">Confidenza: {Math.round(confidence * 100)}%</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface QualityScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function QualityScoreBadge({ score, size = 'sm', showLabel = true }: QualityScoreBadgeProps) {
  const { category: _category, label, color: _color } = getQualityCategory(score);
  
  const getScoreColor = (s: number) => {
    if (s >= 90) return 'text-green-500 bg-green-500/20 border-green-500/30';
    if (s >= 80) return 'text-emerald-500 bg-emerald-500/20 border-emerald-500/30';
    if (s >= 70) return 'text-yellow-500 bg-yellow-500/20 border-yellow-500/30';
    if (s >= 50) return 'text-orange-500 bg-orange-500/20 border-orange-500/30';
    return 'text-red-500 bg-red-500/20 border-red-500/30';
  };
  
  const getIcon = (s: number) => {
    if (s >= 80) return CheckCircle2;
    if (s >= 60) return AlertTriangle;
    return XCircle;
  };
  
  const Icon = getIcon(score);
  const colorClass = getScoreColor(score);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              colorClass,
              size === 'sm' ? 'text-2xs px-1.5 h-5' : 
              size === 'md' ? 'text-xs px-2 h-6' : 
              'text-sm px-2.5 h-7'
            )}
          >
            <Icon className={cn("mr-1", size === 'sm' ? "h-3 w-3" : "h-3.5 w-3.5")} />
            {score}
            {showLabel && size !== 'sm' && <span className="ml-1">{label}</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Quality Score: {score}/100</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface QualityScoreBarProps {
  score: QualityScore;
  showDetails?: boolean;
}

export function QualityScoreBar({ score, showDetails = false }: QualityScoreBarProps) {
  const { t } = useTranslation();
  const _getBarColor = (value: number) => {
    if (value >= 80) return 'bg-green-500';
    if (value >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{t('translationInsightsComp.qualityScore')}</span>
        <QualityScoreBadge score={score.overall} size="md" />
      </div>
      
      {showDetails && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">{t('translationInsightsComp.fluency')}</span>
              <span>{score.fluency}</span>
            </div>
            <Progress value={score.fluency} className="h-1" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">{t('translationInsightsComp.accuracy')}</span>
              <span>{score.accuracy}</span>
            </div>
            <Progress value={score.accuracy} className="h-1" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">{t('translationInsightsComp.consistency')}</span>
              <span>{score.consistency}</span>
            </div>
            <Progress value={score.consistency} className="h-1" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">{t('translationInsightsComp.style')}</span>
              <span>{score.style}</span>
            </div>
            <Progress value={score.style} className="h-1" />
          </div>
        </div>
      )}
      
      {showDetails && score.details.length > 0 && (
        <div className="text-2xs space-y-0.5 pt-1 border-t border-slate-700">
          {score.details.slice(0, 4).map((detail, i) => (
            <p key={i} className="text-muted-foreground">{detail}</p>
          ))}
        </div>
      )}
    </div>
  );
}

interface TranslationInsightsProps {
  sourceText: string;
  translatedText?: string;
  targetLanguage?: string;
  filename?: string;
  stringKey?: string;
  className?: string;
}

export function TranslationInsights({
  sourceText,
  translatedText,
  targetLanguage = 'it',
  filename,
  stringKey,
  className
}: TranslationInsightsProps) {
  const classification = classifyContent(sourceText, { filename, key: stringKey });
  const qualityScore = translatedText 
    ? calculateQualityScore(sourceText, translatedText, targetLanguage)
    : null;
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ContentTypeBadge 
        type={classification.type} 
        confidence={classification.confidence}
        showConfidence
      />
      
      {qualityScore && (
        <QualityScoreBadge score={qualityScore.overall} />
      )}
      
      {classification.metadata.hasPlaceholders && (
        <Badge variant="outline" className="text-2xs px-1.5 h-5 bg-orange-500/10 text-orange-400 border-orange-500/30">
          {'{...}'}
        </Badge>
      )}
      
      {classification.metadata.hasCharacterLimit && (
        <Badge variant="outline" className="text-2xs px-1.5 h-5 bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
          ≤{classification.metadata.estimatedCharLimit}
        </Badge>
      )}
    </div>
  );
}

interface BatchInsightsSummaryProps {
  items: Array<{
    source: string;
    translation?: string;
  }>;
  targetLanguage?: string;
}

export function BatchInsightsSummary({ items, targetLanguage = 'it' }: BatchInsightsSummaryProps) {
  const { t } = useTranslation();
  const classifications = items.map(item => classifyContent(item.source));
  
  const typeCounts: Record<ContentType, number> = {
    ui: 0, dialogue: 0, narrative: 0, system: 0, 
    item: 0, tutorial: 0, achievement: 0, subtitle: 0, unknown: 0
  };
  
  classifications.forEach(c => {
    typeCounts[c.type]++;
  });
  
  const sortedTypes = Object.entries(typeCounts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  
  const avgScore = items.filter(i => i.translation).length > 0
    ? Math.round(
        items
          .filter(i => i.translation)
          .map(i => calculateQualityScore(i.source, i.translation!, targetLanguage).overall)
          .reduce((a, b) => a + b, 0) / items.filter(i => i.translation).length
      )
    : null;
  
  return (
    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{t('translationInsightsComp.contentAnalysis')}</span>
        <span className="text-xs text-slate-500">{items.length} items</span>
      </div>
      
      <div className="flex flex-wrap gap-1.5">
        {sortedTypes.map(([type, count]) => (
          <div key={type} className="flex items-center gap-1">
            <ContentTypeBadge type={type as ContentType} size="sm" />
            <span className="text-xs text-slate-500">×{count}</span>
          </div>
        ))}
      </div>
      
      {avgScore !== null && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <span className="text-xs text-slate-400">{t('translationInsightsComp.avgQualityScore')}</span>
          <QualityScoreBadge score={avgScore} size="md" />
        </div>
      )}
    </div>
  );
}
