'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, Language, TranslationKeys } from './translations';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

// Helper to get current profile ID
const getCurrentProfileId = (): string | null => {
  try {
    const profileData = localStorage.getItem('gamestringer_current_profile');
    if (profileData) {
      const profile = JSON.parse(profileData);
      return profile.id || null;
    }
  } catch (e) {
    console.warn('[I18N] Errore parsing profilo corrente:', e);
  }
  return null;
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  // Load language from localStorage on mount (per profile)
  useEffect(() => {
    const loadLanguage = () => {
      try {
        const profileId = getCurrentProfileId();
        
        // Try profile-specific language first
        if (profileId) {
          const profileLang = localStorage.getItem(`gs_language_${profileId}`);
          if (profileLang && translations[profileLang as Language]) {
            setLanguageState(profileLang as Language);
            return;
          }
        }
        
        // Fallback to global settings
        const savedSettings = localStorage.getItem('gameStringerSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.system?.language && translations[settings.system.language as Language]) {
            setLanguageState(settings.system.language as Language);
          }
        }
      } catch (e) {
        console.warn('Failed to load language setting:', e);
      }
    };
    
    loadLanguage();
    
    // Listen for profile changes
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'gamestringer_current_profile') {
        loadLanguage();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    
    try {
      const profileId = getCurrentProfileId();
      
      // Save per profile
      if (profileId) {
        localStorage.setItem(`gs_language_${profileId}`, lang);
      }
      
      // Also update global settings as fallback
      const savedSettings = localStorage.getItem('gameStringerSettings');
      const settings = savedSettings ? JSON.parse(savedSettings) : {};
      settings.system = { ...settings.system, language: lang };
      localStorage.setItem('gameStringerSettings', JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save language setting:', e);
    }
  }, []);

  // Translation function with dot notation support
  const t = useCallback((key: string): string => {
    const keys = key.split('.');
    let value: unknown = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        // Fallback to Italian if key not found
        value = translations['it'];
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = (value as Record<string, unknown>)[fallbackKey];
          } else {
            return key; // Return key if not found
          }
        }
        break;
      }
    }
    
    return typeof value === 'string' ? value : key;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}

export { translations, type Language, type TranslationKeys };



