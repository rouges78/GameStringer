/**
 * Test del ponte di persistenza delle impostazioni (lib/settings-persistence.ts).
 *
 * Perché esiste questo file, scritto il 04/08/2026: leggendo il codice sono
 * saltati fuori due modi di PERDERE le API key senza che nessuno se ne accorga.
 * Nessuno dei due si vede provando l'app a mano, perché entrambi hanno l'aria
 * di aver funzionato. Qui sono fissati come test, così se qualcuno rimette il
 * comportamento di prima la suite lo dice.
 *
 * 1. Il flush anticipato: SettingsBootGate monta l'app dopo 1,5 s comunque, e
 *    registra persistSettingsToDisk() su visibilitychange/beforeunload. Se
 *    l'utente cambiava finestra mentre load_app_settings era ancora in volo,
 *    su settings.json finiva un localStorage NON idratato — vuoto — e le
 *    impostazioni buone sparivano. Nessun errore, nessun log.
 *
 * 2. (coperto in settings-reset.test è impossibile senza montare la pagina:
 *    il Reset è verificato qui a livello di contratto — dopo un reset il disco
 *    deve essere {} — vedi il caso "il disco vuoto non viene resuscitato".)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@/lib/tauri-api', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  isTauri: () => true,
}));

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const LS_KEY = 'gameStringerSettings';

/** Il modulo tiene lo stato di hydration a livello di modulo: va reimportato pulito. */
async function freshModule() {
  vi.resetModules();
  return import('@/lib/settings-persistence');
}

beforeEach(() => {
  invokeMock.mockReset();
  localStorage.clear();
});

describe('persistSettingsToDisk — non deve scrivere prima dell hydration', () => {
  it('NON chiama save_app_settings se l hydration non è ancora conclusa', async () => {
    const mod = await freshModule();

    // Scenario reale: l'app è montata (timeout di 1,5 s scaduto) ma
    // load_app_settings non ha ancora risposto, quindi localStorage è vuoto.
    expect(mod.isHydrationSettled()).toBe(false);

    await mod.persistSettingsToDisk();

    // Il difetto di prima: qui partiva save_app_settings con {} e cancellava
    // le impostazioni su disco.
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('scrive su disco una volta che l hydration è conclusa', async () => {
    const mod = await freshModule();

    // load_app_settings risponde: disco vuoto, localStorage con una chiave.
    localStorage.setItem(LS_KEY, JSON.stringify({ translation: { openaiApiKey: 'sk-vera' } }));
    invokeMock.mockImplementation((cmd: string) =>
      cmd === 'load_app_settings' ? Promise.resolve({}) : Promise.resolve(undefined),
    );

    await mod.hydrateSettingsFromDisk();
    expect(mod.isHydrationSettled()).toBe(true);

    invokeMock.mockClear();
    await mod.persistSettingsToDisk();

    expect(invokeMock).toHaveBeenCalledWith('save_app_settings', {
      settings: { translation: { openaiApiKey: 'sk-vera' } },
    });
  });

  it('sblocca il flush anche se l hydration FALLISCE', async () => {
    const mod = await freshModule();
    localStorage.setItem(LS_KEY, JSON.stringify({ translation: { openaiApiKey: 'sk-vera' } }));

    // Ambiente non-Tauri o disco irraggiungibile: invoke lancia.
    invokeMock.mockRejectedValue(new Error('no tauri'));
    await mod.hydrateSettingsFromDisk();

    // Se restasse bloccato per sempre, un utente in browser non salverebbe MAI.
    expect(mod.isHydrationSettled()).toBe(true);
  });
});

describe('hydrateSettingsFromDisk', () => {
  it('il disco vince, ma non cancella le chiavi presenti solo in localStorage', async () => {
    const mod = await freshModule();
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ translation: { openaiApiKey: 'sk-locale', deeplApiKey: 'dl-solo-locale' } }),
    );
    invokeMock.mockImplementation((cmd: string) =>
      cmd === 'load_app_settings'
        ? Promise.resolve({ translation: { openaiApiKey: 'sk-disco' } })
        : Promise.resolve(undefined),
    );

    await mod.hydrateSettingsFromDisk();

    const merged = JSON.parse(localStorage.getItem(LS_KEY)!);
    expect(merged.translation.openaiApiKey).toBe('sk-disco');       // il disco è la verità
    expect(merged.translation.deeplApiKey).toBe('dl-solo-locale');  // ma non si perde nulla
  });

  it('il disco vuoto NON viene resuscitato da localStorage: dopo un Reset resta vuoto', async () => {
    // Questo è il contratto che rende onesto il pulsante Reset della pagina
    // Impostazioni. Prima del 04/08 il Reset faceva solo removeItem: al riavvio
    // il disco era ancora pieno e ricopiava tutto indietro, API key comprese.
    // Ora il Reset svuota il disco; qui verifichiamo che un disco vuoto +
    // localStorage vuoto non facciano ricomparire nulla.
    const mod = await freshModule();
    invokeMock.mockImplementation((cmd: string) =>
      cmd === 'load_app_settings' ? Promise.resolve({}) : Promise.resolve(undefined),
    );

    await mod.hydrateSettingsFromDisk();

    expect(localStorage.getItem(LS_KEY)).toBeNull();
    expect(invokeMock).not.toHaveBeenCalledWith('save_app_settings', expect.anything());
  });

  it('migra una-tantum localStorage → disco quando il disco è vuoto', async () => {
    const mod = await freshModule();
    localStorage.setItem(LS_KEY, JSON.stringify({ translation: { apiKey: 'gemini-1' } }));
    invokeMock.mockImplementation((cmd: string) =>
      cmd === 'load_app_settings' ? Promise.resolve({}) : Promise.resolve(undefined),
    );

    await mod.hydrateSettingsFromDisk();

    expect(invokeMock).toHaveBeenCalledWith('save_app_settings', {
      settings: { translation: { apiKey: 'gemini-1' } },
    });
  });

  it('gira una volta sola', async () => {
    const mod = await freshModule();
    invokeMock.mockResolvedValue({});

    await mod.hydrateSettingsFromDisk();
    const dopoIlPrimo = invokeMock.mock.calls.length;
    await mod.hydrateSettingsFromDisk();

    expect(invokeMock.mock.calls.length).toBe(dopoIlPrimo);
  });
});
