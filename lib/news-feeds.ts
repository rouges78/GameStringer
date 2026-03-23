/**
 * 📰 News Feed Service
 * 
 * Gestisce feed RSS da testate gaming/tech con categorie.
 * L'utente può abilitare/disabilitare singoli feed dalla pagina Gestisci.
 */

export interface NewsFeedSource {
  id: string;
  name: string;
  url: string;
  rssUrl: string;
  category: NewsFeedCategory;
  icon: string;
  enabled: boolean;
  language: 'it' | 'en' | 'multi';
  description: string;
}

export type NewsFeedCategory = 
  | 'gaming_news'
  | 'pc_gaming'
  | 'indie'
  | 'console'
  | 'tech'
  | 'retro'
  | 'esports'
  | 'game_dev'
  | 'translations';

export interface NewsFeedItem {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceIcon: string;
  category: NewsFeedCategory;
  title: string;
  description: string;
  link: string;
  image?: string;
  pubDate: string;
  timestamp: number;
}

export const FEED_CATEGORIES: { id: NewsFeedCategory; label_it: string; label_en: string; icon: string; color: string }[] = [
  { id: 'gaming_news', label_it: 'Notizie Gaming', label_en: 'Gaming News', icon: '🎮', color: '#1a9fff' },
  { id: 'pc_gaming', label_it: 'PC Gaming', label_en: 'PC Gaming', icon: '🖥️', color: '#67c1f5' },
  { id: 'indie', label_it: 'Indie & Dev', label_en: 'Indie & Dev', icon: '🕹️', color: '#a855f7' },
  { id: 'console', label_it: 'Console', label_en: 'Console', icon: '🎯', color: '#22c55e' },
  { id: 'tech', label_it: 'Tecnologia', label_en: 'Technology', icon: '💻', color: '#f59e0b' },
  { id: 'retro', label_it: 'Retrogaming', label_en: 'Retrogaming', icon: '👾', color: '#ec4899' },
  { id: 'esports', label_it: 'Esports', label_en: 'Esports', icon: '🏆', color: '#ef4444' },
  { id: 'game_dev', label_it: 'Sviluppo Giochi', label_en: 'Game Development', icon: '🛠️', color: '#06b6d4' },
  { id: 'translations', label_it: 'Traduzioni Fan', label_en: 'Fan Translations', icon: '🌍', color: '#8b5cf6' },
];

