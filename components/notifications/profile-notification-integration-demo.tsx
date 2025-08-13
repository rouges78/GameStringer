'use client';

import React, { useState, useEffect } from 'react';
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
  Monitor,
  UserPlus,
  LogIn,
  LogOut
} from 'lucide-react';
import { NotificationSettings } from './notification-settings';
import { 
  NotificationPreferences, 
  NotificationType,
  NotificationPriority,
  DEFAULT_NOTIFICATION_PREFERENCES 
} from '@/types/notifications';

// Dati mock per simulare i profili
const mockProfiles = [
  {
    id: 'profile-1',
    name: 'Giocatore Casual',
    created_at: '2024-01-15T10:30:00Z',
    last_accessed: '2024-12-08T15:45:00Z'
  },
  {
    id: 'profile-2', 
    name: 'Pro Gamer',
    created_at: '2024-02-20T14:20:00Z',
    last_accessed: '2024-12-07T20:15:00Z'
  },
  {
    id: 'profile-3',
    name: 'Sviluppatore',
    created_at: '2024-03-10T09:15:00Z', 
    last_accessed: '2024-12-06T11:30:00Z'
  }
];

// Preferenze mock per ogni profilo
const mockPreferences: Record<string, NotificationPreferences> = {
  'profile-1': {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    profileId: 'profile-1',
    globalEnabled: true,
    soundEnabled: false,
    desktopEnabled: true,
    typeSettings: {
      ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings,
      [NotificationType.GAME]: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings[NotificationType.GAME],
        enabled: true,
        showToast: true
      },
      [NotificationType.SECURITY]: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings[NotificationType.SECURITY],
        enabled: false
      }
    },
    maxNotifications: 30,
    autoDeleteAfterDays: 7,
    updatedAt: '2024-12-08T15:45:00Z'
  },
  'profile-2': {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    profileId: 'profile-2',
    globalEnabled: true,
    soundEnabled: true,
    desktopEnabled: true,
    typeSettings: {
      ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings,
      [NotificationType.GAME]: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings[NotificationType.GAME],
        enabled: true,
        priority: NotificationPriority.HIGH,
        showToast: true,
        playSound: true
      },
      [NotificationType.UPDATE]: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings[NotificationType.UPDATE],
        enabled: true,
        priority: NotificationPriority.HIGH
      }
    },
    quietHours: {
      enabled: true,
      startTime: '02:00',
      endTime: '08:00',
      allowUrgent: true
    },
    maxNotifications: 100,
    autoDeleteAfterDays: 30,
    updatedAt: '2024-12-07T20:15:00Z'
  },
  'profile-3': {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    profileId: 'profile-3',
    globalEnabled: true,
    soundEnabled: false,
    desktopEnabled: false,
    typeSettings: {
      ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings,
      [NotificationType.SYSTEM]: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings[NotificationType.SYSTEM],
        enabled: true,
        priority: NotificationPriority.HIGH
      },
      [NotificationType.SECURITY]: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings[NotificationType.SECURITY],
        enabled: true,
        priority: NotificationPriority.URGENT
      },
      [NotificationType.GAME]: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.typeSettings[NotificationType.GAME],
        enabled: false
      }
    },
    maxNotifications: 20,
    autoDeleteAfterDays: 14,
    updatedAt: '2024-12-06T11:30:00Z'
  }
};

