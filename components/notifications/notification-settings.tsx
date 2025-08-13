'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Volume2, 
  VolumeX, 
  Monitor, 
  Clock, 
  Settings, 
  RotateCcw,
  Save,
  AlertTriangle,
  Info,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  NotificationPreferences, 
  NotificationType, 
  NotificationPriority,
  TypePreference,
  QuietHoursSettings,
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationTypeColor
} from '@/types/notifications';

interface NotificationSettingsProps {
  preferences: NotificationPreferences | null;
  onUpdatePreferences: (preferences: NotificationPreferences) => Promise<boolean>;
  onResetToDefaults: () => Promise<boolean>;
  isLoading?: boolean;
  className?: string;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  preferences,
  onUpdatePreferences,
  onResetToDefaults,
  isLoading = false,
  className
}) => {
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferences | null>(preferences);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Aggiorna le preferenze locali quando cambiano quelle esterne
  useEffect(() => {
    setLocalPreferences(preferences);
    setHasChanges(false);
  }, [preferences]);

  // Controlla se ci sono modifiche
  useEffect(() => {
    if (!preferences || !localPreferences) {
      setHasChanges(false);
      return;
    }

    const hasChanged = JSON.stringify(preferences) !== JSON.stringify(localPreferences);
    setHasChanges(hasChanged);
  }, [preferences, localPreferences]);

  const handleGlobalToggle = (enabled: boolean) => {
    if (!localPreferences) return;
    
    setLocalPreferences({
      ...localPreferences,
      globalEnabled: enabled
    });
  };

  const handleSoundToggle = (enabled: boolean) => {
    if (!localPreferences) return;
    
    setLocalPreferences({
      ...localPreferences,
      soundEnabled: enabled
    });
  };

  const handleDesktopToggle = (enabled: boolean) => {
    if (!localPreferences) return;
    
    setLocalPreferences({
      ...localPreferences,
      desktopEnabled: enabled
    });
  };

  const handleTypeSettingChange = (
    type: NotificationType, 
    field: keyof TypePreference, 
    value: boolean | NotificationPriority
  ) => {
    if (!localPreferences) return;

    setLocalPreferences({
      ...localPreferences,
      typeSettings: {
        ...localPreferences.typeSettings,
        [type]: {
          ...localPreferences.typeSettings[type],
          [field]: value
        }
      }
    });
  };

  const handleQuietHoursChange = (quietHours: QuietHoursSettings) => {
    if (!localPreferences) return;

    setLocalPreferences({
      ...localPreferences,
      quietHours
    });
  };

  const handleMaxNotificationsChange = (value: number[]) => {
    if (!localPreferences) return;

    setLocalPreferences({
      ...localPreferences,
      maxNotifications: value[0]
    });
  };

  const handleAutoDeleteChange = (value: number[]) => {
    if (!localPreferences) return;

    setLocalPreferences({
      ...localPreferences,
      autoDeleteAfterDays: value[0]
    });
  };

  const handleSave = async () => {
    if (!localPreferences || !hasChanges) return;

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const success = await onUpdatePreferences({
        ...localPreferences,
        updatedAt: new Date().toISOString()
      });

      if (success) {
        setSaveStatus('success');
        setHasChanges(false);
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 5000);
      }
    } catch (error) {
      console.error('Errore nel salvataggio delle preferenze:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const success = await onResetToDefaults();
      if (success) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 5000);
      }
    } catch (error) {
      console.error('Errore nel reset delle preferenze:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const getTypeDisplayName = (type: NotificationType): string => {
    switch (type) {
      case NotificationType.SYSTEM:
        return 'Sistema';
      case NotificationType.PROFILE:
        return 'Profilo';
      case NotificationType.SECURITY:
        return 'Sicurezza';
      case NotificationType.UPDATE:
        return 'Aggiornamenti';
      case NotificationType.GAME:
        return 'Giochi';
      case NotificationType.STORE:
        return 'Store';
      case NotificationType.CUSTOM:
        return 'Personalizzate';
      default:
        return type;
    }
  };

  const getPriorityDisplayName = (priority: NotificationPriority): string => {
    switch (priority) {
      case NotificationPriority.LOW:
        return 'Bassa';
      case NotificationPriority.NORMAL:
        return 'Normale';
      case NotificationPriority.HIGH:
        return 'Alta';
      case NotificationPriority.URGENT:
        return 'Urgente';
      default:
        return priority;
    }
  };

  const getTypeIcon = (type: NotificationType): string => {
    switch (type) {
      case NotificationType.SYSTEM:
        return '⚙️';
      case NotificationType.PROFILE:
        return '👤';
      case NotificationType.SECURITY:
        return '🔒';
      case NotificationType.UPDATE:
        return '🔄';
      case NotificationType.GAME:
        return '🎮';
      case NotificationType.STORE:
        return '🏪';
      case NotificationType.CUSTOM:
        return '📝';
      default:
        return '📢';
    }
  };

  if (isLoading || !localPreferences) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bell className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Impostazioni Notifiche</h2>
        </div>
        
        <div className="flex items-center space-x-2">
          {saveStatus === 'success' && (
            <div className="flex items-center space-x-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Salvato</span>
            </div>
          )}
          
          {saveStatus === 'error' && (
            <div className="flex items-center space-x-1 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Errore nel salvataggio</span>
            </div>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Salvataggio...' : 'Salva'}
          </Button>
        </div>
      </div>

      {/* Impostazioni Globali */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Impostazioni Generali</span>
          </CardTitle>
          <CardDescription>
            Configura le impostazioni globali per tutte le notifiche
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notifiche Abilitate */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Abilita Notifiche</Label>
              <p className="text-sm text-muted-foreground">
                Attiva o disattiva tutte le notifiche dell'applicazione
              </p>
            </div>
            <Switch
              checked={localPreferences.globalEnabled}
              onCheckedChange={handleGlobalToggle}
            />
          </div>

          <Separator />

          {/* Suoni */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium flex items-center space-x-2">
                {localPreferences.soundEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
                <span>Suoni Notifiche</span>
              </Label>
              <p className="text-sm text-muted-foreground">
                Riproduci suoni per le notifiche importanti
              </p>
            </div>
            <Switch
              checked={localPreferences.soundEnabled}
              onCheckedChange={handleSoundToggle}
              disabled={!localPreferences.globalEnabled}
            />
          </div>

          <Separator />

          {/* Notifiche Desktop */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium flex items-center space-x-2">
                <Monitor className="h-4 w-4" />
                <span>Notifiche Desktop</span>
              </Label>
              <p className="text-sm text-muted-foreground">
                Mostra notifiche del sistema operativo
              </p>
            </div>
            <Switch
              checked={localPreferences.desktopEnabled}
              onCheckedChange={handleDesktopToggle}
              disabled={!localPreferences.globalEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Ore di Silenzio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Ore di Silenzio</span>
          </CardTitle>
          <CardDescription>
            Configura gli orari in cui non ricevere notifiche
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Abilita Ore di Silenzio</Label>
            <Switch
              checked={localPreferences.quietHours?.enabled || false}
              onCheckedChange={(enabled) => 
                handleQuietHoursChange({
                  ...localPreferences.quietHours,
                  enabled,
                  startTime: localPreferences.quietHours?.startTime || '22:00',
                  endTime: localPreferences.quietHours?.endTime || '08:00',
                  allowUrgent: localPreferences.quietHours?.allowUrgent || true
                })
              }
              disabled={!localPreferences.globalEnabled}
            />
          </div>

          {localPreferences.quietHours?.enabled && (
            <div className="space-y-4 pl-4 border-l-2 border-muted">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Ora Inizio</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={localPreferences.quietHours.startTime}
                    onChange={(e) => 
                      handleQuietHoursChange({
                        ...localPreferences.quietHours!,
                        startTime: e.target.value
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">Ora Fine</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={localPreferences.quietHours.endTime}
                    onChange={(e) => 
                      handleQuietHoursChange({
                        ...localPreferences.quietHours!,
                        endTime: e.target.value
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Consenti Notifiche Urgenti</Label>
                  <p className="text-xs text-muted-foreground">
                    Le notifiche urgenti verranno mostrate anche durante le ore di silenzio
                  </p>
                </div>
                <Switch
                  checked={localPreferences.quietHours.allowUrgent}
                  onCheckedChange={(allowUrgent) => 
                    handleQuietHoursChange({
                      ...localPreferences.quietHours!,
                      allowUrgent
                    })
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Impostazioni per Tipo */}
      <Card>
        <CardHeader>
          <CardTitle>Impostazioni per Tipo di Notifica</CardTitle>
          <CardDescription>
            Personalizza il comportamento per ogni tipo di notifica
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.values(NotificationType).map((type) => {
            const typeSettings = localPreferences.typeSettings[type];
            const isEnabled = localPreferences.globalEnabled && typeSettings?.enabled;

            return (
              <div key={type} className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getTypeIcon(type)}</span>
                    <div>
                      <Label className="text-base font-medium">
                        {getTypeDisplayName(type)}
                      </Label>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "ml-2 text-xs",
                          isEnabled ? "border-green-500 text-green-700" : "border-gray-500 text-gray-500"
                        )}
                      >
                        {isEnabled ? 'Attivo' : 'Disattivo'}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={typeSettings?.enabled || false}
                    onCheckedChange={(enabled) => 
                      handleTypeSettingChange(type, 'enabled', enabled)
                    }
                    disabled={!localPreferences.globalEnabled}
                  />
                </div>

                {typeSettings?.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8">
                    {/* Priorità */}
                    <div className="space-y-2">
                      <Label className="text-sm">Priorità Predefinita</Label>
                      <Select
                        value={typeSettings.priority}
                        onValueChange={(value) => 
                          handleTypeSettingChange(type, 'priority', value as NotificationPriority)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(NotificationPriority).map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {getPriorityDisplayName(priority)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Opzioni */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Mostra Toast</Label>
                        <Switch
                          checked={typeSettings.showToast}
                          onCheckedChange={(showToast) => 
                            handleTypeSettingChange(type, 'showToast', showToast)
                          }
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Riproduci Suono</Label>
                        <Switch
                          checked={typeSettings.playSound}
                          onCheckedChange={(playSound) => 
                            handleTypeSettingChange(type, 'playSound', playSound)
                          }
                          disabled={!localPreferences.soundEnabled}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Mantieni nel Centro</Label>
                        <Switch
                          checked={typeSettings.persistInCenter}
                          onCheckedChange={(persistInCenter) => 
                            handleTypeSettingChange(type, 'persistInCenter', persistInCenter)
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Impostazioni Avanzate */}
      <Card>
        <CardHeader>
          <CardTitle>Impostazioni Avanzate</CardTitle>
          <CardDescription>
            Configura limiti e comportamenti avanzati
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Numero Massimo Notifiche */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">
                Numero Massimo Notifiche
              </Label>
              <Badge variant="outline">
                {localPreferences.maxNotifications}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Numero massimo di notifiche da mantenere nel centro notifiche
            </p>
            <Slider
              value={[localPreferences.maxNotifications]}
              onValueChange={handleMaxNotificationsChange}
              min={10}
              max={200}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10</span>
              <span>200</span>
            </div>
          </div>

          <Separator />

          {/* Eliminazione Automatica */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">
                Eliminazione Automatica
              </Label>
              <Badge variant="outline">
                {localPreferences.autoDeleteAfterDays} giorni
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Le notifiche verranno eliminate automaticamente dopo questo periodo
            </p>
            <Slider
              value={[localPreferences.autoDeleteAfterDays]}
              onValueChange={handleAutoDeleteChange}
              min={1}
              max={90}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 giorno</span>
              <span>90 giorni</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Footer */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Informazioni</p>
              <p className="text-xs text-muted-foreground">
                Le impostazioni vengono salvate automaticamente per il profilo corrente. 
                Ogni profilo può avere impostazioni di notifica personalizzate.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationSettings;