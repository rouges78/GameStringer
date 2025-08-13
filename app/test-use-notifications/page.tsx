'use client';

import React from 'react';
import { UseNotificationsTest } from '@/components/notifications/use-notifications-test';

export default function TestUseNotificationsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Test Hook useNotifications
          </h1>
          <p className="text-muted-foreground">
            Test completo delle funzionalità avanzate dell'hook useNotifications con real-time updates, 
            operazioni batch, filtri avanzati e gestione ottimizzata dello stato.
          </p>
        </div>
        
        <UseNotificationsTest />
      </div>
    </div>
  );
}