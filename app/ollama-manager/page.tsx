'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Download,
  Trash2,
  Zap,
  RefreshCw,
  CheckCircle2,
  Loader2,
  HardDrive,
  Timer,
  ArrowLeftRight,
  Star,
  AlertTriangle,
  Play,
  Package,
  Sparkles,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';
import {
  isOllamaRunning,
  listInstalledModels,
  pullModel,
  deleteModel,
  speedTest,
  compareModels,
  formatSize,
  discoverNewModels,
  invalidateDiscoveryCache,
  RECOMMENDED_MODELS,
  type OllamaModel,
  type SpeedTestResult,
  type ABComparisonResult,
  type DiscoveredModel,
} from '@/lib/ollama-manager';
import { useTranslation } from '@/lib/i18n';

export default function OllamaManagerPage() {
  const { t } = useTranslation();
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [installed, setInstalled] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);

  // Pull state
  const [pulling, setPulling] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<{ status: string; percent: number }>({ status: '', percent: 0 });

  // Delete state
  const [deleting, setDeleting] = useState<string | null>(null);

  // Speed test state
  const [speedTesting, setSpeedTesting] = useState<string | null>(null);
  const [speedResults, setSpeedResults] = useState<Map<string, SpeedTestResult>>(new Map());

  // Discovery state
  const [discovered, setDiscovered] = useState<DiscoveredModel[]>([]);
  const [discovering, setDiscovering] = useState(false);

  // A/B compare state
  const [compareModelA, setCompareModelA] = useState('');
  const [compareModelB, setCompareModelB] = useState('');
  const [compareText, setCompareText] = useState('The ancient castle stood tall against the crimson sunset, its weathered stones telling stories of centuries past.');
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<ABComparisonResult | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const online = await isOllamaRunning();
      setOllamaOnline(online);
      if (online) {
        const models = await listInstalledModels();
        setInstalled(models);
        if (models.length >= 2 && !compareModelA) {
          setCompareModelA(models[0].name);
          setCompareModelB(models[1].name);
        } else if (models.length === 1 && !compareModelA) {
          setCompareModelA(models[0].name);
        }
        // Auto-discovery: cerca nuovi modelli online in background
        const installedNames = models.map(m => m.name);
        discoverNewModels(installedNames).then(setDiscovered).catch(() => {});
      }
    } catch {
      setOllamaOnline(false);
    }
    setLoading(false);
  }, [compareModelA]);

  // Refresh al mount + ogni volta che la pagina torna visibile (tab switch, navigazione)
  useEffect(() => {
    refresh();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    const onFocus = () => { refresh(); };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const installedNames = installed.map(m => m.name.split(':')[0]);

  const handlePull = async (modelName: string) => {
    setPulling(modelName);
    setPullProgress({ status: 'Avvio download...', percent: 0 });
    try {
      await pullModel(modelName, (status, completed, total) => {
        const percent = completed && total ? Math.round((completed / total) * 100) : 0;
        setPullProgress({ status: status || 'downloading...', percent });
      });
      setPullProgress({ status: 'Completato!', percent: 100 });
      await refresh();
    } catch (err: unknown) {
      setPullProgress({ status: `Errore: ${err instanceof Error ? err.message : String(err)}`, percent: 0 });
    }
    setTimeout(() => setPulling(null), 1500);
  };

  const handleDelete = async (modelName: string) => {
    setDeleting(modelName);
    try {
      await deleteModel(modelName);
      await refresh();
    } catch {}
    setDeleting(null);
  };

  const handleSpeedTest = async (modelName: string) => {
    setSpeedTesting(modelName);
    try {
      const result = await speedTest(modelName);
      setSpeedResults(prev => new Map(prev).set(modelName, result));
    } catch {}
    setSpeedTesting(null);
  };

  const handleCompare = async () => {
    if (!compareModelA || !compareModelB || !compareText) return;
    setComparing(true);
    setCompareResult(null);
    try {
      const result = await compareModels(compareModelA, compareModelB, compareText, 'English', 'Italian');
      setCompareResult(result);
    } catch {}
    setComparing(false);
  };

  return (
    <div className="p-4 pt-2 space-y-3 overflow-auto overflow-x-hidden">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 p-3">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{t('ollamaManagerPage.title')}</h1>
              <p className="text-white/70 text-xs">{t('ollamaManagerPage.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn(
              "text-xs font-medium",
              ollamaOnline === true ? "bg-emerald-900/50 text-emerald-200 border-emerald-400/50" :
              ollamaOnline === false ? "bg-red-900/50 text-red-200 border-red-400/50" :
              "bg-gray-900/50 text-gray-200 border-gray-400/50"
            )}>
              {ollamaOnline === true ? '● Online' : ollamaOnline === false ? '● Offline' : '● Checking...'}
            </Badge>
            <Button onClick={refresh} disabled={loading} variant="ghost" size="icon" aria-label="Aggiorna" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* Ollama Offline Warning */}
      {ollamaOnline === false && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-200">{t('offlineTranslator.ollamaNotRunning')}</p>
              <p className="text-xs text-amber-300/70 mt-0.5">
                Installa e avvia Ollama da <a href="https://ollama.com" target="_blank" rel="noopener" className="underline">ollama.com</a> per usare modelli locali.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {ollamaOnline && (
        <>
          {/* Modelli Installati */}
          <Card className="border-emerald-500/20 bg-emerald-950/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">Modelli Installati ({installed.length})</span>
              </div>
              {installed.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('ollamaManagerPage.nessunModelloInstallatoScarica')}</p>
              ) : (
                <div className="space-y-1.5">
                  {installed.map(m => {
                    const sr = speedResults.get(m.name);
                    return (
                      <div key={m.name} className="flex items-center justify-between bg-background/40 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium truncate">{m.name}</span>
                            <Badge variant="outline" className="text-2xs h-3.5 px-1 text-emerald-400 border-emerald-500/30">{formatSize(m.size)}</Badge>
                            {m.details?.parameter_size && (
                              <Badge variant="outline" className="text-2xs h-3.5 px-1 text-cyan-400 border-cyan-500/30">{m.details.parameter_size}</Badge>
                            )}
                            {m.details?.quantization_level && (
                              <Badge variant="outline" className="text-2xs h-3.5 px-1 text-slate-400 border-slate-500/30">{m.details.quantization_level}</Badge>
                            )}
                          </div>
                          {sr && (
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-2xs text-emerald-300"><Zap className="h-2.5 w-2.5 inline mr-0.5" />{sr.tokensPerSecond.toFixed(1)} tok/s</span>
                              <span className="text-2xs text-muted-foreground">TTFT: {sr.firstTokenMs}ms</span>
                              <span className="text-2xs text-muted-foreground">Total: {(sr.totalTimeMs / 1000).toFixed(1)}s</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="icon" aria-label="Speed test" className="h-7 w-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                            onClick={() => handleSpeedTest(m.name)}
                            disabled={speedTesting === m.name}
                          >
                            {speedTesting === m.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Timer className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost" size="icon" aria-label="Elimina" className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleDelete(m.name)}
                            disabled={deleting === m.name}
                          >
                            {deleting === m.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Modelli Consigliati */}
          <Card className="border-teal-500/20 bg-teal-950/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-teal-400" />
                <span className="text-xs font-semibold text-teal-400">{t('ollamaManagerPage.recommended')}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {RECOMMENDED_MODELS.map(rm => {
                  const isInstalled = installedNames.some(n => rm.pullName.includes(n) || n.includes(rm.pullName.split(':')[0]));
                  const isPulling = pulling === rm.pullName;
                  return (
                    <div key={rm.pullName} className={cn(
                      "rounded-lg p-2.5 border transition-colors",
                      rm.recommended ? "bg-teal-500/5 border-teal-500/20" : "bg-background/30 border-white/5",
                      isInstalled && "border-emerald-500/30 bg-emerald-500/5"
                    )}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-semibold">{rm.name}</span>
                            {rm.recommended && <Badge className="text-2xs h-3 px-1 bg-teal-500/20 text-teal-300 border-teal-500/30">{t('ollamaManagerPage.recommendedBadge')}</Badge>}
                            {isInstalled && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                          </div>
                          <p className="text-2xs text-muted-foreground leading-tight">{rm.description}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge variant="outline" className="text-2xs h-3 px-1 text-slate-400 border-slate-500/30">{rm.sizeGb}</Badge>
                            <Badge variant="outline" className="text-2xs h-3 px-1 text-cyan-400 border-cyan-500/30">VRAM {rm.vramGb}GB</Badge>
                            <Badge variant="outline" className={cn("text-2xs h-3 px-1",
                              rm.speed === 'fast' ? "text-emerald-400 border-emerald-500/30" :
                              rm.speed === 'medium' ? "text-amber-400 border-amber-500/30" :
                              "text-red-400 border-red-500/30"
                            )}>{rm.speed}</Badge>
                            <Badge variant="outline" className="text-2xs h-3 px-1 text-yellow-400 border-yellow-500/30">
                              {'★'.repeat(rm.quality)}{'☆'.repeat(5 - rm.quality)}
                            </Badge>
                          </div>
                        </div>
                        {!isInstalled && (
                          <Button
                            variant="outline" size="xs" className="text-2xs gap-1 shrink-0"
                            onClick={() => handlePull(rm.pullName)}
                            disabled={!!pulling}
                          >
                            {isPulling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                            {isPulling ? 'Download...' : 'Pull'}
                          </Button>
                        )}
                      </div>
                      {isPulling && (
                        <div className="mt-2 space-y-1">
                          <Progress value={pullProgress.percent} className="h-1.5" />
                          <p className="text-micro text-muted-foreground truncate">{pullProgress.status} — {pullProgress.percent}%</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Nuovi Modelli Scoperti Online */}
          {discovered.length > 0 && (
            <Card className="border-purple-500/20 bg-purple-950/20">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-semibold text-purple-400">Nuovi Modelli Disponibili ({discovered.length})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="xs" className="text-2xs gap-1 text-purple-300 hover:text-purple-200"
                      onClick={async () => {
                        setDiscovering(true);
                        try {
                          invalidateDiscoveryCache();
                          const names = installed.map(m => m.name);
                          const found = await discoverNewModels(names, true);
                          setDiscovered(found);
                        } catch {}
                        setDiscovering(false);
                      }}
                      disabled={discovering}
                    >
                      {discovering ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Aggiorna
                    </Button>
                  </div>
                </div>
                <p className="text-2xs text-muted-foreground mb-2">
                  Modelli trovati automaticamente su ollama.com, filtrati per utilità alla traduzione. Non ancora installati né nella lista consigliati.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {discovered.slice(0, 12).map(dm => {
                    const isPullingThis = pulling === dm.name;
                    return (
                      <div key={dm.name} className={cn(
                        "rounded-lg p-2.5 border transition-colors",
                        dm.isNew ? "bg-purple-500/5 border-purple-500/20" : "bg-background/30 border-white/5"
                      )}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-xs font-semibold">{dm.name}</span>
                              {dm.isNew && <Badge className="text-2xs h-3 px-1 bg-purple-500/20 text-purple-300 border-purple-500/30">NUOVO</Badge>}
                              <Badge variant="outline" className="text-2xs h-3 px-1 text-purple-400 border-purple-500/30">
                                {dm.relevanceScore}% rilevante
                              </Badge>
                            </div>
                            {dm.description && (
                              <p className="text-2xs text-muted-foreground leading-tight line-clamp-2">{dm.description}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {dm.pulls !== '0' && (
                                <Badge variant="outline" className="text-2xs h-3 px-1 text-slate-400 border-slate-500/30">
                                  <TrendingUp className="h-2 w-2 mr-0.5" />{dm.pulls} pulls
                                </Badge>
                              )}
                              {dm.sizes.length > 0 && (
                                <Badge variant="outline" className="text-2xs h-3 px-1 text-cyan-400 border-cyan-500/30">
                                  {dm.sizes.slice(0, 3).join(', ')}
                                </Badge>
                              )}
                              {dm.categories.map(c => (
                                <Badge key={c} variant="outline" className="text-2xs h-3 px-1 text-amber-400 border-amber-500/30">{c}</Badge>
                              ))}
                              {dm.updatedAgo !== 'unknown' && (
                                <Badge variant="outline" className="text-2xs h-3 px-1 text-slate-500 border-slate-600/30">{dm.updatedAgo}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={`https://ollama.com/library/${dm.name}`}
                              target="_blank"
                              rel="noopener"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <Button
                              variant="outline" size="xs" className="text-2xs gap-1"
                              onClick={() => handlePull(dm.name)}
                              disabled={!!pulling}
                            >
                              {isPullingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                              {isPullingThis ? '...' : 'Pull'}
                            </Button>
                          </div>
                        </div>
                        {isPullingThis && (
                          <div className="mt-2 space-y-1">
                            <Progress value={pullProgress.percent} className="h-1.5" />
                            <p className="text-micro text-muted-foreground truncate">{pullProgress.status} — {pullProgress.percent}%</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Speed Test Tutti */}
          {installed.length > 0 && (
            <Card className="border-cyan-500/20 bg-cyan-950/20">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-semibold text-cyan-400">{t('ollamaManagerPage.speedTest')}</span>
                  </div>
                  <Button
                    variant="outline" size="xs" className="text-2xs gap-1"
                    disabled={!!speedTesting}
                    onClick={async () => {
                      for (const m of installed) {
                        await handleSpeedTest(m.name);
                      }
                    }}
                  >
                    <Play className="h-3 w-3" /> Test Tutti
                  </Button>
                </div>
                {speedResults.size > 0 && (
                  <div className="space-y-1">
                    {[...speedResults.entries()]
                      .sort((a, b) => b[1].tokensPerSecond - a[1].tokensPerSecond)
                      .map(([name, sr], i) => (
                        <div key={name} className="flex items-center gap-2 bg-background/40 rounded px-2.5 py-1.5">
                          <span className={cn("text-xs font-bold w-5 text-center", i === 0 ? "text-yellow-400" : "text-muted-foreground")}>
                            {i === 0 ? '🏆' : `#${i + 1}`}
                          </span>
                          <span className="text-xs font-mono flex-1 truncate">{name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-cyan-300 tabular-nums">{sr.tokensPerSecond.toFixed(1)} tok/s</span>
                            <span className="text-2xs text-muted-foreground tabular-nums">TTFT {sr.firstTokenMs}ms</span>
                            <span className="text-2xs text-muted-foreground tabular-nums">{(sr.totalTimeMs / 1000).toFixed(1)}s</span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* A/B Comparison */}
          {installed.length >= 2 && (
            <Card className="border-violet-500/20 bg-violet-950/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowLeftRight className="h-4 w-4 text-violet-400" />
                  <span className="text-xs font-semibold text-violet-400">{t('ollamaManagerPage.abComparison')}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                  <div className="space-y-1">
                    <label className="text-2xs text-muted-foreground">{t('ollamaManagerPage.modelA')}</label>
                    <select
                      value={compareModelA}
                      onChange={e => setCompareModelA(e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {installed.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-2xs text-muted-foreground">{t('ollamaManagerPage.modelB')}</label>
                    <select
                      value={compareModelB}
                      onChange={e => setCompareModelB(e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {installed.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleCompare}
                      disabled={comparing || !compareModelA || !compareModelB || compareModelA === compareModelB}
                      className="w-full h-8 text-xs gap-1"
                    >
                      {comparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
                      {comparing ? 'Confronto in corso...' : 'Confronta'}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-2xs text-muted-foreground">{t('ollamaManagerPage.testText')}</label>
                  <Input
                    value={compareText}
                    onChange={e => setCompareText(e.target.value)}
                    placeholder="Inserisci testo da tradurre..."
                    className="text-xs h-8"
                  />
                </div>

                {compareResult && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {[compareResult.modelA, compareResult.modelB].map((r, _i) => (
                      <div key={r.name} className={cn(
                        "rounded-lg p-2.5 border",
                        r.timeMs <= Math.min(compareResult.modelA.timeMs, compareResult.modelB.timeMs)
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-white/5 bg-background/30"
                      )}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs font-mono font-bold">{r.name}</span>
                          {r.timeMs <= Math.min(compareResult.modelA.timeMs, compareResult.modelB.timeMs) && (
                            <Badge className="text-2xs h-3 px-1 bg-emerald-500/20 text-emerald-300">{t('ollamaManagerPage.faster')}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-foreground leading-relaxed mb-1.5">{r.translation}</p>
                        <div className="flex items-center gap-2 text-micro text-muted-foreground">
                          <span><Zap className="h-2.5 w-2.5 inline" /> {r.tokensPerSecond} tok/s</span>
                          <span><Timer className="h-2.5 w-2.5 inline" /> {(r.timeMs / 1000).toFixed(1)}s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
