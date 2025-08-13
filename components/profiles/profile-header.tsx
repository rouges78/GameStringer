'use client';

import { useState } from 'react';
import { useProfileAuth } from '@/lib/profile-auth';
import { useProfiles } from '@/hooks/use-profiles';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  User, 
  Settings, 
  LogOut, 
  Shield,
  Clock,
  ChevronDown,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Download,
  Upload
} from 'lucide-react';
import { ProfileManager } from './profile-manager';
import { CreateProfileDialog } from './create-profile-dialog';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

export function ProfileHeader() {
  const { 
    isAuthenticated, 
    currentProfile, 
    sessionTimeRemaining,
    isSessionExpired,
    renewSession,
    logout 
  } = useProfileAuth();
  
  const { profiles } = useProfiles();
  const { settings } = useProfileSettings();
  const [showProfileManager, setShowProfileManager] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);

  if (!isAuthenticated || !currentProfile) {
    return null;
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getLastAccessedText = (lastAccessed: string) => {
    try {
      const date = new Date(lastAccessed);
      return formatDistanceToNow(date, { 
        addSuffix: true, 
        locale: it 
      });
    } catch {
      return 'Mai';
    }
  };

  const formatSessionTime = (ms: number) => {
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

  const getSessionStatus = () => {
    if (isSessionExpired) {
      return {
        icon: AlertTriangle,
        text: 'Scaduta',
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/20'
      };
    }
    
    if (sessionTimeRemaining && sessionTimeRemaining < 5 * 60 * 1000) {
      return {
        icon: Clock,
        text: formatSessionTime(sessionTimeRemaining),
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/20'
      };
    }
    
    return {
      icon: CheckCircle,
      text: sessionTimeRemaining ? formatSessionTime(sessionTimeRemaining) : 'Attiva',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20'
    };
  };

  const handleRenewSession = async () => {
    setIsRenewing(true);
    await renewSession();
    setIsRenewing(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleProfileCreated = (profileId: string) => {
    setShowCreateDialog(false);
  };

  const sessionStatus = getSessionStatus();
  const SessionIcon = sessionStatus.icon;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-auto px-3 hover:bg-accent/50">
            <div className="flex items-center space-x-3">
              {/* Avatar */}
              <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                <AvatarImage src={currentProfile.avatar_path} alt={currentProfile.name} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-semibold">
                  {getInitials(currentProfile.name)}
                </AvatarFallback>
              </Avatar>
              
              {/* Profile Info */}
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium leading-none">
                  {currentProfile.name}
                </span>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {profiles.length} profil{profiles.length !== 1 ? 'i' : 'o'}
                  </span>
                  <div className={cn(
                    "flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-xs",
                    sessionStatus.bgColor,
                    sessionStatus.borderColor,
                    "border"
                  )}>
                    <SessionIcon className={cn("w-3 h-3", sessionStatus.color)} />
                    <span className={sessionStatus.color}>{sessionStatus.text}</span>
                  </div>
                </div>
              </div>
              
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent className="w-80" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-3">
              {/* Profile Header */}
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                  <AvatarImage src={currentProfile.avatar_path} alt={currentProfile.name} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                    {getInitials(currentProfile.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1">
                  <p className="text-sm font-medium leading-none">
                    {currentProfile.name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground mt-1">
                    ID: {currentProfile.id.slice(0, 8)}...
                  </p>
                  <p className="text-xs leading-none text-muted-foreground mt-1">
                    Ultimo accesso: {getLastAccessedText(currentProfile.last_accessed)}
                  </p>
                </div>
              </div>
              
              {/* Session Status */}
              <div className={cn(
                "flex items-center justify-between p-2 rounded-lg border",
                sessionStatus.bgColor,
                sessionStatus.borderColor
              )}>
                <div className="flex items-center space-x-2">
                  <SessionIcon className={cn("w-4 h-4", sessionStatus.color)} />
                  <span className="text-sm font-medium">Sessione</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={cn("text-sm font-medium", sessionStatus.color)}>
                    {sessionStatus.text}
                  </span>
                  {(isSessionExpired || (sessionTimeRemaining && sessionTimeRemaining < 10 * 60 * 1000)) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRenewSession}
                      disabled={isRenewing}
                      className="h-6 px-2"
                    >
                      <RefreshCw className={cn("w-3 h-3", isRenewing && "animate-spin")} />
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Profile Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg">
                  <span className="font-medium">{profiles.length}</span>
                  <span className="text-muted-foreground">Profili</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg">
                  <span className="font-medium">
                    {settings?.theme || 'Auto'}
                  </span>
                  <span className="text-muted-foreground">Tema</span>
                </div>
              </div>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          {/* Profile Actions */}
          <DropdownMenuItem onClick={() => setShowProfileManager(true)}>
            <User className="mr-2 h-4 w-4" />
            <span>Gestisci Profilo</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Nuovo Profilo</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Import/Export */}
          <DropdownMenuItem>
            <Download className="mr-2 h-4 w-4" />
            <span>Esporta Profilo</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem>
            <Upload className="mr-2 h-4 w-4" />
            <span>Importa Profilo</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Settings */}
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Impostazioni</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem>
            <Shield className="mr-2 h-4 w-4" />
            <span>Sicurezza</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Logout */}
          <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cambia Profilo</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile Manager Dialog */}
      <Dialog open={showProfileManager} onOpenChange={setShowProfileManager}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestione Profilo</DialogTitle>
          </DialogHeader>
          <ProfileManager onClose={() => setShowProfileManager(false)} />
        </DialogContent>
      </Dialog>

      {/* Create Profile Dialog */}
      <CreateProfileDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onProfileCreated={handleProfileCreated}
      />
    </>
  );
}