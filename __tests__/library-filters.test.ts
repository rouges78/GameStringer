import { describe, it, expect } from 'vitest';
import {
  UNKNOWN_ENGINE,
  normalizeEngine,
  matchesEngineFilter,
  buildEngineChips,
  mergeGameLists,
  isPlaceholderTitle,
  applySteamTitles,
} from '@/lib/library-filters';

type G = { id: string; app_id: string; platform: string; title: string; is_installed?: boolean };

const steam = (appId: string, title: string, extra: Partial<G> = {}): G => ({
  id: `steam_${appId}`, app_id: appId, platform: 'Steam', title, ...extra,
});

describe('normalizeEngine', () => {
  it('porta null, undefined, vuoto e "unknown" a Unknown', () => {
    expect(normalizeEngine(null)).toBe(UNKNOWN_ENGINE);
    expect(normalizeEngine(undefined)).toBe(UNKNOWN_ENGINE);
    expect(normalizeEngine('')).toBe(UNKNOWN_ENGINE);
    expect(normalizeEngine('   ')).toBe(UNKNOWN_ENGINE);
    expect(normalizeEngine('unknown')).toBe(UNKNOWN_ENGINE);
    expect(normalizeEngine('Unknown')).toBe(UNKNOWN_ENGINE);
  });

  it('lascia invariato un motore rilevato', () => {
    expect(normalizeEngine('Unity')).toBe('Unity');
    expect(normalizeEngine(' Unreal Engine 4 ')).toBe('Unreal Engine 4');
  });
});

describe('matchesEngineFilter', () => {
  it('senza selezione passa tutto', () => {
    expect(matchesEngineFilter(null, [])).toBe(true);
    expect(matchesEngineFilter('Unity', [])).toBe(true);
  });

  it('un motore vuoto NON passa sotto il chip Unity (era il bug: "unity".includes(""))', () => {
    expect(matchesEngineFilter(null, ['Unity'])).toBe(false);
    expect(matchesEngineFilter(undefined, ['Unity'])).toBe(false);
    expect(matchesEngineFilter('', ['Unreal Engine', 'Godot'])).toBe(false);
  });

  it('un motore vuoto o "Unknown" passa solo sotto Unknown', () => {
    expect(matchesEngineFilter(null, [UNKNOWN_ENGINE])).toBe(true);
    expect(matchesEngineFilter('', [UNKNOWN_ENGINE])).toBe(true);
    expect(matchesEngineFilter('Unknown', [UNKNOWN_ENGINE])).toBe(true);
    expect(matchesEngineFilter('Unity', [UNKNOWN_ENGINE])).toBe(false);
  });

  it('confronta il motore esatto, senza distinguere maiuscole', () => {
    expect(matchesEngineFilter('Unity', ['Unity'])).toBe(true);
    expect(matchesEngineFilter('unity', ['Unity'])).toBe(true);
    expect(matchesEngineFilter('Unity', ['Godot', 'Unity'])).toBe(true);
    expect(matchesEngineFilter('Unreal Engine 4', ['Unity'])).toBe(false);
  });
});

describe('buildEngineChips', () => {
  it('genera i chip dai motori rilevati, ordinati e senza doppioni, con Unknown in coda', () => {
    expect(buildEngineChips(['Unity', null, 'Godot', 'unity', 'Unreal Engine 4', '', 'Unknown'])).toEqual([
      'Godot', 'Unity', 'Unreal Engine 4', UNKNOWN_ENGINE,
    ]);
  });

  it('senza giochi senza motore non mostra Unknown', () => {
    expect(buildEngineChips(['Unity', 'Godot'])).toEqual(['Godot', 'Unity']);
  });

  it('non inventa motori che nessun gioco ha', () => {
    expect(buildEngineChips(['Unity'])).toEqual(['Unity']);
    expect(buildEngineChips([])).toEqual([]);
  });

  it('mantiene visibili le selezioni salvate, con la loro etichetta, per poterle togliere', () => {
    expect(buildEngineChips(['Unity'], ['RPG Maker'])).toEqual(['RPG Maker', 'Unity']);
    expect(buildEngineChips(['Unity'], [UNKNOWN_ENGINE])).toEqual(['Unity', UNKNOWN_ENGINE]);
    expect(buildEngineChips(['unity'], ['Unity'])).toEqual(['Unity']);
  });
});

