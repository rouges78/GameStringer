/**
 * Accendere o spegnere una fonte di notizie deve vedersi sulla dashboard.
 *
 * La dashboard (app/page.tsx) legge newsFeedService.getCachedNews() e poi
 * fetchNews(), che restituisce la cache se ha meno di 15 minuti. Prima del
 * 01/10/2026 cambiare le fonti non toccava la cache: le notizie delle fonti
 * appena spente restavano lì, e il cambio sembrava non aver fatto nulla. La
 * scheda RSS delle Impostazioni ora modifica questa stessa lista.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { newsFeedService, DEFAULT_FEED_SOURCES, type NewsFeedItem } from '@/lib/news-feeds';

const CACHE_KEY = 'gamestringer_news_feeds_cache_v2';

function seedCache() {
  const item: NewsFeedItem = {
    id: 'x', sourceId: DEFAULT_FEED_SOURCES[0].id, sourceName: 'X', sourceIcon: '', category: 'gaming_news',
    title: 'Titolo', description: '', link: 'https://example.com', pubDate: '', timestamp: Date.now(),
  };
  // la cache vive nel servizio: la si riempie come farebbe fetchNews
  (newsFeedService as unknown as { cache: unknown }).cache = { items: [item], timestamp: Date.now() };
  localStorage.setItem(CACHE_KEY, JSON.stringify({ items: [item], timestamp: Date.now() }));
}

beforeEach(() => localStorage.clear());

describe('newsFeedService: cambiare le fonti svuota la cache', () => {
  it('toggleSource', () => {
    seedCache();
    const id = DEFAULT_FEED_SOURCES[0].id;
    newsFeedService.toggleSource(id, false);
    expect(newsFeedService.getCachedNews()).toEqual([]);
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    expect(newsFeedService.getSources().find((s) => s.id === id)?.enabled).toBe(false);
  });

  it('toggleCategory', () => {
    seedCache();
    newsFeedService.toggleCategory('translations', false);
    expect(newsFeedService.getCachedNews()).toEqual([]);
    expect(newsFeedService.getSources().filter((s) => s.category === 'translations').every((s) => !s.enabled)).toBe(true);
  });

  it('id sconosciuto: niente cambia, cache compresa', () => {
    seedCache();
    newsFeedService.toggleSource('non-esiste', true);
    expect(newsFeedService.getCachedNews()).toHaveLength(1);
  });
});
