/**
 * Il FRENO del flusso Ren'Py — scritto l'08/08/2026, prima della run vera su
 * Scarlet Hollow (83.489 stringhe).
 *
 * PERCHÉ ESISTE QUESTO TEST. translateWithFallbackBatched, quando un batch
 * fallisce, riempie i buchi con la SORGENTE ("safety net") e ritorna success
 * se anche UN SOLO batch del lotto è andato a buon fine. Il ramo Ren'Py legge
 * solo `res.translations`: senza freno, un cloud che smette di rispondere è
 * indistinguibile da un cloud che traduce male, e su 83k stringhe sarebbero
 * ~2.800 chiamate, zero traduzioni scritte e una barra al 100%. È successo
 * davvero — il credito Anthropic esaurito durante la ship v1.16.0.
 *
 * L'effetto vero (il provider che muore a metà run) non si mette in scena a
 * comando, quindi la prova d'effetto è qui: un finto backend che restituisce
 * sempre la sorgente DEVE fermare il lavoro, non completarlo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Copioni finti: 120 righe, cioè 4 chunk da 30 ────────────────────────────
// Forma fedele a RenpyString (id/line_number/string_type/character): una
// fixture che si inventa i campi proverebbe la coerenza con sé stessa e non
// col codice — l'errore che ha tenuto in piedi per mesi il magic .locres.
const ROWS = Array.from({ length: 120 }, (_, i) => ({
  id: `s${i}`,
  original: `Line number ${i}`,
  translated: '',
  file: 'script.rpy',
  line_number: i + 1,
  string_type: 'Dialogue' as 'String' | 'Dialogue',
  character: null as string | null,
}));

const saved: unknown[][] = [];
let batchCalls = 0;
let generateCalled = false;

vi.mock('@/lib/tauri-api', () => ({
  invoke: vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    switch (cmd) {
      case 'extract_all_renpy_strings':
        return { success: true, strings: ROWS.map((r) => ({ ...r })), message: '' };
      case 'load_renpy_translations':
        throw new Error('file non trovato'); // benigno: nessun checkpoint precedente
      case 'load_smart_glossary':
        return [];
      case 'save_renpy_translations':
        saved.push((args?.strings as unknown[]) || []);
        return null;
      case 'offline_translate_batch_context': {
        batchCalls++;
        // Il backend locale che "risponde" restituendo la sorgente: è la forma
        // che prende Ollama quando il modello non è installato e il fallback
        // rimbalza l'input. Nessun errore lanciato: fallimento MUTO.
        const texts = (args?.texts as string[]) || [];
        return texts.map((t) => ({ translated: t }));
      }
      case 'generate_renpy_translation':
        generateCalled = true;
        return { success: true, files: 'game/tl/it' };
      default:
        return null;
    }
  }),
}));

vi.mock('@/lib/ai/ai-translate-direct', () => ({
  translateWithFallbackBatched: vi.fn(async ({ texts }: { texts: string[] }) => {
    batchCalls++;
    // Esattamente ciò che fa la safety net reale: buchi riempiti con la sorgente
    // e success=true. Il chiamante non ha modo di distinguerlo da un successo.
    return { translations: [...texts], provider: 'anthropic', success: true };
  }),
}));

vi.mock('@/lib/voice/voice-profiles', () => ({
  loadVoiceProfiles: vi.fn(async () => ({})),
  getVoiceProfile: vi.fn(() => null),
  extractVoiceProfilesFromStrings: vi.fn(() => ({})),
}));

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { runRenpyTranslation, isLegitimateIdentity } from '@/lib/renpy-translate';

describe("freno del flusso Ren'Py", () => {
  beforeEach(() => {
    saved.length = 0;
    batchCalls = 0;
    generateCalled = false;
    ROWS.forEach((r) => { r.translated = ''; });
    localStorage.clear();
  });

  it('si ferma dopo 3 blocchi consecutivi a vuoto invece di macinare tutto (cloud)', async () => {
    await expect(
      runRenpyTranslation({ gamePath: 'C:/Games/Test', targetLang: 'it', backend: 'cloud' })
    ).rejects.toThrow(/interrotta/i);

    // Il punto: si ferma al terzo blocco, non al centoventesimo. Con 120 righe
    // e chunk da 30 ci sarebbero 4 giri; il freno ne concede 3.
    expect(batchCalls).toBe(3);
  });

  it("dice QUALE backend ha smesso, perché la cura è diversa", async () => {
    await expect(
      runRenpyTranslation({ gamePath: 'C:/Games/Test', targetLang: 'it', backend: 'cloud' })
    ).rejects.toThrow(/credito e chiave API/);

    await expect(
      runRenpyTranslation({ gamePath: 'C:/Games/Test', targetLang: 'it', backend: 'ollama' })
    ).rejects.toThrow(/Ollama sia avviato/);
  });

  it('salva prima di fermarsi: il lavoro fatto non si perde e il resume riparte da lì', async () => {
    await expect(
      runRenpyTranslation({ gamePath: 'C:/Games/Test', targetLang: 'it', backend: 'cloud' })
    ).rejects.toThrow();

    // save_renpy_translations chiamato almeno una volta PRIMA del throw.
    expect(saved.length).toBeGreaterThan(0);
  });

  it('non genera i file tl/ da una traduzione vuota', async () => {
    await expect(
      runRenpyTranslation({ gamePath: 'C:/Games/Test', targetLang: 'it', backend: 'cloud' })
    ).rejects.toThrow();

    // Il difetto peggiore sarebbe scrivere game/tl/it/ pieno di inglese e
    // dichiarare successo: il gioco "tradotto" resterebbe identico.
    expect(generateCalled).toBe(false);
  });

  it('il lotto di prova traduce poco MA genera comunque i file tl/', async () => {
    const direct = await import('@/lib/ai/ai-translate-direct');
    vi.mocked(direct.translateWithFallbackBatched).mockImplementation(
      async ({ texts }: { texts: string[] }) => {
        batchCalls++;
        return { translations: texts.map((t) => `IT:${t}`), provider: 'anthropic', success: true };
      }
    );

    const res = await runRenpyTranslation({
      gamePath: 'C:/Games/Test', targetLang: 'it', backend: 'cloud', limit: 45,
    });

    // Il tetto morde: 45 stringhe nuove, non 120.
    expect(res.translated).toBe(45);
    expect(res.total).toBe(120);

    // E i contatori NON mentono. Il banner calcolava la percentuale su `total`
    // e finiva per dire «0% riuscito, 83.340 errori» su un lotto in cui era
    // andato tutto: le non tentate finivano nella casella "errori". Qui 45 su
    // 45 tentate = 100%, e zero errori.
    expect(res.attempted).toBe(45);
    expect(res.accepted).toBe(45);
    expect(res.attempted - res.accepted).toBe(0);
    // E QUESTO è il punto del lotto di prova: i file tl/ si generano lo stesso,
    // altrimenti non ci sarebbe niente da guardare in gioco e la prova
    // d'effetto resterebbe impossibile finché non si spende tutto.
    expect(generateCalled).toBe(true);
  });

  it("il lotto di prova pesca PRIMA l'interfaccia, non le prime righe del copione", async () => {
    // La prima versione prendeva le prime N in ordine di file: su Scarlet
    // Hollow finivano tutte in una scena a metà partita, quindi il lotto era
    // tradotto ma invisibile. Qui le righe UI stanno IN FONDO all'elenco: se
    // l'ordinamento non funziona, non ne viene tradotta nemmeno una.
    ROWS.forEach((r, i) => {
      r.string_type = (i >= 110 ? 'String' : 'Dialogue') as 'String' | 'Dialogue';
    });
    const direct = await import('@/lib/ai/ai-translate-direct');
    const seen: string[] = [];
    vi.mocked(direct.translateWithFallbackBatched).mockImplementation(
      async ({ texts }: { texts: string[] }) => {
        seen.push(...texts);
        return { translations: texts.map((t) => `IT:${t}`), provider: 'anthropic', success: true };
      }
    );

    await runRenpyTranslation({
      gamePath: 'C:/Games/Test', targetLang: 'it', backend: 'cloud', limit: 10,
    });

    // Tutte e 10 devono essere quelle di interfaccia (indici 110-119).
    expect(seen).toHaveLength(10);
    expect(seen.every((t) => Number(t.replace('Line number ', '')) >= 110)).toBe(true);

    ROWS.forEach((r) => { r.string_type = 'Dialogue' as 'String' | 'Dialogue'; });
  });

  // ── ANTI-ECO ──────────────────────────────────────────────────────────────
  // La guardia scartava OGNI traduzione uguale alla sorgente. Sui dialoghi è
  // prudenza; sull'interfaccia è un falso positivo strutturale: «OK» in
  // italiano si scrive «OK». Effetto misurato l'08/08/2026: 130 accettate su
  // ~400 tentate, quelle righe mai segnate come fatte e ritentate a ogni
  // resume, e un blocco di sole etichette capace di far scattare il freno.

  it('accetta «OK» che resta «OK» invece di ritentarlo per sempre', () => {
    expect(isLegitimateIdentity('OK', 'String')).toBe(true);
    expect(isLegitimateIdentity('Auto', 'String')).toBe(true);
    expect(isLegitimateIdentity('Slot', 'String')).toBe(true);
    expect(isLegitimateIdentity('Skip', 'String')).toBe(true);
    expect(isLegitimateIdentity('42', 'String')).toBe(true);
    expect(isLegitimateIdentity('{i}[player_name]{/i}', 'Dialogue')).toBe(true);
    expect(isLegitimateIdentity('Sayori', 'Dialogue')).toBe(true);
    // Nomi propri e titoli: restano uguali in italiano. Senza la regola del
    // Title Case venivano ritentati a ogni resume, per sempre.
    expect(isLegitimateIdentity('The Dead Rabbit Bar', 'Dialogue')).toBe(true);
    expect(isLegitimateIdentity('Dr. Elizabeth Warren', 'Dialogue')).toBe(true);
  });

  it("continua a chiamare eco una FRASE che torna identica", () => {
    // Questo è il caso che il freno deve poter vedere: la safety net del cloud
    // che rimbalza la sorgente. Se lo dichiarassimo legittimo, un provider
    // morto passerebbe per un provider preciso.
    expect(isLegitimateIdentity('I have no idea what you are talking about.', 'Dialogue')).toBe(false);
    expect(isLegitimateIdentity('Are you sure you want to delete this save?', 'String')).toBe(false);
    // I casi che la PRIMA versione sbagliava: due o tre parole corte, sotto la
    // soglia UI, ma con la punteggiatura di una frase vera.
    expect(isLegitimateIdentity('Thank you.', 'Dialogue')).toBe(false);
    expect(isLegitimateIdentity('Wait!', 'Dialogue')).toBe(false);
    expect(isLegitimateIdentity('Are you sure?', 'String')).toBe(false);
    expect(isLegitimateIdentity('Hello, [name].', 'Dialogue')).toBe(false);
    // Etichetta UI di 4 parole tutte minuscole: non è un titolo, va tradotta.
    expect(isLegitimateIdentity('Start a new game', 'String')).toBe(false);
  });

  it("le identità NON vanno nel checkpoint se il blocco non ha cambiato nulla", async () => {
    // IL DIFETTO PIÙ GRAVE DELLA PRIMA VERSIONE, trovato dalla revisione
    // ostile. Con il cloud a credito zero la safety net rimbalza la sorgente:
    // ogni riga torna identica. Se le accettassimo riga per riga, l'inglese
    // finirebbe nel checkpoint come DEFINITIVO (il resume salta le righe già
    // "tradotte") e nessuna run futura le ritenterebbe. E siccome `uiFirst`
    // mette le etichette in testa, il lotto di prova sarebbe l'unica run
    // completamente senza freno: barra al 100%, gioco in inglese.
    ROWS.forEach((r, i) => {
      r.original = `Label ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i % 26]}${Math.floor(i / 26)}`;
      r.string_type = 'String' as 'String' | 'Dialogue';
    });
    const direct = await import('@/lib/ai/ai-translate-direct');
    vi.mocked(direct.translateWithFallbackBatched).mockImplementation(
      async ({ texts }: { texts: string[] }) => {
        batchCalls++;
        return { translations: [...texts], provider: 'anthropic', success: true };
      }
    );

    await expect(
      runRenpyTranslation({ gamePath: 'C:/Games/Test', targetLang: 'it', backend: 'cloud' })
    ).rejects.toThrow(/non ha cambiato/i);

    expect(batchCalls).toBe(3);           // si ferma, non macina i 4 chunk
    expect(generateCalled).toBe(false);   // e non scrive tl/ pieni di inglese
    // Nessuna identità è finita nel checkpoint: restano tutte ritentabili.
    const last = saved[saved.length - 1] as Array<{ translated: string }>;
    expect(last.every((r) => r.translated === '')).toBe(true);

    ROWS.forEach((r, i) => {
      r.original = `Line number ${i}`;
      r.string_type = 'Dialogue' as 'String' | 'Dialogue';
    });
  });

  it('le identità di un blocco VIVO vengono invece accettate', async () => {
    // Stesso blocco di etichette, ma il motore ne traduce una davvero: allora
    // è vivo, e «OK» → «OK» delle altre è credibile. Questa è la decisione per
    // BLOCCO che sostituisce quella per riga.
    ROWS.forEach((r, i) => {
      r.original = i === 0 ? 'Start Game' : `Label ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i % 26]}${Math.floor(i / 26)}`;
      r.string_type = 'String' as 'String' | 'Dialogue';
    });
    const direct = await import('@/lib/ai/ai-translate-direct');
    vi.mocked(direct.translateWithFallbackBatched).mockImplementation(
      async ({ texts }: { texts: string[] }) =>
        ({ translations: texts.map((t) => (t === 'Start Game' ? 'Inizia partita' : t)), provider: 'anthropic', success: true })
    );

    const res = await runRenpyTranslation({
      gamePath: 'C:/Games/Test', targetLang: 'it', backend: 'cloud', limit: 30,
    });

    expect(res.identical).toBe(29);       // le 29 etichette accettate
    expect(res.attempted - res.accepted).toBe(0); // e NON contate come errori
    expect(generateCalled).toBe(true);

    ROWS.forEach((r, i) => {
      r.original = `Line number ${i}`;
      r.string_type = 'Dialogue' as 'String' | 'Dialogue';
    });
  });

  // ── STOP ──────────────────────────────────────────────────────────────────

  it('lo Stop ferma la run, salva, e genera COMUNQUE i file tl/', async () => {
    const direct = await import('@/lib/ai/ai-translate-direct');
    const ac = new AbortController();
    vi.mocked(direct.translateWithFallbackBatched).mockImplementation(
      async ({ texts }: { texts: string[] }) => {
        batchCalls++;
        if (batchCalls === 1) ac.abort(); // Stop premuto durante il primo blocco
        return { translations: texts.map((t) => `IT:${t}`), provider: 'anthropic', success: true };
      }
    );

    const res = await runRenpyTranslation({
      gamePath: 'C:/Games/Test', targetLang: 'it', backend: 'cloud', signal: ac.signal,
    });

    // Si ferma al blocco successivo, non macina tutti e quattro.
    expect(batchCalls).toBe(1);
    expect(res.stopped).toBe(true);
    expect(res.translated).toBe(30);
    // IL PUNTO: fermarsi lascia un gioco giocabile, non un cestino.
    expect(generateCalled).toBe(true);
    expect(saved.length).toBeGreaterThan(0);
    // E il consuntivo non conta come errori le righe mai tentate: con 120 in
    // programma e 30 tentate, «90 errori» sarebbe la stessa bugia del banner
    // che divideva per 83.489.
    expect(res.attempted).toBe(30);
    expect(res.accepted).toBe(30);
  });

  it('una run senza signal si comporta esattamente come prima', async () => {
    const direct = await import('@/lib/ai/ai-translate-direct');
    vi.mocked(direct.translateWithFallbackBatched).mockImplementation(
      async ({ texts }: { texts: string[] }) => ({ translations: texts.map((t) => `IT:${t}`), provider: 'anthropic', success: true })
    );
    const res = await runRenpyTranslation({ gamePath: 'C:/Games/Test', targetLang: 'it', backend: 'cloud' });
    expect(res.stopped).toBe(false);
    expect(res.translated).toBe(120);
  });

  it('un backend che traduce davvero arriva in fondo (il freno non è un falso positivo)', async () => {
    const direct = await import('@/lib/ai/ai-translate-direct');
    vi.mocked(direct.translateWithFallbackBatched).mockImplementation(
      async ({ texts }: { texts: string[] }) => {
        batchCalls++;
        return { translations: texts.map((t) => `IT:${t}`), provider: 'anthropic', success: true };
      }
    );

    const res = await runRenpyTranslation({
      gamePath: 'C:/Games/Test', targetLang: 'it', backend: 'cloud',
    });

    expect(res.translated).toBe(120);
    expect(generateCalled).toBe(true);
    expect(batchCalls).toBe(4); // tutti e quattro i chunk, nessuna frenata
  });
});
