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
import { useProfiles } from '@/hooks/use-profiles';
import { ProfileInfo } from '@/types/profiles';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { getAvatarGradient, getInitials } from '@/lib/avatar-utils';

interface ProfileSelectorProps {
  onProfileSelected: (profileId: string) => void;
  onCreateProfile: () => void;
}

interface ProfileCardProps {
  profile: ProfileInfo;
  onSelect: (profile: ProfileInfo) => void;
  isSelected: boolean;
}

function ProfileCard({ profile, onSelect, isSelected }: ProfileCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const { authenticateProfile, deleteProfile } = useProfiles();

  const handleAuthenticate = async () => {
    if (!password.trim()) {
      setAuthError('Inserisci la password');
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    const success = await authenticateProfile(profile.name, password);
    
    if (success) {
      // ✅ FIX: Chiamiamo onSelect SOLO dopo un piccolo delay per evitare conflitti di stato
      // Questo permette al sistema di aggiornare completamente lo stato prima del routing
      console.log('✅ Login completato, transizione fluida per:', profile.name);
      setTimeout(() => {
        onSelect(profile);
      }, 100);
    } else {
      setAuthError('Password non corretta');
      setPassword('');
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
      setAuthError('Inserisci la password per eliminare il profilo');
      return;
    }

    setIsDeleting(true);
    setAuthError(null);

    const success = await deleteProfile(profile.id, password);
    
    if (!success) {
      setAuthError('Password non corretta o errore eliminazione');
    }
    
    setIsDeleting(false);
    setShowDeleteConfirm(false);
    setPassword('');
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card className={`cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'ring-2 ring-primary shadow-lg' 
          : 'hover:shadow-md hover:border-primary/50'
      } ${profile.is_locked ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className={`bg-gradient-to-br ${getAvatarGradient(profile.avatar_path)} text-white font-semibold`}>
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <CardTitle className="text-lg truncate">{profile.name}</CardTitle>
                {profile.is_locked && (
                  <Badge variant="destructive" className="text-xs">
                    <Lock className="w-3 h-3 mr-1" />
                    Bloccato
                  </Badge>
                )}
                {profile.failed_attempts > 0 && !profile.is_locked && (
                  <Badge variant="outline" className="text-xs text-orange-600">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {profile.failed_attempts} tentativi
                  </Badge>
                )}
              </div>
              
              <CardDescription className="flex items-center space-x-1 text-sm">
                <Clock className="w-3 h-3" />
                <span>Ultimo accesso: {getLastAccessedText(profile.last_accessed)}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {isSelected && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <Separator />
              
              {profile.is_locked ? (
                <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Questo profilo è temporaneamente bloccato a causa di troppi tentativi di accesso falliti.
                    Riprova più tardi o contatta l'amministratore.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor={`password-${profile.id}`} className="text-sm font-medium">
                      Password profilo
                    </Label>
                    <div className="relative">
                      <Input
                        id={`password-${profile.id}`}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyPress={handleKeyPress}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Inserisci la password"
                        className="pr-10"
                        disabled={isAuthenticating}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
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
                  </div>

                  {authError && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{authError}</AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAuthenticate();
                    }}
                    disabled={isAuthenticating || !password.trim()}
                    className="w-full"
                  >
                    {isAuthenticating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Autenticazione...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Accedi al Profilo
                      </>
                    )}
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ProfileSelector({ onProfileSelected, onCreateProfile }: ProfileSelectorProps) {
  const { profiles, isLoading, error } = useProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const handleProfileSelect = (profile: ProfileInfo) => {
    if (profile.is_locked) return;
    
    if (selectedProfileId === profile.id) {
      setSelectedProfileId(null);
    } else {
      setSelectedProfileId(profile.id);
    }
  };

  const handleProfileAuthenticated = (profile: ProfileInfo) => {
    onProfileSelected(profile.id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-muted-foreground">Caricamento profili...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">GameStringer</h1>
          <p className="text-xl text-blue-200">Seleziona il tuo profilo per continuare</p>
        </motion.div>

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6"
          >
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Profiles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <AnimatePresence>
            {profiles.map((profile) => (
              <div key={profile.id} onClick={() => handleProfileSelect(profile)}>
                <ProfileCard
                  profile={profile}
                  onSelect={handleProfileAuthenticated}
                  isSelected={selectedProfileId === profile.id}
                />
              </div>
            ))}
          </AnimatePresence>
        </div>

        {/* Create Profile Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <div className="space-y-4">
            <Button
              onClick={onCreateProfile}
              variant="outline"
              size="lg"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30"
            >
              <Plus className="mr-2 h-5 w-5" />
              Crea Nuovo Profilo
            </Button>
            
            {/* Temporary Skip Button for Testing */}
            {profiles.length > 0 && (
              <div>
                <Button
                  onClick={() => {
                    // Simulate successful authentication for testing
                    onProfileSelected(profiles[0].id);
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white/80 text-xs"
                >
                  Skip Auth (Testing)
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8 text-blue-200/60 text-sm"
        >
          <p>© 2024 GameStringer - Sistema di Gestione Profili</p>
        </motion.div>
      </div>
    </div>
  );
}