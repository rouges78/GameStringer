'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useProfiles } from '@/hooks/use-profiles';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { UserProfile } from '@/types/profiles';

interface ProfileAuthContextType {
  isAuthenticated: boolean;
  currentProfile: UserProfile | null;
  isLoading: boolean;
  sessionTimeRemaining: number | null;
  isSessionExpired: boolean;
  renewSession: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const ProfileAuthContext = createContext<ProfileAuthContextType | undefined>(undefined);

interface ProfileAuthProviderProps {
  children: ReactNode;
}

export function ProfileAuthProvider({ children }: ProfileAuthProviderProps) {
  const { currentProfile, isLoading, logout: profileLogout, refreshProfiles } = useProfiles();
  
  // Force re-render when currentProfile changes
  const [renderKey, setRenderKey] = useState(0);
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [currentProfile]);
  
  // Listen to auth changes from other hook instances and refresh local state
  useEffect(() => {
    const handler = () => {
      console.log('🔔 ProfileAuthProvider: received profile-auth-changed -> refreshing profiles');
      refreshProfiles().catch(err => console.warn('ProfileAuthProvider refreshProfiles error:', err));
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('profile-auth-changed', handler);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('profile-auth-changed', handler);
      }
    };
  }, [refreshProfiles]);
  const { globalSettings } = useProfileSettings();
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // Check session status periodically - DISABILITATO per evitare conflitti con autenticazione semplice
  // useEffect(() => {
  //   if (!currentProfile) {
  //     // Reset session state when no profile
  //     setIsSessionExpired(false);
  //     setSessionTimeRemaining(null);
  //     return;
  //   }

  //   // Reset session expired for new profile
  //   setIsSessionExpired(false);

  //   const checkSession = async () => {
  //     try {
  //       // Check if session is expired via Tauri command (timeout: 30 minuti = 1800 secondi)
  //       const { invoke } = await import('@/lib/tauri-api');
  //       const response = await invoke<{success: boolean, data: boolean}>('is_session_expired', { 
  //         timeout_seconds: 1800 
  //       });
        
  //       if (response.success) {
  //         setIsSessionExpired(response.data);

  //         if (!response.data) {
  //           // Get remaining session time
  //           const timeResponse = await invoke<{success: boolean, data: number}>('get_session_time_remaining', {
  //             timeout_seconds: 1800 // 30 minuti
  //           });
  //           if (timeResponse.success) {
  //             setSessionTimeRemaining(timeResponse.data);
  //           }
  //         }
  //       }
  //     } catch (error) {
  //       console.error('Error checking session status:', error);
  //       // Non impostare expired=true per errori di connessione
  //       // setIsSessionExpired(true);
  //     }
  //   };

  //   // Check immediately
  //   checkSession();

  //   // Check every 30 seconds
  //   const interval = setInterval(checkSession, 30000);

  //   return () => clearInterval(interval);
  // }, [currentProfile]);

  // Auto-logout when session expires - DISABILITATO per evitare conflitti
  // useEffect(() => {
  //   if (isSessionExpired && currentProfile) {
  //     handleLogout();
  //   }
  // }, [isSessionExpired, currentProfile]);

  const renewSession = async (): Promise<boolean> => {
    try {
      const { invoke } = await import('@/lib/tauri-api');
      const response = await invoke<{success: boolean, data: boolean}>('renew_session');
      
      if (response.success && response.data) {
        setIsSessionExpired(false);
        // Refresh session time
        const timeResponse = await invoke<{success: boolean, data: number}>('get_session_time_remaining', {
          timeoutSeconds: 1800 // 30 minuti - Tauri 2.x converte automaticamente in snake_case
        });
        if (timeResponse.success) {
          setSessionTimeRemaining(timeResponse.data);
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error renewing session:', error);
      return false;
    }
  };

  const handleLogout = async () => {
    try {
      await profileLogout();
      setSessionTimeRemaining(null);
      setIsSessionExpired(false);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  // Calcola stato autenticazione
  // SEMPLIFICATO: Se c'è un currentProfile, l'utente è autenticato
  const isAuthenticated = !!currentProfile;
  
  // TEMPORARY DEBUG - Verifica stato autenticazione
  console.log('🔐 ProfileAuth Status:', {
    currentProfile: currentProfile?.name || 'null',
    isAuthenticated,
    isLoading
  });

  // Alert for authentication problems (keep for debugging critical issues)
  if (currentProfile && !isAuthenticated) {
    console.error('Authentication issue: currentProfile present but isAuthenticated = false', {
      profileName: currentProfile.name,
      isSessionExpired,
      sessionTimeRemaining
    });
  }

  const value: ProfileAuthContextType = {
    isAuthenticated,
    currentProfile,
    isLoading,
    sessionTimeRemaining,
    isSessionExpired,
    renewSession,
    logout: handleLogout,
  };

  return (
    <ProfileAuthContext.Provider value={value}>
      {children}
    </ProfileAuthContext.Provider>
  );
}

export function useProfileAuth() {
  const context = useContext(ProfileAuthContext);
  if (context === undefined) {
    throw new Error('useProfileAuth must be used within a ProfileAuthProvider');
  }
  return context;
}