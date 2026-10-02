/**
 * SubtitleTranslator: le righe che onTranslate restituisce '' (traduzione fallita)
 * restano non tradotte (niente spunta verde) e l'avviso conta solo le righe
 * rimaste senza traduzione dopo QUESTO giro — non un totale cumulativo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (k: string) => (k === 'subtitleTranslator.linesNotTranslated' ? 'not translated: {n}' : k),
    language: 'it',
  }),
}));

import { SubtitleTranslator } from '@/components/translator/subtitle-translator';

const SRT = [
  '1', '00:00:01,000 --> 00:00:02,000', 'Hello', '',
  '2', '00:00:03,000 --> 00:00:04,000', 'Goodbye', '',
  '3', '00:00:05,000 --> 00:00:06,000', 'Again', '',
].join('\n');

async function loadSrt() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([SRT], 'sample.srt', { type: 'text/plain' })] } });
  await screen.findByText('sample.srt');
}

describe('SubtitleTranslator — righe non tradotte', () => {
  beforeEach(() => {
    toastMock.warning.mockClear();
  });

  it('una riga fallita resta originale e l\'avviso conta solo questo giro', async () => {
    const onTranslate = vi.fn()
      .mockResolvedValueOnce(['Ciao', '', 'Ancora'])     // giro 1: 1 fallita
      .mockResolvedValueOnce(['Ciao', '', 'Ancora']);    // giro 2: stessa riga fallita
    render(<SubtitleTranslator onTranslate={onTranslate} />);
    await loadSrt();

    fireEvent.click(screen.getByText('subtitleTranslator.translateAll'));
    await waitFor(() => expect(toastMock.warning).toHaveBeenCalledTimes(1));
    expect(toastMock.warning.mock.calls[0][0]).toBe('not translated: 1');

    // La riga fallita mostra il sorgente, non una "traduzione" uguale al sorgente
    expect(screen.getByText('Ciao')).toBeInTheDocument();
    expect(screen.getAllByText('Goodbye')).toHaveLength(1);

    fireEvent.click(screen.getByText('subtitleTranslator.translateAll'));
    await waitFor(() => expect(toastMock.warning).toHaveBeenCalledTimes(2));
    // Non cumulativo: ancora 1, non 2
    expect(toastMock.warning.mock.calls[1][0]).toBe('not translated: 1');
  });

  it('tutto tradotto: nessun avviso', async () => {
    const onTranslate = vi.fn().mockResolvedValueOnce(['Ciao', 'Addio', 'Ancora']);
    render(<SubtitleTranslator onTranslate={onTranslate} />);
    await loadSrt();

    fireEvent.click(screen.getByText('subtitleTranslator.translateAll'));
    await screen.findByText('Addio');
    expect(toastMock.warning).not.toHaveBeenCalled();
  });
});
