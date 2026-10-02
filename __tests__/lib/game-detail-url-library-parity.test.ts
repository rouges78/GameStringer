import { describe, it, expect } from 'vitest';
import { getGameDetailUrl } from '@/lib/game-detail-url';

// La Libreria aveva una copia locale di getGameDetailUrl. Ora importa quella
// condivisa: per il tipo Game della Libreria (id e app_id stringhe) l'URL deve
// restare identico byte per byte, altrimenti cambia la pagina dettaglio aperta.
interface LibraryGame {
  id: string;
  app_id: string;
  title: string;
  platform: string;
  header_image: string | null;
  is_installed?: boolean;
  install_dir?: string;
}

// Copia fedele della vecchia funzione locale di app/library/page.tsx.
const oldLibraryUrl = (game: LibraryGame): string => {
  const params = new URLSearchParams();
  params.set('id', game.id || game.app_id || '');
  params.set('name', game.title || '');
  if (game.install_dir) params.set('installDir', game.install_dir);
  params.set('installed', String(game.is_installed || false));
  params.set('platform', game.platform || 'Steam');
  if (game.header_image) params.set('headerImage', game.header_image);
  const numericAppId = game.app_id || (game.id?.match(/\d+/)?.[0]);
  if (numericAppId) params.set('appId', String(numericAppId));
  return `/library/?${params.toString()}`;
};

const cases: LibraryGame[] = [
  { id: 'steam_1145360', app_id: '1145360', title: 'Hades', platform: 'Steam', header_image: 'https://cdn/h.jpg?x=1&y=2', is_installed: true, install_dir: 'E:\\Steam\\Hades' },
  { id: 'steam_shared_730', app_id: '', title: 'CS & Co', platform: '', header_image: null },
  { id: '', app_id: '570', title: 'Dota 2', platform: 'Steam', header_image: null, is_installed: false },
  { id: '', app_id: '', title: '', platform: 'GOG', header_image: '' },
  { id: 'epic_Fortnite', app_id: '', title: 'Fortnite', platform: 'Epic Games', header_image: null, install_dir: '' },
  { id: 'manual_abc', app_id: '', title: 'Gioco à la carte', platform: 'Manual', header_image: null, is_installed: true },
];

describe('getGameDetailUrl — parità con la vecchia copia della Libreria', () => {
  it.each(cases.map(c => [c.id || c.app_id || '(vuoto)', c] as const))('%s', (_label, game) => {
    expect(getGameDetailUrl(game)).toBe(oldLibraryUrl(game));
  });
});
