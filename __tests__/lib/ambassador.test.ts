/**
 * Test per la selezione dell'"Ambassador in evidenza" (criteri pubblici e automatici):
 * - fattore qualità dal rating
 * - punteggio reach×qualità
 * - eleggibilità (pack pubblicati + download)
 * - scelta deterministica con tie-break stabile
 */

import { describe, it, expect } from 'vitest';
import {
  qualityFactor,
  ambassadorScore,
  isEligibleAmbassador,
  pickAmbassador,
} from '@/lib/social/ambassador';
import type { LeaderboardEntry } from '@/lib/social/community-hub-backend';

function mk(partial: Partial<LeaderboardEntry> & { username: string }): LeaderboardEntry {
  return {
    id: partial.id ?? partial.username,
    username: partial.username,
    reputation: partial.reputation ?? 0,
    totalContributions: partial.totalContributions ?? 0,
    verifiedTranslator: partial.verifiedTranslator ?? false,
    followersCount: partial.followersCount ?? 0,
    totalDownloads: partial.totalDownloads ?? 0,
    publishedPacks: partial.publishedPacks ?? 0,
    avgRating: partial.avgRating ?? 0,
    badgeCount: partial.badgeCount ?? 0,
    score: partial.score ?? 0,
    ...partial,
  } as LeaderboardEntry;
}

describe('qualityFactor', () => {
  it('neutro 0.5 se non valutato o non valido', () => {
    expect(qualityFactor(0)).toBe(0.5);
    expect(qualityFactor(-1)).toBe(0.5);
    expect(qualityFactor(NaN)).toBe(0.5);
  });
  it('normalizza il rating a 0..1 e satura a 5', () => {
    expect(qualityFactor(5)).toBe(1);
    expect(qualityFactor(2.5)).toBe(0.5);
    expect(qualityFactor(9)).toBe(1);
  });
});

describe('ambassadorScore', () => {
  it('è reach pesato per la qualità', () => {
    expect(ambassadorScore({ totalDownloads: 1000, avgRating: 5 })).toBe(1000);
    expect(ambassadorScore({ totalDownloads: 1000, avgRating: 2.5 })).toBe(500);
    expect(ambassadorScore({ totalDownloads: 1000, avgRating: 0 })).toBe(500); // neutro
  });
});

describe('isEligibleAmbassador', () => {
  it('richiede almeno 1 pack e 1 download', () => {
    expect(isEligibleAmbassador(mk({ username: 'a', publishedPacks: 0, totalDownloads: 999 }))).toBe(false);
    expect(isEligibleAmbassador(mk({ username: 'b', publishedPacks: 3, totalDownloads: 0 }))).toBe(false);
    expect(isEligibleAmbassador(mk({ username: 'c', publishedPacks: 1, totalDownloads: 1 }))).toBe(true);
  });
});

describe('pickAmbassador', () => {
  it('null su lista vuota o senza eleggibili', () => {
    expect(pickAmbassador([])).toBeNull();
    expect(pickAmbassador(null)).toBeNull();
    expect(pickAmbassador([mk({ username: 'vuoto', publishedPacks: 0 })])).toBeNull();
  });

  it('la qualità può battere il volume grezzo', () => {
    const volume = mk({ username: 'volume', publishedPacks: 2, totalDownloads: 1000, avgRating: 2 }); // 400
    const quality = mk({ username: 'quality', publishedPacks: 2, totalDownloads: 900, avgRating: 5 }); // 900
    expect(pickAmbassador([volume, quality])?.username).toBe('quality');
  });

  it('a parità di score sceglie il rating più alto', () => {
    // score uguale: 800*0.5=400 vs 400*1=400
    const a = mk({ username: 'a', publishedPacks: 1, totalDownloads: 800, avgRating: 2.5 });
    const b = mk({ username: 'b', publishedPacks: 1, totalDownloads: 400, avgRating: 5 });
    expect(pickAmbassador([a, b])?.username).toBe('b');
  });

  it('è deterministico (tie-break su username)', () => {
    const x = mk({ username: 'zeta', publishedPacks: 1, totalDownloads: 500, avgRating: 4 });
    const y = mk({ username: 'alfa', publishedPacks: 1, totalDownloads: 500, avgRating: 4 });
    expect(pickAmbassador([x, y])?.username).toBe('alfa');
    expect(pickAmbassador([y, x])?.username).toBe('alfa');
  });
});
