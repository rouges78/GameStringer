import { describe, it, expect, vi, beforeEach } from 'vitest';

// Every dependency that could reach a paid API is mocked, so the test can check
// which of them start() still calls after cancel().
const m = vi.hoisted(() => ({
  translateSmart: vi.fn(),
  extractTerms: vi.fn(),
  runQualityGates: vi.fn(),
  suggestBatchImprovements: vi.fn(),
}));

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/translation-memory', () => ({
  translationMemory: {
    initialize: vi.fn(async () => {}),
    findExact: vi.fn(() => null),
    search: vi.fn(() => []),
    getRelevantTMContext: vi.fn(() => ''),
    add: vi.fn(async () => {}),
    incrementUsage: vi.fn(async () => {}),
  },
  translateWithMemory: vi.fn(),
}));

vi.mock('@/lib/quality/quality-gates', () => ({
  runQualityGates: m.runQualityGates,
  quickQualityCheck: vi.fn(() => ({ passed: true, score: 95, criticalIssues: [] })),
}));

vi.mock('@/lib/ai/content-classifier', () => ({ classifyBatch: vi.fn() }));

vi.mock('@/lib/ai/ai-translate-direct', () => ({ translateSmart: m.translateSmart }));

vi.mock('@/lib/auto-glossary', () => ({
  buildRelevantGlossaryHint: vi.fn(() => ''),
  extractTerms: m.extractTerms,
  loadGlossary: vi.fn(() => null),
  loadGlossaryConfig: vi.fn(() => ({ enabled: true, autoExtractOnFirstBatch: true })),
}));

vi.mock('@/lib/context-harvester', () => ({
  harvestBatch: vi.fn(() => ({ stats: { stringsWithConstraints: 0, stringsWithPlaceholders: 0 } })),
}));

vi.mock('@/lib/ai/genre-prompts', () => ({ composeGenreAndCharacterContext: vi.fn(() => '') }));

vi.mock('@/lib/ai/ai-post-edit', () => ({ suggestBatchImprovements: m.suggestBatchImprovements }));

vi.mock('@/lib/remote-config', () => ({
  getModelConfig: vi.fn(),
  getProviderPrice1k: vi.fn(),
}));

import { BatchTranslator, type BatchJobStatus } from '@/lib/batch/batch-translator';
import { translationMemory } from '@/lib/translation-memory';

// Six strings long enough for the automatic glossary extraction to kick in.
const texts = Array.from({ length: 6 }, (_, i) => ({ text: `Dialogue line number ${i + 1}` }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

function setup() {
  const translator = new BatchTranslator();
  translator.createJob(texts, {
    name: 'cancel test',
    gameId: 'game-1',
    gameName: 'Game',
    classifyContent: false,
    runQualityChecks: true,
  });
  const statuses: BatchJobStatus[] = [];
  translator.onStatusChange(s => statuses.push(s));
  return { translator, statuses };
}

const translated = { success: true, provider: 'mock', translations: texts.map(t => `IT ${t.text}`) };

describe('BatchTranslator.start() after cancel()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.extractTerms.mockResolvedValue({ newTerms: [], duplicates: 0, provider: 'mock', timeMs: 1 });
    m.runQualityGates.mockReturnValue({ passed: true, overallScore: 90, checks: [] });
    m.suggestBatchImprovements.mockResolvedValue([]);
  });

  it('without cancel, extracts the glossary, validates and completes', async () => {
    m.translateSmart.mockResolvedValue(translated);
    const { translator, statuses } = setup();

    const job = await translator.start();

    expect(job.status).toBe('completed');
    expect(m.extractTerms).toHaveBeenCalledTimes(1);
    expect(m.runQualityGates).toHaveBeenCalled();
    expect(statuses).toContain('completed');
  });

  it('cancel during translation skips glossary extraction and validation, status stays cancelled', async () => {
    const batch = deferred<typeof translated>();
    m.translateSmart.mockReturnValue(batch.promise);
    const { translator, statuses } = setup();

    const running = translator.start();
    await vi.waitFor(() => expect(m.translateSmart).toHaveBeenCalled());
    translator.cancel();
    batch.resolve(translated);
    const job = await running;

    expect(job.status).toBe('cancelled');
    expect(m.extractTerms).not.toHaveBeenCalled();
    expect(m.runQualityGates).not.toHaveBeenCalled();
    expect(m.suggestBatchImprovements).not.toHaveBeenCalled();
    expect(statuses).not.toContain('validating');
    expect(statuses).not.toContain('completed');
  });

  it('cancel during glossary extraction skips validation, status stays cancelled', async () => {
    m.translateSmart.mockResolvedValue(translated);
    const glossary = deferred<{ newTerms: string[]; duplicates: number; provider: string; timeMs: number }>();
    m.extractTerms.mockReturnValue(glossary.promise);
    const { translator, statuses } = setup();

    const running = translator.start();
    await vi.waitFor(() => expect(m.extractTerms).toHaveBeenCalled());
    translator.cancel();
    glossary.resolve({ newTerms: [], duplicates: 0, provider: 'mock', timeMs: 1 });
    const job = await running;

    expect(job.status).toBe('cancelled');
    expect(m.runQualityGates).not.toHaveBeenCalled();
    expect(statuses).not.toContain('completed');
  });

  it('an error thrown after cancel does not turn the cancelled job into failed', async () => {
    let rejectInit!: (e: Error) => void;
    const initPromise = new Promise<void>((_, reject) => { rejectInit = reject; });
    vi.mocked(translationMemory.initialize).mockReturnValueOnce(initPromise);
    const { translator, statuses } = setup();

    const running = translator.start();
    await vi.waitFor(() => expect(translationMemory.initialize).toHaveBeenCalled());
    translator.cancel();
    rejectInit(new Error('TM unavailable'));
    const job = await running;

    expect(job.status).toBe('cancelled');
    expect(job.error).toBeUndefined();
    expect(m.translateSmart).not.toHaveBeenCalled();
    expect(statuses).not.toContain('failed');
  });
});
