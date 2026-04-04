'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, Cpu, Cloud, Zap, RefreshCw, AlertTriangle, HardDrive, Thermometer } from 'lucide-react';
import { vramManager, type VramConfig, type VramTier, type SystemStats } from '@/lib/vram-manager';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';

const TIER_COLORS: Record<VramTier, string> = {
  ultra: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  high: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  low: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  minimal: 'text-red-400 bg-red-500/10 border-red-500/20',
  cloud: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
};

function getTierLabels(t: (key: string) => string): Record<VramTier, string> {
  return {
    ultra: t('vramManager.tierUltra'),
    high: t('vramManager.tierHigh'),
    medium: t('vramManager.tierMedium'),
    low: t('vramManager.tierLow'),
    minimal: t('vramManager.tierMinimal'),
    cloud: t('vramManager.tierCloud'),
  };
}

export function VramSettingsCard() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<VramConfig>(vramManager.getConfig());
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [tier, setTier] = useState<VramTier>('cloud');
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    vramManager.init();
    setConfig(vramManager.getConfig());
    setStats(vramManager.getCurrentStats());
    setTier(vramManager.getCurrentTier());

    const unsub = vramManager.on((event, data) => {
      if (event === 'stats-update') {
        setStats(data.stats);
        setTier(vramManager.getCurrentTier());
      }
    });

    return unsub;
  }, []);

  const updateConfig = (partial: Partial<VramConfig>) => {
    const newConfig = { ...config, ...partial };
    setConfig(newConfig);
    vramManager.updateConfig(partial);
  };

  const handleRefresh = async () => {
    setPolling(true);
    await vramManager.poll();
    setStats(vramManager.getCurrentStats());
    setTier(vramManager.getCurrentTier());
    setPolling(false);
    toast.success(t('vramManager.statsUpdated'));
  };

  const recommendation = vramManager.getRecommendation();
  const activeModel = vramManager.getActiveModel();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Monitor className="h-5 w-5 text-violet-500" />
            <span>{t('vramManager.title')}</span>
            <Badge className={`text-2xs px-2 py-0 border ${TIER_COLORS[tier]}`}>
              {getTierLabels(t)[tier]}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={polling}>
            <RefreshCw className={`h-4 w-4 ${polling ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stato attuale GPU */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/50 space-y-1">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{t('vramManager.gpu')}</span>
              </div>
              <p className="text-xs font-semibold text-slate-300 truncate">{stats.gpu_name}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/50 space-y-1">
              <div className="flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{t('vramManager.vram')}</span>
              </div>
              <p className={`text-xs font-bold ${stats.vram_usage_percent > 85 ? 'text-red-400' : stats.vram_usage_percent > 65 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {stats.vram_used_mb}MB / {stats.vram_total_mb}MB ({stats.vram_usage_percent.toFixed(0)}%)
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/50 space-y-1">
              <div className="flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{t('vramManager.ram')}</span>
              </div>
              <p className="text-xs font-semibold text-slate-300">
                {stats.ram_used_mb}MB / {stats.ram_total_mb}MB ({stats.ram_usage_percent.toFixed(0)}%)
              </p>
            </div>
            {stats.gpu_temp_celsius !== null && (
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/50 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Thermometer className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{t('vramManager.temp')}</span>
                </div>
                <p className={`text-xs font-bold ${stats.gpu_temp_celsius > 80 ? 'text-red-400' : stats.gpu_temp_celsius > 65 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {stats.gpu_temp_celsius.toFixed(0)}°C
                </p>
              </div>
            )}
          </div>
        )}

        {/* Modello attivo */}
        <div className="p-3 rounded-xl bg-indigo-500/[0.04] border border-indigo-500/15 flex items-center gap-3">
          {activeModel.provider === 'local' ? (
            <HardDrive className="h-5 w-5 text-emerald-400" />
          ) : (
            <Cloud className="h-5 w-5 text-violet-400" />
          )}
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-300">
              {t('vramManager.recommendedModel')}: <span className={activeModel.provider === 'local' ? 'text-emerald-400' : 'text-violet-400'}>{activeModel.model}</span>
            </p>
            <p className="text-2xs text-slate-500">{recommendation.reason}</p>
          </div>
          <Badge variant="outline" className="text-micro">
            {activeModel.provider === 'local' ? t('vramManager.local') : t('vramManager.cloud')}
          </Badge>
        </div>

        {/* Warning */}
        {stats?.warning && (
          <div className="p-3 rounded-xl bg-amber-500/[0.05] border border-amber-500/15 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">{stats.warning}</p>
          </div>
        )}

        {/* Configurazione */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-semibold">{t('vramManager.autoSwitch')}</Label>
              <p className="text-2xs text-slate-500">{t('vramManager.autoSwitchDesc')}</p>
            </div>
            <Switch checked={config.autoSwitch} onCheckedChange={(v) => updateConfig({ autoSwitch: v })} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-semibold">{t('vramManager.preferLocal')}</Label>
              <p className="text-2xs text-slate-500">{t('vramManager.preferLocalDesc')}</p>
            </div>
            <Switch checked={config.preferLocalModels} onCheckedChange={(v) => updateConfig({ preferLocalModels: v })} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-semibold">{t('vramManager.alertHighUsage')}</Label>
              <p className="text-2xs text-slate-500">{t('vramManager.alertHighUsageDesc')}</p>
            </div>
            <Switch checked={config.alertOnHighUsage} onCheckedChange={(v) => updateConfig({ alertOnHighUsage: v })} />
          </div>

          {config.alertOnHighUsage && (
            <div className="space-y-2">
              <Label className="text-xs">{t('vramManager.alertThreshold')}: {config.alertThresholdPercent}%</Label>
              <Slider
                value={[config.alertThresholdPercent]}
                onValueChange={(v) => updateConfig({ alertThresholdPercent: v[0] })}
                min={50}
                max={95}
                step={5}
                className="w-full [&_[data-slot=range]]:bg-amber-500 [&_[data-slot=thumb]]:bg-amber-500 [&_[data-slot=thumb]]:border-amber-500"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">{t('vramManager.cloudFallback')}</Label>
            <Select value={config.cloudProvider} onValueChange={(v) => updateConfig({ cloudProvider: v as string })}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t('vramManager.cloudAuto')}</SelectItem>
                <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                <SelectItem value="claude">Anthropic (Claude)</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tier table */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('vramManager.tierAndModels')}</Label>
          <div className="space-y-1">
            {(['ultra', 'high', 'medium', 'low', 'minimal', 'cloud'] as VramTier[]).map(tierKey => {
              const rec = vramManager.getRecommendationForTier(tierKey);
              const isActive = tierKey === tier;
              const tierLabels = getTierLabels(t);
              return (
                <div key={tierKey} className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${isActive ? TIER_COLORS[tierKey] : 'bg-slate-900/30 border-slate-800/30'}`}>
                  <span className={`text-2xs font-bold w-14 ${isActive ? '' : 'text-slate-500'}`}>{tierLabels[tierKey].split(' ')[0]}</span>
                  <span className="text-2xs text-slate-500 w-20">{tierLabels[tierKey].match(/\(.*\)/)?.[0] || ''}</span>
                  <span className={`text-2xs font-mono flex-1 ${isActive ? 'font-bold' : 'text-slate-600'}`}>
                    {rec.localModel || '—'}
                  </span>
                  <span className="text-2xs text-slate-600 font-mono">{rec.cloudFallback}</span>
                  <span className="text-micro text-slate-600">{t('vramManager.batch')} {rec.batchSize}</span>
                  {isActive && <Zap className="h-3 w-3 text-amber-400" />}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
