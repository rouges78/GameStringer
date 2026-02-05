import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Locale = 'en' | 'it' | 'es' | 'de' | 'fr' | 'ja' | 'zh' | 'ko' | 'pt';

export interface LocaleInfo {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
];

type TranslationDict = Record<string, unknown>;

interface I18nState {
  locale: Locale;
  translations: TranslationDict;
  isLoading: boolean;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  loadTranslations: (locale: Locale) => Promise<void>;
}

const getNestedValue = (obj: TranslationDict, path: string): string => {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  
  return typeof current === 'string' ? current : path;
};

const interpolate = (text: string, params?: Record<string, string | number>): string => {
  if (!params) return text;
  
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key]?.toString() ?? `{{${key}}}`;
  });
};

export const useI18n = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: 'en',
      translations: {},
      isLoading: false,

      setLocale: async (locale: Locale) => {
        set({ isLoading: true });
        await get().loadTranslations(locale);
        set({ locale, isLoading: false });
      },

      t: (key: string, params?: Record<string, string | number>) => {
        const { translations } = get();
        const value = getNestedValue(translations, key);
        return interpolate(value, params);
      },

      loadTranslations: async (locale: Locale) => {
        try {
          const translations = await import(`../locales/${locale}/common.json`);
          set({ translations: translations.default || translations });
        } catch (error) {
          console.error(`Failed to load translations for ${locale}:`, error);
          if (locale !== 'en') {
            const fallback = await import('../locales/en/common.json');
            set({ translations: fallback.default || fallback });
          }
        }
      },
    }),
    {
      name: 'gamestringer-i18n',
      partialize: (state) => ({ locale: state.locale }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.loadTranslations(state.locale);
        }
      },
    }
  )
);

export const detectBrowserLocale = (): Locale => {
  if (typeof navigator === 'undefined') return 'en';
  
  const browserLang = navigator.language.split('-')[0].toLowerCase();
  const supported = SUPPORTED_LOCALES.find(l => l.code === browserLang);
  
  return (supported?.code as Locale) || 'en';
};

export const formatLocaleDate = (date: Date, locale: Locale): string => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

export const formatLocaleNumber = (num: number, locale: Locale): string => {
  return new Intl.NumberFormat(locale).format(num);
};

export const formatLocaleCurrency = (
  amount: number,
  locale: Locale,
  currency = 'USD'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};
