'use client';

import { useState, useRef, useCallback } from 'react';
import { TARGET_LANGUAGES } from '@/lib/translation/target-languages';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { 
  Upload,
  BookOpen,
  Languages,
  Wand2,
  Download,
  Eye,
  EyeOff,
  Type,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  ImageIcon,
  MessageSquare,
  Eraser,
  PaintBucket,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useDefaultTargetLang } from '@/lib/translation/use-default-target-lang';

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

const SUPPORTED_LANGUAGES = TARGET_LANGUAGES;

export function MangaTranslator() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const _canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [sourceLanguage, setSourceLanguage] = useState('ja');
  const [targetLanguage, setTargetLanguage] = useState('en');
  useDefaultTargetLang(setTargetLanguage);
  const [selectedFont, setSelectedFont] = useState('manga');
  const [fontSize, setFontSize] = useState([16]);
  const [showOriginal, setShowOriginal] = useState(false);
  const [zoom, setZoom] = useState(100);
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

  // OCR, traduzione, inpainting ed export NON sono collegati a questo strumento.
  // Prima "Rileva & Traduci" restituiva sempre gli stessi 3 balloon giapponesi
  // con traduzioni italiane fisse, per qualunque immagine. Finché non c'è una
  // pipeline vera, le azioni restano disabilitate e la pagina lo dice.

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 animate-shimmer p-3 shadow-xl shadow-blue-900/50">
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
                  disabled
                  variant="outline"
                  className="border-white/50 text-white hover:bg-white/10 hover:border-white"
                  size="sm"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  {t('mangaTranslator.detect') || 'Rileva & Traduci'}
                </Button>
                <Button 
                  disabled
                  variant="outline"
                  className="border-white/50 text-white hover:bg-white/10 hover:border-white"
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

      {/* Strumento non ancora collegato a OCR/traduzione */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
        <p className="text-sm text-amber-500">{t('mangaTranslator.notConnected')}</p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Left Sidebar - Pages */}
        <div className="col-span-2">
          <Card className="border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-teal-400" />
                  {t('mangaTranslator.pages')} ({pages.length})
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
                  className="border-2 border-dashed border-teal-500/30 rounded-lg p-4 text-center cursor-pointer hover:border-teal-500/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <Upload className="h-8 w-8 mx-auto text-teal-400/50 mb-2" />
                  <p className="text-xs text-teal-400/70">
                    {t('mangaTranslator.dropImages')}
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
                            ? 'border-teal-500 shadow-lg shadow-teal-500/20' 
                            : 'border-transparent hover:border-teal-500/30'
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
                            <span className="text-2xs text-white">P.{index + 1}</span>
                            <div className="flex gap-1">
                              {page.processed && (
                                <Badge className="h-4 text-2xs bg-green-500/80 px-1">
                                  <CheckCircle2 className="h-2 w-2 mr-0.5" />
                                  OCR
                                </Badge>
                              )}
                              {page.inpainted && (
                                <Badge className="h-4 text-2xs bg-blue-500/80 px-1">
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
          <Card className="border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent">
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
                  <span className="text-sm text-teal-300">
                    {currentPage ? t('mangaTranslator.pageOf')?.replace('{current}', String(currentPageIndex + 1)).replace('{total}', String(pages.length)) : t('mangaTranslator.noPage')}
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
                    {showOriginal ? t('mangaTranslator.translated') : t('mangaTranslator.original')}
                  </Button>
                  <div className="flex items-center gap-1 bg-white/5 rounded-md px-2">
                    <ZoomOut className="h-3 w-3 text-teal-400" />
                    <Slider
                      value={[zoom]}
                      onValueChange={(v) => setZoom(v[0])}
                      min={50}
                      max={200}
                      step={10}
                      className="w-20"
                    />
                    <ZoomIn className="h-3 w-3 text-teal-400" />
                    <span className="text-xs text-teal-400 w-8">{zoom}%</span>
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
                            : 'border-teal-500/50 bg-teal-500/10 hover:border-teal-400'
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
                          className="absolute -top-2 -right-2 h-4 text-2xs bg-teal-600"
                        >
                          {Math.round(balloon.confidence * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div 
                  className="h-[500px] border-2 border-dashed border-teal-500/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-teal-500/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <BookOpen className="h-16 w-16 text-teal-400/30 mb-4" />
                  <p className="text-teal-400/70 text-lg mb-2">{t('mangaTranslator.loadPages')}</p>
                  <p className="text-teal-400/50 text-sm">{t('mangaTranslator.supportedFormats')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Settings & Balloons */}
        <div className="col-span-3 space-y-4">
          {/* Language Settings */}
          <Card className="border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Languages className="h-4 w-4 text-teal-400" />
                {t('mangaTranslator.languages')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <div>
                <label className="text-xs text-teal-400 mb-1 block">{t('mangaTranslator.source')}</label>
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
                <label className="text-xs text-teal-400 mb-1 block">{t('mangaTranslator.target')}</label>
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
          <Card className="border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Type className="h-4 w-4 text-teal-400" />
                {t('mangaTranslator.fontStyle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <div>
                <label className="text-xs text-teal-400 mb-1 block">{t('mangaTranslator.fontStyleLabel')}</label>
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
                <label className="text-xs text-teal-400 mb-1 block">
                  {t('mangaTranslator.fontSize')}: {fontSize[0]}px
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
            <Card className="border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-teal-400" />
                  {t('mangaTranslator.balloons')} ({currentPage.balloons.length})
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
                            ? 'bg-teal-500/30 border border-teal-500'
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                        onClick={() => setSelectedBalloon(balloon.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-2xs">
                            #{idx + 1}
                          </Badge>
                          <Badge className="text-2xs bg-green-500/20 text-green-400">
                            {Math.round(balloon.confidence * 100)}%
                          </Badge>
                        </div>
                        <p className="text-xs text-teal-300 line-clamp-1">{balloon.text}</p>
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
          <Card className="border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent">
            <CardContent className="p-3 space-y-2">
              <Button 
                size="sm" 
                variant="outline"
                className="w-full border-teal-500/50 text-teal-400 hover:bg-teal-500/10 hover:border-teal-400"
                disabled
              >
                <Download className="h-4 w-4 mr-2" />
                {t('mangaTranslator.exportPage')}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="w-full border-teal-500/50 text-teal-400 hover:bg-teal-500/10 hover:border-teal-400"
                disabled
              >
                <Download className="h-4 w-4 mr-2" />
                {t('mangaTranslator.exportAll')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

