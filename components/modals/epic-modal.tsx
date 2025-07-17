'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, Eye, EyeOff, AlertTriangle, Download, Terminal, CheckCircle } from 'lucide-react';
import { invoke } from '@/lib/tauri-api';
import { toast } from 'sonner';

interface EpicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (username: string, password: string) => void;
  isLoading: boolean;
}

export function EpicModal({ isOpen, onClose, onSubmit, isLoading }: EpicModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Stati per Legendary
  const [legendaryStatus, setLegendaryStatus] = useState<any>(null);
  const [legendaryLoading, setLegendaryLoading] = useState(false);
  const [installLegendaryLoading, setInstallLegendaryLoading] = useState(false);
  const [authLegendaryLoading, setAuthLegendaryLoading] = useState(false);

  // Controlla stato Legendary all'apertura del modal
  useEffect(() => {
    if (isOpen) {
      checkLegendaryStatus();
    }
  }, [isOpen]);

  const checkLegendaryStatus = async () => {
    try {
      const status = await invoke('check_legendary_status');
      setLegendaryStatus(status);
    } catch (error) {
      console.error('Errore controllo Legendary:', error);
      setLegendaryStatus({ installed: false, authenticated: false });
    }
  };

  const handleInstallLegendary = async () => {
    setInstallLegendaryLoading(true);
    try {
      toast.info('🔧 Installazione Legendary in corso...');
      const result = await invoke('install_legendary');
      
      if (result.success) {
        toast.success('✅ Legendary installato con successo!');
        await checkLegendaryStatus(); // Ricontrolla lo stato
      } else {
        toast.error(`❌ Errore installazione: ${result.error}`);
      }
    } catch (error) {
      console.error('Errore installazione Legendary:', error);
      toast.error('❌ Errore durante l\'installazione di Legendary');
    } finally {
      setInstallLegendaryLoading(false);
    }
  };

  const handleAuthenticateLegendary = async () => {
    setAuthLegendaryLoading(true);
    try {
      toast.info('🔐 Avvio autenticazione Legendary...');
      const result = await invoke('authenticate_legendary');
      
      if (result.success) {
        toast.success('✅ Legendary autenticato con successo!');
        await checkLegendaryStatus(); // Ricontrolla lo stato
      } else {
        toast.error(`❌ Errore autenticazione: ${result.error}`);
      }
    } catch (error) {
      console.error('Errore autenticazione Legendary:', error);
      toast.error('❌ Errore durante l\'autenticazione Legendary');
    } finally {
      setAuthLegendaryLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!username.trim()) {
      newErrors.username = 'Email/username Epic Games richiesto';
    } else if (!username.includes('@') && username.length < 3) {
      newErrors.username = 'Inserisci un email valido o username Epic Games';
    }

    if (!password.trim()) {
      newErrors.password = 'Password richiesta';
    } else if (password.length < 6) {
      newErrors.password = 'Password deve essere di almeno 6 caratteri';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    onSubmit(username, password);
  };

  const handleClose = () => {
    setUsername('');
    setPassword('');
    setErrors({});
    setShowPassword(false);
    // Reset Legendary states
    setLegendaryStatus(null);
    setLegendaryLoading(false);
    setInstallLegendaryLoading(false);
    setAuthLegendaryLoading(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            Connetti Epic Games Store
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Inserisci le tue credenziali Epic Games per accedere alla tua libreria
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Legendary Status Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-300 border-b border-gray-700 pb-1">
              🛠️ Installazione Automatica Legendary
            </h3>
            
            {legendaryStatus && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`flex items-center gap-2 p-2 rounded ${
                  legendaryStatus.installed ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                }`}>
                  {legendaryStatus.installed ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  {legendaryStatus.installed ? 'Installato' : 'Non installato'}
                </div>
                
                <div className={`flex items-center gap-2 p-2 rounded ${
                  legendaryStatus.authenticated ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'
                }`}>
                  {legendaryStatus.authenticated ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <Terminal className="h-3 w-3" />
                  )}
                  {legendaryStatus.authenticated ? 'Autenticato' : 'Non autenticato'}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {!legendaryStatus?.installed && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleInstallLegendary}
                  disabled={installLegendaryLoading}
                  className="flex-1 border-blue-600 text-blue-400 hover:bg-blue-900/20"
                >
                  {installLegendaryLoading ? (
                    <>
                      <Download className="h-3 w-3 mr-1 animate-spin" />
                      Installando...
                    </>
                  ) : (
                    <>
                      <Download className="h-3 w-3 mr-1" />
                      Installa Legendary
                    </>
                  )}
                </Button>
              )}
              
              {legendaryStatus?.installed && !legendaryStatus?.authenticated && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAuthenticateLegendary}
                  disabled={authLegendaryLoading}
                  className="flex-1 border-purple-600 text-purple-400 hover:bg-purple-900/20"
                >
                  {authLegendaryLoading ? (
                    <>
                      <Terminal className="h-3 w-3 mr-1 animate-spin" />
                      Autenticando...
                    </>
                  ) : (
                    <>
                      <Terminal className="h-3 w-3 mr-1" />
                      Autentica
                    </>
                  )}
                </Button>
              )}
            </div>

            {legendaryStatus?.installed && legendaryStatus?.authenticated && (
              <Alert className="border-green-600 bg-green-900/20">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-200 text-sm">
                  ✅ Legendary è installato e autenticato! Puoi ora accedere ai tuoi giochi Epic Games.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700 my-4"></div>

          {/* Warning Alert */}
          <Alert className="border-yellow-600 bg-yellow-900/20">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-200 text-sm">
              <strong>Sicurezza:</strong> Le credenziali vengono crittografate con AES-256 e salvate localmente.
              GameStringer non invia mai le tue credenziali a server esterni.
            </AlertDescription>
          </Alert>

          {/* Username/Email Field */}
          <div className="space-y-2">
            <Label htmlFor="epic-username" className="text-gray-300">
              Email o Username Epic Games
            </Label>
            <Input
              id="epic-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="esempio@email.com o username"
              className={`bg-gray-800 border-gray-600 text-white placeholder-gray-400 ${
                errors.username ? 'border-red-500' : 'focus:border-blue-500'
              }`}
              disabled={isLoading}
            />
            {errors.username && (
              <p className="text-red-400 text-sm">{errors.username}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="epic-password" className="text-gray-300">
              Password Epic Games
            </Label>
            <div className="relative">
              <Input
                id="epic-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password del tuo account Epic Games"
                className={`bg-gray-800 border-gray-600 text-white placeholder-gray-400 pr-10 ${
                  errors.password ? 'border-red-500' : 'focus:border-blue-500'
                }`}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-gray-700"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            </div>
            {errors.password && (
              <p className="text-red-400 text-sm">{errors.password}</p>
            )}
          </div>

          {/* Help Text */}
          <div className="text-sm text-gray-400 space-y-1">
            <p>• <strong>Metodo 1:</strong> Usa Legendary (raccomandato) - installa automaticamente</p>
            <p>• <strong>Metodo 2:</strong> Usa credenziali Epic Games dirette</p>
            <p>• Se hai 2FA attivo, inserisci il codice quando richiesto</p>
            <p>• Le credenziali vengono salvate in modo sicuro localmente</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !username.trim() || !password.trim()}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              {isLoading ? 'Connessione...' : 'Connetti Epic Games'}
            </Button>
          </div>

          {/* Epic Games Link */}
          <div className="text-center pt-2">
            <a
              href="https://www.epicgames.com/id/login"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm inline-flex items-center gap-1"
            >
              Non hai un account Epic Games?
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}