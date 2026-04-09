import { describe, it, expect } from 'vitest';
import {
  translateRequestSchema,
  batchTranslateRequestSchema,
  secretsRequestSchema,
  dictionaryAddSchema,
  validateBody,
} from '@/lib/api-schemas';

describe('translateRequestSchema', () => {
  it('should accept valid translation request', () => {
    const result = validateBody(translateRequestSchema, {
      text: 'Hello world',
      targetLanguage: 'it',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe('Hello world');
      expect(result.data.targetLanguage).toBe('it');
      expect(result.data.sourceLanguage).toBe('auto');
      expect(result.data.provider).toBe('openai');
    }
  });

  it('should reject empty text', () => {
    const result = validateBody(translateRequestSchema, {
      text: '',
      targetLanguage: 'it',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing targetLanguage', () => {
    const result = validateBody(translateRequestSchema, {
      text: 'Hello',
    });
    expect(result.success).toBe(false);
  });

  it('should reject text exceeding 50000 chars', () => {
    const result = validateBody(translateRequestSchema, {
      text: 'a'.repeat(50001),
      targetLanguage: 'it',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('50000');
    }
  });

  it('should accept valid provider', () => {
    const result = validateBody(translateRequestSchema, {
      text: 'Hello',
      targetLanguage: 'en',
      provider: 'gemini',
    });
    expect(result.success).toBe(true);
  });

  it('should reject context exceeding 5000 chars', () => {
    const result = validateBody(translateRequestSchema, {
      text: 'Hello',
      targetLanguage: 'it',
      context: 'x'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional apiKey', () => {
    const result = validateBody(translateRequestSchema, {
      text: 'Hello',
      targetLanguage: 'it',
      apiKey: 'sk-test-key-123',
    });
    expect(result.success).toBe(true);
  });
});

describe('batchTranslateRequestSchema', () => {
  it('should accept valid batch request', () => {
    const result = validateBody(batchTranslateRequestSchema, {
      texts: ['Hello', 'World'],
      targetLanguage: 'it',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.texts).toHaveLength(2);
    }
  });

  it('should reject empty texts array', () => {
    const result = validateBody(batchTranslateRequestSchema, {
      texts: [],
      targetLanguage: 'it',
    });
    expect(result.success).toBe(false);
  });

  it('should reject more than 20 texts', () => {
    const result = validateBody(batchTranslateRequestSchema, {
      texts: Array(21).fill('text'),
      targetLanguage: 'it',
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-array texts', () => {
    const result = validateBody(batchTranslateRequestSchema, {
      texts: 'not an array',
      targetLanguage: 'it',
    });
    expect(result.success).toBe(false);
  });

  it('should reject individual text exceeding limit', () => {
    const result = validateBody(batchTranslateRequestSchema, {
      texts: ['a'.repeat(50001)],
      targetLanguage: 'it',
    });
    expect(result.success).toBe(false);
  });
});

describe('secretsRequestSchema', () => {
  it('should accept valid API key name', () => {
    const result = validateBody(secretsRequestSchema, {
      key: 'OPENAI_API_KEY',
      value: 'sk-test-123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid API key name', () => {
    const result = validateBody(secretsRequestSchema, {
      key: 'INVALID_KEY',
      value: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('should accept all allowed key names', () => {
    const allowedKeys = [
      'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY',
      'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY', 'OPENROUTER_API_KEY',
    ];
    for (const key of allowedKeys) {
      const result = validateBody(secretsRequestSchema, { key, value: 'test' });
      expect(result.success).toBe(true);
    }
  });

  it('should reject value exceeding 256 chars', () => {
    const result = validateBody(secretsRequestSchema, {
      key: 'OPENAI_API_KEY',
      value: 'a'.repeat(257),
    });
    expect(result.success).toBe(false);
  });

  it('should default value to empty string', () => {
    const result = validateBody(secretsRequestSchema, {
      key: 'OPENAI_API_KEY',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('');
    }
  });
});

describe('dictionaryAddSchema', () => {
  it('should accept valid dictionary entry', () => {
    const result = validateBody(dictionaryAddSchema, {
      original: 'Hello',
      translated: 'Ciao',
      gameId: 'game-123',
      targetLanguage: 'it',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty original text', () => {
    const result = validateBody(dictionaryAddSchema, {
      original: '',
      translated: 'Ciao',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty translated text', () => {
    const result = validateBody(dictionaryAddSchema, {
      original: 'Hello',
      translated: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject original exceeding 10000 chars', () => {
    const result = validateBody(dictionaryAddSchema, {
      original: 'a'.repeat(10001),
      translated: 'Ciao',
    });
    expect(result.success).toBe(false);
  });

  it('should default targetLanguage to it', () => {
    const result = validateBody(dictionaryAddSchema, {
      original: 'Hello',
      translated: 'Ciao',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetLanguage).toBe('it');
    }
  });
});

describe('validateBody', () => {
  it('should return success with parsed data on valid input', () => {
    const result = validateBody(translateRequestSchema, {
      text: 'test',
      targetLanguage: 'en',
    });
    expect(result.success).toBe(true);
  });

  it('should return error message on invalid input', () => {
    const result = validateBody(translateRequestSchema, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('should include field path in error messages', () => {
    const result = validateBody(translateRequestSchema, { text: 123 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('text');
    }
  });
});
