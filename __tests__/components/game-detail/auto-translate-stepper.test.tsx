import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// t() restituisce la chiave; le due frasi con segnaposto lo sostituiscono
// davvero, così si vede il numero che arriva all'utente.
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (k: string) =>
      k === 'postTranslation.ocrDescPartial' ? 'partial {pct}%'
        : k === 'postTranslation.writtenTitle' ? 'written {n} ({pct}%)'
          : k,
    language: 'it',
  }),
}));
vi.mock('@/components/donation-dialog', () => ({ DonationDialog: () => null }));
// framer-motion chiama window.scrollTo, che jsdom non implementa (solo rumore).
vi.stubGlobal('scrollTo', vi.fn());
vi.mock('@/lib/donation-gate', () => ({
  addTranslationCount: vi.fn(),
  shouldAskForSupport: () => false,
  markSupportAsked: vi.fn(),
}));

import { AutoTranslateStepper } from '@/components/game-detail/auto-translate-stepper';

type Step = { label: string; status: 'pending' | 'running' | 'done' | 'error'; detail?: string };

const baseResult = {
  successRate: 0,
  duration: 1,
  deliverables: 0,
  errors: 0,
  engine: 'GameMaker',
  targetLang: 'it',
  stringsTranslated: 0,
  stringsTotal: 120,
  verification: { checked: 0, verified: 0, missing: [] as string[], verifiedNames: [] as string[], stringsWritten: 0, runtimeOnly: false },
};

function renderStepper(props: {
  steps: Step[];
  error?: string | null;
  result?: typeof baseResult | null;
  onCreatePatch?: () => void;
}) {
  return render(
    <AutoTranslateStepper
      steps={props.steps}
      error={props.error ?? null}
      result={props.result ?? null}
      currentFlagLabel="IT"
      onClose={vi.fn()}
      onClearResult={vi.fn()}
      onCreatePatch={props.onCreatePatch ?? vi.fn()}
      game={{ title: 'Gioco', installPath: 'C:/giochi/gioco' }}
    />,
  );
}

describe('AutoTranslateStepper', () => {
  it('keeps a failed step red and still shows the result and Close once the run is over', () => {
    renderStepper({
      steps: [
        { label: 'Analisi', status: 'done' },
        { label: 'Esecuzione', status: 'error', detail: 'Nessuna stringa è entrata nel gioco' },
        { label: 'Validazione', status: 'done' },
      ],
      result: baseResult,
    });
    // il passo fallito resta un errore, non diventa una spunta verde
    expect(screen.getByText('Nessuna stringa è entrata nel gioco')).toHaveClass('text-red-400/60');
    expect(screen.getByText('postTranslation.unverifiedTitle')).toBeInTheDocument();
    expect(screen.getByText('gameDetails.close')).toBeInTheDocument();
  });

  it('shows neither result nor Close while a step is still running', () => {
    renderStepper({
      steps: [
        { label: 'Analisi', status: 'done' },
        { label: 'Esecuzione', status: 'running' },
      ],
      result: baseResult,
    });
    expect(screen.queryByText('postTranslation.unverifiedTitle')).toBeNull();
    expect(screen.queryByText('gameDetails.close')).toBeNull();
  });

  it('with an error message offers a single Close, in the banner, and no result', () => {
    renderStepper({
      steps: [{ label: 'Esecuzione', status: 'error' }],
      error: 'Errore traduzione UE: boom',
      result: baseResult,
    });
    expect(screen.getByText('Errore traduzione UE: boom')).toBeInTheDocument();
    expect(screen.getByText('common.chiudi')).toBeInTheDocument();
    expect(screen.queryByText('gameDetails.close')).toBeNull();
    expect(screen.queryByText('postTranslation.unverifiedTitle')).toBeNull();
  });

  it('treats successRate as a percent: 62% RPG Maker coverage offers OCR and says 62%', () => {
    renderStepper({
      steps: [{ label: 'Applica', status: 'done' }],
      result: {
        ...baseResult,
        engine: 'RPG Maker MV',
        successRate: 62,
        stringsTranslated: 62,
        stringsTotal: 100,
        verification: { checked: 1, verified: 1, missing: [], verifiedNames: ['RPG Maker MV'], stringsWritten: 62, runtimeOnly: false },
      },
    });
    expect(screen.getByText('postTranslation.ocrTitle')).toBeInTheDocument();
    expect(screen.getByText('partial 62%')).toBeInTheDocument();
  });

  it('does not offer OCR for RPG Maker at 95% verified coverage', () => {
    renderStepper({
      steps: [{ label: 'Applica', status: 'done' }],
      result: {
        ...baseResult,
        engine: 'RPG Maker MV',
        successRate: 95,
        stringsTranslated: 95,
        stringsTotal: 100,
        verification: { checked: 1, verified: 1, missing: [], verifiedNames: ['RPG Maker MV'], stringsWritten: 95, runtimeOnly: false },
      },
    });
    expect(screen.queryByText('postTranslation.ocrTitle')).toBeNull();
  });

  it('shows a real 1% as 1%, not as 100%', () => {
    renderStepper({
      steps: [{ label: 'Applica', status: 'done' }],
      result: {
        ...baseResult,
        engine: 'Unreal Engine',
        successRate: 1,
        stringsTranslated: 30,
        stringsTotal: 2400,
        verification: { checked: 1, verified: 1, missing: [], verifiedNames: ['Game_GameStringer_it_P.pak'], stringsWritten: 30, runtimeOnly: false },
      },
    });
    expect(screen.getByText('written 30 (1%)')).toBeInTheDocument();
  });

  it('"Create patch" opens the GsPack export instead of calling a missing command', () => {
    const onCreatePatch = vi.fn();
    renderStepper({ steps: [{ label: 'Applica', status: 'done' }], result: baseResult, onCreatePatch });
    fireEvent.click(screen.getByText('common.creaPatch'));
    expect(onCreatePatch).toHaveBeenCalledTimes(1);
  });
});
