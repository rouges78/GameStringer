/**
 * Community: le funzioni lato server devono dire la verità alla UI.
 * - toggleLike ritorna lo stato DOPO il toggle (o null se fallisce), così l'UI
 *   non mostra +1 su un like appena rimosso.
 * - markAsSolution è un successo solo se la riga è stata davvero aggiornata
 *   (un UPDATE filtrato dalla RLS non dà errore, tocca 0 righe).
 * - Un backend irraggiungibile LANCIA invece di sembrare un risultato vuoto
 *   (thread "non trovato", "0 risposte", "nessuna notifica", "utente non trovato").
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type QueryError = { code?: string; message?: string } | null;
type QueryResult = { data?: unknown; error?: QueryError };
type Call = { table: string; ops: string[]; args: unknown[][] };

const state = vi.hoisted(() => ({
  client: null as unknown,
  uid: 'uid-supabase' as string | null,
}));

vi.mock('@/lib/social/community-hub-backend', () => ({
  getSupabase: async () => state.client,
  isSupabaseConfigured: () => true,
}));
vi.mock('@/lib/social/auth-bridge', () => ({
  autoSyncGSToSupabase: async () => state.uid,
}));
vi.mock('@/lib/social/presence', () => ({
  setPresenceStatus: async () => {},
  getOnlineUsers: () => [],
}));

// Finto client Supabase: ogni catena from(...).x().y() registra le chiamate e,
// quando viene attesa, chiede il risultato a `handler`.
function fakeClient(handler: (call: Call) => QueryResult) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, ops: [], args: [] };
      calls.push(call);
      const builder: Record<string | symbol, unknown> = new Proxy({}, {
        get(_target, prop) {
          if (prop === 'then') {
            const res = handler(call);
            return (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
              Promise.resolve({ data: null, error: null, ...res }).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            call.ops.push(String(prop));
            call.args.push(args);
            return builder;
          };
        },
      });
      return builder;
    },
    rpc: async () => ({ data: null, error: null }),
  };
  return { client, calls };
}

const has = (call: Call, op: string) => call.ops.includes(op);

beforeEach(() => {
  vi.resetModules();
  state.uid = 'uid-supabase';
});

describe('toggleLike', () => {
  it('like già presente → lo toglie e ritorna false', async () => {
    const { client, calls } = fakeClient((c) =>
      has(c, 'select') ? { data: { id: 'r1' } } : {}
    );
    state.client = client;
    const { toggleLike } = await import('@/lib/social/forum');
    expect(await toggleLike('local-id', 't1')).toBe(false);
    expect(calls.some((c) => has(c, 'delete'))).toBe(true);
    // Cerca la reazione con l'uid Supabase, non con l'id del profilo locale
    const lookup = calls.find((c) => has(c, 'select'))!;
    expect(lookup.args).toContainEqual(['user_id', 'uid-supabase']);
  });

  it('nessun like → lo mette e ritorna true', async () => {
    const { client } = fakeClient((c) =>
      has(c, 'select') ? { data: null, error: { code: 'PGRST116', message: 'no rows' } } : {}
    );
    state.client = client;
    const { toggleLike } = await import('@/lib/social/forum');
    expect(await toggleLike('local-id', 't1')).toBe(true);
  });

  it('scrittura respinta → null', async () => {
    const { client } = fakeClient((c) =>
      has(c, 'insert') ? { error: { message: 'permission denied' } } : { data: null }
    );
    state.client = client;
    const { toggleLike } = await import('@/lib/social/forum');
    expect(await toggleLike('local-id', 't1')).toBeNull();
  });

  it('ponte auth giù → null, nessuna scrittura', async () => {
    state.uid = null;
    const { client, calls } = fakeClient(() => ({}));
    state.client = client;
    const { toggleLike } = await import('@/lib/social/forum');
    expect(await toggleLike('local-id', 't1')).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe('markAsSolution', () => {
  it('0 righe aggiornate (RLS) → false, e il thread non viene segnato risolto', async () => {
    const { client, calls } = fakeClient(() => ({ data: [] }));
    state.client = client;
    const { markAsSolution } = await import('@/lib/social/forum');
    expect(await markAsSolution('p1', 't1')).toBe(false);
    expect(calls.some((c) => c.table === 'forum_threads')).toBe(false);
  });

  it('riga aggiornata → true', async () => {
    const { client, calls } = fakeClient((c) =>
      c.table === 'forum_posts' && has(c, 'select') ? { data: [{ id: 'p1' }] } : {}
    );
    state.client = client;
    const { markAsSolution } = await import('@/lib/social/forum');
    expect(await markAsSolution('p1', 't1')).toBe(true);
    expect(calls.some((c) => c.table === 'forum_threads')).toBe(true);
  });
});

describe('getThread / getPosts', () => {
  it('thread inesistente (PGRST116) → null', async () => {
    const { client } = fakeClient(() => ({ error: { code: 'PGRST116', message: 'no rows' } }));
    state.client = client;
    const { getThread } = await import('@/lib/social/forum');
    expect(await getThread('t1')).toBeNull();
  });

  it('backend irraggiungibile → lancia invece di "non trovato"', async () => {
    const { client } = fakeClient(() => ({ error: { message: 'Failed to fetch' } }));
    state.client = client;
    const { getThread, getPosts } = await import('@/lib/social/forum');
    await expect(getThread('t1')).rejects.toThrow();
    await expect(getPosts('t1')).rejects.toThrow();
  });

  it('tabella forum assente → nessuna risposta, senza errore', async () => {
    const { client } = fakeClient(() => ({ error: { code: '42P01', message: 'relation does not exist' } }));
    state.client = client;
    const { getPosts } = await import('@/lib/social/forum');
    expect(await getPosts('t1')).toEqual([]);
  });
});

describe('getNotifications / getProfileByUsername', () => {
  it('backend irraggiungibile → lanciano invece di sembrare vuoti', async () => {
    const { client } = fakeClient(() => ({ error: { message: 'Failed to fetch' } }));
    state.client = client;
    const { getNotifications, getProfileByUsername } = await import('@/lib/social/social');
    await expect(getNotifications('uid-supabase')).rejects.toThrow();
    await expect(getProfileByUsername('mario')).rejects.toThrow();
  });

  it('profilo inesistente → null; notifiche assenti → []', async () => {
    const { client, calls } = fakeClient(() => ({ data: null }));
    state.client = client;
    const { getNotifications, getProfileByUsername } = await import('@/lib/social/social');
    expect(await getProfileByUsername('nessuno')).toBeNull();
    expect(await getNotifications('uid-supabase')).toEqual([]);
    const notif = calls.find((c) => c.table === 'notifications')!;
    expect(notif.args).toContainEqual(['user_id', 'uid-supabase']);
  });

  it('getFriends cerca i profili per id (uid Supabase) e non avvelena user_profiles', async () => {
    const { client, calls } = fakeClient((c) => {
      if (c.table === 'friendships') return { data: [{ requester_id: 'me', addressee_id: 'friend' }] };
      if (c.table === 'user_profiles' && c.args.some((a) => a[0] === 'id' && a[1] === 'friend')) {
        return { data: [{ id: 'friend', username: 'amico' }] };
      }
      if (c.table === 'user_profiles' && c.args.some((a) => a[0] === 'username')) {
        return { data: { id: 'friend', username: 'amico' } };
      }
      return { error: { code: '42703', message: 'column user_profiles.user_id does not exist' } };
    });
    state.client = client;
    const { getFriends, getProfileByUsername } = await import('@/lib/social/social');
    const friends = await getFriends('me');
    expect(friends.map((f) => f.user_id)).toEqual(['friend']);
    // Dopo getFriends il profilo si legge ancora: la tabella non è stata segnata "mancante".
    expect((await getProfileByUsername('amico'))?.user_id).toBe('friend');
    expect(calls.some((c) => c.table === 'user_profiles' && c.args.some((a) => a[0] === 'user_id'))).toBe(false);
  });

  it('tabella notifications assente → [] senza errore', async () => {
    const { client } = fakeClient(() => ({ error: { code: '42P01', message: 'relation does not exist' } }));
    state.client = client;
    const { getNotifications } = await import('@/lib/social/social');
    expect(await getNotifications('uid-supabase')).toEqual([]);
  });
});
