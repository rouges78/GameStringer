'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Square, Scan, Monitor, ArrowRight, Loader2, RefreshCw, Settings2, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { invoke } from '@/lib/tauri-api';
import { toast } from 'sonner';
import { useOcrHotkey } from '@/hooks/use-global-hotkeys';
import { useTranslation } from '@/lib/i18n';

interface DetectedText {
  text: string;
  translated: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface OcrConfig {
  language: string;
  target_language: string;
  capture_interval_ms: number;
  min_confidence: number;
  region: { x: number; y: number; width: number; height: number } | null;
  target_window: number | null;
}

const translationCache = new Map<string, string>();
const pendingTranslations = new Set<string>();

interface WindowInfo {
  hwnd: number;
  title: string;
  class_name: string;
}

const SOURCE_LANGUAGES = [
  { code: 'ja', name: 'Giapponese', flag: '🇯🇵' },
  { code: 'en', name: 'Inglese', flag: '🇬🇧' },
  { code: 'zh-Hans', name: 'Cinese', flag: '🇨🇳' },
  { code: 'ko', name: 'Coreano', flag: '🇰🇷' },
];

const TARGET_LANGUAGES = [
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'en', name: 'Inglese', flag: '🇬🇧' },
  { code: 'de', name: 'Tedesco', flag: '🇩🇪' },
  { code: 'fr', name: 'Francese', flag: '🇫🇷' },
  { code: 'es', name: 'Spagnolo', flag: '🇪🇸' },
];

export default function OcrTranslatorPage() {
  const { t } = useTranslation();
  const [isRunning, setIsRunning] = useState(false);
  const [detectedTexts, setDetectedTexts] = useState<DetectedText[]>([]);
  const [config, setConfig] = useState<OcrConfig>({
    language: 'ja',
    target_language: 'it',
    capture_interval_ms: 500,
    min_confidence: 0.5,
    region: null,
    target_window: null,
  });
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [lastTranslationTime, setLastTranslationTime] = useState(0);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const handleHotkeyCapture = useCallback(async () => {
    if (!isRunning) {
      toggleOcr();
    }
  }, [isRunning]);
  
  useOcrHotkey(handleHotkeyCapture);

  useEffect(() => {
    invoke<boolean>('is_ocr_running').then(setIsRunning).catch(() => {});
    loadWindows();
  }, []);

  const loadWindows = async () => {
    try {
      const wins = await invoke<WindowInfo[]>('list_capture_windows');
      setWindows(wins);
    } catch {}
  };

  const translateWithAi = async (text: string): Promise<string | null> => {
    if (translationCache.has(text)) return translationCache.get(text) || null;
    if (pendingTranslations.has(text)) return null;
    
    // Throttling: max 1 richiesta ogni 500ms
    const now = Date.now();
    if (now - lastTranslationTime < 500) {
      return null;
    }
    setLastTranslationTime(now);
    
    pendingTranslations.add(text);
    console.log('[OCR] Traduzione con provider:', geminiApiKey ? 'gemini' : 'libre (gratuito)');
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          sourceLanguage: config.language,
          targetLanguage: config.target_language,
          provider: geminiApiKey ? 'gemini' : 'libre',
          context: 'game_ui',
          apiKey: geminiApiKey || undefined
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.translatedText) {
          translationCache.set(text, data.translatedText);
          setTranslationError(null);
          return data.translatedText;
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[OCR] error risposta API:', response.status, errorData);
        const errorMsg = errorData.error || errorData.message || `error API: ${response.status}`;
        setTranslationError(errorMsg);
      }
    } catch (e) {
      console.error('[OCR] error traduzione:', e);
      setTranslationError(`Error: ${e}`);
    } finally {
      pendingTranslations.delete(text);
    }
    return null;
  };

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(async () => {
      try {
        const texts = await invoke<DetectedText[]>('get_detected_texts');
        
        const untranslated = texts.filter(t => !t.translated && t.text.length > 2);
        if (untranslated.length > 0) {
          setIsTranslating(true);
          const toTranslate = untranslated.slice(0, 3);
          await Promise.all(toTranslate.map(async (t) => {
            const translated = await translateWithAi(t.text);
            if (translated) t.translated = translated;
          }));
          setIsTranslating(false);
        }
        
        texts.forEach(t => {
          if (!t.translated && translationCache.has(t.text)) {
            t.translated = translationCache.get(t.text) || null;
          }
        });
        
        setDetectedTexts(texts);
      } catch {}
    }, 300);
    return () => clearInterval(interval);
  }, [isRunning, config.language, config.target_language, geminiApiKey]);

  const toggleOcr = async () => {
    try {
      if (isRunning) {
        await invoke('stop_ocr_translator');
        setIsRunning(false);
        setDetectedTexts([]);
        toast.info(t('ocrTranslator.stopCapture'));
      } else {
        await invoke('start_ocr_translator', { config });
        setIsRunning(true);
        toast.success(t('ocrTranslator.startCapture'));
      }
    } catch (e) {
      toast.error(`Error: ${e}`);
    }
  };

  const srcLang = SOURCE_LANGUAGES.find(l => l.code === config.language);
  const tgtLang = TARGET_LANGUAGES.find(l => l.code === config.target_language);
  const selectedWindow = windows.find(w => w.hwnd === config.target_window);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-3 animate-fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 p-3">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Scan className={`h-6 w-6 text-white ${isRunning ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                OCR Translator
              </h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('ocrTranslator.subtitle')}
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            {isRunning && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/30 border border-green-400/30">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm font-medium text-white">{t('ocrTranslator.active')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Setup Card - Semplificato */}
      <Card className="border border-dashed border-muted-foreground/20">
        <CardContent className="p-4 space-y-4">
          {/* Step 1: Lingue */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs font-bold shadow-md">1</span>
              {t('ocrTranslator.chooseLanguages')}
            </div>
            <div className="flex items-center gap-2 pl-8">
              <select 
                className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm hover:border-blue-500/50 transition-colors"
                value={config.language}
                onChange={(e) => setConfig({...config, language: e.target.value})}
                disabled={isRunning}
              >
                {SOURCE_LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                ))}
              </select>
              <div className="p-1.5 rounded-full bg-blue-500/10"><ArrowRight className="h-4 w-4 text-blue-400" /></div>
              <select 
                className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm hover:border-blue-500/50 transition-colors"
                value={config.target_language}
                onChange={(e) => setConfig({...config, target_language: e.target.value})}
                disabled={isRunning}
              >
                {TARGET_LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 2: Finestra */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs font-bold shadow-md">2</span>
                {t('ocrTranslator.selectGameWindow')}
              </div>
              <Button variant="ghost" size="sm" onClick={loadWindows} disabled={isRunning}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="pl-8 space-y-2">
              <select 
                className="w-full h-9 px-3 rounded-lg border bg-background text-sm hover:border-blue-500/50 transition-colors"
                value={config.target_window ?? ''}
                onChange={(e) => setConfig({...config, target_window: e.target.value ? Number(e.target.value) : null})}
                disabled={isRunning}
              >
                <option value="">🖥️ {t('ocrTranslator.fullScreen')}</option>
                {windows.map((w, i) => (
                  <option key={`${w.hwnd}-${i}`} value={w.hwnd}>
                    🎮 {w.title.length > 50 ? w.title.slice(0, 50) + '...' : w.title}
                  </option>
                ))}
              </select>
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                <span className="text-sm mt-0.5">⚠️</span>
                <div>
                  <span className="font-medium">{t('ocrTranslator.fullscreenWarning')}:</span> {t('ocrTranslator.fullscreenWarningDesc')}
                </div>
              </div>
            </div>
          </div>

          {/* Opzioni avanzate (collassabili) */}
          <div className="pl-8">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-400 transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {t('ocrTranslator.advancedOptions')}
              {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            
            {showAdvanced && (
              <div className="mt-3 p-4 rounded-lg bg-muted/30 space-y-4">
                {/* Gemini API Key */}
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">
                    {t('ocrTranslator.geminiApiKey')} 
                    <a href="https://aistudio.google.com/apikey" target="_blank" className="text-blue-400 hover:underline ml-1">{t('ocrTranslator.getForFree')}</a>
                  </label>
                  <input 
                    type="password"
                    placeholder="AIza..."
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border bg-background text-sm"
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span>{t('ocrTranslator.scanInterval')}</span>
                    <span className="font-mono">{config.capture_interval_ms}ms</span>
                  </div>
                  <input 
                    type="range" min="200" max="2000" step="100"
                    value={config.capture_interval_ms}
                    onChange={(e) => setConfig({...config, capture_interval_ms: Number(e.target.value)})}
                    disabled={isRunning}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span>{t('ocrTranslator.minConfidenceLabel')}</span>
                    <span className="font-mono">{Math.round(config.min_confidence * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="30" max="90" step="5"
                    value={config.min_confidence * 100}
                    onChange={(e) => setConfig({...config, min_confidence: Number(e.target.value) / 100})}
                    disabled={isRunning}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Avvia */}
          <div>
            <Button 
              onClick={toggleOcr}
              size="default"
              className={`w-full h-11 text-sm font-medium shadow-lg transition-all ${isRunning ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-red-500/25' : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-500/25'}`}
            >
              {isRunning ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  {t('ocrTranslator.stopCapture')}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  {t('ocrTranslator.startTranslation')}
                </>
              )}
            </Button>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">
                {t('ocrTranslator.shortcut')}: <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Ctrl+Shift+T</kbd>
              </span>
              <Button 
                onClick={async () => {
                  try {
                    await invoke('toggle_ocr_overlay', { show: !overlayOpen });
                    setOverlayOpen(!overlayOpen);
                    toast.success(overlayOpen ? t('ocrTranslator.overlayClosed') : t('ocrTranslator.overlayOpened'));
                  } catch (e) {
                    toast.error(`error overlay: ${e}`);
                  }
                }}
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-blue-400 hover:bg-blue-500/10"
                disabled={!isRunning}
              >
                <Layers className="h-3 w-3 mr-1" />
                {t('ocrTranslator.overlay')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* results */}
      {(isRunning || detectedTexts.length > 0) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-blue-400" />
                <span className="font-medium">{t('ocrTranslator.detectedTexts')}</span>
                {isTranslating && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">{detectedTexts.length} {t('ocrTranslator.detected')}</span>
                <span className="text-green-500">{detectedTexts.filter(tx => tx.translated).length} {t('ocrTranslator.translated')}</span>
              </div>
            </div>
            
            {translationError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                {translationError}
              </div>
            )}
            
            <ScrollArea className="h-[300px]">
              {detectedTexts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                  <Scan className="h-10 w-10 mb-3 animate-pulse opacity-30" />
                  <p className="text-sm">{t('ocrTranslator.waitingForText')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {detectedTexts.map((text, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-card/50 hover:bg-muted/30 transition-colors">
                      <p className="text-sm text-muted-foreground">{text.text}</p>
                      {text.translated && (
                        <p className="text-sm text-green-400 mt-1 flex items-center gap-1">
                          <ArrowRight className="h-3 w-3" />
                          {text.translated}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <p className="text-center text-[10px] text-muted-foreground">
        💡 {t('ocrTranslator.footerInfo')}
      </p>
    </div>
  );
}



