/**
 * Drain loop del Translation Bridge — l'anello che fa "imparare" la catena.
 *
 * Quando la DLL iniettata chiede una stringa che il dizionario non conosce, il
 * server (`src-tauri/src/translator_pipe.rs`) non risponde e la accoda come
 * cache miss. Questo loop drena quella coda, traduce con lo stack AI dell'app e
 * reinserisce il risultato nel dizionario: dal secondo avvistamento in poi la
 * stessa stringa è un hit, servito in microsecondi senza ripagare il provider.
 *
 * La logica è pura e a dipendenze iniettate (`DrainDeps`) — niente React, niente
 * Tauri — così i test possono farla girare a tempo simulato.
 */

import { clientLogger } from '@/lib/client-logger';

/** Porte verso il mondo esterno: il test le sostituisce con delle finte. */
export interface DrainDeps {
  /** Preleva fino a `max` testi non tradotti dalla coda dei miss. */
  drainMisses: (max: number) => Promise<string[]>;
  /** Traduce un blocco di testi. Deve restituire un array parallelo a `texts`. */
  translate: (texts: string[]) => Promise<{ translations: string[]; success: boolean }>;
  /** Inserisce una traduzione nel dizionario del bridge. */
  addTranslation: (original: string, translated: string) => Promise<boolean>;
  /** Persiste i dizionari su disco (memoria durevole tra sessioni). */
  save?: () => Promise<void>;
}

export interface DrainOptions {
  /** Attesa tra un giro e l'altro, in ms. */
  intervalMs?: number;
  /** Massimo di testi drenati per giro. */
  batchSize?: number;
  /**
   * Tetto di spesa: massimo di stringhe tradotte per sessione. Serve a evitare
   * che un gioco con migliaia di stringhe nuove apra un rubinetto sul provider.
   * `0` = nessun limite (sconsigliato).
   */
  maxTranslationsPerSession?: number;
  /** Salva su disco ogni N traduzioni imparate. */
  saveEvery?: number;
}

export interface DrainStats {
  /** Stringhe tradotte e reinserite nel dizionario in questa sessione. */
  learned: number;
  /** Giri in cui la coda era vuota. */
  idleRounds: number;
  /** Testi che il provider non è riuscito a tradurre. */
  failed: number;
  /** True quando il tetto di sessione è stato raggiunto. */
  budgetExhausted: boolean;
}

const DEFAULTS: Required<Omit<DrainOptions, never>> = {
  intervalMs: 3000,
  batchSize: 50,
  maxTranslationsPerSession: 2000,
  saveEvery: 25,
};

/**
 * Esegue UN giro di drain. Esportata a parte perché è l'unità che ha senso
 * testare: il loop attorno è solo un timer.
 *
 * @returns quante stringhe sono state imparate in questo giro.
 */
export async function drainOnce(
  deps: DrainDeps,
  stats: DrainStats,
  opts: Required<DrainOptions>,
): Promise<number> {
  if (opts.maxTranslationsPerSession > 0 && stats.learned >= opts.maxTranslationsPerSession) {
    stats.budgetExhausted = true;
    return 0;
  }

  const texts = await deps.drainMisses(opts.batchSize);
  if (texts.length === 0) {
    stats.idleRounds++;
    return 0;
  }

  // Non superare il tetto: tronca il batch a quanto resta di budget.
  const remaining =
    opts.maxTranslationsPerSession > 0
      ? opts.maxTranslationsPerSession - stats.learned
      : texts.length;
  const batch = texts.slice(0, remaining);

  const result = await deps.translate(batch);
  if (!result.success) {
    stats.failed += batch.length;
    return 0;
  }

  let learnedNow = 0;
  for (let i = 0; i < batch.length; i++) {
    const original = batch[i];
    const translated = result.translations[i];
    // Una traduzione vuota o identica all'originale non è una traduzione:
    // inserirla trasformerebbe un miss in un hit permanente e sbagliato,
    // e la stringa non verrebbe mai più ritentata.
    if (!translated || translated === original) {
      stats.failed++;
      continue;
    }
    if (await deps.addTranslation(original, translated)) {
      stats.learned++;
      learnedNow++;
    } else {
      stats.failed++;
    }
  }

  if (
    deps.save &&
    opts.saveEvery > 0 &&
    learnedNow > 0 &&
    Math.floor(stats.learned / opts.saveEvery) >
      Math.floor((stats.learned - learnedNow) / opts.saveEvery)
  ) {
    try {
      await deps.save();
    } catch (error: unknown) {
      clientLogger.warn(`[BridgeDrain] Salvataggio fallito: ${String(error)}`);
    }
  }

  if (opts.maxTranslationsPerSession > 0 && stats.learned >= opts.maxTranslationsPerSession) {
    stats.budgetExhausted = true;
    clientLogger.warn(
      `[BridgeDrain] Tetto di sessione raggiunto (${opts.maxTranslationsPerSession} stringhe), loop fermo`,
    );
  }

  return learnedNow;
}

/**
 * Loop che chiama `drainOnce` a intervalli finché non lo si ferma o finché il
 * tetto di sessione non si esaurisce.
 */
export class TranslationBridgeDrain {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private readonly opts: Required<DrainOptions>;
  readonly stats: DrainStats = {
    learned: 0,
    idleRounds: 0,
    failed: 0,
    budgetExhausted: false,
  };

  constructor(
    private readonly deps: DrainDeps,
    options: DrainOptions = {},
    private readonly onTick?: (stats: DrainStats) => void,
  ) {
    this.opts = { ...DEFAULTS, ...options };
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Esegue un giro subito, senza aspettare l'intervallo (per i test e la UI). */
  async runOnce(): Promise<number> {
    return drainOnce(this.deps, this.stats, this.opts);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    try {
      await drainOnce(this.deps, this.stats, this.opts);
    } catch (error: unknown) {
      clientLogger.error(`[BridgeDrain] Giro fallito: ${String(error)}`);
    }

    this.onTick?.(this.stats);

    if (this.stats.budgetExhausted) {
      this.stop();
      return;
    }
    if (!this.running) return;

    this.timer = setTimeout(() => void this.tick(), this.opts.intervalMs);
  }
}
