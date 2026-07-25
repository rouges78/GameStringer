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

interface NotificationTypeConfig {
  key: keyof NotificationPreferences;
  type: TrayNotificationType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NOTIFICATION_TYPES: NotificationTypeConfig[] = [
  { key: 'translationCompleted', type: 'translation_completed', label: 'Traduzioni Completate', description: 'Notifica quando una traduzione termina con successo', icon: Languages },
  { key: 'translationFailed', type: 'translation_failed', label: 'Errori Traduzione', description: 'Notifica quando una traduzione fallisce', icon: AlertTriangle },
  { key: 'systemErrors', type: 'system_error', label: 'Errori di Sistema', description: 'Notifiche per errori critici del sistema', icon: AlertTriangle },
  { key: 'appUpdates', type: 'app_update', label: 'Aggiornamenti App', description: 'Notifica quando è disponibile un aggiornamento di GameStringer', icon: RefreshCw },
  { key: 'gameUpdates', type: 'game_update', label: 'Aggiornamenti Giochi', description: 'Notifica quando un gioco aggiornato potrebbe aver invalidato la patch', icon: Gamepad2 },
  { key: 'friendOnline', type: 'friend_online', label: 'Amici Online', description: 'Notifica quando un amico si connette', icon: Users },
  { key: 'news', type: 'news', label: 'Novità', description: 'Notifiche per news e aggiornamenti community', icon: Newspaper },
];

export function TrayNotificationPreferences() {
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
        title: '🔔 Notifica di Prova',
        body: 'Se vedi questo messaggio, le notifiche tray funzionano!',
      });
    } catch { /* ignore */ }
    setTimeout(() => setTestSending(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2 text-base">
          <Bell className="h-5 w-5" />
          Notifiche System Tray
        </CardTitle>
        <CardDescription>
          Configura quali eventi generano notifiche native del sistema operativo.
          Le notifiche appaiono nel tray icon e nel centro notifiche di Windows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Notifiche Tray Attive</Label>
            <p className="text-xs text-muted-foreground">Abilita/disabilita tutte le notifiche OS</p>
          </div>
          <Switch
            checked={prefs.enabled}
            onCheckedChange={(v) => updatePref('enabled', v)}
          />
        </div>

        <Separator />

        {/* Per-type toggles */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Tipi di Notifica</h3>
          {NOTIFICATION_TYPES.map(({ key, type: _type, label, description, icon: Icon }) => (
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
                  <Label className="text-sm font-medium">{label}</Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
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
              <Label className="text-sm font-medium">Ore di Silenzio</Label>
            </div>
            <Switch
              checked={prefs.quietHoursEnabled}
              disabled={!prefs.enabled}
              onCheckedChange={(v) => updatePref('quietHoursEnabled', v)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Durante le ore di silenzio, le notifiche tray vengono soppresse (gli errori critici vengono comunque mostrati).
          </p>
          {prefs.quietHoursEnabled && (
            <div className="flex items-center gap-3 pl-6">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Dalle</Label>
                <Input
                  type="time"
                  value={prefs.quietHoursStart}
                  onChange={(e) => updatePref('quietHoursStart', e.target.value)}
                  className="h-8 w-28 text-xs"
                />
              </div>
              <span className="text-xs text-muted-foreground">alle</span>
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
            {testSending ? 'Inviando...' : 'Invia Notifica di Prova'}
          </Button>
          <span className="text-xs text-muted-foreground">
            Verifica che le notifiche OS funzionino correttamente
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

