/**
 * Integrità del corpus fixture engine.
 *
 * Le fixture Ren'Py / RPG Maker MV / TyranoScript / Kirikiri sono parsate
 * lato RUST (src-tauri), quindi qui non si testa l'estrazione ma si
 * GARANTISCE che il corpus resti valido e completo: file presenti, JSON
 * validi, marcatori di dialogo attesi. Un futuro harness cargo potrà
 * consumare le stesse fixture (path stabile: __tests__/fixtures/engines/).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', 'fixtures', 'engines');

describe('corpus fixture — integrità', () => {
  it('tutti i file attesi esistono', () => {
    const expected = [
      'formats/sample.po', 'formats/sample.xliff', 'formats/sample.resx',
      'formats/sample.strings', 'formats/sample.json', 'formats/sample.ini',
      'formats/sample.properties', 'formats/sample.csv',
      'subtitles/sample.srt', 'subtitles/sample.vtt', 'subtitles/sample.ass',
      'unreal/Game.locres',
      'renpy/script.rpy',
      'rpgmaker-mv/www/data/System.json',
      'rpgmaker-mv/www/data/Actors.json',
      'rpgmaker-mv/www/data/Map001.json',
      'tyrano/data/scenario/scene1.ks',
      'kirikiri/scenario/first.ks',
      'fonts/latin-only.ttf',
      'fonts/latin-cyr-el.ttf',
      // Fixture binarie per l'harness Rust (src-tauri/tests/engine_fixtures.rs)
      'godot/test.pck',
      'unreal/Game_v2.locres',
      'danganronpa/test.stx',
      'cri/test.cpk',
      'bethesda/Skyrim_English.STRINGS',
      'bethesda/Skyrim_English.DLSTRINGS',
      'bethesda/test.bsa',
      'README.md',
    ];
    for (const rel of expected) {
      expect(existsSync(join(ROOT, rel)), `manca ${rel}`).toBe(true);
    }
  });

  it("Ren'Py: label, dialoghi e menu presenti", () => {
    const rpy = readFileSync(join(ROOT, 'renpy/script.rpy'), 'utf-8');
    expect(rpy).toMatch(/^label start:/m);
    expect(rpy).toContain('e "Welcome to the kingdom of Eldoria!"');
    expect(rpy).toMatch(/^\s+menu:/m);
    expect(rpy).toContain('[player_name]'); // placeholder da preservare
  });

  it('RPG Maker MV: JSON validi con le strutture chiave', () => {
    const system = JSON.parse(readFileSync(join(ROOT, 'rpgmaker-mv/www/data/System.json'), 'utf-8'));
    expect(system.gameTitle).toBe('MicroQuest MV');
    expect(system.terms.commands).toContain('Fight');

    const actors = JSON.parse(readFileSync(join(ROOT, 'rpgmaker-mv/www/data/Actors.json'), 'utf-8'));
    expect(actors[0]).toBeNull(); // convenzione RPG Maker: indice 0 nullo
    expect(actors[1].name).toBe('Harold');

    const map = JSON.parse(readFileSync(join(ROOT, 'rpgmaker-mv/www/data/Map001.json'), 'utf-8'));
    const codes = map.events[1].pages[0].list.map((c: { code: number }) => c.code);
    expect(codes).toContain(101); // show text header
    expect(codes).toContain(401); // riga di testo
    expect(codes).toContain(102); // scelta multipla
  });

  it('TyranoScript: tag e dialoghi presenti', () => {
    const ks = readFileSync(join(ROOT, 'tyrano/data/scenario/scene1.ks'), 'utf-8');
    expect(ks).toMatch(/^\*start$/m);
    expect(ks).toContain('Welcome to the kingdom of Eldoria![p]');
    expect(ks).toContain('[glink text="Fight the dragon"');
  });

  it('Kirikiri: marcatori di dialogo presenti', () => {
    const ks = readFileSync(join(ROOT, 'kirikiri/scenario/first.ks'), 'utf-8');
    expect(ks).toContain('【Eileen】');
    expect(ks).toContain('Welcome to the kingdom of Eldoria![l][r]');
  });

  it('.locres: magic bytes corretti (0x0E14DA7A little-endian)', () => {
    for (const f of ['unreal/Game.locres', 'unreal/Game_v2.locres']) {
      expect(readFileSync(join(ROOT, f)).readUInt32LE(0)).toBe(0x0E14DA7A);
    }
  });

  it('fixture binarie Rust: magic corretti (Godot GDPC, STX, CPK, BSA)', () => {
    // Godot PCK: 0x43504447 LE = "GDPC"
    expect(readFileSync(join(ROOT, 'godot/test.pck')).readUInt32LE(0)).toBe(0x43504447);
    // Danganronpa STX: "STX\0"
    expect(readFileSync(join(ROOT, 'danganronpa/test.stx')).subarray(0, 4).toString('latin1')).toBe('STX\0');
    // CRI CPK: "CPK " + @UTF a 0x10
    const cpk = readFileSync(join(ROOT, 'cri/test.cpk'));
    expect(cpk.subarray(0, 4).toString('latin1')).toBe('CPK ');
    expect(cpk.subarray(0x10, 0x14).toString('latin1')).toBe('@UTF');
    // Bethesda BSA: 0x00415342 LE = "BSA\0", versione 104
    const bsa = readFileSync(join(ROOT, 'bethesda/test.bsa'));
    expect(bsa.readUInt32LE(0)).toBe(0x00415342);
    expect(bsa.readUInt32LE(4)).toBe(104);
  });

  it('Bethesda string table: header count coerente', () => {
    const strings = readFileSync(join(ROOT, 'bethesda/Skyrim_English.STRINGS'));
    expect(strings.readUInt32LE(0)).toBe(3); // 3 entry
    const dl = readFileSync(join(ROOT, 'bethesda/Skyrim_English.DLSTRINGS'));
    expect(dl.readUInt32LE(0)).toBe(2); // 2 entry
  });

  it('Unreal locres v2: versione 2 nel byte dopo il magic', () => {
    // magic(4) + version(1): la fixture v2 deve dichiarare version=2
    expect(readFileSync(join(ROOT, 'unreal/Game_v2.locres'))[4]).toBe(2);
  });
});
