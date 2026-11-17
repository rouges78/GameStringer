// Gestione auth locale completa per sostituire NextAuth
'use client';

import { useState, useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';

// Tipi per compatibilità con NextAuth
type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface ConnectedAccount {
  provider: string;
  userId: string;
  steamId?: string;
  [key: string]: unknown;
}

interface User {
  id: string;
  accounts: ConnectedAccount[];
  [key: string]: unknown;
}

interface Session {
  user?: User;
  [key: string]: unknown;
}

interface UseSessionReturn {
  data: Session | null;
  status: SessionStatus;
  update: () => Promise<void>;
}

interface SignInResult {
  error?: string | null;
  ok?: boolean;
  [key: string]: unknown;
}

// Chiavi localStorage
const AUTH_STORAGE_KEY = 'gameStringer_auth';
const CONNECTED_ACCOUNTS_KEY = 'gameStringer_connectedAccounts';

// Funzioni di utilità per localStorage
const getStoredAccounts = (): ConnectedAccount[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CONNECTED_ACCOUNTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Segreti che non devono mai finire in localStorage né nei log: restano solo
// nel vault cifrato del profilo (lato Rust).
const SECRET_FIELDS = ['password', 'twoFactorCode', 'accessToken', 'apiKey'];
const withoutSecrets = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET_FIELDS.includes(key))) as T;

const setStoredAccounts = (accounts: ConnectedAccount[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONNECTED_ACCOUNTS_KEY, JSON.stringify(accounts.map(withoutSecrets)));
  } catch (error: unknown) {
    clientLogger.error('Errore nel salvare gli account:', error);
  }
};

const getStoredSession = (): Session | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const setStoredSession = (session: Session | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (session) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (error: unknown) {
    clientLogger.error('Errore nel salvare la sessione:', error);
  }
};

// Hook principale per la sessione
export const useSession = (): UseSessionReturn => {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');

  const update = async () => {
    const accounts = getStoredAccounts();
    const storedSession = getStoredSession();
    
    if (accounts.length > 0 || storedSession) {
      const newSession: Session = {
        user: {
          id: storedSession?.user?.id || 'local-user',
          accounts: accounts
        }
      };
      setSession(newSession);
      setStatus('authenticated');
      setStoredSession(newSession);
    } else {
      setSession(null);
      setStatus('unauthenticated');
      setStoredSession(null);
    }
  };

  useEffect(() => {
    update();
  }, []);

  return {
    data: session,
    status,
    update
  };
};

// Funzione per il login
export const signIn = async (provider: string, options?: Record<string, unknown>): Promise<SignInResult> => {
  clientLogger.debug(`Auth locale: tentativo di login con ${provider}`);
  
  try {
    const accounts = getStoredAccounts();
    
    // Rimuovi account esistente dello stesso provider
    const filteredAccounts = accounts.filter(acc => acc.provider !== provider);
    
    // Aggiungi nuovo account
    const newAccount: ConnectedAccount = {
      ...(options ? withoutSecrets(options) : {}),
      provider,
      userId: (options?.userId || options?.steamid || `${provider}-user`) as string,
      ...(options?.steamid ? { steamId: options.steamid as string } : {}),
    };
    
    const updatedAccounts = [...filteredAccounts, newAccount];
    setStoredAccounts(updatedAccounts);
    
    clientLogger.debug(`Account ${provider} collegato con successo`);
    return { error: null, ok: true };
  } catch (error: unknown) {
    clientLogger.error(`Errore nel collegare ${provider}:`, error);
    return { error: 'Errore nel collegamento', ok: false };
  }
};

// Funzione per il logout
export const signOut = async (provider?: string) => {
  clientLogger.debug('Auth locale: logout', provider ? `per ${provider}` : 'completo');
  
  try {
    if (provider) {
      // Disconnetti solo un provider specifico
      const accounts = getStoredAccounts();
      const filteredAccounts = accounts.filter(acc => acc.provider !== provider);
      setStoredAccounts(filteredAccounts);
      clientLogger.debug(`Provider ${provider} disconnesso`);
    } else {
      // Disconnetti tutto
      setStoredAccounts([]);
      setStoredSession(null);
      clientLogger.debug('Logout completo');
    }
  } catch (error: unknown) {
    clientLogger.error('Errore nel logout:', error);
  }
};

// Funzioni di utilità
export const isProviderConnected = (provider: string): boolean => {
  const accounts = getStoredAccounts();
  return accounts.some(acc => acc.provider === provider);
};

export const getConnectedAccount = (provider: string): ConnectedAccount | null => {
  const accounts = getStoredAccounts();
  return accounts.find(acc => acc.provider === provider) || null;
};

export const getAllConnectedAccounts = (): ConnectedAccount[] => {
  return getStoredAccounts();
};

// Provider degli store di gioco (chiavi salvate in gameStringer_connectedAccounts).
// Mappa coerente con providerMap in app/stores/page.tsx.
export const STORE_PROVIDER_IDS = [
  'steam-credentials',
  'epicgames',
  'gog-credentials',
  'ubisoft-credentials',
  'origin-credentials',
  'battlenet-credentials',
  'rockstar-credentials',
  'amazon-credentials',
  'itchio-credentials',
] as const;

// True se l'utente ha collegato (registrato credenziali su) almeno uno store.
// NON considera la detection locale (Xbox/Amazon installati): quella è gestita
// in modo asincrono via Tauri dentro StoreGate.
export const hasAnyStoreConnected = (): boolean => {
  const ids = STORE_PROVIDER_IDS as readonly string[];
  return getStoredAccounts().some(acc => ids.includes(acc.provider));
};

