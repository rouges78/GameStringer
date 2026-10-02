import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: toastMock }));

import { TranslationBatchEditor } from '@/components/translation-batch-editor';

const translations = [
  { id: 't1', originalText: 'Hello', translatedText: 'Ciao', status: 'completed', filePath: 'a/b.txt' },
];

function renderEditor(onSave = vi.fn().mockResolvedValue(undefined)) {
  render(
    <TranslationBatchEditor translations={translations} onSave={onSave} onGenerateSuggestions={vi.fn()} />
  );
  fireEvent.click(screen.getByRole('checkbox'));
}

function setClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText, readText: vi.fn() }, configurable: true });
}

describe('TranslationBatchEditor toasts (sonner)', () => {
  beforeEach(() => {
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  it('confirms the copy only after the clipboard accepted it', async () => {
    setClipboard(vi.fn().mockResolvedValue(undefined));
    renderEditor();

    fireEvent.click(screen.getByRole('button', { name: /Copy Originals/ }));

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('common.copiatoNegliAppunti', { description: 'common.originalsCopiedCount' }));
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('reports a clipboard failure instead of a fake success', async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    renderEditor();

    fireEvent.click(screen.getByRole('button', { name: /Copy Originals/ }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('feedback.copyFailed'));
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('reports a failed save as an error, not success', async () => {
    renderEditor(vi.fn().mockRejectedValue(new Error('io')));

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Salve' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Selected/ }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('common.impossibileSalvareLeTraduzioni'));
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});
