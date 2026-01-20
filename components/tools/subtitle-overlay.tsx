'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Play, 
  Pause, 
  Square,
  Settings,
  Download,
  Eye,
  EyeOff,
  Palette,
  Type,
  Monitor,
  Subtitles,
  Clock,
  Sparkles
} from 'lucide-react';
import {
  SubtitleConfig,
  Subtitle,
  DEFAULT_CONFIG,
  STYLE_PRESETS,
  generateOverlayCSS,
  generateSubtitleHTML,
  saveConfig,
  loadConfig,
  saveHistory,
  loadHistory,
  generateId,
  exportToSRT,
  exportToVTT,
} from '@/lib/subtitle-overlay';

export function SubtitleOverlay() {
  const [config, setConfig] = useState<SubtitleConfig>(DEFAULT_CONFIG);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null);
  const [history, setHistory] = useState<Subtitle[]>([]);
  const [previewText, setPreviewText] = useState('Hello, how are you?');
  const [previewTranslation, setPreviewTranslation] = useState('Ciao, come stai?');
  const [showPreview, setShowPreview] = useState(true);
  
  const overlayRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Carica config salvata
  useEffect(() => {
    const saved = loadConfig();
    setConfig(saved);
    const savedHistory = loadHistory();
    setHistory(savedHistory);
  }, []);

  // Salva config quando cambia
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  // Simula ricezione sottotitoli (in produzione verrebbe da OCR/hook)
  const simulateSubtitle = useCallback(() => {
    if (!isActive || isPaused) return;

    const samples = [
      { original: 'Welcome to the game!', translated: 'Benvenuto nel gioco!' },
      { original: 'Press any key to continue', translated: 'Premi un tasto per continuare' },
      { original: 'Loading...', translated: 'Caricamento...' },
      { original: 'Game saved successfully', translated: 'Gioco salvato con successo' },
      { original: 'Are you sure you want to quit?', translated: 'Sei sicuro di voler uscire?' },
    ];

    const sample = samples[Math.floor(Math.random() * samples.length)];
    
    const newSubtitle: Subtitle = {
      id: generateId(),
      originalText: sample.original,
      translatedText: sample.translated,
      startTime: Date.now(),
      isVisible: true,
    };

    setCurrentSubtitle(newSubtitle);
    setHistory(prev => [...prev, newSubtitle].slice(-50));

    // Auto-hide dopo durata
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCurrentSubtitle(prev => prev ? { ...prev, isVisible: false, endTime: Date.now() } : null);
    }, config.displayDuration);

  }, [isActive, isPaused, config.displayDuration]);

  // Demo mode - genera sottotitoli random
  useEffect(() => {
    if (!isActive || isPaused) return;
    
    const interval = setInterval(simulateSubtitle, 4000);
    simulateSubtitle(); // Primo subito
    
    return () => clearInterval(interval);
  }, [isActive, isPaused, simulateSubtitle]);

  const handleStart = () => {
    setIsActive(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    setIsActive(false);
    setIsPaused(false);
    setCurrentSubtitle(null);
    saveHistory(history);
  };

  const handlePresetChange = (preset: string) => {
    if (STYLE_PRESETS[preset]) {
      setConfig(prev => ({ ...prev, ...STYLE_PRESETS[preset] }));
    }
  };

  const handleExportSRT = () => {
    const srt = exportToSRT(history);
    downloadFile(srt, 'subtitles.srt', 'text/plain');
  };

  const handleExportVTT = () => {
    const vtt = exportToVTT(history);
    downloadFile(vtt, 'subtitles.vtt', 'text/vtt');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <Subtitles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">Subtitle Overlay</h2>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">Live subtitles for streaming and recording</p>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-3">
            {!isActive ? (
              <Button onClick={handleStart} className="bg-white text-purple-600 hover:bg-white/90 shadow-lg" size="lg">
                <Play className="h-5 w-5 mr-2" />
                Start Capture
              </Button>
            ) : (
              <>
                <Button onClick={handlePause} variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/20">
                  {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                </Button>
                <Button onClick={handleStop} className="bg-red-500/80 hover:bg-red-500 text-white" size="lg">
                  <Square className="h-5 w-5 mr-2" />
                  Stop
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* Status Badge */}
        {isActive && (
          <div className="mt-4 flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isPaused ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`}>
              <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-400' : 'bg-green-400 animate-pulse'}`} />
              {isPaused ? 'Paused' : 'Capture Active'}
            </div>
            <span className="text-white/60 text-sm">{history.length} subtitles captured</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview */}
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/20">
                  <Monitor className="h-4 w-4 text-purple-400" />
                </div>
                <span className="text-purple-100">Live Preview</span>
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="hover:bg-purple-500/20"
              >
                {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showPreview && (
              <div 
                className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden"
                style={{ height: 200 }}
              >
                {/* Simulated game screen */}
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  <Sparkles className="h-16 w-16" />
                </div>
                
                {/* Subtitle preview */}
                <div
                  className="absolute left-1/2 transform -translate-x-1/2"
                  style={{
                    [config.position === 'top' ? 'top' : 'bottom']: config.margin,
                    ...(config.position === 'center' && { top: '50%', transform: 'translate(-50%, -50%)' }),
                  }}
                >
                  <div
                    style={{
                      backgroundColor: `${config.backgroundColor}${Math.round(config.backgroundOpacity * 255).toString(16).padStart(2, '0')}`,
                      borderRadius: config.borderRadius,
                      padding: `${config.padding / 2}px ${config.padding}px`,
                      textAlign: 'center',
                      textShadow: config.shadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                    }}
                  >
                    {config.showOriginal && config.originalPosition === 'above' && (
                      <div style={{ 
                        fontSize: config.originalFontSize / 1.5, 
                        color: config.originalColor,
                        marginBottom: 2,
                        opacity: 0.8,
                      }}>
                        {currentSubtitle?.originalText || previewText}
                      </div>
                    )}
                    <div style={{ 
                      fontSize: config.fontSize / 1.5, 
                      color: config.textColor,
                      fontFamily: config.fontFamily,
                    }}>
                      {currentSubtitle?.translatedText || previewTranslation}
                    </div>
                    {config.showOriginal && config.originalPosition === 'below' && (
                      <div style={{ 
                        fontSize: config.originalFontSize / 1.5, 
                        color: config.originalColor,
                        marginTop: 2,
                        opacity: 0.8,
                      }}>
                        {currentSubtitle?.originalText || previewText}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Preview text inputs */}
            <div className="mt-3 space-y-2">
              <Input
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Original text"
                className="text-xs h-8"
              />
              <Input
                value={previewTranslation}
                onChange={(e) => setPreviewTranslation(e.target.value)}
                placeholder="Translation"
                className="text-xs h-8"
              />
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20">
                <Settings className="h-4 w-4 text-indigo-400" />
              </div>
              <span className="text-indigo-100">Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="style" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-8">
                <TabsTrigger value="style" className="text-xs">Style</TabsTrigger>
                <TabsTrigger value="position" className="text-xs">Position</TabsTrigger>
                <TabsTrigger value="timing" className="text-xs">Timing</TabsTrigger>
              </TabsList>

              <TabsContent value="style" className="space-y-3 mt-3">
                {/* Preset */}
                <div>
                  <Label className="text-xs">Preset</Label>
                  <Select onValueChange={handlePresetChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Choose preset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(STYLE_PRESETS).map(preset => (
                        <SelectItem key={preset} value={preset} className="text-xs">
                          {preset.charAt(0).toUpperCase() + preset.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Text color</Label>
                    <div className="flex gap-1">
                      <Input
                        type="color"
                        value={config.textColor}
                        onChange={(e) => setConfig(c => ({ ...c, textColor: e.target.value }))}
                        className="w-10 h-8 p-1"
                      />
                      <Input
                        value={config.textColor}
                        onChange={(e) => setConfig(c => ({ ...c, textColor: e.target.value }))}
                        className="flex-1 h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Background</Label>
                    <div className="flex gap-1">
                      <Input
                        type="color"
                        value={config.backgroundColor}
                        onChange={(e) => setConfig(c => ({ ...c, backgroundColor: e.target.value }))}
                        className="w-10 h-8 p-1"
                      />
                      <Input
                        value={config.backgroundColor}
                        onChange={(e) => setConfig(c => ({ ...c, backgroundColor: e.target.value }))}
                        className="flex-1 h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Font size */}
                <div>
                  <div className="flex justify-between">
                    <Label className="text-xs">Font size</Label>
                    <span className="text-xs text-muted-foreground">{config.fontSize}px</span>
                  </div>
                  <Slider
                    value={[config.fontSize]}
                    onValueChange={([v]) => setConfig(c => ({ ...c, fontSize: v }))}
                    min={12}
                    max={48}
                    step={1}
                    className="mt-1"
                  />
                </div>

                {/* Opacity */}
                <div>
                  <div className="flex justify-between">
                    <Label className="text-xs">Background opacity</Label>
                    <span className="text-xs text-muted-foreground">{Math.round(config.backgroundOpacity * 100)}%</span>
                  </div>
                  <Slider
                    value={[config.backgroundOpacity * 100]}
                    onValueChange={([v]) => setConfig(c => ({ ...c, backgroundOpacity: v / 100 }))}
                    min={0}
                    max={100}
                    step={5}
                    className="mt-1"
                  />
                </div>

                {/* Shadow */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Text shadow</Label>
                  <Switch
                    checked={config.shadow}
                    onCheckedChange={(v) => setConfig(c => ({ ...c, shadow: v }))}
                  />
                </div>
              </TabsContent>

              <TabsContent value="position" className="space-y-3 mt-3">
                {/* Position */}
                <div>
                  <Label className="text-xs">Posizione</Label>
                  <Select 
                    value={config.position}
                    onValueChange={(v: 'top' | 'bottom' | 'center') => setConfig(c => ({ ...c, position: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Top</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Show original */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Show original</Label>
                  <Switch
                    checked={config.showOriginal}
                    onCheckedChange={(v) => setConfig(c => ({ ...c, showOriginal: v }))}
                  />
                </div>

                {config.showOriginal && (
                  <div>
                    <Label className="text-xs">Original position</Label>
                    <Select 
                      value={config.originalPosition}
                      onValueChange={(v: 'above' | 'below' | 'inline') => setConfig(c => ({ ...c, originalPosition: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="above">Above</SelectItem>
                        <SelectItem value="below">Below</SelectItem>
                        <SelectItem value="inline">Inline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Margin */}
                <div>
                  <div className="flex justify-between">
                    <Label className="text-xs">Margin</Label>
                    <span className="text-xs text-muted-foreground">{config.margin}px</span>
                  </div>
                  <Slider
                    value={[config.margin]}
                    onValueChange={([v]) => setConfig(c => ({ ...c, margin: v }))}
                    min={0}
                    max={100}
                    step={4}
                    className="mt-1"
                  />
                </div>
              </TabsContent>

              <TabsContent value="timing" className="space-y-3 mt-3">
                {/* Duration */}
                <div>
                  <div className="flex justify-between">
                    <Label className="text-xs">Display duration</Label>
                    <span className="text-xs text-muted-foreground">{config.displayDuration / 1000}s</span>
                  </div>
                  <Slider
                    value={[config.displayDuration]}
                    onValueChange={([v]) => setConfig(c => ({ ...c, displayDuration: v }))}
                    min={1000}
                    max={15000}
                    step={500}
                    className="mt-1"
                  />
                </div>

                {/* Fade in */}
                <div>
                  <div className="flex justify-between">
                    <Label className="text-xs">Fade in</Label>
                    <span className="text-xs text-muted-foreground">{config.fadeInDuration}ms</span>
                  </div>
                  <Slider
                    value={[config.fadeInDuration]}
                    onValueChange={([v]) => setConfig(c => ({ ...c, fadeInDuration: v }))}
                    min={0}
                    max={1000}
                    step={50}
                    className="mt-1"
                  />
                </div>

                {/* Fade out */}
                <div>
                  <div className="flex justify-between">
                    <Label className="text-xs">Fade out</Label>
                    <span className="text-xs text-muted-foreground">{config.fadeOutDuration}ms</span>
                  </div>
                  <Slider
                    value={[config.fadeOutDuration]}
                    onValueChange={([v]) => setConfig(c => ({ ...c, fadeOutDuration: v }))}
                    min={0}
                    max={1000}
                    step={50}
                    className="mt-1"
                  />
                </div>

                {/* Animation */}
                <div>
                  <Label className="text-xs">Animation</Label>
                  <Select 
                    value={config.animation}
                    onValueChange={(v: 'fade' | 'slide' | 'typewriter' | 'none') => setConfig(c => ({ ...c, animation: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="fade">Fade</SelectItem>
                      <SelectItem value="slide">Slide</SelectItem>
                      <SelectItem value="typewriter">Typewriter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* History & Export */}
      <Card className="border-pink-500/20 bg-gradient-to-br from-pink-500/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-pink-500/20">
                <Clock className="h-4 w-4 text-pink-400" />
              </div>
              <span className="text-pink-100">History</span>
              <Badge variant="secondary" className="bg-pink-500/20 text-pink-300 text-xs">
                {history.length}
              </Badge>
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportSRT} 
                disabled={history.length === 0}
                className="border-pink-500/30 hover:bg-pink-500/20 hover:text-pink-300"
              >
                <Download className="h-3 w-3 mr-1" />
                SRT
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportVTT} 
                disabled={history.length === 0}
                className="border-pink-500/30 hover:bg-pink-500/20 hover:text-pink-300"
              >
                <Download className="h-3 w-3 mr-1" />
                VTT
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[150px]">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Subtitles className="h-10 w-10 text-pink-500/30 mb-2" />
                <p className="text-muted-foreground text-sm">No subtitles captured</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Start capture to begin</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.slice().reverse().map(sub => (
                  <div key={sub.id} className="flex items-center gap-3 p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                    <span className="text-pink-400/70 text-xs font-mono w-16 flex-shrink-0">
                      {new Date(sub.startTime).toLocaleTimeString()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 truncate">{sub.originalText}</p>
                      <p className="text-sm text-white truncate">{sub.translatedText}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
