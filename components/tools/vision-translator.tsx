'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Eye,
  Camera,
  Loader2,
  Copy,
  CheckCircle2,
  Upload,
  Sparkles,
  AlertTriangle,
  Monitor,
  X,
  Zap,
  Brain
} from 'lucide-react';
import { visionTranslate, getAvailableVisionModels, captureGameScreenshot, type VisionTranslateResult } from '@/lib/vision-translate';
import { useTranslation } from '@/lib/i18n';

const TARGET_LANGUAGES = [
  { code: 'italiano', label: '🇮🇹 Italiano' },
  { code: 'english', label: '🇬🇧 English' },
  { code: 'spanish', label: '🇪🇸 Español' },
  { code: 'french', label: '🇫🇷 Français' },
  { code: 'german', label: '🇩🇪 Deutsch' },
  { code: 'portuguese', label: '🇧🇷 Português' },
  { code: 'japanese', label: '🇯🇵 日本語' },
  { code: 'chinese', label: '🇨🇳 中文' },
  { code: 'korean', label: '🇰🇷 한국어' },
  { code: 'russian', label: '🇷🇺 Русский' },
  { code: 'arabic', label: '🇸🇦 العربية' },
];

const VISION_PROVIDERS = [
  { id: 'ollama' as const, label: 'Ollama (Locale)', icon: '🦙', description: 'LLaVA, Llama 3.2 Vision — Gratis, locale' },
  { id: 'gemini' as const, label: 'Gemini', icon: '✨', description: 'Gemini 2.0 Flash — Free tier' },
  { id: 'openai' as const, label: 'OpenAI', icon: '🤖', description: 'GPT-4o — A pagamento' },
];