export const DEFAULT_FEED_SOURCES: NewsFeedSource[] = [
  // ── Gaming News (IT) ──────────────────────────────
  { id: 'everyeye', name: 'Everyeye.it', url: 'https://www.everyeye.it', rssUrl: 'https://www.everyeye.it/feed_news.xml', category: 'gaming_news', icon: '🇮🇹', enabled: true, language: 'it', description: 'Notizie, recensioni e anteprime dal mondo dei videogiochi' },
  { id: 'multiplayer', name: 'Multiplayer.it', url: 'https://multiplayer.it', rssUrl: 'https://multiplayer.it/feed/rss.xml', category: 'gaming_news', icon: '🇮🇹', enabled: true, language: 'it', description: 'Il portale italiano di riferimento per il gaming' },
  { id: 'spaziogames', name: 'SpazioGames', url: 'https://www.spaziogames.it', rssUrl: 'https://www.spaziogames.it/feed', category: 'gaming_news', icon: '🇮🇹', enabled: false, language: 'it', description: 'News, recensioni e guide sui videogiochi' },

  // ── Gaming News (EN) ──────────────────────────────
  { id: 'ign', name: 'IGN', url: 'https://www.ign.com', rssUrl: 'https://feeds.feedburner.com/ign/games-all', category: 'gaming_news', icon: '🌐', enabled: true, language: 'en', description: 'Global gaming news, reviews and walkthroughs' },
  { id: 'gamespot', name: 'GameSpot', url: 'https://www.gamespot.com', rssUrl: 'https://www.gamespot.com/feeds/game-news', category: 'gaming_news', icon: '🌐', enabled: false, language: 'en', description: 'Video game news, reviews, and walkthroughs' },
  { id: 'kotaku', name: 'Kotaku', url: 'https://kotaku.com', rssUrl: 'https://kotaku.com/rss', category: 'gaming_news', icon: '🌐', enabled: true, language: 'en', description: 'Gaming and entertainment news and opinion' },
  { id: 'eurogamer', name: 'Eurogamer', url: 'https://www.eurogamer.net', rssUrl: 'https://www.eurogamer.net/feed', category: 'gaming_news', icon: '🌐', enabled: false, language: 'en', description: 'Europe\'s leading source for video game news' },

  // ── PC Gaming ─────────────────────────────────────
  { id: 'pcgamer', name: 'PC Gamer', url: 'https://www.pcgamer.com', rssUrl: 'https://www.pcgamer.com/rss/', category: 'pc_gaming', icon: '🖥️', enabled: true, language: 'en', description: 'The authority on PC gaming news, hardware and reviews' },
  { id: 'rockpapershotgun', name: 'Rock Paper Shotgun', url: 'https://www.rockpapershotgun.com', rssUrl: 'https://www.rockpapershotgun.com/feed', category: 'pc_gaming', icon: '🖥️', enabled: true, language: 'en', description: 'PC gaming news, previews and reviews' },
  { id: 'pcgamesn', name: 'PCGamesN', url: 'https://www.pcgamesn.com', rssUrl: 'https://www.pcgamesn.com/mainrss.xml', category: 'pc_gaming', icon: '🖥️', enabled: false, language: 'en', description: 'PC game news, guides, reviews and features' },

  // ── Indie & Dev ───────────────────────────────────
  { id: 'indiegames', name: 'IndieGames.com', url: 'https://indiegames.com', rssUrl: 'https://indiegames.com/feed', category: 'indie', icon: '🕹️', enabled: true, language: 'en', description: 'Indie game news and developer spotlights' },
  { id: 'gamedeveloper', name: 'Game Developer', url: 'https://www.gamedeveloper.com', rssUrl: 'https://www.gamedeveloper.com/rss.xml', category: 'game_dev', icon: '🛠️', enabled: true, language: 'en', description: 'The art and business of making games (ex Gamasutra)' },
  { id: 'itchio', name: 'itch.io Blog', url: 'https://itch.io', rssUrl: 'https://itch.io/blog.rss', category: 'indie', icon: '🕹️', enabled: false, language: 'en', description: 'News from the largest indie game marketplace' },

  // ── Console ───────────────────────────────────────
  { id: 'nintendolife', name: 'Nintendo Life', url: 'https://www.nintendolife.com', rssUrl: 'https://www.nintendolife.com/feeds/latest', category: 'console', icon: '🎯', enabled: false, language: 'en', description: 'Nintendo news, reviews and features' },
  { id: 'pushsquare', name: 'Push Square', url: 'https://www.pushsquare.com', rssUrl: 'https://www.pushsquare.com/feeds/latest', category: 'console', icon: '🎯', enabled: false, language: 'en', description: 'PlayStation news, reviews and features' },

  // ── Tech ──────────────────────────────────────────
  { id: 'theverge_gaming', name: 'The Verge Gaming', url: 'https://www.theverge.com/games', rssUrl: 'https://www.theverge.com/games/rss/index.xml', category: 'tech', icon: '💻', enabled: false, language: 'en', description: 'Gaming coverage from The Verge' },
  { id: 'arstechnica_gaming', name: 'Ars Technica Gaming', url: 'https://arstechnica.com/gaming/', rssUrl: 'https://feeds.arstechnica.com/arstechnica/gaming', category: 'tech', icon: '💻', enabled: false, language: 'en', description: 'Gaming and tech analysis' },
  { id: 'tomshw_it', name: "Tom's Hardware IT", url: 'https://www.tomshw.it', rssUrl: 'https://www.tomshw.it/feed', category: 'tech', icon: '🇮🇹', enabled: false, language: 'it', description: 'Hardware e tecnologia in italiano' },

  // ── Retrogaming ───────────────────────────────────
  { id: 'retrorgb', name: 'RetroRGB', url: 'https://www.retrorgb.com', rssUrl: 'https://www.retrorgb.com/feed', category: 'retro', icon: '👾', enabled: false, language: 'en', description: 'Retro gaming hardware, software and culture' },
  { id: 'romhacking', name: 'RomHacking.net News', url: 'https://www.romhacking.net', rssUrl: 'https://www.romhacking.net/rss/news/', category: 'retro', icon: '👾', enabled: true, language: 'en', description: 'ROM hacking news and community updates' },

  // ── Esports ───────────────────────────────────────
  { id: 'dotesports', name: 'Dot Esports', url: 'https://dotesports.com', rssUrl: 'https://dotesports.com/feed', category: 'esports', icon: '🏆', enabled: false, language: 'en', description: 'Esports news and competitive gaming coverage' },

  // ── Traduzioni Fan / Localizzazione / Modding ──────
  { id: 'nexusmods', name: 'NexusMods', url: 'https://www.nexusmods.com', rssUrl: 'https://www.nexusmods.com/news/rss/', category: 'translations', icon: '🔷', enabled: true, language: 'en', description: 'La più grande piattaforma di mod per videogiochi — traduzioni, patch e tool' },
  { id: 'gamestranslator', name: 'GamesTranslator.it', url: 'https://www.gamestranslator.it', rssUrl: 'https://www.gamestranslator.it/index.php?/discover/&type=core_File&changeType=new&format=rss', category: 'translations', icon: '🇮🇹', enabled: true, language: 'it', description: 'La più grande community italiana di fan translation per videogiochi' },
  { id: 'romhacking_translations', name: 'RomHacking Translations', url: 'https://www.romhacking.net/translations/', rssUrl: 'https://www.romhacking.net/rss/translations/', category: 'translations', icon: '🌍', enabled: true, language: 'en', description: 'Database globale di traduzioni fan per ROM retro' },
  { id: 'romhackplaza', name: 'RomHack Plaza', url: 'https://romhackplaza.org', rssUrl: 'https://romhackplaza.org/feed/', category: 'translations', icon: '🌍', enabled: true, language: 'en', description: 'Hacks, fan translations and homebrew games' },
];

