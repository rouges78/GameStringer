import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k, language: 'es', setLanguage: () => {} }),
}));
vi.mock('@/lib/settings-persistence', () => ({ persistSettingsToDisk: vi.fn().mockResolvedValue(undefined) }));
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

import { InteractiveTutorial } from '@/components/onboarding/interactive-tutorial';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { TOS_KEY, ONBOARDING_KEY, TUTORIAL_KEY } from '@/components/onboarding/first-run';

const card = () => document.querySelector('.z-\\[202\\]');

describe('InteractiveTutorial', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not open while the first-run wizard is still pending', () => {
    localStorage.setItem(TOS_KEY, '2');
    render(<InteractiveTutorial />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(card()).toBeNull();
  });

  it('centers the card when the step target is missing', () => {
    localStorage.setItem(TOS_KEY, '2');
    localStorage.setItem(ONBOARDING_KEY, '5');
    render(<InteractiveTutorial />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(card()).not.toBeNull();

    // passo 'library': selettore sidebar, ma l'elemento non c'è in questo DOM
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText('tutorial.next'));
    expect(screen.getByText('tutorial.steps.library.title')).toBeInTheDocument();
    expect(card()).toHaveClass('inset-0');

    // passo 'translator': ora è un passo centrato
    fireEvent.click(screen.getByText('tutorial.next'));
    expect(screen.getByText('tutorial.steps.translator.title')).toBeInTheDocument();
    expect(card()).toHaveClass('inset-0');
  });

  it('places the card next to the target when it exists', () => {
    localStorage.setItem(TOS_KEY, '2');
    localStorage.setItem(ONBOARDING_KEY, '5');
    const target = document.createElement('div');
    target.setAttribute('data-tutorial', 'nav-library');
    document.body.appendChild(target);
    try {
      render(<InteractiveTutorial />);
      act(() => { vi.advanceTimersByTime(1000); });
      for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText('tutorial.next'));
      expect(card()).not.toHaveClass('inset-0');
      expect((card() as HTMLElement).style.left).not.toBe('');
    } finally {
      target.remove();
    }
  });
});

describe('OnboardingWizard', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits for the Terms of Use, then saves the shown target language on Next', () => {
    render(<OnboardingWizard />);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.queryByText('onboarding.next')).toBeNull();

    localStorage.setItem(TOS_KEY, '2');
    act(() => { vi.advanceTimersByTime(1000); });
    fireEvent.click(screen.getByText('onboarding.next'));

    const saved = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    // nessuna scelta esplicita: vale la lingua dell'interfaccia, quella mostrata
    expect(saved.translation.defaultTargetLang).toBe('es');
  });

  it('marks the guided tour with its current version when closed', () => {
    localStorage.setItem(TOS_KEY, '2');
    render(<OnboardingWizard />);
    act(() => { vi.advanceTimersByTime(1000); });
    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' });
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('5');
    expect(localStorage.getItem(TUTORIAL_KEY)).toBe('5');
  });
});
