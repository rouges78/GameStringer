/**
 * URL della pagina dettaglio di un gioco.
 *
 * L'export statico di Tauri genera solo `/library/index.html`: una rotta
 * `/library/<id>` non ha file, e Tauri risponde con la root `index.html`
 * (Dashboard) invece del gioco. Il dettaglio vive quindi su
 * `/library/?id=...`, che `app/library/page.tsx` intercetta e passa a
 * `GameDetailClient`. Gli altri parametri (nome, cartella, appId) evitano che
 * il dettaglio debba ricostruirli da zero.
 */
export interface GameDetailUrlInput {
  id?: string | null;
  app_id?: string | number | null;
  title?: string | null;
  platform?: string | null;
  header_image?: string | null;
  install_dir?: string | null;
  is_installed?: boolean | null;
}

export function getGameDetailUrl(game: GameDetailUrlInput): string {
  const params = new URLSearchParams();
  params.set('id', game.id || String(game.app_id || ''));
  params.set('name', game.title || '');
  if (game.install_dir) params.set('installDir', game.install_dir);
  params.set('installed', String(game.is_installed || false));
  params.set('platform', game.platform || 'Steam');
  if (game.header_image) params.set('headerImage', game.header_image);
  // Passa sempre l'appId numerico se disponibile
  const numericAppId = game.app_id || game.id?.match(/\d+/)?.[0];
  if (numericAppId) params.set('appId', String(numericAppId));

  return `/library/?${params.toString()}`;
}
