import { describe, it, expect, vi } from 'vitest';

import { runXUnityAiTranslation, type XUnityAiDeps, type XUnityEntry } from '@/lib/string-it/xunity-ai';

const CAPTURED: XUnityEntry[] = [
  { original: 'New Game', translated: 'Nieuw spel', line_number: 1 },
  { original: 'Options', translated: '', line_number: 2 },
  { original: 'Quit', translated: 'Quit', line_number: 3 },
  { original: 'New Game', translated: 'Nieuw spel', line_number: 4 },
  { original: '   ', translated: '', line_number: 5 },
];

function deps(over: Partial<XUnityAiDeps> = {}) {
  return {
    readCaptured: vi.fn(async () => CAPTURED),
    write: vi.fn(async () => 'C:/game/BepInEx/Translation/nl/Text/Game.txt'),
    ...over,
  };
}

const NL: Record<string, string> = { 'New Game': 'Nieuw spel (AI)', Options: 'Opties', Quit: 'Afsluiten' };
const translateAll = async (texts: string[]) => texts.map(t => NL[t] ?? null);

const base = { gamePath: 'C:/game', lang: 'nl', gameName: 'Game' };

describe('ritraduzione AI dei testi catturati da XUnity', () => {
  it('ritraduce ogni testo una volta, anche quelli già tradotti da Google', async () => {
    const d = deps();
    const translate = vi.fn(translateAll);
    const out = await runXUnityAiTranslation({ ...base, translate, deps: d });

    expect(translate).toHaveBeenCalledWith(['New Game', 'Options', 'Quit']);
    expect(d.write).toHaveBeenCalledWith('C:/game', 'nl', 'Game', [
      { original: 'New Game', translated: 'Nieuw spel (AI)', line_number: 0 },
      { original: 'Options', translated: 'Opties', line_number: 0 },
      { original: 'Quit', translated: 'Afsluiten', line_number: 0 },
    ]);
    expect(out).toMatchObject({ status: 'done', changed: 3, failed: 0, total: 3 });
  });

  it('non scrive le traduzioni mancanti o uguali all\'originale, e le conta', async () => {
    const d = deps();
    const out = await runXUnityAiTranslation({
      ...base,
      translate: async texts => texts.map(t => (t === 'Options' ? 'Opties' : t === 'Quit' ? ' Quit ' : null)),
      deps: d,
    });
    expect(d.write.mock.calls[0][3]).toEqual([{ original: 'Options', translated: 'Opties', line_number: 0 }]);
    expect(out).toMatchObject({ status: 'done', changed: 1, failed: 2, total: 3 });
  });

  it('senza nemmeno una traduzione non tocca il gioco', async () => {
    const d = deps();
    const out = await runXUnityAiTranslation({ ...base, translate: async texts => texts.map(() => null), deps: d });
    expect(out.status).toBe('failed');
    expect(d.write).not.toHaveBeenCalled();
  });

  it('senza testi catturati, o senza file, chiede di giocare prima', async () => {
    const translate = vi.fn(translateAll);
    expect(await runXUnityAiTranslation({ ...base, translate, deps: deps({ readCaptured: async () => [] }) }))
      .toEqual({ status: 'no-captures' });
    expect(await runXUnityAiTranslation({
      ...base, translate, deps: deps({ readCaptured: async () => { throw new Error('File traduzioni non trovato'); } }),
    })).toEqual({ status: 'no-captures' });
    expect(translate).not.toHaveBeenCalled();
  });

  it('un errore della traduzione o della scrittura è un fallimento, non un successo', async () => {
    expect(await runXUnityAiTranslation({
      ...base, translate: async () => { throw new Error('rate limit'); }, deps: deps(),
    })).toMatchObject({ status: 'failed', reason: expect.stringContaining('rate limit') });
    expect(await runXUnityAiTranslation({
      ...base, translate: translateAll, deps: deps({ write: async () => { throw new Error('disco pieno'); } }),
    })).toMatchObject({ status: 'failed', reason: expect.stringContaining('disco pieno') });
  });
});
