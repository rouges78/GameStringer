'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Gamepad2, Monitor, Play, Square, ArrowRight, Loader2, RefreshCw,
  Settings2, ChevronDown, ChevronUp, Scan, Image as ImageIcon,
  Upload, Clipboard, X, Copy, Zap, Clock, Globe, Pause,
} from 'lucide-react';
import { invoke } from '@/lib/tauri-api';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { translateSingleSmart } from '@/lib/ai-translate-direct';
import { rawPixelsToBase64 } from '@/lib/image-utils';
import Link from 'next/link';
import { RETRO_PLATFORMS, type RetroPlatform } from '@/lib/community-hub-service';

interface WindowInfo {
  hwnd: number;
  title: string;
  class_name: string;
}

interface TranslatedLine {
  original: string;
  translated: string;
  timestamp: number;
  confidence: number;
}

interface EmulatorProfile {
  id: string;
  name: string;
  icon: string;
  windowPatterns: string[];
  platform: RetroPlatform;
  ocrHints: string;
}

const EMULATOR_PROFILES: EmulatorProfile[] = [
  { id: 'retroarch', name: 'RetroArch', icon: '🎮', windowPatterns: ['retroarch', 'RetroArch'], platform: 'snes', ocrHints: 'pixel art font, low resolution' },
  { id: 'snes9x', name: 'Snes9X', icon: '🕹️', windowPatterns: ['snes9x', 'Snes9X', 'Snes9x'], platform: 'snes', ocrHints: 'SNES pixel font' },
  { id: 'zsnes', name: 'ZSNES', icon: '🕹️', windowPatterns: ['zsnes', 'ZSNES'], platform: 'snes', ocrHints: 'SNES pixel font' },
  { id: 'mgba', name: 'mGBA', icon: '🟩', windowPatterns: ['mgba', 'mGBA'], platform: 'gba', ocrHints: 'GBA small pixel font' },
  { id: 'vba', name: 'VisualBoyAdvance', icon: '🟩', windowPatterns: ['VisualBoyAdvance', 'VBA'], platform: 'gba', ocrHints: 'GBA pixel font' },
  { id: 'desmume', name: 'DeSmuME', icon: '📱', windowPatterns: ['DeSmuME', 'desmume'], platform: 'nds', ocrHints: 'NDS dual screen, small text' },
  { id: 'melonds', name: 'melonDS', icon: '📱', windowPatterns: ['melonDS', 'melonds'], platform: 'nds', ocrHints: 'NDS dual screen' },
  { id: 'citra', name: 'Citra / Lime3DS', icon: '📱', windowPatterns: ['Citra', 'citra', 'Lime3DS'], platform: '3ds', ocrHints: '3DS dual screen, higher resolution' },
  { id: 'pcsx2', name: 'PCSX2', icon: '🎮', windowPatterns: ['PCSX2', 'pcsx2'], platform: 'ps2', ocrHints: 'PS2 text, variable quality' },
  { id: 'ppsspp', name: 'PPSSPP', icon: '🎮', windowPatterns: ['PPSSPP', 'ppsspp'], platform: 'psp', ocrHints: 'PSP text, medium resolution' },
  { id: 'project64', name: 'Project64', icon: '🎮', windowPatterns: ['Project64', 'project64'], platform: 'n64', ocrHints: 'N64 3D text, low resolution' },
  { id: 'dolphin', name: 'Dolphin', icon: '🐬', windowPatterns: ['Dolphin', 'dolphin'], platform: 'other', ocrHints: 'GameCube/Wii HD text' },
  { id: 'rpcs3', name: 'RPCS3', icon: '🎮', windowPatterns: ['RPCS3', 'rpcs3'], platform: 'other', ocrHints: 'PS3 HD text' },
  { id: 'generic', name: 'Altro emulatore', icon: '🖥️', windowPatterns: [], platform: 'other', ocrHints: 'game text' },
];

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
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
];

