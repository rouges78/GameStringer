import { describe, it, expect } from 'vitest';
import {
  toOverlayTexts,
  toCssBox,
  isOcrLanguageMissing,
  OCR_OVERLAY_TEXTS_EVENT,
  OCR_OVERLAY_VISIBILITY_EVENT,
} from '@/lib/ocr-overlay-payload';

describe('ocr-overlay-payload', () => {
  it('uses the event names the overlay window listens to', () => {
    expect(OCR_OVERLAY_TEXTS_EVENT).toBe('ocr-translations');
    expect(OCR_OVERLAY_VISIBILITY_EVENT).toBe('overlay-visibility');
  });

  it('converts backend DetectedText into overlay texts, keeping only translated ones', () => {
    const out = toOverlayTexts([
      { text: 'New Game', translated: 'Nuova Partita', x: 309, y: 124, width: 175, height: 26 },
      { text: 'Continue', translated: null, x: 1, y: 2, width: 3, height: 4 },
      { text: 'Options', translated: '   ', x: 1, y: 2, width: 3, height: 4 },
      { text: 'Quit' },
    ]);
    expect(out).toEqual([
      { original: 'New Game', translated: 'Nuova Partita', x: 309, y: 124, width: 175, height: 26 },
    ]);
  });

  it('defaults missing coordinates to 0 (VLM block without a box)', () => {
    expect(toOverlayTexts([{ text: 'a', translated: 'b' }])).toEqual([
      { original: 'a', translated: 'b', x: 0, y: 0, width: 0, height: 0 },
    ]);
  });

  it('turns physical pixels into CSS pixels using the device pixel ratio', () => {
    const t = { original: 'a', translated: 'b', x: 300, y: 150, width: 450, height: 30 };
    expect(toCssBox(t, 1.5)).toEqual({ left: 200, top: 100, width: 300, height: 20 });
    expect(toCssBox(t, 1)).toEqual({ left: 300, top: 150, width: 450, height: 30 });
    // A broken ratio must not produce Infinity/NaN positions.
    expect(toCssBox(t, 0)).toEqual({ left: 300, top: 150, width: 450, height: 30 });
  });

  it('recognises the backend "language pack missing" error, as string or Error', () => {
    const msg = "OCR_LANGUAGE_NOT_INSTALLED: Windows has no text recognition (OCR) for 'ja'.";
    expect(isOcrLanguageMissing(msg)).toBe(true);
    expect(isOcrLanguageMissing(new Error(msg))).toBe(true);
    expect(isOcrLanguageMissing('Failed to get screen DC')).toBe(false);
    expect(isOcrLanguageMissing(undefined)).toBe(false);
  });
});
