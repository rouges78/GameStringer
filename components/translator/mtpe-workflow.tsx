'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  Check, 
  X, 
  Edit3, 
  SkipForward, 
  Save, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { 
  calculateQualityScore, 
  getQualityCategory, 
  needsHumanReview,
  generateImprovementSuggestions,
  QualityScore 
} from '@/lib/translation-quality';
import { translationMemory } from '@/lib/translation-memory';
import { useTranslation } from '@/lib/i18n';

interface TranslationItem {
  id: string;
  source: string;
  machineTranslation: string;
  editedTranslation?: string;
  status: 'pending' | 'approved' | 'edited' | 'rejected' | 'skipped';
  qualityScore?: QualityScore;
  reviewedAt?: string;
  reviewerNotes?: string;
}

interface MTPEWorkflowProps {
  translations: Array<{ source: string; translation: string }>;
  sourceLang?: string;
  targetLang?: string;
  gameId?: string;
  context?: string;
  onComplete?: (results: TranslationItem[]) => void;
}

export function MTPEWorkflow({
  translations,
  sourceLang = 'en',
  targetLang = 'it',
  gameId,
  context,
  onComplete
}: MTPEWorkflowProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<TranslationItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editText, setEditText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    edited: 0,
    rejected: 0,
    skipped: 0,
    avgQuality: 0
  });

  // Inizializza items con quality score
  useEffect(() => {
    const initialItems: TranslationItem[] = translations.map((t, i) => {
      const score = calculateQualityScore(t.source, t.translation, targetLang);
      return {
        id: `mtpe_${i}_${Date.now()}`,
        source: t.source,
        machineTranslation: t.translation,
        status: 'pending',
        qualityScore: score
      };
    });
    
    setItems(initialItems);
    updateStats(initialItems);
    
    if (initialItems.length > 0) {
      setEditText(initialItems[0].machineTranslation);
    }
  }, [translations, targetLang]);

  const updateStats = (itemsList: TranslationItem[]) => {
    const approved = itemsList.filter(i => i.status === 'approved').length;
    const edited = itemsList.filter(i => i.status === 'edited').length;
    const rejected = itemsList.filter(i => i.status === 'rejected').length;
    const skipped = itemsList.filter(i => i.status === 'skipped').length;
    
    const scores = itemsList
      .filter(i => i.qualityScore)
      .map(i => i.qualityScore!.overall);
    const avgQuality = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    
    setStats({
      total: itemsList.length,
      approved,
      edited,
      rejected,
      skipped,
      avgQuality
    });
  };

  const currentItem = items[currentIndex];
  const progress = items.length > 0 
    ? Math.round(((stats.approved + stats.edited + stats.rejected + stats.skipped) / items.length) * 100)
    : 0;

  const handleApprove = async () => {
    if (!currentItem) return;
    
    const updated = [...items];
    updated[currentIndex] = {
      ...currentItem,
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewerNotes: notes || undefined
    };
    
    // Salva in Translation Memory come verificata
    await translationMemory.add(currentItem.source, currentItem.machineTranslation, {
      context,
      gameId,
      provider: 'mtpe_approved',
      confidence: 0.95,
      verified: true
    });
    
    setItems(updated);
    updateStats(updated);
    goToNext(updated);
  };

  const handleEdit = async () => {
    if (!currentItem || !editText.trim()) return;
    
    const updated = [...items];
    updated[currentIndex] = {
      ...currentItem,
      status: 'edited',
      editedTranslation: editText,
      qualityScore: calculateQualityScore(currentItem.source, editText, targetLang),
      reviewedAt: new Date().toISOString(),
      reviewerNotes: notes || undefined
    };
    
    // Salva versione corretta in TM
    await translationMemory.add(currentItem.source, editText, {
      context,
      gameId,
      provider: 'mtpe_edited',
      confidence: 1.0,
      verified: true
    });
    
    setItems(updated);
    updateStats(updated);
    setIsEditing(false);
    goToNext(updated);
  };

  const handleReject = () => {
    if (!currentItem) return;
    
    const updated = [...items];
    updated[currentIndex] = {
      ...currentItem,
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewerNotes: notes || 'Traduzione rifiutata'
    };
    
    setItems(updated);
    updateStats(updated);
    goToNext(updated);
  };

  const handleSkip = () => {
    if (!currentItem) return;
    
    const updated = [...items];
    updated[currentIndex] = {
      ...currentItem,
      status: 'skipped'
    };
    
    setItems(updated);
    updateStats(updated);
    goToNext(updated);
  };

  const goToNext = (updatedItems?: TranslationItem[]) => {
    const list = updatedItems || items;
    
    // Trova prossimo pending
    let nextIndex = -1;
    for (let i = currentIndex + 1; i < list.length; i++) {
      if (list[i].status === 'pending') {
        nextIndex = i;
        break;
      }
    }
    
    // Se non trovato dopo, cerca dall'inizio
    if (nextIndex === -1) {
      for (let i = 0; i < currentIndex; i++) {
        if (list[i].status === 'pending') {
          nextIndex = i;
          break;
        }
      }
    }
    
    if (nextIndex !== -1) {
      setCurrentIndex(nextIndex);
      setEditText(list[nextIndex].machineTranslation);
      setNotes('');
      setIsEditing(false);
    } else {
      // Tutti completati
      onComplete?.(list);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setEditText(items[currentIndex - 1].editedTranslation || items[currentIndex - 1].machineTranslation);
      setNotes(items[currentIndex - 1].reviewerNotes || '');
      setIsEditing(false);
    }
  };

  const goToNextManual = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setEditText(items[currentIndex + 1].editedTranslation || items[currentIndex + 1].machineTranslation);
      setNotes(items[currentIndex + 1].reviewerNotes || '');
      setIsEditing(false);
    }
  };

  if (items.length === 0) {
    return (
      <Card className="bg-slate-900/50 border-slate-700">
        <CardContent className="p-6 text-center text-gray-400">
          Nessuna traduzione da revisionare
        </CardContent>
      </Card>
    );
  }

  const qualityInfo = currentItem?.qualityScore 
    ? getQualityCategory(currentItem.qualityScore.overall)
    : null;
  
  const suggestions = currentItem?.qualityScore 
    ? generateImprovementSuggestions(currentItem.qualityScore)
    : [];

  const needsReview = currentItem?.qualityScore 
    ? needsHumanReview(currentItem.qualityScore)
    : true;

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium">{t('mtpeWorkflowComp.progressoMtpe')}</span>
            </div>
            <span className="text-sm text-gray-400">
              {stats.approved + stats.edited + stats.rejected + stats.skipped} / {stats.total}
            </span>
          </div>
          
          <Progress value={progress} className="h-2 mb-3" />
          
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-gray-400">Approvate: {stats.approved}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-gray-400">Modificate: {stats.edited}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-400">Rifiutate: {stats.rejected}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-gray-400">Saltate: {stats.skipped}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Item */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={goToPrev}
                disabled={currentIndex === 0}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-base">
                {currentIndex + 1} / {items.length}
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={goToNextManual}
                disabled={currentIndex === items.length - 1}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              {currentItem?.status !== 'pending' && (
                <Badge 
                  className={
                    currentItem?.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    currentItem?.status === 'edited' ? 'bg-blue-500/20 text-blue-400' :
                    currentItem?.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }
                >
                  {currentItem?.status === 'approved' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {currentItem?.status}
                </Badge>
              )}
              
              {qualityInfo && (
                <Badge className={`${qualityInfo.color} bg-opacity-20`}>
                  {qualityInfo.label} ({currentItem?.qualityScore?.overall}%)
                </Badge>
              )}
              
              {needsReview && currentItem?.status === 'pending' && (
                <Badge className="bg-orange-500/20 text-orange-400">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Richiede revisione
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Source Text */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">
              Testo originale ({sourceLang.toUpperCase()})
            </label>
            <div className="mt-1 p-3 bg-slate-800/50 rounded-lg text-sm">
              {currentItem?.source}
            </div>
          </div>

          {/* Machine Translation */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <Sparkles className="h-3 w-3" />
              Traduzione AI ({targetLang.toUpperCase()})
            </label>
            {isEditing ? (
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="mt-1 min-h-[100px] bg-slate-800/50 border-slate-600"
                placeholder="Modifica la traduzione..."
              />
            ) : (
              <div 
                className="mt-1 p-3 bg-slate-800/50 rounded-lg text-sm cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={() => setIsEditing(true)}
              >
                {currentItem?.editedTranslation || currentItem?.machineTranslation}
                <span className="text-xs text-gray-500 ml-2">(clicca per modificare)</span>
              </div>
            )}
          </div>

          {/* Quality Details */}
          {currentItem?.qualityScore && (
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2 bg-slate-800/30 rounded text-center">
                <div className="text-lg font-bold text-green-400">{currentItem.qualityScore.fluency}</div>
                <div className="text-[10px] text-gray-500">{t('mtpeWorkflowComp.fluidità')}</div>
              </div>
              <div className="p-2 bg-slate-800/30 rounded text-center">
                <div className="text-lg font-bold text-blue-400">{currentItem.qualityScore.accuracy}</div>
                <div className="text-[10px] text-gray-500">{t('mtpeWorkflowComp.accuratezza')}</div>
              </div>
              <div className="p-2 bg-slate-800/30 rounded text-center">
                <div className="text-lg font-bold text-purple-400">{currentItem.qualityScore.consistency}</div>
                <div className="text-[10px] text-gray-500">{t('mtpeWorkflowComp.coerenza')}</div>
              </div>
              <div className="p-2 bg-slate-800/30 rounded text-center">
                <div className="text-lg font-bold text-amber-400">{currentItem.qualityScore.style}</div>
                <div className="text-[10px] text-gray-500">{t('mtpeWorkflowComp.stile')}</div>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="text-xs text-amber-400 font-medium mb-1">💡 Suggerimenti</div>
              <ul className="text-xs text-amber-300/80 space-y-0.5">
                {suggestions.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">
              Note revisore (opzionale)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 h-16 bg-slate-800/50 border-slate-600 text-xs"
              placeholder="Aggiungi note sulla revisione..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-slate-700">
            <Button
              variant="outline"
              className="flex-1 bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
              onClick={handleApprove}
              disabled={currentItem?.status !== 'pending'}
            >
              <Check className="h-4 w-4 mr-1" />
              Approva
            </Button>
            
            {isEditing ? (
              <Button
                variant="outline"
                className="flex-1 bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                onClick={handleEdit}
              >
                <Save className="h-4 w-4 mr-1" />
                Salva modifiche
              </Button>
            ) : (
              <Button
                variant="outline"
                className="flex-1 bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                onClick={() => setIsEditing(true)}
                disabled={currentItem?.status !== 'pending'}
              >
                <Edit3 className="h-4 w-4 mr-1" />
                Modifica
              </Button>
            )}
            
            <Button
              variant="outline"
              className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
              onClick={handleReject}
              disabled={currentItem?.status !== 'pending'}
            >
              <X className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              className="text-gray-400 hover:text-gray-300"
              onClick={handleSkip}
              disabled={currentItem?.status !== 'pending'}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Completion */}
      {progress === 100 && (
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <div className="text-lg font-medium text-green-400">{t('mtpeWorkflowComp.revisioneCompletata')}</div>
            <div className="text-sm text-gray-400 mt-1">
              {stats.approved} approvate, {stats.edited} modificate, {stats.rejected} rifiutate
            </div>
            <Button 
              className="mt-3 bg-green-600 hover:bg-green-700"
              onClick={() => onComplete?.(items)}
            >
              Esporta risultati
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default MTPEWorkflow;
