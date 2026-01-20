'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';

// Client-side clientLogger (console only)
const clientLogger = {
  info: (message: string, component?: string, metadata?: any) => {
    console.info(`[${component || 'AUTH'}] ${message}`, metadata);
  },
  warn: (message: string, component?: string, metadata?: any) => {
    console.warn(`[${component || 'AUTH'}] ${message}`, metadata);
  },
  error: (message: string, component?: string, metadata?: any) => {
    console.error(`[${component || 'AUTH'}] ${message}`, metadata);
  },
  debug: (message: string, component?: string, metadata?: any) => {
    console.debug(`[${component || 'AUTH'}] ${message}`, metadata);
  }
};

// Unified auth types
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface ConnectedAccount {
  provider: string;
  userId: string;
  email?: string;
  name?: string;
  image?: string;
  steamId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  connectedAt: string;
  lastUsed?: string;
  metadata?: Record<string, any>;
}

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  image?: string;
  accounts: ConnectedAccount[];
  preferences?: Record<string, any>;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthSession {
  user: AuthUser;
  sessionId: string;
  expiresAt: string;
  isValid: boolean;
}

export interface AuthContextType {
  session: AuthSession | null;
  status: AuthStatus;
  signIn: (provider: string, options?: any) => Promise<{ error?: string; success?: boolean }>;
  signOut: (provider?: string) => Promise<void>;
  updateSession: () => Promise<void>;
  isConnected: (provider: string) => boolean;
  getAccount: (provider: string) => ConnectedAccount | null;
  getAllAccounts: () => ConnectedAccount[];
  disconnect: (provider: string) => Promise<void>;
}

// Storage keys
const STORAGE_KEYS = {
  SESSION: 'gs_session',
  ACCOUNTS: 'gs_accounts',
  USER: 'gs_user',
  PREFERENCES: 'gs_preferences'
} as const;

// Auth context
const AuthContext = createContext<AuthContextType | null>(null);

// Utility functions
function isClient(): boolean {
  return typeof window !== 'undefined';
}

function getStorageItem<T>(key: string): T | null {
  if (!isClient()) return null;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    clientLogger.error('Failed to get storage item', 'UNIFIED_AUTH', { key, error });
    return null;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    clientLogger.error('Failed to set storage item', 'UNIFIED_AUTH', { key, error });
  }
}

function removeStorageItem(key: string): void {
  if (!isClient()) return;
  try {
    localStorage.removeItem(key);
  } catch (error) {
    clientLogger.error('Failed to remove storage item', 'UNIFIED_AUTH', { key, error });
  }
};

// Session cookie management for middleware validation
const setSessionCookie = (session: AuthSession): void => {
  if (!isClient()) return;
  try {
    const cookieValue = JSON.stringify({
      sessionId: session.sessionId,
      userId: session.user.id,
      expiresAt: session.expiresAt,
      isValid: session.isValid
    });
    
    document.cookie = `gs_session=${cookieValue}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Strict`;
  } catch (error) {
    clientLogger.error('Failed to set session cookie', 'UNIFIED_AUTH', { error });
  }
};

const removeSessionCookie = (): void => {
  if (!isClient()) return;
  try {
    document.cookie = 'gs_session=; path=/; max-age=0';
  } catch (error) {
    clientLogger.error('Failed to remove session cookie', 'UNIFIED_AUTH', { error });
  }
};

// Generate unique IDs
const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Session management
const createSession = (user: AuthUser): AuthSession => {
  const sessionId = generateId();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  return {
    user,
    sessionId,
    expiresAt: expiresAt.toISOString(),
    isValid: true
  };
};

const isSessionValid = (session: AuthSession | null): boolean => {
  if (!session) return false;
  
  const now = new Date();
  const expiresAt = new Date(session.expiresAt);
  
  return session.isValid && now < expiresAt;
};

// Account management
const createAccount = (provider: string, data: any): ConnectedAccount => {
  return {
    provider,
    userId: data.userId || data.id || generateId(),
    email: data.email,
    name: data.name,
    image: data.image,
    steamId: data.steamId || data.steamid,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    connectedAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    metadata: data.metadata || {}
  };
};

