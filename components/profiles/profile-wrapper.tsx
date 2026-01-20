'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ProfileAuthProvider } from '@/lib/profile-auth';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { MainLayout } from '@/components/layout/main-layout';
import { sessionPersistence } from '@/lib/session-persistence';
import { isProtectedRoute } from '@/lib/route-config';
import { Loader2 } from 'lucide-react';

interface ProfileWrapperProps {
  children: React.ReactNode;
}

export function ProfileWrapper({ children }: ProfileWrapperProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('🔄 ProfileWrapper: Inizializzazione...');
        
        // ✅ RIABILITATO con protezione anti-loop
        try {
          // Setup activity tracking for session persistence con debouncing
          sessionPersistence.setupActivityTracking();
          
          // Try to restore previous session con timeout
          const restorePromise = sessionPersistence.restoreSession();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Session restore timeout')), 1500)
          );
          
          await Promise.race([restorePromise, timeoutPromise]);
          
          // Clean up any expired sessions
          sessionPersistence.cleanup();
          
          console.log('✅ ProfileWrapper: Session persistence riabilitato con successo');
        } catch (sessionError) {
          console.warn('⚠️ ProfileWrapper: Session persistence fallito, continuando senza:', sessionError);
          // Non bloccare l'inizializzazione se la session persistence fallisce
        }
        
        console.log('✅ ProfileWrapper: Inizializzazione completata');
      } catch (error) {
        console.error('❌ ProfileWrapper: Error initializing:', error);
      } finally {
        console.log('🏁 ProfileWrapper: setIsInitializing(false)');
        setIsInitializing(false);
      }
    };

    initialize();
  }, []);

  // Loading iniziale
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 mx-auto">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">GameStringer</h1>
          <p className="text-blue-200">Inizializzazione sistema di autenticazione...</p>
        </div>
      </div>
    );
  }

  // Determina se la route corrente richiede autenticazione
  const requireAuth = isProtectedRoute(pathname);

  return (
    <ProfileAuthProvider>
      <ProtectedRoute requireAuth={requireAuth}>
        <MainLayout>
          {children}
        </MainLayout>
      </ProtectedRoute>
    </ProfileAuthProvider>
  );
}