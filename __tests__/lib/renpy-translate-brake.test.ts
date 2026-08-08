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

import { runRenpyTranslation } from '@/lib/renpy-translate';

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
