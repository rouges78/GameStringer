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
  const { currentProfile, isLoading, logout: profileLogout } = useProfiles();
  const { globalSettings } = useProfileSettings();
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // Check session status periodically
  useEffect(() => {
    if (!currentProfile) return;

    const checkSession = async () => {
      try {
        // Check if session is expired via Tauri command
        const { invoke } = await import('@/lib/tauri-api');
        const expired = await invoke<boolean>('is_session_expired');
        setIsSessionExpired(expired);

        if (!expired) {
          // Get remaining session time
          const remaining = await invoke<number>('get_session_time_remaining');
          setSessionTimeRemaining(remaining);
        }
      } catch (error) {
        console.error('Error checking session status:', error);
        setIsSessionExpired(true);
      }
    };

    // Check immediately
    checkSession();

    // Check every 30 seconds
    const interval = setInterval(checkSession, 30000);

    return () => clearInterval(interval);
  }, [currentProfile]);

  // Auto-logout when session expires
  useEffect(() => {
    if (isSessionExpired && currentProfile) {
      handleLogout();
    }
  }, [isSessionExpired, currentProfile]);

  const renewSession = async (): Promise<boolean> => {
    try {
      const { invoke } = await import('@/lib/tauri-api');
      const success = await invoke<boolean>('renew_session');
      
      if (success) {
        setIsSessionExpired(false);
        // Refresh session time
        const remaining = await invoke<number>('get_session_time_remaining');
        setSessionTimeRemaining(remaining);
      }
      
      return success;
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

  const value: ProfileAuthContextType = {
    isAuthenticated: !!currentProfile && !isSessionExpired,
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