import { describe, it, expect } from 'vitest';

import {
  runnableMethods,
  nextMethod,
  findMethod,
  methodAfterRuntime,
  resolveEngine,
  type PlannedMethod,
  type TranslationPlan,
} from '@/lib/string-it/plan';

function m(id: PlannedMethod['id'], kind: PlannedMethod['kind'], blocked: string | null = null): PlannedMethod {
  return { id, kind, automatic: kind !== 'ocr' && kind !== 'page', route: null, blocked_by: blocked };
}

function plan(methods: PlannedMethod[], over: Partial<TranslationPlan> = {}): TranslationPlan {
  return { engine: 'Unity', engine_source: 'files', confidence: 90, anti_cheat: null, methods, ...over };
}

describe('string-it plan', () => {
  it('prova i metodi nell\'ordine del piano', () => {
    const p = plan([m('renpy-tl', 'static'), m('runtime-hook', 'runtime'), m('ocr-overlay', 'ocr')]);
    expect(nextMethod(p, 'renpy-tl')?.id).toBe('runtime-hook');
    expect(nextMethod(p, 'runtime-hook')?.id).toBe('ocr-overlay');
    expect(nextMethod(p, 'ocr-overlay')).toBeNull();
  });

  it('salta i metodi bloccati dall\'anti-cheat', () => {
    const blocked = 'anti-cheat:EasyAntiCheat';
    const p = plan(
      [m('unreal-locres', 'static'), m('runtime-hook', 'runtime', blocked), m('ocr-overlay', 'ocr')],
      { anti_cheat: 'EasyAntiCheat' },
    );
    expect(nextMethod(p, 'unreal-locres')?.id).toBe('ocr-overlay');
    expect(runnableMethods(p).map(x => x.id)).toEqual(['unreal-locres', 'ocr-overlay']);
  });

  it('un metodo che il piano non prevede non ha un successivo', () => {
    const p = plan([m('renpy-tl', 'static'), m('ocr-overlay', 'ocr')]);
    expect(nextMethod(p, 'unity-xunity')).toBeNull();
    expect(findMethod(p, 'unity-xunity')).toBeNull();
    expect(findMethod(null, 'renpy-tl')).toBeNull();
    expect(findMethod(p, 'renpy-tl')?.kind).toBe('static');
  });

  it('il motore letto dai file batte quello dedotto dal nome', () => {
    expect(resolveEngine(plan([], { engine: 'Godot', engine_source: 'files' }), 'Unity')).toBe('Godot');
    expect(resolveEngine(plan([], { engine: 'Godot', engine_source: 'hint' }), 'Unity')).toBe('Unity');
    expect(resolveEngine(plan([], { engine: 'Unknown', engine_source: 'none' }), 'Unity')).toBe('Unity');
    expect(resolveEngine(null, 'Unity')).toBe('Unity');
  });

  it('dopo il runtime non riuscito si passa al metodo successivo del piano', () => {
    const p = plan([m('unity-xunity', 'runtime'), m('runtime-hook', 'runtime'), m('ocr-overlay', 'ocr')]);
    expect(methodAfterRuntime(p)?.id).toBe('ocr-overlay');
    // senza piano non si inventa un metodo
    expect(methodAfterRuntime(null)).toBeNull();
  });
  it("vale anche quando il runtime è bloccato dall'anti-cheat", () => {
    const blocked = 'anti-cheat:BattlEye';
    const p = plan(
      [m('unity-xunity', 'runtime', blocked), m('runtime-hook', 'runtime', blocked), m('ocr-overlay', 'ocr')],
      { anti_cheat: 'BattlEye' },
    );
    expect(methodAfterRuntime(p)?.kind).toBe('ocr');
  });
});
