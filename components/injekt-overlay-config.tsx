'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ColorPicker } from '@/components/ui/color-picker';
import { 
  Monitor,
  Palette,
  Type,
  Move,
  Eye,
  EyeOff,
  Settings2,
  Sparkles,
  Layers,
  Maximize2,
  Download,
  Upload,
  RotateCcw
} from 'lucide-react';

export interface OverlayConfig {
  enabled: boolean;
  position: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  offset: { x: number; y: number };
  opacity: number;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  fontSize: number;
  fontFamily: string;
  padding: number;
  showOriginal: boolean;
  showTranslated: boolean;
  animationEnabled: boolean;
  animationType: 'fade' | 'slide' | 'scale' | 'none';
  animationDuration: number;
  blurBackground: boolean;
  blurAmount: number;
  shadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  maxWidth: number;
  maxHeight: number;
  autoHide: boolean;
  autoHideDelay: number;
  hotkey: string;
}

const defaultConfig: OverlayConfig = {
  enabled: true,
  position: 'bottom-center',
  offset: { x: 0, y: -50 },
  opacity: 90,
  backgroundColor: '#000000',
  textColor: '#FFFFFF',
  borderColor: '#333333',
  borderWidth: 1,
  borderRadius: 8,
  fontSize: 16,
  fontFamily: 'Arial',
  padding: 16,
  showOriginal: true,
  showTranslated: true,
  animationEnabled: true,
  animationType: 'fade',
  animationDuration: 300,
  blurBackground: true,
  blurAmount: 4,
  shadow: true,
  shadowColor: '#000000',
  shadowBlur: 10,
  maxWidth: 600,
  maxHeight: 200,
  autoHide: false,
  autoHideDelay: 5000,
  hotkey: 'Ctrl+Shift+T'
};

interface InjektOverlayConfigProps {
  config: OverlayConfig;
  onConfigChange: (config: OverlayConfig) => void;
}

