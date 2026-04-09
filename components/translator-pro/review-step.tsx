'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle, FileText, CheckCircle, Sparkles,
  Download, RotateCcw, FileCode, Database, Play,
  Package, Loader2, Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { type BatchTranslationJob } from '@/lib/neural-translator';
import { QualityScoreBadge, ContentTypeBadge } from '@/components/translator/translation-insights';
import { classifyContent } from '@/lib/content-classifier';
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

export interface ReviewStepProps {
  currentJob: BatchTranslationJob;
  selectedGame: Game | null;
  targetLanguage: string;
  translatedFiles: Map<string, string>;
  translatedItems: TranslatedItem[];
  isApplying: boolean;
  applyStatus: 'idle' | 'finding' | 'checking' | 'installing' | 'applying' | 'done' | 'error';
  onSaveAllFiles: () => void;
  onDownloadAll: () => void;
  onExportPatch: () => void;
  onOpenInEditor: (filename: string) => void;
  onSaveFile: (filename: string) => void;
  onDownloadFile: (filename: string) => void;
  onNewTranslation: () => void;
  onApplyToGame: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ReviewStep({
  currentJob,
  selectedGame,
  targetLanguage,
  translatedFiles,
  translatedItems,
  isApplying,
  applyStatus,
  onSaveAllFiles,
  onDownloadAll,
  onExportPatch,
  onOpenInEditor,
  onSaveFile,
  onDownloadFile,
  onNewTranslation,
  onApplyToGame,
}: ReviewStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Game Info Header */}
      {selectedGame && (
        <div className="flex items-center justify-center gap-3 py-2">
          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/50 to-blue-900/50 shadow-lg flex-shrink-0">
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
              <span className="text-sm font-bold text-white/50">{selectedGame.name?.charAt(0)?.toUpperCase() || '?'}</span>
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-purple-400">{selectedGame.name}</h3>
            <p className="text-xs text-muted-foreground">{t('translatorProPage.translationCompleted')}</p>
          </div>
        </div>
      )}

      {/* Stats with glow effects */}
      <div className="grid grid-cols-4 gap-4">
        <div className="group p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center transition-all duration-300 hover:bg-green-500/15 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:scale-[1.02]">
          <p className="text-2xl font-bold text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]">{currentJob.results.translatedItems}</p>
          <p className="text-xs text-muted-foreground">{t('translatorProPage.translated')}</p>
        </div>
        <div className="group p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center transition-all duration-300 hover:bg-blue-500/15 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:scale-[1.02]">
          <p className="text-2xl font-bold text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">{currentJob.results.fromMemoryItems}</p>
          <p className="text-xs text-muted-foreground">{t('translatorProPage.fromMemory')}</p>
        </div>
        <div className="group p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center transition-all duration-300 hover:bg-purple-500/15 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:scale-[1.02]">
          <p className="text-2xl font-bold text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">{currentJob.results.averageQualityScore}%</p>
          <p className="text-xs text-muted-foreground">{t('translatorProPage.quality')}</p>
        </div>
        <div className="group p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center transition-all duration-300 hover:bg-amber-500/15 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-[1.02]">
          <p className="text-2xl font-bold text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">${currentJob.results.estimatedCost.toFixed(4)}</p>
          <p className="text-xs text-muted-foreground">{t('translatorProPage.cost')}</p>
        </div>
      </div>

      {/* Files */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{t('translatorProPage.translatedFiles')}</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onSaveAllFiles}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Save all (with backup)
            </Button>
            <Button variant="outline" size="sm" onClick={onDownloadAll}>
              <Download className="mr-2 h-4 w-4" />
              Download all
            </Button>
            <Button variant="default" size="sm" onClick={onExportPatch} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              <Package className="mr-2 h-4 w-4" />
              Esporta Patch
            </Button>
          </div>
        </div>

