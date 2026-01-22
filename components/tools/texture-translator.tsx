'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { 
  Upload,
  ImageIcon,
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
  CheckCircle2,
  Loader2,
  Layers,
  Search,
  FolderOpen,
  FileImage,
  Settings,
  Sparkles,
  Grid3X3,
  ScanLine,
  Replace,
  Save
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface DetectedTextRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  translatedText: string;
  confidence: number;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
}

interface TextureFile {
  id: string;
  name: string;
  path: string;
  file: File;
  imageUrl: string;
  width: number;
  height: number;
  format: string;
  regions: DetectedTextRegion[];
  processed: boolean;
  modified: boolean;
}

const TEXTURE_FORMATS = [
  { id: 'dds', name: 'DDS (DirectDraw Surface)', ext: '.dds' },
  { id: 'png', name: 'PNG', ext: '.png' },
  { id: 'tga', name: 'TGA (Targa)', ext: '.tga' },
  { id: 'bmp', name: 'BMP', ext: '.bmp' },
  { id: 'jpg', name: 'JPEG', ext: '.jpg' },
  { id: 'webp', name: 'WebP', ext: '.webp' },
];

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
];

const FONT_OPTIONS = [
  { id: 'arial', name: 'Arial' },
  { id: 'roboto', name: 'Roboto' },
  { id: 'opensans', name: 'Open Sans' },
  { id: 'impact', name: 'Impact' },
  { id: 'pixel', name: 'Press Start 2P' },
  { id: 'gothic', name: 'Gothic' },
];

