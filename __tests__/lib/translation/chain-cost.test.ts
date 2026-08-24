/**
 * Test della stima di costo dei chain preset.
 *
 * ⛔ PERCHÉ ESISTONO (24/08/2026): chain-cost.ts non aveva un solo test, e il
 * difetto che aveva non era sottile — era una riga che sembrava giusta. Il
 * ciclo contava i «provider gratuiti in testa alla catena» chiedendo il prezzo
 * a getProviderPrice1k, che per un provider fuori catalogo NON risponde «non lo
 * so» ma 0.002: il contatore restava a zero sempre, e ogni preset veniva
 * preventivato come il suo primo provider a un prezzo inventato. Il preset
 * «🆓 Gratis», che parte da un modello sul PC dell'utente, mostrava ~$0,60.
 *
 * I test qui sotto guardano perciò le CONSEGUENZE VISIBILI (quale provider
 * determina il tetto, quanti gratuiti sono stati contati, che stringa legge
 * l'utente), non la forma interna della funzione: è il livello a cui il difetto
 * era osservabile, ed è il livello a cui una regressione tornerebbe a esserlo.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CHAIN_PRESETS, type ChainPresetInfo } from '@/lib/translation/chain-presets';
import {
  stimaCostoPreset,
  formattaStima,
  STRINGHE_RIFERIMENTO,
  CARATTERI_PER_STRINGA,
} from '@/lib/translation/chain-cost';
import { BUNDLED_MODEL_CONFIG, FALLBACK_PRICE_1K } from '@/lib/remote-config';

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Token del volume di riferimento: caratteri/4, ×2 per l'output. */
const TOKEN_RIF = Math.ceil((STRINGHE_RIFERIMENTO * CARATTERI_PER_STRINGA) / 4) * 2;
const usdA = (per1k: number) => (TOKEN_RIF / 1000) * per1k;

const preset = (providers: string[]): ChainPresetInfo => ({
  id: 'balanced',
  name: 'test',
  description: 'test',
  quality: '',
  speed: '',
  providers,
});

const trova = (id: string) => CHAIN_PRESETS.find((p) => p.id === id)!;

/**
 * getModelConfig() legge la cache in localStorage e, se manca o è vecchia,
 * lancia un refresh via fetch. Nei test si semina la cache: niente rete, e i
 * casi «la config remota dichiara questo prezzo» diventano scrivibili.
 */
function seminaConfig(pricing: Record<string, { per1kUsd: number }> = {}) {
  localStorage.setItem(
    'gs-model-config',
    JSON.stringify({ config: { version: 1, pricing, models: {} }, ts: Date.now() })
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('niente rete nei test'))));
  seminaConfig();
});

describe('stimaCostoPreset — i gratuiti in testa alla catena', () => {
  it('NON fattura i provider locali: «Gratis» non è preventivato come HY-MT', () => {
    const s = stimaCostoPreset(trova('free'));
    // Il difetto del 24/08 dava esattamente questo: provider 'hymt', $0,60.
    expect(s.provider).not.toBe('hymt');
    expect(s.gratuitiPrima).toBeGreaterThanOrEqual(4);
  });

  it('conta i gratuiti e nomina il primo a pagamento', () => {
    const s = stimaCostoPreset(preset(['hymt', 'ollama', 'deepl']));
    expect(s.gratuitiPrima).toBe(2);
    expect(s.provider).toBe('deepl');
    expect(s.usdMax).toBeCloseTo(usdA(0.02), 6);
    expect(s.prezzoIgnoto).toBe(false);
  });

  it('una catena di soli provider locali costa zero', () => {
    const s = stimaCostoPreset(trova('privacy'));
    expect(s.gratis).toBe(true);
    expect(s.usdMax).toBeNull();
    expect(s.gratuitiPrima).toBe(trova('privacy').providers.length);
    expect(formattaStima(s)).toBe('$0');
  });

  it('onora un provider dichiarato gratuito dalla config remota', () => {
    // validateModelConfig accetta per1kUsd >= 0 apposta: il ramo "gratis" deve
    // scattare anche per un provider che il bundled considera a pagamento.
    seminaConfig({ deepl: { per1kUsd: 0 } });
    const s = stimaCostoPreset(preset(['deepl', 'openai']));
    expect(s.gratuitiPrima).toBe(1);
    expect(s.provider).toBe('openai');
  });
});

