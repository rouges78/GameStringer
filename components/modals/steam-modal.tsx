'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, ExternalLink, CheckCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { invoke } from '@/lib/tauri-api';
import Image from 'next/image';

interface SteamUser {
  steam_id: string;
  persona_name: string;
  avatar: string;
  avatar_full: string;
  profile_url: string;
}

interface SteamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (steamId: string) => Promise<void>;
  isLoading?: boolean;
}

export function SteamModal({ isOpen, onClose, onSubmit, isLoading }: SteamModalProps) {
  const [error, setError] = useState('');
  const [authStep, setAuthStep] = useState<'idle' | 'waiting' | 'success'>('idle');
  const [verifying, setVerifying] = useState(false);
  const [steamUser, setSteamUser] = useState<SteamUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loadingWishlist, setLoadingWishlist] = useState(false);

  // Check if already authenticated on mount
  useEffect(() => {
    if (isOpen) {
      checkExistingAuth();
    }
  }, [isOpen]);

  const checkExistingAuth = async () => {
    setCheckingAuth(true);
    try {
      const existing = await invoke<SteamUser | null>('steam_load_auth');
      if (existing) {
        // Try to get full profile with avatar using API key from settings
        let fullProfile = existing;
        try {
          const settingsStr = localStorage.getItem('gameStringerSettings');
          if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            const steamApiKey = settings?.integrations?.steamApiKey;
            if (steamApiKey) {
              fullProfile = await invoke<SteamUser>('steam_get_user_profile', {
                steamId: existing.steam_id,
                apiKey: steamApiKey
              });
            }
          }
        } catch (e) {
          console.log('Could not load full profile with avatar');
        }
        setSteamUser(fullProfile);
        setAuthStep('success');
      }
    } catch (e) {
      console.log('No existing Steam auth');
    }
    setCheckingAuth(false);
  };

  if (!isOpen) return null;

  const handleSteamLogin = async () => {
    setError('');
    setAuthStep('waiting');

    try {
      // Start local callback server and get auth URL
      const [authUrl, port] = await invoke<[string, number]>('steam_openid_start_server');
      
      // Open in system browser
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(authUrl);
      
      // Wait for callback (120s timeout)
      const steamId = await invoke<string>('steam_openid_wait_callback', { timeoutSecs: 120 });
      
      // Get API key from settings for full profile
      let apiKey: string | null = null;
      try {
        const settingsStr = localStorage.getItem('gameStringerSettings');
        if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          apiKey = settings?.integrations?.steamApiKey || null;
        }
      } catch (e) {
        console.warn('[STEAM] Errore parsing impostazioni Steam:', e);
      }
      
      // Get user profile
      const profile = await invoke<SteamUser>('steam_get_user_profile', { steamId, apiKey });
      
      // Save auth
      await invoke('steam_save_auth', { 
        steamId: profile.steam_id,
        personaName: profile.persona_name 
      });
      
      setSteamUser(profile);
      setAuthStep('success');
      
      // Notify parent
      await onSubmit(steamId);
      
    } catch (err: any) {
      setError(err?.message || 'Errore durante il login Steam');
      setAuthStep('idle');
    }
  };

  const handleManualCallback = async () => {
    const callbackUrl = prompt('Incolla qui l\'URL completo dopo il login Steam:');
    if (!callbackUrl) return;

    setVerifying(true);
    setError('');

    try {
      // Parse URL params
      const url = new URL(callbackUrl);
      const params: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      // Verify with backend
      const steamId = await invoke<string>('steam_openid_verify', { params });
      
      // Try to get API key from settings for full profile with avatar
      let apiKey: string | null = null;
      try {
        const settingsStr = localStorage.getItem('gameStringerSettings');
        if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          apiKey = settings?.integrations?.steamApiKey || null;
        }
      } catch (e) {
        console.warn('[STEAM] Errore parsing impostazioni Steam:', e);
      }
      
      // Get user profile
      const profile = await invoke<SteamUser>('steam_get_user_profile', { 
        steamId,
        apiKey 
      });
      
      // Save auth
      await invoke('steam_save_auth', { 
        steamId: profile.steam_id,
        personaName: profile.persona_name 
      });
      
      setSteamUser(profile);
      setAuthStep('success');
      
      // Call parent callback
      await onSubmit(steamId);
      
    } catch (err: any) {
      setError(err?.message || 'Verifica fallita');
      setVerifying(false);
    }
  };

  const handleConfirmConnection = async () => {
    if (steamUser) {
      try {
        await onSubmit(steamUser.steam_id);
        onClose();
      } catch (err: any) {
        setError(err?.message || 'Errore durante la connessione');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await invoke('steam_logout');
      setSteamUser(null);
      setWishlist([]);
      setAuthStep('idle');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const handleImportWishlist = async () => {
    if (!steamUser) return;
    setLoadingWishlist(true);
    try {
      const list = await invoke<any[]>('steam_get_wishlist', { steamId: steamUser.steam_id });
      setWishlist(list);
    } catch (e: any) {
      setError(e?.message || 'Errore importazione wishlist');
    }
    setLoadingWishlist(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          disabled={isLoading}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-[#1b2838] rounded-lg flex items-center justify-center">
            <img src="/logos/steam.png" alt="Steam" className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Connetti Steam</h2>
            <p className="text-sm text-muted-foreground">Accedi con il tuo account Steam</p>
          </div>
        </div>

        {checkingAuth ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : authStep === 'success' && steamUser ? (
          /* Success State */
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium text-green-600">Account Steam collegato!</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              {steamUser.avatar_full ? (
                <img 
                  src={steamUser.avatar_full} 
                  alt={steamUser.persona_name}
                  className="w-16 h-16 rounded-lg"
                />
              ) : (
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-bold text-lg">{steamUser.persona_name}</p>
                <p className="text-sm text-muted-foreground font-mono">{steamUser.steam_id}</p>
                {steamUser.profile_url && (
                  <a 
                    href={steamUser.profile_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
                  >
                    Profilo Steam <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <Button 
                variant="outline" 
                className="w-full mb-2"
                onClick={handleImportWishlist}
                disabled={loadingWishlist}
              >
                {loadingWishlist ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</>
                ) : (
                  <>📋 Importa Wishlist ({wishlist.length > 0 ? `${wishlist.length} giochi` : 'clicca per caricare'})</>
                )}
              </Button>
              
              {wishlist.length > 0 && (
                <div className="max-h-32 overflow-y-auto bg-muted/30 rounded p-2 mb-2 text-xs">
                  {wishlist.slice(0, 10).map((g: any) => (
                    <div key={g.app_id} className="truncate py-0.5">{g.name}</div>
                  ))}
                  {wishlist.length > 10 && (
                    <div className="text-muted-foreground">...e altri {wishlist.length - 10}</div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleLogout}>
                Disconnetti
              </Button>
              <Button className="flex-1" onClick={handleConfirmConnection} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Conferma
              </Button>
            </div>
          </div>
        ) : authStep === 'waiting' ? (
          /* Waiting for callback */
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span className="font-medium">In attesa del login Steam...</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Completa il login nel browser. La connessione avverrà automaticamente.
              </p>
            </div>

            <Button variant="outline" className="w-full" onClick={() => setAuthStep('idle')}>
              Annulla
            </Button>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        ) : (
          /* Initial State */
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Clicca il pulsante qui sotto per accedere con il tuo account Steam. 
              Verrai reindirizzato al sito ufficiale di Steam per l'autenticazione sicura.
            </p>

            <Button 
              className="w-full bg-[#1b2838] hover:bg-[#2a475e] text-white"
              size="lg"
              onClick={handleSteamLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <img src="/logos/steam.png" alt="" className="mr-2 h-5 w-5" />
              )}
              Accedi con Steam
            </Button>

            <div className="text-xs text-muted-foreground text-center">
              <p>Utilizziamo Steam OpenID per un'autenticazione sicura.</p>
              <p>Non memorizziamo mai la tua password Steam.</p>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="border-t pt-4 mt-4">
              <Button variant="outline" className="w-full" onClick={onClose}>
                Annulla
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



