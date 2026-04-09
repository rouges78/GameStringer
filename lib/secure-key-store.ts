'use client';

/**
 * Secure Key Store — centralized API key management.
 *
 * In Tauri: uses Rust-side AES-256-GCM encrypted storage via invoke().
 * Fallback: uses server-side secretsManager via /api/secrets endpoint.
 *
 * NEVER stores API keys in localStorage directly.
 */

let isTauri = false;
let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

// Lazy-init Tauri detection
async function ensureTauri(): Promise<boolean> {
  if (tauriInvoke) return true;
  if (typeof window === 'undefined') return false;

  try {
    if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) {
      const { invoke } = await import('@tauri-apps/api/core');
      tauriInvoke = invoke;
      isTauri = true;
      return true;
    }
  } catch {
    // Not in Tauri environment
  }
  return false;
}

/**
 * Store an API key securely.
 * In Tauri: encrypted on disk via AES-256-GCM.
 * Fallback: stored in server-side secretsManager via /api/secrets.
 */
export async function setSecureKey(name: string, value: string): Promise<void> {
  if (await ensureTauri()) {
    await tauriInvoke!('set_secure_key', { name, value });
    return;
  }

  // Fallback: save via API route
  await fetch('/api/secrets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-GS-Client': 'gamestringer' },
    body: JSON.stringify({ key: name, value }),
  });
}

/**
 * Retrieve a securely stored API key.
 * Returns null if the key doesn't exist.
 */
export async function getSecureKey(name: string): Promise<string | null> {
  if (await ensureTauri()) {
    const result = await tauriInvoke!('get_secure_key', { name });
    return (result as string | null) ?? null;
  }

  // Fallback: check server-side secrets manager via API
  try {
    const res = await fetch(`/api/secrets?check=${encodeURIComponent(name)}`);
    const data = await res.json();
    const keyStatus = data.keys?.find((k: { key: string; configured: boolean }) => k.key === name);
    // Server-side secretsManager doesn't expose values via GET for security;
    // return a truthy placeholder if configured, null otherwise
    return keyStatus?.configured ? '__configured__' : null;
  } catch {
    return null;
  }
}

/**
 * Check if a secure key exists.
 */
export async function hasSecureKey(name: string): Promise<boolean> {
  if (await ensureTauri()) {
    return (await tauriInvoke!('has_secure_key', { name })) as boolean;
  }

  const key = await getSecureKey(name);
  return key !== null;
}

/**
 * Remove a secure key.
 */
export async function removeSecureKey(name: string): Promise<void> {
  if (await ensureTauri()) {
    await tauriInvoke!('remove_secure_key', { name });
    return;
  }

  await fetch('/api/secrets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-GS-Client': 'gamestringer' },
    body: JSON.stringify({ key: name, value: '' }),
  });
}

/**
 * List all stored key names (not values).
 */
export async function listSecureKeys(): Promise<string[]> {
  if (await ensureTauri()) {
    return (await tauriInvoke!('list_secure_keys')) as string[];
  }

  try {
    const res = await fetch('/api/secrets');
    const data = await res.json();
    return (data.keys || [])
      .filter((k: { configured: boolean }) => k.configured)
      .map((k: { key: string }) => k.key);
  } catch {
    return [];
  }
}

// ── Migration helper ───────────────────────────────────────

/** Legacy localStorage key mappings → secure storage names */
const LEGACY_KEY_MAP: Record<string, string> = {
  'k.openai': 'OPENAI_API_KEY',
  'k.gemini': 'GEMINI_API_KEY',
  'gamestringer_nexus_api_key': 'NEXUS_API_KEY',
  'github_token': 'GITHUB_TOKEN',
};

/**
 * Migrate API keys from localStorage to secure storage.
 * Call once at app startup. Removes localStorage entries after migration.
 */
export async function migrateFromLocalStorage(): Promise<number> {
  if (typeof window === 'undefined') return 0;

  let migrated = 0;

  for (const [localKey, secureName] of Object.entries(LEGACY_KEY_MAP)) {
    const value = localStorage.getItem(localKey);
    if (value && value.trim()) {
      try {
        await setSecureKey(secureName, value.trim());
        localStorage.removeItem(localKey);
        migrated++;
      } catch {
        // Keep localStorage entry if migration fails
      }
    }
  }

  // Migrate gs_secret_* keys
  const gsSecretPrefix = 'gs_secret_';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(gsSecretPrefix)) {
      const value = localStorage.getItem(key);
      const secureName = key.replace(gsSecretPrefix, '');
      if (value && value.trim()) {
        try {
          await setSecureKey(secureName, value.trim());
          localStorage.removeItem(key);
          migrated++;
        } catch {
          // Keep localStorage entry if migration fails
        }
      }
    }
  }

  // Migrate gamestringer_apikey_* keys
  const apiKeyPrefix = 'gamestringer_apikey_';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(apiKeyPrefix)) {
      const value = localStorage.getItem(key);
      const provider = key.replace(apiKeyPrefix, '').toUpperCase();
      if (value && value.trim()) {
        try {
          await setSecureKey(`${provider}_API_KEY`, value.trim());
          localStorage.removeItem(key);
          migrated++;
        } catch {
          // Keep localStorage entry if migration fails
        }
      }
    }
  }

  return migrated;
}
