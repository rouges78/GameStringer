'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { GitCompareArrows, Zap, Brain, Clock, Trophy, Info } from 'lucide-react';
import {
  loadComparisonConfig,
  saveComparisonConfig,
  getComparisonConfig,
  hasAvailableProviders,
  type ComparisonConfig,
} from '@/lib/ai-translate-direct';
import { useTranslation } from '@/lib/i18n';

const JUDGE_PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini', free: true },
  { value: 'groq', label: 'Groq (Llama 70B)', free: true },
  { value: 'cerebras', label: 'Cerebras', free: true },
  { value: 'openai', label: 'OpenAI GPT-4o-mini', free: false },
  { value: 'anthropic', label: 'Anthropic Claude', free: false },
  { value: 'deepseek', label: 'DeepSeek', free: false },
  { value: 'mistral', label: 'Mistral AI', free: false },
];

export function MultiLlmComparisonSettings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ComparisonConfig>(getComparisonConfig());
  const [availableCount, setAvailableCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const loaded = loadComparisonConfig();
    setConfig(loaded);
    const { providers } = hasAvailableProviders();
    setAvailableCount(providers.length);
  }, []);

  const updateConfig = (updates: Partial<ComparisonConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    saveComparisonConfig(updates);
  };

  if (!mounted) return null;

  return (
    <Card className="border-purple-500/30 bg-gradient-to-r from-purple-950/20 to-indigo-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCompareArrows className="h-5 w-5 text-purple-400" />
          <span>{t('multiLlmComparisonSettingsComp.multillmComparison')}</span>
          <Badge className="text-2xs bg-purple-600/80 text-white border-0 ml-1">NEW</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Invia la stessa traduzione a più provider in parallelo e scegli automaticamente la migliore.
          Migliora la qualità confrontando i risultati di diversi LLM.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Toggle principale */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">{t('multiLlmComparisonSettingsComp.abilitaMultillmComparison')}</Label>
            <p className="text-[11px] text-muted-foreground">
              {config.enabled
                ? `Attivo — ${config.maxCandidates} provider in parallelo`
                : 'Disattivato — usa fallback sequenziale standard'}
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(enabled) => updateConfig({ enabled })}
          />
        </div>

        {config.enabled && (
          <>
            {/* Info provider disponibili */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 border border-white/5">
              <Info className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">
                <strong className="text-foreground">{availableCount}</strong> provider disponibili nella chain attiva.
                Verranno usati i primi <strong className="text-foreground">{Math.min(config.maxCandidates, availableCount)}</strong>.
              </span>
            </div>

            {/* Numero candidati */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Candidati paralleli: {config.maxCandidates}</Label>
                <div className="flex gap-1">
                  {config.maxCandidates === 2 && <Badge variant="outline" className="text-2xs"><Zap className="h-3 w-3 mr-0.5" />{t('multiLlmComparisonSettingsComp.veloce')}</Badge>}
                  {config.maxCandidates === 3 && <Badge variant="outline" className="text-2xs"><Trophy className="h-3 w-3 mr-0.5" />{t('multiLlmComparisonSettingsComp.bilanciato')}</Badge>}
                  {config.maxCandidates >= 4 && <Badge variant="outline" className="text-2xs"><Brain className="h-3 w-3 mr-0.5" />{t('multiLlmComparisonSettingsComp.preciso')}</Badge>}
                </div>
              </div>
              <Slider
                value={[config.maxCandidates]}
                onValueChange={(v) => updateConfig({ maxCandidates: v[0] })}
                min={2}
                max={6}
                step={1}
                className="w-full [&_[data-slot=range]]:bg-purple-500 [&_[data-slot=thumb]]:bg-purple-500 [&_[data-slot=thumb]]:border-purple-500"
              />
              <p className="text-2xs text-muted-foreground">
                2 = veloce e economico | 3 = consigliato | 4-6 = massima precisione ma più lento
              </p>
            </div>

            {/* Timeout */}
            <div className="space-y-2">
              <Label className="text-sm">Timeout per provider: {(config.timeoutMs / 1000).toFixed(0)}s</Label>
              <Slider
                value={[config.timeoutMs]}
                onValueChange={(v) => updateConfig({ timeoutMs: v[0] })}
                min={5000}
                max={30000}
                step={1000}
                className="w-full [&_[data-slot=range]]:bg-purple-500 [&_[data-slot=thumb]]:bg-purple-500 [&_[data-slot=thumb]]:border-purple-500"
              />
            </div>

            {/* Giudice LLM */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-amber-400" />
                    Giudice LLM
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {config.useLlmJudge
                      ? 'Un LLM valuta e sceglie la traduzione migliore (60% euristico + 40% LLM)'
                      : 'Solo scoring euristico (gratuito, veloce, nessun costo aggiuntivo)'}
                  </p>
                </div>
                <Switch
                  checked={config.useLlmJudge}
                  onCheckedChange={(useLlmJudge) => updateConfig({ useLlmJudge })}
                />
              </div>

              {config.useLlmJudge && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t('multiLlmComparisonSettingsComp.providerGiudice')}</Label>
                  <Select
                    value={config.llmJudgeProvider}
                    onValueChange={(llmJudgeProvider) => updateConfig({ llmJudgeProvider })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JUDGE_PROVIDERS.map(p => (
                        <SelectItem key={p.value} value={p.value} className="text-xs">
                          {p.label} {p.free && <span className="text-green-400 ml-1">(gratuito)</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-2xs text-muted-foreground">
                    Usa un provider con API key configurata. Consigliato: Gemini o Groq (gratuiti).
                  </p>
                </div>
              )}
            </div>

            {/* Riepilogo costi */}
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-950/20 border border-amber-500/20">
              <Clock className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                <p><strong className="text-amber-300">{t('multiLlmComparisonSettingsComp.nota')}</strong> La comparison invia la stessa richiesta a {config.maxCandidates} provider.</p>
                <p>Se usi provider a pagamento, il costo per traduzione sarà ~{config.maxCandidates}x.
                   {config.useLlmJudge && ` Il giudice LLM aggiunge 1 chiamata extra.`}
                </p>
                <p>Con provider gratuiti (Gemini, Groq, Cerebras, MyMemory) il costo resta $0.</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
