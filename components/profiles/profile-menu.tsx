'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  User, 
  Settings, 
  LogOut, 
  Shield,
  Clock,
  ChevronDown,
  Plus
} from 'lucide-react';
import { useProfiles } from '@/hooks/use-profiles';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { ProfileManager } from './profile-manager';
import { CreateProfileDialog } from './create-profile-dialog';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

export function ProfileMenu() {
  const { currentProfile, logout } = useProfiles();
  const { settings } = useProfileSettings();
  const [showProfileManager, setShowProfileManager] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  if (!currentProfile) {
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

  const handleLogout = async () => {
    await logout();
  };

  const handleProfileCreated = (profileId: string) => {
    // Il profilo è già stato impostato come corrente
    setShowCreateDialog(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-auto px-2">
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={currentProfile.avatar_path} alt={currentProfile.name} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-semibold">
                  {getInitials(currentProfile.name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium leading-none">
                  {currentProfile.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {getLastAccessedText(currentProfile.last_accessed)}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent className="w-64" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={currentProfile.avatar_path} alt={currentProfile.name} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                    {getInitials(currentProfile.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-medium leading-none">
                    {currentProfile.name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground mt-1">
                    ID: {currentProfile.id.slice(0, 8)}...
                  </p>
                </div>
              </div>
              
              {/* Status Indicators */}
              <div className="flex flex-wrap gap-1">
                {settings && (
                  <>
                    <Badge variant="outline" className="text-xs">
                      {settings.theme}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {settings.language.toUpperCase()}
                    </Badge>
                    {settings.auto_login && (
                      <Badge variant="secondary" className="text-xs">
                        Auto-login
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setShowProfileManager(true)}>
            <User className="mr-2 h-4 w-4" />
            <span>Gestisci Profilo</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Nuovo Profilo</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Impostazioni</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem>
            <Shield className="mr-2 h-4 w-4" />
            <span>Sicurezza</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {settings && (
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              <Clock className="mr-2 h-3 w-3" />
              <span>Timeout: {settings.security.session_timeout}min</span>
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleLogout} className="text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Logout</span>
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