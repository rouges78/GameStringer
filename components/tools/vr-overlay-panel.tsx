'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Glasses, Play, Square, Settings, Move3d, Palette, 
  MonitorSpeaker, RefreshCw, Check, AlertTriangle, Eye, EyeOff
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import { 
  vrOverlayService, 
  VROverlayConfig, 
  VR_POSITION_PRESETS, 
  VR_STYLE_PRESETS,
  VRHeadset
} from '@/lib/vr-overlay';

export function VROverlayPanel() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<VROverlayConfig | null>(null);
  const [headset, setHeadset] = useState<VRHeadset | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [activeTab, setActiveTab] = useState('position');

  useEffect(() => {
    setConfig(vrOverlayService.getConfig());
    setHeadset(vrOverlayService.getHeadset());
  }, []);

  const detectHeadset = async () => {
    setIsDetecting(true);
    try {
      const detected = await vrOverlayService.detectHeadset();
      setHeadset(detected);
      if (detected) {
        toast.success(`${t('vrOverlay.headsetDetected')}: ${detected.name}`);
      } else {
        toast.error(t('vrOverlay.noHeadset'));
      }
    } catch (error) {
      toast.error(t('vrOverlay.detectionError'));
    }
    setIsDetecting(false);
  };

  const updateConfig = (updates: Partial<VROverlayConfig>) => {
    if (config) {
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);
      vrOverlayService.updateConfig(updates);
    }
  };

  const applyPositionPreset = (preset: string) => {
    vrOverlayService.applyPositionPreset(preset);
    setConfig(vrOverlayService.getConfig());
    toast.success(t('vrOverlay.positionApplied').replace('{name}', preset));
  };

  const applyStylePreset = (preset: string) => {
    vrOverlayService.applyStylePreset(preset);
    setConfig(vrOverlayService.getConfig());
    toast.success(t('vrOverlay.styleApplied').replace('{name}', preset));
  };

  const toggleOverlay = () => {
    if (isRunning) {
      vrOverlayService.stop();
      setIsRunning(false);
      toast.success(t('vrOverlay.stopped'));
    } else {
      vrOverlayService.start();
      setIsRunning(true);
      toast.success(t('vrOverlay.started'));
    }
  };

  if (!config) return null;

  return (
    <div className="space-y-3">
      {/* Hero Header - Stile verde */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-700 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Glasses className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {t('vrOverlay.title')}
              </h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('vrOverlay.subtitle')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge 
              variant={headset?.isConnected ? 'default' : 'secondary'}
              className={headset?.isConnected ? 'bg-green-500' : 'bg-black/30 border-white/20 text-white'}
            >
              {headset?.isConnected ? headset.name : t('vrOverlay.noHeadset')}
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={detectHeadset}
              disabled={isDetecting}
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white"
            >
              {isDetecting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <MonitorSpeaker className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Warning if no headset */}
      {!headset?.isConnected && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-500">{t('vrOverlay.noHeadsetWarning')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('vrOverlay.noHeadsetDesc')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Preview */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-cyan-500" />
              {t('vrOverlay.preview')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative h-[280px] bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
              {/* Simulated VR view */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-full relative">
                  {/* Grid for depth perception */}
                  <div 
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: 'linear-gradient(rgba(100,200,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(100,200,255,0.3) 1px, transparent 1px)',
                      backgroundSize: '40px 40px',
                      transform: 'perspective(500px) rotateX(60deg)',
                      transformOrigin: 'center bottom',
                    }}
                  />
                  
                  {/* Subtitle preview */}
                  <div 
                    className="absolute left-1/2 transform -translate-x-1/2"
                    style={{
                      ...vrOverlayService.generatePreviewStyle(),
                      bottom: config.position.y < 0 ? '15%' : undefined,
                      top: config.position.y >= 0 ? '15%' : undefined,
                    }}
                  >
                    {previewText}
                  </div>
                </div>
              </div>

              {/* Controls overlay */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <Input
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  placeholder={t('vrOverlay.previewText')}
                  className="max-w-xs text-xs h-8 bg-black/50 border-white/20"
                />
                <Button
                  size="sm"
                  onClick={toggleOverlay}
                  className={isRunning ? 'bg-red-600 hover:bg-red-500' : 'bg-cyan-600 hover:bg-cyan-500'}
                >
                  {isRunning ? (
                    <>
                      <Square className="h-4 w-4 mr-1" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      Start
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4 text-cyan-500" />
              {t('vrOverlay.settings')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="position">
                  <Move3d className="h-3 w-3 mr-1" />
                  {t('vrOverlay.position')}
                </TabsTrigger>
                <TabsTrigger value="style">
                  <Palette className="h-3 w-3 mr-1" />
                  {t('vrOverlay.style')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="position" className="space-y-3 mt-3">
                {/* Position presets */}
                <div className="space-y-2">
                  <Label className="text-xs">{t('vrOverlay.positionPresets')}</Label>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.keys(VR_POSITION_PRESETS).map((preset) => (
                      <Button
                        key={preset}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyPositionPreset(preset)}
                      >
                        {preset.replace('_', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Distance */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">{t('vrOverlay.distance')}</Label>
                    <span className="text-xs text-muted-foreground">{config.lockDistance.toFixed(1)}m</span>
                  </div>
                  <Slider
                    value={[config.lockDistance]}
                    onValueChange={([v]) => updateConfig({ lockDistance: v })}
                    min={0.5}
                    max={5}
                    step={0.1}
                  />
                </div>

                {/* Scale */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">{t('vrOverlay.scale')}</Label>
                    <span className="text-xs text-muted-foreground">{(config.scale * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[config.scale]}
                    onValueChange={([v]) => updateConfig({ scale: v })}
                    min={0.5}
                    max={2}
                    step={0.1}
                  />
                </div>

                {/* Follow head */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t('vrOverlay.followHead')}</Label>
                  <Switch
                    checked={config.followHead}
                    onCheckedChange={(v) => updateConfig({ followHead: v })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="style" className="space-y-3 mt-3">
                {/* Style presets */}
                <div className="space-y-2">
                  <Label className="text-xs">{t('vrOverlay.stylePresets')}</Label>
                  <Select onValueChange={applyStylePreset}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={t('vrOverlay.selectStyle')} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(VR_STYLE_PRESETS).map((preset) => (
                        <SelectItem key={preset} value={preset}>
                          {preset.charAt(0).toUpperCase() + preset.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Font size */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">{t('vrOverlay.fontSize')}</Label>
                    <span className="text-xs text-muted-foreground">{config.style.fontSize}px</span>
                  </div>
                  <Slider
                    value={[config.style.fontSize]}
                    onValueChange={([v]) => updateConfig({ 
                      style: { ...config.style, fontSize: v } 
                    })}
                    min={12}
                    max={48}
                    step={1}
                  />
                </div>

                {/* Opacity */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">{t('vrOverlay.opacity')}</Label>
                    <span className="text-xs text-muted-foreground">{Math.round(config.opacity * 100)}%</span>
                  </div>
                  <Slider
                    value={[config.opacity]}
                    onValueChange={([v]) => updateConfig({ opacity: v })}
                    min={0.1}
                    max={1}
                    step={0.05}
                  />
                </div>

                {/* Background opacity */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">{t('vrOverlay.bgOpacity')}</Label>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(config.style.backgroundOpacity * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[config.style.backgroundOpacity]}
                    onValueChange={([v]) => updateConfig({ 
                      style: { ...config.style, backgroundOpacity: v } 
                    })}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>

                {/* Shadow */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t('vrOverlay.shadow')}</Label>
                  <Switch
                    checked={config.style.shadow}
                    onCheckedChange={(v) => updateConfig({ 
                      style: { ...config.style, shadow: v } 
                    })}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
