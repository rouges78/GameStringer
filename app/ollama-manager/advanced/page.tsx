'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Wand2,
  ArrowLeft,
  Save,
  RotateCcw,
  SlidersHorizontal,
  Check,
  Target,
  Scale,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import {
  OLLAMA_PRESETS,
  OLLAMA_OPTION_BOUNDS,
  loadStoredOllamaOptions,
  loadOllamaPreset,
  saveOllamaOptions,
  resetOllamaOptions,
  type OllamaInferenceOptions,
  type OllamaPresetId,
} from '@/lib/ai/ollama-options';

// Parametri numerici pilotabili nella modalità esperto (l'id tecnico è mostrato come codice, non tradotto)
const SLIDER_PARAMS = ['temperature', 'top_p', 'top_k', 'repeat_penalty', 'num_ctx'] as const;
type SliderParam = (typeof SLIDER_PARAMS)[number];

// Classi Tailwind statiche (l'interpolazione dinamica verrebbe eliminata dal purge)
const PRESET_META: {
  id: Exclude<OllamaPresetId, 'custom'>;
  icon: typeof Target;
  cardActive: string;
  iconColor: string;
}[] = [
  { id: 'fedele', icon: Target, cardActive: 'border-emerald-500 ring-1 ring-emerald-500/40', iconColor: 'text-emerald-500' },
  { id: 'bilanciato', icon: Scale, cardActive: 'border-sky-500 ring-1 ring-sky-500/40', iconColor: 'text-sky-500' },
  { id: 'creativo', icon: Sparkles, cardActive: 'border-violet-500 ring-1 ring-violet-500/40', iconColor: 'text-violet-500' },
];

function fmt(key: SliderParam, v: number): string {
  return OLLAMA_OPTION_BOUNDS[key].step < 1 ? v.toFixed(2) : String(v);
}

