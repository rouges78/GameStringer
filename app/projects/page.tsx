'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Rocket,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Loader2,
  Gamepad2,
  Globe,
  FileText,
  Plus,
  ArrowRight,
  Trash2,
  Download,
  Upload,
  FolderInput,
  BookOpen,
  Languages,
  TrendingUp,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { invoke } from '@/lib/tauri-api';
import { ensureArray } from '@/lib/array-utils';
import { clientLogger } from '@/lib/client-logger';
import { useTranslation } from '@/lib/i18n';
import { qualityScoringService, type TranslationProject } from '@/lib/quality/quality-scoring';
import { projectService } from '@/lib/services/translation-projects';
import { loadTranslatedFiles } from '@/lib/services/translated-files-store';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────

interface UnifiedProject {
  id: string;
  gameId: string;
  gameName: string;
  coverUrl?: string;
  platform: string;
  sourceLanguage: string;
  targetLanguage: string;
  totalStrings: number;
  completedStrings: number;
  lastUpdated: string;
  source: 'active' | 'quality' | 'dictionary' | 'translation_memory' | 'game';
  status: 'in_progress' | 'completed' | 'empty';
  qualityScore?: number;
  openHref?: string;
}

type FilterStatus = 'all' | 'in_progress' | 'completed' | 'empty';

// ─── Helpers ─────────────────────────────────────────────────

const LANG_FLAGS: Record<string, string> = {
  en: '🇬🇧',
  it: '🇮🇹',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  pt: '🇵🇹',
  ru: '🇷🇺',
  ja: '🇯🇵',
  zh: '🇨🇳',
  ko: '🇰🇷',
  pl: '🇵🇱',
};

