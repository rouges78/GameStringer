import { describe, it, expect } from 'vitest';
import {
  dashboardTutorial,
  libraryTutorial,
  neuralTranslatorTutorial,
  editorTutorial,
  patchesTutorial,
  settingsTutorial,
  getTutorial,
  getAllTutorials,
  getTutorialsForPage,
  tutorialRegistry
} from '@/lib/tutorial-configs';

describe('Tutorial Configurations', () => {
  describe('Individual Tutorial Configs', () => {
    it('should have valid dashboard tutorial config', () => {
      expect(dashboardTutorial).toBeDefined();
      expect(dashboardTutorial.id).toBe('dashboard-intro');
      expect(dashboardTutorial.name).toBe('GameStringer Dashboard');
      expect(dashboardTutorial.steps).toHaveLength(9);
      expect(dashboardTutorial.autoStart).toBe(true);
      expect(dashboardTutorial.canSkip).toBe(true);
      
      // Check first and last steps
      expect(dashboardTutorial.steps[0].id).toBe('welcome');
      expect(dashboardTutorial.steps[8].id).toBe('completion');
    });

    it('should have valid library tutorial config', () => {
      expect(libraryTutorial).toBeDefined();
      expect(libraryTutorial.id).toBe('library-guide');
      expect(libraryTutorial.name).toBe('Game Library Guide');
      expect(libraryTutorial.steps.length).toBeGreaterThan(0);
      expect(libraryTutorial.canSkip).toBe(true);
    });

    it('should have valid neural translator tutorial config', () => {
      expect(neuralTranslatorTutorial).toBeDefined();
      expect(neuralTranslatorTutorial.id).toBe('neural-translator-guide');
      expect(neuralTranslatorTutorial.steps.length).toBeGreaterThan(0);
    });

    it('should have valid editor tutorial config', () => {
      expect(editorTutorial).toBeDefined();
      expect(editorTutorial.id).toBe('editor-guide');
      expect(editorTutorial.steps.length).toBeGreaterThan(0);
    });

    it('should have valid patches tutorial config', () => {
      expect(patchesTutorial).toBeDefined();
      expect(patchesTutorial.id).toBe('patches-guide');
      expect(patchesTutorial.steps.length).toBeGreaterThan(0);
    });

    it('should have valid settings tutorial config', () => {
      expect(settingsTutorial).toBeDefined();
      expect(settingsTutorial.id).toBe('settings-guide');
      expect(settingsTutorial.steps.length).toBeGreaterThan(0);
    });
  });

  describe('Tutorial Steps Validation', () => {
    const allTutorials = getAllTutorials();

    it('should have valid step structure for all tutorials', () => {
      allTutorials.forEach(tutorial => {
        tutorial.steps.forEach(step => {
          expect(step.id).toBeDefined();
          expect(step.title).toBeDefined();
          expect(step.description).toBeDefined();
          expect(step.target).toBeDefined();
          expect(step.position).toMatch(/^(top|bottom|left|right)$/);
          
          // Optional fields should be valid if present
          if (step.action) {
            expect(step.action).toMatch(/^(click|hover|input)$/);
          }
          
          if (step.validation) {
            expect(typeof step.validation).toBe('function');
          }
        });
      });
    });

    it('should have unique step IDs within each tutorial', () => {
      allTutorials.forEach(tutorial => {
        const stepIds = tutorial.steps.map(step => step.id);
        const uniqueIds = new Set(stepIds);
        expect(uniqueIds.size).toBe(stepIds.length);
      });
    });

    it('should have meaningful step descriptions', () => {
      allTutorials.forEach(tutorial => {
        tutorial.steps.forEach(step => {
          expect(step.description.length).toBeGreaterThan(10);
          expect(step.title.length).toBeGreaterThan(3);
        });
      });
    });
  });

  describe('Tutorial Registry', () => {
    it('should contain all expected tutorials', () => {
      const expectedTutorials = [
        'dashboard-intro',
        'library-guide',
        'neural-translator-guide',
        'editor-guide',
        'patches-guide',
        'settings-guide'
      ];

      expectedTutorials.forEach(id => {
        expect(tutorialRegistry[id as keyof typeof tutorialRegistry]).toBeDefined();
      });
    });

    it('should have unique tutorial IDs', () => {
      const tutorialIds = Object.keys(tutorialRegistry);
      const uniqueIds = new Set(tutorialIds);
      expect(uniqueIds.size).toBe(tutorialIds.length);
    });
  });

  describe('Helper Functions', () => {
    it('should get tutorial by ID', () => {
      const tutorial = getTutorial('dashboard-intro');
      expect(tutorial).toBeDefined();
      expect(tutorial?.id).toBe('dashboard-intro');
      
      const nonExistent = getTutorial('non-existent');
      expect(nonExistent).toBeUndefined();
    });

    it('should get all tutorials', () => {
      const tutorials = getAllTutorials();
      expect(tutorials).toHaveLength(6);
      expect(tutorials.every(t => t.id && t.name && t.steps)).toBe(true);
    });

    it('should get tutorials for specific pages', () => {
      const dashboardTutorials = getTutorialsForPage('/');
      expect(dashboardTutorials).toHaveLength(1);
      expect(dashboardTutorials[0].id).toBe('dashboard-intro');

      const libraryTutorials = getTutorialsForPage('/library');
      expect(libraryTutorials).toHaveLength(1);
      expect(libraryTutorials[0].id).toBe('library-guide');

      const nonExistentPage = getTutorialsForPage('/non-existent');
      expect(nonExistentPage).toHaveLength(0);
    });

    it('should handle page paths correctly', () => {
      const testCases = [
        { path: '/', expectedCount: 1 },
        { path: '/library', expectedCount: 1 },
        { path: '/injekt-translator', expectedCount: 1 },
        { path: '/editor', expectedCount: 1 },
        { path: '/patches', expectedCount: 1 },
        { path: '/settings', expectedCount: 1 },
        { path: '/unknown', expectedCount: 0 }
      ];

      testCases.forEach(({ path, expectedCount }) => {
        const tutorials = getTutorialsForPage(path);
        expect(tutorials).toHaveLength(expectedCount);
      });
    });
  });

  describe('Tutorial Content Quality', () => {
    it('should have appropriate tutorial lengths', () => {
      allTutorials.forEach(tutorial => {
        // Tutorials should have at least 3 steps but not too many
        expect(tutorial.steps.length).toBeGreaterThanOrEqual(3);
        expect(tutorial.steps.length).toBeLessThanOrEqual(15);
      });
    });

    it('should have proper tutorial progression', () => {
      allTutorials.forEach(tutorial => {
        const steps = tutorial.steps;
        
        // First step should be introductory
        expect(steps[0].title.toLowerCase()).toMatch(/(welcome|intro|overview|guide)/);
        
        // Last step should be conclusive
        const lastStep = steps[steps.length - 1];
        expect(lastStep.title.toLowerCase()).toMatch(/(complete|ready|finish|done|conclusion)/);
      });
    });

    it('should have balanced optional vs required steps', () => {
      allTutorials.forEach(tutorial => {
        const optionalSteps = tutorial.steps.filter(step => step.optional);
        const requiredSteps = tutorial.steps.filter(step => !step.optional);
        
        // Should have more required steps than optional
        expect(requiredSteps.length).toBeGreaterThan(optionalSteps.length);
        
        // Should have at least 2 required steps
        expect(requiredSteps.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Accessibility and UX', () => {
    it('should have appropriate positioning variety', () => {
      allTutorials.forEach(tutorial => {
        const positions = tutorial.steps.map(step => step.position);
        const uniquePositions = new Set(positions);
        
        // Should use varied positioning for better UX
        if (tutorial.steps.length >= 4) {
          expect(uniquePositions.size).toBeGreaterThanOrEqual(2);
        }
      });
    });

    it('should have reasonable action distribution', () => {
      allTutorials.forEach(tutorial => {
        const actionsSteps = tutorial.steps.filter(step => step.action);
        const totalSteps = tutorial.steps.length;
        
        // Not every step should require an action (would be overwhelming)
        expect(actionsSteps.length).toBeLessThan(totalSteps);
        
        // But some steps should have actions for interactivity
        if (totalSteps >= 5) {
          expect(actionsSteps.length).toBeGreaterThan(0);
        }
      });
    });

    it('should have validation on appropriate steps', () => {
      allTutorials.forEach(tutorial => {
        const validationSteps = tutorial.steps.filter(step => step.validation);
        
        // Validation should be used sparingly
        expect(validationSteps.length).toBeLessThanOrEqual(Math.ceil(tutorial.steps.length / 3));
      });
    });
  });
});