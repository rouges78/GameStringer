import { describe, it, expect } from 'vitest';
import {
  buildFidelityPromptBlock,
  FIDELITY_PROMPT_BLOCK,
} from '@/lib/ai/fidelity-prompt';
import { buildTranslationPrompt } from '@/lib/translation/prompt-builder';

describe('buildFidelityPromptBlock (anti-censura, opt-in)', () => {
  it('ritorna stringa vuota quando disabilitato', () => {
    expect(buildFidelityPromptBlock(false)).toBe('');
    expect(buildFidelityPromptBlock(undefined)).toBe('');
  });

  it('ritorna il blocco quando abilitato', () => {
    const block = buildFidelityPromptBlock(true);
    expect(block).toBe(FIDELITY_PROMPT_BLOCK);
    expect(block.length).toBeGreaterThan(0);
  });

  it('il blocco impone fedeltà e vieta censura/rifiuto', () => {
    const b = buildFidelityPromptBlock(true).toLowerCase();
    expect(b).toContain('faithfully');
    expect(b).toContain('do not censor');
    expect(b).toContain('never refuse');
  });

  it('il blocco vieta di inventare/aggiungere contenuti (fedeltà, non ampliamento)', () => {
    const b = buildFidelityPromptBlock(true).toLowerCase();
    expect(b).toContain('never invent');
    expect(b).toContain('already present');
  });
});

describe('buildTranslationPrompt — wiring anti-censura', () => {
  const base = {
    texts: ['Hello world'],
    targetLanguage: 'it',
    sourceLanguage: 'en',
  };

  it('NON include il blocco per default (opt-in spento)', () => {
    const prompt = buildTranslationPrompt({ ...base });
    expect(prompt).not.toContain('Content fidelity');
  });

  it('include il blocco quando uncensored=true', () => {
    const prompt = buildTranslationPrompt({ ...base, uncensored: true });
    expect(prompt).toContain('Content fidelity');
    expect(prompt).toContain('Never refuse');
  });
});
