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
  FEED_CATEGORIES, 
  DEFAULT_FEED_SOURCES 
} from '@/lib/news-feeds';

export default function NewsFeedsPage() {
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
    toast.success(language === 'it' ? 'Tutti i feed attivati' : 'All feeds enabled');
  };

  const handleDisableAll = () => {
    sources.forEach(s => newsFeedService.toggleSource(s.id, false));
    setSources(newsFeedService.getSources());
    toast.success(language === 'it' ? 'Tutti i feed disattivati' : 'All feeds disabled');
  };

  const handleRefreshCache = () => {
    newsFeedService.clearCache();
    toast.success(language === 'it' ? 'Cache pulita. Le notizie saranno ricaricate.' : 'Cache cleared. News will reload.');
  };

  const enabledCount = sources.filter(s => s.enabled).length;
  const filteredSources = selectedCategory === 'all' 
    ? sources 
    : sources.filter(s => s.category === selectedCategory);

  const getCategoryInfo = (cat: NewsFeedCategory) => FEED_CATEGORIES.find(c => c.id === cat);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-3" style={{ background: 'linear-gradient(180deg, #1b2838 0%, #171d25 40%, #0e1419 100%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="h-8 w-8 rounded-sm bg-[#2a475e]/30 hover:bg-[#2a475e]/50 flex items-center justify-center transition-colors">
              <ArrowLeft className="h-4 w-4 text-[#67c1f5]" />
            </button>
          </Link>
          <Rss className="h-5 w-5 text-[#67c1f5]" />
          <div>
            <h1 className="text-base font-bold text-[#c6d4df]">{language === 'it' ? 'Gestisci Feed Notizie' : 'Manage News Feeds'}</h1>
            <p className="text-2xs text-[#8f98a0]">
              {enabledCount} {language === 'it' ? 'feed attivi su' : 'active feeds out of'} {sources.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleRefreshCache} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-[#2a475e]/30 hover:bg-[#2a475e]/50 text-[#8f98a0] hover:text-[#c6d4df] text-2xs transition-colors">
            <RefreshCw className="h-3 w-3" /> {language === 'it' ? 'Pulisci cache' : 'Clear cache'}
          </button>
          <button onClick={handleEnableAll} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-[#1a9fff]/10 hover:bg-[#1a9fff]/20 text-[#67c1f5] text-2xs transition-colors border border-[#1a9fff]/20">
            <Check className="h-3 w-3" /> {language === 'it' ? 'Attiva tutti' : 'Enable all'}
          </button>
          <button onClick={handleDisableAll} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 text-2xs transition-colors border border-red-500/20">
            <X className="h-3 w-3" /> {language === 'it' ? 'Disattiva tutti' : 'Disable all'}
          </button>
        </div>
      </div>

      {/* Filtro categorie */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-sm text-2xs font-medium transition-all border ${
            selectedCategory === 'all'
              ? 'bg-[#1a9fff]/20 border-[#1a9fff]/40 text-[#67c1f5]'
              : 'bg-[#1b2838]/60 border-[#2a475e]/30 text-[#8f98a0] hover:border-[#2a475e]/60 hover:text-[#c6d4df]'
          }`}
        >
          {language === 'it' ? 'Tutti' : 'All'} ({sources.length})
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
                  ? 'bg-[#1a9fff]/20 border-[#1a9fff]/40 text-[#67c1f5]'
                  : 'bg-[#1b2838]/60 border-[#2a475e]/30 text-[#8f98a0] hover:border-[#2a475e]/60 hover:text-[#c6d4df]'
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
          <div key={cat.id} className="rounded-sm border border-[#2a475e]/30 bg-[#1b2838]/40 overflow-hidden">
            {/* Category header */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#1b2838]/60 border-b border-[#2a475e]/20">
              <div className="flex items-center gap-2">
                <span className="text-sm">{cat.icon}</span>
                <span className="text-[11px] font-bold text-[#c6d4df] uppercase tracking-wider">
                  {cat.labels?.[language] || cat.labels?.['en'] || cat.id}
                </span>
                <span className="text-micro text-[#8f98a0]">
                  ({catSources.filter(s => s.enabled).length}/{catSources.length})
                </span>
              </div>
              <button
                onClick={() => handleToggleCategory(cat.id, !allEnabled)}
                className={`px-2 py-0.5 rounded-sm text-micro font-medium transition-colors ${
                  allEnabled
                    ? 'bg-[#1a9fff]/20 text-[#67c1f5] hover:bg-red-500/20 hover:text-red-400'
                    : someEnabled
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-[#1a9fff]/20 hover:text-[#67c1f5]'
                      : 'bg-[#2a475e]/20 text-[#8f98a0] hover:bg-[#1a9fff]/20 hover:text-[#67c1f5]'
                }`}
              >
                {allEnabled 
                  ? (language === 'it' ? 'Tutti attivi' : 'All on') 
                  : someEnabled
                    ? (language === 'it' ? 'Alcuni attivi' : 'Some on')
                    : (language === 'it' ? 'Tutti spenti' : 'All off')}
              </button>
            </div>

            {/* Feed list */}
            <div className="divide-y divide-[#2a475e]/10">
              {catSources.map(source => (
                <div key={source.id} className="group flex items-center gap-3 px-3 py-2.5 hover:bg-[#2a475e]/10 transition-colors">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(source.id, !source.enabled)}
                    className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                      source.enabled ? 'bg-[#1a9fff]' : 'bg-[#2a475e]/50'
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
                      <span className={`text-[12px] font-bold transition-colors ${source.enabled ? 'text-[#c6d4df]' : 'text-[#8f98a0]/50'}`}>
                        {source.name}
                      </span>
                      <span className={`text-2xs px-1 py-0.5 rounded-sm uppercase tracking-wider font-semibold ${
                        source.language === 'it' ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400'
                      }`}>
                        {source.language.toUpperCase()}
                      </span>
                    </div>
                    <p className={`text-2xs mt-0.5 transition-colors ${source.enabled ? 'text-[#8f98a0]' : 'text-[#8f98a0]/30'}`}>
                      {source.description}
                    </p>
                  </div>

                  {/* Link al sito */}
                  <a 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-sm hover:bg-[#2a475e]/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3 text-[#8f98a0]" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Info footer */}
      <div className="rounded-sm bg-[#1b2838]/20 border border-[#2a475e]/15 p-3 flex items-start gap-2">
        <Globe className="h-4 w-4 text-[#8f98a0]/40 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-2xs text-[#8f98a0]/60 leading-relaxed">
            {language === 'it' 
              ? 'I feed vengono aggiornati automaticamente ogni 15 minuti. Le notizie sono recuperate tramite RSS pubblici. Nessun dato personale viene inviato.'
              : 'Feeds are automatically refreshed every 15 minutes. News are fetched via public RSS. No personal data is sent.'}
          </p>
        </div>
      </div>
    </div>
  );
}
