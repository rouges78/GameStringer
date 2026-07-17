/**
 * Test per il motore di suggerimento del "primo gioco facile" (onboarding):
 * - normalizzazione engine
 * - riconoscimento lingua target
 * - ranking per facilità e scelta del miglior candidato
 */

import { describe, it, expect } from 'vitest';
import {
  resolveEngineProfile,
  supportsLanguage,
  rankFirstGameCandidates,
  pickFirstGame,
  type FirstGameInput,
} from '@/lib/onboarding/first-game';

const g = (over: Partial<FirstGameInput>): FirstGameInput => ({
  id: over.id || over.title || 'x',
  title: over.title || 'Game',
  isInstalled: true,
  ...over,
});

describe('resolveEngineProfile', () => {
  it('riconosce gli engine da stringhe libere', () => {
    expect(resolveEngineProfile("Ren'Py").id).toBe('renpy');
    expect(resolveEngineProfile('RPG Maker MV').id).toBe('rpgmaker');
    expect(resolveEngineProfile('Made with Unity (IL2CPP)').id).toBe('unity');
    expect(resolveEngineProfile('Unreal Engine 5').id).toBe('unreal');
    expect(resolveEngineProfile('TyranoScript v5').id).toBe('tyranoscript');
  });

  it('ritorna unknown per engine assente o non riconosciuto', () => {
    expect(resolveEngineProfile(null).id).toBe('unknown');
    expect(resolveEngineProfile('CustomInHouseEngine').id).toBe('unknown');
  });
});

describe('supportsLanguage', () => {
  it('riconosce la lingua target da nomi Steam', () => {
    expect(supportsLanguage(['English', 'Italian'], 'it')).toBe(true);
    expect(supportsLanguage(['english', 'french'], 'it')).toBe(false);
    expect(supportsLanguage(['Español', 'English'], 'es')).toBe(true);
  });

  it('gestisce liste vuote o target assente', () => {
    expect(supportsLanguage([], 'it')).toBe(false);
    expect(supportsLanguage(undefined, 'it')).toBe(false);
    expect(supportsLanguage(['Italian'], undefined)).toBe(false);
  });
});

describe('rankFirstGameCandidates / pickFirstGame', () => {
  it('preferisce l\'engine più facile (Ren\'Py > Unity > Unreal)', () => {
    const games = [
      g({ title: 'Big AAA', engine: 'Unreal Engine 5' }),
      g({ title: 'Indie VN', engine: "Ren'Py" }),
      g({ title: 'Action', engine: 'Unity' }),
    ];
    const best = pickFirstGame(games, { targetLanguage: 'it' });
    expect(best?.game.title).toBe('Indie VN');
    expect(best?.engineId).toBe('renpy');
    expect(best?.estimatedMinutes).toBeLessThanOrEqual(5);
  });

  it('considera solo i giochi installati di default', () => {
    const games = [
      g({ title: 'Not Installed RenPy', engine: "Ren'Py", isInstalled: false }),
      g({ title: 'Installed RPGMaker', engine: 'RPG Maker MV', isInstalled: true }),
    ];
    const best = pickFirstGame(games, { targetLanguage: 'it' });
    expect(best?.game.title).toBe('Installed RPGMaker');
  });

  it('ritorna null se nessun gioco è installato', () => {
    const games = [g({ title: 'A', engine: "Ren'Py", isInstalled: false })];
    expect(pickFirstGame(games, { targetLanguage: 'it' })).toBeNull();
  });

  it('de-prioritizza i giochi già disponibili nella lingua target', () => {
    const games = [
      g({ title: 'Already IT', engine: "Ren'Py", supportedLanguages: ['Italian', 'English'] }),
      g({ title: 'To Translate', engine: 'RPG Maker MV', supportedLanguages: ['Japanese'] }),
    ];
    const best = pickFirstGame(games, { targetLanguage: 'it' });
    // Nonostante Ren'Py sia più facile, "Already IT" è già in italiano → penalizzato.
    expect(best?.game.title).toBe('To Translate');
    const ranked = rankFirstGameCandidates(games, { targetLanguage: 'it' });
    expect(ranked[1].alreadyInTargetLanguage).toBe(true);
  });

  it('a parità di engine, chi è stato giocato di recente ha un bonus', () => {
    const games = [
      g({ title: 'Old', engine: "Ren'Py", lastPlayed: Date.now() - 1000 * 60 * 60 * 24 * 365 }),
      g({ title: 'Recent', engine: "Ren'Py", lastPlayed: Date.now() - 1000 * 60 * 60 * 24 }),
    ];
    const best = pickFirstGame(games, { targetLanguage: 'it' });
    expect(best?.game.title).toBe('Recent');
  });
});
