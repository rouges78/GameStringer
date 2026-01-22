'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface TutorialContextType {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  startTutorial: (tutorial?: any) => void;
  nextStep: () => void;
  prevStep: () => void;
  endTutorial: () => void;
  skipTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

interface TutorialProviderProps {
  children: React.ReactNode;
}

export const TutorialProvider: React.FC<TutorialProviderProps> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 5;

  const startTutorial = useCallback((_tutorial?: any) => {
    setIsActive(true);
    setCurrentStep(0);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsActive(false);
    }
  }, [currentStep, totalSteps]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const endTutorial = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
  }, []);

  const skipTutorial = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem('tutorialSkipped', 'true');
  }, []);

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStep,
        totalSteps,
        startTutorial,
        nextStep,
        prevStep,
        endTutorial,
        skipTutorial,
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
      startTutorial: (_tutorial?: any) => {},
      nextStep: () => {},
      prevStep: () => {},
      endTutorial: () => {},
      skipTutorial: () => {},
      state: { isActive: false, currentStep: 0, totalSteps: 0 },
    };
  }
  return {
    ...context,
    state: { isActive: context.isActive, currentStep: context.currentStep, totalSteps: context.totalSteps },
  };
};

export default TutorialProvider;
