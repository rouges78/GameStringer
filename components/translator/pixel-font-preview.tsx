'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Type, Settings, AlertTriangle, Check, Maximize2, 
  ChevronDown, Download, RefreshCw, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useTranslation } from '@/lib/i18n';

// Font presets per vari stili di gioco
const PIXEL_FONTS = [
  { name: 'Press Start 2P', family: "'Press Start 2P', monospace", url: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap', style: '8-bit' },
  { name: 'VT323', family: "'VT323', monospace", url: 'https://fonts.googleapis.com/css2?family=VT323&display=swap', style: 'Terminal' },
  { name: 'Silkscreen', family: "'Silkscreen', monospace", url: 'https://fonts.googleapis.com/css2?family=Silkscreen&display=swap', style: '16-bit' },
  { name: 'DotGothic16', family: "'DotGothic16', sans-serif", url: 'https://fonts.googleapis.com/css2?family=DotGothic16&display=swap', style: 'Japanese' },
  { name: 'Pixelify Sans', family: "'Pixelify Sans', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Pixelify+Sans&display=swap', style: 'Modern Pixel' },
  { name: 'Courier Prime', family: "'Courier Prime', monospace", url: 'https://fonts.googleapis.com/css2?family=Courier+Prime&display=swap', style: 'DOS' },
  { name: 'Share Tech Mono', family: "'Share Tech Mono', monospace", url: 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap', style: 'Sci-Fi' },
];

// Preset di box di testo comuni nei giochi
const TEXT_BOX_PRESETS = [
  { name: 'RPG Dialog', width: 320, height: 80, padding: 8, lines: 3 },
  { name: 'JRPG Name', width: 100, height: 20, padding: 4, lines: 1 },
  { name: 'Menu Item', width: 150, height: 24, padding: 4, lines: 1 },
  { name: 'NES Dialog', width: 240, height: 48, padding: 4, lines: 2 },
  { name: 'SNES Dialog', width: 256, height: 64, padding: 6, lines: 3 },
  { name: 'GBA Dialog', width: 240, height: 40, padding: 4, lines: 2 },
  { name: 'Item Description', width: 200, height: 60, padding: 6, lines: 3 },
  { name: 'Tooltip', width: 180, height: 32, padding: 4, lines: 2 },
];

interface PixelFontPreviewProps {
  text: string;
  originalText?: string;
  maxWidth?: number;
  maxHeight?: number;
  onOverflow?: (isOverflow: boolean) => void;
  compact?: boolean;
}

export function PixelFontPreview({
  text,
  originalText,
  maxWidth = 320,
  maxHeight = 80,
  onOverflow,
  compact = false
}: PixelFontPreviewProps) {
  const { t } = useTranslation();
  const [selectedFont, setSelectedFont] = useState(PIXEL_FONTS[0]);
  const [selectedPreset, setSelectedPreset] = useState(TEXT_BOX_PRESETS[0]);
  const [fontSize, setFontSize] = useState(8);
  const [customWidth, setCustomWidth] = useState(maxWidth);
  const [customHeight, setCustomHeight] = useState(maxHeight);
  const [bgColor, setBgColor] = useState('#1a1a2e');
  const [textColor, setTextColor] = useState('#ffffff');
  const [borderColor, setBorderColor] = useState('#4a4a6a');
  const [showBorder, setShowBorder] = useState(true);
  const [isOverflow, setIsOverflow] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  
  const previewRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  // Carica i font pixel
  useEffect(() => {
    const loadFonts = async () => {
      const links = PIXEL_FONTS.map(font => {
        const link = document.createElement('link');
        link.href = font.url;
        link.rel = 'stylesheet';
        return link;
      });
      
      links.forEach(link => document.head.appendChild(link));
      
      // Aspetta che i font siano caricati
      await document.fonts.ready;
      setFontsLoaded(true);
    };
    
    loadFonts();
  }, []);

  // Controlla overflow
  useEffect(() => {
    if (textRef.current && previewRef.current) {
      const textHeight = textRef.current.scrollHeight;
      const textWidth = textRef.current.scrollWidth;
      const containerHeight = customHeight - (selectedPreset.padding * 2);
      const containerWidth = customWidth - (selectedPreset.padding * 2);
      
      const overflow = textHeight > containerHeight || textWidth > containerWidth;
      setIsOverflow(overflow);
      onOverflow?.(overflow);
    }
  }, [text, fontSize, selectedFont, customWidth, customHeight, selectedPreset, onOverflow]);

  const applyPreset = (preset: typeof TEXT_BOX_PRESETS[0]) => {
    setSelectedPreset(preset);
    setCustomWidth(preset.width);
    setCustomHeight(preset.height);
    // Calcola font size ottimale per il preset
    const optimalSize = Math.floor(preset.height / (preset.lines + 1));
    setFontSize(Math.min(Math.max(optimalSize, 6), 16));
  };

  const calculateCharLimit = () => {
    const avgCharWidth = fontSize * 0.6;
    const usableWidth = customWidth - (selectedPreset.padding * 2);
    const charsPerLine = Math.floor(usableWidth / avgCharWidth);
    const lines = Math.floor((customHeight - selectedPreset.padding * 2) / (fontSize * 1.2));
    return charsPerLine * lines;
  };

  if (compact) {
    return (
      <div className="space-y-2">
        {/* Compact Preview */}
        <div 
          className="relative rounded overflow-hidden"
          style={{
            width: Math.min(customWidth, 200),
            height: Math.min(customHeight, 60),
            backgroundColor: bgColor,
            border: showBorder ? `2px solid ${borderColor}` : 'none',
          }}
        >
          <div
            ref={textRef}
            style={{
              fontFamily: selectedFont.family,
              fontSize: `${fontSize}px`,
              color: textColor,
              padding: `${selectedPreset.padding}px`,
              lineHeight: 1.2,
              overflow: 'hidden',
              imageRendering: 'pixelated',
            }}
          >
            {text || 'Preview text...'}
          </div>
          
          {isOverflow && (
            <div className="absolute top-0 right-0 p-0.5">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
            </div>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          {isOverflow ? (
            <Badge variant="destructive" className="text-micro">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Testo troppo lungo!
            </Badge>
          ) : (
            <Badge variant="outline" className="text-micro border-green-500/30 text-green-400">
              <Check className="h-3 w-3 mr-1" />
              OK
            </Badge>
          )}
          <span className="text-micro text-muted-foreground">
            {text.length}/{calculateCharLimit()} char
          </span>
        </div>
      </div>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="p-3 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type className="h-5 w-5 text-sky-400" />
            <CardTitle className="text-base">{t('pixelFontPreviewComp.pixelFontPreview')}</CardTitle>
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7">
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">{t('pixelFontPreviewComp.impostazioniPreview')}</h4>
                
                {/* Font Selection */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('pixelFontPreviewComp.font')}</label>
                  <Select 
                    value={selectedFont.name} 
                    onValueChange={(v) => setSelectedFont(PIXEL_FONTS.find(f => f.name === v) || PIXEL_FONTS[0])}
                  >
                    <SelectTrigger className="bg-muted/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIXEL_FONTS.map(font => (
                        <SelectItem key={font.name} value={font.name}>
                          <span style={{ fontFamily: font.family }}>{font.name}</span>
                          <span className="text-muted-foreground ml-2">({font.style})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Preset Selection */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('pixelFontPreviewComp.presetBox')}</label>
                  <Select 
                    value={selectedPreset.name} 
                    onValueChange={(v) => {
                      const preset = TEXT_BOX_PRESETS.find(p => p.name === v);
                      if (preset) applyPreset(preset);
                    }}
                  >
                    <SelectTrigger className="bg-muted/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_BOX_PRESETS.map(preset => (
                        <SelectItem key={preset.name} value={preset.name}>
                          {preset.name} ({preset.width}×{preset.height})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Font Size */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Font Size: {fontSize}px
                  </label>
                  <Slider
                    value={[fontSize]}
                    onValueChange={([v]) => setFontSize(v)}
                    min={6}
                    max={24}
                    step={1}
                  />
                </div>

                {/* Custom Dimensions */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">{t('pixelFontPreviewComp.larghezza')}</label>
                    <Input
                      type="number"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(Number(e.target.value))}
                      className="bg-muted/50 border-border h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">{t('pixelFontPreviewComp.altezza')}</label>
                    <Input
                      type="number"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(Number(e.target.value))}
                      className="bg-muted/50 border-border h-8"
                    />
                  </div>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">{t('pixelFontPreviewComp.sfondo')}</label>
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">{t('pixelFontPreviewComp.testo')}</label>
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">{t('pixelFontPreviewComp.bordo')}</label>
                    <input
                      type="color"
                      value={borderColor}
                      onChange={(e) => setBorderColor(e.target.value)}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Quick Presets */}
        <div className="flex gap-1 mt-1 flex-wrap">
          {TEXT_BOX_PRESETS.slice(0, 4).map(preset => (
            <Badge
              key={preset.name}
              variant={selectedPreset.name === preset.name ? 'default' : 'outline'}
              className="text-micro cursor-pointer"
              onClick={() => applyPreset(preset)}
            >
              {preset.name}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1">
        {/* Preview Container */}
        <div className="flex justify-center mb-2">
          <div 
            ref={previewRef}
            className="relative transition-all duration-200"
            style={{
              width: customWidth,
              height: customHeight,
              backgroundColor: bgColor,
              border: showBorder ? `3px solid ${borderColor}` : 'none',
              borderRadius: '4px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.5)',
              imageRendering: 'pixelated',
            }}
          >
            {/* Pixel border effect */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: showBorder ? `
                  inset 2px 2px 0 rgba(255,255,255,0.1),
                  inset -2px -2px 0 rgba(0,0,0,0.3)
                ` : 'none',
              }}
            />
            
            <div
              ref={textRef}
              className="h-full overflow-hidden"
              style={{
                fontFamily: fontsLoaded ? selectedFont.family : 'monospace',
                fontSize: `${fontSize}px`,
                color: textColor,
                padding: `${selectedPreset.padding}px`,
                lineHeight: 1.3,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {text || 'Inserisci il testo tradotto...'}
            </div>

            {/* Overflow indicator */}
            {isOverflow && (
              <div className="absolute bottom-1 right-1 animate-pulse">
                <AlertTriangle className="h-4 w-4 text-amber-500 drop-shadow-lg" />
              </div>
            )}
          </div>
        </div>

        {/* Comparison with original */}
        {originalText && (
          <div className="mb-4 p-2 bg-muted/30 rounded border border-border/50">
            <div className="text-2xs text-muted-foreground mb-1">{t('pixelFontPreviewComp.originale')}</div>
            <div 
              className="text-xs text-muted-foreground"
              style={{ fontFamily: selectedFont.family, fontSize: `${fontSize}px` }}
            >
              {originalText}
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOverflow ? (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Testo troppo lungo!
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                <Check className="h-3 w-3 mr-1" />
                Dimensione OK
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{text.length} caratteri</span>
            <span>~{calculateCharLimit()} max</span>
            <span>{customWidth}×{customHeight}px</span>
          </div>
        </div>

        {/* Overflow Warning Details */}
        {isOverflow && (
          <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[11px]">
            <p className="text-amber-400">
              ⚠️ Il testo tradotto supera lo spazio disponibile. 
              Considera di abbreviare la traduzione di {text.length - calculateCharLimit()} caratteri 
              o aumentare le dimensioni del box.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
