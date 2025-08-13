'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NotificationSettings } from '@/components/notifications/notification-settings';
import { useNotificationPreferences } from '@/hooks/use-notification-preferences';
import { 
  NotificationPreferences, 
  NotificationType, 
  NotificationPriority,
  DEFAULT_NOTIFICATION_PREFERENCES 
} from '@/types/notifications';

export default function TestNotificationSettingsPage() {
  // Simula un profilo per il test
  const [currentProfileId] = useState('test-profile-123');
  
  // Usa il hook per le preferenze
  const {
    preferences,
    isLoading,
    error,
    updatePreferences,
    resetToDefaults,
    toggleNotificationType,
    updateQuietHours,
    updateGlobalSetting,
    isTypeEnabled,
    getEnabledTypesCount,
    isInQuietHours
  } = useNotificationPreferences(currentProfileId);

  // Mock delle funzioni per il test (sostituisce le chiamate Tauri)
  const mockUpdatePreferences = async (newPrefs: NotificationPreferences): Promise<boolean> => {
    console.log('Mock: Aggiornamento preferenze:', newPrefs);
    // Simula un piccolo delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  };

  const mockResetToDefaults = async (): Promise<boolean> => {
    console.log('Mock: Reset alle impostazioni predefinite');
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  };

  const createTestNotification = async (type: NotificationType) => {
    console.log(`Mock: Creazione notifica di test per tipo ${type}`);
    // Qui normalmente si chiamerebbe l'API per creare una notifica di test
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Test Impostazioni Notifiche</h1>
        <p className="text-muted-foreground mb-6">
          Test del componente NotificationSettings con tutte le sue funzionalità.
        </p>

        {/* Statistiche Correnti */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Stato Globale</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {preferences?.globalEnabled ? (
                  <Badge className="bg-green-500">Attivo</Badge>
                ) : (
                  <Badge variant="destructive">Disattivo</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tipi Abilitati</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {getEnabledTypesCount()}/{Object.keys(NotificationType).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ore di Silenzio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {preferences?.quietHours?.enabled ? (
                  <Badge variant={isInQuietHours() ? "destructive" : "secondary"}>
                    {isInQuietHours() ? 'Attive' : 'Configurate'}
                  </Badge>
                ) : (
                  <Badge variant="outline">Disattive</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Max Notifiche</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {preferences?.maxNotifications || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Notifiche per Tipo */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Test Notifiche per Tipo</CardTitle>
            <CardDescription>
              Testa le notifiche per ogni tipo per verificare le impostazioni
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.values(NotificationType).map((type) => (
                <Button
                  key={type}
                  variant={isTypeEnabled(type) ? "default" : "outline"}
                  size="sm"
                  onClick={() => createTestNotification(type)}
                  disabled={!isTypeEnabled(type)}
                  className="justify-start"
                >
                  <span className="mr-2">
                    {type === NotificationType.SYSTEM && '⚙️'}
                    {type === NotificationType.PROFILE && '👤'}
                    {type === NotificationType.SECURITY && '🔒'}
                    {type === NotificationType.UPDATE && '🔄'}
                    {type === NotificationType.GAME && '🎮'}
                    {type === NotificationType.STORE && '🏪'}
                    {type === NotificationType.CUSTOM && '📝'}
                  </span>
                  {type}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Debug Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Informazioni Debug</CardTitle>
            <CardDescription>
              Informazioni tecniche per il debug del componente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm font-mono">
              <div><strong>Profilo ID:</strong> {currentProfileId}</div>
              <div><strong>Loading:</strong> {isLoading ? 'true' : 'false'}</div>
              <div><strong>Error:</strong> {error || 'null'}</div>
              <div><strong>Preferences Loaded:</strong> {preferences ? 'true' : 'false'}</div>
              {preferences && (
                <>
                  <div><strong>Last Updated:</strong> {preferences.updatedAt}</div>
                  <div><strong>In Quiet Hours:</strong> {isInQuietHours() ? 'true' : 'false'}</div>
                  <div><strong>Sound Enabled:</strong> {preferences.soundEnabled ? 'true' : 'false'}</div>
                  <div><strong>Desktop Enabled:</strong> {preferences.desktopEnabled ? 'true' : 'false'}</div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Componente Principale */}
        <NotificationSettings
          preferences={preferences}
          onUpdatePreferences={mockUpdatePreferences}
          onResetToDefaults={mockResetToDefaults}
          isLoading={isLoading}
        />

        {/* Istruzioni per il Test */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Istruzioni per il Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <h4 className="font-semibold">Test da Eseguire:</h4>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Verifica che tutte le impostazioni siano visualizzate correttamente</li>
                <li>Testa il toggle delle impostazioni globali (Abilita Notifiche, Suoni, Desktop)</li>
                <li>Configura le ore di silenzio e verifica che vengano salvate</li>
                <li>Modifica le impostazioni per ogni tipo di notifica</li>
                <li>Testa i slider per numero massimo notifiche e eliminazione automatica</li>
                <li>Verifica che il pulsante "Salva" si attivi solo quando ci sono modifiche</li>
                <li>Testa il reset alle impostazioni predefinite</li>
                <li>Verifica che le statistiche in alto si aggiornino correttamente</li>
                <li>Testa i pulsanti per le notifiche di test (dovrebbero essere disabilitati se il tipo è disattivo)</li>
              </ol>
              
              <h4 className="font-semibold mt-4">Funzionalità da Verificare:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Responsività del layout su schermi diversi</li>
                <li>Accessibilità (navigazione con tab, screen reader)</li>
                <li>Validazione degli input (orari, slider)</li>
                <li>Feedback visivo per salvataggio/errori</li>
                <li>Disabilitazione corretta dei controlli quando le notifiche sono disattive</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}