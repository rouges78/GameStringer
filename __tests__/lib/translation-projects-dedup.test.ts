/**
 * Identità dei progetti per percorso + fusione dei duplicati (04/08/2026).
 *
 * Il caso reale che ha originato tutto (Foolish Mortals, 03/08): il job
 * Visionaire registrava il progetto con l'id di libreria, il backfill dei
 * checkpoint lo ricreava con gameId sintetico `vis-<path>` — stesso gioco,
 * due schede in pagina Progetti, e il contatore sommava 16.978 + 25.936.
 * findProject confrontava solo gameId+lingua, quindi non li vedeva uguali.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// idb-keyval in-memory: niente IndexedDB vera nei test.
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (k: string) => store.get(k)),
  set: vi.fn(async (k: string, v: unknown) => { store.set(k, v); }),
  keys: vi.fn(async () => [...store.keys()]),
}));
vi.mock('@/lib/social/community-hub-backend', () => ({
  getSupabase: vi.fn(async () => null),
}));
vi.mock('@/lib/client-logger', () => ({
  clientLogger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { projectService, type TranslationProject } from '@/lib/services/translation-projects';

const PROJECTS_KEY = 'gs_translation_projects';

function baseProject(over: Partial<TranslationProject>): TranslationProject {
  return {
    id: `proj_${Math.random().toString(36).slice(2)}`,
    gameId: 'x', gameName: 'X',
    sourceLanguage: 'en', targetLanguage: 'it',
    status: 'active', progress: 0,
    totalStrings: 0, translatedStrings: 0, files: [],
    createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
    lastActivityAt: '2026-08-01T00:00:00Z', isShared: false,
    ...over,
  };
}

beforeEach(() => store.clear());

describe('createOrGetProject — identità per percorso', () => {
  it('due chiamanti con gameId diversi ma stesso path NON creano due progetti', async () => {
    // Il job vero, con id di libreria e path del gioco
    const primo = await projectService.createOrGetProject({
      gameId: 'steam_12345', gameName: 'Foolish Mortals',
      sourceLanguage: 'en', targetLanguage: 'it',
      gamePathKey: 'g:/giochi/foolishmortals',
      files: [{ path: 'G:\\Giochi\\FoolishMortals', name: 'data.vis', type: 'visionaire', strings: 25936 }],
    });
    // Il backfill, con id sintetico ma stessa chiave-percorso
    const secondo = await projectService.createOrGetProject({
      gameId: 'vis-g:/giochi/foolishmortals', gameName: 'foolishmortals',
      sourceLanguage: 'en', targetLanguage: 'it',
      gamePathKey: 'g:/giochi/foolishmortals',
    });

    expect(secondo.id).toBe(primo.id); // stesso progetto, non un gemello
    const all = (store.get(PROJECTS_KEY) as TranslationProject[]);
    expect(all.length).toBe(1);
  });

  it('lingue diverse restano progetti diversi anche con lo stesso path', async () => {
    const it_ = await projectService.createOrGetProject({
      gameId: 'g1', gameName: 'G', sourceLanguage: 'en', targetLanguage: 'it',
      gamePathKey: 'c:/games/g',
    });
    const ru = await projectService.createOrGetProject({
      gameId: 'g1', gameName: 'G', sourceLanguage: 'en', targetLanguage: 'ru',
      gamePathKey: 'c:/games/g',
    });
    expect(ru.id).not.toBe(it_.id);
  });

  it("l'id di libreria sostituisce quello sintetico vis- (nome e copertina migliori)", async () => {
    await projectService.createOrGetProject({
      gameId: 'vis-d:/games/below', gameName: 'below',
      sourceLanguage: 'en', targetLanguage: 'it', gamePathKey: 'd:/games/below',
    });
    const adottato = await projectService.createOrGetProject({
      gameId: 'steam_999', gameName: 'Below, Rusted Gods', gameImage: 'cover.jpg',
      sourceLanguage: 'en', targetLanguage: 'it', gamePathKey: 'd:/games/below',
    });
    expect(adottato.gameId).toBe('steam_999');
    expect(adottato.gameName).toBe('Below, Rusted Gods');
    expect(adottato.gameImage).toBe('cover.jpg');
  });
});

describe('mergeDuplicateProjects — i duplicati storici si fondono', () => {
  it('fonde i record pre-esistenti SENZA gamePathKey usando vis- e files[0].path', async () => {
    // Com'erano davvero i dati il 03/08: nessuno dei due ha gamePathKey.
    const dalJob = baseProject({
      gameId: 'steam_12345', gameName: 'Foolish Mortals',
      totalStrings: 25936, translatedStrings: 16000,
      files: [{ path: 'G:\\Giochi\\FoolishMortals', name: 'data.vis', type: 'visionaire', totalStrings: 25936, translatedStrings: 0, status: 'pending' }],
      lastActivityAt: '2026-08-03T20:00:00Z',
    });
    const dalBackfill = baseProject({
      gameId: 'vis-g:/giochi/foolishmortals', gameName: 'foolishmortals',
      totalStrings: 16978, translatedStrings: 16978,
      lastActivityAt: '2026-08-03T21:00:00Z',
    });
    store.set(PROJECTS_KEY, [dalJob, dalBackfill]);

    const removed = await projectService.mergeDuplicateProjects();

    expect(removed).toBe(1);
    const all = store.get(PROJECTS_KEY) as TranslationProject[];
    expect(all.length).toBe(1);
    const winner = all[0];
    expect(winner.gameId).toBe('steam_12345');        // vince l'id di libreria
    expect(winner.totalStrings).toBe(25936);           // massimo, NON 42914 (la somma era la bugia)
    expect(winner.translatedStrings).toBe(16978);      // massimo
  });

  it('non fonde giochi diversi', async () => {
    store.set(PROJECTS_KEY, [
      baseProject({ gameId: 'a', files: [{ path: 'C:\\A', name: 'a', type: 't', totalStrings: 1, translatedStrings: 0, status: 'pending' }] }),
      baseProject({ gameId: 'b', files: [{ path: 'C:\\B', name: 'b', type: 't', totalStrings: 1, translatedStrings: 0, status: 'pending' }] }),
    ]);
    expect(await projectService.mergeDuplicateProjects()).toBe(0);
    expect((store.get(PROJECTS_KEY) as TranslationProject[]).length).toBe(2);
  });

  it('è idempotente: il secondo giro non rimuove nulla', async () => {
    store.set(PROJECTS_KEY, [
      baseProject({ gameId: 'steam_1', files: [{ path: 'C:\\G', name: 'g', type: 't', totalStrings: 10, translatedStrings: 0, status: 'pending' }] }),
      baseProject({ gameId: 'vis-c:/g', totalStrings: 5 }),
    ]);
    expect(await projectService.mergeDuplicateProjects()).toBe(1);
    expect(await projectService.mergeDuplicateProjects()).toBe(0);
  });
});
