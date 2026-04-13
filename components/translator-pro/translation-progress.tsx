'use client';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle, CheckCircle, ChevronRight, Brain,
  Clock, Square, RotateCcw, Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { formatTimeRemaining, type BatchProgress } from '@/lib/neural-translator';
import { QualityScoreBadge } from '@/components/translator/translation-insights';
import { calculateQualityScore } from '@/lib/translation-quality';

// ============================================================================
// TYPES
// ============================================================================

export interface TranslatedItem {
  id: string;
  sourceText: string;
  translatedText: string;
  fromMemory: boolean;
  metadata?: Record<string, unknown>;
}

export interface Game {
  id: string;
  name: string;
  provider: string;
  coverUrl?: string;
  installPath?: string;
  supportedLanguages?: string;
}

export interface TranslationProgressProps {
  isTranslating: boolean;
  progress: BatchProgress | null;
  error: string | null;
  elapsedTime: number;
  translatedItems: TranslatedItem[];
  selectedGame: Game | null;
  targetLanguage: string;
  onSavePartialResults: () => void;
  onCancelTranslation: () => void;
  onRetry: () => void;
  onViewResults: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TranslationProgress({
  isTranslating,
  progress,
  error,
  elapsedTime,
  translatedItems,
  selectedGame,
  targetLanguage,
  onSavePartialResults,
  onCancelTranslation,
  onRetry,
  onViewResults,
}: TranslationProgressProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        {isTranslating ? (
          <>
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div className={cn(
                "absolute inset-0 rounded-full animate-pulse transition-colors duration-500",
                progress?.isRateLimited
                  ? "bg-amber-500"
                  : "bg-gradient-to-r from-sky-500 to-blue-500"
              )} />
              <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center">
                {progress?.isRateLimited ? (
                  <Clock className="h-8 w-8 text-amber-500 animate-pulse" />
                ) : (
                  <Brain className="h-8 w-8 text-purple-500 animate-pulse" />
                )}
              </div>
            </div>

            {/* Game name */}
            {selectedGame && (
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="relative w-8 h-8 rounded overflow-hidden bg-gradient-to-br from-blue-900/50 to-cyan-900/50 flex-shrink-0">
                  {selectedGame.coverUrl && (
                    <img
                      src={selectedGame.coverUrl}
                      alt={selectedGame.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center -z-10">
                    <span className="text-xs font-bold text-white/50">{selectedGame.name?.charAt(0)?.toUpperCase() || '?'}</span>
                  </div>
                </div>
                <span className="text-lg font-medium text-purple-400">
                  {selectedGame.name}
                </span>
              </div>
            )}

            <h2 className="text-xl font-semibold mb-2">
              {progress?.isRateLimited ? 'In attesa API...' : 'Traduzione in corso...'}
            </h2>

            {progress?.statusMessage && (
              <div className={cn(
                "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4",
                progress.isRateLimited
                  ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  : "bg-muted text-muted-foreground"
              )}>
                {progress.isRateLimited && <AlertTriangle className="h-3 w-3" />}
                {progress.statusMessage}
              </div>
            )}

            {progress && (
              <div className="max-w-md mx-auto space-y-3">
                <Progress
                  value={progress.percentage}
                  className={cn(
                    "h-2 transition-all",
                    progress.isRateLimited ? "[&>div]:bg-amber-500" : ""
                  )}
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{progress.completed}/{progress.total} strings</span>
                  <span>{progress.fromMemory} from memory</span>
                </div>
                {progress.startTime && (
                  <p className="text-xs text-muted-foreground">
                    Elapsed: {formatTimeRemaining(elapsedTime)}
                  </p>
                )}
                {progress.estimatedTimeRemaining && (
                  <p className="text-sm text-muted-foreground">
                    Remaining: ~{formatTimeRemaining(progress.estimatedTimeRemaining)}
                  </p>
                )}
                {progress.currentItem && !progress.isRateLimited && (
                  <p className="text-xs text-muted-foreground truncate">
                    &quot;{progress.currentItem}&quot;...
                  </p>
                )}

                {/* Live Quality Preview */}
                {translatedItems.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-semibold text-muted-foreground uppercase">{t('translatorProPage.ultimeTraduzioni')}</span>
                      <span className="text-2xs text-muted-foreground">{translatedItems.length} completate</span>
                    </div>
                    <div className="divide-y divide-border/30">
                      {translatedItems.slice(-3).reverse().map((item, idx) => {
                        const qs = calculateQualityScore(item.sourceText, item.translatedText, targetLanguage);
                        return (
                          <div key={idx} className="flex items-center gap-2 py-1.5 text-[11px]">
                            <span className="truncate flex-1 text-muted-foreground">{item.sourceText}</span>
                            <span className="text-xs">&rarr;</span>
                            <span className={cn("truncate flex-1", item.fromMemory ? "text-blue-400" : "")}>{item.translatedText}</span>
                            <QualityScoreBadge score={qs.overall} size="sm" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-col gap-2 mt-4">
                  {/* Save partial results button */}
                  {progress.completed > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-green-500/50 text-green-500 hover:bg-green-500/10"
                      onClick={onSavePartialResults}
                    >
                      <Save className="mr-2 h-3 w-3" />
                      Salva results parziali ({progress.completed}/{progress.total})
                    </Button>
                  )}

                  {/* Cancel button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={onCancelTranslation}
                  >
                    <Square className="mr-2 h-3 w-3" />
                    Annulla traduzione
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : error ? (
          <>
            <AlertTriangle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">error</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={onRetry}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Riprova
            </Button>
          </>
        ) : (
          <>
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('translatorProPage.completed')}</h2>
            <Button onClick={onViewResults}>
              Vedi results
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
