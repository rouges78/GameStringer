'use client';

import { useState } from 'react';
import { useProfileAuth } from '@/lib/profile-auth';
import { ProfileSelector } from '@/components/profiles/profile-selector';
import { CreateProfileDialog } from '@/components/profiles/create-profile-dialog';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { Loader2 } from 'lucide-react';

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
    isLoading
  } = useProfileAuth();
  
  
  const { updateGlobalSettings } = useProfileSettings();
  const [showCreateDialog, setShowCreateDialog] = useState(false);



  // Handle profile creation
  const handleCreateProfile = () => {
    setShowCreateDialog(true);
  };

  // Handle profile created
  const handleProfileCreated = async (profileName: string) => {
    // Update global settings
    await updateGlobalSettings({
      last_profile: profileName
    });
    
    // Close dialog
    setShowCreateDialog(false);
    // Authentication is already handled in CreateProfileDialog
    // ProtectedRoute will detect currentProfile and render children
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
          <p className="text-blue-200">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Check if we should skip authentication (for development/testing)
  const SKIP_AUTH_FOR_TESTING = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';
  
  const BYPASS_AUTH_FOR_DEBUG = false;
  
  // TEMPORARY DEBUG - Verifica perché dashboard non appare
  if (process.env.NODE_ENV === 'development') {
    console.log('🛡️ ProtectedRoute Status:', {
      isAuthenticated,
      currentProfile: currentProfile?.name || 'null',
      isLoading,
      requireAuth,
      SKIP_AUTH_FOR_TESTING,
      BYPASS_AUTH_FOR_DEBUG
    });
  }
  
  // Not authenticated - show debug component or profile selector
  if (!isAuthenticated && !SKIP_AUTH_FOR_TESTING && !BYPASS_AUTH_FOR_DEBUG) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <>
        <ProfileSelector
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

  // Bypass disabilitato - authentication normale

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


