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
      className="h-full"
    >
      <div 
        className={`relative overflow-hidden rounded-2xl transition-all duration-300 h-full flex flex-col ${
        isSelected 
          ? 'ring-2 ring-violet-500 shadow-2xl shadow-violet-500/20 bg-slate-900/80 backdrop-blur-xl' 
          : 'hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-1 bg-slate-900/40 border border-slate-800 hover:border-violet-500/30 backdrop-blur-md'
        } ${profile.is_locked ? 'border-red-500/30 bg-red-950/30' : ''}`}
      >
        {/* Decorative gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-blue-500/5 opacity-0 ${isSelected ? 'opacity-100' : 'group-hover:opacity-100'} transition-opacity duration-500 pointer-events-none`} />

        <div className="p-5 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Avatar className="h-14 w-14 ring-2 ring-slate-950/50 shadow-lg">
                <AvatarImage src={avatarSrc || undefined} alt={profile.name} className="object-cover" />
                <AvatarFallback className={`bg-gradient-to-br ${getAvatarGradient(profile.avatar_path)} text-white font-bold text-lg`}>
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>
              {profile.is_locked && (
                <div className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-md">
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
                  {profile.failed_attempts} tentativi falliti
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
                    Profilo bloccato. Contatta l'amministratore.
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
                        placeholder="Inserisci la password"
                        className="pr-10 bg-slate-950/50 border-slate-700/50 focus:border-violet-500/50 focus:ring-violet-500/20 text-slate-100 placeholder:text-slate-600 transition-all h-10"
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
                        className="border-slate-600 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600 w-4 h-4 rounded"
                      />
                      <label
                        htmlFor={`remember-${profile.id}`}
                        className="text-xs text-slate-400 cursor-pointer select-none hover:text-slate-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ricorda password
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
                      className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-violet-900/20 h-10"
                    >
                      {isAuthenticating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <span className="text-sm">Accesso...</span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-medium">Accedi</span>
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
                          setShowDeleteConfirm(true);
                        }}
                        disabled={isAuthenticating || isDeleting}
                        className="border-slate-700 bg-slate-800/50 text-slate-400 hover:text-red-400 hover:bg-red-950/30 hover:border-red-900/50 w-10 h-10 shrink-0"
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
                      className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg space-y-3"
                    >
                      <p className="text-xs text-red-200/80 leading-relaxed">
                        Eliminare <strong>{profile.name}</strong>? Azione irreversibile.
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
                          className="flex-1 h-8 text-xs bg-red-600/80 hover:bg-red-500"
                        >
                          {isDeleting ? '...' : 'Conferma'}
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
      <div className="h-screen w-full relative overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <AlphabetBackground letterCount={80} />
        <div className="min-h-full w-full flex flex-col items-center justify-center p-4 relative z-10">
          <div className="w-full max-w-5xl flex flex-col items-center">
            {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl shadow-2xl flex items-center justify-center border border-white/10"
            >
              <User className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-blue-200 mb-3 tracking-tight">
              GameStringer
            </h1>
            <p className="text-lg text-slate-400 font-medium">Seleziona il tuo profilo per continuare</p>
            
            {profiles.length > 0 && (
              <div className="mt-6">
                <Badge variant="outline" className="px-4 py-1.5 rounded-full bg-slate-800/50 border-slate-700 text-slate-300 backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                  {profiles.length} {profiles.length === 1 ? 'profilo disponibile' : 'profili disponibili'}
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
                <div key={profile.id} onClick={() => handleProfileSelect(profile)} className="w-full max-w-[350px]">
                  <ProfileCard
                    profile={profile}
                    isSelected={selectedProfileId === profile.id}
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
                 <div className="h-full min-h-[140px] rounded-xl border-2 border-dashed border-slate-700 hover:border-violet-500/50 bg-slate-900/30 hover:bg-slate-800/50 transition-all duration-300 flex flex-col items-center justify-center p-6 text-slate-400 hover:text-violet-300">
                    <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-violet-500/20 flex items-center justify-center mb-3 transition-colors">
                      <Plus className="w-6 h-6" />
                    </div>
                    <span className="font-medium">Crea il primo profilo</span>
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
                    <div className="font-medium">Nuovo Profilo</div>
                    <div className="text-xs text-slate-500">Aggiungi un altro utente</div>
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