export default function EmulatorTranslatorPage() {
  const { t } = useTranslation();
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [selectedWindow, setSelectedWindow] = useState<number | null>(null);
  const [selectedEmulator, setSelectedEmulator] = useState<EmulatorProfile>(EMULATOR_PROFILES[0]);
  const [sourceLang, setSourceLang] = useState('ja');
  const [targetLang, setTargetLang] = useState('it');
  const [captureInterval, setCaptureInterval] = useState(2000);
  const [history, setHistory] = useState<TranslatedLine[]>([]);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [currentTranslation, setCurrentTranslation] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [captureCount, setCaptureCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Screenshot mode
  const [screenshotSrc, setScreenshotSrc] = useState<string | null>(null);
  const [screenshotTexts, setScreenshotTexts] = useState<{ original: string; translated: string }[]>([]);
  const [screenshotProcessing, setScreenshotProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const translationCache = useRef(new Map<string, string>());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastOcrText = useRef('');

  useEffect(() => {
    loadWindows();
    // Load saved settings
    try {
      const saved = localStorage.getItem('gameStringerSettings');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.translation?.defaultTargetLang) setTargetLang(s.translation.defaultTargetLang);
      }
    } catch {}
  }, []);

  const loadWindows = async () => {
    try {
      const wins = await invoke<WindowInfo[]>('list_capture_windows');
      setWindows(wins);
      // Auto-detect emulator from window titles
      for (const win of wins) {
        for (const emu of EMULATOR_PROFILES) {
          if (emu.windowPatterns.some(p => win.title.toLowerCase().includes(p.toLowerCase()))) {
            setSelectedEmulator(emu);
            setSelectedWindow(win.hwnd);
            break;
          }
        }
      }
    } catch {}
  };

  const translateText = useCallback(async (text: string): Promise<string | null> => {
    const clean = text.trim();
    if (!clean || clean.length < 2) return null;
    
    // Check cache
    if (translationCache.current.has(clean)) return translationCache.current.get(clean) || null;

    try {
      const result = await translateSingleSmart(clean, targetLang, sourceLang);
      if (result?.translated) {
        translationCache.current.set(clean, result.translated);
        return result.translated;
      }
    } catch (e) {
      console.warn('[EmuTranslator]', e);
    }
    return null;
  }, [targetLang, sourceLang]);

  const doCapture = useCallback(async () => {
    if (isPaused) return;
    try {
      // Capture screen from the emulator window
      const capture = await invoke<{ width: number; height: number; data: number[] }>('capture_screen_region', {
        region: selectedWindow ? { x: 0, y: 0, width: 0, height: 0 } : null,
      });
      if (!capture || capture.data.length === 0) return;

      setCaptureCount(c => c + 1);

      // Convert to base64 for OCR
      const base64 = rawPixelsToBase64(capture.data, capture.width, capture.height);

      // Use Tesseract OCR
      const { recognizeText } = await import('@/lib/ocr-service');
      const ocrLangMap: Record<string, unknown> = { ja: 'jpn', en: 'eng', 'zh-Hans': 'chi_sim', ko: 'kor' };
      const ocrLang = ocrLangMap[sourceLang] || 'eng';
      const ocrResult = await recognizeText(`data:image/png;base64,${base64}`, ocrLang);

      const lines = (ocrResult.lines || [])
        .filter(l => l.text.trim().length > 2 && l.confidence > 50)
        .map(l => l.text.trim());

      const combinedText = lines.join(' ').trim();
      if (!combinedText || combinedText === lastOcrText.current) return;
      lastOcrText.current = combinedText;

      setCurrentText(combinedText);
      setIsTranslating(true);
      setErrorMsg(null);

      // Translate
      const translated = await translateText(combinedText);
      if (translated) {
        setCurrentTranslation(translated);
        setHistory(prev => [{
          original: combinedText,
          translated,
          timestamp: Date.now(),
          confidence: ocrResult.confidence || 0,
        }, ...prev].slice(0, 100));
      }
    } catch (e: unknown) {
      setErrorMsg(e?.message || String(e));
    } finally {
      setIsTranslating(false);
    }
  }, [selectedWindow, sourceLang, translateText, isPaused]);

  const startCapture = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(true);
    setIsPaused(false);
    setErrorMsg(null);
    // First capture immediately
    doCapture();
    intervalRef.current = setInterval(doCapture, captureInterval);
    toast.success('Cattura emulatore avviata');
  }, [doCapture, captureInterval]);

  const stopCapture = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    toast.info('Cattura fermata');
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused(p => !p);
    toast.info(isPaused ? 'Ripresa cattura' : 'Cattura in pausa');
  }, [isPaused]);

  // Cleanup
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Screenshot static handlers
  const processScreenshot = useCallback(async (imageDataUrl: string) => {
    setScreenshotSrc(imageDataUrl);
    setScreenshotTexts([]);
    setScreenshotProcessing(true);
    try {
      const { recognizeText } = await import('@/lib/ocr-service');
      const ocrLangMap: Record<string, unknown> = { ja: 'jpn', en: 'eng', 'zh-Hans': 'chi_sim', ko: 'kor' };
      const ocrLang = ocrLangMap[sourceLang] || 'eng';
      const ocrResult = await recognizeText(imageDataUrl, ocrLang);
      
      if (!ocrResult.lines || ocrResult.lines.length === 0) {
        toast.error('Nessun testo rilevato nello screenshot');
        setScreenshotProcessing(false);
        return;
      }

      const lines = ocrResult.lines
        .filter(l => l.text.trim().length > 1 && l.confidence > 40)
        .map(l => l.text.trim());

      const results: { original: string; translated: string }[] = [];
      for (const line of lines) {
        try {
          const tr = await translateSingleSmart(line, targetLang, sourceLang);
          results.push({ original: line, translated: tr?.translated || '...' });
        } catch {
          results.push({ original: line, translated: '(errore)' });
        }
      }
      setScreenshotTexts(results);
      toast.success(`${results.length} righe estratte e tradotte`);
    } catch (e) {
      toast.error(`OCR errore: ${e}`);
    }
    setScreenshotProcessing(false);
  }, [sourceLang, targetLang]);

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
      toast.error('Impossibile leggere gli appunti');
    }
  }, [processScreenshot]);

  const [mode, setMode] = useState<'live' | 'screenshot'>('live');

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-3">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-700 via-violet-600 to-fuchsia-600 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg border border-white/10">
              <Gamepad2 className={`h-6 w-6 text-white ${isRunning ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">Emulator Translator</h1>
              <p className="text-white/70 text-2xs">Traduzione in tempo reale per giochi retro via emulatore</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            {isRunning && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/30 border border-green-400/30">
                <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-400' : 'bg-green-400 animate-pulse'}`} />
                <span className="text-sm font-medium text-white">{isPaused ? 'Pausa' : 'Attivo'}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/10">
              <span className="text-sm font-bold text-white">{history.length}</span>
              <span className="text-2xs text-white/70">traduzioni</span>
            </div>
          </div>
        </div>
        <div className="relative flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/20">
          <span className="text-2xs text-white/50 mr-2 self-center">Vedi anche</span>
          <Link href="/ocr-translator"><Button variant="outline" size="sm" className="gap-1 h-6 text-2xs border-white/30 bg-white/10 hover:bg-white/20 text-white">OCR Translator</Button></Link>
          <Link href="/community-hub"><Button variant="outline" size="sm" className="gap-1 h-6 text-2xs border-white/30 bg-white/10 hover:bg-white/20 text-white">Community Hub</Button></Link>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <button onClick={() => setMode('live')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${mode === 'live' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
          <Monitor className="h-4 w-4" />Cattura Live
        </button>
        <button onClick={() => setMode('screenshot')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${mode === 'screenshot' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
          <ImageIcon className="h-4 w-4" />Screenshot
        </button>
      </div>

      {/* ─── Screenshot Mode ─── */}
      {mode === 'screenshot' && (
        <div className="space-y-3">
          <Card className="border border-dashed border-muted-foreground/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white text-xs font-bold shadow-md">1</span>
                Lingue
              </div>
              <div className="flex items-center gap-2 pl-8">
                <select className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm" value={sourceLang} onChange={e => setSourceLang(e.target.value)}>
                  {SOURCE_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
                <ArrowRight className="h-4 w-4 text-purple-400" />
                <select className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm" value={targetLang} onChange={e => setTargetLang(e.target.value)}>
                  {TARGET_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
              </div>
            </CardContent>
          </Card>
          <div
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-all ${screenshotSrc ? 'border-purple-500/40 bg-purple-900/10' : 'border-slate-600/40 hover:border-purple-500/40 hover:bg-purple-900/5'}`}
            onDragOver={e => e.preventDefault()} onDrop={handleFileDrop}
          >
            {screenshotProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
                <p className="text-sm text-purple-300">OCR + traduzione in corso...</p>
              </div>
            ) : screenshotSrc ? (
              <div className="space-y-3">
                <div className="relative inline-block">
                  <img src={screenshotSrc} alt="Screenshot" className="max-h-[300px] rounded-lg border border-slate-700 mx-auto" />
                  <button onClick={() => { setScreenshotSrc(null); setScreenshotTexts([]); }} className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-400"><X className="h-3 w-3" /></button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Gamepad2 className="h-12 w-12 text-slate-500 mx-auto" />
                <p className="text-sm text-slate-300">Trascina uno screenshot dell&apos;emulatore</p>
                <p className="text-2xs text-slate-500">oppure</p>
                <div className="flex items-center justify-center gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fileInputRef.current?.click()}><Upload className="h-3.5 w-3.5" />Upload</Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handlePaste}><Clipboard className="h-3.5 w-3.5" />Incolla</Button>
                </div>
              </div>
            )}
          </div>
          {screenshotTexts.length > 0 && (
            <Card className="border border-purple-800/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scan className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-white">{screenshotTexts.length} righe</span>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { navigator.clipboard.writeText(screenshotTexts.map(t => t.translated).join('\n')); toast.success('Copiato!'); }}>
                    <Copy className="h-3 w-3" />Copia
                  </Button>
                </div>
                <ScrollArea className="max-h-[350px]">
                  <div className="space-y-1.5">
                    {screenshotTexts.map((tx, i) => (
                      <div key={i} className="flex gap-3 p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30">
                        <div className="flex-1 min-w-0"><p className="text-2xs text-slate-500">Originale</p><p className="text-xs text-slate-300">{tx.original}</p></div>
                        <ArrowRight className="h-3 w-3 text-purple-400 mt-4 shrink-0" />
                        <div className="flex-1 min-w-0"><p className="text-2xs text-emerald-500">Traduzione</p><p className="text-xs text-emerald-300">{tx.translated}</p></div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── Live Capture Mode ─── */}
      {mode === 'live' && (<>
        {/* Setup */}
        <Card className="border border-dashed border-muted-foreground/20">
          <CardContent className="p-4 space-y-4">
            {/* Emulator Profile */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white text-xs font-bold shadow-md">1</span>
                Emulatore
              </div>
              <div className="pl-8">
                <select
                  className="w-full h-9 px-3 rounded-lg border bg-background text-sm"
                  value={selectedEmulator.id}
                  onChange={e => setSelectedEmulator(EMULATOR_PROFILES.find(p => p.id === e.target.value) || EMULATOR_PROFILES[0])}
                  disabled={isRunning}
                >
                  {EMULATOR_PROFILES.map(p => (
                    <option key={p.id} value={p.id}>{p.icon} {p.name} ({RETRO_PLATFORMS.find(rp => rp.id === p.platform)?.name || p.platform})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Languages */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white text-xs font-bold shadow-md">2</span>
                Lingue
              </div>
              <div className="flex items-center gap-2 pl-8">
                <select className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm" value={sourceLang} onChange={e => setSourceLang(e.target.value)} disabled={isRunning}>
                  {SOURCE_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
                <ArrowRight className="h-4 w-4 text-purple-400" />
                <select className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm" value={targetLang} onChange={e => setTargetLang(e.target.value)} disabled={isRunning}>
                  {TARGET_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
              </div>
            </div>

            {/* Window */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white text-xs font-bold shadow-md">3</span>
                  Finestra emulatore
                </div>
                <Button variant="ghost" size="sm" onClick={loadWindows} disabled={isRunning}><RefreshCw className="h-4 w-4" /></Button>
              </div>
              <div className="pl-8">
                <select
                  className="w-full h-9 px-3 rounded-lg border bg-background text-sm"
                  value={selectedWindow ?? ''}
                  onChange={e => setSelectedWindow(e.target.value ? Number(e.target.value) : null)}
                  disabled={isRunning}
                >
                  <option value="">🖥️ Schermo intero</option>
                  {windows.map(w => <option key={w.hwnd} value={w.hwnd}>{w.title.slice(0, 60)}</option>)}
                </select>
              </div>
            </div>

            {/* Advanced */}
            <div>
              <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                <Settings2 className="h-3 w-3" />Avanzate
              </button>
              {showAdvanced && (
                <div className="mt-2 pl-8 space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Intervallo cattura</span>
                      <span className="font-mono">{captureInterval}ms</span>
                    </div>
                    <input type="range" min="500" max="5000" step="250" value={captureInterval}
                      onChange={e => setCaptureInterval(Number(e.target.value))} disabled={isRunning} className="w-full accent-purple-500" />
                  </div>
                  <p className="text-2xs text-muted-foreground">
                    Intervalli più bassi = più reattivo ma più CPU. Per giochi con testo che cambia lentamente (JRPG), 2-3 secondi sono sufficienti.
                  </p>
                </div>
              )}
            </div>

            {/* Start/Stop */}
            <div className="flex gap-2">
              {!isRunning ? (
                <Button onClick={startCapture} className="flex-1 h-11 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-500/25">
                  <Play className="h-4 w-4 mr-2" />Avvia cattura
                </Button>
              ) : (
                <>
                  <Button onClick={togglePause} variant="outline" className="flex-1 h-11">
                    {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                    {isPaused ? 'Riprendi' : 'Pausa'}
                  </Button>
                  <Button onClick={stopCapture} variant="destructive" className="h-11">
                    <Square className="h-4 w-4 mr-2" />Stop
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current translation */}
        {(currentText || isTranslating) && (
          <Card className="border border-purple-500/30 bg-purple-900/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-semibold text-purple-300">Traduzione corrente</span>
                {isTranslating && <Loader2 className="h-3 w-3 animate-spin text-purple-400" />}
              </div>
              {currentText && <p className="text-xs text-slate-400 mb-1">{currentText}</p>}
              {currentTranslation && (
                <p className="text-base text-emerald-300 font-medium">{currentTranslation}</p>
              )}
            </CardContent>
          </Card>
        )}

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">{errorMsg}</div>
        )}

        {/* History */}
        {history.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium">Cronologia ({history.length})</span>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="xs" className="text-2xs" onClick={() => { navigator.clipboard.writeText(history.map(h => `${h.original}\n→ ${h.translated}`).join('\n\n')); toast.success('Copiato!'); }}>
                    <Copy className="h-2.5 w-2.5 mr-1" />Copia
                  </Button>
                  <Button variant="ghost" size="xs" className="text-2xs text-red-400" onClick={() => setHistory([])}>Svuota</Button>
                </div>
              </div>
              <ScrollArea className="max-h-[350px]">
                <div className="space-y-1.5">
                  {history.map((h, i) => (
                    <div key={i} className="flex gap-3 p-2 rounded-lg bg-slate-800/30 border border-slate-700/20">
                      <div className="flex-1 min-w-0">
                        <p className="text-2xs text-slate-500">{new Date(h.timestamp).toLocaleTimeString()}</p>
                        <p className="text-xs text-slate-400">{h.original}</p>
                      </div>
                      <ArrowRight className="h-3 w-3 text-purple-400 mt-3 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-emerald-300">{h.translated}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </>)}

      {/* Footer */}
      <p className="text-center text-2xs text-muted-foreground">
        {selectedEmulator.icon} {selectedEmulator.name} — Catture: {captureCount} | Cache: {translationCache.current.size} traduzioni
      </p>
    </div>
  );
}