export default function OllamaAdvancedPage() {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<OllamaPresetId>('fedele');
  const [options, setOptions] = useState<OllamaInferenceOptions>(OLLAMA_PRESETS.fedele);
  const [seedEnabled, setSeedEnabled] = useState(false);
  const [showExpert, setShowExpert] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Carica la configurazione salvata al mount
  useEffect(() => {
    const stored = loadStoredOllamaOptions();
    const storedPreset = loadOllamaPreset();
    if (stored) {
      setOptions({ ...OLLAMA_PRESETS.fedele, ...stored });
      setPreset(storedPreset);
      if (typeof stored.seed === 'number') setSeedEnabled(true);
      if (storedPreset === 'custom') setShowExpert(true);
    }
  }, []);

  const selectPreset = (id: Exclude<OllamaPresetId, 'custom'>) => {
    setPreset(id);
    setOptions((prev) => ({ ...OLLAMA_PRESETS[id], seed: seedEnabled ? prev.seed : undefined }));
  };

  const editParam = (key: SliderParam, value: number) => {
    setPreset('custom');
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSeed = (on: boolean) => {
    setSeedEnabled(on);
    setPreset('custom');
    setOptions((prev) => ({ ...prev, seed: on ? (typeof prev.seed === 'number' ? prev.seed : 42) : undefined }));
  };

  const editSeed = (value: number) => {
    setPreset('custom');
    setOptions((prev) => ({ ...prev, seed: value }));
  };

  const handleSave = () => {
    const toSave: Partial<OllamaInferenceOptions> = { ...options };
    if (!seedEnabled) delete toSave.seed;
    saveOllamaOptions(preset, toSave);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleReset = () => {
    resetOllamaOptions();
    setPreset('fedele');
    setOptions(OLLAMA_PRESETS.fedele);
    setSeedEnabled(false);
    setShowExpert(false);
  };

  return (
    <div className="p-4 pt-2 space-y-3 overflow-auto overflow-x-hidden">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 p-3">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Wand2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                {t('ollamaAdvancedPage.title')}
              </h1>
              <p className="text-white/70 text-xs">{t('ollamaAdvancedPage.subtitle')}</p>
            </div>
          </div>
          <Link href="/ollama-manager">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-white/80 hover:text-white hover:bg-white/10 border border-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t('ollamaAdvancedPage.back')}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Intro */}
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          {t('ollamaAdvancedPage.intro')}
        </CardContent>
      </Card>

      {/* Preset */}
      <div>
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          {t('ollamaAdvancedPage.presetsLabel')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRESET_META.map(({ id, icon: Icon, cardActive, iconColor }) => {
            const active = preset === id;
            return (
              <Card
                key={id}
                onClick={() => selectPreset(id)}
                className={cn(
                  'cursor-pointer transition border-2',
                  active ? cardActive : 'border-transparent hover:border-muted-foreground/30',
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <Icon className={cn('h-5 w-5', iconColor)} />
                    {active && <Check className={cn('h-4 w-4', iconColor)} />}
                  </div>
                  <div className="font-semibold text-sm">{t(`ollamaAdvancedPage.preset.${id}.name`)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t(`ollamaAdvancedPage.preset.${id}.desc`)}</div>
                  <div className="text-[11px] text-muted-foreground/70 mt-2 font-mono">
                    {`temp ${OLLAMA_PRESETS[id].temperature} · ctx ${OLLAMA_PRESETS[id].num_ctx}`}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Expert toggle */}
      <button
        type="button"
        onClick={() => setShowExpert((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform', showExpert && 'rotate-180')} />
        {t('ollamaAdvancedPage.expertToggle')}
        {preset === 'custom' && (
          <Badge variant="secondary" className="text-[10px]">
            {t('ollamaAdvancedPage.customBadge')}
          </Badge>
        )}
      </button>

      {/* Expert sliders */}
      {showExpert && (
        <Card>
          <CardContent className="p-4 space-y-5">
            {SLIDER_PARAMS.map((key) => {
              const b = OLLAMA_OPTION_BOUNDS[key];
              const value = options[key];
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{key}</code>
                      {t(`ollamaAdvancedPage.param.${key}.label`)}
                    </label>
                    <span className="text-sm font-mono tabular-nums">{fmt(key, value)}</span>
                  </div>
                  <input
                    type="range"
                    min={b.min}
                    max={b.max}
                    step={b.step}
                    value={value}
                    onChange={(e) => editParam(key, Number(e.target.value))}
                    className="w-full accent-fuchsia-500"
                    aria-label={t(`ollamaAdvancedPage.param.${key}.label`)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t(`ollamaAdvancedPage.param.${key}.help`)}</p>
                </div>
              );
            })}

            {/* Seed */}
            <div className="pt-1 border-t">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer mt-3">
                <input
                  type="checkbox"
                  checked={seedEnabled}
                  onChange={(e) => toggleSeed(e.target.checked)}
                  className="accent-fuchsia-500"
                />
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{'seed'}</code>
                {t('ollamaAdvancedPage.param.seed.label')}
              </label>
              <p className="text-xs text-muted-foreground mt-1">{t('ollamaAdvancedPage.param.seed.help')}</p>
              {seedEnabled && (
                <input
                  type="number"
                  min={OLLAMA_OPTION_BOUNDS.seed.min}
                  max={OLLAMA_OPTION_BOUNDS.seed.max}
                  value={typeof options.seed === 'number' ? options.seed : 42}
                  onChange={(e) => editSeed(Number(e.target.value))}
                  className="mt-2 w-40 rounded-md border bg-background px-2 py-1 text-sm"
                  aria-label={t('ollamaAdvancedPage.param.seed.label')}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button onClick={handleSave} className="gap-1.5">
          {savedFlash ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {savedFlash ? t('ollamaAdvancedPage.saved') : t('ollamaAdvancedPage.save')}
        </Button>
        <Button onClick={handleReset} variant="outline" className="gap-1.5">
          <RotateCcw className="h-4 w-4" />
          {t('ollamaAdvancedPage.reset')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t('ollamaAdvancedPage.appliesTo')}</p>
    </div>
  );
}
