'use client';

// NextAuth rimosso - gestione auth locale
import React from 'react';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return <>{children}</>;
}
