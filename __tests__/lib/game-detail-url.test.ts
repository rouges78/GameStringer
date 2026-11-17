import { describe, it, expect } from 'vitest';
import { getGameDetailUrl } from '@/lib/game-detail-url';

// L'export statico ha solo /library/index.html: /library/<id> in Tauri apre la
// Dashboard. Il dettaglio deve sempre passare da /library/?id=...
describe('getGameDetailUrl', () => {
  const parse = (url: string) => new URL(url, 'http://tauri.localhost');

  it('usa il query param, mai un segmento di percorso', () => {
    const url = getGameDetailUrl({ id: 'steam_1145360', title: 'Hades' });
    const u = parse(url);
    expect(u.pathname).toBe('/library/');
    expect(u.searchParams.get('id')).toBe('steam_1145360');
    expect(u.searchParams.get('name')).toBe('Hades');
  });

  it('porta cartella, stato installazione e copertina quando ci sono', () => {
    const u = parse(getGameDetailUrl({
      id: 'steam_42',
      app_id: '42',
      title: 'Foo & Bar',
      platform: 'Steam',
      header_image: 'https://cdn/x.jpg?a=1',
      install_dir: 'E:\\Games\\Foo Bar',
      is_installed: true,
    }));
    expect(u.searchParams.get('name')).toBe('Foo & Bar');
    expect(u.searchParams.get('installDir')).toBe('E:\\Games\\Foo Bar');
    expect(u.searchParams.get('installed')).toBe('true');
    expect(u.searchParams.get('headerImage')).toBe('https://cdn/x.jpg?a=1');
    expect(u.searchParams.get('appId')).toBe('42');
  });

  it('ricava appId dalle cifre dell\'id e omette i campi assenti', () => {
    const u = parse(getGameDetailUrl({ id: 'steam_730', title: 'CS' }));
    expect(u.searchParams.get('appId')).toBe('730');
    expect(u.searchParams.get('installed')).toBe('false');
    expect(u.searchParams.get('platform')).toBe('Steam');
    expect(u.searchParams.has('installDir')).toBe(false);
    expect(u.searchParams.has('headerImage')).toBe(false);
  });

  it('senza id usa app_id', () => {
    const u = parse(getGameDetailUrl({ app_id: 570, title: 'Dota 2' }));
    expect(u.searchParams.get('id')).toBe('570');
    expect(u.searchParams.get('appId')).toBe('570');
  });
});
