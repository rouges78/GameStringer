'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { translateWithFallback } from '@/lib/ai-translate-direct';
import { Progress } from '@/components/ui/progress';
import { 
  Play, Pause, Square, Settings, Eye, EyeOff, 
  Monitor, Maximize2, Languages, Zap, RefreshCw,
  Volume2, Copy, Download, Trash2, Target
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';

interface DetectedText {
  id: string;
  original: string;
  translated: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  timestamp: number;
}

interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function LiveOcrOverlay() {
  const { t } = useTranslation();
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [detectedTexts, setDetectedTexts] = useState<DetectedText[]>([]);
  const [captureMode, setCaptureMode] = useState<'fullscreen' | 'region' | 'window'>('fullscreen');
  const [captureRegion, setCaptureRegion] = useState<CaptureRegion | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('it');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [captureInterval, setCaptureInterval] = useState(1000); // ms
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.9);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [fps, setFps] = useState(0);
  const [totalDetected, setTotalDetected] = useState(0);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCaptureTime = useRef<number>(0);
  const frameCount = useRef<number>(0);

  // Calcola FPS
  useEffect(() => {
    const fpsInterval = setInterval(() => {
      setFps(frameCount.current);
      frameCount.current = 0;
    }, 1000);
    return () => clearInterval(fpsInterval);
  }, []);

  // Cattura schermo e OCR
  const captureAndOcr = useCallback(async () => {
    if (isPaused) return;
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      
      // Cattura schermo
      const captureResult = await invoke<{
        width: number;
        height: number;
        data: number[];
      }>('capture_screen_region', {
        region: captureMode === 'region' && captureRegion ? captureRegion : null
      });

      // OCR
      const ocrResult = await invoke<Array<{
        text: string;
        x: number;
        y: number;
        width: number;
        height: number;
        confidence: number;
      }>>('ocr_recognize', {
        imageData: captureResult.data,
        width: captureResult.width,
        height: captureResult.height,
        language: sourceLanguage === 'auto' ? 'en' : sourceLanguage
      });

      if (ocrResult.length === 0) return;

      // Traduci testi rilevati
      let translatedTexts: DetectedText[] = [];
      
      if (autoTranslate) {
        const textsToTranslate = ocrResult.map(t => t.text).filter(t => t.trim().length > 0);
        
        try {
          if (textsToTranslate.length > 0) {
            const result = await translateWithFallback({
              texts: textsToTranslate,
              targetLanguage,
              sourceLanguage: sourceLanguage === 'auto' ? undefined : sourceLanguage,
              context: 'game screen OCR'
            });
            
            if (result.success) {
              let tIdx = 0;
              translatedTexts = ocrResult.map((t, i) => {
                const isTranslatable = t.text.trim().length > 0;
                const translated = isTranslatable && tIdx < result.translations.length ? result.translations[tIdx++] : t.text;
                return {
                  id: `${Date.now()}-${i}`,
                  original: t.text,
                  translated,
                  x: t.x, y: t.y, width: t.width, height: t.height,
                  confidence: t.confidence,
                  timestamp: Date.now()
                };
              });
            }
          }
          
          // Se nessuna traduzione ottenuta, usa originale
          if (translatedTexts.length === 0) {
            translatedTexts = ocrResult.map((t, i) => ({
              id: `${Date.now()}-${i}`, original: t.text, translated: t.text,
              x: t.x, y: t.y, width: t.width, height: t.height,
              confidence: t.confidence, timestamp: Date.now()
            }));
          }
        } catch {
          translatedTexts = ocrResult.map((t, i) => ({
            id: `${Date.now()}-${i}`, original: t.text, translated: t.text,
            x: t.x, y: t.y, width: t.width, height: t.height,
            confidence: t.confidence, timestamp: Date.now()
          }));
        }
      } else {
        translatedTexts = ocrResult.map((t, i) => ({
          id: `${Date.now()}-${i}`,
          original: t.text,
          translated: t.text,
          x: t.x,
          y: t.y,
          width: t.width,
          height: t.height,
          confidence: t.confidence,
          timestamp: Date.now()
        }));
      }

      setDetectedTexts(translatedTexts);
      setTotalDetected(prev => prev + translatedTexts.length);
      frameCount.current++;

      // Invia all'overlay se attivo
      if (showOverlay) {
        const { emit } = await import('@tauri-apps/api/event');
        await emit('ocr-translations', translatedTexts);
      }

    } catch (error) {
      console.error('OCR capture error:', error);
    }
  }, [isPaused, captureMode, captureRegion, sourceLanguage, targetLanguage, autoTranslate, showOverlay]);

  // Start/Stop capture loop
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(captureAndOcr, captureInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused, captureInterval, captureAndOcr]);

  const handleStart = async () => {
    setIsRunning(true);
    setIsPaused(false);
    toast.success('🎮 Live OCR avviato!');
    
    // Apri finestra overlay
    if (showOverlay) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_ocr_overlay');
      } catch (e) {
        console.warn('Could not open overlay window:', e);
      }
    }
  };

  const handleStop = async () => {
    setIsRunning(false);
    setIsPaused(false);
    setDetectedTexts([]);
    toast.info('Live OCR fermato');
    
    // Chiudi overlay
    try {
      const { emit } = await import('@tauri-apps/api/event');
      await emit('overlay-visibility', false);
    } catch {}
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const selectRegion = async () => {
    setIsSelectingRegion(true);
    toast.info('Seleziona una regione dello schermo...');
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const region = await invoke<CaptureRegion>('select_screen_region');
      setCaptureRegion(region);
      setCaptureMode('region');
      toast.success(`Regione selezionata: ${region.width}x${region.height}`);
    } catch (error) {
      toast.error('Selezione regione annullata');
    } finally {
      setIsSelectingRegion(false);
    }
  };

  const copyAllTranslations = () => {
    const text = detectedTexts.map(t => `${t.original}\n→ ${t.translated}`).join('\n\n');
    navigator.clipboard.writeText(text);
    toast.success('Traduzioni copiate!');
  };

  const exportTranslations = () => {
    const data = detectedTexts.map(t => ({
      original: t.original,
      translated: t.translated,
      position: { x: t.x, y: t.y },
      confidence: t.confidence
    }));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-translations-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Esportazione completata!');
  };

  return (
    <div className="space-y-4">
      {/* Hero Header - stile ai-translator */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 animate-shimmer p-3 shadow-xl shadow-blue-900/50">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Monitor className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                Live OCR Overlay
              </h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                Traduzione real-time dello schermo di gioco
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isRunning && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm font-bold text-white">LIVE • {fps} FPS</span>
              </div>
            )}
            
            {!isRunning ? (
              <Button onClick={handleStart} size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 shadow-lg">
                <Play className="h-4 w-4 mr-2" />
                Avvia
              </Button>
            ) : (
              <>
                <Button onClick={handlePause} size="sm" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
                <Button onClick={handleStop} size="sm" className="bg-red-500/80 hover:bg-red-500 text-white border-0">
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Impostazioni */}
        <Card className="col-span-1 bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Impostazioni
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Modalità cattura */}
            <div className="space-y-2">
              <Label className="text-xs">Modalità cattura</Label>
              <Select value={captureMode} onValueChange={(v: unknown) => setCaptureMode(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fullscreen">🖥️ Schermo intero</SelectItem>
                  <SelectItem value="region">📐 Regione</SelectItem>
                  <SelectItem value="window">🪟 Finestra</SelectItem>
                </SelectContent>
              </Select>
              
              {captureMode === 'region' && (
                <Button 
                  onClick={selectRegion} 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-xs"
                  disabled={isSelectingRegion}
                >
                  <Target className="h-3 w-3 mr-2" />
                  {captureRegion ? `${captureRegion.width}x${captureRegion.height}` : 'Seleziona regione'}
                </Button>
              )}
            </div>

            {/* Lingue */}
            <div className="space-y-2">
              <Label className="text-xs">Lingua origine</Label>
              <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">🔍 Auto-detect</SelectItem>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                  <SelectItem value="ja">🇯🇵 日本語</SelectItem>
                  <SelectItem value="zh">🇨🇳 中文</SelectItem>
                  <SelectItem value="ko">🇰🇷 한국어</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Lingua destinazione</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                  <SelectItem value="es">🇪🇸 Español</SelectItem>
                  <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Intervallo cattura */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs">Intervallo cattura</Label>
                <span className="text-xs text-gray-400">{captureInterval}ms</span>
              </div>
              <Slider
                value={[captureInterval]}
                onValueChange={([v]) => setCaptureInterval(v)}
                min={250}
                max={3000}
                step={250}
                className="py-2"
              />
            </div>

            {/* Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Traduzione automatica</Label>
                <Switch checked={autoTranslate} onCheckedChange={setAutoTranslate} />
              </div>
              
              <div className="flex items-center justify-between">
                <Label className="text-xs">Mostra overlay</Label>
                <Switch checked={showOverlay} onCheckedChange={setShowOverlay} />
              </div>
            </div>

            {/* Opacità overlay */}
            {showOverlay && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Opacità overlay</Label>
                  <span className="text-xs text-gray-400">{Math.round(overlayOpacity * 100)}%</span>
                </div>
                <Slider
                  value={[overlayOpacity]}
                  onValueChange={([v]) => setOverlayOpacity(v)}
                  min={0.3}
                  max={1}
                  step={0.1}
                  className="py-2"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Testi rilevati */}
        <Card className="col-span-2 bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Languages className="h-4 w-4" />
                Testi rilevati ({detectedTexts.length})
              </CardTitle>
              <div className="flex gap-1">
                <Button onClick={copyAllTranslations} variant="ghost" size="sm" disabled={detectedTexts.length === 0}>
                  <Copy className="h-3 w-3" />
                </Button>
                <Button onClick={exportTranslations} variant="ghost" size="sm" disabled={detectedTexts.length === 0}>
                  <Download className="h-3 w-3" />
                </Button>
                <Button onClick={() => setDetectedTexts([])} variant="ghost" size="sm" disabled={detectedTexts.length === 0}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {detectedTexts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Eye className="h-12 w-12 mb-4 opacity-30" />
                  <p className="text-sm">Nessun testo rilevato</p>
                  <p className="text-xs opacity-70">Avvia la cattura per vedere i testi</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {detectedTexts.map((text) => (
                    <div 
                      key={text.id}
                      className="p-3 bg-muted/30 rounded-lg border border-border/50 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 truncate">{text.original}</p>
                          <p className="text-sm text-white font-medium mt-1">{text.translated}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {Math.round(text.confidence * 100)}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
                        <span>📍 {text.x}, {text.y}</span>
                        <span>📐 {text.width}x{text.height}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="bg-card/50 border-border/50 p-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-400">{fps}</div>
            <div className="text-[10px] text-gray-400">FPS</div>
          </div>
        </Card>
        <Card className="bg-card/50 border-border/50 p-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{detectedTexts.length}</div>
            <div className="text-[10px] text-gray-400">Testi attuali</div>
          </div>
        </Card>
        <Card className="bg-card/50 border-border/50 p-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{totalDetected}</div>
            <div className="text-[10px] text-gray-400">Totali sessione</div>
          </div>
        </Card>
        <Card className="bg-card/50 border-border/50 p-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-400">{captureInterval}ms</div>
            <div className="text-[10px] text-gray-400">Intervallo</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
