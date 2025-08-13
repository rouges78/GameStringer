'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationSettings } from './notification-settings';
import { 
  NotificationPreferences, 
  NotificationType, 
  NotificationPriority,
  DEFAULT_NOTIFICATION_PREFERENCES 
} from '@/types/notifications';

export const NotificationSettingsTest: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    profileId: 'test-profile-123',
    updatedAt: new Date().toISOString()
  });
  
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdatePreferences = async (newPreferences: NotificationPreferences): Promise<boolean> => {
    console.log('Aggiornamento preferenze:', newPreferences);
    
    setIsLoading(true);
    
    // Simula un delay per il salvataggio
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setPreferences(newPreferences);
    setIsLoading(false);
    
    return true;
  };

  const handleResetToDefaults = async (): Promise<boolean> => {
    console.log('Reset alle impostazioni predefinite');
    
    setIsLoading(true);
    
    // Simula un delay per il reset
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setPreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      profileId: 'test-profile-123',
      updatedAt: new Date().toISOString()
    });
    
    setIsLoading(false);
    
    return true;
  };

  const loadTestPreferences = (type: 'minimal' | 'full' | 'quiet') => {
    let testPrefs: NotificationPreferences;
    
    switch (type) {
      case 'minimal':
        testPrefs = {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          profileId: 'test-profile-123',
          globalEnabled: true,
          soundEnabled: false,
          desktopEnabled: false,
          typeSettings: {
            ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings,
            [NotificationType.SYSTEM]: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings[NotificationType.SYSTEM],
              enabled: true
            },
            [NotificationType.SECURITY]: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings[NotificationType.SECURITY],
              enabled: true
            },
            [NotificationType.PROFILE]: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings[NotificationType.PROFILE],
              enabled: false
            },
            [NotificationType.GAME]: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings[NotificationType.GAME],
              enabled: false
            },
            [NotificationType.STORE]: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings[NotificationType.STORE],
              enabled: false
            },
            [NotificationType.UPDATE]: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings[NotificationType.UPDATE],
              enabled: false
            },
            [NotificationType.CUSTOM]: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings[NotificationType.CUSTOM],
              enabled: false
            }
          },
          maxNotifications: 20,
          autoDeleteAfterDays: 7,
          updatedAt: new Date().toISOString()
        };
        break;
        
      case 'full':
        testPrefs = {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          profileId: 'test-profile-123',
          globalEnabled: true,
          soundEnabled: true,
          desktopEnabled: true,
          maxNotifications: 100,
          autoDeleteAfterDays: 60,
          updatedAt: new Date().toISOString()
        };
        break;
        
      case 'quiet':
        testPrefs = {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          profileId: 'test-profile-123',
          globalEnabled: true,
          soundEnabled: false,
          desktopEnabled: true,
          quietHours: {
            enabled: true,
            startTime: '22:00',
            endTime: '08:00',
            allowUrgent: true
          },
          maxNotifications: 30,
          autoDeleteAfterDays: 14,
          updatedAt: new Date().toISOString()
        };
        break;
        
      default:
        testPrefs = {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          profileId: 'test-profile-123',
          updatedAt: new Date().toISOString()
        };
    }
    
    setPreferences(testPrefs);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Impostazioni Notifiche</CardTitle>
          <CardDescription>
            Componente per testare le impostazioni delle notifiche con diversi scenari
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => loadTestPreferences('minimal')}
            >
              Configurazione Minimale
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => loadTestPreferences('full')}
            >
              Configurazione Completa
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => loadTestPreferences('quiet')}
            >
              Con Ore di Silenzio
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleResetToDefaults}
            >
              Reset Predefinite
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <strong>Profilo Corrente:</strong> {preferences.profileId}<br />
            <strong>Ultimo Aggiornamento:</strong> {new Date(preferences.updatedAt).toLocaleString('it-IT')}<br />
            <strong>Notifiche Globali:</strong> {preferences.globalEnabled ? 'Abilitate' : 'Disabilitate'}
          </div>
        </CardContent>
      </Card>

      <NotificationSettings
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
        onResetToDefaults={handleResetToDefaults}
        isLoading={isLoading}
      />
    </div>
  );
};

export default NotificationSettingsTest;