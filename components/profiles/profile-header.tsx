'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfileAuth } from '@/lib/auth/profile-auth';
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
  Camera,
  Palette
} from 'lucide-react';
import { ProfileManager } from './profile-manager';
import { CreateProfileDialog } from './create-profile-dialog';
import { AvatarUpload } from './avatar-upload';
import { SecurityDialog } from './security-dialog';
import { ThemeCustomizer } from '@/components/theme/theme-customizer';
import { cn } from '@/lib/utils';
import { exportProfile, importProfile } from '@/lib/auth/profile-export';
import { formatDistanceToNow } from 'date-fns';
import { enUS, it } from 'date-fns/locale';
import { useTranslation } from '@/lib/i18n';

export function ProfileHeader() {
  const router = useRouter();
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
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [isRenewing, setIsRenewing] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Carica avatar dal backend o localStorage
  useEffect(() => {
    const loadAvatar = async () => {
      if (!currentProfile) return;
      
      // First controlla localStorage
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

  const handleProfileCreated = (_profileId: string) => {
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
          {/* Sotto `sm` resta solo l'avatar: il nome sparisce con lo span. */}
        <Button variant="ghost" aria-label={currentProfile.name} className="relative h-10 w-auto px-3 hover:bg-accent/50">
            <div className="flex items-center space-x-3">
              {/* Avatar */}
              <Avatar className="h-8 w-8 ring-2 ring-indigo-500/20">
                <AvatarImage src={avatarUrl || undefined} alt={currentProfile.name} />
                <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white text-sm font-semibold">
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
        
        <DropdownMenuContent className="w-64 z-[70] border-slate-800 bg-slate-950/95 backdrop-blur-xl" align="end" forceMount>
          <DropdownMenuLabel className="font-normal p-3">
            <div className="flex flex-col space-y-1.5">
              {/* Profile Header - Compatto */}
              <div className="flex items-center space-x-2">
                <button onClick={() => setShowAvatarUpload(true)} className="relative group shrink-0">
                  <Avatar className="h-8 w-8 ring-2 ring-indigo-500/30 group-hover:ring-indigo-500/60 transition-all">
                    <AvatarImage src={avatarUrl || undefined} alt={currentProfile.name} />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white text-xs font-semibold">
                      {getInitials(currentProfile.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-2.5 w-2.5 text-white" />
                  </div>
                </button>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium leading-none text-slate-100 truncate">
                      {currentProfile.name}
                    </p>
                    <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30 shrink-0">
                      {t('profile.active')}
                    </Badge>
                  </div>
                  <p className="text-[10px] leading-none text-slate-500 font-mono mt-0.5">
                    ID: {currentProfile.id.slice(0, 6)}...
                  </p>
                  <p className="text-[10px] leading-none text-slate-400 mt-0.5 truncate">
                    {getLastAccessedText(currentProfile.last_accessed)}
                  </p>
                </div>
              </div>
              
              {/* Session Status - Compatto */}
              <div className={cn(
                "flex items-center justify-between px-2 py-1 rounded border text-xs",
                sessionStatus.bgColor,
                sessionStatus.borderColor
              )}>
                <div className="flex items-center space-x-1">
                  <SessionIcon className={cn("w-3 h-3", sessionStatus.color)} />
                  <span className="text-[11px] font-medium">{t('profile.session')}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className={cn("text-[11px] font-medium", sessionStatus.color)}>
                    {sessionStatus.text}
                  </span>
                  {(isSessionExpired || (sessionTimeRemaining && sessionTimeRemaining < 10 * 60 * 1000)) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRenewSession}
                      disabled={isRenewing}
                      className="h-5 px-1.5 py-0"
                    >
                      <RefreshCw className={cn("w-2.5 h-2.5", isRenewing && "animate-spin")} />
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Profile Stats - Compatto in riga */}
              <div className="flex items-center justify-between text-xs px-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help text-slate-400">
                        <span className="font-medium text-slate-200 text-xs">{profiles.length}</span>
                        <span className="text-[10px]">{t('profile.profilesCreated')}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{t('profile.tooltipProfiles')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div 
                  className="flex items-center gap-1 cursor-pointer hover:text-indigo-400 transition-colors text-slate-400 text-[10px]"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDropdownOpen(false);
                    setTimeout(() => setShowThemeCustomizer(true), 100);
                  }}
                >
                  <Palette className="h-2.5 w-2.5" />
                  {settings?.theme || 'Auto'}
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
          <DropdownMenuItem onClick={() => exportProfile(currentProfile as unknown as Record<string, unknown>, settings as unknown as Record<string, unknown>)}>
            <Download className="mr-2 h-4 w-4" />
            <span>{t('profile.exportProfile')}</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => importProfile()}>
            <Upload className="mr-2 h-4 w-4" />
            <span>{t('profile.importProfile')}</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Settings */}
          <DropdownMenuItem onClick={() => {
            setIsDropdownOpen(false);
            router.push('/settings');
          }}>
            <Settings className="mr-2 h-4 w-4" />
            <span>{t('nav.settings')}</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowSecurity(true)}>
            <Shield className="mr-2 h-4 w-4" />
            <span>{t('profile.security')}</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Logout */}
          <DropdownMenuItem onClick={handleLogout} className="text-red-400 focus:text-red-400 hover:bg-red-500/10">
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('profile.logout')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile Manager Dialog */}
      <Dialog open={showProfileManager} onOpenChange={setShowProfileManager}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-slate-900/60 backdrop-blur-2xl border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] p-6">
          <DialogHeader className="mb-4">
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
        currentAvatar={avatarUrl || undefined}
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

      {/* Theme Customizer Dialog */}
      <ThemeCustomizer
        open={showThemeCustomizer}
        onOpenChange={setShowThemeCustomizer}
      />
    </>
  );
}



