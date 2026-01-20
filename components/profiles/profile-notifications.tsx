'use client';

import { useEffect, useState } from 'react';
import { useProfileAuth } from '@/lib/profile-auth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Clock, 
  Shield, 
  X,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileNotification {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  autoHide?: number; // milliseconds
}

export function ProfileNotifications() {
  const { 
    isAuthenticated, 
    currentProfile, 
    sessionTimeRemaining,
    isSessionExpired,
    renewSession 
  } = useProfileAuth();
  
  const [notifications, setNotifications] = useState<ProfileNotification[]>([]);
  const [isRenewing, setIsRenewing] = useState(false);

  // Generate notifications based on profile state
  useEffect(() => {
    const newNotifications: ProfileNotification[] = [];

    // Session expired notification
    if (isSessionExpired && currentProfile) {
      newNotifications.push({
        id: 'session-expired',
        type: 'error',
        title: 'Sessione Scaduta',
        message: `La sessione per il profilo "${currentProfile.name}" è scaduta per motivi di sicurezza.`,
        action: {
          label: 'Rinnova Sessione',
          onClick: async () => {
            setIsRenewing(true);
            await renewSession();
            setIsRenewing(false);
          }
        },
        dismissible: false
      });
    }

    // Session expiring soon notification
    if (sessionTimeRemaining && sessionTimeRemaining < 5 * 60 * 1000 && !isSessionExpired) {
      const minutes = Math.floor(sessionTimeRemaining / (1000 * 60));
      newNotifications.push({
        id: 'session-expiring',
        type: 'warning',
        title: 'Sessione in Scadenza',
        message: `La tua sessione scadrà tra ${minutes} minuti. Rinnova ora per evitare interruzioni.`,
        action: {
          label: 'Rinnova Ora',
          onClick: async () => {
            setIsRenewing(true);
            await renewSession();
            setIsRenewing(false);
          }
        },
        dismissible: true,
        autoHide: 30000 // Hide after 30 seconds
      });
    }

    // First time user notification - DISABILITATO: ora usa InteractiveTutorial
    // if (isAuthenticated && currentProfile && !localStorage.getItem('profile-welcome-shown')) {
    //   newNotifications.push({
    //     id: 'welcome',
    //     type: 'info',
    //     title: 'Benvenuto!',
    //     message: `Ciao ${currentProfile.name}! Il tuo profilo è ora attivo. Tutte le tue impostazioni e Credentials sono isolate e sicure.`,
    //     dismissible: true,
    //     autoHide: 10000
    //   });
    // }

    setNotifications(newNotifications);
  }, [isAuthenticated, currentProfile, sessionTimeRemaining, isSessionExpired, renewSession]);

  // Auto-hide notifications
  useEffect(() => {
    notifications.forEach(notification => {
      if (notification.autoHide) {
        const timer = setTimeout(() => {
          dismissNotification(notification.id);
        }, notification.autoHide);

        return () => clearTimeout(timer);
      }
    });
  }, [notifications]);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    // Mark welcome as shown
    if (id === 'welcome') {
      localStorage.setItem('profile-welcome-shown', 'true');
    }
  };

  const getNotificationIcon = (type: ProfileNotification['type']) => {
    switch (type) {
      case 'error':
        return AlertTriangle;
      case 'warning':
        return Clock;
      case 'info':
        return Shield;
      default:
        return AlertTriangle;
    }
  };

  const getNotificationStyles = (type: ProfileNotification['type']) => {
    switch (type) {
      case 'error':
        return 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300';
      case 'warning':
        return 'border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-300';
      case 'info':
        return 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300';
      default:
        return 'border-gray-500/50 bg-gray-500/10 text-gray-700 dark:text-gray-300';
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => {
        const Icon = getNotificationIcon(notification.type);
        
        return (
          <Alert
            key={notification.id}
            className={cn(
              "relative border shadow-lg backdrop-blur-sm",
              getNotificationStyles(notification.type)
            )}
          >
            <Icon className="h-4 w-4" />
            <div className="flex-1">
              <div className="font-medium">{notification.title}</div>
              <AlertDescription className="mt-1">
                {notification.message}
              </AlertDescription>
              
              {notification.action && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={notification.action.onClick}
                    disabled={isRenewing}
                    className="h-8"
                  >
                    {isRenewing && notification.id.includes('session') ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        Rinnovo...
                      </>
                    ) : (
                      notification.action.label
                    )}
                  </Button>
                </div>
              )}
            </div>
            
            {notification.dismissible && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-6 w-6 p-0"
                onClick={() => dismissNotification(notification.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Alert>
        );
      })}
    </div>
  );
}