export function InjektOverlayConfig({ config, onConfigChange }: InjektOverlayConfigProps) {
  const [localConfig, setLocalConfig] = useState<OverlayConfig>(config);
  const [previewText, setPreviewText] = useState({
    original: 'Hello, adventurer!',
    translated: 'Ciao, avventuriero!'
  });

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (key: keyof OverlayConfig, value: any) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleOffsetChange = (axis: 'x' | 'y', value: number) => {
    const newOffset = { ...localConfig.offset, [axis]: value };
    handleChange('offset', newOffset);
  };

  const resetToDefaults = () => {
    setLocalConfig(defaultConfig);
    onConfigChange(defaultConfig);
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(localConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'overlay-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          setLocalConfig(imported);
          onConfigChange(imported);
        } catch (error) {
          console.error('Errore importazione configurazione:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const positions = [
    { value: 'top-left', label: 'In alto a sinistra' },
    { value: 'top-center', label: 'In alto al centro' },
    { value: 'top-right', label: 'In alto a destra' },
    { value: 'center-left', label: 'Centro sinistra' },
    { value: 'center', label: 'Centro' },
    { value: 'center-right', label: 'Centro destra' },
    { value: 'bottom-left', label: 'In basso a sinistra' },
    { value: 'bottom-center', label: 'In basso al centro' },
    { value: 'bottom-right', label: 'In basso a destra' }
  ];

  const fonts = [
    'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 
    'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS',
    'Impact', 'Comic Sans MS'
  ];

  const animations = [
    { value: 'none', label: 'Nessuna' },
    { value: 'fade', label: 'Dissolvenza' },
    { value: 'slide', label: 'Scorrimento' },
    { value: 'scale', label: 'Scala' }
  ];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="appearance" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="appearance">Aspetto</TabsTrigger>
          <TabsTrigger value="position">Posizione</TabsTrigger>
          <TabsTrigger value="animation">Animazione</TabsTrigger>
          <TabsTrigger value="behavior">Comportamento</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Colori e Stile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Colore Sfondo</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={localConfig.backgroundColor}
                      onChange={(e) => handleChange('backgroundColor', e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={localConfig.backgroundColor}
                      onChange={(e) => handleChange('backgroundColor', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Colore Testo</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={localConfig.textColor}
                      onChange={(e) => handleChange('textColor', e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={localConfig.textColor}
                      onChange={(e) => handleChange('textColor', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Opacità</Label>
                  <span className="text-sm text-muted-foreground">{localConfig.opacity}%</span>
                </div>
                <Slider
                  value={[localConfig.opacity]}
                  onValueChange={([value]) => handleChange('opacity', value)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Font</Label>
                  <Select
                    value={localConfig.fontFamily}
                    onValueChange={(value) => handleChange('fontFamily', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fonts.map((font) => (
                        <SelectItem key={font} value={font}>
                          <span style={{ fontFamily: font }}>{font}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Dimensione Font</Label>
                    <span className="text-sm text-muted-foreground">{localConfig.fontSize}px</span>
                  </div>
                  <Slider
                    value={[localConfig.fontSize]}
                    onValueChange={([value]) => handleChange('fontSize', value)}
                    min={10}
                    max={32}
                    step={1}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Raggio Bordo</Label>
                  <span className="text-sm text-muted-foreground">{localConfig.borderRadius}px</span>
                </div>
                <Slider
                  value={[localConfig.borderRadius]}
                  onValueChange={([value]) => handleChange('borderRadius', value)}
                  min={0}
                  max={20}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Padding</Label>
                  <span className="text-sm text-muted-foreground">{localConfig.padding}px</span>
                </div>
                <Slider
                  value={[localConfig.padding]}
                  onValueChange={([value]) => handleChange('padding', value)}
                  min={8}
                  max={32}
                  step={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Effetti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Ombra</Label>
                  <p className="text-sm text-muted-foreground">Aggiungi ombra all\'overlay</p>
                </div>
                <Switch
                  checked={localConfig.shadow}
                  onCheckedChange={(checked) => handleChange('shadow', checked)}
                />
              </div>

              {localConfig.shadow && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="space-y-2">
                    <Label>Colore Ombra</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={localConfig.shadowColor}
                        onChange={(e) => handleChange('shadowColor', e.target.value)}
                        className="w-20 h-10"
                      />
                      <Input
                        type="text"
                        value={localConfig.shadowColor}
                        onChange={(e) => handleChange('shadowColor', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Sfocatura Ombra</Label>
                      <span className="text-sm text-muted-foreground">{localConfig.shadowBlur}px</span>
                    </div>
                    <Slider
                      value={[localConfig.shadowBlur]}
                      onValueChange={([value]) => handleChange('shadowBlur', value)}
                      min={0}
                      max={30}
                      step={1}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sfocatura Sfondo</Label>
                  <p className="text-sm text-muted-foreground">Sfoca lo sfondo dietro l\'overlay</p>
                </div>
                <Switch
                  checked={localConfig.blurBackground}
                  onCheckedChange={(checked) => handleChange('blurBackground', checked)}
                />
              </div>

              {localConfig.blurBackground && (
                <div className="ml-6 space-y-2">
                  <div className="flex justify-between">
                    <Label>Intensità Sfocatura</Label>
                    <span className="text-sm text-muted-foreground">{localConfig.blurAmount}px</span>
                  </div>
                  <Slider
                    value={[localConfig.blurAmount]}
                    onValueChange={([value]) => handleChange('blurAmount', value)}
                    min={0}
                    max={20}
                    step={1}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="position" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Move className="w-5 h-5" />
                Posizionamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Posizione Base</Label>
                <Select
                  value={localConfig.position}
                  onValueChange={(value: any) => handleChange('position', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((pos) => (
                      <SelectItem key={pos.value} value={pos.value}>
                        {pos.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Offset X</Label>
                    <span className="text-sm text-muted-foreground">{localConfig.offset.x}px</span>
                  </div>
                  <Slider
                    value={[localConfig.offset.x]}
                    onValueChange={([value]) => handleOffsetChange('x', value)}
                    min={-200}
                    max={200}
                    step={10}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Offset Y</Label>
                    <span className="text-sm text-muted-foreground">{localConfig.offset.y}px</span>
                  </div>
                  <Slider
                    value={[localConfig.offset.y]}
                    onValueChange={([value]) => handleOffsetChange('y', value)}
                    min={-200}
                    max={200}
                    step={10}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Larghezza Massima</Label>
                    <span className="text-sm text-muted-foreground">{localConfig.maxWidth}px</span>
                  </div>
                  <Slider
                    value={[localConfig.maxWidth]}
                    onValueChange={([value]) => handleChange('maxWidth', value)}
                    min={200}
                    max={1200}
                    step={50}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Altezza Massima</Label>
                    <span className="text-sm text-muted-foreground">{localConfig.maxHeight}px</span>
                  </div>
                  <Slider
                    value={[localConfig.maxHeight]}
                    onValueChange={([value]) => handleChange('maxHeight', value)}
                    min={100}
                    max={600}
                    step={50}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="animation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                Animazioni
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Abilita Animazioni</Label>
                  <p className="text-sm text-muted-foreground">Anima l\'apparizione dell\'overlay</p>
                </div>
                <Switch
                  checked={localConfig.animationEnabled}
                  onCheckedChange={(checked) => handleChange('animationEnabled', checked)}
                />
              </div>

              {localConfig.animationEnabled && (
                <>
                  <div className="space-y-2">
                    <Label>Tipo Animazione</Label>
                    <Select
                      value={localConfig.animationType}
                      onValueChange={(value: any) => handleChange('animationType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {animations.map((anim) => (
                          <SelectItem key={anim.value} value={anim.value}>
                            {anim.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Durata Animazione</Label>
                      <span className="text-sm text-muted-foreground">{localConfig.animationDuration}ms</span>
                    </div>
                    <Slider
                      value={[localConfig.animationDuration]}
                      onValueChange={([value]) => handleChange('animationDuration', value)}
                      min={100}
                      max={1000}
                      step={50}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                Comportamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Mostra Testo Originale</Label>
                  <p className="text-sm text-muted-foreground">Visualizza il testo originale nell\'overlay</p>
                </div>
                <Switch
                  checked={localConfig.showOriginal}
                  onCheckedChange={(checked) => handleChange('showOriginal', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Mostra Traduzione</Label>
                  <p className="text-sm text-muted-foreground">Visualizza il testo tradotto nell\'overlay</p>
                </div>
                <Switch
                  checked={localConfig.showTranslated}
                  onCheckedChange={(checked) => handleChange('showTranslated', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Nascondi Automaticamente</Label>
                  <p className="text-sm text-muted-foreground">Nascondi l\'overlay dopo un certo tempo</p>
                </div>
                <Switch
                  checked={localConfig.autoHide}
                  onCheckedChange={(checked) => handleChange('autoHide', checked)}
                />
              </div>

              {localConfig.autoHide && (
                <div className="ml-6 space-y-2">
                  <div className="flex justify-between">
                    <Label>Ritardo Nascondimento</Label>
                    <span className="text-sm text-muted-foreground">{localConfig.autoHideDelay}ms</span>
                  </div>
                  <Slider
                    value={[localConfig.autoHideDelay]}
                    onValueChange={([value]) => handleChange('autoHideDelay', value)}
                    min={1000}
                    max={10000}
                    step={500}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Tasto Rapido</Label>
                <Input
                  type="text"
                  value={localConfig.hotkey}
                  onChange={(e) => handleChange('hotkey', e.target.value)}
                  placeholder="Es: Ctrl+Shift+T"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetToDefaults}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Ripristina Default
              </Button>
              
              <Button variant="outline" onClick={exportConfig}>
                <Download className="w-4 h-4 mr-2" />
                Esporta
              </Button>
              
              <Label htmlFor="import-overlay-config" className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Importa
                  </span>
                </Button>
                <Input
                  id="import-overlay-config"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={importConfig}
                />
              </Label>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Anteprima Overlay
          </CardTitle>
          <CardDescription>
            Visualizza come apparirà l'overlay in gioco
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden" style={{ height: '300px' }}>
            {/* Simulated game background */}
            <div className="absolute inset-0 flex items-center justify-center text-gray-600">
              <p className="text-lg">Sfondo del Gioco</p>
            </div>
            
            {/* Overlay preview */}
            <div
              className="absolute transition-all"
              style={{
                ...getOverlayPosition(localConfig.position, localConfig.offset),
                opacity: localConfig.opacity / 100,
                maxWidth: `${localConfig.maxWidth}px`,
                maxHeight: `${localConfig.maxHeight}px`,
              }}
            >
              <div
                style={{
                  backgroundColor: localConfig.backgroundColor,
                  color: localConfig.textColor,
                  borderRadius: `${localConfig.borderRadius}px`,
                  padding: `${localConfig.padding}px`,
                  fontSize: `${localConfig.fontSize}px`,
                  fontFamily: localConfig.fontFamily,
                  boxShadow: localConfig.shadow 
                    ? `0 0 ${localConfig.shadowBlur}px ${localConfig.shadowColor}`
                    : 'none',
                  backdropFilter: localConfig.blurBackground 
                    ? `blur(${localConfig.blurAmount}px)`
                    : 'none',
                }}
              >
                {localConfig.showOriginal && (
                  <div className="opacity-70">{previewText.original}</div>
                )}
                {localConfig.showTranslated && (
                  <div className="font-semibold">{previewText.translated}</div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getOverlayPosition(position: string, offset: { x: number; y: number }) {
  const base: any = {
    'top-left': { top: 20, left: 20 },
    'top-center': { top: 20, left: '50%', transform: 'translateX(-50%)' },
    'top-right': { top: 20, right: 20 },
    'center-left': { top: '50%', left: 20, transform: 'translateY(-50%)' },
    'center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    'center-right': { top: '50%', right: 20, transform: 'translateY(-50%)' },
    'bottom-left': { bottom: 20, left: 20 },
    'bottom-center': { bottom: 20, left: '50%', transform: 'translateX(-50%)' },
    'bottom-right': { bottom: 20, right: 20 },
  };

  const style = { ...base[position] };
  
  // Apply offset
  if (style.left !== undefined && typeof style.left === 'number') {
    style.left += offset.x;
  }
  if (style.right !== undefined && typeof style.right === 'number') {
    style.right -= offset.x;
  }
  if (style.top !== undefined && typeof style.top === 'number') {
    style.top += offset.y;
  }
  if (style.bottom !== undefined && typeof style.bottom === 'number') {
    style.bottom -= offset.y;
  }

  return style;
}
