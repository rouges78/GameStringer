/**
 * Corpus fixture engine — Unreal .locres (lib/patchers/unreal-pak-parser.ts).
 *
 * La fixture Game.locres è stata costruita in modo INDIPENDENTE dal parser
 * (script Python che segue il formato Unreal legacy v0), quindi questo test
 * congela il formato: se parseLocres/buildLocres cambiano in modo
 * incompatibile con i file reali, la fixture li smaschera anche quando il
 * round-trip interno continuerebbe a passare.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  parseLocres, buildLocres, extractStringsFromLocres,
  applyTranslationsToLocres, detectLanguageFromPath,
} from '@/lib/patchers/unreal-pak-parser';

const FIXTURE = join(__dirname, '..', 'fixtures', 'engines', 'unreal', 'Game.locres');

function loadFixture(): ArrayBuffer {
  const buf = readFileSync(FIXTURE);
  // Copia in un ArrayBuffer "pulito" (senza offset del pool di Node)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('Unreal .locres — fixture indipendente (formato v0)', () => {
  it('parsa la fixture: 2 namespace, 4 stringhe', () => {
    const data = parseLocres(loadFixture());
    expect(data).not.toBeNull();
    expect(data!.version).toBe(0);
    expect(data!.namespaces.map(n => n.namespace)).toEqual(['UI', 'Dialog']);
    expect(data!.totalStrings).toBe(4);

    const strings = extractStringsFromLocres(data!);
    expect(strings).toContainEqual({
      key: 'npc_greeting', namespace: 'Dialog', value: 'Welcome to Eldoria, traveler!',
    });
  });

  it('applica le traduzioni e ricostruisce un .locres valido', () => {
    const data = parseLocres(loadFixture())!;
    const translated = applyTranslationsToLocres(data, {
      'UI::menu_start': 'Inizia avventura',
      'Dialog::npc_greeting': 'Benvenuto a Eldoria, viandante!',
    });

    const rebuilt = buildLocres(translated);
    const reparsed = parseLocres(rebuilt);
    expect(reparsed).not.toBeNull();

    const strings = extractStringsFromLocres(reparsed!);
    expect(strings).toContainEqual({
      key: 'menu_start', namespace: 'UI', value: 'Inizia avventura',
    });
    expect(strings).toContainEqual({
      key: 'npc_greeting', namespace: 'Dialog', value: 'Benvenuto a Eldoria, viandante!',
    });
    // Le stringhe non tradotte restano intatte
    expect(strings).toContainEqual({
      key: 'boss_taunt', namespace: 'Dialog', value: 'You shall not pass!',
    });
  });

  it('round-trip build→parse preserva tutto (anche caratteri accentati)', () => {
    const original = {
      version: 0,
      totalStrings: 2,
      namespaces: [{
        namespace: 'Test',
        entries: [
          { key: 'a', value: 'Città è già lì — perché?', hash: 0 },
          { key: 'b', value: 'plain ascii', hash: 0 },
        ],
      }],
    };
    const reparsed = parseLocres(buildLocres(original));
    expect(reparsed).not.toBeNull();
    expect(reparsed!.namespaces[0].entries.map(e => e.value)).toEqual([
      'Città è già lì — perché?', 'plain ascii',
    ]);
  });

  it('input corrotto → null, senza lanciare', () => {
    const garbage = new TextEncoder().encode('not a locres file at all!').buffer;
    expect(parseLocres(garbage as ArrayBuffer)).toBeNull();
  });

  it('detectLanguageFromPath riconosce la lingua dal percorso', () => {
    expect(detectLanguageFromPath('Game/Content/Localization/Game/it/Game.locres')).toBe('it');
    expect(detectLanguageFromPath('Localization/Game/ja/Game.locres')).toBe('ja');
  });
});
