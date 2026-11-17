import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake BatchTranslator: start() resolves only when release() or cancel() is called,
// so the test controls when a "paid batch" finishes.
const fake = vi.hoisted(() => ({
  instances: [] as Array<{
    cancelled: boolean;
    progressCb?: (p: unknown) => void;
    itemCb?: (i: unknown) => void;
    release: () => void;
  }>,
}));

vi.mock('@/lib/batch/batch-translator', () => {
  class BatchTranslator {
    cancelled = false;
    progressCb?: (p: unknown) => void;
    itemCb?: (i: unknown) => void;
    release: () => void = () => {};
    private items: Array<{ sourceText: string; key?: string }> = [];
    constructor() {
      fake.instances.push(this);
    }
    createJob(items: Array<{ text: string; key?: string }>) {
      this.items = items.map(i => ({ sourceText: i.text, key: i.key }));
    }
    onProgress(cb: (p: unknown) => void) { this.progressCb = cb; }
    onItemComplete(cb: (i: unknown) => void) { this.itemCb = cb; }
    cancel() { this.cancelled = true; this.release(); }
    start() {
      return new Promise(resolve => {
        this.release = () => resolve({
          items: this.items.map(i => ({
            status: 'completed',
            sourceText: i.sourceText,
            translatedText: `IT:${i.sourceText}`,
            metadata: { key: i.key },
          })),
        });
      });
    }
  }
  return { BatchTranslator };
});

vi.mock('@/lib/file-parsers', () => ({
  writeFile: (_r: unknown, translations: Map<string, string>) =>
    JSON.stringify(Object.fromEntries(translations)),
}));

import { translateFileCancellable } from '@/components/translator-pro/translate-file-cancellable';
import {
  localizationTargetFilename,
  isAbsolutePath,
  buildXUnityDictionary,
} from '@/components/translator-pro/apply-to-game';
import type { ParseResult } from '@/lib/file-parsers';

const parseResult = {
  format: 'json',
  strings: [{ key: 'menu.start', value: 'Start' }],
  metadata: {},
} as unknown as ParseResult;

const baseOptions = { sourceLanguage: 'en', targetLanguage: 'it', provider: 'openai' as const };

describe('translateFileCancellable', () => {
  beforeEach(() => { fake.instances.length = 0; });

  it('returns the translated content when not aborted', async () => {
    const controller = new AbortController();
    const pending = translateFileCancellable(parseResult, 'ui.json', baseOptions, controller.signal);
    fake.instances[0].release();
    const result = await pending;
    expect(result?.translatedContent).toBe(JSON.stringify({ 'menu.start': 'IT:Start' }));
  });

  it('abort cancels the BatchTranslator and returns null', async () => {
    const controller = new AbortController();
    const pending = translateFileCancellable(parseResult, 'ui.json', baseOptions, controller.signal);
    controller.abort();
    expect(fake.instances[0].cancelled).toBe(true);
    expect(await pending).toBeNull();
  });

  it('does not start a translator when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await translateFileCancellable(parseResult, 'ui.json', baseOptions, controller.signal)).toBeNull();
    expect(fake.instances).toHaveLength(0);
  });

  it('drops callbacks that arrive after the abort', async () => {
    const controller = new AbortController();
    const onItemComplete = vi.fn();
    const onProgress = vi.fn();
    const pending = translateFileCancellable(
      parseResult, 'ui.json', { ...baseOptions, onItemComplete, onProgress }, controller.signal,
    );
    const translator = fake.instances[0];
    translator.itemCb?.({ id: 'a' });
    translator.progressCb?.({ completed: 1 });
    controller.abort();
    translator.itemCb?.({ id: 'b' });
    translator.progressCb?.({ completed: 2 });
    await pending;
    expect(onItemComplete).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledTimes(1);
  });
});

describe('localizationTargetFilename (mirrors apply_translation_file)', () => {
  it('replaces en-US / en_US with the target pair', () => {
    expect(localizationTargetFilename('en-US.json', 'json', 'it')).toBe('it-IT.json');
    expect(localizationTargetFilename('strings_en_US.txt', 'txt', 'de')).toBe('strings_de_DE.txt');
  });
  it('replaces english in the lowercased name', () => {
    expect(localizationTargetFilename('English.xml', 'xml', 'it')).toBe('it.xml');
  });
  it('falls back to <lang>.<format>', () => {
    expect(localizationTargetFilename('en.json', 'json', 'it')).toBe('it.json');
    expect(localizationTargetFilename(undefined, 'csv', 'fr')).toBe('fr.csv');
  });
});

describe('isAbsolutePath', () => {
  it('accepts real disk paths only', () => {
    expect(isAbsolutePath('C:\\Games\\X\\Languages\\en.json')).toBe(true);
    expect(isAbsolutePath('D:/Games/X/en.json')).toBe(true);
    expect(isAbsolutePath('\\\\nas\\games\\en.json')).toBe(true);
    expect(isAbsolutePath('/home/u/games/en.json')).toBe(true);
    expect(isAbsolutePath('en.json')).toBe(false);
    expect(isAbsolutePath('MyGame/Data/en.json')).toBe(false);
  });
});

describe('buildXUnityDictionary', () => {
  it('builds escaped original=translation lines from translated strings', () => {
    expect(buildXUnityDictionary([
      { sourceText: 'Start', translatedText: 'Inizia' },
      { sourceText: 'HP=10', translatedText: 'PV=10' },
      { sourceText: 'Line1\nLine2', translatedText: 'Riga1\nRiga2' },
    ])).toEqual([
      'Start=Inizia',
      'HP\\=10=PV\\=10',
      'Line1\\nLine2=Riga1\\nRiga2',
    ]);
  });
  it('skips empty, untranslated and duplicate entries', () => {
    expect(buildXUnityDictionary([
      { sourceText: 'Start', translatedText: 'Inizia' },
      { sourceText: 'Start', translatedText: 'Avvia' },
      { sourceText: 'OK', translatedText: 'OK' },
      { sourceText: '', translatedText: 'x' },
      { sourceText: 'Quit', translatedText: '' },
    ])).toEqual(['Start=Inizia']);
  });
});
