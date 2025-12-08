// Tutorial System Types
export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'hover' | 'input';
  validation?: () => boolean;
  optional?: boolean;
}

export interface TutorialState {
  isActive: boolean;
  currentStep: number;
  steps: TutorialStep[];
  completed: boolean;
  canSkip: boolean;
  tutorialId: string;
}

export interface UserTutorialProgress {
  userId: string;
  completedTutorials: string[];
  currentTutorial?: {
    id: string;
    currentStep: number;
    startedAt: Date;
  };
  preferences: {
    showHints: boolean;
    autoAdvance: boolean;
    skipAnimations: boolean;
  };
}

export interface TutorialConfig {
  id: string;
  name: string;
  description: string;
  steps: TutorialStep[];
  autoStart?: boolean;
  canSkip?: boolean;
  showProgress?: boolean;
}

export type TutorialEventType = 
  | 'tutorial_started'
  | 'tutorial_completed' 
  | 'tutorial_skipped'
  | 'step_completed'
  | 'step_skipped';

export interface TutorialEvent {
  type: TutorialEventType;
  tutorialId: string;
  stepId?: string;
  timestamp: Date;
  userId: string;
}