describe('mergeGameLists', () => {
  it('tiene i giochi assenti dalla lista nuova (posseduti non installati, altri store)', () => {
    const current: G[] = [
      steam('10', 'Owned Not Installed'),
      { id: 'epic_a', app_id: 'a', platform: 'Epic Games', title: 'Epic A' },
      steam('20', 'Installed', { is_installed: true }),
    ];
    const incoming: G[] = [steam('20', 'Installed', { is_installed: true })];
    const merged = mergeGameLists(current, incoming);
    expect(merged.map(g => g.title)).toEqual(['Owned Not Installed', 'Epic A', 'Installed']);
  });

  it('per i giochi in entrambe vince la versione nuova, e aggiunge quelli nuovi', () => {
    const current: G[] = [steam('20', 'Old', { is_installed: false })];
    const incoming: G[] = [steam('20', 'New', { is_installed: true }), steam('30', 'Brand New')];
    const merged = mergeGameLists(current, incoming);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ app_id: '20', title: 'New', is_installed: true });
    expect(merged[1]).toMatchObject({ app_id: '30', title: 'Brand New' });
  });

  it('riconosce lo stesso gioco Steam con id "steam_X", "steam_shared_X" o senza app_id', () => {
    const current: G[] = [{ id: 'steam_42', app_id: '', platform: 'Steam', title: 'From force refresh' }];
    const incoming: G[] = [{ id: 'steam_shared_42', app_id: '42', platform: 'Steam', title: 'Shared' }];
    const merged = mergeGameLists(current, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('Shared');
  });

  it('non confonde giochi di store diversi con lo stesso id', () => {
    const current: G[] = [{ id: '7', app_id: '7', platform: 'GOG', title: 'GOG 7' }];
    const incoming: G[] = [steam('7', 'Steam 7')];
    expect(mergeGameLists(current, incoming)).toHaveLength(2);
  });

  it('con lista nuova vuota restituisce quella corrente intatta', () => {
    const current: G[] = [steam('1', 'A'), steam('2', 'B')];
    expect(mergeGameLists(current, [])).toEqual(current);
  });
});

describe('isPlaceholderTitle', () => {
  it('riconosce titoli mancanti e segnaposto', () => {
    expect(isPlaceholderTitle('')).toBe(true);
    expect(isPlaceholderTitle(null)).toBe(true);
    expect(isPlaceholderTitle('Game 12345')).toBe(true);
    expect(isPlaceholderTitle('Shared Game 12345')).toBe(true);
  });

  it('non scambia un nome vero per un segnaposto', () => {
    expect(isPlaceholderTitle('Game Dev Tycoon')).toBe(false);
    expect(isPlaceholderTitle('Portal 2')).toBe(false);
  });
});

describe('applySteamTitles', () => {
  // Forma reale di update_remote_game_database: GameInfo grezzi (steam_app_id, install_path, ...)
  const dbEntries = [
    { steam_app_id: 100, title: 'Hollow Knight', install_path: 'C:/x' },
    { steam_app_id: 200, title: 'Game 200' },
    { steam_app_id: 300, title: 'Not In Library' },
    { steam_app_id: 400, title: 'Better Name' },
  ];

  it('aggiorna solo il titolo dei giochi Steam con nome segnaposto, senza toccare altro', () => {
    const games: Array<G & { install_dir?: string }> = [
      { ...steam('100', 'Game 100'), install_dir: 'D:/Games/HK' },
      steam('400', 'Real Name'),
    ];
    const { games: next, updated } = applySteamTitles(games, dbEntries);
    expect(updated).toBe(1);
    expect(next[0]).toEqual({ ...games[0], title: 'Hollow Knight' });
    expect(next[1]).toBe(games[1]);
  });

  it('non aggiunge né toglie giochi (Epic/GOG e giochi assenti dal DB restano)', () => {
    const games: G[] = [
      steam('100', 'Game 100'),
      { id: 'epic_a', app_id: 'a', platform: 'Epic Games', title: 'Epic A' },
      steam('999', 'Game 999'),
    ];
    const { games: next } = applySteamTitles(games, dbEntries);
    expect(next).toHaveLength(3);
    expect(next.map(g => g.title)).toEqual(['Hollow Knight', 'Epic A', 'Game 999']);
  });

  it('ignora nomi segnaposto nel DB e trova i giochi condivisi', () => {
    const games: G[] = [
      steam('200', 'Game 200'),
      { id: 'steam_shared_100', app_id: '100', platform: 'Steam', title: 'Shared Game 100' },
    ];
    const { games: next, updated } = applySteamTitles(games, dbEntries);
    expect(updated).toBe(1);
    expect(next.map(g => g.title)).toEqual(['Game 200', 'Hollow Knight']);
  });

  it('con risposta vuota o nulla restituisce la stessa lista', () => {
    const games: G[] = [steam('100', 'Game 100')];
    expect(applySteamTitles(games, [])).toEqual({ games, updated: 0 });
    expect(applySteamTitles(games, null).games).toBe(games);
  });
});
