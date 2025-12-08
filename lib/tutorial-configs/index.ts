// Tutorial Configurations for GameStringer
import { TutorialConfig } from '@/lib/types/tutorial';
import { elementExists } from '@/lib/utils/ux-enhancements';

// Main Dashboard Tutorial
export const dashboardTutorial: TutorialConfig = {
  id: 'dashboard-intro',
  name: 'GameStringer Dashboard',
  description: 'Learn the basics of navigating GameStringer',
  autoStart: true,
  canSkip: true,
  showProgress: true,
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to GameStringer!',
      description: 'GameStringer is your AI-powered game translation companion. Let\'s take a quick tour of the main features.',
      target: 'body',
      position: 'bottom'
    },
    {
      id: 'sidebar-navigation',
      title: 'Navigation Sidebar',
      description: 'Use the sidebar to navigate between different sections. You can collapse it by clicking the toggle button.',
      target: 'aside',
      position: 'right',
      action: 'hover'
    },
    {
      id: 'library-section',
      title: 'Game Library',
      description: 'Access your game library here. GameStringer automatically scans your installed games from Steam, Epic, and other platforms.',
      target: 'a[href="/library"]',
      position: 'right',
      action: 'click',
      validation: () => elementExists('a[href="/library"]')
    },
    {
      id: 'neural-translator',
      title: 'Neural Translator',
      description: 'Our AI-powered translation engine. This is where the magic happens - translate games using advanced neural networks.',
      target: 'a[href="/injekt-translator"]',
      position: 'right'
    },
    {
      id: 'editor-section',
      title: 'Translation Editor',
      description: 'Fine-tune your translations manually. Edit, review, and perfect your game translations here.',
      target: 'a[href="/editor"]',
      position: 'right'
    },
    {
      id: 'patches-section',
      title: 'Patch Management',
      description: 'Create, manage, and export translation patches. Share your translations with the community!',
      target: 'a[href="/patches"]',
      position: 'right'
    },
    {
      id: 'settings-section',
      title: 'Settings',
      description: 'Customize GameStringer to your preferences. Configure API keys, languages, and more.',
      target: 'a[href="/settings"]',
      position: 'right'
    },
    {
      id: 'system-status',
      title: 'System Status',
      description: 'Monitor the health of your translation services. Green means everything is working perfectly!',
      target: '[data-testid="system-status"]',
      position: 'left',
      optional: true
    },
    {
      id: 'completion',
      title: 'You\'re Ready!',
      description: 'That\'s the basics! Start by adding games to your library, then use the Neural Translator to begin translating. Happy translating!',
      target: 'body',
      position: 'bottom'
    }
  ]
};

// Library Tutorial
export const libraryTutorial: TutorialConfig = {
  id: 'library-guide',
  name: 'Game Library Guide',
  description: 'Learn how to manage your game library',
  canSkip: true,
  showProgress: true,
  steps: [
    {
      id: 'library-overview',
      title: 'Your Game Library',
      description: 'This is your game library. GameStringer automatically detects games from Steam, Epic Games, GOG, and other platforms.',
      target: '.container',
      position: 'bottom'
    },
    {
      id: 'search-games',
      title: 'Search Your Games',
      description: 'Use the search bar to quickly find specific games in your library.',
      target: 'input[placeholder*="Cerca"]',
      position: 'bottom',
      action: 'input'
    },
    {
      id: 'filter-platforms',
      title: 'Filter by Platform',
      description: 'Filter games by platform (Steam, Epic, etc.) using these buttons.',
      target: 'button:contains("All")',
      position: 'bottom'
    },
    {
      id: 'advanced-filters',
      title: 'Advanced Filters',
      description: 'Use advanced filters to find VR games, installed games, or games by language support.',
      target: 'button:contains("Solo VR")',
      position: 'bottom'
    },
    {
      id: 'game-details',
      title: 'Game Information',
      description: 'Each game card shows important info: supported languages, VR compatibility, engine type, and installation status.',
      target: '.grid > div:first-child',
      position: 'right',
      optional: true
    },
    {
      id: 'force-refresh',
      title: 'Force Refresh',
      description: 'Just bought a new game? Use Force Refresh to bypass cache and show your latest purchases immediately.',
      target: 'button:contains("Force Refresh")',
      position: 'left'
    },
    {
      id: 'view-modes',
      title: 'View Modes',
      description: 'Switch between grid and list view to see your games the way you prefer.',
      target: 'button:contains("Griglia")',
      position: 'top',
      optional: true
    }
  ]
};

