'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Square, Scan, Monitor, ArrowRight, Loader2, RefreshCw, Settings2, ChevronDown, ChevronUp, Layers, Image as ImageIcon, Upload, Clipboard, X, Copy } from 'lucide-react';
import { invoke } from '@/lib/tauri-api';
import { toast } from 'sonner';
import { useOcrHotkey } from '@/hooks/use-global-hotkeys';
import { useTranslation } from '@/lib/i18n';
import { VlmTranslator } from '@/lib/vlm-translator';
import { translateSingleSmart } from '@/lib/ai-translate-direct';
import { rawPixelsToBase64 } from '@/lib/image-utils';
import { clientLogger } from '@/lib/client-logger';

interface DetectedText {
  text: string;
  translated?: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
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
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh-Hans', name: '中文', flag: '🇨🇳' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
];

const TARGET_LANGUAGES = [
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '��' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ko', name: '한국어', flag: '��' },
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

  useEffect(() => {
    const saved = localStorage.getItem('gameStringerSettings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.translation?.defaultTargetLang) {
          setConfig(prev => ({ ...prev, target_language: s.translation.defaultTargetLang }));
        }
      } catch {}
    }
  }, []);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [ocrProvider, setOcrProvider] = useState<'libre' | 'ollama' | 'vlm' | 'gemini'>('libre');
  const [lastTranslationTime, setLastTranslationTime] = useState(0);
  const [overlayOpen, setOverlayOpen] = useState(false);
  // Screenshot static mode
  const [mode, setMode] = useState<'live' | 'screenshot'>('live');
  const [screenshotSrc, setScreenshotSrc] = useState<string | null>(null);
  const [screenshotTexts, setScreenshotTexts] = useState<{ original: string; translated: string }[]>([]);
  const [screenshotProcessing, setScreenshotProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleHotkeyCapture = useCallback(async () => {
    if (!isRunning) {
      toggleOcr();
    }
  }, [isRunning]);
  
  useOcrHotkey(handleHotkeyCapture);

  useEffect(() => {
    invoke<boolean>('is_ocr_running').then(setIsRunning).catch(() => {});
    loadWindows();
    // Carica traduzioni salvate all'avvio
    invoke<number>('load_ocr_translations').then(count => {
      if (count > 0) {
        clientLogger.debug(`[OCR] Caricate ${count} traduzioni salvate`);
        toast.success(`Caricate ${count} traduzioni salvate`);
      }
    }).catch(() => {});
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
    clientLogger.debug('[OCR] Traduzione con provider:', ocrProvider);
    try {
      // Per Ollama con deepseek-ocr, usa l'endpoint locale
      if (ocrProvider === 'ollama') {
        const ollamaResponse = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'deepseek-ocr',
            messages: [
              { role: 'system', content: 'You are a translator. Translate the following text accurately. Reply ONLY with the translation.' },
              { role: 'user', content: `Translate from ${config.language} to ${config.target_language}: "${text}"` }
            ],
            stream: false
          })
        });
        if (ollamaResponse.ok) {
          const data = await ollamaResponse.json();
          const translated = data.message?.content?.trim();
          if (translated) {
            translationCache.set(text, translated);
            setTranslationError(null);
            return translated;
          }
        }
        return null;
      }
      
      const result = await translateSingleSmart(
        text,
        config.target_language,
        config.language
      );
      
      if (result?.translated) {
        translationCache.set(text, result.translated);
        setTranslationError(null);
        return result.translated;
      } else {
        setTranslationError('Translation failed — check API key or provider settings');
      }
    } catch (e: unknown) {
      clientLogger.error('[OCR] error traduzione:', e);
      setTranslationError(`Error: ${e}`);
    } finally {
      pendingTranslations.delete(text);
    }
    return null;
  };

  // Loop VLM: Se VLM è attivo, cattura l'immagine dal backend e mandala a Ollama
  useEffect(() => {
    if (!isRunning || ocrProvider !== 'vlm') return;
    
    let isProcessing = false;
    const interval = setInterval(async () => {
      if (isProcessing) return;
      isProcessing = true;
      try {
        // 1. Cattura l'immagine da Rust
        const capture = await invoke<{width: number, height: number, data: number[]}>('capture_screen_region', { region: config.region });
        if (capture && capture.data.length > 0) {
          // 2. Converti i pixel in Base64
          const base64 = rawPixelsToBase64(capture.data, capture.width, capture.height);
          
          setIsTranslating(true);
          // 3. Passa al VLM
          const translated = await VlmTranslator.translateImage({
            imageBase64: base64,
            sourceLanguage: config.language,
            targetLanguage: config.target_language,
            context: 'game_ui'
          });
          
          if (translated) {
            // Sostituisce i testi rilevati con un singolo blocco grande dal VLM
            setDetectedTexts([{
              text: 'Immagine analizzata (VLM)',
              translated: translated,
              confidence: 1.0,
              x: 50,
              y: 50,
              width: capture.width - 100,
              height: capture.height - 100
            }]);
            setTranslationError(null);
          }
        }
      } catch (e: unknown) {
        clientLogger.error('[VLM Loop] Errore:', e);
        setTranslationError(e.message || String(e));
      } finally {
        setIsTranslating(false);
        isProcessing = false;
      }
    }, Math.max(3000, config.capture_interval_ms)); // I VLM sono pesanti, min 3s

    return () => clearInterval(interval);
  }, [isRunning, ocrProvider, config.language, config.target_language, config.region, config.capture_interval_ms]);

  // Ascolto Eventi Nativi Tauri invece del Polling (Risparmio CPU)
  useEffect(() => {
    if (!isRunning || ocrProvider === 'vlm') return;
    
    let unlisten: (() => void) | null = null;
    
    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<DetectedText[]>('ocr_text_detected', async (event) => {
          const texts = event.payload;
          
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
        });
      } catch (e: unknown) {
        clientLogger.warn('[OCR] Impossibile setup event listener Tauri', e);
      }
    };
    
    setupListener();
    
    return () => {
      if (unlisten) unlisten();
    };
  }, [isRunning, ocrProvider, config.language, config.target_language, geminiApiKey]);

  const toggleOcr = async () => {
    try {
      if (isRunning) {
        await invoke('stop_ocr_translator');
        // Salva traduzioni quando si ferma l'OCR
        const saved = await invoke<number>('save_ocr_translations');
        setIsRunning(false);
        setDetectedTexts([]);
        if (saved > 0) {
          toast.success(`Salvate ${saved} nuove traduzioni`);
        } else {
          toast.info(t('ocrTranslator.stopCapture'));
        }
      } else {
        await invoke('start_ocr_translator', { config });
        setIsRunning(true);
        toast.success(t('ocrTranslator.startCapture'));
      }
    } catch (e: unknown) {
      toast.error(`Error: ${e}`);
    }
  };

  // ─── Screenshot Static Mode Handlers ─────────────────────────
  const processScreenshot = useCallback(async (imageDataUrl: string) => {
    setScreenshotSrc(imageDataUrl);
    setScreenshotTexts([]);
    setScreenshotProcessing(true);
    try {
      // Import Tesseract OCR
      const { recognizeText } = await import('@/lib/ocr-service');
      const ocrLangMap: Record<string, unknown> = { ja: 'jpn', en: 'eng', 'zh-Hans': 'chi_sim', ko: 'kor' };
      const ocrLang = ocrLangMap[config.language] || 'eng';
      const ocrResult = await recognizeText(imageDataUrl, ocrLang);
      
      if (!ocrResult.lines || ocrResult.lines.length === 0) {
        toast.error('Nessun testo rilevato nello screenshot');
        setScreenshotProcessing(false);
        return;
      }

      // Filter lines with decent confidence
      const lines = ocrResult.lines
        .filter(l => l.text.trim().length > 1 && l.confidence > 40)
        .map(l => l.text.trim());

      // Translate each line
      const results: { original: string; translated: string }[] = [];
      for (const line of lines) {
        try {
          const tr = await translateSingleSmart(line, config.target_language, config.language);
          results.push({ original: line, translated: tr?.translated || '...' });
        } catch {
          results.push({ original: line, translated: '(errore traduzione)' });
        }
      }
      setScreenshotTexts(results);
      toast.success(`${results.length} righe estratte e tradotte`);
    } catch (e: unknown) {
      toast.error(`OCR errore: ${e}`);
    }
    setScreenshotProcessing(false);
  }, [config.language, config.target_language]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => processScreenshot(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, [processScreenshot]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => processScreenshot(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, [processScreenshot]);

  const handlePaste = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const reader = new FileReader();
          reader.onload = () => processScreenshot(reader.result as string);
          reader.readAsDataURL(blob);
          return;
        }
      }
      toast.error('Nessuna immagine negli appunti');
    } catch {
      toast.error('Impossibile leggere gli appunti — usa il pulsante Upload');
    }
  }, [processScreenshot]);

  const copyAllTranslations = useCallback(() => {
    const text = screenshotTexts.map(t => t.translated).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Traduzioni copiate!');
  }, [screenshotTexts]);

  const _srcLang = SOURCE_LANGUAGES.find(l => l.code === config.language);
  const _tgtLang = TARGET_LANGUAGES.find(l => l.code === config.target_language);
  const _selectedWindow = windows.find(w => w.hwnd === config.target_window);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-3 animate-fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 animate-shimmer p-3 shadow-xl shadow-blue-900/50">
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
              <p className="text-white/70 text-2xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
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

      {/* Mode Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <button onClick={() => setMode('live')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${mode === 'live' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
          <Monitor className="h-4 w-4" />Cattura Live
        </button>
        <button onClick={() => setMode('screenshot')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${mode === 'screenshot' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
          <ImageIcon className="h-4 w-4" />Screenshot
        </button>
      </div>

      {/* Screenshot Static Mode */}
      {mode === 'screenshot' && (
        <div className="space-y-3">
          {/* Language selectors for screenshot mode */}
          <Card className="border border-dashed border-muted-foreground/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs font-bold shadow-md">1</span>
                Lingue
              </div>
              <div className="flex items-center gap-2 pl-8">
                <select className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm" value={config.language} onChange={(e) => setConfig({...config, language: e.target.value})}>
                  {SOURCE_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
                <ArrowRight className="h-4 w-4 text-blue-400" />
                <select className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm" value={config.target_language} onChange={(e) => setConfig({...config, target_language: e.target.value})}>
                  {TARGET_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Drop zone */}
          <div
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-all ${screenshotSrc ? 'border-blue-500/40 bg-blue-900/10' : 'border-slate-600/40 hover:border-blue-500/40 hover:bg-blue-900/5'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
          >
            {screenshotProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                <p className="text-sm text-blue-300">Analisi OCR e traduzione in corso...</p>
              </div>
            ) : screenshotSrc ? (
              <div className="space-y-3">
                <div className="relative inline-block">
                  <img src={screenshotSrc} alt="Screenshot" className="max-h-[300px] rounded-lg border border-slate-700 mx-auto" />
                  <button onClick={() => { setScreenshotSrc(null); setScreenshotTexts([]); }} className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-2xs text-slate-500">Trascina un altro screenshot per sostituire</p>
              </div>
            ) : (
              <div className="space-y-3">
                <ImageIcon className="h-12 w-12 text-slate-500 mx-auto" />
                <p className="text-sm text-slate-300">Trascina uno screenshot qui</p>
                <p className="text-2xs text-slate-500">oppure</p>
                <div className="flex items-center justify-center gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5" />Upload
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handlePaste}>
                    <Clipboard className="h-3.5 w-3.5" />Incolla (Ctrl+V)
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Screenshot results */}
          {screenshotTexts.length > 0 && (
            <Card className="border border-blue-800/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scan className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-white">{screenshotTexts.length} righe estratte</span>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={copyAllTranslations}>
                    <Copy className="h-3 w-3" />Copia tutto
                  </Button>
                </div>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-1.5">
                    {screenshotTexts.map((t, i) => (
                      <div key={i} className="flex gap-3 p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30 hover:bg-slate-800/60 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-2xs text-slate-500 mb-0.5">Originale</p>
                          <p className="text-xs text-slate-300">{t.original}</p>
                        </div>
                        <ArrowRight className="h-3 w-3 text-blue-400 mt-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-2xs text-emerald-500 mb-0.5">Traduzione</p>
                          <p className="text-xs text-emerald-300">{t.translated}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Setup Card - Semplificato (Live mode only) */}
      {mode === 'live' && (<>
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
                {/* Provider Traduzione */}
                <div>
                  <div className="text-xs mb-2 text-muted-foreground">{t('ocrTranslator.aiProvider')}</div>
                  <select 
                    className="w-full h-9 px-2 rounded-lg border bg-background text-sm"
                    value={ocrProvider}
                    onChange={(e) => setOcrProvider(e.target.value as string)}
                    disabled={isRunning}
                  >
                    <option value="libre">� Lingva (Gratis/Veloce)</option>
                    <option value="ollama">🦙 Ollama (deepseek-ocr locale)</option>
                    <option value="vlm">👁️ Ollama VLM (LLaVA/Qwen-VL)</option>
                    <option value="gemini">✨ Gemini (API Key richiesta)</option>
                  </select>
                  {ocrProvider === 'vlm' && (
                    <div className="mt-2 text-2xs text-amber-400 bg-amber-500/10 p-2 rounded">
                      <strong>{t('ocrTranslatorPage.notaVlm')}</strong> L&apos;immagine verrà inviata direttamente a Ollama. Assicurati di aver scaricato `llava`, `qwen2-vl` o `pixtral`. Questa modalità è lenta ma precisissima per il giapponese e lingue complesse.
                    </div>
                  )}
                </div>
                
                {/* Gemini API Key */}
                <form onSubmit={(e) => e.preventDefault()}>
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
                    autoComplete="off"
                  />
                </form>
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
              <span className="text-2xs text-muted-foreground">
                {t('ocrTranslator.shortcut')}: <kbd className="px-1 py-0.5 rounded bg-muted text-2xs">{t('ocrTranslatorPage.ctrlshiftt')}</kbd>
              </span>
              <Button 
                onClick={async () => {
                  try {
                    await invoke('toggle_ocr_overlay', { show: !overlayOpen });
                    setOverlayOpen(!overlayOpen);
                    toast.success(overlayOpen ? t('ocrTranslator.overlayClosed') : t('ocrTranslator.overlayOpened'));
                  } catch (e: unknown) {
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
      </>)}

      {/* Info */}
      <p className="text-center text-2xs text-muted-foreground">
        💡 {t('ocrTranslator.footerInfo')}
      </p>
    </div>
  );
}



