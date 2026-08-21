import { describe, it, expect, vi } from 'vitest';

import {
  drainOnce,
  TranslationBridgeDrain,
  type DrainDeps,
  type DrainStats,
} from '@/lib/translation-bridge-drain';

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

function freshStats(): DrainStats {
  return { learned: 0, idleRounds: 0, failed: 0, budgetExhausted: false };
}

const OPTS = {
  intervalMs: 10,
  batchSize: 50,
  maxTranslationsPerSession: 2000,
  saveEvery: 25,
};

/** Deps finte: coda predefinita, traduzione che prefissa "IT:". */
function makeDeps(queue: string[][], overrides: Partial<DrainDeps> = {}): DrainDeps & {
  added: Array<[string, string]>;
  saves: number;
} {
  const added: Array<[string, string]> = [];
  let saves = 0;
  const deps = {
    drainMisses: vi.fn(async () => queue.shift() ?? []),
    translate: vi.fn(async (texts: string[]) => ({
      translations: texts.map((t) => `IT:${t}`),
      success: true,
    })),
    addTranslation: vi.fn(async (o: string, t: string) => {
      added.push([o, t]);
      return true;
    }),
    save: vi.fn(async () => {
      saves++;
    }),
    ...overrides,
  };
  return Object.defineProperties(deps as never, {
    added: { get: () => added },
    saves: { get: () => saves },
  }) as DrainDeps & { added: Array<[string, string]>; saves: number };
}

describe('drainOnce', () => {
  it('traduce i miss e li reinserisce nel dizionario', async () => {
    const deps = makeDeps([['New Game', 'Continue']]);
    const stats = freshStats();

    const learned = await drainOnce(deps, stats, OPTS);

    expect(learned).toBe(2);
    expect(stats.learned).toBe(2);
    expect(deps.added).toEqual([
      ['New Game', 'IT:New Game'],
      ['Continue', 'IT:Continue'],
    ]);
  });

  it('conta un giro a vuoto quando la coda è vuota, senza chiamare il provider', async () => {
    const deps = makeDeps([[]]);
    const stats = freshStats();

    await drainOnce(deps, stats, OPTS);

    expect(stats.idleRounds).toBe(1);
    expect(deps.translate).not.toHaveBeenCalled();
  });

  it('non inserisce una traduzione identica all\'originale', async () => {
    // Un provider che "traduce" restituendo l'input trasformerebbe il miss in
    // un hit sbagliato e permanente: la stringa non verrebbe mai più ritentata.
    const deps = makeDeps([['Continue']], {
      translate: async (texts: string[]) => ({ translations: [...texts], success: true }),
    });
    const stats = freshStats();

    await drainOnce(deps, stats, OPTS);

    expect(deps.added).toEqual([]);
    expect(stats.learned).toBe(0);
    expect(stats.failed).toBe(1);
  });

  it('non inserisce una traduzione vuota', async () => {
    const deps = makeDeps([['Save']], {
      translate: async () => ({ translations: [''], success: true }),
    });
    const stats = freshStats();

    await drainOnce(deps, stats, OPTS);

    expect(deps.added).toEqual([]);
    expect(stats.failed).toBe(1);
  });

  it('conta come fallite tutte le stringhe se il provider fallisce', async () => {
    const deps = makeDeps([['a', 'b', 'c']], {
      translate: async () => ({ translations: [], success: false }),
    });
    const stats = freshStats();

    await drainOnce(deps, stats, OPTS);

    expect(stats.failed).toBe(3);
    expect(stats.learned).toBe(0);
    expect(deps.added).toEqual([]);
  });

  it('tronca il batch per non sforare il tetto di sessione', async () => {
    const deps = makeDeps([['a', 'b', 'c', 'd', 'e']]);
    const stats = freshStats();

    await drainOnce(deps, stats, { ...OPTS, maxTranslationsPerSession: 3 });

    expect(stats.learned).toBe(3);
    expect(deps.added.map(([o]) => o)).toEqual(['a', 'b', 'c']);
    expect(stats.budgetExhausted).toBe(true);
  });

  it('a budget esaurito non chiama nemmeno drainMisses', async () => {
    const deps = makeDeps([['a']]);
    const stats = { ...freshStats(), learned: 10 };

    const learned = await drainOnce(deps, stats, { ...OPTS, maxTranslationsPerSession: 10 });

    expect(learned).toBe(0);
    expect(stats.budgetExhausted).toBe(true);
    expect(deps.drainMisses).not.toHaveBeenCalled();
  });

  it('salva una sola volta quando si supera la soglia di saveEvery', async () => {
    const deps = makeDeps([['a', 'b', 'c']]);
    const stats = freshStats();

    await drainOnce(deps, stats, { ...OPTS, saveEvery: 2 });

    // 0 -> 3 attraversa la soglia di 2 una volta sola: un solo salvataggio.
    expect(deps.saves).toBe(1);
  });

  it('non salva se non ha imparato niente', async () => {
    const deps = makeDeps([['a']], {
      translate: async () => ({ translations: [''], success: true }),
    });
    const stats = freshStats();

    await drainOnce(deps, stats, { ...OPTS, saveEvery: 1 });

    expect(deps.saves).toBe(0);
  });

  it('un salvataggio fallito non fa perdere le traduzioni già imparate', async () => {
    const deps = makeDeps([['a', 'b']], {
      save: async () => {
        throw new Error('disco pieno');
      },
    });
    const stats = freshStats();

    await expect(drainOnce(deps, stats, { ...OPTS, saveEvery: 1 })).resolves.toBe(2);
    expect(stats.learned).toBe(2);
  });
});

