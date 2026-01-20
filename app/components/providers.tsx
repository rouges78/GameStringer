'use client';

// Sistema di autenticazione unificato - sostituisce NextAuth
import React from 'react';
import { AuthProvider } from '@/lib/unified-auth';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
