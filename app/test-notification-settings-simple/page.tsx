'use client';

import React from 'react';
import { ProfileNotificationIntegrationDemo } from '@/components/notifications/profile-notification-integration-demo';

export default function TestNotificationSettingsSimplePage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Test Integrazione Profili - Notifiche
          </h1>
          <p className="text-muted-foreground">
            Demo completa dell'integrazione tra sistema profili e impostazioni notifiche con salvataggio automatico
          </p>
        </div>
        
        <ProfileNotificationIntegrationDemo />
      </div>
    </div>
  );
}