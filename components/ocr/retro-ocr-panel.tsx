'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Gamepad2, 
  Monitor, 
  Tv,
  Settings2,
  Wand2,
  ScanLine,
  Contrast,
  ZoomIn,
  Sparkles,
  RotateCcw,
  Play,
  Save,
  Eye
} from 'lucide-react';

interface RetroOcrConfig {
  gameType: string;
  upscaleFactor: number;
  contrastBoost: number;
  threshold: number | null;
  removeDithering: boolean;
  sharpen: boolean;
  invertColors: boolean;
  denoiseLevel: number;
}

const GAME_TYPE_PRESETS = [
  { 
    id: 'auto', 
    name: 'Auto-Detect', 
    icon: Wand2, 
    description: 'Rileva automaticamente il tipo di game',
    color: 'bg-purple-500'
  },
  { 
    id: '8bit', 
    name: '8-bit', 
    icon: Gamepad2, 
    description: 'NES, Master System, Game Boy',
    color: 'bg-green-500'
  },
  { 
    id: '16bit', 
    name: '16-bit', 
    icon: Tv, 
    description: 'SNES, Genesis, PC Engine',
    color: 'bg-blue-500'
  },
  { 
    id: 'dos', 
    name: 'DOS/PC', 
    icon: Monitor, 
    description: 'CGA, EGA, VGA',
    color: 'bg-orange-500'
  },
  { 
    id: 'pc98', 
    name: 'PC-98', 
    icon: Monitor, 
    description: 'games giapponesi PC-98',
    color: 'bg-pink-500'
  },
  { 
    id: 'earlywin', 
    name: 'Early Windows', 
    icon: Monitor, 
    description: 'Windows 3.1, Windows 95',
    color: 'bg-cyan-500'
  }
];

const DEFAULT_CONFIGS: Record<string, RetroOcrConfig> = {
  auto: {
    gameType: 'auto',
    upscaleFactor: 3,
    contrastBoost: 1.5,
    threshold: null,
    removeDithering: false,
    sharpen: true,
    invertColors: false,
    denoiseLevel: 1
  },
  '8bit': {
    gameType: '8bit',
    upscaleFactor: 4,
    contrastBoost: 2.0,
    threshold: 128,
    removeDithering: false,
    sharpen: true,
    invertColors: false,
    denoiseLevel: 0
  },
  '16bit': {
    gameType: '16bit',
    upscaleFactor: 3,
    contrastBoost: 1.5,
    threshold: null,
    removeDithering: false,
    sharpen: true,
    invertColors: false,
    denoiseLevel: 1
  },
  dos: {
    gameType: 'dos',
    upscaleFactor: 3,
    contrastBoost: 1.8,
    threshold: 140,
    removeDithering: true,
    sharpen: true,
    invertColors: false,
    denoiseLevel: 2
  },
  pc98: {
    gameType: 'pc98',
    upscaleFactor: 4,
    contrastBoost: 2.0,
    threshold: 120,
    removeDithering: true,
    sharpen: true,
    invertColors: false,
    denoiseLevel: 1
  },
  earlywin: {
    gameType: 'earlywin',
    upscaleFactor: 2,
    contrastBoost: 1.3,
    threshold: null,
    removeDithering: false,
    sharpen: false,
    invertColors: false,
    denoiseLevel: 0
  }
};

interface RetroOcrPanelProps {
  onConfigChange?: (config: RetroOcrConfig) => void;
  onStartOcr?: (config: RetroOcrConfig) => void;
}

