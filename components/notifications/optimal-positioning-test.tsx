'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from './toast-container';
import { useNotificationStack } from '@/lib/notification-stack-manager';
import { useUIInterferenceDetector } from '@/lib/ui-interference-detector';
import { NotificationPriority, NotificationType } from '@/types/notifications';
import { 
  Settings, 
  Zap, 
  Grid, 
  BarChart3, 
  Eye, 
  EyeOff,
  RefreshCw,
  Trash2,
  Plus,
  Minus
} from 'lucide-react';

const OptimalPositioningTest: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [generationInterval, setGenerationInterval] = useState(3000);
  const [maxToasts, setMaxToasts] = useState(5);
  const [stackSpacing, setStackSpacing] = useState(16);
  const [enableCollapse, setEnableCollapse] = useState(true);
  const [enableReordering, setEnablePriorityReordering] = useState(true);

  const { showToast } = useToast();
  const { interferences, hasInterferences } = useUIInterferenceDetector();
  
  const {
    addToast,
    removeToast,
    repositionAllToasts,
    collapseStack,
    expandStack,
    clearStack,
    getVisibleToasts,
    updateConfiguration,
    stats
  } = useNotificationStack({
    maxVisible: maxToasts,
    spacing: stackSpacing,
    enableAutoCollapse: enableCollapse,
    enablePriorityReordering: enableReordering
  });

  // Auto-generazione notifiche per test
  useEffect(() => {
    if (!autoGenerate) return;

    const interval = setInterval(() => {
      createRandomNotification();
    }, generationInterval);

    return () => clearInterval(interval);
  }, [autoGenerate, generationInterval]);

  // Aggiorna configurazione quando cambiano i parametri
  useEffect(() => {
    updateConfiguration({
      maxVisible: maxToasts,
      spacing: stackSpacing,
      enableAutoCollapse: enableCollapse,
      enablePriorityReordering: enableReordering
    });
  }, [maxToasts, stackSpacing, enableCollapse, enableReordering, updateConfiguration]);

  const createRandomNotification = () => {
    const priorities = [
      NotificationPriority.LOW,
      NotificationPriority.NORMAL,
      NotificationPriority.HIGH,
      NotificationPriority.URGENT
    ];
    
    const types = [
      NotificationType.SYSTEM,
      NotificationType.PROFILE,
      NotificationType.SECURITY,
      NotificationType.UPDATE
    ];

    const messages = [
      'Notifica di test generata automaticamente',
      'Sistema di posizionamento ottimale attivo',
      'Test algoritmo di stack management',
      'Verifica gestione interferenze UI',
      'Controllo timing intelligente'
    ];

    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];

    showToast({
      id: `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      profileId: 'test',
      type,
      title: `Test ${priority.charAt(0).toUpperCase() + priority.slice(1)}`,
      message,
      priority,
      createdAt: new Date().toISOString(),
      metadata: {
        source: 'optimal-positioning-test',
        category: 'test',
        tags: ['test', 'auto-generated', priority]
      }
    });
  };

  const createSpecificNotification = (priority: NotificationPriority) => {
    const typeMap = {
      [NotificationPriority.URGENT]: NotificationType.SECURITY,
      [NotificationPriority.HIGH]: NotificationType.UPDATE,
      [NotificationPriority.NORMAL]: NotificationType.SYSTEM,
      [NotificationPriority.LOW]: NotificationType.PROFILE
    };

    const messageMap = {
      [NotificationPriority.URGENT]: 'Notifica urgente - richiede attenzione immediata',
      [NotificationPriority.HIGH]: 'Notifica importante - alta priorità',
      [NotificationPriority.NORMAL]: 'Notifica standard - priorità normale',
      [NotificationPriority.LOW]: 'Notifica informativa - bassa priorità'
    };

    showToast({
      id: `specific-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      profileId: 'test',
      type: typeMap[priority],
      title: `Test ${priority.charAt(0).toUpperCase() + priority.slice(1)}`,
      message: messageMap[priority],
      priority,
      createdAt: new Date().toISOString(),
      metadata: {
        source: 'optimal-positioning-test',
        category: 'manual',
        tags: ['test', 'manual', priority]
      }
    });
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

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${Math.round(ms / 1000)}s`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Test Posizionamento Ottimale</h1>
        <p className="text-muted-foreground">
          Testa l'algoritmo di posizionamento ottimale e gestione stack avanzata
        </p>
      </div>

      {/* Statistiche Stack */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Statistiche Stack
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalToasts}
              </div>
              <div className="text-sm text-muted-foreground">Totali</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.visibleToasts}
              </div>
              <div className="text-sm text-muted-foreground">Visibili</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {stats.hiddenToasts}
              </div>
              <div className="text-sm text-muted-foreground">Nascosti</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatTime(stats.averageAge)}
              </div>
              <div className="text-sm text-muted-foreground">Età Media</div>
            </div>
          </div>

          {/* Distribuzione per priorità */}
          <div className="space-y-2">
            <h4 className="font-semibold">Distribuzione per Priorità:</h4>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(stats.byPriority).map(([priority, count]) => (
                <Badge 
                  key={priority} 
                  variant={getPriorityColor(priority as NotificationPriority)}
                  className="flex items-center gap-1"
                >
                  {priority}: {count}
                </Badge>
              ))}
            </div>
          </div>

          {/* Dimensioni stack */}
          {stats.visibleToasts > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Dimensioni Stack: {Math.round(stats.stackWidth)}px × {Math.round(stats.stackHeight)}px
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configurazione */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurazione Stack
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Max Toast Visibili */}
            <div className="space-y-2">
              <Label>Toast Visibili Massimi: {maxToasts}</Label>
              <Slider
                value={[maxToasts]}
                onValueChange={(value) => setMaxToasts(value[0])}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
            </div>

            {/* Spaziatura Stack */}
            <div className="space-y-2">
              <Label>Spaziatura Stack: {stackSpacing}px</Label>
              <Slider
                value={[stackSpacing]}
                onValueChange={(value) => setStackSpacing(value[0])}
                min={8}
                max={32}
                step={4}
                className="w-full"
              />
            </div>

            {/* Intervallo Auto-generazione */}
            <div className="space-y-2">
              <Label>Intervallo Auto-gen: {generationInterval}ms</Label>
              <Slider
                value={[generationInterval]}
                onValueChange={(value) => setGenerationInterval(value[0])}
                min={1000}
                max={10000}
                step={500}
                className="w-full"
              />
            </div>
          </div>

          {/* Switch Options */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-collapse"
                checked={enableCollapse}
                onCheckedChange={setEnableCollapse}
              />
              <Label htmlFor="auto-collapse">Auto Collapse</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="priority-reordering"
                checked={enableReordering}
                onCheckedChange={setEnablePriorityReordering}
              />
              <Label htmlFor="priority-reordering">Riordino Priorità</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="auto-generate"
                checked={autoGenerate}
                onCheckedChange={setAutoGenerate}
              />
              <Label htmlFor="auto-generate">Auto-generazione</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="show-debug"
                checked={showDebug}
                onCheckedChange={setShowDebug}
              />
              <Label htmlFor="show-debug">Debug Info</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controlli Test */}
      <Card>
        <CardHeader>
          <CardTitle>Controlli Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Creazione notifiche per priorità */}
          <div>
            <h4 className="font-semibold mb-2">Crea Notifiche per Priorità:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button
                onClick={() => createSpecificNotification(NotificationPriority.URGENT)}
                variant="destructive"
                size="sm"
              >
                Urgente
              </Button>
              <Button
                onClick={() => createSpecificNotification(NotificationPriority.HIGH)}
                variant="secondary"
                size="sm"
              >
                Alta
              </Button>
              <Button
                onClick={() => createSpecificNotification(NotificationPriority.NORMAL)}
                variant="default"
                size="sm"
              >
                Normale
              </Button>
              <Button
                onClick={() => createSpecificNotification(NotificationPriority.LOW)}
                variant="outline"
                size="sm"
              >
                Bassa
              </Button>
            </div>
          </div>

          {/* Controlli Stack */}
          <div>
            <h4 className="font-semibold mb-2">Gestione Stack:</h4>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={createRandomNotification}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                Aggiungi Random
              </Button>
              <Button
                onClick={() => repositionAllToasts(interferences)}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4" />
                Riposiziona
              </Button>
              <Button
                onClick={collapseStack}
                variant="outline"
                size="sm"
                disabled={stats.visibleToasts <= 3}
              >
                <Minus className="h-4 w-4" />
                Collassa
              </Button>
              <Button
                onClick={expandStack}
                variant="outline"
                size="sm"
                disabled={stats.hiddenToasts === 0}
              >
                <Plus className="h-4 w-4" />
                Espandi
              </Button>
              <Button
                onClick={clearStack}
                variant="outline"
                size="sm"
                disabled={stats.totalToasts === 0}
              >
                <Trash2 className="h-4 w-4" />
                Svuota
              </Button>
            </div>
          </div>

          {/* Interferenze UI */}
          <div>
            <h4 className="font-semibold mb-2">Crea Interferenze:</h4>
            <div className="flex gap-2">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Dialog
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Dialog di Test</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p>Questo dialog crea interferenza ad alta priorità.</p>
                    <Button onClick={createRandomNotification}>
                      Crea Notifica
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    Sheet
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Sheet di Test</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4 mt-4">
                    <p>Questo sheet crea interferenza media.</p>
                    <Button onClick={createRandomNotification} className="w-full">
                      Crea Notifica
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug Info */}
      {showDebug && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Informazioni Debug
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Interferenze Attive:</h4>
              {interferences.length === 0 ? (
                <p className="text-muted-foreground">Nessuna interferenza</p>
              ) : (
                <div className="space-y-2">
                  {interferences.map((interference) => (
                    <div key={interference.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Badge variant={interference.priority === 'high' ? 'destructive' : 'secondary'}>
                        {interference.type}
                      </Badge>
                      <span className="text-sm">z-index: {interference.zIndex}</span>
                      <span className="text-sm">
                        {Math.round(interference.bounds.width)}×{Math.round(interference.bounds.height)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold mb-2">Toast Visibili:</h4>
              {stats.visibleToasts === 0 ? (
                <p className="text-muted-foreground">Nessun toast visibile</p>
              ) : (
                <div className="space-y-2">
                  {getVisibleToasts().map((toast) => (
                    <div key={toast.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Badge variant={getPriorityColor(toast.priority)}>
                        {toast.priority}
                      </Badge>
                      <span className="text-sm font-mono">
                        x:{Math.round(toast.position.x)}, y:{Math.round(toast.position.y)}
                      </span>
                      <span className="text-sm">
                        Score: {Math.round(toast.position.score)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OptimalPositioningTest;