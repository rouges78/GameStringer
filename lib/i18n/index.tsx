'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, Language, TranslationKeys } from './translations';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('it');

  // Load language from localStorage on mount
  useEffect(() => {
    try {
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
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    // Also update localStorage
    try {
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
