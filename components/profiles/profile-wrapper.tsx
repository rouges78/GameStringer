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
        // Setup activity tracking for session persistence
        sessionPersistence.setupActivityTracking();
        
        // Try to restore previous session
        await sessionPersistence.restoreSession();
        
        // Clean up any expired sessions
        sessionPersistence.cleanup();
      } catch (error) {
        console.error('Error initializing session persistence:', error);
      } finally {
        // Small delay to prevent flash
        setTimeout(() => {
          setIsInitializing(false);
        }, 300);
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