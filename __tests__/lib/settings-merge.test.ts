/**
 * Il Salva globale delle Impostazioni scrive SOLO i campi della pagina, sopra il
 * blob corrente (app/settings/merge-settings.ts).
 *
 * Prima del 01/10/2026 scriveva la fotografia del blob presa al mount: un
 * endpoint personalizzato digitato nella stessa visita (la card lo salva da sola
 * in localStorage) spariva da localStorage e da disco appena si premeva Salva,
 * e le traduzioni tornavano al dominio ufficiale senza dirlo a nessuno.
 */
import { describe, it, expect } from 'vitest';
import { mergePageSettings } from '@/app/settings/merge-settings';

// Forma ridotta dello stato iniziale della pagina: contano le chiavi, non i valori.
const OWNED = {
  translation: { deepseekApiKey: '', temperature: 0.3 },
  system: {},
  display: { uiScale: 100 },
};

describe('mergePageSettings', () => {
  it('un endpoint digitato dopo il mount sopravvive al Salva', () => {
    // stato della pagina = fotografia al mount (niente endpoint) + modifiche dell'utente
    const page = {
      translation: { deepseekApiKey: 'sk-nuova', temperature: 0.5 },
      system: {},
      display: { uiScale: 110 },
    };
    // nel frattempo la card degli endpoint ha scritto nel blob
    const current = {
      translation: {
        deepseekApiKey: 'sk-vecchia',
        temperature: 0.3,
        endpoints: { deepseek: 'https://proxy.example.com/v1' },
      },
      display: { uiScale: 100 },
    };

    const out = mergePageSettings(current, page, OWNED);

    expect(out.translation).toEqual({
      deepseekApiKey: 'sk-nuova',
      temperature: 0.5,
      endpoints: { deepseek: 'https://proxy.example.com/v1' },
    });
    expect(out.display).toEqual({ uiScale: 110 });
  });

  it('la copia vecchia di un campo altrui nello stato della pagina non vince', () => {
    // il mount fonde tutto il blob nello stato: endpoint, preset e lingua di allora
    const page = {
      translation: { deepseekApiKey: '', temperature: 0.3, endpoints: {}, chainPreset: 'free' },
      system: { language: 'it' },
      display: { uiScale: 100 },
    };
    const current = {
      translation: { endpoints: { openai: 'https://gateway.example.com/v1' }, chainPreset: 'quality' },
      system: { language: 'en' },
    };

    const out = mergePageSettings(current, page, OWNED) as {
      translation: Record<string, unknown>;
      system: Record<string, unknown>;
    };

    expect(out.translation.endpoints).toEqual({ openai: 'https://gateway.example.com/v1' });
    expect(out.translation.chainPreset).toBe('quality');
    expect(out.system).toEqual({ language: 'en' });
  });

  it('le sezioni che la pagina non conosce restano intatte', () => {
    const current = {
      comparison: { enabled: true, maxCandidates: 3 },
      integrations: { steamGridDbApiKey: 'sgdb' },
      performance: { maxConcurrentTasks: 5 },
    };
    const page = { translation: { deepseekApiKey: 'k', temperature: 0.3 }, system: {}, display: { uiScale: 100 } };

    const out = mergePageSettings(current, page, OWNED);

    expect(out.comparison).toEqual({ enabled: true, maxCandidates: 3 });
    expect(out.integrations).toEqual({ steamGridDbApiKey: 'sgdb' });
    expect(out.performance).toEqual({ maxConcurrentTasks: 5 });
    expect(out.translation).toEqual({ deepseekApiKey: 'k', temperature: 0.3 });
  });

  it('non modifica il blob di partenza', () => {
    const current = { translation: { deepseekApiKey: 'a', endpoints: { groq: 'https://g/v1' } } };
    const snapshot = JSON.stringify(current);
    mergePageSettings(current, { translation: { deepseekApiKey: 'b', temperature: 0.3 } }, OWNED);
    expect(JSON.stringify(current)).toBe(snapshot);
  });
});
