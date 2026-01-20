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
import { useState, useEffect } from 'react';
import { useProfiles } from '@/hooks/use-profiles';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const { getProfileAvatar } = useProfiles();

  // Carica avatar dal backend o usa direttamente se è già base64
  useEffect(() => {
    const loadAvatar = async () => {
      if (currentProfile?.avatar_path) {
        const path = currentProfile.avatar_path;

        // Se è un gradiente, non caricare
        if (path.startsWith('gradient-')) {
          setAvatarSrc(null);
          return;
        }
        
        // Se ha prefisso custom: (optimistic update), estrai il data URL
        if (path.startsWith('custom:')) {
          setAvatarSrc(path.substring(7));
          return;
        }
        
        // Se è già un data URL base64, usalo direttamente
        if (path.startsWith('data:image/')) {
          setAvatarSrc(path);
          return;
        }
        
        // Se è base64 raw (lungo), aggiungi il prefisso
        if (path.length > 100) {
          setAvatarSrc(`data:image/png;base64,${path}`);
          return;
        }
        
        // Altrimenti prova a caricarlo dal backend (è un filename)
        if (currentProfile.id) {
          const src = await getProfileAvatar(currentProfile.id);
          if (src) {
            setAvatarSrc(src);
            return;
          }
        }
      }
      setAvatarSrc(null);
    };
    loadAvatar();
  }, [currentProfile?.id, currentProfile?.avatar_path, getProfileAvatar]);

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
        text: 'Not authenticated',
        status: 'unauthenticated'
      };
    }

    if (isSessionExpired) {
      return {
        icon: ShieldAlert,
        color: 'text-red-500',
        bgColor: 'bg-red-500',
        text: 'Session expired',
        status: 'expired'
      };
    }

    if (!isAuthenticated) {
      return {
        icon: ShieldAlert,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500',
        text: 'Not authenticated',
        status: 'unauthenticated'
      };
    }

    const isExpiringSoon = sessionTimeRemaining && sessionTimeRemaining < 5 * 60 * 1000;
    
    return {
      icon: ShieldCheck,
      color: isExpiringSoon ? 'text-orange-500' : 'text-green-500',
      bgColor: isExpiringSoon ? 'bg-orange-500' : 'bg-green-500',
      text: isExpiringSoon ? 'Expiring soon' : 'Authenticated',
      status: isExpiringSoon ? 'expiring' : 'authenticated'
    };
  };

  const authStatus = getAuthStatus();
  const StatusIcon = authStatus.icon;

  if (isExpanded) {
    return (
      <div className="px-2 py-2 border-t border-gray-700/50">
        {currentProfile ? (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Avatar className="w-7 h-7">
                <AvatarImage src={avatarSrc || undefined} alt={currentProfile.name} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-white text-xs font-bold">
                  {currentProfile.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-gray-900",
                authStatus.status === 'authenticated' ? "bg-green-500" : 
                authStatus.status === 'expiring' ? "bg-orange-500" : "bg-red-500"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {currentProfile.name}
              </p>
              <p className="text-[9px] text-gray-500">
                {authStatus.text}
              </p>
            </div>
            {(isSessionExpired || (sessionTimeRemaining && sessionTimeRemaining < 10 * 60 * 1000)) && (
              <button
                onClick={handleRenewSession}
                disabled={isRenewing}
                className="p-1 text-orange-400 hover:text-orange-300 transition-colors"
                title="Rinnova sessione"
              >
                <RefreshCw className={cn("w-3 h-3", isRenewing && "animate-spin")} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <User className="w-4 h-4" />
            <span className="text-xs">Not authenticated</span>
          </div>
        )}
      </div>
    );
  }

  // Collapsed view
  return (
    <div className="p-2 border-t border-b bg-gradient-to-r from-slate-800/50 to-slate-700/50">
      <div className="flex flex-col items-center gap-1">
        {currentProfile && (
          <Avatar className="w-6 h-6" title={`Profilo: ${currentProfile.name}`}>
            <AvatarImage src={avatarSrc || undefined} alt={currentProfile.name} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs">
              {currentProfile.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
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