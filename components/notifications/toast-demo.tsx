'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotificationToast } from './notification-toast-provider';
import { NotificationType, NotificationPriority } from '@/types/notifications';

const ToastDemo: React.FC = () => {
  const { 
    showToast, 
    showSuccessToast, 
    showErrorToast, 
    showInfoToast, 
    showWarningToast,
    clearAllToasts,
    isUIBlocked,
    setUIBlocked
  } = useNotificationToast();

  const handleShowCustomToast = (type: NotificationType, priority: NotificationPriority) => {
    const titles = {
      [NotificationType.SYSTEM]: 'Notifica Sistema',
      [NotificationType.PROFILE]: 'Notifica Profilo',
      [NotificationType.SECURITY]: 'Avviso Sicurezza',
      [NotificationType.UPDATE]: 'Aggiornamento',
      [NotificationType.GAME]: 'Notifica Gioco',
      [NotificationType.STORE]: 'Notifica Store',
      [NotificationType.CUSTOM]: 'Notifica Personalizzata'
    };

    const messages = {
      [NotificationPriority.LOW]: 'Questo è un messaggio a bassa priorità.',
      [NotificationPriority.NORMAL]: 'Questo è un messaggio di priorità normale.',
      [NotificationPriority.HIGH]: 'Questo è un messaggio ad alta priorità.',
      [NotificationPriority.URGENT]: 'Questo è un messaggio urgente che non si nasconde automaticamente!'
    };

    showToast({
      id: `demo-${Date.now()}`,
      profileId: 'demo-profile',
      type,
      title: titles[type],
      message: messages[priority],
      priority,
      createdAt: new Date().toISOString(),
      actionUrl: priority === NotificationPriority.HIGH ? '/settings' : undefined,
      metadata: {
        source: 'demo',
        category: 'test',
        tags: ['demo', type.toLowerCase(), priority.toLowerCase()]
      }
    });
  };

  const handleShowLongMessage = () => {
    showToast({
      id: `long-demo-${Date.now()}`,
      profileId: 'demo-profile',
      type: NotificationType.SYSTEM,
      title: 'Messaggio Lungo',
      message: 'Questo è un messaggio molto lungo che dovrebbe essere visualizzato correttamente nel toast anche se contiene molte informazioni e dettagli importanti che l\'utente deve leggere attentamente.',
      priority: NotificationPriority.NORMAL,
      createdAt: new Date().toISOString(),
      actionUrl: '/help',
      metadata: {
        source: 'demo',
        category: 'long-message',
        tags: ['demo', 'long']
      }
    });
  };

  const handleShowMultipleToasts = () => {
    const types = [NotificationType.SYSTEM, NotificationType.PROFILE, NotificationType.SECURITY];
    const priorities = [NotificationPriority.LOW, NotificationPriority.NORMAL, NotificationPriority.HIGH];
    
    types.forEach((type, index) => {
      setTimeout(() => {
        handleShowCustomToast(type, priorities[index]);
      }, index * 500);
    });
  };

  const handleToggleUIBlocked = () => {
    setUIBlocked(!isUIBlocked);
    if (!isUIBlocked) {
      showInfoToast('UI Bloccata', 'Le notifiche non urgenti verranno messe in coda');
    } else {
      showInfoToast('UI Sbloccata', 'Le notifiche in coda verranno mostrate');
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Demo Sistema Toast Notifiche</CardTitle>
        <CardDescription>
          Testa le diverse funzionalità del sistema di notifiche toast.
          Stato UI: {isUIBlocked ? '🔒 Bloccata' : '🔓 Libera'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toast Rapide */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Toast Rapide</h3>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => showSuccessToast('Operazione Completata', 'L\'azione è stata eseguita con successo')}
              variant="default"
              className="bg-green-600 hover:bg-green-700"
            >
              Successo
            </Button>
            <Button 
              onClick={() => showErrorToast('Errore Rilevato', 'Si è verificato un errore durante l\'operazione')}
              variant="destructive"
            >
              Errore
            </Button>
            <Button 
              onClick={() => showInfoToast('Informazione', 'Questa è una notifica informativa')}
              variant="secondary"
            >
              Info
            </Button>
            <Button 
              onClick={() => showWarningToast('Attenzione', 'Questa è una notifica di avviso')}
              variant="outline"
              className="border-orange-500 text-orange-600 hover:bg-orange-50"
            >
              Avviso
            </Button>
          </div>
        </div>

        {/* Toast per Tipo */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Toast per Tipo</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.values(NotificationType).map(type => (
              <Button
                key={type}
                onClick={() => handleShowCustomToast(type, NotificationPriority.NORMAL)}
                variant="outline"
                size="sm"
              >
                {type}
              </Button>
            ))}
          </div>
        </div>

        {/* Toast per Priorità */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Toast per Priorità</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.values(NotificationPriority).map(priority => (
              <Button
                key={priority}
                onClick={() => handleShowCustomToast(NotificationType.SYSTEM, priority)}
                variant="outline"
                size="sm"
                className={
                  priority === NotificationPriority.URGENT ? 'border-red-500 text-red-600' :
                  priority === NotificationPriority.HIGH ? 'border-orange-500 text-orange-600' :
                  priority === NotificationPriority.NORMAL ? 'border-blue-500 text-blue-600' :
                  'border-gray-500 text-gray-600'
                }
              >
                {priority}
              </Button>
            ))}
          </div>
        </div>

        {/* Test Speciali */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Test Speciali</h3>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={handleShowLongMessage}
              variant="outline"
            >
              Messaggio Lungo
            </Button>
            <Button 
              onClick={handleShowMultipleToasts}
              variant="outline"
            >
              Toast Multiple
            </Button>
            <Button 
              onClick={handleToggleUIBlocked}
              variant="outline"
              className={isUIBlocked ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}
            >
              {isUIBlocked ? 'Sblocca UI' : 'Blocca UI'}
            </Button>
            <Button 
              onClick={clearAllToasts}
              variant="destructive"
              size="sm"
            >
              Pulisci Tutto
            </Button>
          </div>
        </div>

        {/* Informazioni */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Funzionalità Implementate:</h4>
          <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
            <li>✅ Toast con animazioni di entrata e uscita</li>
            <li>✅ Auto-hide configurabile (5 secondi di default)</li>
            <li>✅ Progress bar per visualizzare il tempo rimanente</li>
            <li>✅ Posizionamento non invasivo (top-right di default)</li>
            <li>✅ Supporto per azioni (pulsante "Visualizza")</li>
            <li>✅ Dismissal manuale con pulsante X</li>
            <li>✅ Gestione priorità (Urgenti non si nascondono automaticamente)</li>
            <li>✅ Stack intelligente per toast multiple</li>
            <li>✅ Rilevamento UI bloccata (dialoghi, modali)</li>
            <li>✅ Coda per notifiche durante interferenze UI</li>
            <li>✅ Icone personalizzate e colori per tipo/priorità</li>
            <li>✅ Supporto accessibilità (ARIA labels, live regions)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ToastDemo;