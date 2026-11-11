/**
 * Piano di "String it": l'elenco ORDINATO dei metodi di traduzione da provare
 * su un gioco. Lo calcola Rust (`plan_translation`, vedi
 * src-tauri/src/commands/translation_plan.rs); qui ci sono i tipi e le poche
 * regole che servono al frontend per seguirlo.
 */
import { invoke } from '@/lib/tauri-api';

export type EngineSource = 'files' | 'hint' | 'none';
export type MethodKind = 'static' | 'runtime' | 'ocr' | 'page';

export type MethodId =
  | 'danganronpa-wad'
  | 'hendrix-csv'
  | 'renpy-tl'
  | 'visionaire-vis'
  | 'tyrano-asar'
  | 'unity-xunity'
  | 'unreal-locres'
  | 'rpgmaker-json'
  | 'generic-workflow'
  | 'godot-pck'
  | 'wolfrpg'
  | 'bethesda'
  | 'cri'
  | 'telltale'
  | 'runtime-hook'
  | 'ocr-overlay';

export interface PlannedMethod {
  id: MethodId;
  kind: MethodKind;
  /** true = parte e finisce senza altre scelte dell'utente. */
  automatic: boolean;
  /** Pagina dello strumento, per i metodi `page`. */
  route: string | null;
  /** Se presente il metodo non va eseguito, es. "anti-cheat:EasyAntiCheat". */
  blocked_by: string | null;
}

export interface TranslationPlan {
  engine: string;
  engine_source: EngineSource;
  /** 0-100. */
  confidence: number;
  anti_cheat: string | null;
  methods: PlannedMethod[];
}

/** Chiede a Rust il piano per un gioco installato. */
export function fetchTranslationPlan(gamePath: string, engineHint?: string | null): Promise<TranslationPlan> {
  return invoke<TranslationPlan>('plan_translation', { gamePath, engineHint: engineHint || null });
}

/** I metodi che si possono davvero eseguire, nell'ordine del piano. */
export function runnableMethods(plan: TranslationPlan): PlannedMethod[] {
  return plan.methods.filter(m => !m.blocked_by);
}

/** Il metodo da provare dopo `afterId`, saltando quelli bloccati. */
export function nextMethod(plan: TranslationPlan, afterId: MethodId): PlannedMethod | null {
  const index = plan.methods.findIndex(m => m.id === afterId);
  if (index < 0) return null;
  return plan.methods.slice(index + 1).find(m => !m.blocked_by) ?? null;
}

/** Il metodo con quell'id, se il piano lo prevede. */
export function findMethod(plan: TranslationPlan | null | undefined, id: MethodId): PlannedMethod | null {
  return plan?.methods.find(m => m.id === id) ?? null;
}

/**
 * Il motore su cui decidere. Un motore riconosciuto dai FILE del gioco batte
 * quello dedotto dal nome: è lo stesso criterio per tutti i rami, invece di
 * ricalcolarlo in ognuno.
 */
export function resolveEngine(plan: TranslationPlan | null | undefined, fallback: string): string {
  if (plan && plan.engine_source === 'files') return plan.engine;
  return fallback;
}

/**
 * Cosa provare quando nemmeno l'aggancio a runtime è andato (bloccato, non
 * disponibile, gioco chiuso, iniezione fallita): il metodo che il piano mette
 * dopo `runtime-hook`. Oggi è l'OCR; domani qualunque metodo aggiunto al piano.
 */
export function methodAfterRuntime(plan: TranslationPlan | null | undefined): PlannedMethod | null {
  return plan ? nextMethod(plan, 'runtime-hook') : null;
}
