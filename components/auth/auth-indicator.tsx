'use client';

import { useProfileAuth } from '@/lib/profile-auth';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldAlert, ShieldCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

export function AuthIndicator({ showDetails = false, className }: AuthIndicatorProps) {
  const { 
    isAuthenticated, 
    currentProfile, 
    sessionTimeRemaining,
    isSessionExpired 
  } = useProfileAuth();

  if (!currentProfile) {
    return (
      <Badge variant="secondary" className={cn("gap-1", className)}>
        <ShieldAlert className="w-3 h-3 text-orange-500" />
        <span>Not authenticated</span>
      </Badge>
    );
  }

  if (isSessionExpired) {
    return (
      <Badge variant="destructive" className={cn("gap-1", className)}>
        <ShieldAlert className="w-3 h-3" />
        <span>Session expired</span>
      </Badge>
    );
  }

  if (!isAuthenticated) {
    return (
      <Badge variant="secondary" className={cn("gap-1", className)}>
        <Shield className="w-3 h-3 text-gray-500" />
        <span>Not authenticated</span>
      </Badge>
    );
  }

  // Format remaining time
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

  const isExpiringSoon = sessionTimeRemaining && sessionTimeRemaining < 5 * 60 * 1000; // Less than 5 minutes

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge 
        variant={isExpiringSoon ? "secondary" : "outline"} 
        className={cn(
          "gap-1",
          isExpiringSoon && "border-orange-500 text-orange-600"
        )}
      >
        <ShieldCheck className={cn(
          "w-3 h-3",
          isExpiringSoon ? "text-orange-500" : "text-green-500"
        )} />
        <span>Authenticated</span>
      </Badge>
      
      {showDetails && sessionTimeRemaining && (
        <Badge variant="outline" className="gap-1 text-xs">
          <Clock className="w-3 h-3" />
          <span>{formatTime(sessionTimeRemaining)}</span>
        </Badge>
      )}
    </div>
  );
}