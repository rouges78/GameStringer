'use client';

import { useEffect, useState } from 'react';
import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useProfileAuth } from '@/lib/profile-auth';

export interface RouteGuardConfig {
  // Routes that require authentication
  protectedRoutes: string[];
  // Routes that should redirect to dashboard if authenticated
  publicOnlyRoutes: string[];
  // Default redirect for authenticated users
  defaultAuthenticatedRoute: string;
  // Default redirect for unauthenticated users
  defaultUnauthenticatedRoute: string;
}

const defaultConfig: RouteGuardConfig = {
  protectedRoutes: [
    '/library',
    '/injekt-translator',
    '/editor',
    '/dialogue-patcher',
    '/patches',
    '/store-manager',
    '/settings',
    '/admin'
  ],
  publicOnlyRoutes: [
    '/auth/login',
    '/auth/register'
  ],
  defaultAuthenticatedRoute: '/',
  defaultUnauthenticatedRoute: '/'
};

export function useRouteGuard(config: Partial<RouteGuardConfig> = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useProfileAuth();
  const [isChecking, setIsChecking] = useState(true);

  const finalConfig = { ...defaultConfig, ...config };

  useEffect(() => {
    if (isLoading) return;

    const checkRoute = () => {
      const isProtectedRoute = finalConfig.protectedRoutes.some(route => 
        pathname.startsWith(route)
      );
      
      const isPublicOnlyRoute = finalConfig.publicOnlyRoutes.some(route => 
        pathname.startsWith(route)
      );

      // If user is not authenticated and trying to access protected route
      if (!isAuthenticated && isProtectedRoute) {
        router.replace(finalConfig.defaultUnauthenticatedRoute);
        return;
      }

      // If user is authenticated and trying to access public-only route
      if (isAuthenticated && isPublicOnlyRoute) {
        router.replace(finalConfig.defaultAuthenticatedRoute);
        return;
      }

      setIsChecking(false);
    };

    checkRoute();
  }, [isAuthenticated, isLoading, pathname, router, finalConfig]);

  return {
    isChecking: isLoading || isChecking,
    isAuthenticated,
    canAccess: !isChecking
  };
}

// Higher-order component for route protection
export function withRouteGuard<P extends object>(
  Component: React.ComponentType<P>,
  config?: Partial<RouteGuardConfig>
) {
  return function GuardedComponent(props: P) {
    const { isChecking, canAccess } = useRouteGuard(config);

    if (isChecking) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 mx-auto animate-pulse">
              <div className="w-8 h-8 bg-white/20 rounded-full"></div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">GameStringer</h1>
            <p className="text-blue-200">Verifica autorizzazioni...</p>
          </div>
        </div>
      );
    }

    if (!canAccess) {
      return null; // Router will handle redirect
    }

    return <Component {...props} />;
  };
}

// Utility to check if a route requires authentication
export function isProtectedRoute(pathname: string, config: Partial<RouteGuardConfig> = {}): boolean {
  const finalConfig = { ...defaultConfig, ...config };
  return finalConfig.protectedRoutes.some(route => pathname.startsWith(route));
}

// Utility to check if a route is public-only
export function isPublicOnlyRoute(pathname: string, config: Partial<RouteGuardConfig> = {}): boolean {
  const finalConfig = { ...defaultConfig, ...config };
  return finalConfig.publicOnlyRoutes.some(route => pathname.startsWith(route));
}