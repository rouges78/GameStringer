'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from './toast-container';
import { useUIInterferenceDetector } from '@/lib/ui-interference-detector';
import { useNotificationQueue } from '@/lib/notification-queue-manager';
import { NotificationPriority, NotificationType } from '@/types/notifications';
import { 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  List,
  Zap,
  Settings
} from 'lucide-react';

const AntiInterferenceDemo: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  const { showToast, showSuccessToast, showErrorToast, showInfoToast } = useToast();
  
  const { 
    interferences, 
    hasInterferences, 
    hasHighPriorityInterferences,
    getOptimalToastPosition 
  } = useUIInterferenceDetector({
    debugMode: true
  });

  const { 
    stats, 
    enqueue, 
    clearQueue, 
    forceProcessQueue,
    getQueuedNotifications 
  } = useNotificationQueue({
    debugMode: true
  });

  // Funzioni per creare notifiche di test
  const createTestNotification = (priority: NotificationPriority, type: NotificationType) => {
    const notifications = {
      [NotificationPriority.URGENT]: {
        title: 'Notifica Urgente',
        message: 'Questa è una notifica urgente che bypassa le interferenze',
        icon: '🚨'
      },
      [NotificationPriority.HIGH]: {
        title: 'Notifica Alta Priorità',
        message: 'Notifica importante che può essere mostrata durante interferenze medie',
        icon: '⚠️'
      },
      [NotificationPriority.NORMAL]: {
        title: 'Notifica Normale',
        message: 'Notifica standard che viene accodata durante interferenze',
        icon: 'ℹ️'
      },
      [NotificationPriority.LOW]: {
        title: 'Notifica Bassa Priorità',
        message: 'Notifica a bassa priorità che aspetta il momento giusto',
        icon: '💡'
      }
    };

    const notificationData = notifications[priority];
    
    showToast({
      id: `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      profileId: 'demo',
      type,
      title: notificationData.title,
      message: notificationData.message,
      priority,
      createdAt: new Date().toISOString(),
      metadata: {
        source: 'demo',
        category: 'test',
        tags: ['demo', priority.toLowerCase()]
      }
    });
  };

  const getInterferenceTypeIcon = (type: string) => {
    switch (type) {
      case 'dialog': return '🗨️';
      case 'sheet': return '📋';
      case 'modal': return '🪟';
      case 'drawer': return '🗂️';
      default: return '❓';
    }
  };

  const getPriorityColor = (priority: NotificationPriority) => {
    switch (priority) {
      case NotificationPriority.URGENT: return 'destructive';
      case NotificationPriority.HIGH: return 'secondary';
      case NotificationPriority.NORMAL: return 'default';
      case NotificationPriority.LOW: return 'outline';
      default: return 'default';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Demo Sistema Anti-Interferenza</h1>
        <p className="text-muted-foreground">
          Testa il sistema di rilevamento interferenze e gestione coda notifiche
        </p>
      </div>

      {/* Stato del sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Stato Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {interferences.length}
              </div>
              <div className="text-sm text-muted-foreground">Interferenze Attive</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {stats.totalQueued}
              </div>
              <div className="text-sm text-muted-foreground">Notifiche in Coda</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${hasInterferences ? 'text-red-600' : 'text-green-600'}`}>
                {hasInterferences ? 'SÌ' : 'NO'}
              </div>
              <div className="text-sm text-muted-foreground">Interferenze Rilevate</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${hasHighPriorityInterferences ? 'text-red-600' : 'text-green-600'}`}>
                {hasHighPriorityInterferences ? 'SÌ' : 'NO'}
              </div>
              <div className="text-sm text-muted-foreground">Alta Priorità</div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDebugInfo(!showDebugInfo)}
            >
              {showDebugInfo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showDebugInfo ? 'Nascondi' : 'Mostra'} Debug
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={forceProcessQueue}
              disabled={stats.totalQueued === 0}
            >
              <Zap className="h-4 w-4" />
              Forza Processamento
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearQueue}
              disabled={stats.totalQueued === 0}
            >
              <List className="h-4 w-4" />
              Svuota Coda
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Informazioni debug */}
      {showDebugInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Informazioni Debug</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Interferenze attive */}
            <div>
              <h4 className="font-semibold mb-2">Interferenze Attive:</h4>
              {interferences.length === 0 ? (
                <p className="text-muted-foreground">Nessuna interferenza rilevata</p>
              ) : (
                <div className="space-y-2">
                  {interferences.map((interference) => (
                    <div key={interference.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <span>{getInterferenceTypeIcon(interference.type)}</span>
                      <span className="font-mono text-sm">{interference.type}</span>
                      <Badge variant={interference.priority === 'high' ? 'destructive' : 'secondary'}>
                        {interference.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        z-index: {interference.zIndex}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Coda notifiche */}
            <div>
              <h4 className="font-semibold mb-2">Coda Notifiche:</h4>
              {stats.totalQueued === 0 ? (
                <p className="text-muted-foreground">Nessuna notifica in coda</p>
              ) : (
                <div className="space-y-2">
                  {getQueuedNotifications().map((notification) => (
                    <div key={notification.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <span>{notification.metadata?.tags?.[0] === 'demo' ? '🧪' : '📧'}</span>
                      <span className="font-semibold">{notification.title}</span>
                      <Badge variant={getPriorityColor(notification.priority)}>
                        {notification.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Tentativi: {notification.attempts}/{notification.maxAttempts}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Posizione ottimale */}
            <div>
              <h4 className="font-semibold mb-2">Posizione Ottimale Toast:</h4>
              <div className="font-mono text-sm bg-muted p-2 rounded">
                {(() => {
                  const pos = getOptimalToastPosition('top-right');
                  return `x: ${pos.x}, y: ${pos.y}, position: ${pos.position}`;
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controlli per creare interferenze */}
      <Card>
        <CardHeader>
          <CardTitle>Crea Interferenze UI</CardTitle>
          <CardDescription>
            Apri dialoghi e sheet per testare il sistema anti-interferenza
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  🗨️ Apri Dialog
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dialog di Test</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p>
                    Questo dialog crea un'interferenza ad alta priorità. 
                    Le notifiche normali verranno accodate.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={() => createTestNotification(NotificationPriority.NORMAL, NotificationType.SYSTEM)}>
                      Notifica Normale
                    </Button>
                    <Button onClick={() => createTestNotification(NotificationPriority.URGENT, NotificationType.SECURITY)}>
                      Notifica Urgente
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline">
                  📋 Apri Sheet
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Sheet di Test</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-4">
                  <p>
                    Questo sheet crea un'interferenza a media priorità.
                    Le notifiche ad alta priorità possono essere mostrate.
                  </p>
                  <div className="space-y-2">
                    <Button 
                      className="w-full" 
                      onClick={() => createTestNotification(NotificationPriority.LOW, NotificationType.PROFILE)}
                    >
                      Notifica Bassa Priorità
                    </Button>
                    <Button 
                      className="w-full" 
                      onClick={() => createTestNotification(NotificationPriority.HIGH, NotificationType.UPDATE)}
                    >
                      Notifica Alta Priorità
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </CardContent>
      </Card>

      {/* Controlli per testare notifiche */}
      <Card>
        <CardHeader>
          <CardTitle>Test Notifiche</CardTitle>
          <CardDescription>
            Crea notifiche con diverse priorità per testare il comportamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => createTestNotification(NotificationPriority.URGENT, NotificationType.SECURITY)}
            >
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Urgente
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => createTestNotification(NotificationPriority.HIGH, NotificationType.UPDATE)}
            >
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Alta
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => createTestNotification(NotificationPriority.NORMAL, NotificationType.SYSTEM)}
            >
              <Info className="h-4 w-4 text-blue-500" />
              Normale
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => createTestNotification(NotificationPriority.LOW, NotificationType.PROFILE)}
            >
              <CheckCircle className="h-4 w-4 text-green-500" />
              Bassa
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistiche coda */}
      {stats.totalQueued > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Statistiche Coda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-red-600">
                  {stats.byPriority[NotificationPriority.URGENT]}
                </div>
                <div className="text-sm text-muted-foreground">Urgenti</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600">
                  {stats.byPriority[NotificationPriority.HIGH]}
                </div>
                <div className="text-sm text-muted-foreground">Alte</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  {stats.byPriority[NotificationPriority.NORMAL]}
                </div>
                <div className="text-sm text-muted-foreground">Normali</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">
                  {stats.byPriority[NotificationPriority.LOW]}
                </div>
                <div className="text-sm text-muted-foreground">Basse</div>
              </div>
            </div>
            {stats.averageWaitTime > 0 && (
              <div className="mt-4 text-center">
                <div className="text-sm text-muted-foreground">
                  Tempo medio di attesa: {Math.round(stats.averageWaitTime / 1000)}s
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AntiInterferenceDemo;