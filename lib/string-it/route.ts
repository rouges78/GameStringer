// Quale ramo di String it gestisce un motore.
//
// Le stesse regole stavano scritte due volte dentro components/game-detail-client.tsx:
// una lista DIRECT_ENGINES in handleStringIt e un `engX.includes(...)` in testa a
// ogni ramo di startAutoTranslate. Qui c'è una sola copia, con i test.
// Il confronto è sul nome del motore in minuscolo, come prima.

export type EngineRoute =
  | 'danganronpa'
  | 'hendrix'
  | 'renpy'
  | 'visionaire'
  | 'tyrano'
  | 'unity'
  | 'unreal'
  | 'godot'
  | 'rpgmaker';

const MATCHERS: Record<EngineRoute, (e: string) => boolean> = {
  danganronpa: e => e.includes('spike') || e.includes('danganronpa'),
  hendrix: e => e.includes('hendrix'),
  renpy: e => e.includes("ren'py") || e.includes('renpy'),
  visionaire: e => e.includes('visionaire'),
  tyrano: e => e.includes('tyrano') || e.includes('nw.js') || e.includes('electron'),
  unity: e => e.includes('unity'),
  unreal: e => e.includes('unreal'),
  godot: e => e.includes('godot'),
  rpgmaker: e => e.includes('rpg maker') || e.includes('rpgmaker'),
};

/** Il motore va nel ramo `route`? (stesso test che ogni ramo faceva da sé) */
export function engineMatches(engine: string, route: EngineRoute): boolean {
  return MATCHERS[route](engine.toLowerCase());
}

/** Motori che hanno un ramo dedicato e quindi non passano dal workflow generico. */
export function hasDirectRoute(engine: string): boolean {
  const e = engine.toLowerCase();
  return (Object.keys(MATCHERS) as EngineRoute[]).some(r => MATCHERS[r](e));
}

export interface EnginePageRoute {
  match: (eng: string) => boolean;
  href: string;
  engine: string;
  tool: string;
}

/**
 * Motori che String it non traduce da sé: li manda alla pagina dedicata con un
 * messaggio onesto. `engine` e `tool` sono nomi propri: entrano nei testi
 * tradotti come {engine}/{tool}.
 */
export const ENGINE_PAGE_ROUTES: EnginePageRoute[] = [
  // 'wolf' da solo prenderebbe anche Wolfenstein (id Tech).
  { match: e => e.includes('wolf') && e.includes('rpg'), href: '/wolfrpg-patcher', engine: 'Wolf RPG', tool: 'Wolf RPG Patcher' },
  { match: e => e.includes('creation engine') || e.includes('bethesda'), href: '/bethesda-patcher', engine: 'Bethesda', tool: 'Bethesda Patcher' },
  // CRI è middleware (archivi .cpk), non un motore: parola intera, per non
  // agganciare nomi di motore che contengono «cri».
  { match: e => /\bcri\b|criware/.test(e), href: '/cri-patcher', engine: 'CRI', tool: 'CRI Patcher' },
  { match: e => e.includes('telltale'), href: '/telltale-patcher', engine: 'Telltale', tool: 'Telltale Patcher' },
];

export function pageRouteFor(engine: string): EnginePageRoute | undefined {
  const e = engine.toLowerCase();
  return ENGINE_PAGE_ROUTES.find(r => r.match(e));
}
