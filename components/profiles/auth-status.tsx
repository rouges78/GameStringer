'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  Lock
} from 'lucide-react';
import { useProfiles } from '@/hooks/use-profiles';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface AuthStatusProps {
  className?: string;
  showDetails?: boolean;
}

export function AuthStatus({ className = '', showDetails = false }: AuthStatusProps) {
  const { currentProfile } = useProfiles();
  const { settings } = useProfileSettings();
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // Simula il controllo della sessione
  useEffect(() => {
    if (!currentProfile || !settings) return;

    const checkSession = () => {
      const sessionTimeout = settings.security.session_timeout * 60 * 1000; // Convert to ms
      const lastAccessed = new Date(currentProfile.last_accessed).getTime();
      const now = Date.now();
      const elapsed = now - lastAccessed;
      const remaining = Math.max(0, sessionTimeout - elapsed);

      setSessionTimeRemaining(remaining);
      setIsSessionExpired(remaining === 0);
    };

    checkSession();
    const interval = setInterval(checkSession, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [currentProfile, settings]);

  if (!currentProfile) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Badge variant="destructive" className="flex items-center space-x-1">
          <Lock className="h-3 w-3" />
          <span>Non autenticato</span>
        </Badge>
      </div>
    );
  }

  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.floor(ms / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getSessionStatus = () => {
    if (isSessionExpired) {
      return {
        variant: 'destructive' as const,
        icon: AlertTriangle,
        text: 'Sessione scaduta',
        color: 'text-red-600'
      };
    }

    if (sessionTimeRemaining !== null && sessionTimeRemaining < 5 * 60 * 1000) { // Less than 5 minutes
      return {
        variant: 'outline' as const,
        icon: Clock,
        text: `Scade tra ${formatTimeRemaining(sessionTimeRemaining)}`,
        color: 'text-orange-600'
      };
    }

    return {
      variant: 'default' as const,
      icon: CheckCircle,
      text: 'Autenticato',
      color: 'text-green-600'
    };
  };

  const status = getSessionStatus();
  const StatusIcon = status.icon;

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center space-x-2"
      >
        <Badge variant={status.variant} className="flex items-center space-x-1">
          <StatusIcon className="h-3 w-3" />
          <span>{status.text}</span>
        </Badge>

        {showDetails && settings && (
          <div className="hidden md:flex items-center space-x-2 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>Timeout: {settings.security.session_timeout}min</span>
          </div>
        )}
      </motion.div>

      {isSessionExpired && (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Button size="sm" variant="outline">
            <RefreshCw className="h-3 w-3 mr-1" />
            Rinnova
          </Button>
        </motion.div>
      )}
    </div>
  );
}

interface SessionWarningProps {
  onRenew?: () => void;
  onLogout?: () => void;
}

export function SessionWarning({ onRenew, onLogout }: SessionWarningProps) {
  const { currentProfile } = useProfiles();
  const { settings } = useProfileSettings();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!currentProfile || !settings) return;

    const checkSession = () => {
      const sessionTimeout = settings.security.session_timeout * 60 * 1000;
      const lastAccessed = new Date(currentProfile.last_accessed).getTime();
      const now = Date.now();
      const elapsed = now - lastAccessed;
      const remaining = Math.max(0, sessionTimeout - elapsed);

      // Show warning when less than 2 minutes remaining
      setShow(remaining > 0 && remaining < 2 * 60 * 1000);
    };

    checkSession();
    const interval = setInterval(checkSession, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [currentProfile, settings]);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className="fixed top-4 right-4 z-50 w-80"
    >
      <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
        <Clock className="h-4 w-4" />
        <AlertDescription className="flex flex-col space-y-2">
          <p className="text-sm">
            La tua sessione sta per scadere. Vuoi rinnovarla?
          </p>
          <div className="flex space-x-2">
            <Button size="sm" onClick={onRenew}>
              Rinnova Sessione
            </Button>
            <Button size="sm" variant="outline" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </motion.div>
  );
}