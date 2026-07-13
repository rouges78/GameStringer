'use client';

/**
 * Integrità dei pack del Patch Hub e dei file .gspack.
 *
 * - SHA-256 (WebCrypto) per ogni file al momento del publish, salvato in
 *   pack_files.sha256; hash aggregato in translation_packs.content_sha256.
 * - Al download gli hash vengono RIVERIFICATI prima dell'install: un pack
 *   manomesso nello storage o in transito viene rifiutato, non installato.
 * - Sanitizzazione dei path dei file nei pack: un .gspack o un pack remoto
 *   non deve mai poter indicare percorsi assoluti o traversal (`..`) che,
 *   una volta applicati, scriverebbero fuori dalla cartella del gioco.
 */

// ── SHA-256 ────────────────────────────────────────────────

export async function sha256Hex(input: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes: Uint8Array =
    typeof input === 'string' ? new TextEncoder().encode(input)
      : input instanceof Uint8Array ? input
        : new Uint8Array(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash aggregato di un pack: sha256 della lista ordinata "nome:sha256" dei
 * file. Deterministico rispetto all'ordine di upload/download.
 */
export async function aggregatePackSha256(files: Array<{ name: string; sha256: string }>): Promise<string> {
  const canonical = [...files]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(f => `${f.name}:${f.sha256}`)
    .join('\n');
  return sha256Hex(canonical);
}

// ── Path safety ────────────────────────────────────────────

/**
 * Un path di file interno a un pack è sicuro se è RELATIVO, senza traversal,
 * senza lettere di unità o schemi, e senza caratteri di controllo.
 */
export function isSafePackPath(p: string): boolean {
  if (!p || typeof p !== 'string') return false;
  const norm = p.replace(/\\/g, '/');
  if (norm.startsWith('/') || norm.startsWith('~')) return false;        // assoluto POSIX / home
  if (/^[a-zA-Z]:/.test(norm)) return false;                             // drive Windows
  if (norm.startsWith('//')) return false;                               // UNC
  if (/(^|\/)\.\.(\/|$)/.test(norm)) return false;                       // traversal
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(norm)) return false;                            // caratteri di controllo
  return true;
}

/**
 * Riduce un path potenzialmente ostile al solo nome file (basename).
 * Ritorna null se anche il basename non è utilizzabile.
 */
export function sanitizePackFileName(p: string): string | null {
  if (!p || typeof p !== 'string') return null;
  const base = p.replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\x00-\x1f]/g, '').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return null;
  if (/^[a-zA-Z]:$/.test(cleaned)) return null;
  return cleaned.slice(0, 200);
}