// Main auth hook
export const useUnifiedAuth = (): AuthContextType => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const updateSession = async (): Promise<void> => {
    try {
      const storedSession = getStorageItem<AuthSession>(STORAGE_KEYS.SESSION);
      const storedAccounts = getStorageItem<ConnectedAccount[]>(STORAGE_KEYS.ACCOUNTS) || [];
      const storedUser = getStorageItem<AuthUser>(STORAGE_KEYS.USER);

      if (storedSession && isSessionValid(storedSession)) {
        // Update session with latest accounts
        const updatedSession = {
          ...storedSession,
          user: {
            ...storedSession.user,
            accounts: storedAccounts
          }
        };

        setSession(updatedSession);
        setStatus('authenticated');
        setStorageItem(STORAGE_KEYS.SESSION, updatedSession);
        
        // Set session cookie for middleware validation
        setSessionCookie(updatedSession);
        
        clientLogger.info('Session updated successfully', 'UNIFIED_AUTH', {
          userId: updatedSession.user.id,
          accountCount: storedAccounts.length
        });
      } else if (storedAccounts.length > 0) {
        // Create new session if we have accounts but no valid session
        const user: AuthUser = storedUser || {
          id: generateId(),
          accounts: storedAccounts,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        };

        const newSession = createSession(user);
        setSession(newSession);
        setStatus('authenticated');
        setStorageItem(STORAGE_KEYS.SESSION, newSession);
        setStorageItem(STORAGE_KEYS.USER, user);
        
        // Set session cookie for middleware validation
        setSessionCookie(newSession);
        
        clientLogger.info('New session created', 'UNIFIED_AUTH', {
          userId: user.id,
          accountCount: storedAccounts.length
        });
      } else {
        // No valid session or accounts
        setSession(null);
        setStatus('unauthenticated');
        
        // Clean up storage and cookies
        removeStorageItem(STORAGE_KEYS.SESSION);
        removeStorageItem(STORAGE_KEYS.USER);
        removeSessionCookie();
        
        clientLogger.info('No valid session found', 'UNIFIED_AUTH');
      }
    } catch (error) {
      clientLogger.error('Failed to update session', 'UNIFIED_AUTH', { error });
      setSession(null);
      setStatus('unauthenticated');
    }
  };

  const signIn = async (provider: string, options: any = {}): Promise<{ error?: string; success?: boolean }> => {
    try {
      clientLogger.info(`Sign in attempt: ${provider}`, 'UNIFIED_AUTH', { provider, options: { ...options, accessToken: '[REDACTED]' } });

      const accounts = getStorageItem<ConnectedAccount[]>(STORAGE_KEYS.ACCOUNTS) || [];
      
      // Remove existing account for this provider
      const filteredAccounts = accounts.filter(acc => acc.provider !== provider);
      
      // Create new account
      const newAccount = createAccount(provider, options);
      const updatedAccounts = [...filteredAccounts, newAccount];
      
      // Save accounts
      setStorageItem(STORAGE_KEYS.ACCOUNTS, updatedAccounts);
      
      // Update session
      await updateSession();
      
      clientLogger.info(`Successfully signed in with ${provider}`, 'UNIFIED_AUTH', {
        provider,
        userId: newAccount.userId,
        accountCount: updatedAccounts.length
      });
      
      return { success: true };
    } catch (error) {
      clientLogger.error(`Sign in failed for ${provider}`, 'UNIFIED_AUTH', { provider, error });
      return { error: error instanceof Error ? error.message : 'Sign in failed' };
    }
  };

  const signOut = async (provider?: string): Promise<void> => {
    try {
      if (provider) {
        // Sign out from specific provider
        const accounts = getStorageItem<ConnectedAccount[]>(STORAGE_KEYS.ACCOUNTS) || [];
        const filteredAccounts = accounts.filter(acc => acc.provider !== provider);
        
        setStorageItem(STORAGE_KEYS.ACCOUNTS, filteredAccounts);
        
        clientLogger.info(`Signed out from ${provider}`, 'UNIFIED_AUTH', { provider });
      } else {
        // Sign out from all providers
        removeStorageItem(STORAGE_KEYS.ACCOUNTS);
        removeStorageItem(STORAGE_KEYS.SESSION);
        removeStorageItem(STORAGE_KEYS.USER);
        removeSessionCookie();
        
        clientLogger.info('Signed out from all providers', 'UNIFIED_AUTH');
      }
      
      await updateSession();
    } catch (error) {
      clientLogger.error('Sign out failed', 'UNIFIED_AUTH', { provider, error });
    }
  };

  const disconnect = async (provider: string): Promise<void> => {
    await signOut(provider);
  };

  const isConnected = (provider: string): boolean => {
    const accounts = getStorageItem<ConnectedAccount[]>(STORAGE_KEYS.ACCOUNTS) || [];
    return accounts.some(acc => acc.provider === provider);
  };

  const getAccount = (provider: string): ConnectedAccount | null => {
    const accounts = getStorageItem<ConnectedAccount[]>(STORAGE_KEYS.ACCOUNTS) || [];
    return accounts.find(acc => acc.provider === provider) || null;
  };

  const getAllAccounts = (): ConnectedAccount[] => {
    return getStorageItem<ConnectedAccount[]>(STORAGE_KEYS.ACCOUNTS) || [];
  };

  // Initialize session on mount
  useEffect(() => {
    updateSession();
  }, []);

  return {
    session,
    status,
    signIn,
    signOut,
    updateSession,
    isConnected,
    getAccount,
    getAllAccounts,
    disconnect
  };
};

