/**
 * 📰 News Feed Service
 * 
 * Gestisce feed RSS da testate gaming/tech con categorie.
 * L'utente può abilitare/disabilitare singoli feed dalla pagina Gestisci.
 */

import { clientLogger } from '@/lib/client-logger';
import { isTauri } from '@/lib/tauri-api';
import { decode } from 'html-entities';

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

export interface FeedCategoryDef {
  id: NewsFeedCategory;
  labels: Record<string, string>;
  icon: string;
  color: string;
}

/** Get localized category label */
export function getCategoryLabel(cat: FeedCategoryDef, lang: string): string {
  return cat.labels[lang] || cat.labels['en'] || cat.id;
}

export const FEED_CATEGORIES: FeedCategoryDef[] = [
  { id: 'gaming_news', labels: { it: 'Notizie Gaming', en: 'Gaming News', es: 'Noticias Gaming', fr: 'Actualites Gaming', de: 'Gaming-Nachrichten', ja: 'ゲームニュース', zh: '游戏新闻', ko: '게임 뉴스', pt: 'Noticias Gaming', ru: 'Игровые новости', pl: 'Wiadomosci Gaming' }, icon: '🎮', color: '#1a9fff' },
  { id: 'pc_gaming', labels: { it: 'PC Gaming', en: 'PC Gaming', es: 'PC Gaming', fr: 'PC Gaming', de: 'PC Gaming', ja: 'PCゲーム', zh: 'PC游戏', ko: 'PC 게임', pt: 'PC Gaming', ru: 'PC Gaming', pl: 'PC Gaming' }, icon: '🖥️', color: '#67c1f5' },
  { id: 'indie', labels: { it: 'Indie & Dev', en: 'Indie & Dev', es: 'Indie & Dev', fr: 'Indie & Dev', de: 'Indie & Dev', ja: 'インディー＆開発', zh: '独立游戏', ko: '인디 & 개발', pt: 'Indie & Dev', ru: 'Инди и разработка', pl: 'Indie & Dev' }, icon: '🕹️', color: '#a855f7' },
  { id: 'console', labels: { it: 'Console', en: 'Console', es: 'Consola', fr: 'Console', de: 'Konsole', ja: 'コンソール', zh: '主机', ko: '콘솔', pt: 'Console', ru: 'Консоли', pl: 'Konsole' }, icon: '🎯', color: '#22c55e' },
  { id: 'tech', labels: { it: 'Tecnologia', en: 'Technology', es: 'Tecnologia', fr: 'Technologie', de: 'Technologie', ja: 'テクノロジー', zh: '科技', ko: '기술', pt: 'Tecnologia', ru: 'Технологии', pl: 'Technologia' }, icon: '💻', color: '#f59e0b' },
  { id: 'retro', labels: { it: 'Retrogaming', en: 'Retrogaming', es: 'Retrogaming', fr: 'Retrogaming', de: 'Retrogaming', ja: 'レトロゲーム', zh: '复古游戏', ko: '레트로 게임', pt: 'Retrogaming', ru: 'Ретро-игры', pl: 'Retrogaming' }, icon: '👾', color: '#ec4899' },
  { id: 'esports', labels: { it: 'Esports', en: 'Esports', es: 'Esports', fr: 'Esports', de: 'Esports', ja: 'eスポーツ', zh: '电竞', ko: 'e스포츠', pt: 'Esports', ru: 'Киберспорт', pl: 'Esports' }, icon: '🏆', color: '#ef4444' },
  { id: 'game_dev', labels: { it: 'Sviluppo Giochi', en: 'Game Development', es: 'Desarrollo de Juegos', fr: 'Developpement', de: 'Spieleentwicklung', ja: 'ゲーム開発', zh: '游戏开发', ko: '게임 개발', pt: 'Desenvolvimento', ru: 'Разработка игр', pl: 'Tworzenie Gier' }, icon: '🛠️', color: '#06b6d4' },
  { id: 'translations', labels: { it: 'Traduzioni Fan', en: 'Fan Translations', es: 'Traducciones Fan', fr: 'Traductions Fan', de: 'Fan-Ubersetzungen', ja: 'ファン翻訳', zh: '粉丝翻译', ko: '팬 번역', pt: 'Traducoes Fan', ru: 'Фанатские переводы', pl: 'Tlumaczenia Fanow' }, icon: '🌍', color: '#8b5cf6' },
];

