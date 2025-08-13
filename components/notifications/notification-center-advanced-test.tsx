'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NotificationCenter } from './notification-center';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationType, NotificationPriority } from '@/types/notifications';

export const NotificationCenterAdvancedTest: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { createNotification } = useNotifications();

  const createTestNotifications = async () => {
    const testNotifications = [
      {
        type: NotificationType.SYSTEM,
        title: 'Aggiornamento Sistema',
        message: 'È disponibile un nuovo aggiornamento del sistema. Clicca per installare.',
        priority: NotificationPriority.HIGH,
        metadata: {
          source: 'system',
          category: 'aggiornamenti',
          tags: ['sistema', 'aggiornamento']
        }
      },
      {
        type: NotificationType.PROFILE,
        title: 'Profilo Creato',
        message: 'Il tuo nuovo profilo "Gaming Pro" è stato creato con successo.',
        priority: NotificationPriority.NORMAL,
        metadata: {
          source: 'profile',
          category: 'gestione',
          tags: ['profilo', 'creazione']
        }
      },
      {
        type: NotificationType.SECURITY,
        title: 'Tentativo di Accesso',
        message: 'Rilevato tentativo di accesso non autorizzato. Verifica le tue credenziali.',
        priority: NotificationPriority.URGENT,
        metadata: {
          source: 'security',
          category: 'sicurezza',
          tags: ['sicurezza', 'accesso', 'alert']
        }
      },
      {
        type: NotificationType.GAME,
        title: 'Nuovo Gioco Aggiunto',
        message: 'Cyberpunk 2077 è stato aggiunto alla tua libreria.',
        priority: NotificationPriority.LOW,
        metadata: {
          source: 'game',
          category: 'libreria',
          tags: ['gioco', 'libreria']
        }
      },
      {
        type: NotificationType.STORE,
        title: 'Offerta Steam',
        message: 'Sconto del 75% su The Witcher 3: Wild Hunt - Complete Edition.',
        priority: NotificationPriority.NORMAL,
        metadata: {
          source: 'steam',
          category: 'offerte',
          tags: ['steam', 'offerta', 'sconto']
        }
      },
      {
        type: NotificationType.UPDATE,
        title: 'Patch Disponibile',
        message: 'È disponibile la patch 1.2.3 per GameStringer con correzioni e miglioramenti.',
        priority: NotificationPriority.NORMAL,
        metadata: {
          source: 'updater',
          category: 'patch',
          tags: ['patch', 'aggiornamento']
        }
      },
      {
        type: NotificationType.CUSTOM,
        title: 'Backup Completato',
        message: 'Il backup automatico dei tuoi salvataggi è stato completato con successo.',
        priority: NotificationPriority.LOW,
        metadata: {
          source: 'backup',
          category: 'manutenzione',
          tags: ['backup', 'salvataggi']
        }
      },
      {
        type: NotificationType.SYSTEM,
        title: 'Riavvio Richiesto',
        message: 'È necessario riavviare l\'applicazione per applicare le modifiche.',
        priority: NotificationPriority.HIGH,
        metadata: {
          source: 'system',
          category: 'manutenzione',
          tags: ['riavvio', 'sistema']
        }
      },
      {
        type: NotificationType.PROFILE,
        title: 'Credenziali Aggiornate',
        message: 'Le credenziali per Epic Games Store sono state aggiornate.',
        priority: NotificationPriority.NORMAL,
        metadata: {
          source: 'profile',
          category: 'credenziali',
          tags: ['credenziali', 'epic', 'aggiornamento']
        }
      },
      {
        type: NotificationType.SECURITY,
        title: 'Sessione Scaduta',
        message: 'La tua sessione è scaduta. Effettua nuovamente l\'accesso.',
        priority: NotificationPriority.HIGH,
        metadata: {
          source: 'auth',
          category: 'sessione',
          tags: ['sessione', 'scadenza', 'auth']
        }
      }
    ];

    for (const notification of testNotifications) {
      await createNotification(notification);
      // Piccola pausa per evitare sovraccarico
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Test Centro Notifiche Avanzato</h1>
        <p className="text-muted-foreground mb-6">
          Test delle funzionalità avanzate del centro notifiche: virtual scrolling, ricerca, ordinamento e azioni batch.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">🔍 Ricerca</h3>
            <p className="text-sm text-muted-foreground">
              Cerca nelle notifiche per titolo, messaggio, categoria o tag.
            </p>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">📊 Ordinamento</h3>
            <p className="text-sm text-muted-foreground">
              Ordina per data, titolo, priorità o tipo di notifica.
            </p>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">✅ Azioni Batch</h3>
            <p className="text-sm text-muted-foreground">
              Seleziona multiple notifiche per azioni di gruppo.
            </p>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">🚀 Virtual Scrolling</h3>
            <p className="text-sm text-muted-foreground">
              Performance ottimizzate per migliaia di notifiche.
            </p>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">🎛️ Filtri Avanzati</h3>
            <p className="text-sm text-muted-foreground">
              Filtra per tipo, priorità e stato di lettura.
            </p>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">⌨️ Scorciatoie</h3>
            <p className="text-sm text-muted-foreground">
              Ctrl+A, Ctrl+F, Ctrl+Del per azioni rapide.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button onClick={createTestNotifications}>
              Crea Notifiche di Test
            </Button>
            
            <Button 
              onClick={() => setIsOpen(true)}
              variant="outline"
            >
              Apri Centro Notifiche
            </Button>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">Istruzioni per il Test:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Clicca "Crea Notifiche di Test" per generare notifiche di esempio</li>
              <li>Apri il centro notifiche e prova le funzionalità:</li>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li><strong>Ricerca:</strong> Digita nella barra di ricerca (es. "sistema", "gioco")</li>
                <li><strong>Filtri:</strong> Usa l'icona filtro per filtrare per tipo/priorità</li>
                <li><strong>Ordinamento:</strong> Usa l'icona frecce per ordinare</li>
                <li><strong>Selezione:</strong> Attiva modalità selezione con l'icona quadrato</li>
                <li><strong>Azioni Batch:</strong> Seleziona notifiche e usa il menu azioni</li>
                <li><strong>Scorciatoie:</strong> Prova Ctrl+A, Ctrl+F, Esc</li>
              </ul>
            </ol>
          </div>
        </div>
      </div>

      <NotificationCenter 
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
};

export default NotificationCenterAdvancedTest;