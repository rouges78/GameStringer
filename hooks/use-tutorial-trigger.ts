'use client';

import { useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useTutorial } from '@/components/tutorial/tutorial-provider';
import { getTutorialsForPage, getTutorial } from '@/lib/tutorial-configs';
import { TutorialDatabase } from '@/lib/utils/database';
import { LocalStorage } from '@/lib/utils/ux-enhancements';

interface UseTutorialTriggerOptions {
  userId?: string;
  autoStart?: boolean;
  skipForReturningUsers?: boolean;
}

export function useTutorialTrigger({
  userId,
  autoStart = true,
  skipForReturningUsers = true
}: UseTutorialTriggerOptions = {}) {
  const pathname = usePathname();
  const { state, startTutorial } = useTutorial();

  // Check if user is new (first time visiting)
  const isNewUser = useCallback(() => {
    if (!userId) {
      // For non-authenticated users, check localStorage
      const hasVisited = LocalStorage.get('gamestringer_has_visited', false);
      return !hasVisited;
    }
    
    // For authenticated users, this would be checked via database
    // For now, we'll use localStorage as fallback
    const userVisitKey = `gamestringer_user_${userId}_visited`;
    return !LocalStorage.get(userVisitKey, false);
  }, [userId]);

  // Mark user as having visited
  const markUserAsVisited = useCallback(() => {
    if (!userId) {
      LocalStorage.set('gamestringer_has_visited', true);
    } else {
      const userVisitKey = `gamestringer_user_${userId}_visited`;
      LocalStorage.set(userVisitKey, true);
    }
  }, [userId]);

  // Check if tutorial should be shown for current page
  const shouldShowTutorial = useCallback(async (tutorialId: string): Promise<boolean> => {
    if (!autoStart) return false;
    if (state.isActive) return false; // Don't interrupt active tutorial

    // Check if user is new
    if (skipForReturningUsers && !isNewUser()) {
      return false;
    }

    // Check if tutorial was already completed or skipped
    if (userId) {
      try {
        const progress = await TutorialDatabase.getUserProgress(userId);
        if (progress?.completedTutorials.includes(tutorialId)) {
          return false;
        }
      } catch (error) {
        console.error('Error checking tutorial progress:', error);
      }
    } else {
      // For non-authenticated users, check localStorage
      const completedTutorials = LocalStorage.get('completed_tutorials', []);
      if (completedTutorials.includes(tutorialId)) {
        return false;
      }
    }

    return true;
  }, [autoStart, state.isActive, skipForReturningUsers, isNewUser, userId]);

  // Auto-start tutorial for current page
  const autoStartTutorial = useCallback(async () => {
    const availableTutorials = getTutorialsForPage(pathname);
    
    for (const tutorial of availableTutorials) {
      if (tutorial.autoStart && await shouldShowTutorial(tutorial.id)) {
        // Small delay to ensure page is fully loaded
        setTimeout(() => {
          startTutorial(tutorial);
          markUserAsVisited();
        }, 1000);
        break; // Only start one tutorial at a time
      }
    }
  }, [pathname, shouldShowTutorial, startTutorial, markUserAsVisited]);

  // Manually start a specific tutorial
  const startSpecificTutorial = useCallback((tutorialId: string) => {
    const tutorial = getTutorial(tutorialId);
    if (tutorial) {
      startTutorial(tutorial);
    } else {
      console.warn(`Tutorial not found: ${tutorialId}`);
    }
  }, [startTutorial]);

  // Get available tutorials for current page
  const getAvailableTutorials = useCallback(() => {
    return getTutorialsForPage(pathname);
  }, [pathname]);

  // Check if any tutorial is available for current page
  const hasTutorialsForPage = useCallback(() => {
    return getTutorialsForPage(pathname).length > 0;
  }, [pathname]);

  // Auto-start tutorial when page changes
  useEffect(() => {
    if (autoStart) {
      autoStartTutorial();
    }
  }, [pathname, autoStart, autoStartTutorial]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Any cleanup if needed
    };
  }, []);

  return {
    // State
    isNewUser: isNewUser(),
    hasTutorialsForPage: hasTutorialsForPage(),
    availableTutorials: getAvailableTutorials(),
    
    // Actions
    startSpecificTutorial,
    autoStartTutorial,
    markUserAsVisited,
    
    // Utilities
    shouldShowTutorial
  };
}

// Hook for tutorial menu/button component
export function useTutorialMenu(userId?: string) {
  const { startSpecificTutorial, availableTutorials } = useTutorialTrigger({ 
    userId, 
    autoStart: false 
  });

  const startTutorialFromMenu = useCallback((tutorialId: string) => {
    startSpecificTutorial(tutorialId);
  }, [startSpecificTutorial]);

  return {
    availableTutorials,
    startTutorial: startTutorialFromMenu
  };
}

// Hook for settings page tutorial management
export function useTutorialSettings(userId?: string) {
  const resetTutorialProgress = useCallback(async (tutorialId?: string) => {
    if (!userId) {
      if (tutorialId) {
        const completedTutorials = LocalStorage.get('completed_tutorials', []);
        const filtered = completedTutorials.filter((id: string) => id !== tutorialId);
        LocalStorage.set('completed_tutorials', filtered);
      } else {
        LocalStorage.remove('completed_tutorials');
        LocalStorage.remove('gamestringer_has_visited');
      }
      return;
    }

    try {
      if (tutorialId) {
        // Reset specific tutorial (would need database method)
        console.log(`Resetting tutorial: ${tutorialId}`);
      } else {
        // Reset all tutorials (would need database method)
        console.log('Resetting all tutorials');
      }
    } catch (error) {
      console.error('Error resetting tutorial progress:', error);
    }
  }, [userId]);

  const getTutorialProgress = useCallback(async () => {
    if (!userId) {
      return {
        completedTutorials: LocalStorage.get('completed_tutorials', []),
        hasVisited: LocalStorage.get('gamestringer_has_visited', false)
      };
    }

    try {
      const progress = await TutorialDatabase.getUserProgress(userId);
      return {
        completedTutorials: progress?.completedTutorials || [],
        currentTutorial: progress?.currentTutorial,
        hasVisited: true
      };
    } catch (error) {
      console.error('Error getting tutorial progress:', error);
      return {
        completedTutorials: [],
        hasVisited: false
      };
    }
  }, [userId]);

  return {
    resetTutorialProgress,
    getTutorialProgress
  };
}