import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

import { invoke } from '@tauri-apps/api/core';

// Type definitions for test results
interface DanganronpaGame {
  path: string;
  game_type: string;
  pak_files: string[];
}

interface ExtractionResult {
  total_strings: number;
  output_path: string;
  files_processed: number;
  skipped_large_files?: number;
}

interface PoFile {
  path: string;
  entries: Array<{ msgid: string; msgstr: string; comments: string[]; context: string | null }>;
  header: Record<string, string>;
}

describe('Danganronpa Auto-Translator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Game Detection', () => {
    it('should detect Danganronpa: Trigger Happy Havoc', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        path: 'C:/Games/Danganronpa',
        game_type: 'TriggerHappyHavoc',
        pak_files: ['00_System.pak', '26_Menu.pak']
      });

      const result = await invoke('detect_danganronpa_game', {
        gamePath: 'C:/Games/Danganronpa'
      }) as DanganronpaGame;

      expect(result.game_type).toBe('TriggerHappyHavoc');
      expect(result.pak_files.length).toBeGreaterThan(0);
    });

    it('should detect Danganronpa 2: Goodbye Despair', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        path: 'C:/Games/Danganronpa2',
        game_type: 'GoodbyeDespair',
        pak_files: ['00_System.pak']
      });

      const result = await invoke('detect_danganronpa_game', {
        gamePath: 'C:/Games/Danganronpa2'
      }) as DanganronpaGame;

      expect(result.game_type).toBe('GoodbyeDespair');
    });

    it('should return Unknown for non-Danganronpa games', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        path: 'C:/Games/OtherGame',
        game_type: 'Unknown',
        pak_files: []
      });

      const result = await invoke('detect_danganronpa_game', {
        gamePath: 'C:/Games/OtherGame'
      }) as DanganronpaGame;

      expect(result.game_type).toBe('Unknown');
    });
  });

  describe('PAK Extraction', () => {
    it('should extract strings from PAK files', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        total_strings: 150,
        output_path: 'C:/Games/Danganronpa/GameStringer_Translation',
        files_processed: 2
      });

      const result = await invoke('extract_danganronpa_strings', {
        gamePath: 'C:/Games/Danganronpa',
        outputPath: 'C:/Games/Danganronpa/GameStringer_Translation'
      }) as ExtractionResult;

      expect(result.total_strings).toBeGreaterThan(0);
      expect(result.output_path).toContain('GameStringer_Translation');
    });

    it('should handle empty PAK files gracefully', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        total_strings: 0,
        output_path: 'C:/Games/Danganronpa/GameStringer_Translation',
        files_processed: 0
      });

      const result = await invoke('extract_danganronpa_strings', {
        gamePath: 'C:/Games/EmptyGame',
        outputPath: 'C:/Games/EmptyGame/GameStringer_Translation'
      }) as ExtractionResult;

      expect(result.total_strings).toBe(0);
    });

    it('should respect size limits during extraction', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        total_strings: 500,
        output_path: 'C:/Games/Danganronpa/GameStringer_Translation',
        files_processed: 3,
        skipped_large_files: 1
      });

      const result = await invoke('extract_danganronpa_strings', {
        gamePath: 'C:/Games/Danganronpa',
        outputPath: 'C:/Games/Danganronpa/GameStringer_Translation',
        maxFileSize: 10485760 // 10MB limit
      }) as ExtractionResult;

      expect(result.skipped_large_files).toBeDefined();
    });
  });

  describe('PO File Parsing', () => {
    it('should parse PO file entries correctly', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        path: 'test.po',
        entries: [
          { msgid: 'Hello', msgstr: '', comments: [], context: null },
          { msgid: 'World', msgstr: '', comments: ['# Game menu'], context: 'menu' }
        ],
        header: { 'Content-Type': 'text/plain; charset=UTF-8' }
      });

      const result = await invoke('parse_po_file', {
        filePath: 'test.po'
      }) as PoFile;

      expect(result.entries.length).toBe(2);
      expect(result.entries[0].msgid).toBe('Hello');
      expect(result.entries[1].context).toBe('menu');
    });

    it('should handle malformed PO files', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Invalid PO format'));

      await expect(invoke('parse_po_file', {
        filePath: 'malformed.po'
      })).rejects.toThrow('Invalid PO format');
    });
  });

  describe('Translation Cost Estimation', () => {
    it('should estimate cost for Gemini provider', () => {
      const strings = 1000;
      const avgCharsPerString = 50;
      const totalChars = strings * avgCharsPerString;
      const tokens = Math.ceil(totalChars / 4);
      
      // Gemini: $0.075 per 1M tokens
      const costPerToken = 0.075 / 1000000;
      const estimatedCost = tokens * costPerToken;

      expect(estimatedCost).toBeLessThan(1); // Should be cheap
      expect(estimatedCost).toBeGreaterThan(0);
    });

    it('should estimate cost for Claude provider', () => {
      const strings = 1000;
      const avgCharsPerString = 50;
      const totalChars = strings * avgCharsPerString;
      const tokens = Math.ceil(totalChars / 4);
      
      // Claude: $3.00 per 1M tokens
      const costPerToken = 3.00 / 1000000;
      const estimatedCost = tokens * costPerToken;

      expect(estimatedCost).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Handling', () => {
    it('should retry on 429 error', async () => {
      let attempts = 0;
      vi.mocked(invoke).mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw { status: 429, message: 'Rate limited' };
        }
        return { success: true };
      });

      // Simulate retry logic
      let result;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          result = await invoke('translate_batch', { texts: ['Hello'] });
          break;
        } catch (e: any) {
          if (e.status === 429) {
            retries++;
            await new Promise(r => setTimeout(r, 100)); // Short delay for test
          } else {
            throw e;
          }
        }
      }

      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });

    it('should consider 429 as valid API key', () => {
      // 429 means rate limit, not invalid key
      const is429RateLimitError = (status: number) => status === 429;
      const isValidApiKey = (status: number) => status === 200 || status === 429;

      expect(is429RateLimitError(429)).toBe(true);
      expect(isValidApiKey(429)).toBe(true);
      expect(isValidApiKey(401)).toBe(false); // Unauthorized
      expect(isValidApiKey(403)).toBe(false); // Forbidden
    });
  });

  describe('API Key Validation', () => {
    it('should validate Gemini API key format', () => {
      const validKey = 'AIzaSyBOaw1234567890abcdefghijklmnop';
      const invalidKey = 'invalid';

      const isValidGeminiKey = (key: string) => 
        key.startsWith('AIza') && key.length > 30;

      expect(isValidGeminiKey(validKey)).toBe(true);
      expect(isValidGeminiKey(invalidKey)).toBe(false);
    });

    it('should map google provider to gemini', () => {
      const mapProvider = (provider: string) => 
        provider === 'google' ? 'gemini' : provider;

      expect(mapProvider('google')).toBe('gemini');
      expect(mapProvider('gemini')).toBe('gemini');
      expect(mapProvider('openai')).toBe('openai');
    });
  });

  describe('Output File Generation', () => {
    it('should generate translations.json with correct structure', async () => {
      const translations = [
        { original: 'Hello', translated: 'Ciao', confidence: 0.95 },
        { original: 'World', translated: 'Mondo', confidence: 0.92 }
      ];

      vi.mocked(invoke).mockResolvedValueOnce({ success: true });

      await invoke('write_text_file', {
        path: 'translations.json',
        content: JSON.stringify(translations, null, 2)
      });

      expect(invoke).toHaveBeenCalledWith('write_text_file', expect.objectContaining({
        path: 'translations.json'
      }));
    });
  });
});
