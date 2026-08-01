'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Languages, AlertTriangle, RefreshCw, Users, Newspaper, Gamepad2, Moon, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  getNotificationPrefs,
  saveNotificationPrefs,
  sendTrayNotification,
  TrayNotificationType,
  NotificationPreferences,
} from '@/lib/notifications/tray-notifications';
import { useTranslation } from '@/lib/i18n';

interface NotificationTypeConfig {
  key: keyof NotificationPreferences;
  type: TrayNotificationType;
  labelKey: string;
  descKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NOTIFICATION_TYPES: NotificationTypeConfig[] = [
  { key: 'translationCompleted', type: 'translation_completed', labelKey: 'trayNotificationsComp.typeTranslationCompleted', descKey: 'trayNotificationsComp.typeTranslationCompletedDesc', icon: Languages },
  { key: 'translationFailed', type: 'translation_failed', labelKey: 'trayNotificationsComp.typeTranslationFailed', descKey: 'trayNotificationsComp.typeTranslationFailedDesc', icon: AlertTriangle },
  { key: 'systemErrors', type: 'system_error', labelKey: 'trayNotificationsComp.typeSystemErrors', descKey: 'trayNotificationsComp.typeSystemErrorsDesc', icon: AlertTriangle },
  { key: 'appUpdates', type: 'app_update', labelKey: 'trayNotificationsComp.typeAppUpdates', descKey: 'trayNotificationsComp.typeAppUpdatesDesc', icon: RefreshCw },
  { key: 'gameUpdates', type: 'game_update', labelKey: 'trayNotificationsComp.typeGameUpdates', descKey: 'trayNotificationsComp.typeGameUpdatesDesc', icon: Gamepad2 },
  { key: 'friendOnline', type: 'friend_online', labelKey: 'trayNotificationsComp.typeFriendOnline', descKey: 'trayNotificationsComp.typeFriendOnlineDesc', icon: Users },
  { key: 'news', type: 'news', labelKey: 'trayNotificationsComp.typeNews', descKey: 'trayNotificationsComp.typeNewsDesc', icon: Newspaper },
];

export function TrayNotificationPreferences() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<NotificationPreferences>(getNotificationPrefs());
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    setPrefs(getNotificationPrefs());
  }, []);

  const updatePref = (key: keyof NotificationPreferences, value: boolean | string) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    saveNotificationPrefs(updated);
  };

  const handleTestNotification = async () => {
    setTestSending(true);
    try {
      await sendTrayNotification({
        type: 'news',
        title: t('trayNotificationsComp.testTitle'),
        body: t('trayNotificationsComp.testBody'),
      });
    } catch { /* ignore */ }
    setTimeout(() => setTestSending(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2 text-base">
          <Bell className="h-5 w-5" />
          {t('trayNotificationsComp.title')}
        </CardTitle>
        <CardDescription>
          {t('trayNotificationsComp.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">{t('trayNotificationsComp.enabled')}</Label>
            <p className="text-xs text-muted-foreground">{t('trayNotificationsComp.enabledDesc')}</p>
          </div>
          <Switch
            checked={prefs.enabled}
            onCheckedChange={(v) => updatePref('enabled', v)}
          />
        </div>

        <Separator />

        {/* Per-type toggles */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">{t('trayNotificationsComp.notificationTypes')}</h3>
          {NOTIFICATION_TYPES.map(({ key, type: _type, labelKey, descKey, icon: Icon }) => (
            <div
              key={key}
              className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                !prefs.enabled ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t(labelKey)}</Label>
                  <p className="text-xs text-muted-foreground">{t(descKey)}</p>
                </div>
              </div>
              <Switch
                checked={!!prefs[key]}
                disabled={!prefs.enabled}
                onCheckedChange={(v) => updatePref(key, v)}
              />
            </div>
          ))}
        </div>

        <Separator />

        {/* Quiet Hours */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">{t('trayNotificationsComp.quietHours')}</Label>
            </div>
            <Switch
              checked={prefs.quietHoursEnabled}
              disabled={!prefs.enabled}
              onCheckedChange={(v) => updatePref('quietHoursEnabled', v)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('trayNotificationsComp.quietHoursDesc')}
          </p>
          {prefs.quietHoursEnabled && (
            <div className="flex items-center gap-3 pl-6">
              <div className="flex items-center gap-2">
                <Label className="text-xs">{t('trayNotificationsComp.from')}</Label>
                <Input
                  type="time"
                  value={prefs.quietHoursStart}
                  onChange={(e) => updatePref('quietHoursStart', e.target.value)}
                  className="h-8 w-28 text-xs"
                />
              </div>
              <span className="text-xs text-muted-foreground">{t('trayNotificationsComp.to')}</span>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={prefs.quietHoursEnd}
                  onChange={(e) => updatePref('quietHoursEnd', e.target.value)}
                  className="h-8 w-28 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Test button */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestNotification}
            disabled={!prefs.enabled || testSending}
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {testSending ? t('trayNotificationsComp.sending') : t('trayNotificationsComp.sendTest')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('trayNotificationsComp.testHint')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

