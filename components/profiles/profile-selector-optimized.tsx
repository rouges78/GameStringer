'use client';

import { useState, useEffect } from 'react';
import { useProfilesOptimized } from '@/hooks/use-profiles-optimized';
import { useValidation } from '@/hooks/use-validation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CreateProfileDialog } from './create-profile-dialog';
import { getInitials } from '@/lib/utils';
import { AlertCircle, Zap, Clock, CheckCircle } from 'lucide-react';

export function ProfileSelectorOptimized() {
  const {
    profiles,
    isLoading,
    isPreloading,
    error,
    login,
    getPreloadedProfiles,
    isProfileReady,
    priorityLoadProfile,
    getCacheStats
  } = useProfilesOptimized();
  
  const { sanitizeInput } = useValidation();
  
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Ottieni profili preloaded per rendering veloce
  const preloadedProfiles = getPreloadedProfiles();

  useEffect(() => {
    // Auto-seleziona il primo profilo se disponibile
    if (profiles.length > 0 && !selectedProfile) {
      const mostRecent = profiles.sort((a, b) => b.lastAccess - a.lastAccess)[0];
      setSelectedProfile(mostRecent);
    }
  }, [profiles, selectedProfile]);

  const handleLogin = async () => {
    if (!selectedProfile) return;
    if (!password.trim()) {
      setLoginError('Inserisci la password');
      return;
    }
    
    setLoginError('');
    setIsLoggingIn(true);
    
    try {
      // Priority load se non già pronto
      if (!isProfileReady(selectedProfile.id)) {
        await priorityLoadProfile(selectedProfile.id);
      }
      
      await login(selectedProfile.id, password);
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.message?.includes('TooManyAttempts')) {
        setLoginError('Troppi tentativi falliti. Riprova più tardi.');
      } else if (error.message?.includes('InvalidCredentials')) {
        setLoginError('Password non valida');
      } else {
        setLoginError('Errore durante il login');
      }
      
      toast.error('Accesso fallito');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleProfileSelect = async (profile: any) => {
    setSelectedProfile(profile);
    setPassword('');
    setLoginError('');
    
    // Avvia priority load in background
    if (!isProfileReady(profile.id)) {
      priorityLoadProfile(profile.id);
    }
  };

  const renderProfileCard = (profile: any) => {
    const isReady = isProfileReady(profile.id);
    const preloaded = preloadedProfiles.find(p => p.id === profile.id);
    
    return (
      <Card 
        key={profile.id}
        className={`cursor-pointer transition-all hover:shadow-md ${
          selectedProfile?.id === profile.id ? 'ring-2 ring-primary' : ''
        }`}
        onClick={() => handleProfileSelect(profile)}
      >
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile.avatar} alt={profile.name} />
              <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{profile.name}</h3>
                
                {/* Indicatori stato */}
                {isReady && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Pronto
                  </Badge>
                )}
                
                {preloaded && !isReady && (
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                    <Clock className="h-3 w-3 mr-1" />
                    Caricamento
                  </Badge>
                )}
                
                {profile.hasCredentials && (
                  <Badge variant="outline" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    Credenziali
                  </Badge>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground">
                Ultimo accesso: {
                  profile.lastAccess 
                    ? new Date(profile.lastAccess).toLocaleDateString()
                    : 'Mai'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading && profiles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && profiles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Errore</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => window.location.reload()} className="w-full">
              Riprova
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Benvenuto</CardTitle>
            <CardDescription>
              Nessun profilo trovato. Crea il tuo primo profilo per iniziare.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => setShowCreateDialog(true)} className="w-full">
              Crea Primo Profilo
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header con statistiche performance */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Seleziona Profilo</h1>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            {isPreloading && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 animate-spin" />
                Ottimizzazione in corso...
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStats(!showStats)}
              className="text-xs"
            >
              {showStats ? 'Nascondi' : 'Mostra'} Statistiche
            </Button>
          </div>
          
          {showStats && (
            <Card className="p-3 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Cache:</strong> {getCacheStats().cache.profileCount} profili
                </div>
                <div>
                  <strong>Preloaded:</strong> {getCacheStats().preloader.readyProfiles} pronti
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Lista profili */}
        <div className="grid gap-3">
          {profiles.map(renderProfileCard)}
        </div>

        {/* Form login */}
        {selectedProfile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={selectedProfile.avatar} alt={selectedProfile.name} />
                  <AvatarFallback className="text-xs">
                    {getInitials(selectedProfile.name)}
                  </AvatarFallback>
                </Avatar>
                Accedi come {selectedProfile.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Inserisci password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setLoginError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className={loginError ? "border-red-500" : ""}
                  autoComplete="current-password"
                />
                
                {loginError && (
                  <Alert variant="destructive" className="py-2 mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="ml-2 text-xs">
                      {loginError}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button 
                onClick={handleLogin} 
                disabled={isLoggingIn || !password.trim()}
                className="flex-1"
              >
                {isLoggingIn ? 'Accesso...' : 'Accedi'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowCreateDialog(true)}
              >
                Nuovo Profilo
              </Button>
            </CardFooter>
          </Card>
        )}

        <CreateProfileDialog 
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
        />
      </div>
    </div>
  );
}