const FEEDS_STORAGE_KEY = 'gamestringer_news_feeds_config';
const FEEDS_CACHE_KEY = 'gamestringer_news_feeds_cache';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minuti

// CORS proxy per RSS (necessario in ambiente browser/Tauri webview)
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
];

class NewsFeedService {
  private sources: NewsFeedSource[] = [];
  private cache: { items: NewsFeedItem[]; timestamp: number } | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(FEEDS_STORAGE_KEY);
      if (stored) {
        const savedSources: NewsFeedSource[] = JSON.parse(stored);
        // Merge con defaults: mantieni enabled/disabled dell'utente, aggiungi nuovi feed
        const savedMap = new Map(savedSources.map(s => [s.id, s]));
        this.sources = DEFAULT_FEED_SOURCES.map(def => {
          const saved = savedMap.get(def.id);
          return saved ? { ...def, enabled: saved.enabled } : def;
        });
      } else {
        this.sources = [...DEFAULT_FEED_SOURCES];
      }

      const cached = localStorage.getItem(FEEDS_CACHE_KEY);
      if (cached) {
        this.cache = JSON.parse(cached);
      }
    } catch {
      this.sources = [...DEFAULT_FEED_SOURCES];
    }
  }

  private saveConfig(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(this.sources));
    } catch {}
  }

  private saveCache(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(FEEDS_CACHE_KEY, JSON.stringify(this.cache));
    } catch {}
  }

  getSources(): NewsFeedSource[] {
    return [...this.sources];
  }

  getEnabledSources(): NewsFeedSource[] {
    return this.sources.filter(s => s.enabled);
  }

  toggleSource(id: string, enabled: boolean): void {
    const source = this.sources.find(s => s.id === id);
    if (source) {
      source.enabled = enabled;
      this.saveConfig();
    }
  }

  toggleCategory(category: NewsFeedCategory, enabled: boolean): void {
    this.sources.forEach(s => {
      if (s.category === category) s.enabled = enabled;
    });
    this.saveConfig();
  }

  private async fetchWithProxy(url: string): Promise<string> {
    // 1) Metodo primario: fetch via backend Rust (nessun CORS)
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const xml: string = await invoke('fetch_rss_feed', { url });
      if (xml && (xml.includes('<rss') || xml.includes('<feed') || xml.includes('<channel') || xml.includes('<?xml'))) {
        return xml;
      }
    } catch (e) {
      // Tauri non disponibile (es. browser puro) — fallback
    }

    // 2) Fallback: fetch diretto (funziona se il server manda CORS headers)
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const text = await res.text();
        if (text.includes('<rss') || text.includes('<feed') || text.includes('<channel')) {
          return text;
        }
      }
    } catch {}

    // 3) Ultimo fallback: CORS proxies pubblici
    for (const proxy of CORS_PROXIES) {
      try {
        const res = await fetch(proxy + encodeURIComponent(url), { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          return await res.text();
        }
      } catch {}
    }
    throw new Error(`Failed to fetch RSS: ${url}`);
  }

  private parseRSS(xml: string, source: NewsFeedSource): NewsFeedItem[] {
    const items: NewsFeedItem[] = [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      // RSS 2.0
      const rssItems = doc.querySelectorAll('item');
      if (rssItems.length > 0) {
        rssItems.forEach((item, idx) => {
          if (idx >= 10) return; // Max 10 per feed
          const title = item.querySelector('title')?.textContent?.trim() || '';
          const desc = item.querySelector('description')?.textContent?.trim() || '';
          const link = item.querySelector('link')?.textContent?.trim() || '';
          const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';

          // Cerca immagine in enclosure, media:content, media:thumbnail, o nel description
          let image = item.querySelector('enclosure[type^="image"]')?.getAttribute('url') || '';
          if (!image) image = item.querySelector('media\\:content, content')?.getAttribute('url') || '';
          if (!image) image = item.querySelector('media\\:thumbnail, thumbnail')?.getAttribute('url') || '';
          if (!image) {
            const imgMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/);
            if (imgMatch) image = imgMatch[1];
          }

          // Pulisci HTML dal description
          const cleanDesc = desc.replace(/<[^>]+>/g, '').substring(0, 300);

          const timestamp = pubDate ? new Date(pubDate).getTime() : Date.now() - idx * 3600000;

          items.push({
            id: `${source.id}_${idx}_${timestamp}`,
            sourceId: source.id,
            sourceName: source.name,
            sourceIcon: source.icon,
            category: source.category,
            title,
            description: cleanDesc,
            link,
            image: image || undefined,
            pubDate: this.formatDate(timestamp),
            timestamp,
          });
        });
        return items;
      }

      // Atom
      const atomEntries = doc.querySelectorAll('entry');
      atomEntries.forEach((entry, idx) => {
        if (idx >= 10) return;
        const title = entry.querySelector('title')?.textContent?.trim() || '';
        const desc = entry.querySelector('summary, content')?.textContent?.trim() || '';
        const link = entry.querySelector('link')?.getAttribute('href') || '';
        const pubDate = entry.querySelector('published, updated')?.textContent?.trim() || '';

        let image = entry.querySelector('media\\:content, content[type^="image"]')?.getAttribute('url') || '';
        if (!image) {
          const imgMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/);
          if (imgMatch) image = imgMatch[1];
        }

        const cleanDesc = desc.replace(/<[^>]+>/g, '').substring(0, 300);
        const timestamp = pubDate ? new Date(pubDate).getTime() : Date.now() - idx * 3600000;

        items.push({
          id: `${source.id}_${idx}_${timestamp}`,
          sourceId: source.id,
          sourceName: source.name,
          sourceIcon: source.icon,
          category: source.category,
          title,
          description: cleanDesc,
          link,
          image: image || undefined,
          pubDate: this.formatDate(timestamp),
          timestamp,
        });
      });
    } catch (e) {
      console.warn(`Parse error for ${source.name}:`, e);
    }
    return items;
  }

  private formatDate(ts: number): string {
    if (isNaN(ts)) return '';
    const d = new Date(ts);
    const months_it = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${d.getDate()} ${months_it[d.getMonth()]}`;
  }

  async fetchNews(forceRefresh = false): Promise<NewsFeedItem[]> {
    // Usa cache se valida
    if (!forceRefresh && this.cache && (Date.now() - this.cache.timestamp) < CACHE_TTL_MS) {
      return this.cache.items;
    }

    const enabledSources = this.getEnabledSources();
    if (enabledSources.length === 0) return [];

    const allItems: NewsFeedItem[] = [];

    // Fetch in parallelo con timeout per singolo feed
    const results = await Promise.allSettled(
      enabledSources.map(async (source) => {
        try {
          const xml = await this.fetchWithProxy(source.rssUrl);
          return this.parseRSS(xml, source);
        } catch (e) {
          console.warn(`Feed error ${source.name}:`, e);
          return [];
        }
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }

    // Ordina per data (più recenti prima) e deduplicazione titoli
    allItems.sort((a, b) => b.timestamp - a.timestamp);
    const seen = new Set<string>();
    const deduped = allItems.filter(item => {
      const key = item.title.toLowerCase().substring(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Salva cache
    this.cache = { items: deduped.slice(0, 100), timestamp: Date.now() };
    this.saveCache();

    return this.cache.items;
  }

  getCachedNews(): NewsFeedItem[] {
    return this.cache?.items || [];
  }

  clearCache(): void {
    this.cache = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(FEEDS_CACHE_KEY);
    }
  }
}

export const newsFeedService = new NewsFeedService();
export default newsFeedService;
