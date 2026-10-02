import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const idbGet = vi.fn();
vi.mock('idb-keyval', () => ({ get: (...args: unknown[]) => idbGet(...args) }));

import {
  TOS_KEY,
  ONBOARDING_KEY,
  TUTORIAL_KEY,
  isTosAccepted,
  isOnboardingDone,
  isTutorialDone,
  whenReady,
} from '@/components/onboarding/first-run';
import { readLibraryGames, readTargetLanguage } from '@/components/onboarding/first-game-flow';

describe('first-run gates', () => {
  it('accept only stored versions at or above the current one', () => {
    expect(isTosAccepted()).toBe(false);
    localStorage.setItem(TOS_KEY, '1');
    expect(isTosAccepted()).toBe(false);
    localStorage.setItem(TOS_KEY, '2');
    expect(isTosAccepted()).toBe(true);

    // il wizard scriveva '2' per il tour, che invece chiede la 5
    localStorage.setItem(TUTORIAL_KEY, '2');
    expect(isTutorialDone()).toBe(false);
    localStorage.setItem(TUTORIAL_KEY, '5');
    expect(isTutorialDone()).toBe(true);

    localStorage.setItem(ONBOARDING_KEY, 'true');
    expect(isOnboardingDone()).toBe(false);
    localStorage.setItem(ONBOARDING_KEY, '6');
    expect(isOnboardingDone()).toBe(true);
  });
});

describe('whenReady', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires after the delay when already ready', () => {
    const onReady = vi.fn();
    whenReady(() => true, onReady, 300);
    vi.advanceTimersByTime(299);
    expect(onReady).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('waits until the condition becomes true, then fires once', () => {
    let ready = false;
    const onReady = vi.fn();
    whenReady(() => ready, onReady, 100);
    vi.advanceTimersByTime(2000);
    expect(onReady).not.toHaveBeenCalled();
    ready = true;
    vi.advanceTimersByTime(600);
    expect(onReady).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('cleanup stops both the polling and the pending delay', () => {
    let ready = false;
    const onReady = vi.fn();
    const stop = whenReady(() => ready, onReady, 100);
    stop();
    ready = true;
    vi.advanceTimersByTime(5000);
    expect(onReady).not.toHaveBeenCalled();

    const stop2 = whenReady(() => true, onReady, 1000);
    stop2();
    vi.advanceTimersByTime(5000);
    expect(onReady).not.toHaveBeenCalled();
  });
});

describe('FirstGameFlow data', () => {
  beforeEach(() => {
    idbGet.mockReset();
    delete (globalThis as Record<string, unknown>).__gsLibCache;
  });

  it('reads the target language from translation.defaultTargetLang, not targetLanguage', () => {
    localStorage.setItem(
      'gameStringerSettings',
      JSON.stringify({ translation: { targetLanguage: 'fr', defaultTargetLang: 'de' }, system: { language: 'it' } })
    );
    expect(readTargetLanguage('es')).toBe('de');
  });

  it('falls back to the UI language when no default target is saved', () => {
    localStorage.setItem('gameStringerSettings', JSON.stringify({ system: { language: 'it' } }));
    expect(readTargetLanguage('es')).toBe('es');
    localStorage.setItem('gameStringerSettings', '{broken');
    expect(readTargetLanguage('ja')).toBe('ja');
  });

  it('reads the persisted library when the Library page cache was never created', async () => {
    idbGet.mockResolvedValue([
      { id: 'steam_1', title: 'Doki', engine: 'renpy', is_installed: true, install_path: 'C:/Games/Doki' },
    ]);
    const games = await readLibraryGames();
    expect(idbGet).toHaveBeenCalledWith('gs_library_games');
    expect(games).toEqual([
      expect.objectContaining({ id: 'steam_1', title: 'Doki', isInstalled: true, installDir: 'C:/Games/Doki' }),
    ]);
  });

  it('prefers the in-memory Library cache when it has games', async () => {
    (globalThis as Record<string, unknown>).__gsLibCache = {
      games: { loaded: true, data: [{ id: 'g1', title: 'Mem', is_installed: false, install_dir: 'D:/x' }] },
    };
    const games = await readLibraryGames();
    expect(idbGet).not.toHaveBeenCalled();
    expect(games[0]).toEqual(expect.objectContaining({ id: 'g1', installDir: 'D:/x' }));
  });

  it('returns an empty list when the persisted cache cannot be read', async () => {
    idbGet.mockRejectedValue(new Error('idb down'));
    await expect(readLibraryGames()).resolves.toEqual([]);
  });
});
