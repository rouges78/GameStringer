/**
 * Test delle funzioni PURE di crash-reporter e compat-telemetry:
 * la sanitizzazione è la garanzia privacy del crash reporting opt-in,
 * quindi va coperta da regression test.
 */
import { describe, it, expect, vi } from 'vitest';

// Evita di trascinare il client Supabase reale nei test.
vi.mock('@/lib/social/community-hub-backend', () => ({
  getSupabase: vi.fn(async () => { throw new Error('no network in tests'); }),
  getCurrentUser: vi.fn(async () => null),
}));

import { sanitizeCrashText, crashSignature, isCrashReportingEnabled } from '@/lib/crash-reporter';
import { classifyCompatError, compatGameKey } from '@/lib/compat-telemetry';

describe('sanitizeCrashText', () => {
  it('riduce i percorsi Windows al solo basename', () => {
    const out = sanitizeCrashText('ENOENT: C:\\Users\\Davide\\Games\\Persona 5\\data.cpk not found');
    expect(out).not.toContain('Davide');
    expect(out).not.toContain('C:\\Users');
    expect(out).toContain('data.cpk');
  });

  it('riduce i percorsi POSIX al solo basename', () => {
    const out = sanitizeCrashText('cannot open /home/davide/.local/share/game/strings.json');
    expect(out).not.toContain('/home/davide');
    expect(out).toContain('strings.json');
  });

  it('rimuove email, token e query string', () => {
    const out = sanitizeCrashText(
      'auth failed for user@example.com with sk-abc123def456ghi789 at https://api.example.com/v1?key=SECRET123'
    );
    expect(out).not.toContain('user@example.com');
    expect(out).not.toContain('sk-abc123def456ghi789');
    expect(out).not.toContain('SECRET123');
    expect(out).toContain('<email>');
    expect(out).toContain('https://api.example.com/v1');
  });

  it('rimuove i JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0';
    expect(sanitizeCrashText(`token ${jwt} rejected`)).not.toContain(jwt);
  });
});

describe('crashSignature', () => {
  it('è stabile rispetto a numeri variabili nel messaggio', () => {
    const a = crashSignature('parse', 'Unexpected token at line 42', 'at parse (file.ts:42:1)');
    const b = crashSignature('parse', 'Unexpected token at line 97', 'at parse (file.ts:42:1)');
    expect(a).toBe(b);
  });

  it('cambia al cambiare della categoria', () => {
    const a = crashSignature('parse', 'boom', undefined);
    const b = crashSignature('network', 'boom', undefined);
    expect(a).not.toBe(b);
  });
});

describe('classifyCompatError', () => {
  it.each([
    ['Denuvo protection detected', 'drm'],
    ['Rate limit exceeded (429)', 'rate_limit'],
    ['fetch failed: ECONNREFUSED', 'network'],
    ['invalid api key (401 Unauthorized)', 'auth'],
    ['No translatable strings found', 'no_strings'],
    ['qualcosa di ignoto', 'other'],
  ])('%s → %s', (msg, expected) => {
    expect(classifyCompatError(new Error(msg))).toBe(expected);
  });
});

describe('compatGameKey', () => {
  it('usa l\'AppID quando numerico', () => {
    expect(compatGameKey(400, 'Portal')).toBe('400');
    expect(compatGameKey('400', 'Portal')).toBe('400');
  });
  it('altrimenti genera uno slug del nome', () => {
    expect(compatGameKey(null, 'My Indie Game™!')).toBe('g:my-indie-game');
    expect(compatGameKey(undefined, '  Spazi   Multipli  ')).toBe('g:spazi-multipli');
  });
});

describe('isCrashReportingEnabled', () => {
  // NB: src/test/setup.ts sostituisce localStorage con stub vi.fn(),
  // quindi si controlla il gate mockando il valore letto.
  it('è OFF di default e ON solo con il flag esplicito', () => {
    const getItem = vi.mocked(window.localStorage.getItem);
    getItem.mockReturnValueOnce(null);
    expect(isCrashReportingEnabled()).toBe(false);
    getItem.mockReturnValueOnce(JSON.stringify({ privacy: { crashReports: true } }));
    expect(isCrashReportingEnabled()).toBe(true);
    getItem.mockReturnValueOnce(JSON.stringify({ privacy: { compatTelemetry: true } }));
    expect(isCrashReportingEnabled()).toBe(false);
  });
});
