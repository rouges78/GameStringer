import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appendEntry, loadRunResult, recordingToast, saveRunResult, type RunLogEntry } from '@/lib/string-it/run-log';

function fakeToast() {
  const base = Object.assign(vi.fn(() => 'plain'), {
    success: vi.fn(() => 's'),
    error: vi.fn(() => 'e'),
    info: vi.fn(() => 'i'),
    warning: vi.fn(() => 'w'),
    loading: vi.fn(() => 'l'),
    dismiss: vi.fn(),
  });
  return base;
}

describe('recordingToast', () => {
  it('mostra il toast e registra gli esiti, non i loading', () => {
    const base = fakeToast();
    const seen: RunLogEntry[] = [];
    const t = recordingToast(base, e => seen.push(e));

    expect(t.success('Fatto', { description: '291 testi' })).toBe('s');
    t.error('Fallito');
    t.loading('Sto lavorando');
    t('Messaggio neutro');

    expect(base.success).toHaveBeenCalledWith('Fatto', { description: '291 testi' });
    expect(base.loading).toHaveBeenCalled();
    expect(base).toHaveBeenCalledWith('Messaggio neutro', undefined);
    expect(seen.map(e => [e.level, e.message, e.description])).toEqual([
      ['success', 'Fatto', '291 testi'],
      ['error', 'Fallito', undefined],
      ['info', 'Messaggio neutro', undefined],
    ]);
  });

  it('ignora i messaggi che non sono testo', () => {
    const seen: RunLogEntry[] = [];
    const t = recordingToast(fakeToast(), e => seen.push(e));
    t.info({ jsx: true } as unknown as string);
    expect(seen).toHaveLength(0);
  });
});

describe('persistenza esito', () => {
  beforeEach(() => localStorage.clear());

  it('salva e rilegge per gioco, tenendo al massimo 40 voci', () => {
    let run = { startedAt: 1, entries: [] as RunLogEntry[] };
    for (let i = 0; i < 45; i++) run = appendEntry(run, { level: 'info', message: `m${i}`, at: i });
    saveRunResult('game-1', run);

    const back = loadRunResult('game-1');
    expect(back?.entries).toHaveLength(40);
    expect(back?.entries[0].message).toBe('m5');
    expect(loadRunResult('game-2')).toBeNull();
  });

  it('un valore rovinato in localStorage non rompe la scheda', () => {
    localStorage.setItem('gs.stringit.lastRun.x', '{non json');
    expect(loadRunResult('x')).toBeNull();
  });
});
