'use client';

import { useState, useEffect } from 'react';
import { useProfileAuth } from '@/lib/profile-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Clock, 
  Shield, 
  User, 
  LogOut, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function SessionStatus() {
  const { 
    isAuthenticated, 
    currentProfile, 
    sessionTimeRemaining,
    isSessionExpired,
    renewSession,
    logout 
  } = useProfileAuth();

  const [isRenewing, setIsRenewing] = useState(false);
  const [timeDisplay, setTimeDisplay] = useState<string>('');

  // Format remaining time
  useEffect(() => {
    if (!sessionTimeRemaining) {
      setTimeDisplay('');
      return;
    }

    const formatTime = (ms: number) => {
      const minutes = Math.floor(ms / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      } else if (minutes > 0) {
        return `${minutes}m`;
      } else {
        return '<1m';
      }
    };

    setTimeDisplay(formatTime(sessionTimeRemaining));

    // Update every minute
    const interval = setInterval(() => {
      const newRemaining = sessionTimeRemaining - (Date.now() % 60000);
      if (newRemaining > 0) {
        setTimeDisplay(formatTime(newRemaining));
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [sessionTimeRemaining]);

  // Handle session renewal
  const handleRenewSession = async () => {
    setIsRenewing(true);
    await renewSession();
    setIsRenewing(false);
  };

  if (!isAuthenticated || !currentProfile) {
    return null;
  }

  // Determine session status
  const getSessionStatus = () => {
    if (isSessionExpired) {
      return {
        variant: 'destructive' as const,
        icon: AlertTriangle,
        text: 'Scaduta',
        color: 'text-red-500'
      };
    }
    
    if (sessionTimeRemaining && sessionTimeRemaining < 5 * 60 * 1000) { // Less than 5 minutes
      return {
        variant: 'secondary' as const,
        icon: Clock,
        text: timeDisplay,
        color: 'text-orange-500'
      };
    }
    
    return {
      variant: 'outline' as const,
      icon: CheckCircle,
      text: timeDisplay || 'Attiva',
      color: 'text-green-500'
    };
  };

  const status = getSessionStatus();
  const StatusIcon = status.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-3 h-3 text-white" />
            </div>
            <span className="hidden sm:inline text-sm font-medium">
              {currentProfile.name}
            </span>
            <Badge variant={status.variant} className="h-5 text-xs gap-1">
              <StatusIcon className={cn("w-3 h-3", status.color)} />
              <span className="hidden md:inline">{status.text}</span>
            </Badge>
          </div>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-medium text-sm">{currentProfile.name}</p>
              <p className="text-xs text-muted-foreground">
                ID: {currentProfile.id.slice(0, 8)}...
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3 h-3" />
            <span>Sessione sicura attiva</span>
          </div>
          
          {sessionTimeRemaining && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Clock className="w-3 h-3" />
              <span>Scade tra: {timeDisplay}</span>
            </div>
          )}
        </div>
        
        <DropdownMenuSeparator />
        
        {isSessionExpired ? (
          <DropdownMenuItem 
            onClick={handleRenewSession}
            disabled={isRenewing}
            className="text-orange-600 focus:text-orange-600"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRenewing && "animate-spin")} />
            {isRenewing ? 'Rinnovo...' : 'Rinnova Sessione'}
          </DropdownMenuItem>
        ) : sessionTimeRemaining && sessionTimeRemaining < 10 * 60 * 1000 && (
          <DropdownMenuItem 
            onClick={handleRenewSession}
            disabled={isRenewing}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRenewing && "animate-spin")} />
            {isRenewing ? 'Rinnovo...' : 'Rinnova Sessione'}
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem 
          onClick={logout}
          className="text-red-600 focus:text-red-600"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Cambia Profilo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