// Auth provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useUnifiedAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Legacy compatibility layer for NextAuth
export const useSession = () => {
  const auth = useAuth();
  
  return {
    data: auth.session,
    status: auth.status,
    update: auth.updateSession
  };
};

export const signIn = async (provider: string, options?: any) => {
  // This is a standalone function for compatibility
  // In practice, you should use the useAuth hook
  const accounts = getStorageItem<ConnectedAccount[]>(STORAGE_KEYS.ACCOUNTS) || [];
  const filteredAccounts = accounts.filter(acc => acc.provider !== provider);
  const newAccount = createAccount(provider, options || {});
  const updatedAccounts = [...filteredAccounts, newAccount];
  
  setStorageItem(STORAGE_KEYS.ACCOUNTS, updatedAccounts);
  
  clientLogger.info(`Legacy signIn called for ${provider}`, 'UNIFIED_AUTH', { provider });
  
  return { error: null, ok: true };
};

export const signOut = async (provider?: string) => {
  if (provider) {
    const accounts = getStorageItem<ConnectedAccount[]>(STORAGE_KEYS.ACCOUNTS) || [];
    const filteredAccounts = accounts.filter(acc => acc.provider !== provider);
    setStorageItem(STORAGE_KEYS.ACCOUNTS, filteredAccounts);
  } else {
    removeStorageItem(STORAGE_KEYS.ACCOUNTS);
    removeStorageItem(STORAGE_KEYS.SESSION);
    removeStorageItem(STORAGE_KEYS.USER);
    removeSessionCookie();
  }
  
  clientLogger.info(`Legacy signOut called`, 'UNIFIED_AUTH', { provider });
};

// Utility functions for backward compatibility
export const isProviderConnected = (provider: string): boolean => {
  const accounts = getStorageItem<ConnectedAccount[]>(STORAGE_KEYS.ACCOUNTS) || [];
  return accounts.some(acc => acc.provider === provider);
};

export const getConnectedAccount = (provider: string): ConnectedAccount | null => {
  const accounts = getStorageItem<ConnectedAccount[]>(STORAGE_KEYS.ACCOUNTS) || [];
  return accounts.find(acc => acc.provider === provider) || null;
};

export const getAllConnectedAccounts = (): ConnectedAccount[] => {
  return getStorageItem<ConnectedAccount[]>(STORAGE_KEYS.ACCOUNTS) || [];
};


