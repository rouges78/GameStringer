/**
 * Pagina Memoria: prima era fissata su EN→IT (initialize('en','it')) e passava
 * all'export sourceLang="en" targetLang="en", quindi XLIFF/CSV/JSON uscivano
 * etichettati EN→EN. Ora la coppia parte dalla lingua di destinazione
 * predefinita dell'utente ed è selezionabile tra le TM presenti su disco.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, configure } from '@testing-library/react';

// Sotto carico (suite in parallelo) il default di 1s di waitFor non basta.
configure({ asyncUtilTimeout: 5000 });

const { initializeMock, invokeMock } = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'ru' }),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/lib/tauri-api', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}));

let currentPair = { source: 'en', target: 'en' };
vi.mock('@/lib/translation-memory', () => ({
  translationMemory: {
    initialize: (source: string, target: string) => {
      currentPair = { source, target };
      return initializeMock(source, target);
    },
    export: () => ({
      sourceLanguage: currentPair.source,
      targetLanguage: currentPair.target,
      units: [{
        id: `u_${currentPair.target}`,
        sourceText: 'Open the gate',
        targetText: `gate-${currentPair.target}`,
        sourceLanguage: currentPair.source,
        targetLanguage: currentPair.target,
        provider: 'test', confidence: 1, verified: true, usageCount: 0,
        createdAt: '', updatedAt: '',
      }],
      stats: { totalUnits: 1, verifiedUnits: 1, totalUsageCount: 0, averageConfidence: 1, byProvider: {}, byContext: {} },
    }),
  },
}));
vi.mock('@/components/tools/export-dialog', () => ({
  ExportDialog: (props: { sourceLang?: string; targetLang?: string }) => (
    <div data-testid="export-dialog">{`${props.sourceLang}->${props.targetLang}`}</div>
  ),
}));

import MemoryPage from '@/app/memory/page';

describe('MemoryPage coppia di lingue', () => {
  beforeEach(() => {
    localStorage.clear();
    initializeMock.mockReset();
    initializeMock.mockResolvedValue(undefined);
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (cmd: string) =>
      cmd === 'list_translation_memories'
        ? [{ source_language: 'en', target_language: 'it', unit_count: 5 }]
        : null
    );
  });

  it('parte dalla lingua di destinazione dell\'utente, non da EN→IT', async () => {
    render(<MemoryPage />);
    await waitFor(() => expect(initializeMock).toHaveBeenCalledWith('en', 'ru'));
    expect(initializeMock).not.toHaveBeenCalledWith('en', 'it');
    await waitFor(() => expect(screen.getByText('gate-ru')).toBeTruthy());
    // export etichettato con la coppia vera, non en→en
    expect(screen.getByTestId('export-dialog').textContent).toBe('en->ru');
  });

  it('rispetta la lingua predefinita scelta nelle impostazioni', async () => {
    localStorage.setItem('gameStringerSettings', JSON.stringify({ translation: { defaultTargetLang: 'es' } }));
    render(<MemoryPage />);
    await waitFor(() => expect(initializeMock).toHaveBeenCalledWith('en', 'es'));
    await waitFor(() => expect(screen.getByTestId('export-dialog').textContent).toBe('en->es'));
  });

  it('permette di passare a un\'altra coppia presente su disco', async () => {
    render(<MemoryPage />);
    await waitFor(() => expect(screen.getByText('gate-ru')).toBeTruthy());

    fireEvent.keyDown(screen.getByLabelText('dictionary.languagePair'), { key: 'Enter' });
    fireEvent.click(await screen.findByText('EN → IT (5)'));

    await waitFor(() => expect(initializeMock).toHaveBeenCalledWith('en', 'it'));
    await waitFor(() => expect(screen.getByText('gate-it')).toBeTruthy());
    expect(screen.getByTestId('export-dialog').textContent).toBe('en->it');
  });
});
