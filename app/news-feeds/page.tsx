'use client';

import { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  Rss,
  Check,
  X,
  RefreshCw,
  Globe,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { 
  newsFeedService, 
  type NewsFeedSource, 
  type NewsFeedCategory,
  FEED_CATEGORIES
} from '@/lib/news-feeds';

export default function NewsFeedsPage() {
  const { t } = useTranslation();
  const { language } = useTranslation();
  const [sources, setSources] = useState<NewsFeedSource[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<NewsFeedCategory | 'all'>('all');

  useEffect(() => {
    setSources(newsFeedService.getSources());
  }, []);

  const handleToggle = (id: string, enabled: boolean) => {
    newsFeedService.toggleSource(id, enabled);
    setSources(newsFeedService.getSources());
  };

  const handleToggleCategory = (cat: NewsFeedCategory, enabled: boolean) => {
    newsFeedService.toggleCategory(cat, enabled);
    setSources(newsFeedService.getSources());
    toast.success(enabled 
      ? (language === 'it' ? `Categoria attivata` : `Category enabled`)
      : (language === 'it' ? `Categoria disattivata` : `Category disabled`));
  };

  const handleEnableAll = () => {
    sources.forEach(s => newsFeedService.toggleSource(s.id, true));
    setSources(newsFeedService.getSources());
    toast.success(t('common.allFeedsEnabled'));
  };

  const handleDisableAll = () => {
    sources.forEach(s => newsFeedService.toggleSource(s.id, false));
    setSources(newsFeedService.getSources());
    toast.success(t('common.allFeedsDisabled'));
  };

  const handleRefreshCache = () => {
    newsFeedService.clearCache();
    toast.success(t('common.cacheClearedNewsWillReload'));
  };

  const enabledCount = sources.filter(s => s.enabled).length;
  const filteredSources = selectedCategory === 'all' 
    ? sources 
    : sources.filter(s => s.category === selectedCategory);

  const _getCategoryInfo = (cat: NewsFeedCategory) => FEED_CATEGORIES.find(c => c.id === cat);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-3" style={{ background: 'linear-gradient(180deg, #161618 0%, #161618 40%, #0f0f10 100%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="h-8 w-8 rounded-sm bg-noir-700/30 hover:bg-noir-700/50 flex items-center justify-center transition-colors">
              <ArrowLeft className="h-4 w-4 text-rouge-400" />
            </button>
          </Link>
          <Rss className="h-5 w-5 text-rouge-400" />
          <div>
            <h1 className="text-base font-bold text-noir-200">{t('common.manageNewsFeeds')}</h1>
            <p className="text-2xs text-noir-400">
              {enabledCount} {t('common.activeFeedsOutOf')} {sources.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleRefreshCache} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-noir-700/30 hover:bg-noir-700/50 text-noir-400 hover:text-noir-200 text-2xs transition-colors">
            <RefreshCw className="h-3 w-3" /> {t('common.clearCache')}
          </button>
          <button onClick={handleEnableAll} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-rouge-500/10 hover:bg-rouge-500/20 text-rouge-400 text-2xs transition-colors border border-rouge-500/20">
            <Check className="h-3 w-3" /> {t('common.enableAll')}
          </button>
          <button onClick={handleDisableAll} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 text-2xs transition-colors border border-red-500/20">
            <X className="h-3 w-3" /> {t('common.disableAll')}
          </button>
        </div>
      </div>

      {/* Filtro categorie */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-sm text-2xs font-medium transition-all border ${
            selectedCategory === 'all'
              ? 'bg-rouge-500/20 border-rouge-500/40 text-rouge-400'
              : 'bg-noir-900/60 border-noir-700/30 text-noir-400 hover:border-noir-700/60 hover:text-noir-200'
          }`}
        >
          {t('common.all')} ({sources.length})
        </button>
        {FEED_CATEGORIES.map(cat => {
          const count = sources.filter(s => s.category === cat.id).length;
          const enabledInCat = sources.filter(s => s.category === cat.id && s.enabled).length;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-2xs font-medium transition-all border ${
                selectedCategory === cat.id
                  ? 'bg-rouge-500/20 border-rouge-500/40 text-rouge-400'
                  : 'bg-noir-900/60 border-noir-700/30 text-noir-400 hover:border-noir-700/60 hover:text-noir-200'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.labels?.[language] || cat.labels?.['en'] || cat.id}
              <span className="text-2xs opacity-60">({enabledInCat}/{count})</span>
            </button>
          );
        })}
      </div>

      {/* Categorie con toggle globale + lista feed */}
      {(selectedCategory === 'all' ? FEED_CATEGORIES : FEED_CATEGORIES.filter(c => c.id === selectedCategory)).map(cat => {
        const catSources = filteredSources.filter(s => s.category === cat.id);
        if (catSources.length === 0) return null;
        const allEnabled = catSources.every(s => s.enabled);
        const someEnabled = catSources.some(s => s.enabled);

        return (
          <div key={cat.id} className="rounded-sm border border-noir-700/30 bg-noir-900/40 overflow-hidden">
            {/* Category header */}
            <div className="flex items-center justify-between px-3 py-2 bg-noir-900/60 border-b border-noir-700/20">
              <div className="flex items-center gap-2">
                <span className="text-sm">{cat.icon}</span>
                <span className="text-[11px] font-bold text-noir-200 uppercase tracking-wider">
                  {cat.labels?.[language] || cat.labels?.['en'] || cat.id}
                </span>
                <span className="text-micro text-noir-400">
                  ({catSources.filter(s => s.enabled).length}/{catSources.length})
                </span>
              </div>
              <button
                onClick={() => handleToggleCategory(cat.id, !allEnabled)}
                className={`px-2 py-0.5 rounded-sm text-micro font-medium transition-colors ${
                  allEnabled
                    ? 'bg-rouge-500/20 text-rouge-400 hover:bg-red-500/20 hover:text-red-400'
                    : someEnabled
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-rouge-500/20 hover:text-rouge-400'
                      : 'bg-noir-700/20 text-noir-400 hover:bg-rouge-500/20 hover:text-rouge-400'
                }`}
              >
                {allEnabled 
                  ? (t('common.allOn')) 
                  : someEnabled
                    ? (t('common.someOn'))
                    : (t('common.allOff'))}
              </button>
            </div>

            {/* Feed list */}
            <div className="divide-y divide-noir-700/10">
              {catSources.map(source => (
                <div key={source.id} className="group flex items-center gap-3 px-3 py-2.5 hover:bg-noir-700/10 transition-colors">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(source.id, !source.enabled)}
                    className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                      source.enabled ? 'bg-rouge-500' : 'bg-noir-700/50'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      source.enabled ? 'left-[18px]' : 'left-0.5'
                    }`} />
                  </button>

                  {/* Icon + info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{source.icon}</span>
                      <span className={`text-[12px] font-bold transition-colors ${source.enabled ? 'text-noir-200' : 'text-noir-400/50'}`}>
                        {source.name}
                      </span>
                      <span className={`text-2xs px-1 py-0.5 rounded-sm uppercase tracking-wider font-semibold ${
                        source.language === 'it' ? 'bg-green-500/15 text-green-400' : 'bg-noir-500/15 text-noir-400'
                      }`}>
                        {source.language.toUpperCase()}
                      </span>
                    </div>
                    <p className={`text-2xs mt-0.5 transition-colors ${source.enabled ? 'text-noir-400' : 'text-noir-400/30'}`}>
                      {source.description}
                    </p>
                  </div>

                  {/* Link al sito */}
                  <a 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-sm hover:bg-noir-700/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3 text-noir-400" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Info footer */}
      <div className="rounded-sm bg-noir-900/20 border border-noir-700/15 p-3 flex items-start gap-2">
        <Globe className="h-4 w-4 text-noir-400/40 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-2xs text-noir-400/60 leading-relaxed">
            {t('common.feedsAreAutomaticallyRefreshedEvery15MinutesNewsAreFetchedViaPublicRssNoPersonalDataIsSent')}
          </p>
        </div>
      </div>
    </div>
  );
}

