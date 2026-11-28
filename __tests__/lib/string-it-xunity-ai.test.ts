import { describe, it, expect, vi } from 'vitest';

import { runXUnityAiTranslation, labelLimit, labelThreshold, type XUnityAiDeps, type XUnityEntry } from '@/lib/string-it/xunity-ai';

const CAPTURED: XUnityEntry[] = [
  { original: 'New Game', translated: 'Nieuw spel', line_number: 1 },
  { original: 'Options', translated: '', line_number: 2 },
  { original: 'Quit', translated: 'Stoppen', line_number: 3 },
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

    expect(translate).toHaveBeenCalledWith(['New Game', 'Options', 'Quit'], expect.stringContaining('"Options"'));
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

  it('le righe di soli tag non vanno all\'AI e si riscrivono uguali, coprendo quelle rotte da Google', async () => {
    // Visto su The Séance of Blake Manor: Google ha scritto `<indice sprite=69 tinta=1>`.
    const d = deps({
      readCaptured: async () => [
        { original: '<sprite index=69 tint=1>', translated: '<indice sprite=69 tinta=1>', line_number: 1 },
        { original: '{Submit}', translated: '{Invia}', line_number: 2 },
        { original: '<sprite index=6 tint=1> Back', translated: '<sprite index=6 tint=1> Indietro', line_number: 3 },
      ],
    });
    const translate = vi.fn(async (texts: string[]) => texts.map(() => '<sprite index=6 tint=1> Indietro'));
    const out = await runXUnityAiTranslation({ ...base, translate, deps: d });

    expect(translate).toHaveBeenCalledWith(['<sprite index=6 tint=1> Back'], expect.any(String));
    expect(d.write.mock.calls[0][3]).toEqual([
      { original: '<sprite index=69 tint=1>', translated: '<sprite index=69 tint=1>', line_number: 0 },
      { original: '{Submit}', translated: '{Submit}', line_number: 0 },
      { original: '<sprite index=6 tint=1> Back', translated: '<sprite index=6 tint=1> Indietro', line_number: 0 },
    ]);
    expect(out).toMatchObject({ status: 'done', changed: 3, failed: 0, total: 3 });
  });

  it('scarta la traduzione che perde o cambia un tag', async () => {
    const d = deps({
      readCaptured: async () => [
        { original: '<b>Quit</b> game?', translated: '', line_number: 1 },
        { original: '<sprite index=7 tint=1> Defaults', translated: '', line_number: 2 },
        { original: 'Actions in the <color=#b17e0f>Mindmap</color>.', translated: '', line_number: 3 },
      ],
    });
    const out = await runXUnityAiTranslation({
      ...base,
      translate: async () => [
        'Uscire dal gioco?',
        '<indice sprite=7 tinta=1> Predefiniti',
        // Visto su Blake Manor: stessi tag, ma la parola è uscita dal <color>.
        'Azioni nella mappa mentale <color=#b17e0f></color>.',
      ],
      deps: d,
    });
    expect(d.write).not.toHaveBeenCalled();
    expect(out.status).toBe('failed');
  });

  it('chiede di nuovo le traduzioni che rompono tag o parentesi, e scarta quelle ancora rotte', async () => {
    // Blake Manor: la guardia dei segnaposto ha riattaccato `[ASK ABOUT …]` in
    // inglese, e un `[[T1]]` storpiato ha lasciato «Premi [».
    const press = '<color=#D3991E>Press <color=#FFFFFF>{InteractionA}</color> to proceed.</color>';
    const ask = "2. [ASK ABOUT MISSUS MANTOVANI'S INVITATION]";
    const d = deps({
      readCaptured: async () => [
        { original: press, translated: '', line_number: 1 },
        { original: ask, translated: '', line_number: 2 },
        { original: 'Credits', translated: 'Crediti', line_number: 3 },
      ],
    });
    const broken = "2. [CHIEDERE DELL'INVITO DELLA SIGNORA MANTOVANI] [ASK ABOUT MISSUS MANTOVANI'S INVITATION]";
    const translate = vi.fn(async (texts: string[]) => (texts.length > 1
      ? ['<color=#D3991E>Premi [<color=#FFFFFF>{InteractionA}</color> per procedere.</color>', broken, 'Crediti']
      : texts[0] === press ? ['<color=#D3991E>Premi <color=#FFFFFF>{InteractionA}</color> per procedere.</color>'] : [broken]));
    const out = await runXUnityAiTranslation({ ...base, translate, deps: d });

    expect(translate.mock.calls.slice(1).map(c => c[0])).toEqual([[press], [ask]]);
    expect(translate.mock.calls[1][1]).toBe(translate.mock.calls[0][1]);
    expect(d.write.mock.calls[0][3]).toEqual([
      { original: press, translated: '<color=#D3991E>Premi <color=#FFFFFF>{InteractionA}</color> per procedere.</color>', line_number: 0 },
      { original: 'Credits', translated: 'Crediti', line_number: 0 },
    ]);
    expect(out).toMatchObject({ status: 'done', changed: 2, failed: 1 });
  });

  it('le righe che Google ha lasciato uguali restano uguali e non vanno all\'AI', async () => {
    // Blake Manor: «Inv» e «Fre» sono Invio e Freccia, già italiano; l'AI li rendeva «Gioca» e «Libro».
    const d = deps({
      readCaptured: async () => [
        { original: '<b>Inv</b>', translated: '<b>Inv</b>', line_number: 1 },
        { original: '<b>Fre</b> / <sprite index=20 tint=1>', translated: '<b>Fre</b> / <sprite index=20 tint=1>', line_number: 2 },
        { original: 'VSync', translated: 'VSync', line_number: 3 },
        { original: 'Options', translated: 'Opzioni', line_number: 4 },
      ],
    });
    const translate = vi.fn(async (texts: string[]) => texts.map(() => 'Opzioni (AI)'));
    await runXUnityAiTranslation({ ...base, translate, deps: d });

    expect(translate).toHaveBeenCalledWith(['Options'], expect.any(String));
    expect(d.write.mock.calls[0][3]).toEqual([
      { original: '<b>Inv</b>', translated: '<b>Inv</b>', line_number: 0 },
      { original: '<b>Fre</b> / <sprite index=20 tint=1>', translated: '<b>Fre</b> / <sprite index=20 tint=1>', line_number: 0 },
      { original: 'VSync', translated: 'VSync', line_number: 0 },
      { original: 'Options', translated: 'Opzioni (AI)', line_number: 0 },
    ]);
  });

  it('accorcia le etichette che superano il loro spazio, non le frasi', async () => {
    // Visto su Blake Manor: «Modalità di gioco» accavallava le schede delle Opzioni.
    const d = deps({
      readCaptured: async () => [
        { original: 'Gameplay', translated: '', line_number: 1 },
        { original: 'Vignette', translated: '', line_number: 2 },
        { original: 'Options', translated: '', line_number: 3 },
        { original: "Adjusts the game's vignette.", translated: '', line_number: 4 },
      ],
    });
    const first: Record<string, string> = {
      Gameplay: 'Modalità di gioco', Vignette: 'Effetto vignettatura', Options: 'Opzioni',
      "Adjusts the game's vignette.": "Regola l'effetto di vignettatura del gioco.",
    };
    const short: Record<string, string> = { Gameplay: 'Gioco', Vignette: 'Vignettatura' };
    const translate = vi.fn(async (texts: string[], context?: string) =>
      texts.map(t => (context?.includes('too long') ? short[t] : first[t]) ?? null));

    await runXUnityAiTranslation({ ...base, translate, deps: d });

    expect(labelLimit('Gameplay')).toBe(11);
    expect(labelThreshold('Gameplay')).toBe(13);
    // «Opzioni» e la frase non si toccano: una chiamata in più per ciascuna etichetta lunga.
    expect(translate).toHaveBeenCalledTimes(3);
    expect(translate.mock.calls[1]).toEqual([['Gameplay'], expect.stringContaining('"Modalità di gioco" is too long: shorten it to at most 11 characters')]);
    expect(translate.mock.calls[2]).toEqual([['Vignette'], expect.stringContaining('"Effetto vignettatura"')]);
    expect(d.write.mock.calls[0][3]).toEqual([
      { original: 'Gameplay', translated: 'Gioco', line_number: 0 },
      { original: 'Vignette', translated: 'Vignettatura', line_number: 0 },
      { original: 'Options', translated: 'Opzioni', line_number: 0 },
      { original: "Adjusts the game's vignette.", translated: "Regola l'effetto di vignettatura del gioco.", line_number: 0 },
    ]);
  });

  it('tiene la prima traduzione se la versione corta non è più corta, perde un tag o non arriva', async () => {
    const d = deps({
      readCaptured: async () => [
        { original: 'Cursor Size', translated: '', line_number: 1 },
        { original: '<b>Camera FOV</b>', translated: '', line_number: 2 },
        { original: 'Paused', translated: '', line_number: 3 },
        { original: 'Screen Mode', translated: '', line_number: 4 },
        { original: 'Crouch', translated: '', line_number: 5 },
      ],
    });
    const first: Record<string, string> = {
      'Cursor Size': 'Dimensione del cursore', '<b>Camera FOV</b>': '<b>Campo visivo della telecamera</b>', Paused: 'Messa in pausa',
      'Screen Mode': 'Modalità di visualizzazione dello schermo', Crouch: 'Accovacciati',
    };
    const short: Record<string, string> = {
      'Cursor Size': 'Grandezza del puntatore del mouse', '<b>Camera FOV</b>': 'FOV camera',
      // Più corta ma ancora oltre la soglia: non vale la pena.
      'Screen Mode': 'Modalità visualizzazione schermo',
      // Visto in gioco: una parola che la prima traduzione non aveva.
      Crouch: 'Agg',
    };
    await runXUnityAiTranslation({
      ...base, deps: d, translate: async (texts, context) => texts.map(t => (context?.includes('too long') ? short[t] : first[t]) ?? null),
    });
    expect(d.write.mock.calls[0][3].map((e: XUnityEntry) => e.translated))
      .toEqual(['Dimensione del cursore', '<b>Campo visivo della telecamera</b>', 'Messa in pausa', 'Modalità di visualizzazione dello schermo', 'Accovacciati']);

    // Se la seconda chiamata fallisce si scrive comunque la prima.
    const d2 = deps({ readCaptured: async () => [{ original: 'Paused', translated: '', line_number: 1 }] });
    const out = await runXUnityAiTranslation({
      ...base, deps: d2, translate: async (texts, context) => { if (context?.includes('too long')) throw new Error('rate limit'); return ['Messa in pausa']; },
    });
    expect(out).toMatchObject({ status: 'done', changed: 1 });
    expect(d2.write.mock.calls[0][3][0].translated).toBe('Messa in pausa');
  });

  it('traduce a gruppi di 20 in ordine di cattura, con i testi del gruppo come contesto', async () => {
    // Blake Manor: da solo «Draw» (accanto a «Sigil Mode», «Hold») diventava «Pareggio».
    const captured = Array.from({ length: 45 }, (_, i) => ({ original: `Text ${i}`, translated: '', line_number: i }));
    const d = deps({ readCaptured: async () => captured });
    const translate = vi.fn(async (texts: string[]) => texts.map(t => `Testo ${t.slice(5)}`));
    const progress: [number, number][] = [];
    const out = await runXUnityAiTranslation({ ...base, translate, deps: d, onProgress: (a, b) => progress.push([a, b]) });

    expect(translate.mock.calls.map(c => c[0].length)).toEqual([20, 20, 5]);
    expect(translate.mock.calls[1][0][0]).toBe('Text 20');
    expect(translate.mock.calls[1][1]).toContain('"Text 39"');
    expect(translate.mock.calls[1][1]).not.toContain('"Text 40"');
    expect(progress).toEqual([[20, 45], [40, 45], [45, 45]]);
    expect(out).toMatchObject({ status: 'done', changed: 45 });
  });

  it('un gruppo che fallisce non ferma gli altri', async () => {
    const captured = Array.from({ length: 25 }, (_, i) => ({ original: `Text ${i}`, translated: '', line_number: i }));
    const d = deps({ readCaptured: async () => captured });
    let call = 0;
    const out = await runXUnityAiTranslation({
      ...base, deps: d,
      translate: async texts => { if (call++ === 0) throw new Error('rate limit'); return texts.map(t => `Testo ${t.slice(5)}`); },
    });
    expect(out).toMatchObject({ status: 'done', changed: 5, failed: 20, total: 25 });
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