export function TextureTranslator() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const [textures, setTextures] = useState<TextureFile[]>([]);
  const [currentTextureIndex, setCurrentTextureIndex] = useState(0);
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('it');
  const [selectedFont, setSelectedFont] = useState('arial');
  const [zoom, setZoom] = useState(100);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [preserveStyle, setPreserveStyle] = useState(true);
  const [autoMatchFont, setAutoMatchFont] = useState(true);

  const currentTexture = textures[currentTextureIndex];

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newTextures: TextureFile[] = [];
    
    Array.from(files).forEach((file, index) => {
      if (file.type.startsWith('image/') || file.name.match(/\.(dds|tga)$/i)) {
        const imageUrl = URL.createObjectURL(file);
        const format = file.name.split('.').pop()?.toLowerCase() || 'unknown';
        
        newTextures.push({
          id: `texture-${Date.now()}-${index}`,
          name: file.name,
          path: file.name,
          file,
          imageUrl,
          width: 0,
          height: 0,
          format,
          regions: [],
          processed: false,
          modified: false,
        });
      }
    });

    setTextures(prev => [...prev, ...newTextures]);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    
    const newTextures: TextureFile[] = [];
    
    Array.from(files).forEach((file, index) => {
      if (file.type.startsWith('image/') || file.name.match(/\.(dds|tga)$/i)) {
        const imageUrl = URL.createObjectURL(file);
        const format = file.name.split('.').pop()?.toLowerCase() || 'unknown';
        
        newTextures.push({
          id: `texture-${Date.now()}-${index}`,
          name: file.name,
          path: file.name,
          file,
          imageUrl,
          width: 0,
          height: 0,
          format,
          regions: [],
          processed: false,
          modified: false,
        });
      }
    });

    setTextures(prev => [...prev, ...newTextures]);
  }, []);

  const detectTextInTexture = async () => {
    if (!currentTexture) return;
    
    setIsProcessing(true);
    setProcessingStep('Scansione texture...');
    setProgress(0);

    await new Promise(resolve => setTimeout(resolve, 500));
    setProgress(20);
    setProcessingStep('Rilevamento testo con OCR...');

    await new Promise(resolve => setTimeout(resolve, 600));
    setProgress(50);

    // Mock detected regions
    const mockRegions: DetectedTextRegion[] = [
      {
        id: 'region-1',
        x: 20,
        y: 15,
        width: 120,
        height: 30,
        text: 'START GAME',
        translatedText: '',
        confidence: 0.97,
        backgroundColor: '#1a1a2e',
        textColor: '#ffffff',
        fontSize: 18,
        fontFamily: 'Arial',
      },
      {
        id: 'region-2',
        x: 20,
        y: 55,
        width: 100,
        height: 25,
        text: 'OPTIONS',
        translatedText: '',
        confidence: 0.95,
        backgroundColor: '#1a1a2e',
        textColor: '#cccccc',
        fontSize: 16,
        fontFamily: 'Arial',
      },
      {
        id: 'region-3',
        x: 20,
        y: 90,
        width: 80,
        height: 25,
        text: 'EXIT',
        translatedText: '',
        confidence: 0.98,
        backgroundColor: '#1a1a2e',
        textColor: '#ff6666',
        fontSize: 16,
        fontFamily: 'Arial',
      },
      {
        id: 'region-4',
        x: 150,
        y: 200,
        width: 140,
        height: 20,
        text: 'LOADING...',
        translatedText: '',
        confidence: 0.92,
        backgroundColor: '#000000',
        textColor: '#00ff00',
        fontSize: 14,
        fontFamily: 'Pixel',
      },
    ];

    setProgress(70);
    setProcessingStep('Traduzione testi...');

    await new Promise(resolve => setTimeout(resolve, 500));

    // Translate
    const translatedRegions = mockRegions.map(region => ({
      ...region,
      translatedText: translateText(region.text),
    }));

    setProgress(100);
    setProcessingStep('Completato!');

    setTextures(prev => prev.map((tex, idx) => 
      idx === currentTextureIndex 
        ? { ...tex, regions: translatedRegions, processed: true }
        : tex
    ));

    setIsProcessing(false);
  };

  const translateText = (text: string): string => {
    const translations: Record<string, string> = {
      'START GAME': 'INIZIA GIOCO',
      'OPTIONS': 'OPZIONI',
      'EXIT': 'ESCI',
      'LOADING...': 'CARICAMENTO...',
      'NEW GAME': 'NUOVA PARTITA',
      'CONTINUE': 'CONTINUA',
      'SETTINGS': 'IMPOSTAZIONI',
      'QUIT': 'ESCI',
      'PAUSE': 'PAUSA',
      'RESUME': 'RIPRENDI',
    };
    return translations[text] || text;
  };

  const applyTranslation = async () => {
    if (!currentTexture) return;
    
    setIsProcessing(true);
    setProcessingStep('Applicazione traduzioni...');
    setProgress(0);

    for (let i = 0; i <= 100; i += 20) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setProgress(i);
    }

    setTextures(prev => prev.map((tex, idx) => 
      idx === currentTextureIndex 
        ? { ...tex, modified: true }
        : tex
    ));

    setIsProcessing(false);
    setProcessingStep('');
  };

  const processAllTextures = async () => {
    setIsProcessing(true);
    
    for (let i = 0; i < textures.length; i++) {
      setCurrentTextureIndex(i);
      setProcessingStep(`Elaborazione ${i + 1}/${textures.length}...`);
      setProgress(Math.round((i / textures.length) * 100));
      await detectTextInTexture();
    }
    
    setIsProcessing(false);
  };

  const exportTexture = () => {
    console.log('Exporting texture:', currentTexture);
  };

  const exportAll = () => {
    console.log('Exporting all textures:', textures);
  };

  const filteredTextures = textures.filter(tex => 
    tex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                {t('textureTranslator.title') || 'Texture Translator'}
              </h2>
              <p className="text-white/70 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('textureTranslator.subtitle') || 'Traduci menu, UI e texture in-game'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {textures.length > 0 && (
              <>
                <Button 
                  onClick={detectTextInTexture}
                  disabled={isProcessing}
                  className="bg-white text-teal-600 hover:bg-white/90 shadow-lg"
                  size="sm"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ScanLine className="h-4 w-4 mr-2" />
                  )}
                  {t('textureTranslator.detectText')}
                </Button>
                <Button 
                  onClick={applyTranslation}
                  disabled={isProcessing || !currentTexture?.processed}
                  className="bg-white/20 text-white hover:bg-white/30 border border-white/30"
                  size="sm"
                >
                  <Replace className="h-4 w-4 mr-2" />
                  {t('textureTranslator.apply')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <Card className="border-teal-500/30 bg-teal-500/10">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
              <span className="text-sm text-teal-300">{processingStep}</span>
              <div className="flex-1">
                <Progress value={progress} className="h-2" />
              </div>
              <span className="text-sm text-teal-400">{progress}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Left Sidebar - File Browser */}
        <div className="col-span-3">
          <Card className="border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-teal-400" />
                  {t('textureTranslator.textures')} ({textures.length})
                </span>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 w-6 p-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3 w-3" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.dds,.tga"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-teal-400/50" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('common.search') + '...'}
                  className="h-7 text-xs pl-7 bg-black/20 border-teal-500/30"
                />
              </div>
              
              {textures.length === 0 ? (
                <div 
                  className="border-2 border-dashed border-teal-500/30 rounded-lg p-4 text-center cursor-pointer hover:border-teal-500/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <Upload className="h-8 w-8 mx-auto text-teal-400/50 mb-2" />
                  <p className="text-xs text-teal-400/70">
                    {t('textureTranslator.dropTextures')}
                  </p>
                  <p className="text-[10px] text-teal-400/50 mt-1">
                    PNG, DDS, TGA, JPG
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[350px]">
                  <div className="space-y-1">
                    {filteredTextures.map((texture, index) => (
                      <div
                        key={texture.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                          textures.indexOf(texture) === currentTextureIndex 
                            ? 'bg-teal-500/30 border border-teal-500' 
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                        onClick={() => setCurrentTextureIndex(textures.indexOf(texture))}
                      >
                        <div className="w-10 h-10 rounded bg-black/30 overflow-hidden flex-shrink-0">
                          <img 
                            src={texture.imageUrl} 
                            alt={texture.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{texture.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge className="h-4 text-[8px] bg-teal-500/30 px-1">
                              {texture.format.toUpperCase()}
                            </Badge>
                            {texture.processed && (
                              <Badge className="h-4 text-[8px] bg-green-500/30 px-1">
                                <CheckCircle2 className="h-2 w-2 mr-0.5" />
                                OCR
                              </Badge>
                            )}
                            {texture.modified && (
                              <Badge className="h-4 text-[8px] bg-yellow-500/30 px-1">
                                Mod
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {textures.length > 0 && (
                <Button 
                  size="sm" 
                  className="w-full bg-teal-600/50 hover:bg-teal-600"
                  onClick={processAllTextures}
                  disabled={isProcessing}
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  {t('textureTranslator.processAll')} ({textures.length})
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Preview */}
        <div className="col-span-6">
          <Card className="border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileImage className="h-4 w-4 text-teal-400" />
                  <span className="text-sm text-teal-300">
                    {currentTexture ? currentTexture.name : t('textureTranslator.noTexture')}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => setShowOriginal(!showOriginal)}
                  >
                    {showOriginal ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                    {showOriginal ? t('textureTranslator.translated') : t('textureTranslator.original')}
                  </Button>
                  <div className="flex items-center gap-1 bg-white/5 rounded-md px-2">
                    <ZoomOut className="h-3 w-3 text-teal-400" />
                    <Slider
                      value={[zoom]}
                      onValueChange={(v) => setZoom(v[0])}
                      min={50}
                      max={300}
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
              {currentTexture ? (
                <div 
                  className="relative overflow-auto bg-[repeating-conic-gradient(#1a1a2e_0%_25%,#0d0d1a_0%_50%)] bg-[length:20px_20px] rounded-lg"
                  style={{ maxHeight: '450px' }}
                >
                  <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}>
                    <img 
                      src={currentTexture.imageUrl} 
                      alt="Current texture"
                      className="max-w-full"
                    />
                    {/* Text region overlays */}
                    {!showOriginal && currentTexture.regions.map(region => (
                      <div
                        key={region.id}
                        className={`absolute border-2 cursor-pointer transition-all ${
                          selectedRegion === region.id 
                            ? 'border-cyan-400 shadow-lg shadow-cyan-500/30' 
                            : 'border-teal-500/50 hover:border-teal-400'
                        }`}
                        style={{
                          left: region.x,
                          top: region.y,
                          width: region.width,
                          height: region.height,
                          backgroundColor: region.backgroundColor + 'dd',
                        }}
                        onClick={() => setSelectedRegion(region.id)}
                      >
                        <div 
                          className="absolute inset-0 flex items-center justify-center px-1"
                          style={{ 
                            color: region.textColor,
                            fontSize: `${region.fontSize}px`,
                            fontFamily: region.fontFamily,
                          }}
                        >
                          {region.translatedText || region.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div 
                  className="h-[450px] border-2 border-dashed border-teal-500/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-teal-500/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <Layers className="h-16 w-16 text-teal-400/30 mb-4" />
                  <p className="text-teal-400/70 text-lg mb-2">{t('textureTranslator.dropTextures')}</p>
                  <p className="text-teal-400/50 text-sm">PNG, DDS, TGA, JPG</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Settings & Regions */}
        <div className="col-span-3 space-y-4">
          {/* Language Settings */}
          <Card className="border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Languages className="h-4 w-4 text-teal-400" />
                {t('textureTranslator.languages')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-teal-400 mb-1 block">{t('common.from')}</label>
                  <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          <span className="flex items-center gap-1">
                            <span>{lang.flag}</span>
                            <span className="text-xs">{lang.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-teal-400 mb-1 block">{t('common.to')}</label>
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          <span className="flex items-center gap-1">
                            <span>{lang.flag}</span>
                            <span className="text-xs">{lang.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Font & Style Settings */}
          <Card className="border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4 text-teal-400" />
                {t('textureTranslator.settings')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-teal-300">{t('textureTranslator.preserveStyle')}</span>
                <Switch
                  checked={preserveStyle}
                  onCheckedChange={setPreserveStyle}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-teal-300">{t('textureTranslator.autoFontMatch')}</span>
                <Switch
                  checked={autoMatchFont}
                  onCheckedChange={setAutoMatchFont}
                />
              </div>
              <div>
                <label className="text-[10px] text-teal-400 mb-1 block">{t('textureTranslator.fontFallback')}</label>
                <Select value={selectedFont} onValueChange={setSelectedFont}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map(font => (
                      <SelectItem key={font.id} value={font.id}>
                        {font.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Detected Regions */}
          {currentTexture?.regions.length > 0 && (
            <Card className="border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 text-teal-400" />
                  {t('textureTranslator.detectedTexts')} ({currentTexture.regions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="h-[180px]">
                  <div className="space-y-2">
                    {currentTexture.regions.map((region, idx) => (
                      <div
                        key={region.id}
                        className={`p-2 rounded-lg cursor-pointer transition-all ${
                          selectedRegion === region.id
                            ? 'bg-teal-500/30 border border-teal-500'
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                        onClick={() => setSelectedRegion(region.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1">
                            <div 
                              className="w-3 h-3 rounded border"
                              style={{ backgroundColor: region.backgroundColor }}
                            />
                            <span className="text-[10px] text-teal-400">
                              {region.fontSize}px
                            </span>
                          </div>
                          <Badge className="text-[10px] bg-green-500/20 text-green-400">
                            {Math.round(region.confidence * 100)}%
                          </Badge>
                        </div>
                        <p className="text-xs text-white/70 line-clamp-1">{region.text}</p>
                        <p className="text-xs text-green-400 line-clamp-1">
                          → {region.translatedText}
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
            <CardContent className="p-3">
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="flex-1 bg-teal-600 hover:bg-teal-500"
                  onClick={exportTexture}
                  disabled={!currentTexture?.modified}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {t('textureTranslator.save')}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="flex-1"
                  onClick={exportAll}
                  disabled={textures.length === 0}
                >
                  <Download className="h-4 w-4 mr-1" />
                  {t('textureTranslator.exportAll')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
