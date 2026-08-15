/**
 * Contesto e hook di ProfileAuth, SENZA il Provider.
 *
 * PERCHÉ È UN FILE A PARTE (15/08/2026): stavano in profile-auth.tsx accanto
 * al componente ProfileAuthProvider, e `hooks/use-notifications.ts` (file
 * non-React, nel grafo di OGNI pagina via campanella → layout) importava
 * `useProfileAuth` da lì. Un file che esporta un componente E valori
 * importati da moduli non-React spegne il Fast Refresh di Next: ogni
 * navigazione in dev degradava a full reload (doppio click su ogni pagina).
 * Stessa chirurgia di lib/i18n/t-static.ts, stesso giorno.
 */
import { createContext, useContext } from 'react';
import { UserProfile } from '@/types/profiles';

export interface ProfileAuthContextType {
  isAuthenticated: boolean;
  currentProfile: UserProfile | null;
  isLoading: boolean;
  sessionTimeRemaining: number | null;
  isSessionExpired: boolean;
  renewSession: () => Promise<boolean>;
  logout: () => Promise<void>;
}

export const ProfileAuthContext = createContext<ProfileAuthContextType | undefined>(undefined);

export function useProfileAuth() {
  const context = useContext(ProfileAuthContext);
  if (context === undefined) {
    throw new Error('useProfileAuth must be used within a ProfileAuthProvider');
  }
  return context;
}
