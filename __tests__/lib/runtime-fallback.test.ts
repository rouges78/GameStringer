import { describe, it, expect } from 'vitest';

import {
  planRuntimeFallback,
  buildRunReport,
  summarizeRunReport,
  runtimePlanMessageKey,
  type RuntimeContext,
} from '@/lib/translation/runtime-fallback';

/** Contesto "tutto a posto": il caso base è il runtime percorribile. */
function ctx(over: Partial<RuntimeContext> = {}): RuntimeContext {
  return {
    staticOutcome: 'failure',
    isWindows: true,
    hookAvailable: true,
    processName: 'Game.exe',
    processRunning: true,
    ...over,
  };
}

describe('planRuntimeFallback', () => {
  it('non fa niente se la strada statica è riuscita', () => {
    expect(planRuntimeFallback(ctx({ staticOutcome: 'success' }))).toEqual({ action: 'none' });
  });

  it('non fa niente su un successo parziale', () => {
    // Il gioco è stato modificato: sovrapporre il runtime mostrerebbe due
    // traduzioni della stessa riga.
    expect(planRuntimeFallback(ctx({ staticOutcome: 'partial' }))).toEqual({ action: 'none' });
  });

  it('inietta quando il gioco è in esecuzione', () => {
    expect(planRuntimeFallback(ctx())).toEqual({ action: 'inject', processName: 'Game.exe' });
  });

  it('chiede di avviare il gioco se è chiuso', () => {
    expect(planRuntimeFallback(ctx({ processRunning: false }))).toEqual({
      action: 'await-launch',
      processName: 'Game.exe',
    });
  });

  it('fuori da Windows non propone niente', () => {
    expect(planRuntimeFallback(ctx({ isWindows: false }))).toEqual({
      action: 'unavailable',
      blocker: 'not-windows',
    });
  });

  it('senza le DLL gs-hook non propone niente', () => {
    expect(planRuntimeFallback(ctx({ hookAvailable: false }))).toEqual({
      action: 'unavailable',
      blocker: 'hook-missing',
    });
  });

  it('rispetta il gate anti-cheat', () => {
    expect(planRuntimeFallback(ctx({ antiCheatBlocked: true }))).toEqual({
      action: 'unavailable',
      blocker: 'anti-cheat',
    });
  });

  it('senza nome del processo non sa cosa iniettare', () => {
    expect(planRuntimeFallback(ctx({ processName: null }))).toEqual({
      action: 'unavailable',
      blocker: 'unknown-process',
    });
  });

  it('i motivi strutturali battono il gioco chiuso', () => {
    // Dire "avvia il gioco" quando l'anti-cheat vieta comunque l'iniezione
    // manda l'utente a sbattere: si dice "qui non si può" e basta.
    expect(
      planRuntimeFallback(ctx({ processRunning: false, antiCheatBlocked: true })),
    ).toEqual({ action: 'unavailable', blocker: 'anti-cheat' });
  });

  it('la piattaforma batte ogni altro blocco', () => {
    expect(
      planRuntimeFallback(
        ctx({ isWindows: false, hookAvailable: false, processName: null }),
      ),
    ).toEqual({ action: 'unavailable', blocker: 'not-windows' });
  });
});

describe('runtimePlanMessageKey', () => {
  it('non dà messaggio quando non c\'è niente da dire', () => {
    expect(runtimePlanMessageKey({ action: 'none' })).toBe('');
  });

  it('distingue il blocco per motivo', () => {
    expect(runtimePlanMessageKey({ action: 'unavailable', blocker: 'anti-cheat' })).toBe(
      'gameDetail.runtimeFallbackBlocked.anti-cheat',
    );
    expect(runtimePlanMessageKey({ action: 'unavailable', blocker: 'hook-missing' })).toBe(
      'gameDetail.runtimeFallbackBlocked.hook-missing',
    );
  });
});

describe('buildRunReport', () => {
  it('registra runtime fra le strade tentate solo se si inietta davvero', () => {
    const injected = buildRunReport({
      gameTitle: 'Gioco',
      staticOutcome: 'failure',
      plan: { action: 'inject', processName: 'Game.exe' },
    });
    expect(injected.attempted).toEqual(['static', 'runtime']);

    const waiting = buildRunReport({
      gameTitle: 'Gioco',
      staticOutcome: 'failure',
      plan: { action: 'await-launch', processName: 'Game.exe' },
    });
    expect(waiting.attempted).toEqual(['static']);
  });

  it('tiene "non misurato" distinto da zero', () => {
    const unmeasured = buildRunReport({
      gameTitle: 'Gioco',
      staticOutcome: 'failure',
      plan: { action: 'none' },
    });
    expect(unmeasured.stringsInjected).toBeNull();
    expect(unmeasured.stringsTotal).toBeNull();

    const zero = buildRunReport({
      gameTitle: 'Gioco',
      staticOutcome: 'failure',
      stringsInjected: 0,
      stringsTotal: 1200,
      plan: { action: 'none' },
    });
    expect(zero.stringsInjected).toBe(0);
  });

  it('porta la chiave del passo successivo', () => {
    const r = buildRunReport({
      gameTitle: 'Gioco',
      staticOutcome: 'failure',
      plan: { action: 'await-launch', processName: 'Game.exe' },
    });
    expect(r.nextStepKey).toBe('gameDetail.runtimeFallbackAwaitLaunch');
  });
});

describe('summarizeRunReport', () => {
  it('dice le stringhe scritte, non gli stadi completati', () => {
    const r = buildRunReport({
      gameTitle: 'Gioco',
      staticOutcome: 'failure',
      stringsInjected: 0,
      stringsTotal: 1679,
      plan: { action: 'inject', processName: 'Game.exe' },
    });
    expect(summarizeRunReport(r)).toBe('0/1679 stringhe scritte — passato alla traduzione a runtime');
  });

  it('non finge conteggi che non ha', () => {
    const r = buildRunReport({
      gameTitle: 'Gioco',
      staticOutcome: 'failure',
      plan: { action: 'unavailable', blocker: 'not-windows' },
    });
    expect(summarizeRunReport(r)).toBe('conteggi non disponibili — runtime non disponibile (not-windows)');
  });
});
