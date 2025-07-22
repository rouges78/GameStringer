'use client';

import { useProfileAuth } from '@/lib/profile-auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  User,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface AuthStatusSidebarProps {
  isExpanded: boolean;
}

export function AuthStatusSidebar({ isExpanded }: AuthStatusSidebarProps) {
  const { 
    isAuthenticated, 
    currentProfile, 
    sessionTimeRemaining,
    isSessionExpired,
    renewSession 
  } = useProfileAuth();
  
  const [isRenewing, setIsRenewing] = useState(false);

  const handleRenewSession = async () => {
    setIsRenewing(true);
    await renewSession();
    setIsRenewing(false);
  };

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

  const getAuthStatus = () => {
    if (!currentProfile) {
      return {
        icon: Shield,
        color: 'text-gray-500',
        bgColor: 'bg-gray-500',
        text: 'Non autenticato',
        status: 'unauthenticated'
      };
    }

    if (isSessionExpired) {
      return {
        icon: ShieldAlert,
        color: 'text-red-500',
        bgColor: 'bg-red-500',
        text: 'Sessione scaduta',
        status: 'expired'
      };
    }

    if (!isAuthenticated) {
      return {
        icon: ShieldAlert,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500',
        text: 'Non autenticato',
        status: 'unauthenticated'
      };
    }

    const isExpiringSoon = sessionTimeRemaining && sessionTimeRemaining < 5 * 60 * 1000;
    
    return {
      icon: ShieldCheck,
      color: isExpiringSoon ? 'text-orange-500' : 'text-green-500',
      bgColor: isExpiringSoon ? 'bg-orange-500' : 'bg-green-500',
      text: isExpiringSoon ? 'In scadenza' : 'Autenticato',
      status: isExpiringSoon ? 'expiring' : 'authenticated'
    };
  };

  const authStatus = getAuthStatus();
  const StatusIcon = authStatus.icon;

  if (isExpanded) {
    return (
      <div className="p-3 border-t border-b bg-gradient-to-r from-slate-800/50 to-slate-700/50">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 mb-2">Stato Autenticazione</h4>
          
          {/* Profile Info */}
          {currentProfile && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <User className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-300 truncate font-medium">
                  {currentProfile.name}
                </p>
                <p className="text-gray-500 text-xs">
                  ID: {currentProfile.id.slice(0, 8)}...
                </p>
              </div>
            </div>
          )}
          
          {/* Auth Status */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <StatusIcon className={cn("w-4 h-4", authStatus.color)} />
              <span className="text-gray-300">Sessione</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 ${authStatus.bgColor} rounded-full animate-pulse`}></div>
              <span className={cn("text-xs", authStatus.color)}>
                {authStatus.text}
              </span>
            </div>
          </div>
          
          {/* Session Time */}
          {sessionTimeRemaining && isAuthenticated && (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-gray-400" />
                <span className="text-gray-300">Scade tra</span>
              </div>
              <span className="text-gray-400">
                {formatTime(sessionTimeRemaining)}
              </span>
            </div>
          )}
          
          {/* Renew Button */}
          {(isSessionExpired || (sessionTimeRemaining && sessionTimeRemaining < 10 * 60 * 1000)) && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRenewSession}
              disabled={isRenewing}
              className="w-full h-7 text-xs"
            >
              <RefreshCw className={cn("w-3 h-3 mr-1", isRenewing && "animate-spin")} />
              {isRenewing ? 'Rinnovo...' : 'Rinnova'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Collapsed view
  return (
    <div className="p-2 border-t border-b bg-gradient-to-r from-slate-800/50 to-slate-700/50">
      <div className="flex flex-col items-center gap-1">
        {currentProfile && (
          <div 
            className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
            title={`Profilo: ${currentProfile.name}`}
          >
            <User className="w-3 h-3 text-white" />
          </div>
        )}
        
        <div 
          className={`w-2 h-2 ${authStatus.bgColor} rounded-full animate-pulse`}
          title={`Stato: ${authStatus.text}`}
        />
        
        {sessionTimeRemaining && isAuthenticated && (
          <div 
            className="text-xs text-gray-400 font-mono"
            title={`Scade tra: ${formatTime(sessionTimeRemaining)}`}
          >
            {Math.floor(sessionTimeRemaining / (1000 * 60))}m
          </div>
        )}
      </div>
    </div>
  );
}