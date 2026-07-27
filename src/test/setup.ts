import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

// Mock Tauri API
Object.defineProperty(window, '__TAURI__', {
  value: {
    tauri: {
      invoke: vi.fn()
    },
    event: {
      listen: vi.fn(),
      emit: vi.fn()
    }
  }
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage — con uno STORE VERO dietro.
//
// Prima era un oggetto di soli `vi.fn()`: `setItem` non salvava nulla e
// `getItem` restituiva `undefined`. Ogni test del tipo "scrivi e rileggi"
// vedeva quindi sempre "niente salvato": o passava per la ragione sbagliata,
// o falliva senza colpa del codice — è quello che succedeva a
// __tests__/lib/provider-endpoints.test.ts, dove l'override dell'utente non
// veniva mai riletto e sembrava che la funzione non lo applicasse.
//
// Restano `vi.fn()` all'esterno, così si può ancora fare spy e assertare le
// chiamate; cambia solo che adesso si comportano come un vero localStorage.
const localStorageStore = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore.set(key, String(value));
  }),
  removeItem: vi.fn((key: string) => {
    localStorageStore.delete(key);
  }),
  clear: vi.fn(() => {
    localStorageStore.clear();
  }),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Ogni test parte da un localStorage vuoto.
//
// Senza questo, lo store sopravvive da un test all'altro dentro lo stesso file
// e ne nasce contaminazione: in tutorial-provider.test.tsx il tutorial
// risultava già completato per averlo completato in un test precedente, quindi
// il provider — correttamente — non lo risalvava, e l'assert su `setItem`
// falliva. Col mock vuoto di prima il problema non si vedeva perché la lettura
// tornava sempre indietro a mani vuote.
beforeEach(() => {
  localStorageStore.clear();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock globale i18n: evita "useTranslation must be used within an I18nProvider"
// nei test che non wrappano i componenti con <I18nProvider>.
// Il testo restituito è la key stessa (pattern comune nei test).
vi.mock('@/lib/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/i18n')>().catch(() => ({}));
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => fallback ?? key,
      language: 'it',
      setLanguage: vi.fn(),
      availableLanguages: ['it', 'en'],
    }),
    I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});
