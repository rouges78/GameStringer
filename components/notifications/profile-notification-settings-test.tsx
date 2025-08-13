'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bell, 
  User, 
  Save, 
  RotateCcw, 
  CheckCircle, 
  AlertTriangle,
  Settings,
  Volume2,
  VolumeX,
  Monitor
} from 'lucide-react';
import { ProfileNotificationSettings } from './profile-notification-settings';
import { useProfileNotificationSettings } from '@/hooks/use-profile-notification-settings';
import { NotificationType } from '@/types/notifications';

export const ProfileNotificationSettingsTest: React.FC = () => {
  const {
    currentProfile,
    preferences,
    isLoading,
    error,
    hasUnsavedChanges,
    updatePreferences,
    resetToDefaults,
    saveChanges,
    discardChanges,
    toggleGlobalNotifications,
    toggleNotificationType,
    toggleSounds,
    toggleDesktopNotifications,
    isTypeEnabled,
    getEnabledTypesCount,
    canReceiveNotifications
  } = useProfileNotificationSettings();

  const [testMode, setTestMode] = useState(false);

  const handleQuickAction = async (action: string) => {
    try {
      switch (action) {
        case 'toggle_global':
          await toggleGlobalNotifications(!preferences?.globalEnabled);
          break;
        case 'toggle_sounds':
          await toggleSounds(!preferences?.soundEnabled);
          break;
        case 'toggle_desktop':
          await toggleDesktopNotifications(!preferences?.desktopEnabled);
          break;
        case 'disable_games':
          await toggleNotificationType(NotificationType.GAME, false);
          break;
        case 'enable_security':
          await toggleNotificationType(NotificationType.SECURITY, true);
          break;
        case 'reset':
          await resetToDefaults();
          break;
      }
    } catch (error) {
      console.error('Errore nell\'azione rapida:', error);
    }
  };

  const getStatusInfo = () => {
    if (!preferences) return null;

    return {
      globalEnabled: preferences.globalEnabled,
      soundEnabled: preferences.soundEnabled,
      desktopEnabled: preferences.desktopEnabled,
      enabledTypes: getEnabledTypesCount(),
      totalTypes: Object.keys(preferences.typeSettings).length,
      canReceive: canReceiveNotifications(),
      hasQuietHours: preferences.quietHours?.enabled || false
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="space-y-6">
      {/* Header di test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Test Integrazione Profili - Notifiche</span>
          </CardTitle>
          <CardDescription>
            Test completo dell'integrazione tra sistema profili e impostazioni notifiche
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stato profilo */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Profilo Corrente</span>
              </h4>
              {currentProfile ? (
                <div className="text-sm space-y-1">
                  <div><strong>Nome:</strong> {currentProfile.name}</div>
                  <div><strong>ID:</strong> {currentProfile.id}</div>
                  <Badge variant="outline" className="text-xs">
                    Autenticato
                  </Badge>
                </div>
              ) : (
                <Badge variant="destructive">Nessun profilo</Badge>
              )}
            </div>

            {/* Stato notifiche */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center space-x-2">
                <Bell className="h-4 w-4" />
                <span>Stato Notifiche</span>
              </h4>
              {statusInfo ? (
                <div className="text-sm space-y-1">
                  <div className="flex items-center space-x-2">
                    <span>Globali:</span>
                    <Badge variant={statusInfo.globalEnabled ? "default" : "secondary"}>
                      {statusInfo.globalEnabled ? 'Abilitate' : 'Disabilitate'}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>Tipi attivi:</span>
                    <Badge variant="outline">
                      {statusInfo.enabledTypes}/{statusInfo.totalTypes}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>Può ricevere:</span>
                    <Badge variant={statusInfo.canReceive ? "default" : "secondary"}>
                      {statusInfo.canReceive ? 'Sì' : 'No'}
                    </Badge>
                  </div>
                </div>
              ) : (
                <Badge variant="secondary">Caricamento...</Badge>
              )}
            </div>
          </div>

          {/* Modifiche non salvate */}
          {hasUnsavedChanges && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Hai modifiche non salvate</span>
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline" onClick={discardChanges}>
                    Scarta
                  </Button>
                  <Button size="sm" onClick={saveChanges}>
                    <Save className="h-3 w-3 mr-1" />
                    Salva
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Errori */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Azioni rapide */}
      <Card>
        <CardHeader>
          <CardTitle>Azioni Rapide di Test</CardTitle>
          <CardDescription>
            Testa le funzionalità di integrazione con azioni rapide
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction('toggle_global')}
              disabled={isLoading}
            >
              <Bell className="h-3 w-3 mr-1" />
              Toggle Globali
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction('toggle_sounds')}
              disabled={isLoading}
            >
              {preferences?.soundEnabled ? (
                <Volume2 className="h-3 w-3 mr-1" />
              ) : (
                <VolumeX className="h-3 w-3 mr-1" />
              )}
              Toggle Suoni
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction('toggle_desktop')}
              disabled={isLoading}
            >
              <Monitor className="h-3 w-3 mr-1" />
              Toggle Desktop
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction('disable_games')}
              disabled={isLoading}
            >
              🎮 Disabilita Giochi
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction('enable_security')}
              disabled={isLoading}
            >
              🔒 Abilita Sicurezza
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction('reset')}
              disabled={isLoading}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Componente principale */}
      <ProfileNotificationSettings />
    </div>
  );
};

export default ProfileNotificationSettingsTest;