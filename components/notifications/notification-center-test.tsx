'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NotificationCenter } from './notification-center';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationType, NotificationPriority } from '@/types/notifications';

export const NotificationCenterTest: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { createNotification } = useNotifications();

  const createTestNotifications = async () => {
    // Crea notifiche di test per verificare i filtri
    const testNotifications = [
      {
        type: NotificationType.SYSTEM,
        title: 'Aggiornamento Sistema',
        message: 'Il sistema è stato aggiornato alla versione 1.2.3',
        priority: NotificationPriority.NORMAL,
        metadata: {
          source: 'system',
          category: 'aggiornamento',
          tags: ['sistema', 'versione']
        }
      },
      {
        type: NotificationType.SECURITY,
        title: 'Tentativo di Accesso',
        message: 'Rilevato tentativo di accesso non autorizzato',
        priority: NotificationPriority.HIGH,
        metadata: {
          source: 'security',
          category: 'sicurezza',
          tags: ['accesso', 'sicurezza']
        }
      },
      {
        type: NotificationType.PROFILE,
        title: 'Profilo Creato',
        message: 'Il tuo nuovo profilo è stato creato con successo',
        priority: NotificationPriority.LOW,
        metadata: {
          source: 'profile',
          category: 'profilo',
          tags: ['profilo', 'creazione']
        }
      },
      {
        type: NotificationType.GAME,
        title: 'Nuovo Gioco Rilevato',
        message: 'È stato rilevato un nuovo gioco nella tua libreria Steam',
        priority: NotificationPriority.NORMAL,
        metadata: {
          source: 'game',
          category: 'gioco',
          tags: ['gioco', 'steam']
        }
      },
      {
        type: NotificationType.UPDATE,
        title: 'Aggiornamento Disponibile',
        message: 'È disponibile un nuovo aggiornamento per GameStringer',
        priority: NotificationPriority.URGENT,
        metadata: {
          source: 'update',
          category: 'aggiornamento',
          tags: ['aggiornamento', 'app']
        }
      }
    ];

    for (const notification of testNotifications) {
      await createNotification(notification);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Test Centro Notifiche</h2>
      
      <div className="space-x-2">
        <Button onClick={() => setIsOpen(true)}>
          Apri Centro Notifiche
        </Button>
        
        <Button onClick={createTestNotifications} variant="outline">
          Crea Notifiche di Test
        </Button>
      </div>

      <div className="text-sm text-muted-foreground space-y-1">
        <p><strong>Funzionalità da testare:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Filtro per tipo di notifica (Sistema, Profilo, Sicurezza, ecc.)</li>
          <li>Filtro per priorità (Bassa, Normale, Alta, Urgente)</li>
          <li>Filtro "Solo non lette"</li>
          <li>Azioni: Marca come letta, Elimina, Marca tutte come lette</li>
          <li>Scorciatoie tastiera: ESC (chiudi), Ctrl+A (marca tutte), Ctrl+Del (elimina tutte)</li>
          <li>Lista scrollabile con hover effects</li>
        </ul>
      </div>

      <NotificationCenter
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
};

export default NotificationCenterTest;