export const DEFAULT_FEED_SOURCES: NewsFeedSource[] = [
  // ── Gaming News (IT) ──────────────────────────────
  { id: 'everyeye', name: 'Everyeye.it', url: 'https://www.everyeye.it', rssUrl: 'https://www.everyeye.it/feed_news.xml', category: 'gaming_news', icon: '🇮🇹', enabled: false, language: 'it', description: 'Notizie, recensioni e anteprime dal mondo dei videogiochi (RSS non disponibile)' },
  { id: 'multiplayer', name: 'Multiplayer.it', url: 'https://multiplayer.it', rssUrl: 'https://multiplayer.it/feed/rss.xml', category: 'gaming_news', icon: '🇮🇹', enabled: false, language: 'it', description: 'Il portale italiano di riferimento per il gaming (RSS non disponibile)' },
  { id: 'spaziogames', name: 'SpazioGames', url: 'https://www.spaziogames.it', rssUrl: 'https://www.spaziogames.it/feed', category: 'gaming_news', icon: '🇮🇹', enabled: true, language: 'it', description: 'News, recensioni e guide sui videogiochi' },

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
  { id: 'itchio', name: 'itch.io Blog', url: 'https://itch.io', rssUrl: 'https://itch.io/blog.rss', category: 'indie', icon: '🕹️', enabled: true, language: 'en', description: 'News from the largest indie game marketplace' },

  // ── Console ───────────────────────────────────────
  { id: 'nintendolife', name: 'Nintendo Life', url: 'https://www.nintendolife.com', rssUrl: 'https://www.nintendolife.com/feeds/latest', category: 'console', icon: '🎯', enabled: false, language: 'en', description: 'Nintendo news, reviews and features' },
  { id: 'pushsquare', name: 'Push Square', url: 'https://www.pushsquare.com', rssUrl: 'https://www.pushsquare.com/feeds/latest', category: 'console', icon: '🎯', enabled: false, language: 'en', description: 'PlayStation news, reviews and features' },

  // ── Tech ──────────────────────────────────────────
  { id: 'theverge_gaming', name: 'The Verge Gaming', url: 'https://www.theverge.com/games', rssUrl: 'https://www.theverge.com/games/rss/index.xml', category: 'tech', icon: '💻', enabled: false, language: 'en', description: 'Gaming coverage from The Verge' },
  { id: 'arstechnica_gaming', name: 'Ars Technica Gaming', url: 'https://arstechnica.com/gaming/', rssUrl: 'https://feeds.arstechnica.com/arstechnica/gaming', category: 'tech', icon: '💻', enabled: false, language: 'en', description: 'Gaming and tech analysis' },
  { id: 'tomshw_it', name: "Tom's Hardware IT", url: 'https://www.tomshw.it', rssUrl: 'https://www.tomshw.it/feed', category: 'tech', icon: '🇮🇹', enabled: false, language: 'it', description: 'Hardware e tecnologia in italiano' },

  // ── Retrogaming ───────────────────────────────────
  { id: 'retrorgb', name: 'RetroRGB', url: 'https://www.retrorgb.com', rssUrl: 'https://www.retrorgb.com/feed', category: 'retro', icon: '👾', enabled: false, language: 'en', description: 'Retro gaming hardware, software and culture' },
  { id: 'romhacking', name: 'RomHacking.net News', url: 'https://www.romhacking.net', rssUrl: 'https://www.romhacking.net/rss/news/', category: 'retro', icon: '👾', enabled: false, language: 'en', description: 'ROM hacking news and community updates (RSS non disponibile)' },

  // ── Esports ───────────────────────────────────────
  { id: 'dotesports', name: 'Dot Esports', url: 'https://dotesports.com', rssUrl: 'https://dotesports.com/feed', category: 'esports', icon: '🏆', enabled: false, language: 'en', description: 'Esports news and competitive gaming coverage' },

  // ── Traduzioni Fan / Localizzazione / Modding ──────
  { id: 'nexusmods', name: 'NexusMods', url: 'https://www.nexusmods.com', rssUrl: 'https://www.nexusmods.com/news/rss/', category: 'translations', icon: '🔷', enabled: false, language: 'en', description: 'La più grande piattaforma di mod per videogiochi (RSS bloccato da bot protection)' },
  { id: 'gamestranslator', name: 'GamesTranslator.it', url: 'https://www.gamestranslator.it', rssUrl: 'https://www.gamestranslator.it/index.php?/discover/&type=core_File&changeType=new&format=rss', category: 'translations', icon: '🇮🇹', enabled: false, language: 'it', description: 'La più grande community italiana di fan translation per videogiochi (RSS bloccato da CORS)' },
  { id: 'romhacking_translations', name: 'RomHacking Translations', url: 'https://www.romhacking.net/translations/', rssUrl: 'https://www.romhacking.net/rss/translations/', category: 'translations', icon: '🌍', enabled: false, language: 'en', description: 'Database globale di traduzioni fan per ROM retro (RSS non disponibile)' },
  { id: 'romhackplaza', name: 'RomHack Plaza', url: 'https://romhackplaza.org', rssUrl: 'https://romhackplaza.org/feed/', category: 'translations', icon: '🌍', enabled: true, language: 'en', description: 'Hacks, fan translations and homebrew games' },
  // ── Nuove fonti aggiunte 2026-05-20 (abilitate 2026-07-04 per test in app) ──
  { id: 'ctrltrad', name: 'Ctrl+Trad', url: 'https://ctrltrad.itch.io', rssUrl: 'https://ctrltrad.itch.io/devlog.rss', category: 'translations', icon: '🇮🇹', enabled: true, language: 'it', description: 'Creator italiano di patch ITA per giochi Steam/GOG indie e AA non localizzati (sito attivo verificato 2026-07-04; devlog RSS itch.io standard)' },
  { id: 'oldgamesitalia', name: 'OldGamesItalia', url: 'https://www.oldgamesitalia.net/forum/', rssUrl: 'https://www.oldgamesitalia.net/forum/index.php?app=core&module=global&section=rss&type=forums&id=1', category: 'translations', icon: '🇮🇹', enabled: true, language: 'it', description: 'Storica community italiana di traduzioni amatoriali e retrogaming (sito attivo verificato 2026-07-04; Invision Forum RSS)' },
  // NB 2026-07-04: romhacking.it NON è WordPress — /feed/ non esiste. Il feed reale è quello del forum SMF (board News), verificato funzionante (application/rss+xml).
  { id: 'romhacking_it', name: 'Romhacking.it', url: 'https://romhacking.it', rssUrl: 'https://romhacking.it/forums/index.php?type=rss2;action=.xml;sa=news;boards=1', category: 'translations', icon: '🇮🇹', enabled: true, language: 'it', description: 'Community italiana dedicata a ROM hacking e traduzioni retro (feed SMF del forum, verificato 2026-07-04)' },
  { id: 'pcgw_italian_translations', name: 'PCGW — Italian Fan Translations', url: 'https://www.pcgamingwiki.com/wiki/List_of_Italian_fan_translations', rssUrl: 'https://www.pcgamingwiki.com/w/api.php?action=feedrecentchanges&format=xml&days=30&limit=20&titles=List_of_Italian_fan_translations', category: 'translations', icon: '🇮🇹', enabled: true, language: 'it', description: 'MediaWiki feed delle modifiche alla lista PCGamingWiki delle traduzioni ITA fan-made (sito attivo verificato 2026-07-04)' },
  { id: '2duerighe', name: '2duerighe Videogiochi', url: 'https://www.2duerighe.com/videogiochi/', rssUrl: 'https://www.2duerighe.com/videogiochi/feed/', category: 'translations', icon: '🇮🇹', enabled: true, language: 'it', description: 'Editoriali italiani su localizzazione fan-made vs ufficiale (sito attivo verificato 2026-07-04; WordPress RSS)' },
  // ── Nuova fonte aggiunta 2026-06-19 (abilitata 2026-07-04 per test in app) ──
  { id: 'languagepack_it', name: 'Language Pack Italia', url: 'https://www.languagepack.it/category/traduzioni/trad-giochi/', rssUrl: 'https://www.languagepack.it/category/traduzioni/trad-giochi/feed/', category: 'translations', icon: '🇮🇹', enabled: true, language: 'it', description: 'Repository ITA molto attivo di traduzioni giochi/mod, con app desktop "LPI Hub" (sito WordPress attivo verificato 2026-07-04; fallback feed generale https://www.languagepack.it/feed/)' },
  // ── Nuova fonte aggiunta 2026-07-04 ──
  // Feed principale verificato funzionante (WordPress, lastBuildDate odierno). È un feed gaming
  // generalista IT con buona copertura traduzioni ITA; esiste anche il feed per tag più mirato:
  // https://www.q-gin.info/argomento/traduzione-italiana/feed/ (standard WP, non verificato).
  { id: 'qgin', name: 'Q-Gin', url: 'https://www.q-gin.info', rssUrl: 'https://www.q-gin.info/feed/', category: 'translations', icon: '🇮🇹', enabled: true, language: 'it', description: 'Notizie gaming italiane con copertura dedicata a traduzioni amatoriali ITA e mod (feed verificato 2026-07-04)' },
];

