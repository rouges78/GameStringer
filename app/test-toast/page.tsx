'use client';

import React from 'react';
import { NotificationToastProvider } from '@/components/notifications/notification-toast-provider';
import ToastDemo from '@/components/notifications/toast-demo';

export default function TestToastPage() {
  return (
    <NotificationToastProvider
      maxToasts={5}
      position="top-right"
      autoHideDuration={5000}
    >
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Test Sistema Toast Notifiche
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Pagina di test per verificare il funzionamento del componente NotificationToast
            </p>
          </div>
          
          <ToastDemo />
        </div>
      </div>
    </NotificationToastProvider>
  );
}