/**
 * La scelta della sorgente in `captureScreen`.
 *
 * Perché esiste. Il fotogramma dal gioco è l'unica sorgente che garantisce di
 * riprendere il gioco e non la finestra che gli sta davanti: la cattura dallo
 * schermo, puntando a un gioco, ha restituito i pixel di un browser (misurato,
 * vedi `docs/METODI-DI-TRADUZIONE.md`). Questi test fissano l'ordine di
 * preferenza e — soprattutto — che il ripiego avvenga, perché un gioco non
 * agganciato deve continuare a funzionare come prima.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('@/lib/tauri-wrapper', () => ({
  safeInvoke: (...args: unknown[]) => invoke(...args),
}));

import { captureScreen, captureGameFrame, detectGameProcess } from '@/lib/ocr/screen-capture';

const FOTOGRAMMA = { image_data: 'DAL-GIOCO', width: 320, height: 240, sequence: 42 };

beforeEach(() => {
  invoke.mockReset();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('captureGameFrame', () => {
  it('passa il nome del processo al comando e restituisce il fotogramma', async () => {
    invoke.mockResolvedValueOnce(FOTOGRAMMA);
    const r = await captureGameFrame('RPG_RT.exe');
    expect(invoke).toHaveBeenCalledWith('read_game_frame', { processName: 'RPG_RT.exe' });
    expect(r).toMatchObject({ success: true, imageData: 'DAL-GIOCO', width: 320, height: 240 });
  });

  it('riporta il motivo del fallimento invece di inghiottirlo', async () => {
    invoke.mockRejectedValueOnce(new Error('processo «RPG_RT.exe» non in esecuzione'));
    const r = await captureGameFrame('RPG_RT.exe');
    expect(r.success).toBe(false);
    expect(r.error).toContain('non in esecuzione');
  });
});

describe('captureScreen: scelta della sorgente', () => {
  it('con gameProcess preferisce il gioco e NON tocca lo schermo', async () => {
    invoke.mockResolvedValueOnce(FOTOGRAMMA);
    const r = await captureScreen({ gameProcess: 'RPG_RT.exe' });

    expect(r).toMatchObject({ success: true, imageData: 'DAL-GIOCO' });
    // Una sola chiamata: se comparisse anche `check_screen_capture_available`
    // vorrebbe dire che la cattura dallo schermo parte comunque, pagandola due
    // volte e potendo restituire i pixel sbagliati.
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('read_game_frame', { processName: 'RPG_RT.exe' });
  });

  it('se il gioco non pubblica, ripiega sullo schermo', async () => {
    invoke
      .mockRejectedValueOnce(new Error('nessun fotogramma condiviso'))  // read_game_frame
      .mockResolvedValueOnce(true)                                      // check_screen_capture_available
      .mockResolvedValueOnce({ image_data: 'DALLO-SCHERMO', width: 800, height: 600 });

    const r = await captureScreen({ gameProcess: 'RPG_RT.exe' });
    expect(r).toMatchObject({ success: true, imageData: 'DALLO-SCHERMO' });
    expect(invoke.mock.calls.map((c) => c[0])).toEqual([
      'read_game_frame',
      'check_screen_capture_available',
      'capture_screen',
    ]);
  });

  it('il ripiego dice perché, invece di far sembrare tutto normale', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    invoke
      .mockRejectedValueOnce(new Error('gs-hook non è iniettato'))
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce({ image_data: 'X', width: 1, height: 1 });

    await captureScreen({ gameProcess: 'RPG_RT.exe' });
    expect(info).toHaveBeenCalledWith(expect.stringContaining('gs-hook non è iniettato'));
  });

  it('senza gameProcess il comportamento resta quello di prima', async () => {
    invoke
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce({ image_data: 'DALLO-SCHERMO', width: 800, height: 600 });

    const r = await captureScreen({});
    expect(r).toMatchObject({ success: true, imageData: 'DALLO-SCHERMO' });
    // `read_game_frame` non deve essere nemmeno tentato: chi non ha un gioco
    // agganciato non deve pagare una chiamata che fallirà sempre.
    expect(invoke.mock.calls.map((c) => c[0])).not.toContain('read_game_frame');
  });
});

describe('detectGameProcess: chi pubblica', () => {
  it('con un solo gioco lo restituisce', async () => {
    invoke.mockResolvedValueOnce([{ pid: 4242, process_name: 'RPG_RT.exe' }]);
    await expect(detectGameProcess()).resolves.toBe('RPG_RT.exe');
  });

  it('senza nessuno restituisce null', async () => {
    invoke.mockResolvedValueOnce([]);
    await expect(detectGameProcess()).resolves.toBeNull();
  });

  /**
   * Il caso che conta. Con due giochi agganciati, sceglierne uno significa
   * tradurre in silenzio quello sbagliato: la risposta giusta e' non scegliere,
   * e dirlo.
   */
  it('con due giochi NON sceglie, e spiega perche', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    invoke.mockResolvedValueOnce([
      { pid: 1, process_name: 'RPG_RT.exe' },
      { pid: 2, process_name: 'Game2.exe' },
    ]);
    await expect(detectGameProcess()).resolves.toBeNull();
    expect(info).toHaveBeenCalledWith(expect.stringContaining('RPG_RT.exe, Game2.exe'));
  });

  it('se il comando fallisce non rompe la cattura', async () => {
    invoke.mockRejectedValueOnce(new Error('comando assente'));
    await expect(detectGameProcess()).resolves.toBeNull();
  });
});
