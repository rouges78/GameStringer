/**
 * Edge Cases and Error Scenarios Tests
 * 
 * Tests for:
 * - API returning malformed data
 * - Network errors
 * - Extreme data scenarios
 * - Race conditions
 * - Memory stress tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ensureArray, validateArray, safeMap, safeFilter } from '@/lib/array-utils';

describe('Edge Cases - Malformed API Data', () => {
  describe('Unexpected Data Types', () => {
    it('should handle API returning string instead of array', () => {
      const apiResponse = '{"games": []}';
      const games = ensureArray(apiResponse);
      
      expect(games).toEqual([]);
      expect(() => games.map(g => g)).not.toThrow();
    });

    it('should handle API returning number instead of array', () => {
      const apiResponse = 42;
      const games = ensureArray(apiResponse);
      
      expect(games).toEqual([]);
      expect(() => games.map(g => g)).not.toThrow();
    });

    it('should handle API returning boolean instead of array', () => {
      const apiResponse = true;
      const games = ensureArray(apiResponse);
      
      expect(games).toEqual([]);
      expect(() => games.map(g => g)).not.toThrow();
    });

    it('should handle API returning function instead of array', () => {
      const apiResponse = () => ['game1', 'game2'];
      const games = ensureArray(apiResponse);
      
      expect(games).toEqual([]);
      expect(() => games.map(g => g)).not.toThrow();
    });

    it('should handle API returning Symbol', () => {
      const apiResponse = Symbol('games');
      const games = ensureArray(apiResponse);
      
      expect(games).toEqual([]);
      expect(() => games.map(g => g)).not.toThrow();
    });

    it('should handle API returning BigInt', () => {
      const apiResponse = BigInt(9007199254740991);
      const games = ensureArray(apiResponse);
      
      expect(games).toEqual([]);
      expect(() => games.map(g => g)).not.toThrow();
    });
  });

  describe('Nested Object Structures', () => {
    it('should handle deeply nested object', () => {
      const apiResponse = {
        data: {
          response: {
            games: {
              items: [
                { id: '1', title: 'Game 1' }
              ]
            }
          }
        }
      };
      
      const games = ensureArray(apiResponse);
      expect(games).toEqual([]);
    });

    it('should handle object with array-like properties', () => {
      const apiResponse = {
        0: { id: '1', title: 'Game 1' },
        1: { id: '2', title: 'Game 2' },
        length: 2
      };
      
      const games = ensureArray(apiResponse);
      expect(games).toEqual([]);
    });

    it('should handle Map object', () => {
      const map = new Map([
        ['game1', { id: '1', title: 'Game 1' }],
        ['game2', { id: '2', title: 'Game 2' }]
      ]);
      
      const games = ensureArray(map);
      expect(games).toEqual([]);
    });

    it('should handle Set object', () => {
      const set = new Set([
        { id: '1', title: 'Game 1' },
        { id: '2', title: 'Game 2' }
      ]);
      
      const games = ensureArray(set);
      expect(games).toEqual([]);
    });
  });

  describe('Corrupted Array Data', () => {
    it('should handle array with mixed valid and invalid items', () => {
      const apiResponse = [
        { id: '1', title: 'Game 1' },
        null,
        undefined,
        { id: '2', title: 'Game 2' },
        'invalid',
        42,
        { id: '3', title: 'Game 3' }
      ];
      
      const games = ensureArray(apiResponse);
      expect(games.length).toBe(7);
      
      // Should not throw when mapping
      expect(() => {
        games.map((g: any) => g?.id || 'unknown');
      }).not.toThrow();
    });

    it('should handle array with circular references', () => {
      const obj: any = { id: '1', title: 'Game 1' };
      obj.self = obj;
      const apiResponse = [obj];
      
      const games = ensureArray(apiResponse);
      expect(games.length).toBe(1);
      expect(games[0]).toBe(obj);
    });

    it('should handle array with prototype pollution attempt', () => {
      const apiResponse = [
        { id: '1', title: 'Game 1' },
        { __proto__: { polluted: true } }
      ];
      
      const games = ensureArray(apiResponse);
      expect(games.length).toBe(2);
      expect(() => games.map(g => g)).not.toThrow();
    });
  });
});

describe('Edge Cases - Network Errors', () => {
  describe('Error Objects', () => {
    it('should handle Error object', () => {
      const error = new Error('Network error');
      const games = ensureArray(error);
      
      expect(games).toEqual([]);
      expect(() => games.map(g => g)).not.toThrow();
    });

    it('should handle TypeError', () => {
      const error = new TypeError('Cannot read property of undefined');
      const games = ensureArray(error);
      
      expect(games).toEqual([]);
    });

    it('should handle custom error object', () => {
      const error = {
        error: true,
        message: 'API failed',
        code: 500
      };
      
      const games = ensureArray(error);
      expect(games).toEqual([]);
    });
  });

  describe('Timeout and Abort Scenarios', () => {
    it('should handle AbortError', () => {
      const error = new DOMException('The operation was aborted', 'AbortError');
      const games = ensureArray(error);
      
      expect(games).toEqual([]);
    });

    it('should handle timeout with undefined result', () => {
      let result: any;
      // Simulate timeout - result never set
      
      const games = ensureArray(result);
      expect(games).toEqual([]);
    });
  });

  describe('Partial Response Scenarios', () => {
    it('should handle incomplete JSON response', () => {
      const incompleteJson = '{"games": [{"id": "1", "title": "Game 1"';
      const games = ensureArray(incompleteJson);
      
      expect(games).toEqual([]);
    });

    it('should handle response with missing required fields', () => {
      const apiResponse = [
        { id: '1' }, // missing title
        { title: 'Game 2' }, // missing id
        {} // missing everything
      ];
      
      const games = ensureArray(apiResponse);
      expect(games.length).toBe(3);
      
      // Should handle missing fields gracefully
      const titles = safeMap(games, (g: any) => g?.title || 'Unknown');
      expect(titles).toEqual(['Unknown', 'Game 2', 'Unknown']);
    });
  });
});

describe('Edge Cases - Extreme Data Scenarios', () => {
  describe('Large Data Sets', () => {
    it('should handle very large array (10,000 items)', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: `${i}`,
        title: `Game ${i}`,
        platform: 'Steam'
      }));
      
      const games = ensureArray(largeArray);
      expect(games.length).toBe(10000);
      
      // Should not throw on operations
      expect(() => {
        games.filter((g: any) => g.platform === 'Steam');
      }).not.toThrow();
    });

    it('should handle array with very long strings', () => {
      const longString = 'A'.repeat(100000);
      const apiResponse = [
        { id: '1', title: longString },
        { id: '2', title: longString }
      ];
      
      const games = ensureArray<any>(apiResponse);
      expect(games.length).toBe(2);
      expect(games[0].title.length).toBe(100000);
    });

    it('should handle deeply nested game objects', () => {
      const deepObject: any = { id: '1', title: 'Game 1' };
      let current = deepObject;
      
      // Create 100 levels of nesting
      for (let i = 0; i < 100; i++) {
        current.nested = { level: i };
        current = current.nested;
      }
      
      const games = ensureArray([deepObject]);
      expect(games.length).toBe(1);
    });
  });

  describe('Empty and Sparse Arrays', () => {
    it('should handle sparse array', () => {
      const sparseArray = new Array(100);
      sparseArray[0] = { id: '1', title: 'Game 1' };
      sparseArray[99] = { id: '2', title: 'Game 2' };
      
      const games = ensureArray(sparseArray);
      expect(games.length).toBe(100);
      
      // Should handle undefined elements
      const validGames = safeFilter(games, (g: any) => g !== undefined);
      expect(validGames.length).toBe(2);
    });

    it('should handle array with holes', () => {
      const arrayWithHoles = [
        { id: '1', title: 'Game 1' },
        ,
        ,
        { id: '2', title: 'Game 2' }
      ];
      
      const games = ensureArray(arrayWithHoles);
      expect(games.length).toBe(4);
    });
  });

  describe('Special Characters and Encoding', () => {
    it('should handle games with emoji in titles', () => {
      const apiResponse = [
        { id: '1', title: '🎮 Game 1 🎯' },
        { id: '2', title: '🚀 Space Game 🌟' }
      ];
      
      const games = ensureArray<any>(apiResponse);
      expect(games.length).toBe(2);
      expect(games[0].title).toContain('🎮');
    });

    it('should handle games with special Unicode characters', () => {
      const apiResponse = [
        { id: '1', title: 'Game™ ® © ℗' },
        { id: '2', title: 'Игра на русском' },
        { id: '3', title: '日本のゲーム' },
        { id: '4', title: '游戏中文' }
      ];
      
      const games = ensureArray(apiResponse);
      expect(games.length).toBe(4);
    });

    it('should handle games with HTML/XML entities', () => {
      const apiResponse = [
        { id: '1', title: 'Game &amp; More' },
        { id: '2', title: 'Game &lt;3&gt;' },
        { id: '3', title: 'Game &quot;Best&quot;' }
      ];
      
      const games = ensureArray(apiResponse);
      expect(games.length).toBe(3);
    });

    it('should handle games with SQL injection attempts', () => {
      const apiResponse = [
        { id: "1'; DROP TABLE games; --", title: 'Malicious Game' },
        { id: '2', title: "Game' OR '1'='1" }
      ];
      
      const games = ensureArray(apiResponse);
      expect(games.length).toBe(2);
    });
  });
});

describe('Edge Cases - Race Conditions and Async', () => {
  describe('Concurrent Updates', () => {
    it('should handle rapid successive updates', () => {
      let games: any[] = [];
      
      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        games = ensureArray([{ id: `${i}`, title: `Game ${i}` }]);
      }
      
      expect(games.length).toBe(1);
      expect(games[0].id).toBe('99');
    });

    it('should handle interleaved valid and invalid updates', () => {
      const updates = [
        [{ id: '1', title: 'Game 1' }],
        null,
        [{ id: '2', title: 'Game 2' }],
        undefined,
        [{ id: '3', title: 'Game 3' }],
        'invalid',
        [{ id: '4', title: 'Game 4' }]
      ];
      
      updates.forEach(update => {
        const games = ensureArray(update);
        expect(Array.isArray(games)).toBe(true);
      });
    });
  });

  describe('State Transitions', () => {
    it('should handle transition from loading to loaded', () => {
      let games: any = undefined; // Initial loading state
      
      games = ensureArray(games);
      expect(games).toEqual([]);
      
      // Simulate data loaded
      games = ensureArray([{ id: '1', title: 'Game 1' }]);
      expect(games.length).toBe(1);
    });

    it('should handle transition from loaded to error', () => {
      let games: any = [{ id: '1', title: 'Game 1' }];
      
      games = ensureArray(games);
      expect(games.length).toBe(1);
      
      // Simulate error
      games = ensureArray(null);
      expect(games).toEqual([]);
    });

    it('should handle transition from error to retry', () => {
      let games: any = null; // Error state
      
      games = ensureArray(games);
      expect(games).toEqual([]);
      
      // Simulate retry success
      games = ensureArray([{ id: '1', title: 'Game 1' }]);
      expect(games.length).toBe(1);
    });
  });
});

describe('Edge Cases - Memory and Performance', () => {
  describe('Memory Stress', () => {
    it('should handle multiple large arrays without memory leak', () => {
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        const largeArray = Array.from({ length: 1000 }, (_, j) => ({
          id: `${j}`,
          title: `Game ${j}`,
          data: new Array(100).fill('x')
        }));
        
        const games = ensureArray(largeArray);
        expect(games.length).toBe(1000);
      }
    });

    it('should handle array with many references to same object', () => {
      const sharedObject = { id: '1', title: 'Shared Game' };
      const apiResponse = Array.from({ length: 1000 }, () => sharedObject);
      
      const games = ensureArray(apiResponse);
      expect(games.length).toBe(1000);
      expect(games[0]).toBe(games[999]); // Same reference
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle filtering large dataset efficiently', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: `${i}`,
        title: `Game ${i}`,
        platform: i % 2 === 0 ? 'Steam' : 'Epic'
      }));
      
      const games = ensureArray(largeArray);
      
      const startTime = performance.now();
      const filtered = safeFilter(games, (g: any) => g.platform === 'Steam');
      const endTime = performance.now();
      
      expect(filtered.length).toBe(5000);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
    });

    it('should handle mapping large dataset efficiently', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: `${i}`,
        title: `Game ${i}`
      }));
      
      const games = ensureArray<any>(largeArray);
      
      const startTime = performance.now();
      const titles = safeMap(games, (g: any) => g.title);
      const endTime = performance.now();
      
      expect(titles.length).toBe(10000);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
    });
  });
});

describe('Edge Cases - Browser Compatibility', () => {
  describe('Frozen and Sealed Objects', () => {
    it('should handle frozen array', () => {
      const frozenArray = Object.freeze([
        { id: '1', title: 'Game 1' },
        { id: '2', title: 'Game 2' }
      ]);
      
      const games = ensureArray(frozenArray);
      expect(games.length).toBe(2);
      expect(Object.isFrozen(games)).toBe(true);
    });

    it('should handle sealed array', () => {
      const sealedArray = Object.seal([
        { id: '1', title: 'Game 1' },
        { id: '2', title: 'Game 2' }
      ]);
      
      const games = ensureArray(sealedArray);
      expect(games.length).toBe(2);
      expect(Object.isSealed(games)).toBe(true);
    });
  });

  describe('Proxy Objects', () => {
    it('should handle Proxy wrapping array', () => {
      const originalArray = [
        { id: '1', title: 'Game 1' },
        { id: '2', title: 'Game 2' }
      ];
      
      const proxyArray = new Proxy(originalArray, {
        get(target, prop) {
          return target[prop as any];
        }
      });
      
      const games = ensureArray(proxyArray);
      expect(games.length).toBe(2);
    });

    it('should handle Proxy wrapping non-array', () => {
      const proxyObject = new Proxy({}, {
        get() {
          return 'intercepted';
        }
      });
      
      const games = ensureArray(proxyObject);
      expect(games).toEqual([]);
    });
  });
});

describe('Edge Cases - Real-World API Scenarios', () => {
  describe('Steam API Responses', () => {
    it('should handle Steam API success response', () => {
      const steamResponse = {
        response: {
          games: [
            { appid: 570, name: 'Dota 2' },
            { appid: 730, name: 'Counter-Strike 2' }
          ]
        }
      };
      
      // Extract games array correctly
      const gamesArray = (steamResponse as any).response?.games;
      const games = ensureArray(gamesArray);
      
      expect(games.length).toBe(2);
    });

    it('should handle Steam API error response', () => {
      const steamError = {
        error: {
          code: 403,
          message: 'Access Denied'
        }
      };
      
      const games = ensureArray(steamError);
      expect(games).toEqual([]);
    });

    it('should handle Steam API rate limit response', () => {
      const rateLimitResponse = {
        error: 'Rate limit exceeded',
        retry_after: 60
      };
      
      const games = ensureArray(rateLimitResponse);
      expect(games).toEqual([]);
    });
  });

  describe('Epic Games API Responses', () => {
    it('should handle Epic Games API format', () => {
      const epicResponse = {
        data: {
          Catalog: {
            searchStore: {
              elements: [
                { id: 'epic1', title: 'Fortnite' },
                { id: 'epic2', title: 'Rocket League' }
              ]
            }
          }
        }
      };
      
      // Extract games array correctly
      const gamesArray = (epicResponse as any).data?.Catalog?.searchStore?.elements;
      const games = ensureArray(gamesArray);
      
      expect(games.length).toBe(2);
    });
  });

  describe('GOG API Responses', () => {
    it('should handle GOG API format', () => {
      const gogResponse = {
        products: [
          { id: 1, title: 'The Witcher 3' },
          { id: 2, title: 'Cyberpunk 2077' }
        ],
        page: 1,
        totalPages: 10
      };
      
      const games = ensureArray(gogResponse.products);
      expect(games.length).toBe(2);
    });
  });
});
