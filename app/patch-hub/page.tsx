'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Package,
  Download,
  ArrowLeft,
  Search,
  CheckCircle2,
  Loader2,
  FileText,
  ShieldCheck,
  Upload,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { useProfiles } from '@/hooks/use-profiles';
import { communityHubService, type TranslationPack } from '@/lib/social/community-hub-service';
import { PackCard, STATUS_CLS, STATUS_KEY } from '@/components/community/pack-card';
import { projectService } from '@/lib/services/translation-projects';
import { useDefaultTargetLang } from '@/lib/translation/use-default-target-lang';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}

// PackCard/Stars/STATUS_* vivono in components/community/pack-card.tsx,
// condivisi con la tab Pack del Community Hub (estratti da qui il 09/08/2026).

// ─── Detail view (?id=X) ────────────────────────────────────────────────────────

function PackDetail({ packId, onBack }: { packId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pack, setPack] = useState<TranslationPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    communityHubService
      .getPackDetails(packId)
      .then((p) => {
        if (!alive) return;
        setPack(p);
        setInstalled(communityHubService.isPackInstalled(packId));
      })
      .catch(() => alive && setPack(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [packId]);

  const handleDownload = async () => {
    if (!pack) return;
    setDownloading(true);
    try {
      // Scarica i file dal backend e salva il .gspack nella libreria pack locale.
      // L'applicazione al gioco avviene poi dal dettaglio gioco (import .gspack).
      await communityHubService.downloadPack(pack.id, '');
      setInstalled(true);
      toast.success(t('patchHubPage.downloadedToast'));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('patchHubPage.downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-amber-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
        <Package className="h-8 w-8 opacity-30" />
        <p className="text-sm">{t('patchHubPage.notFound')}</p>
        <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5 mr-1" /> {t('patchHubPage.notFoundBack')}</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 text-slate-400 hover:text-amber-300">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> {t('patchHubPage.title')}
      </Button>

      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <Package className="h-6 w-6 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-200">{pack.name}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[pack.status]}`}>
              {t(`patchHubPage.${STATUS_KEY[pack.status]}`)}
            </span>
            {pack.author.verifiedTranslator && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                <ShieldCheck className="h-3 w-3" /> {t('patchHubPage.verifiedTranslator')}
              </span>
            )}
            {pack.contentSha256 && (
              <span
                className="inline-flex items-center gap-1 text-[10px] text-emerald-400"
                title={t('patchHubPage.integrityDesc')}
              >
                <ShieldCheck className="h-3 w-3" /> {t('patchHubPage.integrityBadge')}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {pack.gameName} · <span className="uppercase">{pack.sourceLanguage}→{pack.targetLanguage}</span> · v{pack.version} · {t('patchHubPage.by')}{' '}
            {/* ?profile= e non /u/<username>: con output:'export' la route
                dinamica emette solo /u/_ (vedi app/u/[username]/page.tsx) */}
            <button
              onClick={() => router.push(`/community-hub?profile=${encodeURIComponent(pack.author.username)}`)}
              className="text-amber-300/90 hover:text-amber-200 hover:underline"
            >
              {pack.author.username}
            </button>
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: t('patchHubPage.statCompletion'), value: `${pack.completionPercentage}%` },
          { label: t('patchHubPage.statRating'), value: `${pack.rating.toFixed(1)} (${pack.ratingCount})` },
          { label: t('patchHubPage.statDownloads'), value: pack.downloads.toLocaleString() },
          { label: t('patchHubPage.statSize'), value: formatBytes(pack.size) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2.5">
            <div className="text-base font-semibold text-slate-200 leading-none">{s.value}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Download / Apply */}
      <div className="flex items-center gap-2 mb-6">
        {installed ? (
          <div className="inline-flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> {t('patchHubPage.downloaded')}
          </div>
        ) : (
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white"
          >
            {downloading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
            {t('patchHubPage.download')}
          </Button>
        )}
      </div>

      {pack.description && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('patchHubPage.descriptionLabel')}</h2>
          <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">{pack.description}</p>
        </section>
      )}

      {/* Files */}
      {pack.files?.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('patchHubPage.filesLabel')} ({pack.files.length})</h2>
          <div className="space-y-1.5">
            {pack.files.map((f) => (
              <div key={f.path} className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2 text-xs">
                <span className="flex items-center gap-2 text-slate-300 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <span className="text-slate-600 uppercase">{f.type}</span>
                </span>
                <span className="text-slate-500 flex-shrink-0">{formatBytes(f.size)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Changelog */}
      {pack.changelog?.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('patchHubPage.changelogLabel')}</h2>
          <div className="space-y-3">
            {pack.changelog.map((c) => (
              <div key={c.version} className="text-xs">
                <div className="text-slate-300 font-medium">v{c.version} <span className="text-slate-600 font-normal">· {new Date(c.date).toLocaleDateString()}</span></div>
                <ul className="mt-1 ml-4 list-disc text-slate-400 space-y-0.5">
                  {c.changes.map((ch, i) => <li key={i}>{ch}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Publish dialog ─────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function PublishDialog({ open, onOpenChange, onPublished }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPublished: (packId: string) => void;
}) {
  const { t } = useTranslation();
  const { currentProfile } = useProfiles();
  const [name, setName] = useState('');
  const [gameName, setGameName] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('en');
  useDefaultTargetLang(setTargetLanguage);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Precompila dal progetto completato più recente (regola: si pubblica DAL
  // progetto completato). Non sovrascrive i campi che l'utente ha già toccato.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    projectService.getAllProjects().then((projects) => {
      if (cancelled) return;
      const completed = projects
        .filter((p) => p.status === 'completed' || p.progress >= 100)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      const p = completed[0];
      if (!p) return;
      setName((n) => n || `${p.gameName} — ${(p.targetLanguage || 'it').toUpperCase()}`);
      setGameName((g) => g || p.gameName);
      if (p.sourceLanguage) setSourceLanguage(p.sourceLanguage);
      if (p.targetLanguage) setTargetLanguage(p.targetLanguage);
    }).catch(() => { /* nessun progetto o storage non disponibile */ });
    return () => { cancelled = true; };
  }, [open]);

  const reset = () => {
    setName(''); setGameName(''); setDescription(''); setTags(''); setFiles([]);
    setSourceLanguage('en'); setTargetLanguage('it');
  };

  const canSubmit = name.trim() && gameName.trim() && files.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!currentProfile) {
      toast.error(t('patchHubPage.publishLoginRequired'));
      return;
    }
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const author = {
        id: currentProfile.id,
        username: currentProfile.name || currentProfile.id,
        avatar: currentProfile.avatar_path || undefined,
        reputation: 0,
        totalContributions: 0,
        verifiedTranslator: false,
      };
      const pack = await communityHubService.createPack({
        name: name.trim(),
        gameId: slugify(gameName),
        gameName: gameName.trim(),
        sourceLanguage,
        targetLanguage,
        description: description.trim(),
        tags: tags.split(',').map((x) => x.trim()).filter(Boolean),
        files,
        author,
      });
      await communityHubService.publishPack(pack.id, files);
      toast.success(t('patchHubPage.publishedToast'));
      reset();
      onOpenChange(false);
      // Dopo la pubblicazione online il record canonico è quello remoto (UUID
      // Supabase); apri quello se disponibile, altrimenti l'id locale (bozza).
      onPublished(pack.remoteId ?? pack.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'community-hub:online-login-required') {
        toast.error(t('patchHubPage.publishOnlineLoginRequired'));
      } else if (msg === 'community-hub:redistribution-blocked') {
        toast.error(t('patchHubPage.publishRedistributionBlocked'));
      } else {
        toast.error(msg || t('patchHubPage.publishFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-amber-400" /> {t('patchHubPage.publishTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t('patchHubPage.fieldName')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('patchHubPage.fieldNamePlaceholder')} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t('patchHubPage.fieldGame')}</Label>
            <Input value={gameName} onChange={(e) => setGameName(e.target.value)} placeholder={t('patchHubPage.fieldGamePlaceholder')} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('patchHubPage.fieldSource')}</Label>
              <Input value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)} placeholder="en" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">{t('patchHubPage.fieldTarget')}</Label>
              <Input value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} placeholder="it" className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">{t('patchHubPage.descriptionLabel')}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('patchHubPage.fieldDescriptionPlaceholder')} className="mt-1" rows={3} />
          </div>
          <div>
            <Label className="text-xs">{t('patchHubPage.fieldTags')}</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('patchHubPage.fieldTagsPlaceholder')} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t('patchHubPage.fieldFiles')}</Label>
            <label className="mt-1 flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-slate-700 bg-slate-900/40 cursor-pointer hover:border-amber-500/40 transition-colors">
              <Upload className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-slate-400">
                {files.length > 0 ? `${files.length} ${t('patchHubPage.filesSelected')}` : t('patchHubPage.filesPlaceholder')}
              </span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('patchHubPage.cancel')}</Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-1.5" />}
            {t('patchHubPage.publishConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PatchHubPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const { currentProfile } = useProfiles();
  const [packs, setPacks] = useState<TranslationPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'downloads' | 'rating' | 'updated' | 'completion'>('downloads');
  const [scope, setScope] = useState<'explore' | 'mine'>('explore');
  const [publishOpen, setPublishOpen] = useState(false);

  // "Le mie patch" = quelle pubblicate dal profilo corrente (distinzione
  // privato/pubblico: i Progetti sono il workspace, qui vedi le TUE pubblicate).
  const visiblePacks = scope === 'mine' && currentProfile
    ? packs.filter((p) => p.author?.id === currentProfile.id)
    : packs;

  const load = useCallback(() => {
    setLoading(true);
    communityHubService
      .searchPacks({ query: query || undefined, sortBy, sortOrder: 'desc', limit: 60 })
      .then((r) => setPacks(r.packs))
      .catch(() => setPacks([]))
      .finally(() => setLoading(false));
  }, [query, sortBy]);

  useEffect(() => {
    if (id) return; // in detail view, skip list load
    const timer = setTimeout(load, 250); // debounce ricerca
    return () => clearTimeout(timer);
  }, [id, load]);

  const openPack = (packId: string) => router.push(`/patch-hub?id=${encodeURIComponent(packId)}`);
  const backToList = () => router.push('/patch-hub');

  // Detail view (route dinamica via query param, da regola progetto)
  if (id) {
    return (
      <div className="h-full overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        <PackDetail packId={id} onBack={backToList} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-200">{t('patchHubPage.title')}</h1>
            <p className="text-slate-500 text-xs mt-0.5">{t('patchHubPage.subtitle')}</p>
          </div>
        </div>
        <Button
          onClick={() => setPublishOpen(true)}
          className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white"
        >
          <UploadCloud className="h-4 w-4 mr-1.5" /> {t('patchHubPage.publish')}
        </Button>
      </div>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onPublished={(packId) => { load(); openPack(packId); }}
      />

      {/* Scope: Esplora (community) vs Le mie patch (pubblicate dal profilo) */}
      <div className="flex items-center gap-2 mb-3">
        {(['explore', 'mine'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              scope === s
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            {s === 'explore' ? t('patchHubPage.scopeExplore') : t('patchHubPage.scopeMine')}
          </button>
        ))}
      </div>

      {/* Toolbar: search + sort */}
      <div className="flex items-center gap-2 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('patchHubPage.searchPlaceholder')}
            className="pl-8 h-9"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="h-9 rounded-md bg-slate-900 border border-slate-700 text-xs text-slate-300 px-2"
        >
          <option value="downloads">{t('patchHubPage.sortDownloads')}</option>
          <option value="rating">{t('patchHubPage.sortRating')}</option>
          <option value="updated">{t('patchHubPage.sortUpdated')}</option>
          <option value="completion">{t('patchHubPage.sortCompletion')}</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-amber-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : visiblePacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-2">
          <Package className="h-8 w-8 opacity-30" />
          <p className="text-sm">{scope === 'mine' ? t('patchHubPage.emptyMineTitle') : t('patchHubPage.emptyTitle')}</p>
          <p className="text-xs text-slate-600">{scope === 'mine' ? t('patchHubPage.emptyMineHint') : t('patchHubPage.emptyHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visiblePacks.map((p) => (
            <PackCard key={p.id} pack={p} onOpen={openPack} />
          ))}
        </div>
      )}
    </div>
  );
}
