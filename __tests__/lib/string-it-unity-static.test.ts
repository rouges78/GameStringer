import { describe, it, expect, vi } from 'vitest';

import {
  runUnityStaticTranslation,
  type UnityStaticDeps,
  type UnityStaticEntry,
  type UnityStaticProbe,
  type UnityStaticReport,
} from '@/lib/string-it/unity-static';

const ENTRIES: UnityStaticEntry[] = [
  { key: 'Play', text: 'Play' },
  { key: 'Exit', text: 'Exit' },
  { key: 'Back', text: 'Return' },
  { key: 'Return', text: 'Return' },
  { key: 'Empty', text: '' },
];

function probe(over: Partial<UnityStaticProbe> = {}): UnityStaticProbe {
  return {
    family: 'GAME',
    languages: ['en', 'lt', 'fr'],
    baked_languages: ['lt', 'fr'],
    replace_language: 'lt',
    replace_language_name: 'Lithuanian',
    baked_texts_found: 7,
    source_language: 'en',
    entries: ENTRIES,
    ...over,
  };
}

const REPORT: UnityStaticReport = {
  strings_replaced: 3,
  entries_translated: 3,
  entries_skipped: 1,
  files_changed: ['level0'],
  select_language: 'Lithuanian',
  backup_path: 'x.gs_backup',
};

function deps(over: Partial<UnityStaticDeps> = {}): UnityStaticDeps & { apply: ReturnType<typeof vi.fn> } {
  return {
    probe: vi.fn(async () => probe()),
    apply: vi.fn(async () => REPORT),
    ...over,
  } as UnityStaticDeps & { apply: ReturnType<typeof vi.fn> };
}

const IT: Record<string, string> = { Play: 'Gioca', Exit: 'Esci', Return: 'Indietro' };
const translateAll = async (texts: string[]) => texts.map(t => IT[t] ?? null);

describe('metodo statico Unity', () => {
  it('sonda, traduce ogni testo una volta e scrive per chiave', async () => {
    const d = deps();
    const translate = vi.fn(translateAll);
    const phases: string[] = [];
    const out = await runUnityStaticTranslation({
      gamePath: 'C:/game', targetLang: 'it', translate, onPhase: p => phases.push(p), deps: d,
    });

    expect(out.status).toBe('done');
    expect(phases).toEqual(['probing', 'translating', 'writing']);
    // «Return» sta sotto due chiavi ma si traduce una volta; il testo vuoto non parte
    expect(translate).toHaveBeenCalledWith(['Play', 'Exit', 'Return'], 'en');
    expect(d.apply).toHaveBeenCalledWith('C:/game', 'it', [
      { key: 'Play', text: 'Gioca' },
      { key: 'Exit', text: 'Esci' },
      { key: 'Back', text: 'Indietro' },
      { key: 'Return', text: 'Indietro' },
    ]);
    if (out.status === 'done') {
      expect(out.report.select_language).toBe('Lithuanian');
      expect([out.translated, out.total]).toEqual([3, 3]);
    }
  });

  it('se la sonda dice no, il metodo non si applica e non si traduce nulla', async () => {
    const translate = vi.fn(translateAll);
    const d = deps({ probe: async () => { throw 'il gioco ha già la lingua «it»'; } });
    const out = await runUnityStaticTranslation({ gamePath: 'g', targetLang: 'it', translate, deps: d });
    expect(out).toEqual({ status: 'not-applicable', reason: 'il gioco ha già la lingua «it»' });
    expect(translate).not.toHaveBeenCalled();
    expect(d.apply).not.toHaveBeenCalled();
  });

  it('una traduzione uguale all\'originale o mancante non viene scritta', async () => {
    const d = deps();
    const translate = async (texts: string[]) => texts.map(t => (t === 'Exit' ? 'Exit' : t === 'Return' ? null : IT[t]));
    // 1 su 3: sotto la metà → non si scrive
    const out = await runUnityStaticTranslation({ gamePath: 'g', targetLang: 'it', translate, deps: d });
    expect(out.status).toBe('failed');
    expect(d.apply).not.toHaveBeenCalled();
  });

  it('con più della metà dei testi tradotti scrive solo quelli', async () => {
    const d = deps();
    const translate = async (texts: string[]) => texts.map(t => (t === 'Exit' ? null : IT[t]));
    const out = await runUnityStaticTranslation({ gamePath: 'g', targetLang: 'it', translate, deps: d });
    expect(out.status).toBe('done');
    expect(d.apply).toHaveBeenCalledWith('g', 'it', [
      { key: 'Play', text: 'Gioca' },
      { key: 'Back', text: 'Indietro' },
      { key: 'Return', text: 'Indietro' },
    ]);
  });

  it('un errore di traduzione o di scrittura è un fallimento, non un "non applicabile"', async () => {
    const boom = await runUnityStaticTranslation({
      gamePath: 'g', targetLang: 'it', translate: async () => { throw new Error('Ollama spento'); }, deps: deps(),
    });
    expect(boom.status).toBe('failed');

    const d = deps({ apply: async () => { throw 'nessuna stringa da sostituire'; } });
    const write = await runUnityStaticTranslation({ gamePath: 'g', targetLang: 'it', translate: translateAll, deps: d });
    expect(write).toEqual({ status: 'failed', reason: 'nessuna stringa da sostituire' });
  });

  it('senza testi da tradurre il metodo non si applica', async () => {
    const d = deps({ probe: async () => probe({ entries: [{ key: 'Empty', text: '  ' }] }) });
    const out = await runUnityStaticTranslation({ gamePath: 'g', targetLang: 'it', translate: translateAll, deps: d });
    expect(out.status).toBe('not-applicable');
  });
});
