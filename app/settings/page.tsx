'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { 
  Save,
  RotateCcw,
  Bell,
  RefreshCw,
  Zap,
  Database,
  Brain,
  Trash2,
  Monitor,
  Eye,
  EyeOff,
  Bug,
  TestTube,
  Cpu,
  HardDrive,
  Globe,
  BookOpen,
  Settings,
  Rss,
  Plus,
  X,
  Play,
  Compass,
  Maximize2,
  Type,
  Columns,
  SlidersHorizontal
} from 'lucide-react';
import { getRssFeeds, saveRssFeeds, defaultRssFeeds, type RssFeed } from '@/components/ui/rss-ticker';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { useVersion } from '@/lib/version';
import { useTranslation } from '@/lib/i18n';
import { InfoTooltip } from '@/components/ui/info-tooltip';

// Lazy-loaded tab components — only loaded when their tab is active
const ProfileNotificationSettings = dynamic(
  () => import('@/components/notifications/profile-notification-settings').then(m => ({ default: m.ProfileNotificationSettings })),
  { ssr: false }
);
const TrayNotificationPreferences = dynamic(
  () => import('@/components/settings/tray-notification-preferences').then(m => ({ default: m.TrayNotificationPreferences })),
  { ssr: false }
);
const FineTuningManager = dynamic(
  () => import('@/components/settings/fine-tuning-manager').then(m => ({ default: m.FineTuningManager })),
  { ssr: false }
);
const AutoBackupSettings = dynamic(
  () => import('@/components/settings/auto-backup-settings').then(m => ({ default: m.AutoBackupSettings })),
  { ssr: false }
);
const MultiLlmComparisonSettings = dynamic(
  () => import('@/components/settings/multi-llm-comparison-settings').then(m => ({ default: m.MultiLlmComparisonSettings })),
  { ssr: false }
);
const OllamaManager = dynamic(
  () => import('@/components/settings/ollama-manager').then(m => ({ default: m.OllamaManager })),
  { ssr: false }
);
const VramSettingsCard = dynamic(
  () => import('@/components/settings/vram-settings-card').then(m => ({ default: m.VramSettingsCard })),
  { ssr: false }
);
const CustomPromptSettings = dynamic(
  () => import('@/components/settings/custom-prompt-settings').then(m => ({ default: m.CustomPromptSettings })),
  { ssr: false }
);

import { invoke } from '@/lib/tauri-api';
import { saveConfig as saveSupabaseConfig, SUPABASE_MIGRATION_SQL } from '@/lib/social/community-hub-backend';
import { clientLogger } from '@/lib/client-logger';
import { useWarmIndex } from '@/hooks/use-warm-index';
import { FeedbackWidget } from '@/components/feedback/feedback-widget';