export function VisionTranslator() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [targetLang, setTargetLang] = useState('italiano');
  const [provider, setProvider] = useState<'ollama' | 'gemini' | 'openai'>('ollama');
  const [model, setModel] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [result, setResult] = useState<VisionTranslateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [contextLines, setContextLines] = useState<string[]>([]);
  const [contextInput, setContextInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carica modelli Vision disponibili
  useEffect(() => {
    getAvailableVisionModels().then(models => {
      setAvailableModels(models);
      if (models.length > 0 && !model) setModel(models[0]);
    });
  }, []);

  // Cattura screenshot dalla finestra del gioco
  const handleCaptureScreen = useCallback(async () => {
    try {
      const base64 = await captureGameScreenshot();
      if (base64) {
        setScreenshotBase64(base64);
        setScreenshotPreview(`data:image/png;base64,${base64}`);
      } else {
        setError('Cattura schermo non disponibile. Carica un\'immagine manualmente.');
      }
    } catch {
      setError('Cattura schermo fallita. Carica un\'immagine manualmente.');
    }
  }, []);

  // Upload immagine manuale
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setScreenshotPreview(dataUrl);
      setScreenshotBase64(dataUrl.replace(/^data:image\/[^;]+;base64,/, ''));
    };
    reader.readAsDataURL(file);
  }, []);

  // Traduci con Vision
  const handleTranslate = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await visionTranslate({
        text: text.trim(),
        targetLanguage: targetLang,
        screenshotBase64: screenshotBase64 || undefined,
        context: contextLines,
        model: provider === 'ollama' ? (model || 'llava:13b') : undefined,
        provider,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [text, targetLang, screenshotBase64, contextLines, model, provider]);

  const addContext = () => {
    if (contextInput.trim()) {
      setContextLines(prev => [...prev, contextInput.trim()]);
      setContextInput('');
    }
  };

  const copyResult = () => {
    if (result?.translated) {
      navigator.clipboard.writeText(result.translated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-fuchsia-500/20">
          <Eye className="h-5 w-5 text-fuchsia-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            Vision LLM Translator
            <Badge className="bg-fuchsia-500/20 text-fuchsia-300 text-micro">NEW</Badge>
          </h2>
          <p className="text-xs text-slate-400">{t('visionTranslatorComp.liaVedeLoSchermoDelGiocoETradu')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Input */}
        <div className="space-y-3">
          {/* Provider selection */}
          <Card className="border-slate-700/30 bg-slate-950/40">
            <CardContent className="p-3">
              <label className="text-2xs text-slate-500 mb-1.5 block font-medium">{t('visionTranslatorComp.providerVision')}</label>
              <div className="grid grid-cols-3 gap-1.5">
                {VISION_PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setProvider(p.id)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      provider === p.id
                        ? 'border-fuchsia-500/50 bg-fuchsia-500/10'
                        : 'border-slate-700/30 hover:border-slate-600/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{p.icon}</span>
                      <span className="text-2xs font-medium text-slate-300">{p.label}</span>
                    </div>
                    <p className="text-2xs text-slate-500 mt-0.5">{p.description}</p>
                  </button>
                ))}
              </div>

              {provider === 'ollama' && availableModels.length > 0 && (
                <div className="mt-2">
                  <label className="text-micro text-slate-500 mb-1 block">{t('visionTranslatorComp.modelloVision')}</label>
                  <select
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    className="w-full h-7 text-xs bg-slate-900/50 border border-slate-700/30 rounded-md px-2 text-slate-300"
                  >
                    {availableModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
              {provider === 'ollama' && availableModels.length === 0 && (
                <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                  <p className="text-2xs text-amber-300">
                    Nessun modello Vision trovato su Ollama. Installa uno con: <code className="bg-amber-500/20 px-1 rounded">ollama pull llava:13b</code>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Screenshot */}
          <Card className="border-slate-700/30 bg-slate-950/40">
            <CardContent className="p-3">
              <label className="text-2xs text-slate-500 mb-1.5 block font-medium">{t('visionTranslatorComp.screenshotDelGiocoOpzionaleMaP')}</label>
              
              {screenshotPreview ? (
                <div className="relative group">
                  <img
                    src={screenshotPreview}
                    alt="Game screenshot"
                    className="w-full h-32 object-cover rounded-lg border border-fuchsia-500/20"
                  />
                  <div className="absolute top-1 right-1 flex gap-1">
                    <Badge className="bg-fuchsia-500/80 text-white text-2xs">
                      <Eye className="h-2.5 w-2.5 mr-0.5" /> Vision attivo
                    </Badge>
                    <button
                      onClick={() => { setScreenshotBase64(null); setScreenshotPreview(null); }}
                      className="p-1 rounded bg-red-500/80 hover:bg-red-500 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs border-fuchsia-500/20 hover:bg-fuchsia-500/10"
                    onClick={handleCaptureScreen}
                  >
                    <Camera className="h-3 w-3 mr-1" /> Cattura Schermo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs border-slate-700/30"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3 w-3 mr-1" /> Carica Immagine
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Text input */}
          <Card className="border-slate-700/30 bg-slate-950/40">
            <CardContent className="p-3">
              <label className="text-2xs text-slate-500 mb-1.5 block font-medium">{t('visionTranslatorComp.testoDaTradurre')}</label>
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder='es. "Open the chest to find the legendary sword"'
                className="min-h-[80px] text-sm bg-slate-900/50 border-slate-700/30 resize-none"
              />

              <div className="flex items-center gap-2 mt-2">
                <label className="text-2xs text-slate-500">{t('visionTranslatorComp.linguaTarget')}</label>
                <select
                  value={targetLang}
                  onChange={e => setTargetLang(e.target.value)}
                  className="h-7 text-xs bg-slate-900/50 border border-slate-700/30 rounded-md px-2 text-slate-300"
                >
                  {TARGET_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Context */}
          <Card className="border-slate-700/30 bg-slate-950/40">
            <CardContent className="p-3">
              <label className="text-2xs text-slate-500 mb-1.5 block font-medium">{t('visionTranslatorComp.contestoDialoghiOpzionale')}</label>
              <div className="flex gap-1.5">
                <Input
                  value={contextInput}
                  onChange={e => setContextInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addContext()}
                  placeholder="Aggiungi frase precedente per contesto..."
                  className="h-7 text-xs bg-slate-900/50 border-slate-700/30"
                />
                <Button size="xs" className="px-2 text-xs" onClick={addContext} disabled={!contextInput.trim()}>+</Button>
              </div>
              {contextLines.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {contextLines.map((line, i) => (
                    <div key={i} className="flex items-center gap-1 text-2xs text-slate-400">
                      <span className="text-slate-600">{i + 1}.</span>
                      <span className="flex-1 truncate">&quot;{line}&quot;</span>
                      <button onClick={() => setContextLines(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-2.5 w-2.5 text-slate-600 hover:text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Translate button */}
          <Button
            onClick={handleTranslate}
            disabled={loading || !text.trim()}
            className="w-full h-10 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-semibold"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Traduzione con Vision in corso...</>
            ) : (
              <><Eye className="h-4 w-4 mr-2" /> Traduci con Vision LLM</>
            )}
          </Button>
        </div>

        {/* Right: Result */}
        <div className="space-y-3">
          {error && (
            <Card className="border-red-500/20 bg-red-950/20">
              <CardContent className="p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-red-300 font-medium">{t('visionTranslatorComp.errore')}</p>
                  <p className="text-2xs text-red-400/70 mt-0.5">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {result ? (
            <>
              {/* Translation result */}
              <Card className="border-fuchsia-500/20 bg-fuchsia-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-fuchsia-400" />
                      <span className="text-sm font-semibold text-fuchsia-300">{t('visionTranslatorComp.traduzioneVision')}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={copyResult}
                    >
                      {copied ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <p className="text-base text-white font-medium leading-relaxed">
                    {result.translated}
                  </p>
                </CardContent>
              </Card>

              {/* Metadata */}
              <Card className="border-slate-700/30 bg-slate-950/40">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-slate-500">{t('visionTranslatorComp.confidenza')}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-20 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            result.confidence > 0.85 ? 'bg-emerald-500' : result.confidence > 0.6 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${result.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-2xs text-slate-400">{Math.round(result.confidence * 100)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-slate-500">{t('visionTranslatorComp.contestoVisivo')}</span>
                    <Badge variant="outline" className={`text-micro ${
                      screenshotBase64 ? 'border-fuchsia-500/20 text-fuchsia-300' : 'border-slate-600 text-slate-400'
                    }`}>
                      <Eye className="h-2.5 w-2.5 mr-0.5" />
                      {result.visualContext}
                    </Badge>
                  </div>
                  {result.disambiguation && (
                    <div className="flex items-center justify-between">
                      <span className="text-2xs text-slate-500">{t('visionTranslatorComp.disambiguazione')}</span>
                      <span className="text-2xs text-fuchsia-400">{result.disambiguation}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Comparison */}
              <Card className="border-slate-700/30 bg-slate-950/40">
                <CardContent className="p-3">
                  <label className="text-2xs text-slate-500 mb-1.5 block font-medium">{t('visionTranslatorComp.confronto')}</label>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="text-micro text-slate-600 w-14 flex-shrink-0 pt-0.5">{t('visionTranslatorComp.originale')}</span>
                      <span className="text-xs text-slate-400">{text}</span>
                    </div>
                    <div className="h-px bg-slate-700/30" />
                    <div className="flex items-start gap-2">
                      <span className="text-micro text-fuchsia-500 w-14 flex-shrink-0 pt-0.5">{t('visionTranslatorComp.vision')}</span>
                      <span className="text-xs text-fuchsia-300 font-medium">{result.translated}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            /* Empty state */
            <Card className="border-slate-700/20 bg-slate-950/20">
              <CardContent className="p-8 text-center">
                <Eye className="h-12 w-12 text-fuchsia-400/15 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-slate-400 mb-1">{t('visionTranslatorComp.liaVedeIlTuoGioco')}</h3>
                <p className="text-2xs text-slate-500 max-w-xs mx-auto">
                  Carica uno screenshot e inserisci il testo. L&apos;IA userà il contesto visivo per tradurre con precisione —
                  niente più errori di genere, ambiguità o allucinazioni.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center max-w-sm mx-auto">
                  <div className="p-2 rounded-lg bg-slate-900/30">
                    <Brain className="h-4 w-4 text-fuchsia-400/40 mx-auto mb-1" />
                    <span className="text-2xs text-slate-500">{t('visionTranslatorComp.disambigua')}<br/>parole</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/30">
                    <Monitor className="h-4 w-4 text-fuchsia-400/40 mx-auto mb-1" />
                    <span className="text-2xs text-slate-500">{t('visionTranslatorComp.rileva')}<br/>genere</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/30">
                    <Zap className="h-4 w-4 text-fuchsia-400/40 mx-auto mb-1" />
                    <span className="text-2xs text-slate-500">{t('visionTranslatorComp.tono')}<br/>coerente</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default VisionTranslator;