export const ProfileNotificationIntegrationDemo: React.FC = () => {
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Simula il caricamento delle preferenze quando cambia il profilo
  useEffect(() => {
    if (currentProfile) {
      setIsLoading(true);
      
      // Simula un delay di caricamento
      setTimeout(() => {
        const profilePrefs = mockPreferences[currentProfile.id];
        if (profilePrefs) {
          setPreferences(profilePrefs);
        } else {
          // Crea preferenze predefinite per profili nuovi
          const defaultPrefs: NotificationPreferences = {
            ...DEFAULT_NOTIFICATION_PREFERENCES,
            profileId: currentProfile.id,
            updatedAt: new Date().toISOString()
          };
          setPreferences(defaultPrefs);
          mockPreferences[currentProfile.id] = defaultPrefs;
        }
        setIsLoading(false);
      }, 500);
    } else {
      setPreferences(null);
    }
  }, [currentProfile]);

  // Simula il login con un profilo
  const handleLogin = (profile: any) => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentProfile(profile);
      setIsLoading(false);
    }, 300);
  };

  // Simula il logout
  const handleLogout = () => {
    setCurrentProfile(null);
    setPreferences(null);
    setLastSaved(null);
    setSaveStatus('idle');
  };

  // Simula il salvataggio delle preferenze
  const handleUpdatePreferences = async (newPreferences: NotificationPreferences): Promise<boolean> => {
    if (!currentProfile) return false;

    setIsLoading(true);
    setSaveStatus('idle');

    try {
      // Simula un delay di salvataggio
      await new Promise(resolve => setTimeout(resolve, 800));

      // Aggiorna le preferenze mock
      mockPreferences[currentProfile.id] = {
        ...newPreferences,
        updatedAt: new Date().toISOString()
      };

      setPreferences(mockPreferences[currentProfile.id]);
      setLastSaved(new Date());
      setSaveStatus('success');
      
      setTimeout(() => setSaveStatus('idle'), 3000);
      
      return true;
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Simula il reset alle impostazioni predefinite
  const handleResetToDefaults = async (): Promise<boolean> => {
    if (!currentProfile) return false;

    setIsLoading(true);
    setSaveStatus('idle');

    try {
      await new Promise(resolve => setTimeout(resolve, 600));

      const defaultPrefs: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        profileId: currentProfile.id,
        updatedAt: new Date().toISOString()
      };

      mockPreferences[currentProfile.id] = defaultPrefs;
      setPreferences(defaultPrefs);
      setLastSaved(new Date());
      setSaveStatus('success');
      
      setTimeout(() => setSaveStatus('idle'), 3000);
      
      return true;
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusInfo = () => {
    if (!preferences) return null;

    return {
      globalEnabled: preferences.globalEnabled,
      soundEnabled: preferences.soundEnabled,
      desktopEnabled: preferences.desktopEnabled,
      enabledTypes: Object.values(preferences.typeSettings).filter(s => s.enabled).length,
      totalTypes: Object.keys(preferences.typeSettings).length,
      hasQuietHours: preferences.quietHours?.enabled || false
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="space-y-6">
      {/* Header Demo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Demo Integrazione Profili - Notifiche</span>
          </CardTitle>
          <CardDescription>
            Dimostrazione completa dell'integrazione tra sistema profili e impostazioni notifiche con salvataggio automatico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Selezione Profilo */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Gestione Profili</span>
              </h4>
              
              {!currentProfile ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Seleziona un profilo per testare l'integrazione:
                  </p>
                  <div className="grid gap-2">
                    {mockProfiles.map((profile) => (
                      <Button
                        key={profile.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleLogin(profile)}
                        disabled={isLoading}
                        className="justify-start"
                      >
                        <LogIn className="h-3 w-3 mr-2" />
                        {profile.name}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{currentProfile.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ID: {currentProfile.id}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-3 w-3 mr-1" />
                      Logout
                    </Button>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    <div>Creato: {new Date(currentProfile.created_at).toLocaleDateString('it-IT')}</div>
                    <div>Ultimo accesso: {new Date(currentProfile.last_accessed).toLocaleDateString('it-IT')}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Stato Notifiche */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center space-x-2">
                <Bell className="h-4 w-4" />
                <span>Stato Notifiche</span>
              </h4>
              
              {statusInfo ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Globali:</span>
                    <Badge variant={statusInfo.globalEnabled ? "default" : "secondary"}>
                      {statusInfo.globalEnabled ? 'Abilitate' : 'Disabilitate'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Suoni:</span>
                    <Badge variant={statusInfo.soundEnabled ? "default" : "secondary"}>
                      {statusInfo.soundEnabled ? 'Attivi' : 'Disattivi'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Desktop:</span>
                    <Badge variant={statusInfo.desktopEnabled ? "default" : "secondary"}>
                      {statusInfo.desktopEnabled ? 'Abilitate' : 'Disabilitate'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Tipi attivi:</span>
                    <Badge variant="outline">
                      {statusInfo.enabledTypes}/{statusInfo.totalTypes}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Ore silenzio:</span>
                    <Badge variant={statusInfo.hasQuietHours ? "default" : "secondary"}>
                      {statusInfo.hasQuietHours ? 'Configurate' : 'Nessuna'}
                    </Badge>
                  </div>
                  
                  {lastSaved && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      Ultimo salvataggio: {lastSaved.toLocaleTimeString('it-IT')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Nessun profilo selezionato
                </div>
              )}
            </div>
          </div>

          {/* Status salvataggio */}
          {saveStatus === 'success' && (
            <Alert className="mt-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Preferenze salvate con successo per il profilo {currentProfile?.name}
              </AlertDescription>
            </Alert>
          )}
          
          {saveStatus === 'error' && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Errore nel salvataggio delle preferenze
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Componente Impostazioni Notifiche */}
      {currentProfile && preferences ? (
        <NotificationSettings
          preferences={preferences}
          onUpdatePreferences={handleUpdatePreferences}
          onResetToDefaults={handleResetToDefaults}
          isLoading={isLoading}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nessun Profilo Selezionato</h3>
              <p className="text-muted-foreground mb-4">
                Seleziona un profilo per configurare le impostazioni delle notifiche
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Footer */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Integrazione Completata</p>
              <p className="text-xs text-muted-foreground">
                ✅ Collegamento impostazioni notifiche al sistema profili<br />
                ✅ Salvataggio automatico delle preferenze per profilo<br />
                ✅ Reset alle impostazioni predefinite<br />
                ✅ Sincronizzazione automatica al cambio profilo<br />
                ✅ Isolamento delle preferenze per profilo
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileNotificationIntegrationDemo;