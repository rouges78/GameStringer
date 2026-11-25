/**
 * Ponte auth community: la password dell'account Supabase è un segreto casuale
 * per profilo, non più la vecchia password derivata dall'ID GS (indovinabile).
 * - primo accesso: segreto generato, salvato, usato per il sign-up e poi riusato;
 * - account legacy: accesso una sola volta con la password derivata, rotazione
 *   immediata via updateUser, e da lì in poi la password legacy non si usa più.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const GS_ID = 'profile-42';
const EMAIL = `gs_${GS_ID}@gamestringer.local`;
const LEGACY = `gs_community_${GS_ID}_!Str1ng3r`;

type AuthResult = { data: Record<string, unknown>; error: { message: string; status?: number } | null };

const state = vi.hoisted(() => ({
  client: null as unknown,
  secureStore: new Map<string, string>(),
  secureReadFails: false,
}));

vi.mock('@/lib/social/community-hub-backend', () => ({
  getSupabase: async () => state.client,
  isBackendEnabled: () => true,
}));
vi.mock('@/lib/client-logger', () => ({
  clientLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/secure-key-store', () => ({
  getSecureKey: async (name: string) => {
    if (state.secureReadFails) throw new Error('Decryption failed');
    return state.secureStore.get(name) ?? null;
  },
  setSecureKey: async (name: string, value: string) => { state.secureStore.set(name, value); },
  removeSecureKey: async (name: string) => { state.secureStore.delete(name); },
}));

/**
 * Finto GoTrue: un solo account per email con la sua password; tiene traccia di
 * ogni password provata e delle chiamate updateUser.
 */
function fakeSupabase(opts: { existingPassword?: string } = {}) {
  let password = opts.existingPassword ?? null;
  let session = false;
  const uid = 'uid-supabase';
  const signInPasswords: string[] = [];
  const signUpPasswords: string[] = [];
  const updateUser = vi.fn(async ({ password: next }: { password: string }): Promise<AuthResult> => {
    if (!session) return { data: {}, error: { message: 'not authenticated' } };
    password = next;
    return { data: { user: { id: uid } }, error: null };
  });
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: { id: uid }, error: null }),
  };
  const client = {
    auth: {
      getUser: async () => ({ data: { user: session ? { id: uid } : null } }),
      signInWithPassword: async ({ email, password: p }: { email: string; password: string }): Promise<AuthResult> => {
        signInPasswords.push(p);
        if (email === EMAIL && password !== null && p === password) {
          session = true;
          return { data: { user: { id: uid }, session: {} }, error: null };
        }
        return { data: { user: null, session: null }, error: { message: 'Invalid login credentials', status: 400 } };
      },
      signUp: async ({ password: p }: { password: string }): Promise<AuthResult> => {
        signUpPasswords.push(p);
        if (password !== null) return { data: {}, error: { message: 'User already registered', status: 422 } };
        password = p;
        session = true;
        return { data: { user: { id: uid }, session: {} }, error: null };
      },
      updateUser,
      signOut: async () => { session = false; },
    },
    from: () => builder,
    rpc: async () => ({ data: null, error: null }),
  };
  return {
    client,
    signInPasswords,
    signUpPasswords,
    updateUser,
    serverPassword: () => password,
    endSession: () => { session = false; },
  };
}

async function runSync(): Promise<string | null> {
  const { autoSyncGSToSupabase } = await import('@/lib/social/auth-bridge');
  return autoSyncGSToSupabase();
}

const secretKeyName = `COMMUNITY_AUTH_SECRET_${GS_ID}`;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  state.secureStore.clear();
  state.secureReadFails = false;
  localStorage.setItem('gamestringer_current_profile', JSON.stringify({ id: GS_ID, name: 'Tester' }));
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe('segreto community per profilo', () => {
  it('primo accesso: genera un segreto casuale (≥32 byte, base64url), lo salva e lo riusa', async () => {
    const sb = fakeSupabase();
    state.client = sb.client;

    expect(await runSync()).toBe('uid-supabase');

    const secret = localStorage.getItem(`communityBridge:secret:${GS_ID}`);
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(secret).not.toContain(GS_ID);
    expect(sb.signUpPasswords).toEqual([secret]);
    expect(sb.serverPassword()).toBe(secret);

    // Nuovo avvio, sessione scaduta → stesso segreto, nessun nuovo sign-up.
    sb.endSession();
    vi.resetModules();
    expect(await runSync()).toBe('uid-supabase');
    expect(localStorage.getItem(`communityBridge:secret:${GS_ID}`)).toBe(secret);
    expect(sb.signInPasswords.at(-1)).toBe(secret);
    expect(sb.signUpPasswords).toHaveLength(1);
  });

  it('in Tauri il segreto va nello store cifrato, non in localStorage', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    const sb = fakeSupabase();
    state.client = sb.client;

    expect(await runSync()).toBe('uid-supabase');

    const secret = state.secureStore.get(secretKeyName);
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(localStorage.getItem(`communityBridge:secret:${GS_ID}`)).toBeNull();
    expect(sb.serverPassword()).toBe(secret);
  });

  it('store cifrato illeggibile → nessun nuovo segreto né sign-up (non sovrascrive quello vero)', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    state.secureStore.set(secretKeyName, 'segreto-vero');
    state.secureReadFails = true;
    const sb = fakeSupabase({ existingPassword: 'segreto-vero' });
    state.client = sb.client;

    expect(await runSync()).toBeNull();
    expect(sb.signInPasswords).toHaveLength(0);
    expect(sb.signUpPasswords).toHaveLength(0);
    expect(state.secureStore.get(secretKeyName)).toBe('segreto-vero');
  });

  it('due profili non condividono mai lo stesso segreto', async () => {
    const a = fakeSupabase();
    state.client = a.client;
    await runSync();
    const s1 = localStorage.getItem(`communityBridge:secret:${GS_ID}`);

    localStorage.removeItem(`communityBridge:secret:${GS_ID}`);
    const b = fakeSupabase();
    state.client = b.client;
    vi.resetModules();
    await runSync();
    const s2 = localStorage.getItem(`communityBridge:secret:${GS_ID}`);
    expect(s1).not.toBe(s2);
  });
});

describe('migrazione account legacy', () => {
  it('accede con la password derivata, la ruota con updateUser e poi non la usa più', async () => {
    const sb = fakeSupabase({ existingPassword: LEGACY });
    state.client = sb.client;

    expect(await runSync()).toBe('uid-supabase');

    expect(sb.signInPasswords).toEqual([LEGACY]);
    expect(sb.updateUser).toHaveBeenCalledTimes(1);
    const rotated = sb.updateUser.mock.calls[0][0].password;
    expect(rotated).not.toBe(LEGACY);
    expect(rotated).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(localStorage.getItem(`communityBridge:secret:${GS_ID}`)).toBe(rotated);
    expect(sb.serverPassword()).toBe(rotated);

    // Avvii successivi (sessione scaduta): solo il nuovo segreto, mai più la legacy.
    for (let i = 0; i < 2; i++) {
      sb.endSession();
      vi.resetModules();
      expect(await runSync()).toBe('uid-supabase');
    }
    expect(sb.signInPasswords.slice(1)).toEqual([rotated, rotated]);
    expect(sb.signInPasswords.filter((p) => p === LEGACY)).toHaveLength(1);
    expect(sb.updateUser).toHaveBeenCalledTimes(1);
    expect(sb.signUpPasswords).toHaveLength(0);
  });

  it('se updateUser fallisce il segreto non viene tenuto (si ritenta al prossimo avvio)', async () => {
    const sb = fakeSupabase({ existingPassword: LEGACY });
    sb.updateUser.mockResolvedValueOnce({ data: {}, error: { message: 'boom' } });
    state.client = sb.client;

    expect(await runSync()).toBe('uid-supabase');
    expect(localStorage.getItem(`communityBridge:secret:${GS_ID}`)).toBeNull();
    expect(sb.serverPassword()).toBe(LEGACY);

    sb.endSession();
    vi.resetModules();
    expect(await runSync()).toBe('uid-supabase');
    expect(sb.updateUser).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(`communityBridge:secret:${GS_ID}`)).toBe(sb.serverPassword());
    expect(sb.serverPassword()).not.toBe(LEGACY);
  });

  it('community disabilitata → nessuna richiesta di auth', async () => {
    vi.doMock('@/lib/social/community-hub-backend', () => ({
      getSupabase: async () => state.client,
      isBackendEnabled: () => false,
    }));
    const sb = fakeSupabase({ existingPassword: LEGACY });
    state.client = sb.client;
    expect(await runSync()).toBeNull();
    expect(sb.signInPasswords).toHaveLength(0);
    vi.doUnmock('@/lib/social/community-hub-backend');
  });
});
