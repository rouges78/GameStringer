'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Brain, Download, Trash2, Database, Cpu, CheckCircle, XCircle, Clock, Loader2, FileJson } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  generateDatasetFromCorrections,
  getDatasets,
  getDatasetExamples,
  deleteDataset,
  getModels,
  deleteModel,
  checkOllamaAvailability,
  downloadDataset,
  type FineTuningDataset,
  type FineTuningModel,
} from '@/lib/ai/fine-tuning';
import { getCorrections } from '@/lib/ai/adaptive-mt';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { useDefaultTargetLang } from '@/lib/translation/use-default-target-lang';

export function FineTuningManager({ gameId }: { gameId?: string }) {
  const { t, language } = useTranslation();
  const [datasets, setDatasets] = useState<FineTuningDataset[]>([]);
  const [models, setModels] = useState<FineTuningModel[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; models: string[] }>({ available: false, models: [] });
  const [isGenerating, setIsGenerating] = useState(false);
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('en');
  useDefaultTargetLang(setTargetLang);
  const [approvedOnly, setApprovedOnly] = useState(true);
  const [exportFormat, setExportFormat] = useState<'openai' | 'ollama' | 'alpaca' | 'chatml'>('openai');
  // In Impostazioni il componente è montato senza gameId: senza questo selettore
  // il bottone "Genera" restava disabilitato per sempre (bug pannello Fine-Tuning).
  const [selectedGameId, setSelectedGameId] = useState('');
  const [gamesWithCorrections, setGamesWithCorrections] = useState<Array<{ id: string; count: number }>>([]);

  const effectiveGameId = gameId || selectedGameId;

  const reload = useCallback(() => {
    setDatasets(getDatasets(gameId));
    setModels(getModels(gameId));
    if (!gameId) {
      const counts = new Map<string, number>();
      for (const c of getCorrections()) {
        if (!c.gameId) continue; // correzioni senza gioco: non selezionabili qui
        counts.set(c.gameId, (counts.get(c.gameId) || 0) + 1);
      }
      setGamesWithCorrections([...counts.entries()]
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count));
    }
  }, [gameId]);

  useEffect(() => {
    reload();
    checkOllamaAvailability().then(setOllamaStatus);
  }, [reload]);

  const handleGenerate = async () => {
    if (!effectiveGameId) return;
    setIsGenerating(true);
    try {
      const available = getCorrections({
        gameId: effectiveGameId,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        ...(approvedOnly ? { approved: true } : {}),
      });
      if (available.length === 0) {
        toast.error(t('fineTuningManager.noCorrectionsFound'));
        return;
      }
      const { dataset } = generateDatasetFromCorrections(effectiveGameId, sourceLang, targetLang, { approvedOnly });
      toast.success(`${t('fineTuningManager.datasetCreated')}: ${dataset.exampleCount} ${t('fineTuningManager.totalExamples')}`);
      reload();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (dataset: FineTuningDataset) => {
    const examples = getDatasetExamples(dataset.id);
    if (examples.length === 0) return;
    downloadDataset(examples, dataset.name, exportFormat);
  };

  const handleDelete = (datasetId: string) => {
    deleteDataset(datasetId);
    reload();
  };

  const handleDeleteModel = (modelId: string) => {
    deleteModel(modelId);
    reload();
  };

  const totalExamples = datasets.reduce((sum, d) => sum + d.exampleCount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2 text-base">
          <Brain className="h-5 w-5" />
          {t('fineTuningManager.title')}</CardTitle>
        <CardDescription>
          {t('fineTuningManager.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ollama Status */}
        <div className="flex items-center gap-3 p-3 rounded-lg border">
          <Cpu className="h-5 w-5" />
          <div className="flex-1">
            <div className="text-sm font-medium">Ollama</div>
            <div className="text-xs text-muted-foreground">
              {ollamaStatus.available
                ? `${ollamaStatus.models.length} ${t('fineTuningManager.modelsAvailable')}`
                : t('fineTuningManager.ollamaUnavailable')
              }
            </div>
          </div>
          <Badge variant={ollamaStatus.available ? 'default' : 'destructive'} className="text-xs">
            {ollamaStatus.available ? t('offlineIndicatorComp.online') : t('offlineIndicatorComp.offline')}
          </Badge>
        </div>

        <Separator />

        {/* Generate Dataset */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Database className="h-4 w-4" />
            {t('fineTuningManager.generateDataset')}</h3>

          {/* Selettore gioco: solo quando il componente è montato senza gameId (Impostazioni) */}
          {!gameId && (
            gamesWithCorrections.length > 0 ? (
              <div className="space-y-1">
                <Label className="text-xs">{t('fineTuningManager.selectGame')}</Label>
                <Select value={selectedGameId} onValueChange={setSelectedGameId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder={t('fineTuningManager.selectGamePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {gamesWithCorrections.map(g => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.id} ({g.count} {t('fineTuningManager.correctionsUnit')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('fineTuningManager.noGamesWithCorrections')}
              </p>
            )
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('fineTuningManager.fromLang')}</Label>
              <Input value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('fineTuningManager.toLang')}</Label>
              <Input value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('fineTuningManager.exportFormat')}</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as typeof exportFormat)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI JSONL</SelectItem>
                  <SelectItem value="ollama">Ollama JSONL</SelectItem>
                  <SelectItem value="alpaca">Alpaca JSON</SelectItem>
                  <SelectItem value="chatml">ChatML TXT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={approvedOnly} onCheckedChange={setApprovedOnly} />
              <Label className="text-xs">{t('fineTuningManager.onlyApproved')}</Label>
            </div>
            <Button size="sm" onClick={handleGenerate} disabled={!effectiveGameId || isGenerating}>
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Database className="h-3.5 w-3.5 mr-1.5" />}
              {t('fineTuningManager.generate')}</Button>
          </div>
        </div>

        <Separator />

        {/* Datasets List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <FileJson className="h-4 w-4" />
            {t('fineTuningManager.datasetLabel')} ({datasets.length}) — {totalExamples}  {t('fineTuningManager.totalExamples')}</h3>

          {datasets.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <Database className="h-6 w-6 mx-auto mb-1 opacity-30" />
              {t('fineTuningManager.noDataset')}</div>
          )}

          {datasets.map(ds => (
            <div key={ds.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="text-sm font-medium">{ds.name}</div>
                <div className="text-xs text-muted-foreground">
                  {ds.exampleCount}  {t('fineTuningManager.examplesUnit')} {ds.sourceLanguage}→{ds.targetLanguage}
                  {ds.approvedOnly && ` • ${t('fineTuningManager.approvedOnlyBadge')}`}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(ds.createdAt).toLocaleString(language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleDownload(ds)}>
                  <Download className="h-3 w-3 mr-1" />
                  {t('fineTuningManager.export')}</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => handleDelete(ds.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Models List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Cpu className="h-4 w-4" />
            {t('fineTuningManager.fineTunedModels')} ({models.length})
          </h3>

          {models.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <Brain className="h-6 w-6 mx-auto mb-1 opacity-30" />
              {t('fineTuningManager.noModels')}</div>
          )}

          {models.map(model => (
            <div key={model.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                {model.status === 'completed' && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                {model.status === 'training' && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
                {model.status === 'pending' && <Clock className="h-4 w-4 text-amber-400" />}
                {model.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                <div>
                  <div className="text-sm font-medium">{model.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('fineTuningManager.baseLabel')} {model.baseModel} • v{model.version}
                    {model.metrics?.loss != null && ` • Loss: ${model.metrics.loss.toFixed(4)}`}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => handleDeleteModel(model.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

