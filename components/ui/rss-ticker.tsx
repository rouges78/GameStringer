'use client';

import { useState, useEffect } from 'react';
import { Rss, ExternalLink } from 'lucide-react';

interface RssItem {
  title: string;
  link: string;
  source: string;
}

interface RssTickerProps {
  className?: string;
}

export interface RssFeed {
  url: string;
  name: string;
  enabled: boolean;
}

const RSS_FEEDS_KEY = 'gamestringer-rss-feeds';

export const defaultRssFeeds: RssFeed[] = [
  { url: 'https://store.steampowered.com/feeds/news/', name: 'Steam News', enabled: true },
  { url: 'https://www.rockpapershotgun.com/feed', name: 'Rock Paper Shotgun', enabled: false },
  { url: 'https://www.pcgamer.com/rss/', name: 'PC Gamer', enabled: false },
  { url: 'https://kotaku.com/rss', name: 'Kotaku', enabled: false },
];

export function getRssFeeds(): RssFeed[] {
  if (typeof window === 'undefined') return defaultRssFeeds;
  const saved = localStorage.getItem(RSS_FEEDS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return defaultRssFeeds;
    }
  }
  return defaultRssFeeds;
}

export function saveRssFeeds(feeds: RssFeed[]) {
  localStorage.setItem(RSS_FEEDS_KEY, JSON.stringify(feeds));
}

export function RssTicker({ className = '' }: RssTickerProps) {
  const [items, setItems] = useState<RssItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fallbackItems: RssItem[] = [
    { title: "Steam: Nuovi saldi invernali in arrivo", link: "#", source: "Steam" },
    { title: "Unity annuncia supporto migliorato per la localizzazione", link: "#", source: "Unity" },
    { title: "Nuovo record: 35M giocatori simultanei su Steam", link: "#", source: "Valve" },
    { title: "Unreal Engine 5.4 rilasciato con nuovi tool per traduzioni", link: "#", source: "Epic" },
    { title: "GOG Galaxy aggiunge supporto per mod multilingua", link: "#", source: "GOG" },
    { title: "Xbox Game Pass: 10 nuovi titoli questo mese", link: "#", source: "Xbox" },
    { title: "Nintendo Direct annunciato per la prossima settimana", link: "#", source: "Nintendo" },
  ];

  useEffect(() => {
    const loadRss = async () => {
      try {
        const feeds = getRssFeeds();
        const enabledFeeds = feeds.filter(f => f.enabled);
        
        if (enabledFeeds.length === 0) {
          setItems(fallbackItems);
          setIsLoading(false);
          return;
        }

        // Prova a caricare RSS reali via proxy CORS
        const allItems: RssItem[] = [];
        
        for (const feed of enabledFeeds) {
          try {
            const corsProxy = 'https://api.allorigins.win/raw?url=';
            const response = await fetch(corsProxy + encodeURIComponent(feed.url), {
              signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
              const text = await response.text();
              const parser = new DOMParser();
              const xml = parser.parseFromString(text, 'text/xml');
              const rssItems = xml.querySelectorAll('item');
              
              rssItems.forEach((item, idx) => {
                if (idx < 3) {
                  const title = item.querySelector('title')?.textContent || '';
                  const link = item.querySelector('link')?.textContent || '#';
                  allItems.push({ title, link, source: feed.name });
                }
              });
            }
          } catch {
            // Feed non raggiungibile, continua con gli altri
          }
        }
        
        if (allItems.length > 0) {
          setItems(allItems);
        } else {
          setItems(fallbackItems);
        }
        setIsLoading(false);
      } catch {
        setItems(fallbackItems);
        setIsLoading(false);
      }
    };

    loadRss();
  }, []);

  // Rotazione automatica
  useEffect(() => {
    if (items.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [items.length]);

  if (isLoading || items.length === 0) {
    return null;
  }

  const currentItem = items[currentIndex];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/20">
        <Rss className="h-3 w-3 text-orange-400" />
        <span className="text-[9px] text-orange-400 font-medium uppercase">Live</span>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <a 
          href={currentItem.link}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 hover:text-orange-300 transition-colors"
        >
          <span className="text-[10px] text-orange-400/70 font-medium shrink-0">
            [{currentItem.source}]
          </span>
          <span className="text-xs text-muted-foreground group-hover:text-orange-300 truncate">
            {currentItem.title}
          </span>
          <ExternalLink className="h-3 w-3 text-muted-foreground/50 group-hover:text-orange-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      </div>

      <div className="flex gap-1">
        {items.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              idx === currentIndex ? 'bg-orange-400' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default RssTicker;
