/**
 * MTPEWorkflow: una riga che l'AI non ha tradotto arriva con traduzione vuota.
 * Prima «Approva» la salvava in Translation Memory come voce verificata vuota
 * e l'export TSV scriveva "sorgente<TAB>". Ora Approva è disabilitato con una
 * spiegazione, e il handler rifiuta comunque.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { tmAdd } = vi.hoisted(() => ({ tmAdd: vi.fn(async () => undefined) }));

vi.mock('@/lib/translation-memory', () => ({ translationMemory: { add: tmAdd } }));
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k, language: 'it' }),
}));

import { MTPEWorkflow } from '@/components/translator/mtpe-workflow';

const approveButton = () => screen.getByText('mtpeWorkflowComp.approve').closest('button')!;

describe('MTPEWorkflow — traduzione vuota', () => {
  beforeEach(() => tmAdd.mockClear());

  it('Approva disabilitato con spiegazione; nessuna voce TM', () => {
    const onComplete = vi.fn();
    render(
      <MTPEWorkflow
        translations={[{ source: 'Hello', translation: '   ' }]}
        targetLang="it"
        onComplete={onComplete}
      />,
    );
    expect(approveButton()).toBeDisabled();
    expect(screen.getByText('mtpeWorkflowComp.emptyTranslationCannotApprove')).toBeInTheDocument();

    fireEvent.click(approveButton());
    expect(tmAdd).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('con traduzione presente Approva resta attivo e salva in TM', async () => {
    const onComplete = vi.fn();
    render(
      <MTPEWorkflow
        translations={[{ source: 'Hello', translation: 'Ciao' }]}
        targetLang="it"
        onComplete={onComplete}
      />,
    );
    expect(approveButton()).not.toBeDisabled();
    expect(screen.queryByText('mtpeWorkflowComp.emptyTranslationCannotApprove')).toBeNull();

    fireEvent.click(approveButton());
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(tmAdd).toHaveBeenCalledWith('Hello', 'Ciao', expect.objectContaining({ verified: true }));
  });

  it('la riga vuota si può ancora scrivere a mano (Modifica → Salva)', async () => {
    const onComplete = vi.fn();
    render(
      <MTPEWorkflow
        translations={[{ source: 'Hello', translation: '' }]}
        targetLang="it"
        onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByText('common.edit').closest('button')!);
    fireEvent.change(screen.getByPlaceholderText('mtpeWorkflowComp.editTranslationPlaceholder'), {
      target: { value: 'Ciao' },
    });
    fireEvent.click(screen.getByText('mtpeWorkflowComp.saveChanges').closest('button')!);
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(tmAdd).toHaveBeenCalledWith('Hello', 'Ciao', expect.objectContaining({ provider: 'mtpe_edited' }));
  });
});
