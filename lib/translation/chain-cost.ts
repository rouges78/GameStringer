/**
 * Costo di un chain preset, calcolato dai prezzi VERI invece che scritto a mano.
 *
 * ⛔ PERCHÉ ESISTE (18/08/2026): i preset di chain-presets.ts portano il costo
 * come STRINGA CABLATA (`cost: '~$0.10'`), scritta a mano mesi fa. Il rincaro
 * DeepSeek del 16/08 le ha rese false senza che nessuno le toccasse: «economy
 * ~$0.10» include deepseek, il cui input di picco è passato da $0,14 a $0,44
 * per milione. Montare il picker mostrando quei numeri avrebbe spostato la
 * bugia sotto gli occhi dell'utente invece di toglierla.
 *
 * ⭐ NON CALCOLA NULLA DI NUOVO, ed è il punto: il prezzo per provider esce da
 * `getProviderPrice1k(getModelConfig(), …)`, la stessa fonte che usa
 * `estimateBatchCost` (lib/batch/batch-translator.ts), e la formula dei token è
 * la SUA — caratteri/4, moltiplicato per due perché si pagano input e output.
 * Scrivere un secondo calcolo sarebbe stata la decima stima parallela del
 * progetto: due numeri diversi per la stessa domanda sono peggio di nessun
 * numero. Se un prezzo cambia in remote-config, questa stima cambia da sola.
 *
 * ⚠️ COSA RESTA STIMA, e va detto a chi legge:
 *   - la lunghezza media di una riga di gioco (vedi CARATTERI_PER_STRINGA);
 *   - il fatto che una catena non costa «il suo primo provider»: i gratuiti in
 *     testa (HY-MT, Ollama, Groq…) coprono quello che riescono, e si paga solo
 *     quando si arriva al primo a pagamento. Quello è il CASO PEGGIORE, ed è
 *     quello che si riporta, nominando il provider;
 *   - la Translation Memory abbatte le chiamate reali, e qui non è contata:
 *     il preventivo vero di un gioco lo fa estimateBatchCost sulle sue stringhe.
 */

import { getModelConfig, getProviderPrice1k } from '@/lib/remote-config';
import type { ChainPresetInfo } from './chain-presets';

/**
 * Caratteri per riga di gioco. Una battuta di dialogo tipica sta fra le 40 e
 * le 80 battute; 60 è la via di mezzo. Diviso 4 dà i token, come fa
 * estimateBatchCost — che poi raddoppia per l'output.
 */
export const CARATTERI_PER_STRINGA = 60;

/** Volume di riferimento per confrontare i preset fra loro. */
export const STRINGHE_RIFERIMENTO = 10_000;

export interface StimaCosto {
  /** true quando nella catena non c'è NESSUN provider a pagamento. */
  gratis: boolean;
  /** true quando la catena è costruita a runtime e non è preventivabile (preset `auto`). */
  variabile: boolean;
  /** Primo provider a pagamento della catena: è lui che determina il tetto di spesa. */
  provider: string | null;
  /**
   * Dollari stimati nel CASO PEGGIORE, cioè se i provider gratuiti in testa
   * alla catena non traducessero nulla. null se gratis o variabile.
   */
  usdMax: number | null;
  /**
   * Quanti provider gratuiti vengono provati prima di spendere. Se è > 0, la
   * spesa reale sta fra 0 e usdMax, e l'interfaccia deve dirlo: mostrare solo
   * il tetto farebbe sembrare caro un preset che quasi sempre costa meno.
   */
  gratuitiPrima: number;
}

export function stimaCostoPreset(
  preset: ChainPresetInfo,
  stringhe: number = STRINGHE_RIFERIMENTO
): StimaCosto {
  const config = getModelConfig();

  // `auto` costruisce la catena a runtime (getAutoProviderChain) in base a
  // lingua, genere e provider configurati: qui non c'è niente da preventivare,
  // e fingere un numero sarebbe la bugia peggiore delle tre.
  if (preset.providers.length === 0) {
    return { gratis: false, variabile: true, provider: null, usdMax: null, gratuitiPrima: 0 };
  }

  let gratuitiPrima = 0;
  for (const provider of preset.providers) {
    const per1k = getProviderPrice1k(config, provider);
    // Nessun prezzo in catalogo = provider gratuito o sconosciuto: non si
    // inventa una cifra, si conta e si passa al successivo della catena.
    if (!(per1k > 0)) {
      gratuitiPrima += 1;
      continue;
    }

    // Stessa aritmetica di estimateBatchCost: caratteri/4 token, ×2 per l'output.
    const token = Math.ceil((stringhe * CARATTERI_PER_STRINGA) / 4) * 2;
    return { gratis: false, variabile: false, provider, usdMax: (token / 1000) * per1k, gratuitiPrima };
  }

  return { gratis: true, variabile: false, provider: null, usdMax: null, gratuitiPrima };
}

/**
 * Formatta la stima per l'interfaccia, volutamente con poche cifre: un costo
 * mostrato con più decimali di quanti ne conosciamo sembrerebbe una misura.
 * Il prefisso «fino a» non è cortesia: è la differenza fra il tetto di spesa e
 * quello che si paga davvero quando i provider gratuiti in testa reggono.
 */
export function formattaStima(s: StimaCosto): string {
  if (s.variabile) return '—';
  if (s.gratis || s.usdMax === null) return '$0';
  const cifra =
    s.usdMax < 0.01 ? '< $0,01' : s.usdMax < 1 ? `$${s.usdMax.toFixed(2).replace('.', ',')}` : `$${s.usdMax.toFixed(1).replace('.', ',')}`;
  return s.gratuitiPrima > 0 ? `fino a ${cifra}` : `~${cifra}`;
}
