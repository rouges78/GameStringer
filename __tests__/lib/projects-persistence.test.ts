/**
 * Test del ponte di persistenza dei PROGETTI (lib/projects-persistence.ts) —
 * l'ultimo terzo di [storage-per-origine], scritto il 07/08/2026.
 *
 * Il registro progetti vive in IndexedDB, che è per-origine: in dev un cambio
 * porta lo fa "sparire". Questo ponte replica il pattern di
 * settings-persistence (disco = fonte di verità, hydration al boot, flush
 * guardato), e questi test inchiodano le stesse difese più quelle nuove:
 *
 * - la corsa del flush anticipato (mai copiare su disco una IndexedDB non
 *   ancora idratata — la stessa che il 04/08 poteva svuotare settings.json);
 * - il merge per id con updatedAt più recente che vince (un'origine nuova
 *   RITROVA i progetti, una vecchia non li regredisce);
 * - il guard "mai svuotare il disco" e la sua UNICA eccezione (allowEmpty per
 *   la cancellazione dell'ultimo progetto, sennò risorge alla hydration dopo).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mock: IndexedDB in memoria ──────────────────────────────────────────────
const idb = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (k: string) => idb.get(k)),
  set: vi.fn(async (k: string, v: unknown) => { idb.set(k, v); }),
}));

// ── mock: filesystem Tauri in memoria ───────────────────────────────────────
const disk = new Map<string, string>();
const writeTextFile = vi.fn(async (p: string, c: string) => { disk.set(p, c); });
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (p: string) => disk.has(p)),
  readTextFile: vi.fn(async (p: string) => {
    const c = disk.get(p);
    if (c === undefined) throw new Error('not found');
    return c;
  }),
  writeTextFile,
  mkdir: vi.fn(async () => {}),
}));

vi.mock('@tauri-apps/api/path', () => ({
  dataDir: vi.fn(async () => '/data'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}));

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const FILE = '/data/GameStringer/projects.json';
const PROJECTS_KEY = 'gs_translation_projects';
const ACTIVE_KEY = 'gs_active_project';

/** Stato di hydration a livello di modulo: va reimportato pulito per ogni caso. */
async function freshModule() {
  vi.resetModules();
  return import('@/lib/projects-persistence');
}

const proj = (id: string, updatedAt: string, extra: Record<string, unknown> = {}) =>
  ({ id, updatedAt, gameName: `game-${id}`, ...extra });

beforeEach(() => {
  idb.clear();
  disk.clear();
  writeTextFile.mockClear();
});

describe('persistProjectsToDisk — la corsa del flush anticipato', () => {
  it('NON scrive su disco se l hydration non è ancora conclusa', async () => {
    const mod = await freshModule();
    idb.set(PROJECTS_KEY, [proj('a', '2026-08-07T10:00:00Z')]);
    await mod.persistProjectsToDisk();
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('scrive su disco dopo l hydration', async () => {
    const mod = await freshModule();
    await mod.hydrateProjectsFromDisk();
    idb.set(PROJECTS_KEY, [proj('a', '2026-08-07T10:00:00Z')]);
    await mod.persistProjectsToDisk();
    const blob = JSON.parse(disk.get(FILE)!);
    expect(blob.projects.map((p: { id: string }) => p.id)).toEqual(['a']);
  });
});

describe('hydrateProjectsFromDisk — merge per id, updatedAt più recente vince', () => {
  it('origine nuova (IndexedDB vuota): i progetti tornano dal disco', async () => {
    disk.set(FILE, JSON.stringify({ savedAt: 'x', activeProjectId: 'a', projects: [proj('a', '2026-08-01T00:00:00Z')] }));
    const mod = await freshModule();
    await mod.hydrateProjectsFromDisk();
    expect((idb.get(PROJECTS_KEY) as { id: string }[]).map(p => p.id)).toEqual(['a']);
    expect(idb.get(ACTIVE_KEY)).toBe('a');
  });

  it('il progetto più avanzato vince, gli sconosciuti si sommano', async () => {
    disk.set(FILE, JSON.stringify({
      savedAt: 'x',
      projects: [proj('a', '2026-08-01T00:00:00Z', { progress: 10 }), proj('b', '2026-08-05T00:00:00Z')],
    }));
    idb.set(PROJECTS_KEY, [proj('a', '2026-08-06T00:00:00Z', { progress: 90 }), proj('c', '2026-08-02T00:00:00Z')]);
    const mod = await freshModule();
    await mod.hydrateProjectsFromDisk();
    const merged = idb.get(PROJECTS_KEY) as { id: string; progress?: number }[];
    expect(merged.map(p => p.id).sort()).toEqual(['a', 'b', 'c']);
    expect(merged.find(p => p.id === 'a')!.progress).toBe(90); // locale più recente
  });

  it('migrazione una-tantum: IndexedDB piena + disco assente → disco scritto', async () => {
    idb.set(PROJECTS_KEY, [proj('a', '2026-08-07T00:00:00Z')]);
    idb.set(ACTIVE_KEY, 'a');
    const mod = await freshModule();
    await mod.hydrateProjectsFromDisk();
    const blob = JSON.parse(disk.get(FILE)!);
    expect(blob.projects).toHaveLength(1);
    expect(blob.activeProjectId).toBe('a');
  });
});

describe('il guard "mai svuotare il disco" e la sua eccezione', () => {
  it('registro vuoto senza allowEmpty: il disco NON viene toccato', async () => {
    disk.set(FILE, JSON.stringify({ savedAt: 'x', projects: [proj('a', '2026-08-01T00:00:00Z')] }));
    const mod = await freshModule();
    await mod.hydrateProjectsFromDisk();
    writeTextFile.mockClear();
    idb.set(PROJECTS_KEY, []); // es. corruzione o lettura andata male
    await mod.persistProjectsToDisk();
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('cancellazione dell ultimo progetto (allowEmpty): il disco si svuota davvero', async () => {
    disk.set(FILE, JSON.stringify({ savedAt: 'x', projects: [proj('a', '2026-08-01T00:00:00Z')] }));
    const mod = await freshModule();
    await mod.hydrateProjectsFromDisk();
    idb.set(PROJECTS_KEY, []); // deleteProject dell'ultimo
    await mod.persistProjectsToDisk({ allowEmpty: true });
    const blob = JSON.parse(disk.get(FILE)!);
    expect(blob.projects).toEqual([]); // niente resurrezione alla prossima hydration
  });
});

describe('ambiente non-Tauri', () => {
  it('gli import del fs falliscono ma l hydration si conclude senza esplodere', async () => {
    vi.doMock('@tauri-apps/api/path', () => { throw new Error('not in tauri'); });
    const mod = await freshModule();
    await expect(mod.hydrateProjectsFromDisk()).resolves.toBeUndefined();
    expect(mod.isProjectsHydrationSettled()).toBe(true);
    vi.doUnmock('@tauri-apps/api/path');
  });
});