const SOURCE_LABELS: Record<UnifiedProject['source'], { label: string; color: string; icon: typeof BookOpen }> = {
  active: { label: 'In Traduzione', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30', icon: Rocket },
  quality: { label: 'Quality Scoring', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: TrendingUp },
  dictionary: { label: 'Dictionary', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: BookOpen },
  translation_memory: { label: 'Translation Memory', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: Languages },
  game: { label: 'Game Library', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: Gamepad2 },
};

function getStatus(completed: number, total: number): UnifiedProject['status'] {
  if (total === 0) return 'empty';
  if (completed >= total) return 'completed';
  return 'in_progress';
}

function percent(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

// ─── API types ───────────────────────────────────────────────

interface DictEntry {
  id?: string;
  game_id?: string;
  game_name?: string;
  updated_at?: string;
  entries_count?: number;
  target_language?: string;
  source_language?: string;
}

interface TransApiItem {
  gameId?: string;
  game?: { title?: string; platform?: string };
  updatedAt?: string;
  status?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

interface GameApiItem {
  id: string;
  title: string;
  platform?: string;
  header_image?: string;
  coverUrl?: string;
  updatedAt?: string;
  translationStats?: { total: number; completed: number };
}

// ─── Data loader ─────────────────────────────────────────────

async function loadAllProjects(): Promise<UnifiedProject[]> {
  const projectsMap = new Map<string, UnifiedProject>();

  // 0. Active Translation Projects (IndexedDB) - PRIORITÀ MASSIMA
  try {
    const activeProjects = await projectService.getAllProjects();
    for (const p of activeProjects) {
      const key = `active:${p.id}`;
      projectsMap.set(key, {
        id: key,
        gameId: p.gameId,
        gameName: p.gameName,
        coverUrl: p.gameImage,
        platform: p.engine || 'unknown',
        sourceLanguage: p.sourceLanguage,
        targetLanguage: p.targetLanguage,
        totalStrings: p.totalStrings,
        completedStrings: p.translatedStrings,
        lastUpdated: p.lastActivityAt || p.updatedAt,
        source: 'active',
        status: p.status === 'completed' ? 'completed' : p.status === 'active' ? 'in_progress' : 'empty',
        // Il dettaglio gioco basta id+nome; /auto-translate invece richiede
        // gameId && gameName && installPath (che qui non abbiamo) e senza
        // quelli restava inerte: "Apri" sembrava rotto.
        openHref: `/library?id=${encodeURIComponent(p.gameId)}&name=${encodeURIComponent(p.gameName)}`,
      });
    }
    clientLogger.debug(`[Projects] Caricati ${activeProjects.length} progetti attivi`);
  } catch (e: unknown) {
    clientLogger.warn('[Projects] Progetti attivi non disponibili:', e);
  }

  // 1. Quality Scoring projects (localStorage)
  try {
    const qsProjects: TranslationProject[] = qualityScoringService.listProjects();
    for (const p of qsProjects) {
      const key = `qs:${p.id}`;
      projectsMap.set(key, {
        id: key,
        gameId: p.gameAppId ? String(p.gameAppId) : p.id,
        gameName: p.gameName,
        platform: 'quality',
        sourceLanguage: p.sourceLanguage,
        targetLanguage: p.targetLanguage,
        totalStrings: p.stats.total,
        completedStrings: p.stats.translated,
        lastUpdated: p.updatedAt,
        source: 'quality',
        status: getStatus(p.stats.translated, p.stats.total),
        qualityScore: p.stats.score,
        openHref: '/quality-scoring',
      });
    }
  } catch (e: unknown) {
    clientLogger.warn('[Projects] Quality scoring non disponibile:', e);
  }

  // 2. Tauri dictionaries
  try {
    const dictData = await invoke<unknown[]>('list_installed_dictionaries');
    for (const dict of ensureArray(dictData) as DictEntry[]) {
      const gameId = dict.game_id || dict.id || 'unknown';
      const gameName = dict.game_name || 'Gioco sconosciuto';
      const key = `dict:${gameId}:${dict.target_language || 'it'}`;

      const existing = projectsMap.get(key);
      const entries = dict.entries_count || 0;

      if (existing) {
        existing.totalStrings += entries;
        existing.completedStrings += entries;
      } else {
        projectsMap.set(key, {
          id: key,
          gameId,
          gameName,
          platform: 'dictionary',
          sourceLanguage: dict.source_language || 'en',
          targetLanguage: dict.target_language || 'it',
          totalStrings: entries,
          completedStrings: entries,
          lastUpdated: dict.updated_at || new Date().toISOString(),
          source: 'dictionary',
          status: 'completed',
          openHref: `/editor?gameId=${encodeURIComponent(gameId)}`,
        });
      }
    }
  } catch (e: unknown) {
    clientLogger.warn('[Projects] Dizionari Tauri non disponibili:', e);
  }

  // /api/* non esiste in Tauri (tutto via invoke): salta i fetch legacy per non
  // generare 501 in console. Restano attivi solo in un eventuale build web.
  const _hasApi = typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window);

  // 3. Translation Memory via API
  if (_hasApi) try {
    const resp = await fetch('/api/translations');
    if (resp.ok) {
      const data = (await resp.json()) as TransApiItem[];
      const grouped = new Map<string, { total: number; completed: number; updatedAt: string; gameName: string; platform: string; src: string; tgt: string }>();

      for (const trans of ensureArray(data) as TransApiItem[]) {
        const gameId = trans.gameId || 'unknown';
        const key = `${gameId}:${trans.targetLanguage || 'it'}`;
        const g = grouped.get(key) || {
          total: 0,
          completed: 0,
          updatedAt: trans.updatedAt || new Date().toISOString(),
          gameName: trans.game?.title || 'Gioco sconosciuto',
          platform: trans.game?.platform || 'unknown',
          src: trans.sourceLanguage || 'en',
          tgt: trans.targetLanguage || 'it',
        };
        g.total += 1;
        if (trans.status === 'completed' || trans.status === 'reviewed') g.completed += 1;
        if (trans.updatedAt && trans.updatedAt > g.updatedAt) g.updatedAt = trans.updatedAt;
        grouped.set(key, g);
      }

      for (const [key, g] of grouped) {
        const [gameId] = key.split(':');
        const mapKey = `tm:${key}`;
        projectsMap.set(mapKey, {
          id: mapKey,
          gameId,
          gameName: g.gameName,
          platform: g.platform,
          sourceLanguage: g.src,
          targetLanguage: g.tgt,
          totalStrings: g.total,
          completedStrings: g.completed,
          lastUpdated: g.updatedAt,
          source: 'translation_memory',
          status: getStatus(g.completed, g.total),
          openHref: `/editor?gameId=${encodeURIComponent(gameId)}`,
        });
      }
    }
  } catch (e: unknown) {
    clientLogger.warn('[Projects] Translation memory API non disponibile:', e);
  }

  // 4. Games con translationStats (solo se non già presenti)
  if (_hasApi) try {
    const resp = await fetch('/api/games');
    if (resp.ok) {
      const data = (await resp.json()) as GameApiItem[];
      for (const game of ensureArray(data) as GameApiItem[]) {
        if (!game.translationStats || game.translationStats.total === 0) continue;
        const key = `game:${game.id}`;
        if (projectsMap.has(key)) continue;

        // Controlla se c'è già un progetto per questo gameId
        const hasAny = Array.from(projectsMap.values()).some(p => p.gameId === game.id);
        if (hasAny) continue;

        projectsMap.set(key, {
          id: key,
          gameId: game.id,
          gameName: game.title,
          coverUrl: game.header_image || game.coverUrl,
          platform: game.platform || 'steam',
          sourceLanguage: 'en',
          targetLanguage: 'it',
          totalStrings: game.translationStats.total,
          completedStrings: game.translationStats.completed,
          lastUpdated: game.updatedAt || new Date().toISOString(),
          source: 'game',
          status: getStatus(game.translationStats.completed, game.translationStats.total),
          openHref: `/auto-translate?gameId=${encodeURIComponent(game.id)}`,
        });
      }
    }
  } catch (e: unknown) {
    clientLogger.warn('[Projects] Games API non disponibile:', e);
  }

  // Sort: più recenti prima
  return Array.from(projectsMap.values()).sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  );
}

// ─── Project Card ────────────────────────────────────────────

function ProjectCard({
  project,
  onDelete,
  onExport,
  onPublish,
  onApply,
}: {
  project: UnifiedProject;
  onDelete: (p: UnifiedProject) => void;
  onExport: (p: UnifiedProject) => void;
  onPublish: (p: UnifiedProject) => void;
  onApply: (p: UnifiedProject) => void;
}) {
  const { t } = useTranslation();
  const pct = percent(project.completedStrings, project.totalStrings);
  const sourceInfo = SOURCE_LABELS[project.source];
  const SourceIcon = sourceInfo.icon;

  const statusColor =
    project.status === 'completed'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : project.status === 'in_progress'
        ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
        : 'text-slate-500 bg-slate-500/10 border-slate-500/30';

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/50 backdrop-blur-sm hover:border-violet-500/50 hover:bg-slate-900/80 transition-all duration-200 shadow-lg hover:shadow-violet-500/10">
      {/* Cover */}
      {project.coverUrl ? (
        <div className="relative h-28 overflow-hidden bg-slate-800">
          <img
            src={project.coverUrl}
            alt={project.gameName}
            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
        </div>
      ) : (
        <div className="relative h-28 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 flex items-center justify-center">
          <Gamepad2 className="w-12 h-12 text-slate-700 group-hover:text-slate-600 transition-colors" />
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title + source */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-bold text-slate-100 text-sm leading-tight line-clamp-2 flex-1">
              {project.gameName}
            </h3>
            <Badge variant="outline" className={cn('text-2xs px-1.5 py-0 h-5 shrink-0', statusColor)}>
              {project.status === 'completed' ? (
                <CheckCircle2 className="w-3 h-3 mr-1" />
              ) : project.status === 'in_progress' ? (
                <Clock className="w-3 h-3 mr-1" />
              ) : null}
              {project.status === 'completed'
                ? 'Completato'
                : project.status === 'in_progress'
                  ? 'In corso'
                  : 'Vuoto'}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-2xs">
            <Badge variant="outline" className={cn('h-5 px-1.5 py-0 font-normal', sourceInfo.color)}>
              <SourceIcon className="w-3 h-3 mr-1" />
              {sourceInfo.label}
            </Badge>
          </div>
        </div>

        {/* Languages */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="text-base leading-none">{LANG_FLAGS[project.sourceLanguage] || '🌐'}</span>
          <ArrowRight className="w-3 h-3" />
          <span className="text-base leading-none">{LANG_FLAGS[project.targetLanguage] || '🌐'}</span>
          <span className="text-slate-500 ml-1">
            {project.sourceLanguage.toUpperCase()} → {project.targetLanguage.toUpperCase()}
          </span>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-2xs">
            <span className="text-slate-400">
              {project.completedStrings.toLocaleString()} / {project.totalStrings.toLocaleString()}  {t('projectsPage.stringsUnit')}</span>
            <span className="text-slate-300 font-semibold">{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>

        {/* Quality score (se quality) */}
        {project.qualityScore !== undefined && project.source === 'quality' && (
          <div className="flex items-center gap-1.5 text-2xs text-slate-400">
            <TrendingUp className="w-3 h-3" />
            <span>
              {t('projectsPage.qualityLabel')} <span className="text-purple-300 font-semibold">{project.qualityScore.toFixed(1)}/3.0</span>
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pt-1">
          {project.openHref && (
            <Link href={project.openHref} className="flex-1">
              <Button size="sm" variant="default" className="w-full h-7 text-2xs bg-violet-600 hover:bg-violet-500">
                <FileText className="w-3 h-3 mr-1" />
                {t('projectsPage.open')}</Button>
            </Link>
          )}
          {project.status === 'completed' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-slate-400 hover:text-cyan-300"
              onClick={() => onApply(project)}
              title={t('projectsPage.applyTitle')}
            >
              <FolderInput className="w-3 h-3" />
            </Button>
          )}
          {project.status === 'completed' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-slate-400 hover:text-emerald-300"
              onClick={() => onPublish(project)}
              title={t('projectsPage.publishTitle')}
            >
              <Share2 className="w-3 h-3" />
            </Button>
          )}
          {project.source === 'quality' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
                onClick={() => onExport(project)}
                title={t('projectsPage.exportTitle')}
              >
                <Download className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-slate-400 hover:text-red-400"
                onClick={() => onDelete(project)}
                title={t('projectsPage.deleteTitle')}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────

export default function ProjectsPage() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<UnifiedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterLang, setFilterLang] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');

  const reload = async () => {
    setLoading(true);
    try {
      // Backfill: ricrea i progetti dai checkpoint Visionaire già salvati (giochi
      // su cui hai già lavorato prima che Progetti li registrasse).
      try {
        const { backfillVisionaireProjects } = await import('@/lib/backfill-visionaire-projects');
        await backfillVisionaireProjects();
      } catch { /* backfill best-effort */ }
      const data = await loadAllProjects();
      setProjects(data);
    } catch (e: unknown) {
      clientLogger.error('[ProjectsPage] Load error:', e);
      toast.error(t('projectsPage.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterLang !== 'all' && p.targetLanguage !== filterLang) return false;
      if (filterSource !== 'all' && p.source !== filterSource) return false;
      if (search && !p.gameName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [projects, filterStatus, filterLang, filterSource, search]);

  const stats = useMemo(() => {
    return {
      total: projects.length,
      inProgress: projects.filter(p => p.status === 'in_progress').length,
      completed: projects.filter(p => p.status === 'completed').length,
      totalStrings: projects.reduce((s, p) => s + p.totalStrings, 0),
      completedStrings: projects.reduce((s, p) => s + p.completedStrings, 0),
    };
  }, [projects]);

  const availableLangs = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => set.add(p.targetLanguage));
    return Array.from(set).sort();
  }, [projects]);

  const handleDelete = (p: UnifiedProject) => {
    if (!confirm(`Eliminare il progetto "${p.gameName}"?`)) return;
    if (p.source === 'quality') {
      const qsId = p.id.replace(/^qs:/, '');
      qualityScoringService.deleteProject(qsId);
      toast.success(t('projectsPage.projectDeleted'));
      reload();
    }
  };

  const handleExport = (p: UnifiedProject) => {
    if (p.source === 'quality') {
      const qsId = p.id.replace(/^qs:/, '');
      const data = qualityScoringService.exportProject(qsId);
      if (data) {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${p.gameName.replace(/[^\w-]/g, '_')}_${p.targetLanguage}.gsproj.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(t('projectsPage.projectExported'));
      }
    }
  };

  // Ponte verso il Patch Hub: pubblica il progetto completato via publishPack
  // (Supabase). Il pack entra in stato "pending" (moderazione). Contenuto: export
  // completo per i progetti quality, altrimenti un manifest con i metadati.
  const handlePublish = async (p: UnifiedProject) => {
    // Preferisci SEMPRE il file tradotto reale se persistito (es. da import .gspack):
    // così si pubblica la traduzione vera, non un manifest di metadati.
    const stored = await loadTranslatedFiles(p.gameId, p.targetLanguage);
    let files: File[];
    if (stored && stored.length) {
      files = stored.map(f => new File([f.content], f.path, { type: 'application/json' }));
    } else if (p.source === 'quality') {
      const qsId = p.id.replace(/^qs:/, '');
      const content = qualityScoringService.exportProject(qsId) || '';
      if (!content) { toast.error(t('projectsPage.publishNoContent')); return; }
      const safeName = `${p.gameName.replace(/[^\w-]/g, '_')}_${p.targetLanguage}.gsproj.json`;
      files = [new File([content], safeName, { type: 'application/json' })];
    } else {
      // Nessun contenuto reale disponibile: non pubblicare un manifest vuoto.
      toast.error(t('projectsPage.publishNoContent'));
      return;
    }
    const tid = toast.loading(t('projectsPage.publishing'));
    try {
      const { publishPack } = await import('@/lib/social/community-hub-backend');
      const pct = p.totalStrings > 0 ? Math.round((p.completedStrings / p.totalStrings) * 100) : 0;
      await publishPack({
        name: `${p.gameName} — ${p.targetLanguage.toUpperCase()}`,
        gameId: p.gameId,
        gameName: p.gameName,
        sourceLanguage: p.sourceLanguage,
        targetLanguage: p.targetLanguage,
        totalStrings: p.totalStrings,
        translatedStrings: p.completedStrings,
        completionPercentage: pct,
      }, files);
      toast.success(t('projectsPage.publishSuccess'), { id: tid, description: t('projectsPage.publishModeration') });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('autenticato')) {
        toast.error(t('projectsPage.publishNeedLogin'), { id: tid });
      } else {
        clientLogger.error(`[Projects] publish failed:`, msg);
        toast.error(t('projectsPage.publishError'), { id: tid, description: msg });
      }
    }
  };

  // Applica al gioco: copia i file tradotti persistiti nell'installazione scelta
  // dall'utente, facendo un backup .bak prima di sovrascrivere. Sicuro: se il
  // backup di un file esistente fallisce, quel file viene SALTATO (mai sovrascritto).
  const handleApply = async (p: UnifiedProject) => {
    const stored = await loadTranslatedFiles(p.gameId, p.targetLanguage);
    if (!stored || !stored.length) { toast.error(t('projectsPage.applyNoContent')); return; }

    let dir: string | null = null;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const picked = await open({ directory: true, multiple: false, title: t('projectsPage.applyPickFolder') });
      dir = typeof picked === 'string' ? picked : null;
    } catch {
      toast.error(t('projectsPage.applyError'));
      return;
    }
    if (!dir) return;

    const tid = toast.loading(t('projectsPage.applying'));
    try {
      const fsp = await import('@tauri-apps/plugin-fs');
      let written = 0; let skipped = 0;
      for (const f of stored) {
        const rel = (f.originalPath || f.path).replace(/\\/g, '/').replace(/^\/+/, '');
        const target = `${dir}/${rel}`;
        const folder = target.slice(0, target.lastIndexOf('/'));
        // Backup obbligatorio se il file esiste già
        try {
          if (await fsp.exists(target)) {
            await fsp.copyFile(target, `${target}.bak`);
          }
        } catch {
          skipped++; // backup fallito → non sovrascrivere
          continue;
        }
        try { await fsp.mkdir(folder, { recursive: true }); } catch { /* già esiste */ }
        await fsp.writeTextFile(target, f.content);
        written++;
      }
      if (written > 0) {
        toast.success(t('projectsPage.applySuccess'), { id: tid, description: `${written} file · ${skipped} saltati` });
      } else {
        toast.error(t('projectsPage.applyError'), { id: tid, description: `${skipped} saltati (backup non riuscito)` });
      }
    } catch (e: unknown) {
      toast.error(t('projectsPage.applyError'), { id: tid, description: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.gsproj.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const project = qualityScoringService.importProject(text);
        if (project) {
          toast.success(`Progetto "${project.gameName}" importato`);
          reload();
        } else {
          toast.error(t('projectsPage.invalidFile'));
        }
      } catch (err: unknown) {
        clientLogger.error('Import failed:', err);
        toast.error(t('projectsPage.importError'));
      }
    };
    input.click();
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{t('nav.projects')}</h1>
            <p className="text-sm text-slate-400">
              {t('projectsPage.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="w-4 h-4 mr-2" />
            {t('projectsPage.importBtn')}</Button>
          <Link href="/auto-translate">
            <Button size="sm" className="bg-violet-600 hover:bg-violet-500">
              <Plus className="w-4 h-4 mr-2" />
              {t('projectsPage.newProject')}</Button>
          </Link>
        </div>
      </div>

      {/* Stats cards — nascosti quando non c'è ancora alcun progetto (impalcatura inerte) */}
      {projects.length > 0 && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label={t('projectsPage.totalProjectsLabel')} value={stats.total} icon={Rocket} color="text-violet-400" />
        <StatCard label={t('projectsPage.inProgress')} value={stats.inProgress} icon={Clock} color="text-cyan-400" />
        <StatCard label={t('projectsPage.completed')} value={stats.completed} icon={CheckCircle2} color="text-emerald-400" />
        <StatCard
          label={t('projectsPage.translatedStringsLabel')}
          value={`${stats.completedStrings.toLocaleString()} / ${stats.totalStrings.toLocaleString()}`}
          icon={FileText}
          color="text-amber-400"
        />
      </div>
      )}

      {/* Filters — mostrati solo se esistono progetti (altrimenti sono controlli inerti) */}
      {projects.length > 0 && (
      <div className="flex flex-wrap items-center gap-2 mb-6 p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder={t('projectsPage.searchPh')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 bg-slate-800/50 border-slate-700"
          />
        </div>

        <Select value={filterStatus} onValueChange={(v: string) => setFilterStatus(v as FilterStatus)}>
          <SelectTrigger className="w-[140px] h-9 bg-slate-800/50 border-slate-700">
            <Filter className="w-3.5 h-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('projectsPage.allStatuses')}</SelectItem>
            <SelectItem value="in_progress">{t('projectsPage.inProgress')}</SelectItem>
            <SelectItem value="completed">{t('projectsPage.completed')}</SelectItem>
            <SelectItem value="empty">{t('projectsPage.empty')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterLang} onValueChange={setFilterLang}>
          <SelectTrigger className="w-[140px] h-9 bg-slate-800/50 border-slate-700">
            <Globe className="w-3.5 h-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('projectsPage.allLanguages')}</SelectItem>
            {availableLangs.map(lang => (
              <SelectItem key={lang} value={lang}>
                {LANG_FLAGS[lang] || '🌐'} {lang.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-[160px] h-9 bg-slate-800/50 border-slate-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('projectsPage.allSources')}</SelectItem>
            <SelectItem value="quality">{t('projectsPage.qualityScoring')}</SelectItem>
            <SelectItem value="dictionary">{t('projectsPage.dictionary')}</SelectItem>
            <SelectItem value="translation_memory">{t('projectsPage.translationMemory')}</SelectItem>
            <SelectItem value="game">{t('projectsPage.gameLibrary')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <p className="text-sm">{t('projectsPage.loadingProjects')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
            <Rocket className="w-10 h-10 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-1">
            {projects.length === 0 ? 'Nessun progetto ancora' : 'Nessun progetto trovato'}
          </h3>
          <p className="text-sm text-slate-500 mb-4 max-w-md">
            {projects.length === 0
              ? "Inizia a tradurre un gioco per vederlo apparire qui. I progetti vengono raccolti da Quality Scoring, dizionari, Translation Memory e libreria giochi."
              : 'Prova a modificare i filtri di ricerca.'}
          </p>
          {projects.length === 0 && (
            <Link href="/auto-translate">
              <Button className="bg-violet-600 hover:bg-violet-500">
                <Plus className="w-4 h-4 mr-2" />
                {t('projectsPage.startTranslating')}</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={handleDelete}
              onExport={handleExport}
              onPublish={handlePublish}
              onApply={handleApply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: typeof Rocket;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 backdrop-blur-sm p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-4 h-4', color)} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="text-xl font-bold text-slate-100">{value}</div>
    </div>
  );
}