// Supabase Settings Component
function SupabaseSettingsCard() {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gs_supabase_config');
      if (raw) {
        const cfg = JSON.parse(raw);
        setUrl(cfg.url || '');
        setAnonKey(cfg.anonKey || '');
        setEnabled(cfg.enabled || false);
      }
    } catch {}
  }, []);

  const handleSave = () => {
    saveSupabaseConfig({ url, anonKey, enabled: enabled && !!url && !!anonKey });
    toast.success(t('common.supabaseConfigSaved'));
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_MIGRATION_SQL);
    toast.success(t('common.sqlCopiedToClipboard'));
  };

  return (
    <Card className="p-4">
      <CardHeader className="p-0 pb-4">
        <CardTitle as="h2" className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4 text-emerald-400" />
          {t('settingsPage.communityHubSupabase')}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {t('common.connectTheCommunityHubToASupabaseDatabaseToShareTranslationPacksOnline')}
        </p>
      </CardHeader>
      <CardContent className="p-0 space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${enabled && url && anonKey ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-sm font-medium">
              {enabled && url && anonKey
                ? (t('common.backendActive'))
                : (t('common.backendDisabledLocalOnly'))}
            </span>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t('common.supabaseProjectUrl')}</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('settingsPage.supabaseUrlPh')}
              className="mt-1 text-xs font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">{t('common.anonymousKeyAnonKey')}</Label>
            <div className="relative mt-1">
              <Input
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                type={showKey ? 'text' : 'password'}
                placeholder={t('settingsPage.supabaseKeyPh')}
                className="text-xs font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {t('common.save')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowSql(!showSql)} className="gap-1.5">
            <Database className="h-3.5 w-3.5" />
            {showSql ? (t('common.hideSql')) : (t('common.showSqlSetup'))}
          </Button>
        </div>

        {showSql && (
          <div className="space-y-2">
            <p className="text-2xs text-muted-foreground">
              {t('common.runThisSqlInSupabaseSqlEditorToCreateRequiredTables')}
            </p>
            <div className="relative">
              <pre className="text-micro bg-slate-900 border border-slate-700 rounded-md p-3 max-h-48 overflow-y-auto custom-scrollbar font-mono text-slate-300 whitespace-pre-wrap">
                {SUPABASE_MIGRATION_SQL.trim().substring(0, 2000)}
                {SUPABASE_MIGRATION_SQL.length > 2000 ? t('settingsPage.copyToSeeAll') : ''}
              </pre>
              <Button size="sm" variant="outline" onClick={handleCopySql} className="absolute top-2 right-2 h-6 text-micro gap-1">
                {t('common.copySql')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Cache Stats Component
function CacheStatsCard() {
  const [stats, setStats] = useState<{
    cache_size_mb: number;
    cover_count: number;
    disk_free_gb: number;
    disk_total_gb: number;
    app_data_size_mb: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const loadStats = async () => {
      try {
        const result = await invoke<{ cache_size_mb: number; cover_count: number; disk_free_gb: number; disk_total_gb: number; app_data_size_mb: number; } | null>('get_cache_stats');
        setStats(result);
      } catch (e: unknown) {
        clientLogger.error('Error loading cache stats:', e);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center space-x-2">
            <Monitor className="h-5 w-5 text-green-500" />
            <span>{t('settings.systemConfig')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const diskUsedPercent = stats ? ((stats.disk_total_gb - stats.disk_free_gb) / stats.disk_total_gb * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center space-x-2">
          <Monitor className="h-5 w-5 text-green-500" />
          <span>{t('settings.systemConfig')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* App Data Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <HardDrive className="h-6 w-6 mx-auto mb-2 text-blue-400" />
            <p className="text-2xl font-bold">{stats?.app_data_size_mb.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">{t('settingsPage.appDataMb')}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <Database className="h-6 w-6 mx-auto mb-2 text-purple-400" />
            <p className="text-2xl font-bold">{stats?.cache_size_mb.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">{t('settingsPage.coverCacheMb')}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <Globe className="h-6 w-6 mx-auto mb-2 text-green-400" />
            <p className="text-2xl font-bold">{stats?.cover_count || 0}</p>
            <p className="text-xs text-muted-foreground">{t('settingsPage.savedCovers')}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <Cpu className="h-6 w-6 mx-auto mb-2 text-yellow-400" />
            <p className="text-2xl font-bold">{stats?.disk_free_gb.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">{t('settingsPage.freeGbDisk')}</p>
          </div>
        </div>

        {/* Disk Usage Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('settingsPage.diskSpace')}</span>
            <span>{(stats?.disk_total_gb || 0).toFixed(0)} {t('settingsPage.gbTotal')}</span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500"
              style={{ width: `${Math.min(diskUsedPercent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {diskUsedPercent.toFixed(1)}% {t('settingsPage.diskUsed')} • {(stats?.disk_free_gb || 0).toFixed(1)} {t('settingsPage.gbAvailable')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Lingue di origine più comuni per la pre-indicizzazione (label neutre code+flag).
const INDEX_LANGS: { code: string; label: string }[] = [
  { code: 'en', label: '🇬🇧 EN' },
  { code: 'ja', label: '🇯🇵 JA' },
  { code: 'zh', label: '🇨🇳 ZH' },
  { code: 'ko', label: '🇰🇷 KO' },
  { code: 'fr', label: '🇫🇷 FR' },
  { code: 'de', label: '🇩🇪 DE' },
  { code: 'es', label: '🇪🇸 ES' },
  { code: 'it', label: '🇮🇹 IT' },
  { code: 'ru', label: '🇷🇺 RU' },
  { code: 'pt', label: '🇵🇹 PT' },
];

// AI Quality Card — Reflection + TM semantica + modello embedding.
// I tre campi vivono in gameStringerSettings.translation.* e vengono persistiti
// dal Save globale della pagina (stessa fonte di verità letta da getReflectionMode /
// getSemanticTMMode / detectEmbeddingModel). Lo stato diagnostico è indipendente:
// interroga Ollama in tempo reale per mostrare il modello embedding attivo.
/**
 * Card "Privacy e telemetria" (tab Community): due opt-in, entrambi default OFF.
 * 1. Telemetria di compatibilità → database pubblico "ProtonDB delle traduzioni"
 * 2. Crash report anonimi → ogni errore reale diventa una issue con contesto
 * I valori vivono in settings.privacy.* e sono persistiti dal Save globale
 * (nessuna persistenza propria, come AiQualityCard).
 */
function CompatTelemetryCard({
  compatEnabled,
  crashEnabled,
  benchmarkEnabled,
  onChange,
}: {
  compatEnabled: boolean;
  crashEnabled: boolean;
  benchmarkEnabled: boolean;
  onChange: (key: 'compatTelemetry' | 'crashReports' | 'benchmarkTelemetry', value: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('crash.cardTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Telemetria di compatibilità */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="compat-telemetry" className="text-sm cursor-pointer flex items-center gap-2">
              {t('compat.settingLabel')}
              <Badge variant={compatEnabled ? 'default' : 'secondary'} className="text-2xs">
                {compatEnabled ? 'ON' : 'OFF'}
              </Badge>
            </Label>
            <Switch
              id="compat-telemetry"
              checked={compatEnabled}
              onCheckedChange={(v) => onChange('compatTelemetry', v)}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('compat.settingDesc')}</p>
        </div>
        {/* Crash report anonimi */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="crash-reports" className="text-sm cursor-pointer flex items-center gap-2">
              {t('crash.settingLabel')}
              <Badge variant={crashEnabled ? 'default' : 'secondary'} className="text-2xs">
                {crashEnabled ? 'ON' : 'OFF'}
              </Badge>
            </Label>
            <Switch
              id="crash-reports"
              checked={crashEnabled}
              onCheckedChange={(v) => onChange('crashReports', v)}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('crash.settingDesc')}</p>
        </div>
        {/* Benchmark qualità provider (anonimo) */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="benchmark-telemetry" className="text-sm cursor-pointer flex items-center gap-2">
              {t('benchmark.settingLabel')}
              <Badge variant={benchmarkEnabled ? 'default' : 'secondary'} className="text-2xs">
                {benchmarkEnabled ? 'ON' : 'OFF'}
              </Badge>
            </Label>
            <Switch
              id="benchmark-telemetry"
              checked={benchmarkEnabled}
              onCheckedChange={(v) => onChange('benchmarkTelemetry', v)}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('benchmark.settingDesc')}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t('compat.settingPrivacy')}</p>
      </CardContent>
    </Card>
  );
}

function AiQualityCard({
  reflectionMode,
  semanticTM,
  embeddingModel,
  defaultTargetLang,
  onChange,
}: {
  reflectionMode: 'auto' | 'off' | 'always';
  semanticTM: 'auto' | 'off';
  embeddingModel: string;
  defaultTargetLang: string;
  onChange: (key: 'reflectionMode' | 'semanticTM' | 'embeddingModel', value: string) => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<{ model: string | null; available: boolean } | null>(null);
  const [installed, setInstalled] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);

  // Pre-indicizzazione ("indicizza ora")
  const [indexSrc, setIndexSrc] = useState('en');
  const [indexGame, setIndexGame] = useState('');   // '' = solo TM (+lore)
  const [glossaryGames, setGlossaryGames] = useState<string[]>([]);
  const { run: runWarm, indexing, progress: indexProgress } = useWarmIndex();
  const [indexResult, setIndexResult] = useState<string | null>(null);

  // Giochi con un glossario locale (chiavi dict_<gameId> — stesso formato del
  // retriever semantico): alimentano il select "anche glossario di…".
  useEffect(() => {
    try {
      const games: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('dict_')) {
          const gid = k.slice('dict_'.length);
          try {
            const arr = JSON.parse(localStorage.getItem(k) || '[]');
            if (Array.isArray(arr) && arr.length > 0) games.push(gid);
          } catch { /* voce corrotta: ignora */ }
        }
      }
      setGlossaryGames(games.sort());
    } catch { setGlossaryGames([]); }
  }, []);

  const runWarmIndex = useCallback(async () => {
    setIndexResult(null);
    const res = await runWarm({
      sourceLang: indexSrc,
      targetLang: defaultTargetLang,
      gameId: indexGame || undefined,
    });

    if (!res.ok) {
      setIndexResult(t('semanticIndex.unavailable'));
      return;
    }
    if (res.empty) {
      setIndexResult(t('semanticIndex.emptyTm'));
      return;
    }
    const glPart = res.glTotal > 0
      ? ` · ${t('semanticIndex.glossaryLabel')}: ${res.glIndexed}/${res.glTotal}`
      : '';
    const lorePart = (res.loreTotal > 0 || res.loreIndexed > 0)
      ? ` · ${t('semanticIndex.loreLabel')}: ${res.loreIndexed}/${res.loreTotal}`
      : '';
    setIndexResult(
      `${t('semanticIndex.doneLabel')}: ${res.tmIndexed}/${res.tmTotal} ${t('semanticIndex.vectors')}${glPart}${lorePart}`
    );
  }, [runWarm, indexSrc, indexGame, defaultTargetLang, t]);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const { detectEmbeddingModel, EMBEDDING_MODEL_PREFERENCES } = await import('@/lib/ai/semantic-retriever');
      // Modello attivo (indipendente dalla modalità salvata: mostra sempre la disponibilità)
      const model = await detectEmbeddingModel(true);
      setStatus({ model, available: !!model });
      // Elenco dei modelli embedding installati in Ollama (best-effort)
      try {
        const { ollamaFetch } = await import('@/lib/ai/ollama-http');
        const res = await ollamaFetch('/api/tags', { timeoutMs: 3000 });
        if (res.ok) {
          const data = await res.json();
          const names: string[] = ((data?.models || []) as { name: string }[]).map((m) => m.name);
          setInstalled(
            names.filter((n) => EMBEDDING_MODEL_PREFERENCES.some((p) => n === p || n.startsWith(`${p}:`)))
          );
        } else {
          setInstalled([]);
        }
      } catch {
        setInstalled([]);
      }
    } catch {
      setStatus(null);
      setInstalled([]);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto + modelli installati + eventuale override custom non ancora rilevato
  const modelOptions = Array.from(
    new Set([...installed, ...(embeddingModel ? [embeddingModel] : [])])
  );
  const semanticActive = semanticTM !== 'off';

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center space-x-2">
          <Brain className="h-5 w-5 text-fuchsia-500" />
          <span>{t('aiQuality.title')}</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">{t('aiQuality.desc')}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reflection */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>{t('aiQuality.reflectionTitle')}</Label>
            <InfoTooltip variant="info" content={<p className="text-xs max-w-xs">{t('aiQuality.reflectionDesc')}</p>} />
          </div>
          <Select value={reflectionMode} onValueChange={(v) => onChange('reflectionMode', v)}>
            <SelectTrigger className="md:w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t('aiQuality.modeAuto')}</SelectItem>
              <SelectItem value="off">{t('aiQuality.modeOff')}</SelectItem>
              <SelectItem value="always">{t('aiQuality.modeAlways')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-2xs text-muted-foreground">
            {reflectionMode === 'auto'
              ? t('aiQuality.reflectionAutoHint')
              : reflectionMode === 'always'
                ? t('aiQuality.reflectionAlwaysHint')
                : t('aiQuality.reflectionOffHint')}
          </p>
        </div>

        <Separator />

        {/* TM semantica */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>{t('aiQuality.semanticTitle')}</Label>
            <InfoTooltip variant="info" content={<p className="text-xs max-w-xs">{t('aiQuality.semanticDesc')}</p>} />
          </div>
          <Select value={semanticTM} onValueChange={(v) => onChange('semanticTM', v)}>
            <SelectTrigger className="md:w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t('aiQuality.modeAuto')}</SelectItem>
              <SelectItem value="off">{t('aiQuality.modeOff')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-2xs text-muted-foreground">
            {semanticTM === 'auto' ? t('aiQuality.semanticAutoHint') : t('aiQuality.semanticOffHint')}
          </p>
        </div>

        {/* Modello embedding + diagnostica (solo se la TM semantica è attiva) */}
        {semanticActive && (
          <div className="space-y-2 pl-3 border-l-2 border-fuchsia-500/20">
            <div className="flex items-center gap-2">
              <Label>{t('aiQuality.embeddingTitle')}</Label>
              <InfoTooltip variant="info" content={<p className="text-xs max-w-xs">{t('aiQuality.embeddingDesc')}</p>} />
            </div>
            <Select
              value={embeddingModel || 'auto'}
              onValueChange={(v) => onChange('embeddingModel', v === 'auto' ? '' : v)}
            >
              <SelectTrigger className="md:w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t('aiQuality.embeddingAuto')}</SelectItem>
                {modelOptions.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                    checking ? 'bg-amber-400 animate-pulse' : status?.available ? 'bg-emerald-400' : 'bg-slate-500'
                  }`}
                />
                <span className="text-xs truncate">
                  {checking
                    ? t('aiQuality.statusChecking')
                    : status?.available
                      ? `${t('aiQuality.detectedModelLabel')}: ${status.model}`
                      : t('aiQuality.statusUnavailable')}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={refresh}
                disabled={checking}
                aria-label={t('aiQuality.refresh')}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            {!checking && !status?.available && (
              <p className="text-2xs text-muted-foreground">{t('aiQuality.noEmbedderHint')}</p>
            )}

            {/* Pre-indicizzazione TM ("indicizza ora") */}
            <div className="mt-2 pt-2 border-t border-slate-700/40 space-y-2">
              <p className="text-2xs text-muted-foreground">{t('semanticIndex.hint')}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xs text-muted-foreground">{t('semanticIndex.sourceLabel')}</span>
                <Select value={indexSrc} onValueChange={setIndexSrc}>
                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INDEX_LANGS.map((l) => (
                      <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-2xs text-muted-foreground">→ {defaultTargetLang.toUpperCase()}</span>
                {glossaryGames.length > 0 && (
                  <>
                    <span className="text-2xs text-muted-foreground">{t('semanticIndex.gameLabel')}</span>
                    <Select value={indexGame || '_none'} onValueChange={(v) => setIndexGame(v === '_none' ? '' : v)}>
                      <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">{t('semanticIndex.gameNone')}</SelectItem>
                        {glossaryGames.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={runWarmIndex}
                  disabled={indexing || !status?.available}
                >
                  {indexing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                  {indexing ? t('semanticIndex.indexing') : t('semanticIndex.button')}
                </Button>
              </div>
              {indexProgress && indexProgress.total > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-fuchsia-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round((indexProgress.done / indexProgress.total) * 100))}%` }}
                    />
                  </div>
                  <p className="text-micro text-muted-foreground text-right font-mono">
                    {indexProgress.done}/{indexProgress.total}
                  </p>
                </div>
              )}
              {indexResult && !indexing && (
                <p className="text-2xs text-emerald-400/80">{indexResult}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Type declaration for Tauri
declare global {
  interface Window {
    __TAURI_IPC__?: unknown;
  }
}

interface Settings {
  // Translation
  translation: {
    apiKey: string;
    groqApiKey: string;
    deepseekApiKey: string;
    openaiApiKey: string;
    anthropicApiKey: string;
    mistralApiKey: string;
    cohereApiKey: string;
    togetherApiKey: string;
    fireworksApiKey: string;
    openrouterApiKey: string;
    cerebrasApiKey: string;
    deeplApiKey: string;
    qwenApiKey: string;
    defaultTargetLang: string;
    temperature: number;
    maxTokens: number;
    batchSize: number;
    lmStudioUrl: string;
    lmStudioModel: string;
    modelwizApiKey: string;
    modelwizUrl: string;
    // Qualità AI (reflection + TM semantica)
    reflectionMode: 'auto' | 'off' | 'always';
    semanticTM: 'auto' | 'off';
    embeddingModel: string;
  };

  // System
  system: Record<string, never>;
  
  // Performance
  performance: {
    maxConcurrentTasks: number;
    apiTimeout: number;
    retryAttempts: number;
  };
  

  // Display
  display: {
    uiScale: number;
    fontSize: 'small' | 'medium' | 'large';
    compactMode: boolean;
    sidebarWidth: number;
    animationsEnabled: boolean;
  };

  // Privacy / telemetria (opt-in, default tutto OFF)
  privacy: {
    compatTelemetry: boolean;
    crashReports: boolean;
    benchmarkTelemetry: boolean;
  };
}

export default function SettingsPage() {
  const _router = useRouter();
  const { version, buildInfo } = useVersion();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings>({
    translation: {
      apiKey: '',
      groqApiKey: '',
      deepseekApiKey: '',
      openaiApiKey: '',
      anthropicApiKey: '',
      mistralApiKey: '',
      cohereApiKey: '',
      togetherApiKey: '',
      fireworksApiKey: '',
      openrouterApiKey: '',
      cerebrasApiKey: '',
      deeplApiKey: '',
      qwenApiKey: '',
      defaultTargetLang: 'it',
      temperature: 0.3,
      maxTokens: 2000,
      batchSize: 50,
      lmStudioUrl: 'http://localhost:1234',
      lmStudioModel: '',
      modelwizApiKey: '',
      modelwizUrl: 'http://localhost:8080',
      reflectionMode: 'auto',
      semanticTM: 'auto',
      embeddingModel: ''
    },
    system: {},
    performance: {
      maxConcurrentTasks: 5,
      apiTimeout: 30000,
      retryAttempts: 3
    },
    display: {
      uiScale: 100,
      fontSize: 'medium',
      compactMode: false,
      sidebarWidth: 256,
      animationsEnabled: true,
    },
    privacy: {
      compatTelemetry: false,
      crashReports: false,
      benchmarkTelemetry: false,
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<{ [key: string]: boolean }>({});
  const [activeTab, setActiveTab] = useState('translation');

  // Debug API functions
  const [debugResults, setDebugResults] = useState<string[]>([]);
  const [isDebugging, setIsDebugging] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem('gameStringerSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({
          ...prev,
          ...parsed,
          translation: { ...prev.translation, ...(parsed.translation || {}) },
          system: { ...prev.system, ...(parsed.system || {}) },
          performance: { ...prev.performance, ...(parsed.performance || {}) },
          display: { ...prev.display, ...(parsed.display || {}) },
          privacy: { ...prev.privacy, ...(parsed.privacy || {}) },
        }));
      } catch (error: unknown) {
        clientLogger.error('Error loading settings:', error);
      }
    }
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    // Il disco è la fonte di verità. Scriviamo SEMPRE lo stato corrente su disco
    // (save_app_settings) in modo indipendente da localStorage: nel webview Tauri
    // localStorage.setItem può fallire (storage partizionato) e in passato faceva
    // fallire l'intero salvataggio → le API key non venivano mai persistite.
    let diskOk = false;
    try {
      const { invoke } = await import('@/lib/tauri-api');
      await invoke('save_app_settings', { settings });
      diskOk = true;
    } catch (e: unknown) {
      clientLogger.error(`save_app_settings fallito:`, String(e));
    }
    // Cache sincrona in localStorage (best-effort): se lancia, non è fatale
    // perché la fonte di verità (disco) è già stata scritta sopra.
    try {
      localStorage.setItem('gameStringerSettings', JSON.stringify(settings));
      window.dispatchEvent(new Event('gs-display-changed'));
    } catch (e: unknown) {
      clientLogger.warn('localStorage.setItem settings fallito (non fatale):', String(e));
    }
    setIsSaving(false);
    if (diskOk) toast.success(t('common.success'));
    else toast.error(t('common.error'));
  };

  const resetSettings = () => {
    if (confirm(t('settings.confirmReset'))) {
      localStorage.removeItem('gameStringerSettings');
      window.location.reload();
    }
  };

  const [tutorialDialogOpen, setTutorialDialogOpen] = useState(false);

  // RSS Feeds
  const [rssFeeds, setRssFeeds] = useState<RssFeed[]>([]);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedName, setNewFeedName] = useState('');

  useEffect(() => {
    setRssFeeds(getRssFeeds());
  }, []);

  const handleAddRssFeed = () => {
    if (!newFeedUrl.trim() || !newFeedName.trim()) {
      toast.error(t('common.inserisciUrlENomeDelFeed'));
      return;
    }
    const newFeed: RssFeed = { url: newFeedUrl.trim(), name: newFeedName.trim(), enabled: true };
    const updated = [...rssFeeds, newFeed];
    setRssFeeds(updated);
    saveRssFeeds(updated);
    setNewFeedUrl('');
    setNewFeedName('');
    toast.success(t('settingsPage.rssFeedAdded'));
  };

  const handleRemoveRssFeed = (index: number) => {
    const updated = rssFeeds.filter((_, i) => i !== index);
    setRssFeeds(updated);
    saveRssFeeds(updated);
    toast.success(t('settingsPage.feedRemoved'));
  };

  const handleToggleRssFeed = (index: number) => {
    const updated = rssFeeds.map((feed, i) => 
      i === index ? { ...feed, enabled: !feed.enabled } : feed
    );
    setRssFeeds(updated);
    saveRssFeeds(updated);
  };

  const handleResetRssFeeds = () => {
    setRssFeeds(defaultRssFeeds);
    saveRssFeeds(defaultRssFeeds);
    toast.success(t('common.feedRssRipristinati'));
  };

  const startNormalTutorial = () => {
    // Riavvia solo l'onboarding wizard (slides informative)
    localStorage.removeItem('gamestringer_onboarding_completed');
    setTutorialDialogOpen(false);
    toast.success(t('settings.tutorial.restarting'));
    setTimeout(() => window.location.reload(), 1000);
  };

  const startGuidedTutorial = () => {
    // Riavvia solo il tutorial interattivo (guida passo-passo nella sidebar)
    localStorage.removeItem('gamestringer-tutorial-completed');
    setTutorialDialogOpen(false);
    toast.success(t('settings.tutorial.startingGuided'));
    setTimeout(() => window.location.reload(), 1000);
  };

  const updateSetting = (category: keyof Settings, key: string, value: unknown) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  // Debug API functions
  const addDebugResult = (message: string) => {
    setDebugResults(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`
    ]);
  };

  const clearDebugResults = () => {
    setDebugResults([]);
  };

  const testGameLibrary = async () => {
    setIsDebugging(true);
    try {
      addDebugResult('🎮 Testing game library access...');
      
      // Check if running in Tauri context
      if (typeof window !== 'undefined' && window.__TAURI_IPC__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('get_games');
        const games = result as Array<Record<string, unknown>>;

        addDebugResult(`✅ Game library loaded successfully`);
        addDebugResult(`📋 Total games: ${games.length}`);

        const vrGames = games.filter(g => g.is_vr);
        const installedGames = games.filter(g => g.is_installed);

        addDebugResult(`🏷️ Games with metadata: ${games.filter(g => g.header_image).length}`);
        addDebugResult(`🥽 VR games detected: ${vrGames.length}`);
        addDebugResult(`💾 Installed games: ${installedGames.length}`);
      } else {
        // Fallback for browser testing
        await new Promise(resolve => setTimeout(resolve, 1500));
        addDebugResult('✅ Game library loaded successfully (browser mode)');
        addDebugResult('📋 Total games: 352');
        addDebugResult('🏷️ Games with metadata: 315');
        addDebugResult('🥽 VR games detected: 23');
      }
    } catch (error: unknown) {
      addDebugResult(`❌ Error: ${error}`);
    } finally {
      setIsDebugging(false);
    }
  };


  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800 p-3">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{t('settings.title')}</h1>
              <p className="text-white/70 text-2xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{t('settings.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTutorialDialogOpen(true)} className="border-white/30 text-white hover:bg-white/10 h-8 text-xs">
              <BookOpen className="h-3.5 w-3.5 mr-1.5" />
              {t('settingsPage.tutorialLabel')}
            </Button>
            <Dialog open={tutorialDialogOpen} onOpenChange={setTutorialDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-500" />
                    {t('settings.tutorial.chooseTitle')}
                  </DialogTitle>
                  <DialogDescription>
                    {t('settings.tutorial.chooseDesc')}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <Button
                    variant="outline"
                    className="h-auto p-4 justify-start gap-4 hover:bg-blue-500/10 hover:border-blue-500/50"
                    onClick={startNormalTutorial}
                  >
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <Play className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{t('settings.tutorial.normalTitle')}</div>
                      <div className="text-xs text-muted-foreground">{t('settings.tutorial.normalDesc')}</div>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto p-4 justify-start gap-4 hover:bg-purple-500/10 hover:border-purple-500/50"
                    onClick={startGuidedTutorial}
                  >
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <Compass className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{t('settings.tutorial.guidedTitle')}</div>
                      <div className="text-xs text-muted-foreground">{t('settings.tutorial.guidedDesc')}</div>
                    </div>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={resetSettings} className="border-white/30 text-white hover:bg-white/10 h-8 text-xs">
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />{t('subtitleTranslator.reset')}</Button>
            <Button size="sm" onClick={saveSettings} disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 h-8 text-xs">
              {isSaving ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />{t('settings.saving')}</>
              ) : (
                <><Save className="h-3.5 w-3.5 mr-1.5" />{t('settings.save')}</>
              )}
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="translation" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Brain className="h-3.5 w-3.5" />
            <span>{t('settings.tabs.ai')}</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Cpu className="h-3.5 w-3.5" />
            <span>{t('settings.tabs.system')}</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Zap className="h-3.5 w-3.5" />
            <span>{t('settings.tabs.performance')}</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <HardDrive className="h-3.5 w-3.5" />
            <span>{t('settings.tabs.backup')}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Bell className="h-3.5 w-3.5" />
            <span>{t('settings.tabs.notifications')}</span>
          </TabsTrigger>
          <TabsTrigger value="rss" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Rss className="h-3.5 w-3.5" />
            <span>RSS</span>
          </TabsTrigger>
          <TabsTrigger value="community" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Globe className="h-3.5 w-3.5" />
            <span>{t('settingsPage.communityHubShort')}</span>
          </TabsTrigger>
          <TabsTrigger value="display" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Maximize2 className="h-3.5 w-3.5" />
            <span>{t('settingsPage.display')}</span>
          </TabsTrigger>
          <TabsTrigger value="debug" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Bug className="h-3.5 w-3.5" />
            <span>{t('settings.tabs.debug')}</span>
          </TabsTrigger>
        </TabsList>

        <form onSubmit={(e) => e.preventDefault()} autoComplete="off">
        {/* Translation Tab */}
        <TabsContent value="translation" className="space-y-6">
          <OllamaManager />
          <FineTuningManager />
          
          {/* LM Studio Settings */}
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center space-x-2">
                <Monitor className="h-5 w-5 text-purple-500" />
                <span>{t('settingsPage.lmStudioLocale')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {t('settingsPage.lmStudioDesc')}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('settingsPage.serverUrl')}</Label>
                  <Input
                    value={settings.translation?.lmStudioUrl || 'http://localhost:1234'}
                    onChange={(e) => updateSetting('translation', 'lmStudioUrl', e.target.value)}
                    placeholder={t('settingsPage.lmstudioUrlPh')}
                    className="font-mono text-xs"
                  />
                  <p className="text-2xs text-muted-foreground">{t('settingsPage.portaDefault1234')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('settingsPage.modelOptional')}</Label>
                  <Input
                    value={settings.translation?.lmStudioModel || ''}
                    onChange={(e) => updateSetting('translation', 'lmStudioModel', e.target.value)}
                    placeholder={t('settingsPage.autoDetectFromServer')}
                    className="font-mono text-xs"
                  />
                  <p className="text-2xs text-muted-foreground">{t('settingsPage.leaveEmpty')}</p>
                </div>
              </div>
              <p className="text-2xs text-muted-foreground">
                {t('settingsPage.lmStudioDownload1')}<a href="https://lmstudio.ai" target="_blank" rel="noopener" className="underline">lmstudio.ai</a>{t('settingsPage.lmStudioDownload2')}
              </p>
            </CardContent>
          </Card>

          {/* Alocai ModelWiz Settings */}
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center space-x-2">
                <Globe className="h-5 w-5 text-teal-500" />
                <span>Alocai ModelWiz</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {t('settingsPage.modelwizDesc')}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('settingsPage.endpointUrl')}</Label>
                  <Input
                    value={settings.translation?.modelwizUrl || 'http://localhost:8080'}
                    onChange={(e) => updateSetting('translation', 'modelwizUrl', e.target.value)}
                    placeholder={t('settingsPage.modelwizUrlPh')}
                    className="font-mono text-xs"
                  />
                  <p className="text-2xs text-muted-foreground">{t('settingsPage.modelwizUrlHint')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('settingsPage.apiKeyOptional')}</Label>
                  <Input
                    type="password"
                    value={settings.translation?.modelwizApiKey || ''}
                    onChange={(e) => updateSetting('translation', 'modelwizApiKey', e.target.value)}
                    placeholder={t('settingsPage.onlyForAlocaiCloud')}
                    className="font-mono text-xs"
                  />
                  <p className="text-2xs text-muted-foreground">{t('settingsPage.modelwizApiKeyHint')}</p>
                </div>
              </div>
              <p className="text-2xs text-muted-foreground">
                {t('settingsPage.modelwizDownload1')}<a href="https://www.alocai.com/download-modelwiz" target="_blank" rel="noopener" className="underline">alocai.com/download-modelwiz</a>{t('settingsPage.modelwizDownload2')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-blue-500" />
                <span>{t('settings.aiConfig')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>{t('settings.targetLang')}</Label>
                  <Select 
                    value={settings.translation.defaultTargetLang} 
                    onValueChange={(value) => updateSetting('translation', 'defaultTargetLang', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">🇮🇹 {t('languages.it')}</SelectItem>
                      <SelectItem value="en">🇬🇧 {t('languages.en')}</SelectItem>
                      <SelectItem value="es">🇪🇸 {t('languages.es')}</SelectItem>
                      <SelectItem value="fr">🇫🇷 {t('languages.fr')}</SelectItem>
                      <SelectItem value="de">🇩🇪 {t('languages.de')}</SelectItem>
                      <SelectItem value="pt">🇵🇹 {t('languages.pt')}</SelectItem>
                      <SelectItem value="pl">🇵🇱 {t('languages.pl')}</SelectItem>
                      <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                      <SelectItem value="zh">🇨🇳 中文</SelectItem>
                      <SelectItem value="ja">🇯🇵 日本語</SelectItem>
                      <SelectItem value="ko">🇰🇷 한국어</SelectItem>
                      <SelectItem value="ar">🇸🇦 العربية</SelectItem>
                      <SelectItem value="hi">🇮🇳 हिन्दी</SelectItem>
                      <SelectItem value="tr">🇹🇷 {t('languages.tr')}</SelectItem>
                      <SelectItem value="nl">🇳🇱 {t('languages.nl')}</SelectItem>
                      <SelectItem value="sv">🇸🇪 {t('languages.sv')}</SelectItem>
                      <SelectItem value="uk">🇺🇦 Українська</SelectItem>
                      <SelectItem value="th">🇹🇭 ไทย</SelectItem>
                      <SelectItem value="vi">🇻🇳 {t('languages.vi')}</SelectItem>
                      <SelectItem value="id">🇮🇩 {t('languages.id')}</SelectItem>
                      <SelectItem value="pt-BR">🇧🇷 {t('languages.ptBr')}</SelectItem>
                      <SelectItem value="es-419">🇲🇽 {t('languages.esLatam')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">{t('settingsPage.apiKeysFallback')}</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="translation-api-key">{t('settingsPage.geminiHeader')}</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="translation-api-key"
                      type={showApiKeys.translation ? "text" : "password"}
                      value={settings.translation.apiKey}
                      onChange={(e) => updateSetting('translation', 'apiKey', e.target.value)}
                      placeholder={t('settingsPage.geminiKeyPh')}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t('common.mostraNascondi')}
                      onClick={() => setShowApiKeys(prev => ({ ...prev, translation: !prev.translation }))}
                    >
                      {showApiKeys.translation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('settingsPage.freeTier15Rpm1mTpm')}<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="underline">{t('settingsPage.getKey')}</a></p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="groq-api-key">{t('settingsPage.groqApiKeyLabel')}</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="groq-api-key"
                      type={showApiKeys.groq ? "text" : "password"}
                      value={settings.translation.groqApiKey}
                      onChange={(e) => updateSetting('translation', 'groqApiKey', e.target.value)}
                      placeholder={t('settingsPage.groqKeyPh')}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t('common.mostraNascondi')}
                      onClick={() => setShowApiKeys(prev => ({ ...prev, groq: !prev.groq }))}
                    >
                      {showApiKeys.groq ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('settingsPage.gratuitoVelocissimo')}<a href="https://console.groq.com/keys" target="_blank" rel="noopener" className="underline">{t('settingsPage.getKey')}</a></p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deepseek-api-key">{t('settingsPage.deepseekHeader')}</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="deepseek-api-key"
                      type={showApiKeys.deepseek ? "text" : "password"}
                      value={settings.translation.deepseekApiKey}
                      onChange={(e) => updateSetting('translation', 'deepseekApiKey', e.target.value)}
                      placeholder={t('settingsPage.skPrefixPh')}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t('common.mostraNascondi')}
                      onClick={() => setShowApiKeys(prev => ({ ...prev, deepseek: !prev.deepseek }))}
                    >
                      {showApiKeys.deepseek ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('settingsPage.deepseekHint')}<a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener" className="underline">{t('settingsPage.getKey')}</a></p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="openai-api-key">{t('settingsPage.openaiHeader')}</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="openai-api-key"
                      type={showApiKeys.openai ? "text" : "password"}
                      value={settings.translation.openaiApiKey}
                      onChange={(e) => updateSetting('translation', 'openaiApiKey', e.target.value)}
                      placeholder={t('settingsPage.skPrefixPh')}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t('common.mostraNascondi')}
                      onClick={() => setShowApiKeys(prev => ({ ...prev, openai: !prev.openai }))}
                    >
                      {showApiKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('settingsPage.payperuseGpt4o')}<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="underline">{t('settingsPage.getKey')}</a></p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="anthropic-api-key">{t('settingsPage.anthropicHeader')}</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="anthropic-api-key"
                      type={showApiKeys.anthropic ? "text" : "password"}
                      value={settings.translation.anthropicApiKey}
                      onChange={(e) => updateSetting('translation', 'anthropicApiKey', e.target.value)}
                      placeholder={t('settingsPage.anthropicKeyPh')}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t('common.mostraNascondi')}
                      onClick={() => setShowApiKeys(prev => ({ ...prev, anthropic: !prev.anthropic }))}
                    >
                      {showApiKeys.anthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('settingsPage.payperuseClaudeSonnet')}<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="underline">{t('settingsPage.getKey')}</a></p>
                </div>
              </div>

              <details className="group">
                <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  {t('settingsPage.otherLlmProviders')}
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                  <div className="space-y-1">
                    <Label htmlFor="mistral-api-key" className="text-xs">{t('settingsPage.mistralAi')}</Label>
                    <div className="flex space-x-1">
                      <Input id="mistral-api-key" type={showApiKeys.mistral ? "text" : "password"} value={settings.translation.mistralApiKey} onChange={(e) => updateSetting('translation', 'mistralApiKey', e.target.value)} placeholder="..." className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" aria-label={t('common.mostraNascondi')} className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, mistral: !prev.mistral }))}>{showApiKeys.mistral ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-2xs text-muted-foreground">{t('settingsPage.freeTier')}<a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener" className="underline">{t('settingsPage.key')}</a></p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cohere-api-key" className="text-xs">Cohere</Label>
                    <div className="flex space-x-1">
                      <Input id="cohere-api-key" type={showApiKeys.cohere ? "text" : "password"} value={settings.translation.cohereApiKey} onChange={(e) => updateSetting('translation', 'cohereApiKey', e.target.value)} placeholder="..." className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" aria-label={t('common.mostraNascondi')} className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, cohere: !prev.cohere }))}>{showApiKeys.cohere ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-2xs text-muted-foreground">{t('settingsPage.freeTrial')}<a href="https://dashboard.cohere.com/api-keys" target="_blank" rel="noopener" className="underline">{t('settingsPage.key')}</a></p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="together-api-key" className="text-xs">{t('settingsPage.togetherAi')}</Label>
                    <div className="flex space-x-1">
                      <Input id="together-api-key" type={showApiKeys.together ? "text" : "password"} value={settings.translation.togetherApiKey} onChange={(e) => updateSetting('translation', 'togetherApiKey', e.target.value)} placeholder="..." className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" aria-label={t('common.mostraNascondi')} className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, together: !prev.together }))}>{showApiKeys.together ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-2xs text-muted-foreground">{t('settingsPage.together25Credit')}<a href="https://api.together.xyz/settings/api-keys" target="_blank" rel="noopener" className="underline">{t('settingsPage.key')}</a></p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="fireworks-api-key" className="text-xs">{t('settingsPage.fireworksAi')}</Label>
                    <div className="flex space-x-1">
                      <Input id="fireworks-api-key" type={showApiKeys.fireworks ? "text" : "password"} value={settings.translation.fireworksApiKey} onChange={(e) => updateSetting('translation', 'fireworksApiKey', e.target.value)} placeholder="..." className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" aria-label={t('common.mostraNascondi')} className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, fireworks: !prev.fireworks }))}>{showApiKeys.fireworks ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-2xs text-muted-foreground">{t('settingsPage.freeTier')}<a href="https://fireworks.ai/account/api-keys" target="_blank" rel="noopener" className="underline">{t('settingsPage.key')}</a></p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="openrouter-api-key" className="text-xs">OpenRouter</Label>
                    <div className="flex space-x-1">
                      <Input id="openrouter-api-key" type={showApiKeys.openrouter ? "text" : "password"} value={settings.translation.openrouterApiKey} onChange={(e) => updateSetting('translation', 'openrouterApiKey', e.target.value)} placeholder={t('settingsPage.openrouterKeyPh')} className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" aria-label={t('common.mostraNascondi')} className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, openrouter: !prev.openrouter }))}>{showApiKeys.openrouter ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-2xs text-muted-foreground">{t('settingsPage.modelliGratuitiInclusi')}<a href="https://openrouter.ai/keys" target="_blank" rel="noopener" className="underline">{t('settingsPage.key')}</a></p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cerebras-api-key" className="text-xs">Cerebras</Label>
                    <div className="flex space-x-1">
                      <Input id="cerebras-api-key" type={showApiKeys.cerebras ? "text" : "password"} value={settings.translation.cerebrasApiKey} onChange={(e) => updateSetting('translation', 'cerebrasApiKey', e.target.value)} placeholder={t('settingsPage.cerebrasKeyPh')} className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" aria-label={t('common.mostraNascondi')} className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, cerebras: !prev.cerebras }))}>{showApiKeys.cerebras ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-2xs text-muted-foreground">{t('settingsPage.freeTierUltraveloce')}<a href="https://cloud.cerebras.ai/platform" target="_blank" rel="noopener" className="underline">{t('settingsPage.key')}</a></p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="deepl-api-key" className="text-xs">DeepL</Label>
                    <div className="flex space-x-1">
                      <Input id="deepl-api-key" type={showApiKeys.deepl ? "text" : "password"} value={settings.translation.deeplApiKey} onChange={(e) => updateSetting('translation', 'deeplApiKey', e.target.value)} placeholder="..." className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" aria-label={t('common.mostraNascondi')} className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, deepl: !prev.deepl }))}>{showApiKeys.deepl ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-2xs text-muted-foreground">{t('settingsPage.deepl500k')}<a href="https://www.deepl.com/pro-api" target="_blank" rel="noopener" className="underline">{t('settingsPage.key')}</a></p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="qwen-api-key" className="text-xs">{t('settingsPage.qwen3AlibabaDashscope')}</Label>
                    <div className="flex space-x-1">
                      <Input id="qwen-api-key" type={showApiKeys.qwen ? "text" : "password"} value={settings.translation.qwenApiKey} onChange={(e) => updateSetting('translation', 'qwenApiKey', e.target.value)} placeholder={t('settingsPage.skPrefixPh')} className="font-mono text-xs h-8" />
                      <Button variant="outline" size="icon" aria-label={t('common.mostraNascondi')} className="h-8 w-8" onClick={() => setShowApiKeys(prev => ({ ...prev, qwen: !prev.qwen }))}>{showApiKeys.qwen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <p className="text-2xs text-muted-foreground">{t('settingsPage.qwen1m')}<a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" rel="noopener" className="underline">{t('settingsPage.key')}</a></p>
                  </div>
                </div>
              </details>

              <details className="group">
                <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 select-none mb-2">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {t('heroJob.advancedParams')}
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('settingsPage.temperatureLabel')} {settings.translation.temperature}</Label>
                    <InfoTooltip 
                      variant="info"
                      content={
                        <div className="space-y-1">
                          <p className="font-semibold">{t('settings.temperatureTooltipTitle')}</p>
                          <p className="text-xs">• <strong>{t('settings.temperatureTooltipLow')}</strong></p>
                          <p className="text-xs">• <strong>{t('settings.temperatureTooltipMid')}</strong></p>
                          <p className="text-xs">• <strong>{t('settings.temperatureTooltipHigh')}</strong></p>
                          <p className="text-xs text-muted-foreground mt-1">{t('settings.temperatureTooltipRecommended')}</p>
                        </div>
                      }
                    />
                  </div>
                  <Slider
                    value={[settings.translation.temperature]}
                    onValueChange={(value) => updateSetting('translation', 'temperature', value[0])}
                    max={2}
                    min={0}
                    step={0.1}
                    className="w-full [&_[data-slot=range]]:bg-blue-500 [&_[data-slot=thumb]]:bg-blue-500 [&_[data-slot=thumb]]:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('settingsPage.maxTokensLabel')} {settings.translation.maxTokens}</Label>
                    <InfoTooltip 
                      variant="info"
                      content={
                        <div className="space-y-1">
                          <p className="font-semibold">{t('settings.maxTokensTooltipTitle')}</p>
                          <p className="text-xs">{t('settings.maxTokensTooltipDesc')}</p>
                          <p className="text-xs">• <strong>{t('settings.maxTokensTooltipLow')}</strong></p>
                          <p className="text-xs">• <strong>{t('settings.maxTokensTooltipMid')}</strong></p>
                          <p className="text-xs">• <strong>{t('settings.maxTokensTooltipHigh')}</strong></p>
                          <p className="text-xs text-muted-foreground mt-1">{t('settings.maxTokensTooltipCost')}</p>
                        </div>
                      }
                    />
                  </div>
                  <Slider
                    value={[settings.translation.maxTokens]}
                    onValueChange={(value) => updateSetting('translation', 'maxTokens', value[0])}
                    max={4000}
                    min={100}
                    step={100}
                    className="w-full [&_[data-slot=range]]:bg-blue-500 [&_[data-slot=thumb]]:bg-blue-500 [&_[data-slot=thumb]]:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('settingsPage.batchSizeLabel')} {settings.translation.batchSize}</Label>
                    <InfoTooltip 
                      variant="info"
                      content={
                        <div className="space-y-1">
                          <p className="font-semibold">{t('settings.batchSizeTooltipTitle')}</p>
                          <p className="text-xs">{t('settings.batchSizeTooltipDesc')}</p>
                          <p className="text-xs">• <strong>{t('settings.batchSizeTooltipLow')}</strong></p>
                          <p className="text-xs">• <strong>{t('settings.batchSizeTooltipMid')}</strong></p>
                          <p className="text-xs">• <strong>{t('settings.batchSizeTooltipHigh')}</strong></p>
                          <p className="text-xs text-muted-foreground mt-1">{t('settings.batchSizeTooltipCost')}</p>
                        </div>
                      }
                    />
                  </div>
                  <Slider
                    value={[settings.translation.batchSize]}
                    onValueChange={(value) => updateSetting('translation', 'batchSize', value[0])}
                    max={200}
                    min={10}
                    step={10}
                    className="w-full [&_[data-slot=range]]:bg-blue-500 [&_[data-slot=thumb]]:bg-blue-500 [&_[data-slot=thumb]]:border-blue-500"
                  />
                </div>
              </div>
              </details>
            </CardContent>
          </Card>

          {/* Qualità AI: Reflection + TM semantica */}
          <AiQualityCard
            reflectionMode={settings.translation.reflectionMode}
            semanticTM={settings.translation.semanticTM}
            embeddingModel={settings.translation.embeddingModel}
            defaultTargetLang={settings.translation.defaultTargetLang}
            onChange={(key, value) => updateSetting('translation', key, value)}
          />

          {/* Multi-LLM Comparison */}
          <MultiLlmComparisonSettings />

          {/* Custom Prompt & Voice */}
          <CustomPromptSettings />
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-6">
          <AutoBackupSettings />
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <CacheStatsCard />
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <span>{t('settings.perfConfig')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>{t('settings.concurrentTasks')}: {settings.performance.maxConcurrentTasks}</Label>
                  <Slider
                    value={[settings.performance.maxConcurrentTasks]}
                    onValueChange={(value) => updateSetting('performance', 'maxConcurrentTasks', value[0])}
                    max={20}
                    min={1}
                    step={1}
                    className="w-full [&_[data-slot=range]]:bg-blue-500 [&_[data-slot=thumb]]:bg-blue-500 [&_[data-slot=thumb]]:border-blue-500"
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('settings.concurrentTasksDesc')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t('settings.apiTimeout')}: {settings.performance.apiTimeout}</Label>
                  <Slider
                    value={[settings.performance.apiTimeout]}
                    onValueChange={(value) => updateSetting('performance', 'apiTimeout', value[0])}
                    max={120000}
                    min={5000}
                    step={5000}
                    className="w-full [&_[data-slot=range]]:bg-blue-500 [&_[data-slot=thumb]]:bg-blue-500 [&_[data-slot=thumb]]:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('settings.retryAttempts')}: {settings.performance.retryAttempts}</Label>
                  <Slider
                    value={[settings.performance.retryAttempts]}
                    onValueChange={(value) => updateSetting('performance', 'retryAttempts', value[0])}
                    max={10}
                    min={1}
                    step={1}
                    className="w-full [&_[data-slot=range]]:bg-blue-500 [&_[data-slot=thumb]]:bg-blue-500 [&_[data-slot=thumb]]:border-blue-500"
                  />
                </div>
              </div>

            </CardContent>
          </Card>

          {/* VRAM Manager */}
          <VramSettingsCard />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <TrayNotificationPreferences />
          <ProfileNotificationSettings />
        </TabsContent>


        {/* RSS Tab */}
        <TabsContent value="rss" className="space-y-3">
          <Card className="p-4">
            <CardHeader className="p-0 pb-4">
              <CardTitle as="h2" className="flex items-center gap-2 text-base">
                <Rss className="h-5 w-5 text-orange-500" />
                {t('settingsPage.rssFeedDashboard')}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {t('settingsPage.rssDesc')}
              </p>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              {/* Add new feed */}
              <div className="flex gap-2">
                <Input
                  placeholder={t('settingsPage.feedNamePlaceholder')}
                  value={newFeedName}
                  onChange={(e) => setNewFeedName(e.target.value)}
                  className="flex-1 h-9 text-sm"
                />
                <Input
                  placeholder={t('settingsPage.feedUrlPlaceholder')}
                  value={newFeedUrl}
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  className="flex-[2] h-9 text-sm"
                />
                <Button onClick={handleAddRssFeed} size="sm" className="h-9 gap-1">
                  <Plus className="h-4 w-4" />{t('glossaryManager.add')}</Button>
              </div>

              {/* Feed list */}
              <div className="space-y-2">
                {rssFeeds.map((feed, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                    <Switch
                      checked={feed.enabled}
                      onCheckedChange={() => handleToggleRssFeed(index)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{feed.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{feed.url}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRssFeed(index)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {rssFeeds.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('settingsPage.noFeeds')}
                  </p>
                )}
              </div>

              {/* Reset button */}
              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={handleResetRssFeeds} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('settingsPage.restoreDefaults')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Community Hub / Supabase Tab */}
        <TabsContent value="community" className="space-y-3">
          <SupabaseSettingsCard />
          <CompatTelemetryCard
            compatEnabled={settings.privacy.compatTelemetry}
            crashEnabled={settings.privacy.crashReports}
            benchmarkEnabled={settings.privacy.benchmarkTelemetry}
            onChange={(key, v) => updateSetting('privacy', key, v)}
          />
          <FeedbackWidget />
        </TabsContent>

        {/* Display Tab */}
        <TabsContent value="display" className="space-y-3">
          {/* Screen Info - inline compatto */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <Monitor className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-2xs text-muted-foreground">{t('settingsPage.window')}</span>
              </div>
              <p className="text-sm font-bold">{typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '...'}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <Maximize2 className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-2xs text-muted-foreground">{t('settingsPage.screen')}</span>
              </div>
              <p className="text-sm font-bold">{typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '...'}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-green-400" />
                <span className="text-2xs text-muted-foreground">DPI</span>
              </div>
              <p className="text-sm font-bold">{typeof window !== 'undefined' ? `${(window.devicePixelRatio * 100).toFixed(0)}%` : '...'}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <Columns className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-2xs text-muted-foreground">{t('settingsPage.ratio')}</span>
              </div>
              <p className="text-sm font-bold">{typeof window !== 'undefined' ? (window.innerWidth / window.innerHeight).toFixed(2) : '...'}</p>
            </div>
          </div>

          <Card className="p-4">
            <div className="space-y-4">
              {/* UI Scale + Sidebar — due colonne */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">{t('settingsPage.uiScale')}</Label>
                    <Badge variant="outline" className="font-mono text-2xs h-5">{settings.display.uiScale}%</Badge>
                  </div>
                  <Slider
                    value={[settings.display.uiScale]}
                    onValueChange={(value) => updateSetting('display', 'uiScale', value[0])}
                    max={150} min={75} step={5}
                    className="w-full [&_[data-slot=range]]:bg-violet-500 [&_[data-slot=thumb]]:bg-violet-500 [&_[data-slot=thumb]]:border-violet-500"
                  />
                  <div className="flex justify-between text-micro text-muted-foreground">
                    <span>75%</span><span>100%</span><span>150%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">{t('settingsPage.sidebar')}</Label>
                    <Badge variant="outline" className="font-mono text-2xs h-5">{settings.display.sidebarWidth}px</Badge>
                  </div>
                  <Slider
                    value={[settings.display.sidebarWidth]}
                    onValueChange={(value) => updateSetting('display', 'sidebarWidth', value[0])}
                    max={320} min={200} step={8}
                    className="w-full [&_[data-slot=range]]:bg-violet-500 [&_[data-slot=thumb]]:bg-violet-500 [&_[data-slot=thumb]]:border-violet-500"
                  />
                  <div className="flex justify-between text-micro text-muted-foreground">
                    <span>200px</span><span>256px</span><span>320px</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Font Size — compatto inline */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t('settingsPage.textSize')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateSetting('display', 'fontSize', size)}
                      className={`p-2 rounded-lg border transition-all text-center ${
                        settings.display.fontSize === size
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <Type className={`mx-auto mb-1 ${size === 'small' ? 'h-3 w-3' : size === 'large' ? 'h-5 w-5' : 'h-4 w-4'}`} />
                      <p className="text-[11px] font-medium">{size === 'small' ? t('settingsPage.fontSmall') : size === 'medium' ? t('settingsPage.fontMedium') : t('settingsPage.fontLarge')}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Toggles — inline */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
                  <div>
                    <Label className="text-xs">{t('settingsPage.compact')}</Label>
                    <p className="text-2xs text-muted-foreground">{t('settingsPage.lessPadding')}</p>
                  </div>
                  <Switch
                    checked={settings.display.compactMode}
                    onCheckedChange={(checked) => updateSetting('display', 'compactMode', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
                  <div>
                    <Label className="text-xs">{t('settingsPage.animations')}</Label>
                    <p className="text-2xs text-muted-foreground">{t('settingsPage.uiTransitions')}</p>
                  </div>
                  <Switch
                    checked={settings.display.animationsEnabled}
                    onCheckedChange={(checked) => updateSetting('display', 'animationsEnabled', checked)}
                  />
                </div>
              </div>

              <Separator />

              {/* Preset Rapidi */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t('settingsPage.quickPresets')}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Laptop', sub: '1366x768', icon: '\ud83d\udcbb', scale: 85, font: 'small' as const, compact: true, sw: 200 },
                    { label: 'Full HD', sub: '1920x1080', icon: '\ud83d\udda5\ufe0f', scale: 100, font: 'medium' as const, compact: false, sw: 256 },
                    { label: 'QHD', sub: '2560x1440', icon: '\ud83d\udcfa', scale: 110, font: 'medium' as const, compact: false, sw: 280 },
                    { label: '4K', sub: '3840x2160', icon: '\ud83c\udf1f', scale: 125, font: 'large' as const, compact: false, sw: 300 },
                  ].map((p) => (
                    <Button key={p.label} variant="outline" size="sm" className="h-auto py-2 flex-col gap-0.5 text-2xs" onClick={() => {
                      updateSetting('display', 'uiScale', p.scale);
                      updateSetting('display', 'fontSize', p.font);
                      updateSetting('display', 'compactMode', p.compact);
                      updateSetting('display', 'sidebarWidth', p.sw);
                    }}>
                      <span>{p.icon}</span>
                      <span className="font-medium">{p.label}</span>
                      <span className="text-muted-foreground">{p.sub}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Debug & Test Tab */}
        <TabsContent value="debug" className="space-y-3">
          <Card className="p-3">
            <div className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
              <TestTube className="h-3.5 w-3.5" />
              {t('settings.debugTools')}
              <Badge variant="outline" className="text-2xs ml-1">{t('settings.developers')}</Badge>
            </div>
            <div className="mb-3">
              <Button onClick={testGameLibrary} disabled={isDebugging} variant="outline" size="sm" className="h-10 gap-1.5 w-full">
                <Database className="h-3.5 w-3.5" />
                <span className="text-xs">{t('settings.testLibrary')}</span>
              </Button>
            </div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-semibold text-slate-400">{t('settings.debugConsole')}</p>
              <Button onClick={clearDebugResults} variant="ghost" size="xs" className="text-xs gap-1">
                <Trash2 className="h-3 w-3" />
                {t('settings.clear')}
              </Button>
            </div>
            <div className="bg-black/30 rounded-lg p-2 h-[120px] overflow-y-auto">
              <div className="font-mono text-xs space-y-0.5">
                {debugResults.length > 0 ? debugResults.map((result, index) => (
                  <div key={index} className="text-gray-300">{result}</div>
                )) : (
                  <div className="text-gray-500 italic">{t('settings.consoleEmpty')}</div>
                )}
                {isDebugging && <div className="text-orange-400 animate-pulse">{t('settings.testInProgress')}</div>}
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <p className="text-xs font-semibold text-slate-400 mb-2">{t('settings.systemInfo')}</p>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div><span className="text-muted-foreground">{t('settingsPage.ver')}</span> <span className="font-mono">{version}</span></div>
              <div><span className="text-muted-foreground">{t('settingsPage.build')}</span> <span className="font-mono">{buildInfo.build}</span></div>
              <div><span className="text-muted-foreground">{t('settingsPage.git')}</span> <span className="font-mono">{buildInfo.git.slice(0, 7)}</span></div>
              <div><span className="text-muted-foreground">{t('settingsPage.branch')}</span> <span className="font-mono">{buildInfo.branch}</span></div>
            </div>
          </Card>
        </TabsContent>
      </form>
      </Tabs>
    </div>
  );
}



