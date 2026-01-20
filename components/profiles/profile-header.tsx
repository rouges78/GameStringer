'use client';

import { useState, useEffect } from 'react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  Upload,
  Info,
  Camera
} from 'lucide-react';
import { ProfileManager } from './profile-manager';
import { CreateProfileDialog } from './create-profile-dialog';
import { AvatarUpload } from './avatar-upload';
import { SecurityDialog } from './security-dialog';
import { cn } from '@/lib/utils';
import { exportProfile, importProfile } from '@/lib/profile-export';
import { formatDistanceToNow } from 'date-fns';
import { enUS, it } from 'date-fns/locale';
import { useTranslation } from '@/lib/i18n';

export function ProfileHeader() {
  const { t, language } = useTranslation();
  const { 
    isAuthenticated, 
    currentProfile, 
    sessionTimeRemaining,
    isSessionExpired,
    renewSession,
    logout 
  } = useProfileAuth();
  
  const { profiles, getProfileAvatar } = useProfiles();
  const { settings } = useProfileSettings();
  const [showProfileManager, setShowProfileManager] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [isRenewing, setIsRenewing] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Carica avatar dal backend o localStorage
  useEffect(() => {
    const loadAvatar = async () => {
      if (!currentProfile) return;
      
      // Prima controlla localStorage
      const saved = localStorage.getItem(`avatar_${currentProfile.name}`);
      if (saved) {
        setAvatarUrl(saved);
        return;
      }
      
      // Se c'è un avatar_path, gestiscilo
      if (currentProfile.avatar_path) {
        const path = currentProfile.avatar_path;
        
        // Se è un gradiente, non caricare
        if (path.startsWith('gradient-')) {
          setAvatarUrl('');
          return;
        }
        
        // Se ha prefisso custom: estrai il data URL
        if (path.startsWith('custom:')) {
          setAvatarUrl(path.substring(7));
          return;
        }
        
        // Se è già un data URL base64, usalo
        if (path.startsWith('data:image/')) {
          setAvatarUrl(path);
          return;
        }
        
        // Se è base64 raw (lungo), aggiungi il prefisso
        if (path.length > 100) {
          setAvatarUrl(`data:image/png;base64,${path}`);
          return;
        }
        
        // Altrimenti carica dal backend
        const src = await getProfileAvatar(currentProfile.id);
        if (src) {
          setAvatarUrl(src);
          return;
        }
      }
      
      setAvatarUrl('');
    };
    loadAvatar();
  }, [currentProfile?.id, currentProfile?.name, currentProfile?.avatar_path, getProfileAvatar]);

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
        locale: language === 'it' ? it : enUS 
      });
    } catch {
      return t('profile.never');
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
        text: t('profile.expired'),
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
      text: sessionTimeRemaining ? formatSessionTime(sessionTimeRemaining) : t('profile.active'),
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
      {/* Backdrop blur overlay - z-[60] to be above sidebar (z-50) */}
      {isDropdownOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[60]" />
      )}
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-auto px-3 hover:bg-accent/50">
            <div className="flex items-center space-x-3">
              {/* Avatar */}
              <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                <AvatarImage src={avatarUrl || undefined} alt={currentProfile.name} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-semibold">
                  {getInitials(currentProfile.name)}
                </AvatarFallback>
              </Avatar>
              
              {/* Profile Name */}
              <span className="hidden sm:inline text-sm font-medium">
                {currentProfile.name}
              </span>
              
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent className="w-80 z-[70]" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-3">
              {/* Profile Header */}
              <div className="flex items-center space-x-3">
                <button onClick={() => setShowAvatarUpload(true)} className="relative group">
                  <Avatar className="h-12 w-12 ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all">
                    <AvatarImage src={avatarUrl || undefined} alt={currentProfile.name} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                      {getInitials(currentProfile.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-4 w-4 text-white" />
                  </div>
                </button>
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium leading-none">
                      {currentProfile.name}
                    </p>
                    <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600">
                      {t('profile.active')}
                    </Badge>
                  </div>
                  <p className="text-xs leading-none text-muted-foreground mt-1">
                    ID: {currentProfile.id.slice(0, 8)}...
                  </p>
                  <p className="text-xs leading-none text-muted-foreground mt-1">
                    {t('profile.lastAccess')} {getLastAccessedText(currentProfile.last_accessed)}
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
                  <span className="text-sm font-medium">{t('profile.session')}</span>
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg cursor-help">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{profiles.length}</span>
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <span className="text-muted-foreground">{t('profile.profilesCreated')}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{t('profile.tooltipProfiles')}</p>
                      <p className="text-xs">{t('profile.tooltipOnlyOne')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg">
                  <span className="font-medium">
                    {settings?.theme || 'Auto'}
                  </span>
                  <span className="text-muted-foreground">{t('profile.theme')}</span>
                </div>
              </div>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          {/* Profile Actions */}
          <DropdownMenuItem onClick={() => setShowAvatarUpload(true)}>
            <Camera className="mr-2 h-4 w-4" />
            <span>{t('profile.changeAvatar')}</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowProfileManager(true)}>
            <User className="mr-2 h-4 w-4" />
            <span>{t('profile.manageProfile')}</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            <span>{t('profile.newProfile')}</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Import/Export */}
          <DropdownMenuItem onClick={() => exportProfile(currentProfile, settings)}>
            <Download className="mr-2 h-4 w-4" />
            <span>{t('profile.exportProfile')}</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => importProfile()}>
            <Upload className="mr-2 h-4 w-4" />
            <span>{t('profile.importProfile')}</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Settings */}
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>{t('nav.settings')}</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowSecurity(true)}>
            <Shield className="mr-2 h-4 w-4" />
            <span>{t('profile.security')}</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Logout */}
          <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('profile.logout')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile Manager Dialog */}
      <Dialog open={showProfileManager} onOpenChange={setShowProfileManager}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('profile.profileManagement')}</DialogTitle>
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

      {/* Avatar Upload Dialog */}
      <AvatarUpload
        currentAvatar={avatarUrl}
        userName={currentProfile.name}
        onAvatarChange={setAvatarUrl}
        open={showAvatarUpload}
        onOpenChange={setShowAvatarUpload}
      />

      {/* Security Dialog */}
      <SecurityDialog
        open={showSecurity}
        onOpenChange={setShowSecurity}
        profileId={currentProfile.id}
        profileName={currentProfile.name}
      />
    </>
  );
}