'use client';

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Volume2, Monitor, Loader2 } from 'lucide-react';
import { NotificationPreferences } from '@/types/notifications';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface NotificationSettingsProps {
  preferences: NotificationPreferences;
  onPreferencesChange: (preferences: NotificationPreferences) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function NotificationSettings({ 
  preferences, 
  onPreferencesChange,
  isLoading = false,
  disabled = false,
  className
}: NotificationSettingsProps) {
  const { t } = useTranslation();
  
  if (isLoading && !preferences) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  if (!preferences) return null;

  const handleToggle = (key: 'globalEnabled' | 'soundEnabled' | 'desktopEnabled', value: boolean) => {
    onPreferencesChange({
      ...preferences,
      [key]: value
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/30 border border-slate-800">
        <div className="space-y-0.5">
          <Label htmlFor="globalEnabled" className="text-sm font-medium">{t('notifications.enableNotifications')}</Label>
          <p className="text-[10px] text-muted-foreground">{t('notifications.enableNotificationsDesc')}</p>
        </div>
        <Switch
          id="globalEnabled"
          checked={preferences.globalEnabled ?? true}
          onCheckedChange={(checked) => handleToggle('globalEnabled', checked)}
          disabled={disabled || isLoading}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/30 border border-slate-800">
          <div className="flex items-center space-x-2">
            <Volume2 className="h-4 w-4 text-slate-400" />
            <Label htmlFor="soundEnabled" className="text-xs">{t('notifications.sounds')}</Label>
          </div>
          <Switch
            id="soundEnabled"
            checked={preferences.soundEnabled ?? true}
            onCheckedChange={(checked) => handleToggle('soundEnabled', checked)}
            disabled={disabled || isLoading || !preferences.globalEnabled}
            className="scale-90"
          />
        </div>
        
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/30 border border-slate-800">
          <div className="flex items-center space-x-2">
            <Monitor className="h-4 w-4 text-slate-400" />
            <Label htmlFor="desktopEnabled" className="text-xs">{t('notifications.desktop')}</Label>
          </div>
          <Switch
            id="desktopEnabled"
            checked={preferences.desktopEnabled ?? true}
            onCheckedChange={(checked) => handleToggle('desktopEnabled', checked)}
            disabled={disabled || isLoading || !preferences.globalEnabled}
            className="scale-90"
          />
        </div>
      </div>
    </div>
  );
}
