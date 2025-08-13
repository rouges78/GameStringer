'use client';

import { NotificationIntegrationTest } from '@/components/notifications/integration-test';

export default function TestNotificationIntegrationPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Test Integrazione Sistema Notifiche</h1>
          <p className="text-muted-foreground">
            Verifica che il sistema di notifiche sia correttamente integrato nell'applicazione principale.
          </p>
        </div>

        <NotificationIntegrationTest />
      </div>
    </div>
  );
}