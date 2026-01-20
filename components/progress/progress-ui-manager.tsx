'use client';

import React from 'react';
import { ProgressManager } from './progress-modal';
import { ProgressNotificationContainer } from './progress-notification';
import { useProgressUI } from '@/hooks/use-progress-ui';

/**
 * Componente globale per gestire tutte le UI di progresso
 */
export function ProgressUIManager() {
  const {
    progressState,
    minimizedOperations,
    notifications,
    minimizeOperation,
    maximizeOperation,
    closeOperation,
    cancelOperation,
    removeNotification,
    handleNotificationAction
  } = useProgressUI();

  return (
    <>
      {/* Gestione modali di progresso */}
      <ProgressManager
        operations={progressState.operations}
        onCloseOperation={closeOperation}
        onMinimizeOperation={minimizeOperation}
        onCancelOperation={cancelOperation}
        minimizedOperations={minimizedOperations}
      />

      {/* Container notifiche */}
      <ProgressNotificationContainer
        notifications={notifications}
        onCloseNotification={removeNotification}
        onNotificationAction={handleNotificationAction}
        position="top-right"
        maxNotifications={5}
      />
    </>
  );
}


