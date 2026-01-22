'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Upload,
  BookOpen,
  Languages,
  Wand2,
  Download,
  Eye,
  EyeOff,
  Type,
  Palette,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Play,
  Square,
  CheckCircle2,
  Loader2,
  ImageIcon,
  MessageSquare,
  Eraser,
  PaintBucket,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface DetectedBalloon {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  translatedText: string;
  confidence: number;
  isVertical: boolean;
  fontStyle: 'manga' | 'comic' | 'handwritten' | 'bold';
}

interface MangaPage {
  id: string;
  file: File;
  imageUrl: string;
  balloons: DetectedBalloon[];
  processed: boolean;
  inpainted: boolean;
}

const FONT_STYLES = [
  { id: 'manga', name: 'Manga Style', preview: 'あいうえお ABC' },
  { id: 'comic', name: 'Comic Sans', preview: 'BOOM! POW!' },
  { id: 'handwritten', name: 'Handwritten', preview: 'Dear diary...' },
  { id: 'bold', name: 'Bold Impact', preview: 'IMPACT!' },
];

const SUPPORTED_LANGUAGES = [
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
];

export function MangaTranslator() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [sourceLanguage, setSourceLanguage] = useState('ja');
  const [targetLanguage, setTargetLanguage] = useState('it');
  const [selectedFont, setSelectedFont] = useState('manga');
  const [fontSize, setFontSize] = useState([16]);
  const [showOriginal, setShowOriginal] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [selectedBalloon, setSelectedBalloon] = useState<string | null>(null);

  const currentPage = pages[currentPageIndex];

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newPages: MangaPage[] = [];
    
    Array.from(files).forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const imageUrl = URL.createObjectURL(file);
        newPages.push({
          id: `page-${Date.now()}-${index}`,
          file,
          imageUrl,
          balloons: [],
          processed: false,
          inpainted: false,
        });
      }
    });

    setPages(prev => [...prev, ...newPages]);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    
    const newPages: MangaPage[] = [];
    
    Array.from(files).forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const imageUrl = URL.createObjectURL(file);
        newPages.push({
          id: `page-${Date.now()}-${index}`,
          file,
          imageUrl,
          balloons: [],
          processed: false,
          inpainted: false,
        });
      }
    });

    setPages(prev => [...prev, ...newPages]);
  }, []);

  const detectBalloons = async () => {
    if (!currentPage) return;
    
    setIsProcessing(true);
    setProcessingStep('Rilevamento balloon...');
    setProgress(0);

    // Simula rilevamento balloon con OCR
    await new Promise(resolve => setTimeout(resolve, 500));
    setProgress(20);
    setProcessingStep('Analisi testo...');

    await new Promise(resolve => setTimeout(resolve, 500));
    setProgress(40);

    // Genera balloon mock per demo
    const mockBalloons: DetectedBalloon[] = [
      {
        id: 'balloon-1',
        x: 50,
        y: 30,
        width: 150,
        height: 80,
        text: 'これは何ですか？',
        translatedText: '',
        confidence: 0.95,
        isVertical: true,
        fontStyle: 'manga',
      },
      {
        id: 'balloon-2',
        x: 250,
        y: 150,
        width: 120,
        height: 60,
        text: 'わからない...',
        translatedText: '',
        confidence: 0.88,
        isVertical: false,
        fontStyle: 'manga',
      },
      {
        id: 'balloon-3',
        x: 100,
        y: 300,
        width: 180,
        height: 100,
        text: '行こう！みんな待ってるよ！',
        translatedText: '',
        confidence: 0.92,
        isVertical: true,
        fontStyle: 'bold',
      },
    ];

    setProgress(60);
    setProcessingStep('Traduzione in corso...');

    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Simula traduzione
    const translatedBalloons = mockBalloons.map(balloon => ({
      ...balloon,
      translatedText: balloon.text === 'これは何ですか？' 
        ? "Cos'è questo?" 
        : balloon.text === 'わからない...'
        ? 'Non lo so...'
        : 'Andiamo! Tutti ci stanno aspettando!',
    }));

    setProgress(100);
    setProcessingStep('Completato!');

    setPages(prev => prev.map((page, idx) => 
      idx === currentPageIndex 
        ? { ...page, balloons: translatedBalloons, processed: true }
        : page
    ));

    setIsProcessing(false);
  };

  const applyInpainting = async () => {
    if (!currentPage) return;
    
    setIsProcessing(true);
    setProcessingStep('Inpainting in corso...');
    setProgress(0);

    // Simula inpainting
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setProgress(i);
    }

    setPages(prev => prev.map((page, idx) => 
      idx === currentPageIndex 
        ? { ...page, inpainted: true }
        : page
    ));

    setIsProcessing(false);
    setProcessingStep('');
  };

  const translateAll = async () => {
    setIsProcessing(true);
    setProcessingStep('Traduzione batch...');
    
    for (let i = 0; i < pages.length; i++) {
      setProgress(Math.round((i / pages.length) * 100));
      setCurrentPageIndex(i);
      await detectBalloons();
    }
    
    setIsProcessing(false);
  };

  const exportPage = () => {
    // Export logica
    console.log('Exporting page:', currentPage);
  };

  const exportAll = () => {
    // Export all pages
    console.log('Exporting all pages:', pages);
  };

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                {t('mangaTranslator.title') || 'Manga/Comic Translator'}
              </h2>
              <p className="text-white/70 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('mangaTranslator.subtitle') || 'OCR balloon detection, inpainting & font matching'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {pages.length > 0 && (
              <>
                <Button 
                  onClick={detectBalloons}
                  disabled={isProcessing}
                  className="bg-white text-purple-600 hover:bg-white/90 shadow-lg"
                  size="sm"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  {t('mangaTranslator.detect') || 'Rileva & Traduci'}
                </Button>
                <Button 
                  onClick={applyInpainting}
                  disabled={isProcessing || !currentPage?.processed}
                  className="bg-white/20 text-white hover:bg-white/30 border border-white/30"
                  size="sm"
                >
                  <Eraser className="h-4 w-4 mr-2" />
                  {t('mangaTranslator.inpaint') || 'Inpainting'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <Card className="border-purple-500/30 bg-purple-500/10">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
              <span className="text-sm text-purple-300">{processingStep}</span>
              <div className="flex-1">
                <Progress value={progress} className="h-2" />
              </div>
              <span className="text-sm text-purple-400">{progress}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Left Sidebar - Pages */}
        <div className="col-span-2">
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-purple-400" />
                  Pagine ({pages.length})
                </span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 w-6 p-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3 w-3" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              
              {pages.length === 0 ? (
                <div 
                  className="border-2 border-dashed border-purple-500/30 rounded-lg p-4 text-center cursor-pointer hover:border-purple-500/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <Upload className="h-8 w-8 mx-auto text-purple-400/50 mb-2" />
                  <p className="text-xs text-purple-400/70">
                    Trascina immagini o clicca per caricare
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {pages.map((page, index) => (
                      <div
                        key={page.id}
                        className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                          index === currentPageIndex 
                            ? 'border-purple-500 shadow-lg shadow-purple-500/20' 
                            : 'border-transparent hover:border-purple-500/30'
                        }`}
                        onClick={() => setCurrentPageIndex(index)}
                      >
                        <img 
                          src={page.imageUrl} 
                          alt={`Page ${index + 1}`}
                          className="w-full h-auto"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-white">P.{index + 1}</span>
                            <div className="flex gap-1">
                              {page.processed && (
                                <Badge className="h-4 text-[8px] bg-green-500/80 px-1">
                                  <CheckCircle2 className="h-2 w-2 mr-0.5" />
                                  OCR
                                </Badge>
                              )}
                              {page.inpainted && (
                                <Badge className="h-4 text-[8px] bg-blue-500/80 px-1">
                                  <PaintBucket className="h-2 w-2 mr-0.5" />
                                  INP
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Canvas */}
        <div className="col-span-7">
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={currentPageIndex === 0}
                    onClick={() => setCurrentPageIndex(prev => prev - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-purple-300">
                    {currentPage ? `Pagina ${currentPageIndex + 1} di ${pages.length}` : 'Nessuna pagina'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={currentPageIndex >= pages.length - 1}
                    onClick={() => setCurrentPageIndex(prev => prev + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => setShowOriginal(!showOriginal)}
                  >
                    {showOriginal ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                    {showOriginal ? 'Tradotto' : 'Originale'}
                  </Button>
                  <div className="flex items-center gap-1 bg-white/5 rounded-md px-2">
                    <ZoomOut className="h-3 w-3 text-purple-400" />
                    <Slider
                      value={[zoom]}
                      onValueChange={(v) => setZoom(v[0])}
                      min={50}
                      max={200}
                      step={10}
                      className="w-20"
                    />
                    <ZoomIn className="h-3 w-3 text-purple-400" />
                    <span className="text-xs text-purple-400 w-8">{zoom}%</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              {currentPage ? (
                <div 
                  className="relative overflow-auto bg-black/20 rounded-lg"
                  style={{ maxHeight: '500px' }}
                >
                  <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}>
                    <img 
                      src={currentPage.imageUrl} 
                      alt="Current page"
                      className="max-w-full"
                    />
                    {/* Balloon overlays */}
                    {!showOriginal && currentPage.balloons.map(balloon => (
                      <div
                        key={balloon.id}
                        className={`absolute border-2 rounded cursor-pointer transition-all ${
                          selectedBalloon === balloon.id 
                            ? 'border-pink-500 bg-pink-500/20' 
                            : 'border-purple-500/50 bg-purple-500/10 hover:border-purple-400'
                        }`}
                        style={{
                          left: balloon.x,
                          top: balloon.y,
                          width: balloon.width,
                          height: balloon.height,
                        }}
                        onClick={() => setSelectedBalloon(balloon.id)}
                      >
                        <div className="absolute inset-0 flex items-center justify-center p-1">
                          <span 
                            className="text-center text-white font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                            style={{ 
                              fontSize: `${fontSize[0]}px`,
                              writingMode: balloon.isVertical ? 'vertical-rl' : 'horizontal-tb',
                            }}
                          >
                            {balloon.translatedText || balloon.text}
                          </span>
                        </div>
                        <Badge 
                          className="absolute -top-2 -right-2 h-4 text-[8px] bg-purple-600"
                        >
                          {Math.round(balloon.confidence * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div 
                  className="h-[500px] border-2 border-dashed border-purple-500/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <BookOpen className="h-16 w-16 text-purple-400/30 mb-4" />
                  <p className="text-purple-400/70 text-lg mb-2">Carica pagine manga/comic</p>
                  <p className="text-purple-400/50 text-sm">Supporta JPG, PNG, WebP</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Settings & Balloons */}
        <div className="col-span-3 space-y-4">
          {/* Language Settings */}
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Languages className="h-4 w-4 text-purple-400" />
                Lingue
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <div>
                <label className="text-xs text-purple-400 mb-1 block">Sorgente</label>
                <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <span className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-purple-400 mb-1 block">Destinazione</label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <span className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Font Settings */}
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Type className="h-4 w-4 text-purple-400" />
                Font & Stile
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <div>
                <label className="text-xs text-purple-400 mb-1 block">Stile Font</label>
                <Select value={selectedFont} onValueChange={setSelectedFont}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_STYLES.map(font => (
                      <SelectItem key={font.id} value={font.id}>
                        <span className="flex items-center gap-2">
                          <span>{font.name}</span>
                          <span className="text-xs text-muted-foreground">{font.preview}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-purple-400 mb-1 block">
                  Dimensione: {fontSize[0]}px
                </label>
                <Slider
                  value={fontSize}
                  onValueChange={setFontSize}
                  min={8}
                  max={32}
                  step={1}
                />
              </div>
            </CardContent>
          </Card>

          {/* Detected Balloons */}
          {currentPage?.balloons.length > 0 && (
            <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-400" />
                  Balloon Rilevati ({currentPage.balloons.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {currentPage.balloons.map((balloon, idx) => (
                      <div
                        key={balloon.id}
                        className={`p-2 rounded-lg cursor-pointer transition-all ${
                          selectedBalloon === balloon.id
                            ? 'bg-purple-500/30 border border-purple-500'
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                        onClick={() => setSelectedBalloon(balloon.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-[10px]">
                            #{idx + 1}
                          </Badge>
                          <Badge className="text-[10px] bg-green-500/20 text-green-400">
                            {Math.round(balloon.confidence * 100)}%
                          </Badge>
                        </div>
                        <p className="text-xs text-purple-300 line-clamp-1">{balloon.text}</p>
                        <p className="text-xs text-green-400 line-clamp-1 mt-1">
                          → {balloon.translatedText}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Export */}
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
            <CardContent className="p-3">
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="flex-1 bg-purple-600 hover:bg-purple-500"
                  onClick={exportPage}
                  disabled={!currentPage?.processed}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Esporta Pagina
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="flex-1"
                  onClick={exportAll}
                  disabled={pages.length === 0}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Esporta Tutto
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
