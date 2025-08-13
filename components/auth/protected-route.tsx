'use client';

import { useEffect, useState } from 'react';
import { useProfileAuth } from '@/lib/profile-auth';
import { ProfileSelector } from '@/components/profiles/profile-selector';
import { CreateProfileDialog } from '@/components/profiles/create-profile-dialog';
import { useProfiles } from '@/hooks/use-profiles';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { Loader2, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAuth?: boolean;
}

export function ProtectedRoute({ 
  children, 
  fallback,
  requireAuth = true 
}: ProtectedRouteProps) {
  const { 
    isAuthenticated, 
    currentProfile, 
    isLoading, 
    sessionTimeRemaining,
    isSessionExpired,
    renewSession,
    logout 
  } = useProfileAuth();
  
  // Debug log per tracking stato ProtectedRoute
  useEffect(() => {
    console.log('🛡️ ProtectedRoute stato aggiornato:', {
      isAuthenticated,
      currentProfile: currentProfile?.name || 'null',
      isLoading,
      requireAuth,
      isSessionExpired,
      sessionTimeRemaining,
      timestamp: new Date().toISOString()
    });
  }, [isAuthenticated, currentProfile, isLoading, requireAuth, isSessionExpired, sessionTimeRemaining]);
  
  const { profiles } = useProfiles();
  const { updateGlobalSettings } = useProfileSettings();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);



  // Handle profile selection
  const handleProfileSelected = async (profileId: string) => {
    console.log('🎯 ProtectedRoute: handleProfileSelected chiamato con profileId:', profileId);
    
    // ✅ FIX DEFINITIVO: Non fare NULLA qui!
    // L'autenticazione è già stata completamente gestita da authenticateProfile in useProfiles
    // Qualsiasi azione aggiuntiva qui causa il riavvio dell'app
    console.log('✅ Autenticazione già gestita da useProfiles, nessuna azione necessaria qui');
    return;
  };

  // Handle profile creation
  const handleCreateProfile = () => {
    setShowCreateDialog(true);
  };

  // Handle profile created
  const handleProfileCreated = async (profileName: string) => {
    console.log('🎯 ProtectedRoute: handleProfileCreated chiamato con:', profileName);
    console.log('🔍 Stato corrente isAuthenticated:', isAuthenticated);
    console.log('🔍 Profilo corrente:', currentProfile?.name);
    
    // Aggiorna le impostazioni globali
    await updateGlobalSettings({
      last_profile: profileName
    });
    console.log('✅ Impostazioni globali aggiornate');
    
    // Chiudi il dialog
    setShowCreateDialog(false);
    console.log('✅ Dialog di creazione chiuso');
    
    // ✅ CHIAMA ANCHE handleProfileSelected per completare il flusso
    console.log('🔄 Chiamando handleProfileSelected per completare il flusso');
    await handleProfileSelected(profileName);
  };

  // Handle session renewal
  const handleRenewSession = async () => {
    setIsRenewing(true);
    const success = await renewSession();
    setIsRenewing(false);
    
    if (!success) {
      // If renewal fails, logout
      await logout();
    }
  };

  // If auth is not required, render children directly
  if (!requireAuth) {
    return <>{children}</>;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 mx-auto">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">GameStringer</h1>
          <p className="text-blue-200">Caricamento sistema di autenticazione...</p>
        </div>
      </div>
    );
  }

  // Session expired - show renewal option
  if (isSessionExpired && currentProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800/50 border-slate-700">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-white">Sessione Scaduta</CardTitle>
            <CardDescription className="text-slate-300">
              La tua sessione per il profilo "{currentProfile.name}" è scaduta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-slate-400">
              Per motivi di sicurezza, le sessioni scadono automaticamente dopo un periodo di inattività.
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleRenewSession}
                disabled={isRenewing}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isRenewing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rinnovo sessione...
                  </>
                ) : (
                  'Rinnova Sessione'
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={logout}
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cambia Profilo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if we should skip authentication (for development/testing)
  const SKIP_AUTH_FOR_TESTING = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';
  
  // 🚨 FORZA AUTENTICAZIONE - Ignora tutto e mostra sempre profili se non autenticato
  const BYPASS_AUTH_FOR_DEBUG = false; // Sempre disabilitato
  const SHOW_DEBUG_COMPONENT = false; // Sempre disabilitato
  
  // 🔧 DEBUG: Forza log dello stato
  console.log('🔍 ProtectedRoute DEBUG:', {
    isAuthenticated,
    currentProfile: currentProfile?.name || 'null',
    requireAuth,
    BYPASS_AUTH_FOR_DEBUG,
    SKIP_AUTH_FOR_TESTING
  });
  
  // Not authenticated - show debug component or profile selector
  if (!isAuthenticated && !SKIP_AUTH_FOR_TESTING && !BYPASS_AUTH_FOR_DEBUG) {
    if (SHOW_DEBUG_COMPONENT) {
      // Importa dinamicamente il componente di debug
      const { SimpleAuthTest } = require('@/components/debug/simple-auth-test');
      return <SimpleAuthTest />;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <>
        <ProfileSelector
          onProfileSelected={handleProfileSelected}
          onCreateProfile={handleCreateProfile}
        />
        <CreateProfileDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onProfileCreated={handleProfileCreated}
        />
      </>
    );
  }

  // Bypass disabilitato - autenticazione normale

  // Authenticated - render protected content
  return <>{children}</>;
}

// Higher-order component for page-level protection
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: { requireAuth?: boolean; fallback?: React.ReactNode } = {}
) {
  const { requireAuth = true, fallback } = options;
  
  return function AuthenticatedComponent(props: P) {
    return (
      <ProtectedRoute requireAuth={requireAuth} fallback={fallback}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}