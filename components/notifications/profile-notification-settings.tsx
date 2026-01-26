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
import { useTranslation } from '@/lib/i18n';

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
  const { t } = useTranslation();

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
      console.error('Error auto-saving preferences:', error);
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
      console.error('Error resetting preferences:', error);
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

  // Mostra error se non c'è un profilo corrente
  if (!currentProfile) {
    return (
      <div className={className}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t('notifications.noProfile')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Mostra error se ci sono problemi nel Loading...lle preferenze
  if (error) {
    return (
      <div className={className}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t('notifications.loadError')}: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={className}>
      <Card className="border-slate-800 bg-slate-900/50">
        {/* Header pulito */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-white">{currentProfile.name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <div className={`w-1.5 h-1.5 rounded-full ${autoSaveEnabled ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            {t('notifications.autoSave')}
          </div>
        </div>

        {/* Contenuto principale */}
        <div className="p-3">
          <NotificationSettings
            preferences={preferences}
            onPreferencesChange={handleUpdatePreferences}
            isLoading={preferencesLoading}
            className="space-y-2"
          />
        </div>
      </Card>
    </div>
  );
};

export default ProfileNotificationSettings;


