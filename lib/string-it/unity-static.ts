/**
 * Metodo statico per Unity (`unity-loc-tables` nel piano di String it):
 * sonda il gioco, traduce i testi, li scrive nelle scene.
 *
 * Il lavoro sui file lo fa Rust (src-tauri/src/commands/unity_static.rs); qui
 * c'è solo l'ordine dei passi e le regole su cosa conta come traduzione. Le
 * dipendenze sono iniettate, così la regola si prova senza Tauri né AI.
 */
import { invoke } from '@/lib/tauri-api';

export interface UnityStaticEntry {
  key: string;
  text: string;
}

export interface UnityStaticProbe {
  family: string;
  languages: string[];
  baked_languages: string[];
  /** La lingua che verrà sostituita, e come la chiama il gioco. */
  replace_language: string;
  replace_language_name: string;
  baked_texts_found: number;
  source_language: string;
  entries: UnityStaticEntry[];
}

export interface UnityStaticReport {
  strings_replaced: number;
  entries_translated: number;
  entries_skipped: number;
  files_changed: string[];
  /** La lingua da scegliere in gioco per vedere la traduzione. */
  select_language: string;
  backup_path: string;
}

export type UnityStaticOutcome =
  | { status: 'done'; probe: UnityStaticProbe; report: UnityStaticReport; translated: number; total: number }
  /** Il gioco non è fatto per questo metodo: si passa al successivo del piano. */
  | { status: 'not-applicable'; reason: string }
  /** Il metodo si applicava ma non è andato: nel gioco non è stato scritto nulla. */
  | { status: 'failed'; reason: string };

export interface UnityStaticDeps {
  probe: (gamePath: string, targetLang: string) => Promise<UnityStaticProbe>;
  apply: (gamePath: string, targetLang: string, translations: UnityStaticEntry[]) => Promise<UnityStaticReport>;
}

const tauriDeps: UnityStaticDeps = {
  probe: (gamePath, targetLang) => invoke<UnityStaticProbe>('unity_static_probe', { gamePath, targetLang }),
  apply: (gamePath, targetLang, translations) =>
    invoke<UnityStaticReport>('unity_static_apply', { gamePath, targetLang, translations }),
};

/** Sotto questa quota di testi tradotti non si scrive: il gioco uscirebbe a metà. */
export const MIN_TRANSLATED_SHARE = 0.5;

export interface UnityStaticOptions {
  gamePath: string;
  targetLang: string;
  /**
   * Traduce i testi dalla lingua `source`. Restituisce un array lungo quanto
   * l'ingresso, con `null` dove la traduzione non è arrivata.
   */
  translate: (texts: string[], source: string) => Promise<(string | null)[]>;
  onPhase?: (phase: 'probing' | 'translating' | 'writing') => void;
  deps?: UnityStaticDeps;
}

export async function runUnityStaticTranslation(options: UnityStaticOptions): Promise<UnityStaticOutcome> {
  const { gamePath, targetLang, translate, onPhase, deps = tauriDeps } = options;

  onPhase?.('probing');
  let probe: UnityStaticProbe;
  try {
    probe = await deps.probe(gamePath, targetLang);
  } catch (e: unknown) {
    return { status: 'not-applicable', reason: String(e) };
  }

  // Ogni testo si traduce una volta sola, anche se sta sotto più chiavi.
  const texts = Array.from(new Set(probe.entries.map(e => e.text).filter(t => t.trim() !== '')));
  if (texts.length === 0) {
    return { status: 'not-applicable', reason: 'nessun testo da tradurre' };
  }

  onPhase?.('translating');
  let results: (string | null)[];
  try {
    results = await translate(texts, probe.source_language);
  } catch (e: unknown) {
    return { status: 'failed', reason: String(e) };
  }

  // Una traduzione uguale all'originale non è una traduzione: lasciarla
  // passare farebbe sembrare tradotto un testo rimasto com'era.
  const translatedByText = new Map<string, string>();
  texts.forEach((text, i) => {
    const translated = results[i]?.trim();
    if (translated && translated !== text) translatedByText.set(text, translated);
  });
  if (translatedByText.size < texts.length * MIN_TRANSLATED_SHARE) {
    return {
      status: 'failed',
      reason: `tradotti solo ${translatedByText.size} testi su ${texts.length}`,
    };
  }

  const translations: UnityStaticEntry[] = [];
  for (const entry of probe.entries) {
    const text = translatedByText.get(entry.text);
    if (text) translations.push({ key: entry.key, text });
  }

  onPhase?.('writing');
  try {
    const report = await deps.apply(gamePath, targetLang, translations);
    return { status: 'done', probe, report, translated: translatedByText.size, total: texts.length };
  } catch (e: unknown) {
    return { status: 'failed', reason: String(e) };
  }
}