// Neural Translator Tutorial
export const neuralTranslatorTutorial: TutorialConfig = {
  id: 'neural-translator-guide',
  name: 'Neural Translator Guide',
  description: 'Master AI-powered game translation',
  canSkip: true,
  showProgress: true,
  steps: [
    {
      id: 'translator-intro',
      title: 'AI Translation Engine',
      description: 'The Neural Translator uses advanced AI to automatically translate game files. Let\'s learn how to use it effectively.',
      target: '.container',
      position: 'bottom'
    },
    {
      id: 'select-game',
      title: 'Choose Your Game',
      description: 'First, select the game you want to translate from your library.',
      target: 'select',
      position: 'bottom',
      action: 'click'
    },
    {
      id: 'game-path',
      title: 'Game Path Detection',
      description: 'GameStringer will automatically find your game\'s installation path. If it can\'t find it, you can browse manually.',
      target: 'button:contains("Browse")',
      position: 'top',
      optional: true
    },
    {
      id: 'file-selection',
      title: 'Select Translation Files',
      description: 'Choose which game files contain text to translate. Common files include .txt, .json, .xml, and .ini files.',
      target: '[data-testid="file-list"]',
      position: 'right',
      optional: true
    },
    {
      id: 'ai-provider',
      title: 'Choose AI Provider',
      description: 'Select your preferred AI translation service. OpenAI GPT provides the best quality, while Google Translate is faster.',
      target: 'select[value*="openai"]',
      position: 'bottom'
    },
    {
      id: 'api-key',
      title: 'API Configuration',
      description: 'Enter your API key for the selected service. This is stored securely and only used for translations.',
      target: 'input[placeholder*="API"]',
      position: 'bottom',
      action: 'input'
    },
    {
      id: 'language-selection',
      title: 'Language Settings',
      description: 'Choose source and target languages. The AI will translate from the source language to your target language.',
      target: 'select:contains("English")',
      position: 'bottom'
    },
    {
      id: 'start-translation',
      title: 'Begin Translation',
      description: 'Click translate to start the AI translation process. You can monitor progress and review results in real-time.',
      target: 'button:contains("Translate")',
      position: 'top',
      action: 'click'
    }
  ]
};

// Editor Tutorial
export const editorTutorial: TutorialConfig = {
  id: 'editor-guide',
  name: 'Translation Editor Guide',
  description: 'Learn to edit and perfect your translations',
  canSkip: true,
  showProgress: true,
  steps: [
    {
      id: 'editor-overview',
      title: 'Translation Editor',
      description: 'Fine-tune your AI translations here. Edit text, review suggestions, and ensure perfect translations.',
      target: '.container',
      position: 'bottom'
    },
    {
      id: 'translation-list',
      title: 'Translation Entries',
      description: 'All your translation entries are listed here. You can filter by game, status, or search for specific text.',
      target: '[data-testid="translation-list"]',
      position: 'right',
      optional: true
    },
    {
      id: 'filter-options',
      title: 'Filter Translations',
      description: 'Use these filters to find specific translations: by status (pending, completed), by game, or by text content.',
      target: 'select:contains("All")',
      position: 'bottom'
    },
    {
      id: 'edit-translation',
      title: 'Edit Translation',
      description: 'Click on any translation to edit it. You can modify the translated text and add context notes.',
      target: '[data-testid="translation-item"]:first',
      position: 'right',
      action: 'click',
      optional: true
    },
    {
      id: 'ai-suggestions',
      title: 'AI Suggestions',
      description: 'View alternative AI suggestions for each translation. Choose the best option or create your own.',
      target: '[data-testid="ai-suggestions"]',
      position: 'left',
      optional: true
    },
    {
      id: 'save-changes',
      title: 'Save Your Work',
      description: 'Don\'t forget to save your changes! Your edits are automatically backed up as you work.',
      target: 'button:contains("Save")',
      position: 'top',
      action: 'click'
    },
    {
      id: 'export-translations',
      title: 'Export Results',
      description: 'When you\'re happy with your translations, export them as game patches or translation files.',
      target: 'button:contains("Export")',
      position: 'top'
    }
  ]
};

