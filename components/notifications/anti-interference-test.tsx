'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from './toast-container';
import { useUIInterferenceDetector } from '@/lib/ui-interference-detector';
import { useNotificationQueue } from '@/lib/notification-queue-manager';
import { NotificationPriority, NotificationType } from '@/types/notifications';

const AntiInterferenceTest: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const { showToast } = useToast();
  const { hasInterferences, hasHighPriorityInterferences } = useUIInterferenceDetector();
  const { stats, enqueue } = useNotificationQueue();

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const runBasicTest = () => {
    addTestResult('Avvio test base...');
    
    // Test notifica normale
    showToast({
      id: `test-normal-${Date.now()}`,
      profileId: 'test',
      type: NotificationType.SYSTEM,
      title: 'Test Notifica Normale',
      message: 'Questa è una notifica di test normale',
      priority: NotificationPriority.NORMAL,
      createdAt: new Date().toISOString(),
      metadata: {
        source: 'test',
        category: 'basic',
        tags: ['test']
      }
    });

    addTestResult('Notifica normale inviata');
  };

  const runInterferenceTest = () => {
    addTestResult('Avvio test interferenza...');
    
    // Apri dialog per creare interferenza
    setDialogOpen(true);
    
    setTimeout(() => {
      // Invia notifica durante interferenza
      showToast({
        id: `test-interference-${Date.now()}`,
        profileId: 'test',
        type: NotificationType.PROFILE,
        title: 'Test Durante Interferenza',
        message: 'Questa notifica dovrebbe essere accodata',
        priority: NotificationPriority.NORMAL,
        createdAt: new Date().toISOString(),
        metadata: {
          source: 'test',
          category: 'interference',
          tags: ['test', 'interference']
        }
      });
      
      addTestResult(`Notifica inviata durante interferenza (interferenze: ${hasInterferences})`);
    }, 500);
  };

  const runUrgentTest = () => {
    addTestResult('Avvio test notifica urgente...');
    
    showToast({
      id: `test-urgent-${Date.now()}`,
      profileId: 'test',
      type: NotificationType.SECURITY,
      title: 'Test Notifica Urgente',
      message: 'Questa notifica urgente dovrebbe bypassare le interferenze',
      priority: NotificationPriority.URGENT,
      createdAt: new Date().toISOString(),
      metadata: {
        source: 'test',
        category: 'urgent',
        tags: ['test', 'urgent']
      }
    });

    addTestResult('Notifica urgente inviata (dovrebbe bypassare interferenze)');
  };

  const clearResults = () => {
    setTestResults([]);
  };

  useEffect(() => {
    addTestResult('Sistema anti-interferenza inizializzato');
  }, []);

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Sistema Anti-Interferenza</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stato sistema */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded">
            <div className="text-center">
              <div className="font-semibold">Interferenze</div>
              <div className={hasInterferences ? 'text-red-600' : 'text-green-600'}>
                {hasInterferences ? 'Rilevate' : 'Nessuna'}
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold">Alta Priorità</div>
              <div className={hasHighPriorityInterferences ? 'text-red-600' : 'text-green-600'}>
                {hasHighPriorityInterferences ? 'Sì' : 'No'}
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold">Coda</div>
              <div className="text-blue-600">
                {stats.totalQueued} notifiche
              </div>
            </div>
          </div>

          {/* Controlli test */}
          <div className="flex gap-2">
            <Button onClick={runBasicTest}>
              Test Base
            </Button>
            <Button onClick={runInterferenceTest}>
              Test Interferenza
            </Button>
            <Button onClick={runUrgentTest}>
              Test Urgente
            </Button>
            <Button variant="outline" onClick={clearResults}>
              Pulisci Risultati
            </Button>
          </div>

          {/* Dialog per creare interferenza */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Apri Dialog (Interferenza)</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog di Test - Interferenza Attiva</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p>
                  Questo dialog crea un'interferenza ad alta priorità.
                  Le notifiche normali dovrebbero essere accodate.
                </p>
                <Button onClick={runUrgentTest}>
                  Invia Notifica Urgente
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Chiudi Dialog
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Risultati test */}
          {testResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold">Risultati Test:</h4>
              <div className="bg-muted p-4 rounded max-h-60 overflow-y-auto">
                {testResults.map((result, index) => (
                  <div key={index} className="text-sm font-mono">
                    {result}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AntiInterferenceTest;