describe('TranslationBridgeDrain', () => {
  it('gira a intervalli finché non viene fermato', async () => {
    vi.useFakeTimers();
    try {
      const deps = makeDeps([['a'], ['b'], ['c']]);
      const loop = new TranslationBridgeDrain(deps, { intervalMs: 100, saveEvery: 0 });

      loop.start();
      expect(loop.isRunning).toBe(true);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(100);

      expect(loop.stats.learned).toBe(3);

      loop.stop();
      expect(loop.isRunning).toBe(false);
      const after = loop.stats.learned;
      await vi.advanceTimersByTimeAsync(500);
      expect(loop.stats.learned).toBe(after);
    } finally {
      vi.useRealTimers();
    }
  });

  it('si ferma da solo quando esaurisce il budget', async () => {
    vi.useFakeTimers();
    try {
      const deps = makeDeps([['a', 'b'], ['c']]);
      const loop = new TranslationBridgeDrain(deps, {
        intervalMs: 100,
        maxTranslationsPerSession: 2,
        saveEvery: 0,
      });

      loop.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(loop.stats.budgetExhausted).toBe(true);
      expect(loop.isRunning).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('un giro che esplode non ferma il loop', async () => {
    vi.useFakeTimers();
    try {
      let call = 0;
      const deps = makeDeps([['a']], {
        drainMisses: async () => {
          call++;
          if (call === 1) throw new Error('IPC giù');
          return call === 2 ? ['b'] : [];
        },
      });
      const loop = new TranslationBridgeDrain(deps, { intervalMs: 100, saveEvery: 0 });

      loop.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(loop.stats.learned).toBe(0);

      await vi.advanceTimersByTimeAsync(100);
      expect(loop.stats.learned).toBe(1);
      expect(loop.isRunning).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('start() due volte non raddoppia i giri', async () => {
    vi.useFakeTimers();
    try {
      const deps = makeDeps([['a'], ['b']]);
      const loop = new TranslationBridgeDrain(deps, { intervalMs: 100, saveEvery: 0 });

      loop.start();
      loop.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(deps.drainMisses).toHaveBeenCalledTimes(1);
      loop.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
