'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ProfileAuthProvider } from '@/lib/auth/profile-auth';
import { ProfilesProvider } from '@/hooks/use-profiles';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { MainLayout } from '@/components/layout/main-layout';
import { sessionPersistence } from '@/lib/auth/session-persistence';
import { isProtectedRoute, isChromelessRoute } from '@/lib/route-config';
import { clientLogger } from '@/lib/client-logger';

interface ProfileWrapperProps {
  children: React.ReactNode;
}

export function ProfileWrapper({ children }: ProfileWrapperProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const pathname = usePathname();

  // FALLBACK IMMEDIATO: chiudi splash appena il componente è montato
  useEffect(() => {
    const closeSplashFallback = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        console.log('[ProfileWrapper] 🚀 Tentativo chiusura splash immediato...');
        await invoke('close_splash');
        console.log('[ProfileWrapper] ✅ Splash chiusa con successo');
      } catch (e) {
        console.log('[ProfileWrapper] ⚠️ close_splash fallback error:', e);
      }
    };
    // Chiudi splash dopo 2 secondi come fallback assoluto
    const fallbackTimer = setTimeout(closeSplashFallback, 2000);
    return () => clearTimeout(fallbackTimer);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      // Timeout di sicurezza: se dopo 3s non è ancora pronto, forza il completamento
      const safetyTimeout = setTimeout(() => {
        clientLogger.warn('⚠️ ProfileWrapper: Safety timeout reached, forcing initialization complete');
        setIsInitializing(false);
      }, 3000);
      
      try {
        clientLogger.debug('🔄 ProfileWrapper: Inizializzazione...');
        
        // ⛔ Sistema sessioni DISABILITATO (regola progetto: isAuthenticated = !!currentProfile,
        //    nessun auto-login — il profilo va riselezionato a ogni avvio).
        //    Si mantiene SOLO il ripristino delle connessioni store (Steam/Epic/GOG/Ubisoft),
        //    che non c'entra con l'autenticazione del profilo.
        try {
          sessionPersistence.restoreStoreConnections().catch(() => {});
        } catch (storeError) {
          clientLogger.warn('⚠️ ProfileWrapper: restore store connections fallito, continuando:', storeError);
        }
        
        clientLogger.debug('✅ ProfileWrapper: Inizializzazione completata');
      } catch (error: unknown) {
        clientLogger.error('❌ ProfileWrapper: Error initializing:', error);
      } finally {
        clearTimeout(safetyTimeout);
        clientLogger.debug('🏁 ProfileWrapper: setIsInitializing(false)');
        setIsInitializing(false);
      }
    };

    initialize();
  }, []);

  // Chiudi splash quando il frontend è pronto
  useEffect(() => {
    if (!isInitializing) {
      // Frontend pronto - chiudi splash e mostra main window
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('close_splash').catch(() => {});
      }).catch(() => {});
    }
  }, [isInitializing]);

  // Loading iniziale - non mostrare nulla, la splash Tauri è visibile
  if (isInitializing) {
    return null; // Splash Tauri è già visibile
  }

  // Determina se la route corrente richiede authentication
  const requireAuth = isProtectedRoute(pathname);

  // Finestre trasparenti aperte da Rust sopra il gioco: niente chrome, niente
  // provider di profilo. L'elenco sta in lib/route-config.ts ed è coperto dal
  // test — qui era scritto a mano e conteneva solo /ocr-overlay, quindi
  // /gs-overlay e /region-select si portavano dietro la sidebar sopra la
  // partita (corretto il 31/07/2026).
  if (pathname && isChromelessRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <ProfilesProvider>
      <ProfileAuthProvider>
        <ProtectedRoute requireAuth={requireAuth}>
          <MainLayout>
            {children}
          </MainLayout>
        </ProtectedRoute>
      </ProfileAuthProvider>
    </ProfilesProvider>
  );
}



