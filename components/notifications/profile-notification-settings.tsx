'use client';

import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, User, Bell } from 'lucide-react';
import { NotificationSettings } from './notification-settings';
import { useProfiles } from '@/hooks/use-profiles';
import { useNotificationPreferences } from '@/hooks/use-notification-preferences';
import { NotificationPreferences } from '@/types/notifications';

interface ProfileNotificationSettingsProps {
  className?: string;
}

export const ProfileNotificationSettings: React.FC<ProfileNotificationSettingsProps> = ({
  className
}) => {
  const { currentProfile, isLoading: profilesLoading } = useProfiles();
  const {
    preferences,
    isLoading: preferencesLoading,
    error,
    updatePreferences,
    resetToDefaults
  } = useNotificationPreferences();

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Salvataggio automatico delle preferenze
  const handleUpdatePreferences = async (newPreferences: NotificationPreferences): Promise<boolean> => {
    if (!currentProfile) {
      return false;
    }

    try {
      const success = await updatePreferences(newPreferences);
      if (success && autoSaveEnabled) {
        setLastSaved(new Date());
      }
      return success;
    } catch (error) {
      console.error('Errore nel salvataggio automatico delle preferenze:', error);
      return false;
    }
  };

  // Reset alle impostazioni predefinite con conferma
  const handleResetToDefaults = async (): Promise<boolean> => {
    if (!currentProfile) {
      return false;
    }

    try {
      const success = await resetToDefaults();
      if (success) {
        setLastSaved(new Date());
      }
      return success;
    } catch (error) {
      console.error('Errore nel reset delle preferenze:', error);
      return false;
    }
  };

  // Mostra loading se i profili o le preferenze stanno caricando
  if (profilesLoading || preferencesLoading) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mostra errore se non c'è un profilo corrente
  if (!currentProfile) {
    return (
      <div className={className}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Nessun profilo selezionato. Effettua l'accesso per configurare le impostazioni delle notifiche.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Mostra errore se ci sono problemi nel caricamento delle preferenze
  if (error) {
    return (
      <div className={className}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Errore nel caricamento delle preferenze notifiche: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header con informazioni profilo */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Profilo Corrente</span>
          </CardTitle>
          <CardDescription>
            Stai configurando le notifiche per il profilo <strong>{currentProfile.name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <span>ID: {currentProfile.id}</span>
              <span>•</span>
              <span>Creato: {new Date(currentProfile.created_at).toLocaleDateString('it-IT')}</span>
            </div>
            {lastSaved && (
              <div className="flex items-center space-x-1">
                <Bell className="h-3 w-3" />
                <span>Ultimo salvataggio: {lastSaved.toLocaleTimeString('it-IT')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Componente impostazioni notifiche */}
      <NotificationSettings
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
        onResetToDefaults={handleResetToDefaults}
        isLoading={preferencesLoading}
        className="space-y-6"
      />

      {/* Footer con informazioni salvataggio automatico */}
      <Card className="mt-6 bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Salvataggio Automatico</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {autoSaveEnabled ? 'Attivo' : 'Disattivo'}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Le impostazioni vengono salvate automaticamente per il profilo corrente. 
            Ogni profilo mantiene le proprie preferenze di notifica indipendenti.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileNotificationSettings;