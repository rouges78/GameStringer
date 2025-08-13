'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { NotificationIndicator } from '@/components/notifications/notification-indicator';
import { useNotifications } from '@/hooks/use-notifications';
import { useNotificationShortcuts } from '@/hooks/use-global-shortcuts';
import { getKeyboardShortcuts } from '@/lib/notification-accessibility';
import { Keyboard, TestTube, Bell, Plus } from 'lucide-react';

export default function TestKeyboardNavigationPage() {
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const { createNotification, notifications, unreadCount } = useNotifications();
  
  // Setup global shortcuts
  useNotificationShortcuts(
    () => setNotificationCenterOpen(true),
    () => setNotificationCenterOpen(prev => !prev)
  );

  const shortcuts = getKeyboardShortcuts();

  const createTestNotification = (type: 'normal' | 'urgent' | 'system') => {
    const notifications = {
      normal: {
        title: 'Notifica di Test',
        message: 'Questa è una notifica di test per verificare la navigazione da tastiera.',
        type: 'SYSTEM' as const,
        priority: 'NORMAL' as const
      },
      urgent: {
        title: 'Notifica Urgente',
        message: 'Questa è una notifica urgente che richiede attenzione immediata.',
        type: 'SECURITY' as const,
        priority: 'URGENT' as const
      },
      system: {
        title: 'Aggiornamento Sistema',
        message: 'Il sistema è stato aggiornato con successo.',
        type: 'UPDATE' as const,
        priority: 'HIGH' as const
      }
    };

    createNotification(notifications[type]);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TestTube className="h-8 w-8 text-primary" />
            Test Navigazione Tastiera
          </h1>
          <p className="text-muted-foreground mt-2">
            Test delle funzionalità di navigazione da tastiera per il sistema notifiche
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <NotificationIndicator 
            onClick={() => setNotificationCenterOpen(true)}
          />
          <Button 
            onClick={() => setNotificationCenterOpen(true)}
            variant="outline"
          >
            <Bell className="h-4 w-4 mr-2" />
            Apri Centro Notifiche
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Controlli Test
            </CardTitle>
            <CardDescription>
              Crea notifiche di test per verificare la navigazione da tastiera
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => createTestNotification('normal')}
                variant="outline"
                size="sm"
              >
                Notifica Normale
              </Button>
              <Button 
                onClick={() => createTestNotification('urgent')}
                variant="outline"
                size="sm"
              >
                Notifica Urgente
              </Button>
              <Button 
                onClick={() => createTestNotification('system')}
                variant="outline"
                size="sm"
              >
                Notifica Sistema
              </Button>
            </div>
            
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span>Notifiche totali:</span>
                <Badge variant="secondary">{notifications.length}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Notifiche non lette:</span>
                <Badge variant={unreadCount > 0 ? "destructive" : "secondary"}>
                  {unreadCount}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Scorciatoie Tastiera
            </CardTitle>
            <CardDescription>
              Scorciatoie disponibili per la navigazione
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {Object.entries(shortcuts).map(([key, description]) => (
                <div key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex-1">{description}</span>
                  <Badge variant="outline" className="font-mono text-xs whitespace-nowrap">
                    {key}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Istruzioni per il Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Test Scorciatoie Globali:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Premi <Badge variant="outline" className="font-mono text-xs mx-1">Ctrl+Shift+N</Badge> per aprire il centro notifiche</li>
                <li>• Premi <Badge variant="outline" className="font-mono text-xs mx-1">F2</Badge> per attivare/disattivare il centro</li>
                <li>• Premi <Badge variant="outline" className="font-mono text-xs mx-1">Ctrl+Alt+B</Badge> per aprire il centro</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Test Navigazione Centro:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Usa <Badge variant="outline" className="font-mono text-xs mx-1">↑↓</Badge> per navigare tra le notifiche</li>
                <li>• Premi <Badge variant="outline" className="font-mono text-xs mx-1">Enter</Badge> per marcare come letta</li>
                <li>• Premi <Badge variant="outline" className="font-mono text-xs mx-1">Delete</Badge> per eliminare</li>
                <li>• Premi <Badge variant="outline" className="font-mono text-xs mx-1">M</Badge> per marcare come letta</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">💡 Suggerimenti per il Test:</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>1. Crea alcune notifiche di test usando i pulsanti sopra</li>
              <li>2. Prova le scorciatoie globali per aprire il centro notifiche</li>
              <li>3. Una volta aperto, usa le frecce per navigare tra le notifiche</li>
              <li>4. Testa le azioni rapide (Enter, Delete, M) su singole notifiche</li>
              <li>5. Prova la modalità selezione e le azioni batch</li>
              <li>6. Verifica che gli annunci screen reader funzionino correttamente</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Notification Center */}
      <NotificationCenter 
        isOpen={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
      />
    </div>
  );
}