// Patches Tutorial
export const patchesTutorial: TutorialConfig = {
  id: 'patches-guide',
  name: 'Patch Management Guide',
  description: 'Create and manage translation patches',
  canSkip: true,
  showProgress: true,
  steps: [
    {
      id: 'patches-intro',
      title: 'Translation Patches',
      description: 'Create professional translation patches to share with the community or apply to your games.',
      target: '.container',
      position: 'bottom'
    },
    {
      id: 'patch-stats',
      title: 'Your Patch Statistics',
      description: 'Track your translation work: total patches created, published patches, and download counts.',
      target: '[data-testid="patch-stats"]',
      position: 'bottom',
      optional: true
    },
    {
      id: 'create-patch',
      title: 'Create New Patch',
      description: 'Start creating a new translation patch. You\'ll configure metadata, select translations, and package everything.',
      target: 'button:contains("Crea Nuova")',
      position: 'bottom',
      action: 'click'
    },
    {
      id: 'patch-metadata',
      title: 'Patch Information',
      description: 'Fill in patch details: name, description, target game, and language information.',
      target: 'input[placeholder*="Nome Patch"]',
      position: 'bottom',
      action: 'input',
      optional: true
    },
    {
      id: 'patch-type',
      title: 'Patch Type',
      description: 'Choose patch type: Complete (full translation), Partial (specific sections), or Mod (gameplay modifications).',
      target: 'select:contains("Completa")',
      position: 'bottom',
      optional: true
    },
    {
      id: 'export-patch',
      title: 'Export Patch',
      description: 'Export your patch as a ZIP file with installer, readme, and all necessary files for easy distribution.',
      target: 'button:contains("Esporta")',
      position: 'top'
    },
    {
      id: 'patch-management',
      title: 'Manage Patches',
      description: 'View, edit, delete, or republish your existing patches. Track downloads and user feedback.',
      target: '[data-testid="patch-list"]',
      position: 'right',
      optional: true
    }
  ]
};

// Settings Tutorial
export const settingsTutorial: TutorialConfig = {
  id: 'settings-guide',
  name: 'Settings Configuration',
  description: 'Configure GameStringer for optimal performance',
  canSkip: true,
  showProgress: true,
  steps: [
    {
      id: 'settings-overview',
      title: 'GameStringer Settings',
      description: 'Customize GameStringer to match your workflow and preferences.',
      target: '.container',
      position: 'bottom'
    },
    {
      id: 'api-settings',
      title: 'API Configuration',
      description: 'Configure your AI service API keys here. These are encrypted and stored securely.',
      target: '[data-testid="api-settings"]',
      position: 'right',
      optional: true
    },
    {
      id: 'language-preferences',
      title: 'Language Preferences',
      description: 'Set your default source and target languages for faster translation setup.',
      target: '[data-testid="language-settings"]',
      position: 'right',
      optional: true
    },
    {
      id: 'performance-settings',
      title: 'Performance Options',
      description: 'Adjust translation speed, batch sizes, and memory usage based on your system capabilities.',
      target: '[data-testid="performance-settings"]',
      position: 'right',
      optional: true
    },
    {
      id: 'backup-settings',
      title: 'Backup & Sync',
      description: 'Configure automatic backups and cloud sync to protect your translation work.',
      target: '[data-testid="backup-settings"]',
      position: 'right',
      optional: true
    }
  ]
};

// Tutorial registry
export const tutorialRegistry = {
  'dashboard-intro': dashboardTutorial,
  'library-guide': libraryTutorial,
  'neural-translator-guide': neuralTranslatorTutorial,
  'editor-guide': editorTutorial,
  'patches-guide': patchesTutorial,
  'settings-guide': settingsTutorial
};

// Helper function to get tutorial by ID
export function getTutorial(id: string): TutorialConfig | undefined {
  return tutorialRegistry[id as keyof typeof tutorialRegistry];
}

// Helper function to get all available tutorials
export function getAllTutorials(): TutorialConfig[] {
  return Object.values(tutorialRegistry);
}

// Helper function to get tutorials for a specific page
export function getTutorialsForPage(pathname: string): TutorialConfig[] {
  const pageMap: Record<string, string[]> = {
    '/': ['dashboard-intro'],
    '/library': ['library-guide'],
    '/injekt-translator': ['neural-translator-guide'],
    '/editor': ['editor-guide'],
    '/patches': ['patches-guide'],
    '/settings': ['settings-guide']
  };

  const tutorialIds = pageMap[pathname] || [];
  return tutorialIds.map(id => getTutorial(id)).filter(Boolean) as TutorialConfig[];
}