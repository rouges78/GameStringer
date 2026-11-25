/**
 * Annulla String it: i wrapper chiamano il comando giusto con `gamePath`
 * (camelCase, come vuole `rename_all = "camelCase"` sul comando Rust) e
 * restituiscono la risposta così com'è.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@/lib/tauri-api', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}));

import { probeStringItRestore, restoreStringIt } from '@/lib/string-it/restore';

beforeEach(() => {
  invokeMock.mockReset();
});

describe('probeStringItRestore', () => {
  it('chiama string_it_restore_probe con gamePath', async () => {
    const probe = {
      restorable: [{ method: 'rpgmaker', detail: 'www/data/Map001.json' }],
      manual: [{ method: 'unity-xunity', reason: 'BepInEx non provato nostro' }],
    };
    invokeMock.mockResolvedValueOnce(probe);

    await expect(probeStringItRestore('C:\\Games\\Foo')).resolves.toEqual(probe);
    expect(invokeMock).toHaveBeenCalledWith('string_it_restore_probe', { gamePath: 'C:\\Games\\Foo' });
  });
});

describe('restoreStringIt', () => {
  it('chiama string_it_restore con gamePath e restituisce il report', async () => {
    const report = {
      restored: [{ method: 'renpy', detail: 'ripristinato: game/tl/it (2 file)' }],
      skipped: [],
      errors: [{ method: 'gamemaker', error: 'data.win: accesso negato' }],
    };
    invokeMock.mockResolvedValueOnce(report);

    await expect(restoreStringIt('/games/bar')).resolves.toEqual(report);
    expect(invokeMock).toHaveBeenCalledWith('string_it_restore', { gamePath: '/games/bar' });
  });

  it('propaga l\'errore del comando', async () => {
    invokeMock.mockRejectedValueOnce(new Error('Cartella del gioco non trovata: x'));
    await expect(restoreStringIt('x')).rejects.toThrow('Cartella del gioco non trovata');
  });
});
