/**
 * Ingrandimento del fotogramma prima dell'OCR.
 *
 * Perché esiste. Misurato su Yume Nikki: Tesseract.js su un fotogramma nativo
 * 320x240 legge **zero** righe, e lo stesso fotogramma ingrandito ne legge
 * otto. Questi test fissano il fattore — intero, con un tetto — e soprattutto
 * il ritorno in scala dei riquadri, che è il pezzo che sbaglia in silenzio:
 * l'overlay comparirebbe comunque, solo a distanza multipla dal testo.
 */
import { describe, it, expect } from 'vitest';
import {
  upscaleFactorFor,
  scaleBoxBack,
  OCR_MAX_FACTOR,
  OCR_TARGET_LONG_SIDE,
} from '@/lib/ocr/upscale-for-ocr';

describe('upscaleFactorFor', () => {
  it('porta un fotogramma retro sopra la soglia utile', () => {
    // Il caso misurato: 320x240 -> x6 -> 1920x1440, dove «New Game» esce giusto.
    expect(upscaleFactorFor(320, 240)).toBe(6);
  });

  it('non ingrandisce ciò che è già grande', () => {
    expect(upscaleFactorFor(1920, 1080)).toBe(1);
    expect(upscaleFactorFor(2560, 1440)).toBe(1);
  });

  it('usa il lato LUNGO, non la larghezza', () => {
    // Una finestra alta e stretta è comunque leggibile se il lato lungo basta.
    expect(upscaleFactorFor(200, OCR_TARGET_LONG_SIDE)).toBe(1);
  });

  it('resta intero: un fattore frazionario obbligherebbe a interpolare', () => {
    for (const [w, h] of [[640, 480], [800, 600], [1024, 768], [333, 251]]) {
      expect(Number.isInteger(upscaleFactorFor(w, h))).toBe(true);
    }
  });

  it('non supera il tetto, anche su immagini minuscole', () => {
    expect(upscaleFactorFor(16, 16)).toBe(OCR_MAX_FACTOR);
  });

  it('su dimensioni assurde non moltiplica per zero né esplode', () => {
    expect(upscaleFactorFor(0, 0)).toBe(1);
    expect(upscaleFactorFor(-5, 10)).toBe(1);
    expect(upscaleFactorFor(NaN, 240)).toBe(1);
  });
});

describe('scaleBoxBack', () => {
  it('riporta il riquadro nello spazio originale', () => {
    expect(scaleBoxBack({ x0: 60, y0: 120, x1: 180, y1: 240 }, 6)).toEqual({
      x0: 10,
      y0: 20,
      x1: 30,
      y1: 40,
    });
  });

  it('con fattore 1 non tocca niente', () => {
    const b = { x0: 1, y0: 2, x1: 3, y1: 4 };
    expect(scaleBoxBack(b, 1)).toBe(b);
  });

  /**
   * Il difetto che questi test esistono per impedire: dimenticare il ritorno in
   * scala. Il riquadro resterebbe valido come numeri — e finirebbe fuori dal
   * fotogramma, dove l'overlay non copre più il testo.
   */
  it('senza il ritorno in scala il riquadro esce dal fotogramma', () => {
    const fattore = 6;
    const larghezzaOriginale = 320;
    const nelloSpazioIngrandito = { x0: 900, y0: 60, x1: 1100, y1: 100 };

    expect(nelloSpazioIngrandito.x1).toBeGreaterThan(larghezzaOriginale);
    const riportato = scaleBoxBack(nelloSpazioIngrandito, fattore);
    expect(riportato.x1).toBeLessThanOrEqual(larghezzaOriginale);
  });
});