describe('stimaCostoPreset — prezzi presi dal catalogo, non inventati', () => {
  it('le tre chiavi Claude delle catene hanno il prezzo di Claude', () => {
    // Prima del 24/08 pagavano tutte il ripiego 0.002: Opus 5 preventivato
    // 2,5× meno del vero, cioè l'errore nel verso che manda la fattura alta.
    expect(stimaCostoPreset(preset(['anthropic'])).usdMax).toBeCloseTo(usdA(0.003), 6);
    expect(stimaCostoPreset(preset(['anthropic-claude4'])).usdMax).toBeCloseTo(usdA(0.003), 6);
    expect(stimaCostoPreset(preset(['anthropic-premium'])).usdMax).toBeCloseTo(usdA(0.005), 6);
    expect(stimaCostoPreset(preset(['anthropic-premium'])).prezzoIgnoto).toBe(false);
  });

  it('«Massima Qualità» è preventivata su Opus 5, non sul ripiego', () => {
    const s = stimaCostoPreset(trova('max_quality'));
    expect(s.provider).toBe('anthropic-premium');
    expect(s.usdMax).toBeCloseTo(usdA(0.005), 6);
    expect(formattaStima(s)).toBe('~$1,5');
  });

  it('un provider fuori catalogo si stima col ripiego e lo dichiara', () => {
    const s = stimaCostoPreset(preset(['groq']));
    expect(s.prezzoIgnoto).toBe(true);
    expect(s.usdMax).toBeCloseTo(usdA(FALLBACK_PRICE_1K), 6);
    expect(formattaStima(s)).toBe('~$0,60?');
  });

  it('un prezzo che cambia in config cambia la stima, senza toccare il codice', () => {
    seminaConfig({ deepl: { per1kUsd: 0.04 } });
    expect(stimaCostoPreset(preset(['deepl'])).usdMax).toBeCloseTo(usdA(0.04), 6);
  });

  it('la catena costruita a runtime non si preventiva', () => {
    const s = stimaCostoPreset(trova('auto'));
    expect(s.variabile).toBe(true);
    expect(formattaStima(s)).toBe('—');
  });

  it('la stima scala col volume di stringhe', () => {
    const s = stimaCostoPreset(preset(['deepl']), 1000);
    expect(s.usdMax).toBeCloseTo(usdA(0.02) / 10, 6);
  });
});

describe('formattaStima', () => {
  it('«fino a» solo quando davanti ci sono dei gratuiti', () => {
    expect(formattaStima(stimaCostoPreset(preset(['hymt', 'deepl'])))).toBe('fino a $6,0');
    expect(formattaStima(stimaCostoPreset(preset(['deepl'])))).toBe('~$6,0');
  });

  it('sotto il centesimo non finge precisione', () => {
    // Il '~' resta davanti anche qui: è il prefisso di «nessun gratuito prima».
    expect(formattaStima(stimaCostoPreset(preset(['google']), 10))).toBe('~< $0,01');
  });
});

describe('catalogo prezzi — nessun provider entra in silenzio', () => {
  /**
   * I provider che restano fuori dal listino di proposito: hanno bisogno di una
   * API key dell'utente e di un prezzo che nessuno ha ancora verificato. Il
   * test non chiede che siano prezzati — chiede che l'elenco sia una DECISIONE:
   * se domani una catena usa un provider nuovo, questo test fallisce e obbliga
   * a scegliere fra «verifico il listino» e «resta una stima dichiarata».
   */
  const SENZA_PREZZO = new Set([
    'groq', 'groq-gptoss', 'cerebras', 'qwen', 'cohere', 'together', 'fireworks',
  ]);

  it('ogni provider dei preset è prezzato, o è nell’elenco dei noti-senza-prezzo', () => {
    const usati = new Set(CHAIN_PRESETS.flatMap((p) => p.providers));
    const ignoti = [...usati].filter(
      (p) => BUNDLED_MODEL_CONFIG.pricing[p] === undefined && !SENZA_PREZZO.has(p)
    );
    expect(ignoti).toEqual([]);
  });

  it('i provider locali o senza API key valgono zero, non «assente»', () => {
    const senzaChiave = ['hymt', 'translategemma', 'ollama', 'lmstudio', 'modelwiz',
                         'nllb', 'mymemory', 'lingva', 'libretranslate'];
    for (const p of senzaChiave) {
      expect(BUNDLED_MODEL_CONFIG.pricing[p]?.per1kUsd).toBe(0);
    }
  });
});
