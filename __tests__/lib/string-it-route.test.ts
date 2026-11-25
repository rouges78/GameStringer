import { describe, expect, it } from 'vitest';

import { engineMatches, hasDirectRoute, pageRouteFor } from '@/lib/string-it/route';

describe('String it: ramo per motore', () => {
  it('riconosce i motori con ramo dedicato, senza badare alle maiuscole', () => {
    expect(engineMatches('Unity', 'unity')).toBe(true);
    expect(engineMatches('Unreal Engine 5', 'unreal')).toBe(true);
    expect(engineMatches("Ren'Py", 'renpy')).toBe(true);
    expect(engineMatches('RenPy', 'renpy')).toBe(true);
    expect(engineMatches('Spike Chunsoft', 'danganronpa')).toBe(true);
    expect(engineMatches('NW.js', 'tyrano')).toBe(true);
    expect(engineMatches('Electron', 'tyrano')).toBe(true);
    expect(engineMatches('RPG Maker MV', 'rpgmaker')).toBe(true);
    expect(engineMatches('Hendrix_Localization', 'hendrix')).toBe(true);
    expect(engineMatches('Visionaire Studio', 'visionaire')).toBe(true);
    expect(engineMatches('Godot 4', 'godot')).toBe(true);
  });

  it('non confonde motori diversi', () => {
    expect(engineMatches('Unreal Engine', 'unity')).toBe(false);
    expect(engineMatches('GameMaker', 'rpgmaker')).toBe(false);
  });

  it('i motori senza ramo dedicato vanno al workflow generico', () => {
    expect(hasDirectRoute('GameMaker')).toBe(false);
    expect(hasDirectRoute('RE Engine')).toBe(false);
    expect(hasDirectRoute('')).toBe(false);
    expect(hasDirectRoute('Unity')).toBe(true);
  });

  it('manda Wolf RPG, Bethesda, CRI e Telltale alla loro pagina', () => {
    expect(pageRouteFor('Wolf RPG Editor')?.href).toBe('/wolfrpg-patcher');
    expect(pageRouteFor('Creation Engine')?.href).toBe('/bethesda-patcher');
    expect(pageRouteFor('CRI Middleware')?.href).toBe('/cri-patcher');
    expect(pageRouteFor('Telltale Tool')?.href).toBe('/telltale-patcher');
  });

  it('non scambia Wolfenstein per Wolf RPG né un nome con "cri" dentro per CRI', () => {
    expect(pageRouteFor('id Tech (Wolfenstein)')).toBeUndefined();
    expect(pageRouteFor('Cricket Engine')).toBeUndefined();
  });
});
