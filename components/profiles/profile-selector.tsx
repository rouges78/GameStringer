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
import { useProfiles } from '@/hooks/use-profiles';
import { ProfileInfo } from '@/types/profiles';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { getAvatarGradient, getInitials } from '@/lib/avatar-utils';
import { AlphabetBackground } from '@/components/ui/alphabet-background';

interface ProfileSelectorProps {
  onCreateProfile: () => void;
}

interface ProfileCardProps {
  profile: ProfileInfo;
  isSelected: boolean;
}

function ProfileCard({ profile, isSelected }: ProfileCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  // Carica password salvata al mount
  useEffect(() => {
    const savedPassword = localStorage.getItem(`gs_pwd_${profile.id}`);
    if (savedPassword) {
      setPassword(atob(savedPassword)); // Decode base64
      setRememberPassword(true);
    }
  }, [profile.id]);
  
  const { authenticateProfile, deleteProfile, getProfileAvatar } = useProfiles();

  useEffect(() => {
    const loadAvatar = async () => {
      if (profile.avatar_path && !profile.avatar_path.startsWith('gradient-')) {
        const src = await getProfileAvatar(profile.id);
        if (src) {
          setAvatarSrc(src);
        }
      }
    };
    
    loadAvatar();
  }, [profile.avatar_path, profile.id, getProfileAvatar]);

  const handleAuthenticate = async () => {
    if (!password.trim()) {
      setAuthError('Inserisci la password');
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    const success = await authenticateProfile(profile.name, password);
    
    if (success) {
      console.log('✅ Login completato con successo per:', profile.name);
      // Salva o rimuovi password in base alla checkbox
      if (rememberPassword) {
        localStorage.setItem(`gs_pwd_${profile.id}`, btoa(password)); // Encode base64
      } else {
        localStorage.removeItem(`gs_pwd_${profile.id}`);
      }
      // 🔄 Nessuna chiamata a onSelect: la UI si aggiorna tramite lo stato globale
      // e l'evento "profile-auth-changed". ProtectedRoute rileverà isAuthenticated=true.
    } else {
      setAuthError('Password non corretta');
      setPassword('');
      // Rimuovi password salvata se errata
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
              <AvatarImage src={avatarSrc || undefined} alt={profile.name} />
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
                    
                    {/* Checkbox Ricordami */}
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox
                        id={`remember-${profile.id}`}
                        checked={rememberPassword}
                        onCheckedChange={(checked) => setRememberPassword(checked === true)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <label
                        htmlFor={`remember-${profile.id}`}
                        className="text-sm text-muted-foreground cursor-pointer select-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ricorda password
                      </label>
                    </div>
                  </div>

                  {authError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/40 rounded-xl p-4 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">🔐</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-red-300">Oops! Accesso negato</p>
                        <p className="text-sm text-red-200/70">{authError}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAuthError(null)}
                        className="text-red-300 hover:text-red-200 hover:bg-red-500/20"
                      >
                        ✕
                      </Button>
                    </motion.div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAuthenticate();
                      }}
                      disabled={isAuthenticating || !password.trim()}
                      className="flex-1"
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
                    
                    {!showDeleteConfirm ? (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(true);
                        }}
                        disabled={isAuthenticating || isDeleting}
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  
                  {/* Doppia conferma eliminazione */}
                  {showDeleteConfirm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg space-y-3"
                    >
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">Conferma eliminazione</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Inserisci la password e conferma per eliminare definitivamente il profilo "{profile.name}". 
                        Questa azione è irreversibile.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(false);
                            setAuthError(null);
                          }}
                          disabled={isDeleting}
                          className="flex-1"
                        >
                          Annulla
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProfile();
                          }}
                          disabled={isDeleting || !password.trim()}
                          className="flex-1"
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              Eliminazione...
                            </>
                          ) : (
                            <>
                              <Trash2 className="mr-2 h-3 w-3" />
                              Elimina Profilo
                            </>
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ProfileSelector({ onCreateProfile }: ProfileSelectorProps) {
  const { profiles, currentProfile, isLoading, error } = useProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  
  // Determina il profilo attivo - SOLO UNO può essere attivo alla volta
  // currentProfile viene dal backend che garantisce un solo profilo attivo
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
            <p className="text-muted-foreground">Caricamento profili...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <AlphabetBackground letterCount={80} />
      <div className="w-full max-w-4xl relative z-10">
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
          {profiles.length > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-400/30 rounded-lg">
              <Badge variant="secondary" className="bg-blue-500 text-white">
                {profiles.length}
              </Badge>
              <span className="text-sm text-blue-200">
                profil{profiles.length !== 1 ? 'i' : 'o'} disponibil{profiles.length !== 1 ? 'i' : 'e'}
              </span>
            </div>
          )}
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
            {/* Skip Auth (Testing) rimosso: usare NEXT_PUBLIC_SKIP_AUTH=true in sviluppo */}
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