'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import NotificationToast from './notification-toast';
import { NotificationIndicator } from './notification-indicator';
import { NotificationCenter } from './notification-center';
import { NotificationType, NotificationPriority, Notification } from '@/types/notifications';
import { 
  announceToScreenReader, 
  announceNotificationCount,
  announceBatchOperation,
  createHelpText,
  getKeyboardShortcuts
} from '@/lib/notification-accessibility';

export const AccessibilityTest: React.FC = () => {
  const [showToast, setShowToast] = useState(false);
  const [showCenter, setShowCenter] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const sampleNotification: Notification = {
    id: 'test-notification-1',
    profileId: 'test-profile',
    type: NotificationType.SYSTEM,
    title: 'Test di Accessibilità',
    message: 'Questa è una notifica di test per verificare il supporto screen reader.',
    priority: NotificationPriority.NORMAL,
    createdAt: new Date().toISOString(),
    metadata: {
      source: 'accessibility-test',
      category: 'test',
      tags: ['accessibility', 'test']
    }
  };

  const urgentNotification: Notification = {
    ...sampleNotification,
    id: 'urgent-test-notification',
    title: 'Notifica Urgente',
    message: 'Questa è una notifica urgente per testare gli annunci assertivi.',
    priority: NotificationPriority.URGENT,
    type: NotificationType.SECURITY
  };

  const handleTestAnnouncement = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announceToScreenReader(message, priority);
  };

  const handleTestNotificationCount = () => {
    const newCount = notificationCount + 1;
    announceNotificationCount(newCount, notificationCount);
    setNotificationCount(newCount);
  };

  const handleTestBatchOperation = (operation: 'read' | 'delete' | 'select') => {
    const count = Math.floor(Math.random() * 5) + 1;
    announceBatchOperation(operation, count);
  };

  const keyboardShortcuts = getKeyboardShortcuts();

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Accessibilità Sistema Notifiche</CardTitle>
          <CardDescription>
            Questa pagina permette di testare le funzionalità di accessibilità del sistema notifiche.
            Usa uno screen reader per verificare gli annunci e la navigazione.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Test Annunci Screen Reader */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Annunci Screen Reader</h3>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => handleTestAnnouncement('Messaggio di test con priorità normale')}
                variant="outline"
              >
                Test Annuncio Normale
              </Button>
              <Button 
                onClick={() => handleTestAnnouncement('Messaggio urgente di test', 'assertive')}
                variant="destructive"
              >
                Test Annuncio Urgente
              </Button>
              <Button 
                onClick={handleTestNotificationCount}
                variant="secondary"
              >
                Test Conteggio Notifiche ({notificationCount})
              </Button>
            </div>
          </div>

          {/* Test Operazioni Batch */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Operazioni Batch</h3>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => handleTestBatchOperation('read')}
                variant="outline"
              >
                Test Lettura Batch
              </Button>
              <Button 
                onClick={() => handleTestBatchOperation('delete')}
                variant="outline"
              >
                Test Eliminazione Batch
              </Button>
              <Button 
                onClick={() => handleTestBatchOperation('select')}
                variant="outline"
              >
                Test Selezione Batch
              </Button>
            </div>
          </div>

          {/* Test Componenti */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Componenti Notifica</h3>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => setShowToast(!showToast)}
                variant="outline"
              >
                {showToast ? 'Nascondi' : 'Mostra'} Toast
              </Button>
              <Button 
                onClick={() => setShowCenter(!showCenter)}
                variant="outline"
              >
                {showCenter ? 'Chiudi' : 'Apri'} Centro Notifiche
              </Button>
            </div>
          </div>

          {/* Indicatore Notifiche */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Indicatore Notifiche</h3>
            <div className="flex items-center gap-4">
              <NotificationIndicator 
                onClick={() => setShowCenter(!showCenter)}
                showBadge={true}
                animate={true}
              />
              <span className="text-sm text-muted-foreground">
                Clicca l'indicatore per testare l'apertura del centro notifiche
              </span>
            </div>
          </div>

          {/* Testi di Aiuto */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Testi di Aiuto</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Toast</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {createHelpText('toast')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Centro Notifiche</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {createHelpText('center')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Indicatore</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {createHelpText('indicator')}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Scorciatoie Tastiera */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Scorciatoie Tastiera</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(keyboardShortcuts).map(([key, description]) => (
                <div key={key} className="flex justify-between items-center p-2 bg-muted rounded">
                  <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                    {key}
                  </code>
                  <span className="text-sm text-muted-foreground ml-2">
                    {description}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Toast di Test */}
      {showToast && (
        <NotificationToast
          notification={sampleNotification}
          onDismiss={() => setShowToast(false)}
          autoHideDuration={0} // Non nascondere automaticamente per il test
          position="top-right"
        />
      )}

      {/* Centro Notifiche di Test */}
      <NotificationCenter
        isOpen={showCenter}
        onClose={() => setShowCenter(false)}
      />

      {/* Live Region per Test */}
      <div 
        id="test-live-region"
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      />

      {/* Istruzioni per Screen Reader */}
      <div className="sr-only">
        <h2>Istruzioni per Test Accessibilità</h2>
        <p>
          Questa pagina contiene vari test per verificare il supporto screen reader del sistema notifiche.
          Usa i pulsanti per testare diversi tipi di annunci e componenti.
          Le notifiche toast appariranno nell'angolo superiore destro.
          Il centro notifiche si aprirà come dialogo modale.
          Usa le scorciatoie tastiera per navigare efficacemente.
        </p>
      </div>
    </div>
  );
};

export default AccessibilityTest;