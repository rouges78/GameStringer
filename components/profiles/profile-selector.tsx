'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  User, 
  Lock, 
  Plus, 
  Eye, 
  EyeOff, 
  Clock, 
  Shield,
  AlertTriangle,
  CheckCircle,
  Loader2,
  MoreVertical,
  Trash2
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import { useProfiles } from '@/hooks/use-profiles';
import { ProfileInfo } from '@/types/profiles';
import { formatDistanceToNow } from 'date-fns';
import { getAvatarGradient, getInitials } from '@/lib/avatar-utils';
import { AlphabetBackground } from '@/components/ui/alphabet-background';

interface ProfileSelectorProps {
  onCreateProfile: () => void;
}

interface ProfileCardProps {
  profile: ProfileInfo;
  isSelected: boolean;
  isCurrentProfile?: boolean;
}

function ProfileCard({ profile, isSelected, isCurrentProfile = false }: ProfileCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  // Load saved password on mount
  useEffect(() => {
    const savedPassword = localStorage.getItem(`gs_pwd_${profile.id}`);
    if (savedPassword) {
      setPassword(atob(savedPassword)); // Decode base64
      setRememberPassword(true);
    }
  }, [profile.id]);
  
  const { authenticateProfile, deleteProfile, getProfileAvatar, updateProfileAvatar } = useProfiles();
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  useEffect(() => {
    const loadAvatar = async () => {
      if (!profile.avatar_path || profile.avatar_path.startsWith('gradient-')) {
        return;
      }
      
      // Se è già un data URL completo, usalo direttamente
      if (profile.avatar_path.startsWith('data:image/')) {
        setAvatarSrc(profile.avatar_path);
        return;
      }
      
      // Se ha prefisso custom:, estrai il data URL
      if (profile.avatar_path.startsWith('custom:')) {
        setAvatarSrc(profile.avatar_path.substring(7));
        return;
      }
      
      // Se è base64 raw (senza prefisso data:), aggiungi il prefisso
      if (profile.avatar_path.length > 100) {
        setAvatarSrc(`data:image/png;base64,${profile.avatar_path}`);
        return;
      }
      
      // Altrimenti carica dal backend
      const src = await getProfileAvatar(profile.id);
      if (src) {
        setAvatarSrc(src);
      }
    };
    
    loadAvatar();
  }, [profile.avatar_path, profile.id, getProfileAvatar]);

  // Gestisce il cambio avatar
  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Verifica tipo file
    if (!file.type.startsWith('image/')) {
      setAuthError('Select a valid image file');
      return;
    }

    // Verifica dimensione (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAuthError('Image too large (max 2MB)');
      return;
    }

    setIsUpdatingAvatar(true);
    setAuthError(null);

    try {
      // Leggi file come base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        // Formato: custom:data:image/png;base64,...
        const avatarPath = `custom:${base64}`;
        
        const success = await updateProfileAvatar(profile.id, avatarPath);
        if (success) {
          setAvatarSrc(base64);
        } else {
          setAuthError('Avatar update error');
        }
        setIsUpdatingAvatar(false);
      };
      reader.onerror = () => {
        setAuthError('File read error');
        setIsUpdatingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Avatar change error:', err);
      setAuthError('Avatar change error');
      setIsUpdatingAvatar(false);
    }
  };

  const handleAuthenticate = async () => {
    if (!password.trim()) {
      setAuthError('Enter password');
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    const success = await authenticateProfile(profile.name, password);
    
    if (success) {
      console.log('✅ Login successful for:', profile.name);
      // Save or remove password based on checkbox
      if (rememberPassword) {
        localStorage.setItem(`gs_pwd_${profile.id}`, btoa(password)); // Encode base64
      } else {
        localStorage.removeItem(`gs_pwd_${profile.id}`);
      }
      // 🔄 No onSelect call: UI updates via global state
      // and "profile-auth-changed" event. ProtectedRoute will detect isAuthenticated=true.
    } else {
      setAuthError('Incorrect password');
      setPassword('');
      // Remove saved password if incorrect
      localStorage.removeItem(`gs_pwd_${profile.id}`);
      setRememberPassword(false);
    }
    
    setIsAuthenticating(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAuthenticate();
    }
  };

  const handleDeleteProfile = async () => {
    if (!password.trim()) {
      setAuthError('Enter password to delete profile');
      return;
    }

    setIsDeleting(true);
    setAuthError(null);

    const success = await deleteProfile(profile.id, password);
    
    if (!success) {
      setAuthError('Incorrect password or deletion error');
    } else {
      // Reset UI on success
      setShowDeleteConfirm(false);
      setPassword('');
    }
    
    setIsDeleting(false);
    setShowDeleteConfirm(false);
    setPassword('');
  };



  const getLastAccessedText = (lastAccessed: string) => {
    try {
      const date = new Date(lastAccessed);
      return formatDistanceToNow(date, { 
        addSuffix: true
      });
    } catch {
      return 'Never';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full"
    >
      <div 
        className={`relative overflow-hidden rounded-2xl transition-all duration-300 h-full flex flex-col ${
        isSelected 
          ? 'ring-2 ring-indigo-500 shadow-2xl shadow-indigo-500/20 bg-slate-900/80 backdrop-blur-xl' 
          : 'hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 bg-slate-900/40 border border-slate-800 hover:border-indigo-500/30 backdrop-blur-md'
        } ${profile.is_locked ? 'border-indigo-500/30 bg-indigo-950/30' : ''}`}
      >
        {/* Decorative gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-blue-500/5 opacity-0 ${isSelected ? 'opacity-100' : 'group-hover:opacity-100'} transition-opacity duration-500 pointer-events-none`} />

        <div className="p-5 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="relative group/avatar">
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={isUpdatingAvatar}
                />
                <Avatar className="h-14 w-14 ring-2 ring-slate-950/50 shadow-lg transition-all group-hover/avatar:ring-indigo-500/50">
                  {isUpdatingAvatar ? (
                    <AvatarFallback className="bg-slate-800">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                    </AvatarFallback>
                  ) : (
                    <>
                      <AvatarImage src={avatarSrc || undefined} alt={profile.name} className="object-cover" />
                      <AvatarFallback className={`bg-gradient-to-br ${getAvatarGradient(profile.avatar_path)} text-white font-bold text-lg`}>
                        {getInitials(profile.name)}
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                {/* Overlay hint on hover */}
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <Plus className="w-5 h-5 text-white" />
                </div>
              </label>
              {profile.is_locked && (
                <div className="absolute -bottom-1 -right-1 bg-indigo-500 text-white rounded-full p-1 shadow-md">
                  <Lock className="w-3 h-3" />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-0.5">
                <h3 className={`text-lg font-bold truncate transition-colors ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                  {profile.name}
                </h3>
              </div>
              
              <div className="flex items-center text-xs text-slate-400 font-medium">
                <Clock className="w-3 h-3 mr-1.5 opacity-70" />
                <span>{getLastAccessedText(profile.last_accessed)}</span>
              </div>

              {(profile.failed_attempts > 0 && !profile.is_locked) && (
                <Badge variant="outline" className="mt-2 text-[10px] border-orange-500/50 text-orange-400 bg-orange-500/10 h-5 px-1.5">
                  <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                  {profile.failed_attempts} failed attempts
                </Badge>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 pb-5 relative z-10"
            >
              <div className="h-px w-full bg-slate-800/50 mb-4" />
              
              {profile.is_locked ? (
                <Alert className="border-red-500/20 bg-red-500/10 text-red-200">
                  <Shield className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-xs ml-2">
                    Profile locked. Contact administrator.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`password-${profile.id}`} className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Password
                    </Label>
                    <div className="relative group/input">
                      <Input
                        id={`password-${profile.id}`}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyPress={handleKeyPress}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Enter password"
                        className="pr-10 bg-slate-950/50 border-slate-700/50 focus:border-indigo-500/50 focus:ring-indigo-500/20 text-slate-100 placeholder:text-slate-600 transition-all h-10"
                        disabled={isAuthenticating}
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 text-slate-500 hover:text-slate-300 hover:bg-transparent"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPassword(!showPassword);
                        }}
                        disabled={isAuthenticating}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    
                    {/* Checkbox Ricordami */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`remember-${profile.id}`}
                        checked={rememberPassword}
                        onCheckedChange={(checked) => setRememberPassword(checked === true)}
                        onClick={(e) => e.stopPropagation()}
                        className="border-slate-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 w-4 h-4 rounded"
                      />
                      <label
                        htmlFor={`remember-${profile.id}`}
                        className="text-xs text-slate-400 cursor-pointer select-none hover:text-slate-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Remember password
                      </label>
                    </div>
                  </div>

                  {authError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300">{authError}</p>
                    </motion.div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAuthenticate();
                      }}
                      disabled={isAuthenticating || !password.trim()}
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white border-0 shadow-lg shadow-indigo-900/20 h-10"
                    >
                      {isAuthenticating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <span className="text-sm">Logging in...</span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-medium">Login</span>
                          <CheckCircle className="ml-2 h-4 w-4 opacity-80" />
                        </>
                      )}
                    </Button>
                    
                    {!showDeleteConfirm ? (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCurrentProfile) {
                            setAuthError('Cannot delete active profile. Logout first.');
                          } else {
                            setShowDeleteConfirm(true);
                          }
                        }}
                        disabled={isAuthenticating || isDeleting || isCurrentProfile}
                        className={`border-slate-700 bg-slate-800/50 w-10 h-10 shrink-0 ${isCurrentProfile ? 'text-slate-600 cursor-not-allowed opacity-50' : 'text-slate-400 hover:text-red-400 hover:bg-red-950/30 hover:border-red-900/50'}`}
                        title={isCurrentProfile ? 'Cannot delete active profile' : 'Delete profile'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  
                  {/* Double confirm deletion */}
                  {showDeleteConfirm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg space-y-3"
                    >
                      <p className="text-xs text-red-200/80 leading-relaxed">
                        Delete <strong>{profile.name}</strong>? This action is irreversible.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(false);
                            setAuthError(null);
                          }}
                          disabled={isDeleting}
                          className="flex-1 h-8 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProfile();
                          }}
                          disabled={isDeleting || !password.trim()}
                          className="flex-1 h-8 text-xs bg-red-600/80 hover:bg-red-500"
                        >
                          {isDeleting ? '...' : 'Confirm'}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function ProfileSelector({ onCreateProfile }: ProfileSelectorProps) {
  const { profiles, currentProfile, isLoading, error, authenticateProfile } = useProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  
  // Auto-login after restart for language change
  useEffect(() => {
    const autoRelogin = localStorage.getItem('gamestringer_auto_relogin');
    const profileId = localStorage.getItem('gamestringer_relogin_profile_id');
    
    if (autoRelogin === 'true' && profileId && profiles.length > 0 && !isAutoLoggingIn) {
      // Clean up flags
      localStorage.removeItem('gamestringer_auto_relogin');
      localStorage.removeItem('gamestringer_relogin_profile_id');
      
      // Find profile and saved password
      const profile = profiles.find(p => p.id === profileId);
      const savedPassword = localStorage.getItem(`gs_pwd_${profileId}`);
      
      if (profile && savedPassword) {
        setIsAutoLoggingIn(true);
        const password = atob(savedPassword); // Decode base64
        
        // Execute auto-login using profile NAME, not ID
        authenticateProfile(profile.name, password).then(success => {
          setIsAutoLoggingIn(false);
          if (success) {
            console.log('✅ Auto-login completed after language change');
          }
        });
      }
    }
  }, [profiles, authenticateProfile, isAutoLoggingIn]);
  
  // Determine active profile - ONLY ONE can be active at a time
  // currentProfile comes from backend which guarantees single active profile
  const activeProfileId = currentProfile?.id || null;
  const isActive = (profile: ProfileInfo) => profile.id === activeProfileId;

  const handleProfileSelect = (profile: ProfileInfo) => {
    if (profile.is_locked) return;
    
    if (selectedProfileId === profile.id) {
      setSelectedProfileId(null);
    } else {
      setSelectedProfileId(profile.id);
    }
  };

  

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <AlphabetBackground letterCount={80} />
        <Card className="w-full max-w-md relative z-10">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-muted-foreground">Loading profiles...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

    return (
      <div className="h-screen w-full relative overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <AlphabetBackground letterCount={80} />
        <div className="min-h-full w-full flex flex-col items-center justify-center p-4 relative z-10">
          <div className="w-full max-w-5xl flex flex-col items-center">
            {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="mx-auto mb-4"
            >
              <Image 
                src="/logo.png" 
                alt="GameStringer" 
                width={180} 
                height={180} 
                className="drop-shadow-2xl mx-auto"
                priority
              />
            </motion.div>
            <p className="text-base text-slate-400">Select your profile to continue</p>
            
            {profiles.length > 0 && (
              <div className="mt-4">
                <Badge variant="outline" className="px-3 py-1 rounded-full bg-slate-800/50 border-slate-700 text-slate-300 backdrop-blur-sm text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                  {profiles.length} {profiles.length === 1 ? 'profile available' : 'profiles available'}
                </Badge>
              </div>
            )}
          </motion.div>

          {/* Error Alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 w-full max-w-md"
            >
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {/* Profiles Grid - Flex centered layout */}
          <div className="flex flex-wrap justify-center gap-6 w-full mb-12">
            <AnimatePresence mode="popLayout">
              {profiles.map((profile) => (
                <div key={profile.id} onClick={() => handleProfileSelect(profile)} className="w-full max-w-[350px] cursor-pointer">
                  <ProfileCard
                    profile={profile}
                    isSelected={selectedProfileId === profile.id}
                    isCurrentProfile={profile.id === activeProfileId}
                  />
                </div>
              ))}
            </AnimatePresence>
            
            {/* Create Profile Card Button (Inline if few profiles, otherwise below) */}
            {profiles.length === 0 && (
               <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={onCreateProfile}
                className="w-full max-w-[350px] cursor-pointer group"
              >
                 <div className="h-full min-h-[140px] rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500/50 bg-slate-900/30 hover:bg-slate-800/50 transition-all duration-300 flex flex-col items-center justify-center p-6 text-slate-400 hover:text-indigo-300">
                    <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-indigo-500/20 flex items-center justify-center mb-3 transition-colors">
                      <Plus className="w-6 h-6" />
                    </div>
                    <span className="font-medium">Create first profile</span>
                 </div>
               </motion.div>
            )}
          </div>

          {/* Create Profile Button (Bottom) */}
          {profiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                onClick={onCreateProfile}
                variant="ghost"
                className="text-slate-400 hover:text-white hover:bg-slate-800/50 px-6 py-6 h-auto rounded-xl border border-transparent hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">New Profile</div>
                    <div className="text-xs text-slate-500">Add another user</div>
                  </div>
                </div>
              </Button>
            </motion.div>
          )}

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="fixed bottom-6 text-center text-slate-600 text-xs"
          >
            <p>© 2024 GameStringer</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}