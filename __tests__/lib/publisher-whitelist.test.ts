/**
 * Test per la whitelist relazioni-publisher (matcher puro):
 * - normalizzazione titolo
 * - match per appId e per titolo
 * - avviso non bloccante per localizzazione ufficiale (solo lingua interessata)
 * - blocco per richiesta publisher (lingue mirate o tutte)
 * - precedenza del blocco sull'avviso
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeTitle,
  matchWhitelist,
  type PublisherWhitelist,
} from '@/lib/social/publisher-whitelist';

const WL: PublisherWhitelist = {
  version: 1,
  entries: [
    { title: 'Official IT Game', appId: 111, reason: 'official_localization', languages: ['it'] },
    { title: 'No Translate Please', appId: 222, reason: 'publisher_request', languages: [] },
    { title: 'Block Only ES', appId: 333, reason: 'publisher_request', languages: ['es'] },
  ],
};

describe('normalizeTitle', () => {
  it('minuscole, via simboli e spazi multipli', () => {
    expect(normalizeTitle('  The Game™:  Deluxe  ')).toBe('the game deluxe');
    expect(normalizeTitle('ELDEN RING®')).toBe('elden ring');
    expect(normalizeTitle(null)).toBe('');
  });
});

describe('matchWhitelist', () => {
  it('null se il gioco non e in whitelist', () => {
    expect(matchWhitelist({ title: 'Random', appId: 999 }, 'it', WL)).toBeNull();
    expect(matchWhitelist({ title: 'x' }, 'it', null)).toBeNull();
  });

  it('official_localization: avviso solo per la lingua ufficiale', () => {
    const v = matchWhitelist({ appId: 111 }, 'it', WL);
    expect(v?.blocked).toBe(false);
    expect(v?.notice).toBe(true);
    expect(v?.reason).toBe('official_localization');
    // lingua diversa da quella ufficiale -> nessun verdetto
    expect(matchWhitelist({ appId: 111 }, 'fr', WL)).toBeNull();
  });

  it('match per titolo normalizzato quando manca appId', () => {
    const v = matchWhitelist({ title: 'official it game™' }, 'it', WL);
    expect(v?.notice).toBe(true);
  });

  it('publisher_request con lingue vuote blocca ogni lingua', () => {
    expect(matchWhitelist({ appId: 222 }, 'it', WL)?.blocked).toBe(true);
    expect(matchWhitelist({ appId: 222 }, 'ja', WL)?.blocked).toBe(true);
  });

  it('publisher_request mirato blocca solo le lingue elencate', () => {
    expect(matchWhitelist({ appId: 333 }, 'es', WL)?.blocked).toBe(true);
    expect(matchWhitelist({ appId: 333 }, 'it', WL)).toBeNull();
  });

  it('il blocco vince sull avviso a parita di gioco', () => {
    const wl: PublisherWhitelist = {
      version: 1,
      entries: [
        { appId: 500, reason: 'official_localization', languages: ['it'] },
        { appId: 500, reason: 'publisher_request', languages: ['it'] },
      ],
    };
    expect(matchWhitelist({ appId: 500 }, 'it', wl)?.blocked).toBe(true);
  });
});
