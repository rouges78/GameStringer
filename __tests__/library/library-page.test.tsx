/**
 * Test per LibraryPage - Validazione correzioni games.map error
 * 
 * Verifica che:
 * 1. games.map non generi più errori
 * 2. Gestione corretta di diversi scenari di dati API
 * 3. Protezioni array funzionino correttamente
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureArray, validateArray, safeMap } from '@/lib/array-utils';

describe('LibraryPage - Test Caricamento Libreria', () => {
  describe('Protezioni Array', () => {
    it('dovrebbe gestire array valido correttamente', () => {
      const validGames = [
        { id: '1', title: 'Game 1', platform: 'Steam' },
        { id: '2', title: 'Game 2', platform: 'Steam' }
      ];

      const result = ensureArray(validGames);
      expect(result).toEqual(validGames);
      expect(Array.isArray(result)).toBe(true);
    });

    it('dovrebbe convertire null in array vuoto', () => {
      const result = ensureArray(null);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('dovrebbe convertire undefined in array vuoto', () => {
      const result = ensureArray(undefined);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('dovrebbe convertire oggetto in array vuoto', () => {
      const obj = { games: [1, 2, 3] };
      const result = ensureArray(obj);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('dovrebbe convertire stringa in array vuoto', () => {
      const result = ensureArray('not an array');
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('dovrebbe convertire numero in array vuoto', () => {
      const result = ensureArray(42);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Validazione Array', () => {
    it('dovrebbe validare array correttamente', () => {
      const validArray = [1, 2, 3];
      expect(validateArray(validArray, 'test')).toBe(true);
    });

    it('dovrebbe rilevare non-array', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      expect(validateArray(null, 'test')).toBe(false);
      expect(validateArray(undefined, 'test')).toBe(false);
      expect(validateArray({}, 'test')).toBe(false);
      expect(validateArray('string', 'test')).toBe(false);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Safe Map Operations', () => {
    it('dovrebbe mappare array valido', () => {
      const games = [
        { id: '1', title: 'Game 1' },
        { id: '2', title: 'Game 2' }
      ];

      const result = safeMap(games, (game: any) => game.title);
      expect(result).toEqual(['Game 1', 'Game 2']);
    });

    it('dovrebbe gestire null senza errori', () => {
      const result = safeMap(null, (item: any) => item);
      expect(result).toEqual([]);
    });

    it('dovrebbe gestire undefined senza errori', () => {
      const result = safeMap(undefined, (item: any) => item);
      expect(result).toEqual([]);
    });

    it('dovrebbe gestire oggetto senza errori', () => {
      const result = safeMap({ data: 'test' }, (item: any) => item);
      expect(result).toEqual([]);
    });
  });

  describe('Scenari API Reali', () => {
    it('dovrebbe gestire risposta API con array valido', () => {
      const apiResponse = [
        { id: 'steam_570', title: 'Dota 2', platform: 'Steam' },
        { id: 'steam_730', title: 'CS2', platform: 'Steam' }
      ];

      const games = ensureArray(apiResponse);
      expect(games.length).toBe(2);
      expect(() => games.map((g: any) => g.title)).not.toThrow();
    });

    it('dovrebbe gestire risposta API con oggetto invece di array', () => {
      const apiResponse = {
        games: [
          { id: 'steam_570', title: 'Dota 2' }
        ]
      };

      const games = ensureArray(apiResponse);
      expect(games).toEqual([]);
      expect(() => games.map(g => g)).not.toThrow();
    });

    it('dovrebbe gestire risposta API null', () => {
      const apiResponse = null;

      const games = ensureArray(apiResponse);
      expect(games).toEqual([]);
      expect(() => games.map(g => g)).not.toThrow();
    });

    it('dovrebbe gestire risposta API undefined', () => {
      const apiResponse = undefined;

      const games = ensureArray(apiResponse);
      expect(games).toEqual([]);
      expect(() => games.map(g => g)).not.toThrow();
    });

    it('dovrebbe gestire errore di rete (throw)', () => {
      let games: any[] = [];

      try {
        throw new Error('Network error');
      } catch (error) {
        games = ensureArray(null);
      }

      expect(games).toEqual([]);
      expect(() => games.map(g => g)).not.toThrow();
    });

    it('dovrebbe gestire dati malformati', () => {
      const malformedData = 'invalid json string';

      const games = ensureArray(malformedData);
      expect(games).toEqual([]);
      expect(() => games.map(g => g)).not.toThrow();
    });
  });

  describe('Operazioni di Filtraggio', () => {
    it('dovrebbe filtrare array valido', () => {
      const games = [
        { id: '1', title: 'Game 1', platform: 'Steam' },
        { id: '2', title: 'Game 2', platform: 'Epic' },
        { id: '3', title: 'Game 3', platform: 'Steam' }
      ];

      const safeGames = ensureArray<any>(games);
      const filtered = safeGames.filter((g: any) => g.platform === 'Steam');

      expect(filtered.length).toBe(2);
      expect(filtered[0].title).toBe('Game 1');
      expect(filtered[1].title).toBe('Game 3');
    });

    it('dovrebbe filtrare array vuoto senza errori', () => {
      const games = ensureArray(null);
      const filtered = games.filter((g: any) => g.platform === 'Steam');

      expect(filtered).toEqual([]);
    });

    it('dovrebbe gestire filtri multipli', () => {
      const games = [
        { id: '1', title: 'VR Game', platform: 'Steam', is_vr: true },
        { id: '2', title: 'Normal Game', platform: 'Steam', is_vr: false },
        { id: '3', title: 'VR Game 2', platform: 'Epic', is_vr: true }
      ];

      const safeGames = ensureArray<any>(games);
      const filtered = safeGames
        .filter((g: any) => g.platform === 'Steam')
        .filter((g: any) => g.is_vr);

      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe('VR Game');
    });
  });

  describe('Edge Cases', () => {
    it('dovrebbe gestire array con elementi null', () => {
      const games = [
        { id: '1', title: 'Game 1' },
        null,
        { id: '2', title: 'Game 2' }
      ];

      const safeGames = ensureArray(games);
      expect(() => safeGames.map(g => g)).not.toThrow();
    });

    it('dovrebbe gestire array con elementi undefined', () => {
      const games = [
        { id: '1', title: 'Game 1' },
        undefined,
        { id: '2', title: 'Game 2' }
      ];

      const safeGames = ensureArray(games);
      expect(() => safeGames.map(g => g)).not.toThrow();
    });

    it('dovrebbe gestire array vuoto', () => {
      const games = ensureArray([]);

      expect(games).toEqual([]);
      expect(() => games.map(g => g)).not.toThrow();
      expect(() => games.filter(g => true)).not.toThrow();
    });

    it('dovrebbe gestire array molto grande', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: `${i}`,
        title: `Game ${i}`
      }));

      const safeGames = ensureArray(largeArray);
      expect(safeGames.length).toBe(10000);
      expect(() => safeGames.map((g: any) => g.title)).not.toThrow();
    });
  });
});