const FEEDS_STORAGE_KEY = 'gamestringer_news_feeds_config';
const FEEDS_CACHE_KEY = 'gamestringer_news_feeds_cache_v2';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minuti

// CORS proxy per RSS (necessario in ambiente browser/Tauri webview)
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
];


/** Post promozionali/offerte (e-commerce) da nascondere di default: non pertinenti a uno strumento di traduzione. */
export const HIDE_PROMOTIONAL_POSTS = true;

/** Riconosce le notizie di offerte/e-commerce: prezzo + parola-chiave sconto/negozio. */
export function isPromotionalNewsItem(title: string, description = ''): boolean {
  const hay = `${title} ${description}`;
  const hasPrice = /\d{1,4}[.,]?\d{0,2}\s?€|€\s?\d|[$£]\s?\d/.test(hay);
  const discount = /-\s?\d{1,3}\s?%|\bsconto\b|\bscontat/i.test(hay);
  const dealWord = /\b(amazon|offert\w*|coupon|black\s?friday|prime\s?day|deal|sale|bundle|cofanetto|al minimo|minimo storico|prezzo più basso|risparmi\w*)\b/i.test(hay);
  return (hasPrice && (dealWord || discount)) || (dealWord && discount);
}

/** Pulisce la descrizione di un item feed. Per i feed MediaWiki (diff grezzo, es. PCGW) dà un riassunto leggibile. */
export function cleanFeedDescription(rawDesc: string, source: NewsFeedSource): string {
  const looksLikeWikiDiff =
    /feedrecentchanges/i.test(source.rssUrl) ||
    /class="diff|diff-(added|deleted|context)line/i.test(rawDesc) ||
    /(^|\W)(Line|Riga)\s+\d+\s*:/.test(rawDesc);
  if (looksLikeWikiDiff) {
    return source.language === 'it'
      ? 'Aggiornamento nella lista PCGamingWiki delle traduzioni fan ITA.'
      : 'Update to the PCGamingWiki fan-translations list.';
  }
  const text = decode(rawDesc.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  return text.substring(0, 300);
}

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
    } catch {
      // Tauri non disponibile (es. browser puro) — fallback
    }

    // 2) Proxy locale Next.js — SOLO fuori da Tauri: nel build desktop la route
    // /api/rss-proxy è uno stub force-static che risponde sempre 501 (vedi
    // app/api/rss-proxy/route.ts), quindi chiamarla è solo rumore nel log.
    if (!isTauri()) {
      try {
        const proxyUrl = `/api/rss-proxy?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          const text = await res.text();
          if (text.includes('<rss') || text.includes('<feed') || text.includes('<channel') || text.includes('<?xml')) {
            return text;
          }
        }
      } catch {
        // API route non disponibile — fallback
      }
    }

    // 3) Fallback: fetch diretto (funziona solo se il server manda CORS headers).
    // SOLO fuori da Tauri: nel webview una fetch cross-origin è SEMPRE bloccata dal
    // CORS (non può mai riuscire) e produrrebbe solo errori rossi in console — come
    // per gli step 2 e 4. In Tauri l'unico metodo valido è il proxy Rust (step 1).
    if (!isTauri()) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const text = await res.text();
          if (text.includes('<rss') || text.includes('<feed') || text.includes('<channel')) {
            return text;
          }
        }
      } catch {}
    }

    // 4) Ultimo fallback: CORS proxies pubblici — SOLO in web/dev. Nel webview Tauri
    // questi proxy falliscono sempre per CORS, quindi li saltiamo (evita errori in console).
    if (!isTauri()) {
      for (const proxy of CORS_PROXIES) {
        try {
          const res = await fetch(proxy + encodeURIComponent(url), { signal: AbortSignal.timeout(10000) });
          if (res.ok) {
            return await res.text();
          }
        } catch {}
      }
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

          // Cerca immagine in vari tag RSS comuni
          let image = item.querySelector('enclosure[type^="image"]')?.getAttribute('url') || '';
          if (!image) image = item.querySelector('media\\:content, content')?.getAttribute('url') || '';
          if (!image) image = item.querySelector('media\\:thumbnail, thumbnail')?.getAttribute('url') || '';
          if (!image) image = item.querySelector('image url')?.textContent?.trim() || '';
          if (!image) image = item.querySelector('featuredImage, featured-image')?.textContent?.trim() || '';
          // Namespace media: con fallback
          if (!image) {
            const mediaContent = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content')[0];
            if (mediaContent) image = mediaContent.getAttribute('url') || '';
          }
          if (!image) {
            const mediaThumbnail = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'thumbnail')[0];
            if (mediaThumbnail) image = mediaThumbnail.getAttribute('url') || '';
          }
          // Cerca img nel description HTML
          if (!image) {
            const imgMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/);
            if (imgMatch) image = imgMatch[1];
          }
          // Cerca URL immagine diretto nel content (estesi anche webp, avif, svg)
          if (!image) {
            const urlMatch = desc.match(/(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp|avif|svg))/i);
            if (urlMatch) image = urlMatch[1];
          }

          // Fallback FINALE: favicon ad alta risoluzione del sito sorgente
          // Garantisce che ci sia SEMPRE un'immagine visibile
          if (!image) {
            image = this.getFallbackImage(source, link);
          }

          // Pulisci HTML dal description
          const cleanDesc = cleanFeedDescription(desc, source);

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
        if (!image) image = entry.querySelector('media\\:thumbnail, thumbnail')?.getAttribute('url') || '';
        if (!image) image = entry.querySelector('featuredImage, featured-image')?.textContent?.trim() || '';
        // Namespace media: con fallback
        if (!image) {
          const mediaContent = entry.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content')[0];
          if (mediaContent) image = mediaContent.getAttribute('url') || '';
        }
        if (!image) {
          const mediaThumbnail = entry.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'thumbnail')[0];
          if (mediaThumbnail) image = mediaThumbnail.getAttribute('url') || '';
        }
        // Cerca img nel description HTML
        if (!image) {
          const imgMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/);
          if (imgMatch) image = imgMatch[1];
        }
        // Cerca URL immagine diretto nel content (estesi anche webp, avif, svg)
        if (!image) {
          const urlMatch = desc.match(/(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp|avif|svg))/i);
          if (urlMatch) image = urlMatch[1];
        }

        // Fallback FINALE: favicon ad alta risoluzione del sito sorgente
        // Garantisce che ci sia SEMPRE un'immagine visibile
        if (!image) {
          image = this.getFallbackImage(source, link);
        }

        const cleanDesc = cleanFeedDescription(desc, source);
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
    } catch (e: unknown) {
      clientLogger.warn(`Parse error for ${source.name}:`, e);
    }
    return items;
  }

  /**
   * Restituisce un'immagine di fallback ad alta risoluzione basata sul favicon del sito.
   * Garantisce che ogni news abbia SEMPRE un'immagine visibile.
   * Usa il servizio Google s2 favicons che funziona senza CORS e ad alta risoluzione.
   */
  private getFallbackImage(source: NewsFeedSource, link?: string): string {
    try {
      // Preferisci l'hostname dell'articolo (più specifico), fallback all'URL del sorgente
      const targetUrl = link && link.startsWith('http') ? link : source.url;
      const hostname = new URL(targetUrl).hostname;
      // Google s2 favicons supporta dimensioni fino a 256px, sempre disponibile senza CORS
      return `https://www.google.com/s2/favicons?sz=256&domain=${hostname}`;
    } catch {
      // Ultimo fallback: favicon generico
      return `https://www.google.com/s2/favicons?sz=256&domain=${source.url.replace(/^https?:\/\//, '').split('/')[0]}`;
    }
  }

  private formatDate(ts: number): string {
    if (isNaN(ts)) return '';
    const d = new Date(ts);
    const months_it = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${d.getDate()} ${months_it[d.getMonth()]}`;
  }

  /**
   * Fetch og:image from article page when RSS doesn't provide an image
   */
  private async fetchOgImage(url: string): Promise<string | null> {
    try {
      // Try via Tauri backend first (no CORS)
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const html: string = await invoke('fetch_url_content', { url });
        if (html) {
          // Extract og:image
          const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
          if (ogMatch?.[1]) return ogMatch[1];
          
          // Fallback: twitter:image
          const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
          if (twMatch?.[1]) return twMatch[1];
          
          // Fallback: first large image in article
          const imgMatch = html.match(/<img[^>]+src=["']([^"']+(?:jpg|jpeg|png|webp)[^"']*)["'][^>]*(?:width=["']?(\d+)|class=["'][^"']*(?:featured|hero|main|article)[^"']*["'])/i);
          if (imgMatch?.[1]) return imgMatch[1];
        }
      } catch {
        // Tauri not available
      }

      // Try CORS proxy — SOLO in web/dev (nel webview Tauri falliscono per CORS).
      if (!isTauri()) for (const proxy of CORS_PROXIES) {
        try {
          const res = await fetch(proxy + encodeURIComponent(url), {
            signal: AbortSignal.timeout(5000),
            headers: { 'Accept': 'text/html' }
          });
          if (res.ok) {
            const html = await res.text();
            const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
            if (ogMatch?.[1]) return ogMatch[1];
            
            const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
                            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
            if (twMatch?.[1]) return twMatch[1];
          }
        } catch {}
      }
    } catch {}
    return null;
  }

  async fetchNews(forceRefresh = false): Promise<NewsFeedItem[]> {
    // Usa cache se valida
    if (!forceRefresh && this.cache && (Date.now() - this.cache.timestamp) < CACHE_TTL_MS) {
      return this.cache.items;
    }

    const enabledSources = this.getEnabledSources();
    if (enabledSources.length === 0) return [];

    const allItems: NewsFeedItem[] = [];
    const imageCache = this.loadImageCache();

    // Fetch in parallelo con timeout per singolo feed
    const results = await Promise.allSettled(
      enabledSources.map(async (source) => {
        try {
          const xml = await this.fetchWithProxy(source.rssUrl);
          return this.parseRSS(xml, source);
        } catch (e: unknown) {
          clientLogger.warn(`Feed error ${source.name}:`, e);
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
      if (HIDE_PROMOTIONAL_POSTS && isPromotionalNewsItem(item.title, item.description)) return false;
      const key = item.title.toLowerCase().substring(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Fetch missing images SYNCHRONOUSLY (first 50 items — coerente con UI che ne mostra 50)
    // Trattiamo come "mancanti" anche le immagini di fallback (favicon Google)
    // perché abbiamo ancora la chance di trovare una og:image più ricca scaricando l'articolo.
    const itemsToProcess = deduped.slice(0, 50);
    await Promise.all(
      itemsToProcess.map(async (item) => {
        const isFallback = item.image?.includes('google.com/s2/favicons');
        if (item.image && !isFallback) return; // ha già un'immagine "vera"

        // Check cache first
        if (imageCache[item.link]) {
          item.image = imageCache[item.link];
          return;
        }

        // Fetch og:image from article page
        try {
          const ogImage = await this.fetchOgImage(item.link);
          if (ogImage) {
            item.image = ogImage;
            imageCache[item.link] = ogImage;
          }
          // Se og:image non trovato, manteniamo il fallback favicon già impostato dal parser
        } catch {}
      })
    );

    this.saveImageCache(imageCache);

    // GARANZIA FINALE: ogni item DEVE avere un'immagine.
    // Se per qualche ragione resta senza, applica il fallback favicon.
    const sourceMap = new Map(this.sources.map(s => [s.id, s]));
    for (const item of deduped) {
      if (!item.image) {
        const src = sourceMap.get(item.sourceId) || DEFAULT_FEED_SOURCES.find(s => s.id === item.sourceId);
        if (src) {
          item.image = this.getFallbackImage(src, item.link);
        }
      }
    }

    // Salva cache
    this.cache = { items: deduped.slice(0, 100), timestamp: Date.now() };
    this.saveCache();

    return this.cache.items;
  }

  private loadImageCache(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    try {
      const cached = localStorage.getItem('gs_news_image_cache_v2');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  }

  private saveImageCache(cache: Record<string, string>): void {
    if (typeof window === 'undefined') return;
    try {
      // Keep only last 200 entries
      const entries = Object.entries(cache);
      if (entries.length > 200) {
        cache = Object.fromEntries(entries.slice(-200));
      }
      localStorage.setItem('gs_news_image_cache_v2', JSON.stringify(cache));
    } catch {}
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
