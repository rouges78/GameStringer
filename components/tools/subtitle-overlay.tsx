'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Play, 
  Settings,
  Eye,
  EyeOff,
  Monitor,
  Subtitles,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import {
  SubtitleConfig,
  DEFAULT_CONFIG,
  STYLE_PRESETS,
  saveConfig,
  loadConfig,
} from '@/lib/subtitle-overlay';
import { useTranslation } from '@/lib/i18n';

// La cattura live NON è collegata: nessun OCR/hook alimenta questa pagina.
// Prima "Avvia cattura" generava ogni 4 s un sottotitolo a caso da 5 frasi
// fisse, li accumulava nella cronologia e li esportava in SRT/VTT come se
// fossero stati catturati. Resta l'anteprima dello stile; l'avvio è
// disabilitato finché non esiste una sorgente vera.
export function SubtitleOverlay() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<SubtitleConfig>(DEFAULT_CONFIG);
  const [previewText, setPreviewText] = useState('Hello, how are you?');
  const [previewTranslation, setPreviewTranslation] = useState('Ciao, come stai?');
  const [showPreview, setShowPreview] = useState(true);
  
  const _overlayRef = useRef<HTMLDivElement>(null);

  // Carica config salvata
  useEffect(() => {
    const saved = loadConfig();
    setConfig(saved);
  }, []);

  // Salva config quando cambia
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const handlePresetChange = (preset: string) => {
    if (STYLE_PRESETS[preset]) {
      setConfig(prev => ({ ...prev, ...STYLE_PRESETS[preset] }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600 via-teal-500 to-cyan-600 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <Subtitles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{t('subtitleOverlay.title')}</h2>
              <p className="text-white/70 text-2xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{t('subtitleOverlay.subtitle')}</p>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-3">
            <Button disabled variant="outline" className="border-white/50 text-white hover:bg-white/10 hover:border-white" size="lg">
              <Play className="h-5 w-5 mr-2" />
              {t('subtitleOverlay.startCapture')}
            </Button>
          </div>
        </div>
      </div>
        
      {/* Cattura live non ancora collegata */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
        <p className="text-sm text-amber-500">{t('subtitleOverlay.notConnected')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20">
                  <Monitor className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="text-emerald-100">{t('subtitleOverlay.livePreview')}</span>
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="hover:bg-emerald-500/20"
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
                        {previewText}
                      </div>
                    )}
                    <div style={{ 
                      fontSize: config.fontSize / 1.5, 
                      color: config.textColor,
                      fontFamily: config.fontFamily,
                    }}>
                      {previewTranslation}
                    </div>
                    {config.showOriginal && config.originalPosition === 'below' && (
                      <div style={{ 
                        fontSize: config.originalFontSize / 1.5, 
                        color: config.originalColor,
                        marginTop: 2,
                        opacity: 0.8,
                      }}>
                        {previewText}
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
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20">
                <Settings className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="text-emerald-100">{t('subtitleOverlay.settings')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="style" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-8">
                <TabsTrigger value="style" className="text-xs">{t('subtitleOverlay.style')}</TabsTrigger>
                <TabsTrigger value="position" className="text-xs">{t('subtitleOverlay.position')}</TabsTrigger>
                <TabsTrigger value="timing" className="text-xs">{t('subtitleOverlay.timing')}</TabsTrigger>
              </TabsList>

              <TabsContent value="style" className="space-y-3 mt-3">
                {/* Preset */}
                <div>
                  <Label className="text-xs">{t('subtitleOverlay.preset')}</Label>
                  <Select onValueChange={handlePresetChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={t('subtitleOverlay.choosePreset')} />
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
                    <Label className="text-xs">{t('subtitleOverlay.textColor')}</Label>
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
                    <Label className="text-xs">{t('subtitleOverlay.background')}</Label>
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
                    <Label className="text-xs">{t('subtitleOverlay.fontSize')}</Label>
                    <span className="text-xs text-muted-foreground">{config.fontSize}px</span>
                  </div>
                  <Slider
                    value={[config.fontSize]}
                    onValueChange={([v]) => setConfig(c => ({ ...c, fontSize: v }))}
                    min={12}
                    max={48}
                    step={1}
                    className="mt-1 [&_[data-slot=range]]:bg-teal-500 [&_[data-slot=thumb]]:bg-teal-500 [&_[data-slot=thumb]]:border-teal-500"
                  />
                </div>

                {/* Opacity */}
                <div>
                  <div className="flex justify-between">
                    <Label className="text-xs">{t('subtitleOverlay.backgroundOpacity')}</Label>
                    <span className="text-xs text-muted-foreground">{Math.round(config.backgroundOpacity * 100)}%</span>
                  </div>
                  <Slider
                    value={[config.backgroundOpacity * 100]}
                    onValueChange={([v]) => setConfig(c => ({ ...c, backgroundOpacity: v / 100 }))}
                    min={0}
                    max={100}
                    step={5}
                    className="mt-1 [&_[data-slot=range]]:bg-teal-500 [&_[data-slot=thumb]]:bg-teal-500 [&_[data-slot=thumb]]:border-teal-500"
                  />
                </div>

                {/* Shadow */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t('subtitleOverlay.textShadow')}</Label>
                  <Switch
                    checked={config.shadow}
                    onCheckedChange={(v) => setConfig(c => ({ ...c, shadow: v }))}
                    className="data-[state=checked]:bg-teal-500"
                  />
                </div>
              </TabsContent>

              <TabsContent value="position" className="space-y-3 mt-3">
                {/* Position */}
                <div>
                  <Label className="text-xs">{t('subtitleOverlay.position')}</Label>
                  <Select 
                    value={config.position}
                    onValueChange={(v: 'top' | 'bottom' | 'center') => setConfig(c => ({ ...c, position: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">{t('subtitleOverlay.positionTop')}</SelectItem>
                      <SelectItem value="center">{t('subtitleOverlay.positionCenter')}</SelectItem>
                      <SelectItem value="bottom">{t('subtitleOverlay.positionBottom')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Show original */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t('subtitleOverlay.showOriginal')}</Label>
                  <Switch
                    checked={config.showOriginal}
                    onCheckedChange={(v) => setConfig(c => ({ ...c, showOriginal: v }))}
                    className="data-[state=checked]:bg-teal-500"
                  />
                </div>

                {config.showOriginal && (
                  <div>
                    <Label className="text-xs">{t('subtitleOverlay.originalPosition')}</Label>
                    <Select 
                      value={config.originalPosition}
                      onValueChange={(v: 'above' | 'below' | 'inline') => setConfig(c => ({ ...c, originalPosition: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="above">{t('subtitleOverlay.positionAbove')}</SelectItem>
                        <SelectItem value="below">{t('subtitleOverlay.positionBelow')}</SelectItem>
                        <SelectItem value="inline">{t('subtitleOverlay.positionInline')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Margin */}
                <div>
                  <div className="flex justify-between">
                    <Label className="text-xs">{t('subtitleOverlay.margin')}</Label>
                    <span className="text-xs text-muted-foreground">{config.margin}px</span>
                  </div>
                  <Slider
                    value={[config.margin]}
                    onValueChange={([v]) => setConfig(c => ({ ...c, margin: v }))}
                    min={0}
                    max={100}
                    step={4}
                    className="mt-1 [&_[data-slot=range]]:bg-teal-500 [&_[data-slot=thumb]]:bg-teal-500 [&_[data-slot=thumb]]:border-teal-500"
                  />
                </div>
              </TabsContent>

              <TabsContent value="timing" className="space-y-3 mt-3">
                {/* Duration */}
                <div>
                  <div className="flex justify-between">
                    <Label className="text-xs">{t('subtitleOverlay.displayDuration')}</Label>
                    <span className="text-xs text-muted-foreground">{config.displayDuration / 1000}s</span>
                  </div>
                  <Slider
                    value={[config.displayDuration]}
                    onValueChange={([v]) => setConfig(c => ({ ...c, displayDuration: v }))}
                    min={1000}
                    max={15000}
                    step={500}
                    className="mt-1 [&_[data-slot=range]]:bg-teal-500 [&_[data-slot=thumb]]:bg-teal-500 [&_[data-slot=thumb]]:border-teal-500"
                  />
                </div>

                {/* Fade in */}
                <div>
                  <div className="flex justify-between">
                    <Label className="text-xs">{t('subtitleOverlay.fadeIn')}</Label>
                    <span className="text-xs text-muted-foreground">{config.fadeInDuration}ms</span>
                  </div>
                  <Slider
                    value={[config.fadeInDuration]}
                    onValueChange={([v]) => setConfig(c => ({ ...c, fadeInDuration: v }))}
                    min={0}
                    max={1000}
                    step={50}
                    className="mt-1 [&_[data-slot=range]]:bg-teal-500 [&_[data-slot=thumb]]:bg-teal-500 [&_[data-slot=thumb]]:border-teal-500"
                  />
                </div>

                {/* Fade out */}
                <div>
                  <div className="flex justify-between">
                    <Label className="text-xs">{t('subtitleOverlay.fadeOut')}</Label>
                    <span className="text-xs text-muted-foreground">{config.fadeOutDuration}ms</span>
                  </div>
                  <Slider
                    value={[config.fadeOutDuration]}
                    onValueChange={([v]) => setConfig(c => ({ ...c, fadeOutDuration: v }))}
                    min={0}
                    max={1000}
                    step={50}
                    className="mt-1 [&_[data-slot=range]]:bg-teal-500 [&_[data-slot=thumb]]:bg-teal-500 [&_[data-slot=thumb]]:border-teal-500"
                  />
                </div>

                {/* Animation */}
                <div>
                  <Label className="text-xs">{t('subtitleOverlay.animation')}</Label>
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
    </div>
  );
}




