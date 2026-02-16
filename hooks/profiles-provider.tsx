'use client';

import { ReactNode } from 'react';
import { ProfilesContext, useProfilesCore } from '@/hooks/use-profiles';

interface ProfilesProviderProps {
  children: ReactNode;
}

/**
 * Provider centralizzato per i profili.
 * Monta UNA SOLA VOLTA nel layout dell'app.
 * Tutti i componenti che usano useProfiles() condividono questo stato.
 */
export function ProfilesProvider({ children }: ProfilesProviderProps) {
  const value = useProfilesCore();
  return (
    <ProfilesContext.Provider value={value}>
      {children}
    </ProfilesContext.Provider>
  );
}
