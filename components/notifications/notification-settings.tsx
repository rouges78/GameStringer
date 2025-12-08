'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Volume2, Monitor } from 'lucide-react';
import { NotificationPreferences } from '@/types/notifications';

interface NotificationSettingsProps {
  preferences: NotificationPreferences;
  onPreferencesChange: (preferences: NotificationPreferences) => void;
  disabled?: boolean;
}

export function NotificationSettings({ 
  preferences, 
  onPreferencesChange,
  disabled = false 
}: NotificationSettingsProps) {
  
  // Se preferences è null, mostra stato di caricamento
  if (!preferences) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Caricamento preferenze...
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleToggle = (key: 'globalEnabled' | 'soundEnabled' | 'desktopEnabled', value: boolean) => {
    onPreferencesChange({
      ...preferences,
      [key]: value
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Notifiche Generali
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="globalEnabled" className="flex-1">
              Abilita notifiche
            </Label>
            <Switch
              id="globalEnabled"
              checked={preferences.globalEnabled ?? true}
              onCheckedChange={(checked) => handleToggle('globalEnabled', checked)}
              disabled={disabled}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="soundEnabled" className="flex-1">
              <Volume2 className="h-4 w-4 inline mr-2" />
              Suoni notifiche
            </Label>
            <Switch
              id="soundEnabled"
              checked={preferences.soundEnabled ?? true}
              onCheckedChange={(checked) => handleToggle('soundEnabled', checked)}
              disabled={disabled || !preferences.globalEnabled}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="desktopEnabled" className="flex-1">
              <Monitor className="h-4 w-4 inline mr-2" />
              Notifiche desktop
            </Label>
            <Switch
              id="desktopEnabled"
              checked={preferences.desktopEnabled ?? true}
              onCheckedChange={(checked) => handleToggle('desktopEnabled', checked)}
              disabled={disabled || !preferences.globalEnabled}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
