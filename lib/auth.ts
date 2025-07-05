// Gestione auth locale completa per sostituire NextAuth
'use client';

import { useState, useEffect, createContext, useContext } from 'react';

// Tipi per compatibilità con NextAuth
type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface ConnectedAccount {
  provider: string;
  userId: string;
  steamId?: string;
  [key: string]: any;
}

interface User {
  id: string;
  accounts: ConnectedAccount[];
  [key: string]: any;
}

interface Session {
  user?: User;
  [key: string]: any;
}

interface UseSessionReturn {
  data: Session | null;
  status: SessionStatus;
  update: () => Promise<void>;
}

interface SignInResult {
  error?: string | null;
  ok?: boolean;
  [key: string]: any;
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

const setStoredAccounts = (accounts: ConnectedAccount[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONNECTED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error('Errore nel salvare gli account:', error);
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
  } catch (error) {
    console.error('Errore nel salvare la sessione:', error);
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
export const signIn = async (provider: string, options?: any): Promise<SignInResult> => {
  console.log(`Auth locale: tentativo di login con ${provider}`, options);
  
  try {
    const accounts = getStoredAccounts();
    
    // Rimuovi account esistente dello stesso provider
    const filteredAccounts = accounts.filter(acc => acc.provider !== provider);
    
    // Aggiungi nuovo account
    const newAccount: ConnectedAccount = {
      provider,
      userId: options?.userId || options?.steamid || `${provider}-user`,
      ...(options?.steamid && { steamId: options.steamid }),
      ...options
    };
    
    const updatedAccounts = [...filteredAccounts, newAccount];
    setStoredAccounts(updatedAccounts);
    
    console.log(`Account ${provider} collegato con successo:`, newAccount);
    return { error: null, ok: true };
  } catch (error) {
    console.error(`Errore nel collegare ${provider}:`, error);
    return { error: 'Errore nel collegamento', ok: false };
  }
};

// Funzione per il logout
export const signOut = async (provider?: string) => {
  console.log('Auth locale: logout', provider ? `per ${provider}` : 'completo');
  
  try {
    if (provider) {
      // Disconnetti solo un provider specifico
      const accounts = getStoredAccounts();
      const filteredAccounts = accounts.filter(acc => acc.provider !== provider);
      setStoredAccounts(filteredAccounts);
      console.log(`Provider ${provider} disconnesso`);
    } else {
      // Disconnetti tutto
      setStoredAccounts([]);
      setStoredSession(null);
      console.log('Logout completo');
    }
  } catch (error) {
    console.error('Errore nel logout:', error);
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
