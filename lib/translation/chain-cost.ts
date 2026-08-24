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
 *     testa (HY-MT, TranslateGemma, Ollama…) coprono quello che riescono, e si
 *     paga solo quando si arriva al primo a pagamento. Quello è il CASO
 *     PEGGIORE, ed è quello che si riporta, nominando il provider;
 *   - la Translation Memory abbatte le chiamate reali, e qui non è contata:
 *     il preventivo vero di un gioco lo fa estimateBatchCost sulle sue stringhe.
 *
 * ⛔ IL DIFETTO DEL 24/08/2026, perché la riga sopra era una promessa e non un
 * fatto: «i gratuiti in testa» non venivano contati NEMMENO UNA VOLTA. Il ciclo
 * chiedeva il prezzo con getProviderPrice1k, che per un provider fuori catalogo
 * non risponde «non lo so» ma 0.002 — quindi `!(per1k > 0)` era sempre falso,
 * `gratuitiPrima` sempre 0, e ogni preset veniva preventivato come il suo PRIMO
 * provider, qualunque cosa fosse. Misurato su 10.000 stringhe, prima e dopo:
 * OTTO preset su dieci mostravano la stessa identica cifra, ~$0,60 — il picker
 * sembrava un listino ed era una costante. «🆓 Gratis», che parte da HY-MT sul
 * PC dell'utente, diceva ~$0,60 (ora: fino a $0,45 dal primo cloud della
 * catena); «👑 Massima Qualità», che parte da Claude Opus 5, diceva ~$0,60 pure
 * lei (ora: ~$1,5) — 2,5 volte MENO del vero, l'errore nel verso che manda una
 * fattura più alta del preventivo.
 * Corretto in tre pezzi, tutti dalla parte dei dati e nessuno dalla formula:
 *   1. il catalogo prezzi ha ora le chiavi che le catene usano davvero, con i
 *      locali/senza-chiave a per1kUsd 0 (lib/remote-config.ts, 24/08/2026);
 *   2. getProviderPrice1kOrNull distingue «gratis» (0) da «ignoto» (null), che
 *      è la distinzione che qui serviva e non c'era;
 *   3. quando il provider resta fuori catalogo la cifra si mostra col '?':
 *      si stima lo stesso, ma senza spacciare il ripiego per un listino.
 */

import { getModelConfig, getProviderPrice1kOrNull, FALLBACK_PRICE_1K } from '@/lib/remote-config';
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
  /**
   * true quando usdMax NON nasce da un prezzo di catalogo ma dal ripiego
   * FALLBACK_PRICE_1K, perché il provider non è nel listino. Il numero resta —
   * un ordine di grandezza serve comunque a confrontare i preset — ma va
   * mostrato come stima e non come misura: formattaStima ci mette un '?'.
   */
  prezzoIgnoto: boolean;
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
    return { gratis: false, variabile: true, provider: null, usdMax: null, gratuitiPrima: 0, prezzoIgnoto: false };
  }

  let gratuitiPrima = 0;
  for (const provider of preset.providers) {
    const per1k = getProviderPrice1kOrNull(config, provider);

    // Prezzo 0 DICHIARATO in catalogo = provider gratuito (locale o senza API
    // key): si conta e si passa al successivo della catena. Questo ramo, fino
    // al 24/08/2026, non scattava mai — nessuna voce del listino valeva 0,
    // perché i provider locali non erano nel listino affatto.
    if (per1k === 0) {
      gratuitiPrima += 1;
      continue;
    }

    // Stessa aritmetica di estimateBatchCost: caratteri/4 token, ×2 per l'output.
    const token = Math.ceil((stringhe * CARATTERI_PER_STRINGA) / 4) * 2;
    // per1k === null = provider fuori catalogo. NON è gratuito: ha una API key
    // e un listino che qui non conosciamo. Si stima col ripiego e si dichiara.
    const prezzoIgnoto = per1k === null;
    const prezzo = per1k ?? FALLBACK_PRICE_1K;
    return { gratis: false, variabile: false, provider, usdMax: (token / 1000) * prezzo, gratuitiPrima, prezzoIgnoto };
  }

  return { gratis: true, variabile: false, provider: null, usdMax: null, gratuitiPrima, prezzoIgnoto: false };
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
  const base = s.gratuitiPrima > 0 ? `fino a ${cifra}` : `~${cifra}`;
  // Il '?' non è decorazione: separa le cifre che vengono dal listino da quelle
  // che vengono dal ripiego. Senza, un preventivo inventato e uno verificato si
  // presentano all'utente esattamente uguali.
  return s.prezzoIgnoto ? `${base}?` : base;
}