export function RetroOcrPanel({ onConfigChange, onStartOcr }: RetroOcrPanelProps) {
  const [config, setConfig] = useState<RetroOcrConfig>(DEFAULT_CONFIGS.auto);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const updateConfig = (updates: Partial<RetroOcrConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const selectPreset = (presetId: string) => {
    const preset = DEFAULT_CONFIGS[presetId];
    if (preset) {
      setConfig(preset);
      onConfigChange?.(preset);
    }
  };

  const handleStartOcr = () => {
    setIsProcessing(true);
    onStartOcr?.(config);
    // Simulazione - in produzione questo sarebbe gestito dal componente padre
    setTimeout(() => setIsProcessing(false), 2000);
  };

  const resetToDefault = () => {
    selectPreset('auto');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
          <ScanLine className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Retro-Game OCR</h2>
          <p className="text-muted-foreground text-sm">OCR ottimizzato per font pixelati</p>
        </div>
      </div>

      <Tabs defaultValue="presets" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="presets">Preset games</TabsTrigger>
          <TabsTrigger value="advanced">Impostazioni Avanzate</TabsTrigger>
        </TabsList>

        {/* Presets Tab */}
        <TabsContent value="presets" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {GAME_TYPE_PRESETS.map(preset => {
              const Icon = preset.icon;
              const isSelected = config.gameType === preset.id;

              return (
                <Card 
                  key={preset.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    isSelected ? 'ring-2 ring-green-500 shadow-green-500/20' : ''
                  }`}
                  onClick={() => selectPreset(preset.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${preset.color}`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{preset.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {preset.description}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <Badge className="mt-2 bg-green-500">Selezionato</Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Preview of Current Settings */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm">Configurazione Corrente</h4>
                <Button size="sm" variant="ghost" onClick={resetToDefault}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <ZoomIn className="h-4 w-4 text-blue-500" />
                  <span>Upscale: {config.upscaleFactor}x</span>
                </div>
                <div className="flex items-center gap-2">
                  <Contrast className="h-4 w-4 text-orange-500" />
                  <span>Contrasto: {config.contrastBoost.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ScanLine className="h-4 w-4 text-purple-500" />
                  <span>Threshold: {config.threshold ?? 'Off'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  <span>Sharpen: {config.sharpen ? 'On' : 'Off'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Settings Tab */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Parametri Pre-Processing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Upscale Factor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <ZoomIn className="h-4 w-4 text-blue-500" />
                    Upscale Factor
                  </label>
                  <Badge variant="outline">{config.upscaleFactor}x</Badge>
                </div>
                <Slider
                  value={[config.upscaleFactor]}
                  onValueChange={([v]) => updateConfig({ upscaleFactor: v })}
                  min={1}
                  max={8}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Ingrandisce l'immagine preservando i pixel (nearest neighbor)
                </p>
              </div>

              {/* Contrast Boost */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Contrast className="h-4 w-4 text-orange-500" />
                    Contrasto
                  </label>
                  <Badge variant="outline">{config.contrastBoost.toFixed(1)}x</Badge>
                </div>
                <Slider
                  value={[config.contrastBoost * 10]}
                  onValueChange={([v]) => updateConfig({ contrastBoost: v / 10 })}
                  min={10}
                  max={30}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Threshold */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <ScanLine className="h-4 w-4 text-purple-500" />
                    Threshold Binario
                  </label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.threshold !== null}
                      onCheckedChange={(checked) => 
                        updateConfig({ threshold: checked ? 128 : null })
                      }
                    />
                    {config.threshold !== null && (
                      <Badge variant="outline">{config.threshold}</Badge>
                    )}
                  </div>
                </div>
                {config.threshold !== null && (
                  <Slider
                    value={[config.threshold]}
                    onValueChange={([v]) => updateConfig({ threshold: v })}
                    min={50}
                    max={200}
                    step={5}
                    className="w-full"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Converte l'immagine in bianco/nero per miglior riconoscimento
                </p>
              </div>

              {/* Denoise Level */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Denoise Level</label>
                  <Badge variant="outline">{config.denoiseLevel}</Badge>
                </div>
                <Slider
                  value={[config.denoiseLevel]}
                  onValueChange={([v]) => updateConfig({ denoiseLevel: v })}
                  min={0}
                  max={3}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Sharpen</label>
                  <Switch
                    checked={config.sharpen}
                    onCheckedChange={(checked) => updateConfig({ sharpen: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Remove Dithering</label>
                  <Switch
                    checked={config.removeDithering}
                    onCheckedChange={(checked) => updateConfig({ removeDithering: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Inverti Colori</label>
                  <Switch
                    checked={config.invertColors}
                    onCheckedChange={(checked) => updateConfig({ invertColors: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button 
          onClick={handleStartOcr}
          disabled={isProcessing}
          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
        >
          {isProcessing ? (
            <>
              <ScanLine className="h-4 w-4 mr-2 animate-pulse" />
              Elaborazione...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Avvia Retro OCR
            </>
          )}
        </Button>
        <Button variant="outline" size="icon">
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon">
          <Save className="h-4 w-4" />
        </Button>
      </div>

      {/* Tips */}
      <Card className="bg-green-500/10 border-green-500/30">
        <CardContent className="py-3">
          <h4 className="font-medium text-sm text-green-600 mb-2">💡 Suggerimenti</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Per games <strong>8-bit</strong>: usa upscale 4x e threshold alto</li>
            <li>• Per games <strong>DOS</strong>: attiva "Remove Dithering" per palette limitate</li>
            <li>• Per testo <strong>giapponese</strong> (PC-98): usa upscale 4x con sharpen</li>
            <li>• Se il testo è scuro su sfondo chiaro, prova "Inverti Colori"</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}



