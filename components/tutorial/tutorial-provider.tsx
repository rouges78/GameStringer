'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { TutorialConfig, TutorialStep } from '@/lib/types/tutorial';

/**
 * querySelector sicuro: gestisce selettori con :contains() (non CSS standard)
 * cercando manualmente tra gli elementi del DOM.
 */
export function safeFindElement(selector: string): Element | null {
  // Gestisci selettori con :contains("...")
  const containsMatch = selector.match(/^(.+?):contains\(["'](.+?)["']\)$/);
  if (containsMatch) {
    const [, tagSelector, text] = containsMatch;
    try {
      const candidates = document.querySelectorAll(tagSelector);
      for (const el of candidates) {
        if (el.textContent?.includes(text)) return el;
      }
    } catch { /* selettore tag invalido */ }
    return null;
  }
  // Selettore CSS standard
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

interface TutorialContextType {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  currentTutorial: TutorialConfig | null;
  currentStepData: TutorialStep | null;
  startTutorial: (tutorial?: TutorialConfig) => void;
  nextStep: () => void;
  prevStep: () => void;
  endTutorial: () => void;
  skipTutorial: () => void;
  goToStep: (step: number) => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

const COMPLETED_KEY = 'gamestringer_completed_tutorials';

function getCompletedTutorials(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COMPLETED_KEY) || '[]');
  } catch { return []; }
}

function markTutorialCompleted(tutorialId: string) {
  const completed = getCompletedTutorials();
  if (!completed.includes(tutorialId)) {
    completed.push(tutorialId);
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(completed));
  }
}

interface TutorialProviderProps {
  children: React.ReactNode;
  userId?: string;
}

export const TutorialProvider: React.FC<TutorialProviderProps> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentTutorial, setCurrentTutorial] = useState<TutorialConfig | null>(null);

  const totalSteps = currentTutorial?.steps.length ?? 0;
  const currentStepData = currentTutorial?.steps[currentStep] ?? null;

  const startTutorial = useCallback((tutorial?: TutorialConfig) => {
    if (!tutorial) return;
    setCurrentTutorial(tutorial);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const completeTutorial = useCallback(() => {
    if (currentTutorial) {
      markTutorialCompleted(currentTutorial.id);
    }
    setIsActive(false);
    setCurrentStep(0);
    setCurrentTutorial(null);
  }, [currentTutorial]);

  const nextStep = useCallback(() => {
    if (!currentTutorial) return;
    const steps = currentTutorial.steps;
    let next = currentStep + 1;
    // Salta step opzionali se l'elemento target non esiste
    while (next < steps.length && steps[next].optional) {
      const el = safeFindElement(steps[next].target);
      if (el) break;
      next++;
    }
    if (next >= steps.length) {
      completeTutorial();
    } else {
      setCurrentStep(next);
    }
  }, [currentStep, currentTutorial, completeTutorial]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const endTutorial = useCallback(() => {
    completeTutorial();
  }, [completeTutorial]);

  const skipTutorial = useCallback(() => {
    if (currentTutorial) {
      markTutorialCompleted(currentTutorial.id);
    }
    setIsActive(false);
    setCurrentStep(0);
    setCurrentTutorial(null);
    localStorage.setItem('tutorialSkipped', 'true');
  }, [currentTutorial]);

  const goToStep = useCallback((step: number) => {
    if (currentTutorial && step >= 0 && step < currentTutorial.steps.length) {
      setCurrentStep(step);
    }
  }, [currentTutorial]);

  // Navigazione tastiera
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        skipTutorial();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, nextStep, prevStep, skipTutorial]);

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStep,
        totalSteps,
        currentTutorial,
        currentStepData,
        startTutorial,
        nextStep,
        prevStep,
        endTutorial,
        skipTutorial,
        goToStep,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    return {
      isActive: false,
      currentStep: 0,
      totalSteps: 0,
      currentTutorial: null as TutorialConfig | null,
      currentStepData: null as TutorialStep | null,
      startTutorial: (_tutorial?: TutorialConfig) => {},
      nextStep: () => {},
      prevStep: () => {},
      endTutorial: () => {},
      skipTutorial: () => {},
      goToStep: (_step: number) => {},
      state: { isActive: false, currentStep: 0, totalSteps: 0 },
    };
  }
  return {
    ...context,
    state: { isActive: context.isActive, currentStep: context.currentStep, totalSteps: context.totalSteps },
  };
};

export { getCompletedTutorials };
export default TutorialProvider;