        {Array.from(translatedFiles.entries()).map(([filename, content]) => (
          <div key={filename} className="group flex items-center gap-3 p-3 rounded-lg border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:bg-card hover:border-green-500/30 hover:shadow-[0_0_15px_rgba(34,197,94,0.1)]">
            <div className="p-2 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
              <FileCode className="h-5 w-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm group-hover:text-green-400 transition-colors">{targetLanguage}_{filename}</p>
              <p className="text-xs text-muted-foreground">
                {(content.length / 1024).toFixed(1)} KB
              </p>
            </div>
            <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" onClick={() => onOpenInEditor(filename)} title="Apri nell'Editor" className="hover:bg-blue-500/20 hover:text-blue-400">
                <FileText className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onSaveFile(filename)} title="Salva con backup" className="hover:bg-green-500/20 hover:text-green-400">
                <CheckCircle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDownloadFile(filename)} title="Scarica" className="hover:bg-purple-500/20 hover:text-purple-400">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Per-Row Translation Detail with Quality Badges */}
      {translatedItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              Dettaglio traduzioni ({translatedItems.length})
            </h3>
            <Badge variant="outline" className="text-2xs">
              {translatedItems.filter(i => i.fromMemory).length} da memoria
            </Badge>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_90px_80px] gap-2 px-3 py-2 bg-muted/30 text-2xs font-semibold text-muted-foreground uppercase">
              <span>{t('translatorProPage.original')}</span>
              <span>{t('translatorProPage.translation')}</span>
              <span>{t('translatorProPage.tipo')}</span>
              <span className="text-right">{t('translatorProPage.qualità')}</span>
            </div>
            <ScrollArea className="max-h-[400px]">
              <div className="divide-y divide-border/50">
                {translatedItems.slice(0, 200).map((item, idx) => {
                  const classification = classifyContent(item.sourceText);
                  const qualityScore = calculateQualityScore(item.sourceText, item.translatedText, targetLanguage);
                  return (
                    <div key={item.id || idx} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_90px_80px] gap-2 px-3 py-2 items-center hover:bg-muted/20 text-xs">
                      <span className="truncate text-muted-foreground" title={item.sourceText}>
                        {item.sourceText}
                      </span>
                      <span className={cn("truncate", item.fromMemory ? "text-blue-400" : "")} title={item.translatedText}>
                        {item.fromMemory && <Database className="inline h-3 w-3 mr-1 opacity-60" />}
                        {item.translatedText}
                      </span>
                      <ContentTypeBadge type={classification.type} size="sm" />
                      <div className="flex justify-end">
                        <QualityScoreBadge score={qualityScore.overall} size="sm" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            {translatedItems.length > 200 && (
              <div className="px-3 py-2 text-center text-2xs text-muted-foreground bg-muted/20 border-t">
                Mostrate 200 di {translatedItems.length} righe
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quality Issues */}
      {currentJob.results.qualityIssues.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <h3 className="font-medium flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Problemi di qualità ({currentJob.results.qualityIssues.length})
          </h3>
          <ScrollArea className="h-32">
            {currentJob.results.qualityIssues.slice(0, 10).map((issue, i) => (
              <div key={i} className="text-sm mb-2">
                <p className="font-mono text-xs truncate">&quot;{issue.sourceText}&quot;</p>
                <p className="text-amber-600 text-xs">{issue.issues.join(', ')}</p>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center pt-4">
        <Button variant="outline" onClick={onNewTranslation}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Nuova traduzione
        </Button>

        {/* ONE-CLICK APPLY - The Magic Button */}
        <Button
          size="lg"
          className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-green-500/25 transition-all"
          onClick={onApplyToGame}
          disabled={isApplying || translatedFiles.size === 0}
        >
          {isApplying ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {applyStatus === 'finding' && 'Cerco game...'}
              {applyStatus === 'checking' && 'Verifico...'}
              {applyStatus === 'installing' && 'Installo patcher...'}
              {applyStatus === 'applying' && 'Applico...'}
            </>
          ) : applyStatus === 'done' ? (
            <>
              <CheckCircle className="h-5 w-5" />
              Applicato!
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5" />
              Applica al game
            </>
          )}
        </Button>

        {/* PLAY BUTTON */}
        {selectedGame?.id?.startsWith('steam_') && (
          <a
            href={`steam://rungameid/${selectedGame.id.replace('steam_', '')}`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-medium rounded-md bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-blue-500/25 transition-all text-white"
          >
            <Play className="h-5 w-5" />
            Gioca
          </a>
        )}
      </div>
    </div>
  );
}
