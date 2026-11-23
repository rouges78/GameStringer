// Host da cui una copertina passata in query string può essere caricata: gli
// stessi di images.remotePatterns in next.config.js.
const IMAGE_HOSTS = new Set([
  'steamcdn-a.akamaihd.net',
  'cdn.akamai.steamstatic.com',
  'shared.akamai.steamstatic.com',
  'cdn.steamgriddb.com',
  'cdn2.steamgriddb.com',
  'media.steampowered.com',
  'cdn.cloudflare.steamstatic.com',
  'store.steampowered.com',
]);

const LOCAL_ORIGIN = 'http://app.invalid';

/**
 * Restituisce `src` solo se è un percorso dell'app stessa o un'immagine https
 * di un host noto, altrimenti null: così un link costruito apposta non fa
 * scaricare all'app un URL qualsiasi (che saprebbe IP e ora di apertura).
 */
export function trustedImageSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  let url: URL;
  try {
    url = new URL(src, LOCAL_ORIGIN);
  } catch {
    return null;
  }
  // Risolto contro un'origine fittizia: resta lì solo un percorso locale vero,
  // non "//host" né "/\host", che il browser tratta come un altro host.
  if (url.origin === LOCAL_ORIGIN) return src;
  return url.protocol === 'https:' && IMAGE_HOSTS.has(url.hostname) ? src : null;
}
