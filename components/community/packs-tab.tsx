'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Package, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';
import { communityHubService, type TranslationPack } from '@/lib/social/community-hub-service';
import { PackCard } from '@/components/community/pack-card';

type SortBy = 'downloads' | 'rating' | 'updated' | 'completion';

// Tab Pack del Community Hub — legge i pack VERI (translation_packs, stessa
// fonte del Patch Hub). Fino al 09/08/2026 questa tab mostrava i thread del
// forum marcati is_translation_pack: pubblicare un pack dal Patch Hub o da
// Progetti non faceva comparire NIENTE qui — due dataset scollegati.
export function PacksTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const [packs, setPacks] = useState<TranslationPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('downloads');

  useEffect(() => {
    let cancelled = false;
    // Debounce sulla ricerca; al primo mount parte subito comunque (300ms
    // impercettibili con lo spinner attivo).
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { packs: result } = await communityHubService.searchPacks({
          query: query.trim() || undefined,
          sortBy,
          sortOrder: 'desc',
          limit: 60,
        });
        if (!cancelled) setPacks(result);
      } catch (e) {
        clientLogger.warn('[PacksTab] caricamento pack fallito:', e);
        if (!cancelled) setPacks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, sortBy]);

  const openPack = (packId: string) => {
    router.push(`/patch-hub?id=${encodeURIComponent(packId)}`);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: ricerca + sort + pubblica */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('patchHubPage.searchPlaceholder')}
            className="pl-9 bg-slate-900/60 border-slate-700/60"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortBy)}
          className="h-9 rounded-md border border-slate-700/60 bg-slate-900/60 px-2 text-sm text-slate-300"
          aria-label={t('patchHubPage.sortDownloads')}
        >
          <option value="downloads">{t('patchHubPage.sortDownloads')}</option>
          <option value="rating">{t('patchHubPage.sortRating')}</option>
          <option value="updated">{t('patchHubPage.sortUpdated')}</option>
          <option value="completion">{t('patchHubPage.sortCompletion')}</option>
        </select>
        <Button
          size="sm"
          className="bg-amber-600 hover:bg-amber-500 text-white"
          onClick={() => router.push('/patch-hub')}
        >
          <Upload className="h-4 w-4 mr-1.5" />
          {t('patchHubPage.publish')}
        </Button>
      </div>

      {/* Contenuto */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : packs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/60 flex items-center justify-center">
            <Package className="h-7 w-7 text-slate-600" />
          </div>
          <p className="text-sm font-medium text-slate-300">{t('patchHubPage.emptyTitle')}</p>
          <p className="text-xs text-slate-500 max-w-sm">{t('patchHubPage.emptyHint')}</p>
          <Button size="sm" variant="outline" onClick={() => router.push('/patch-hub')}>
            <Package className="h-4 w-4 mr-1.5" />
            {t('communityHub.openPatchHub')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {packs.map(pack => (
            <PackCard key={pack.id} pack={pack} onOpen={openPack} />
          ))}
        </div>
      )}
    </div>
  );
}
