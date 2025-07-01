'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Lock, Info, AlertCircle, Shield } from 'lucide-react';

interface GenericCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, password: string, twoFactorCode?: string) => Promise<void>;
  provider: string;
  isLoading?: boolean;
}

const providerInfo: Record<string, { title: string; description: string; helpText?: string }> = {
  gog: {
    title: 'GOG Galaxy',
    description: 'Accedi con le tue credenziali GOG',
    helpText: 'Usa le stesse credenziali che usi per accedere a GOG.com. Attenzione: GOG richiede l\'autenticazione a due fattori. Assicurati di avere abilitato l\'autenticazione a due fattori sul tuo account GOG prima di procedere.'
  },
  origin: {
    title: 'EA App / Origin',
    description: 'Accedi con il tuo account EA',
    helpText: 'Usa le credenziali del tuo account EA (ex Origin)'
  },
  battlenet: {
    title: 'Battle.net',
    description: 'Accedi con il tuo account Blizzard',
    helpText: 'Usa le credenziali del tuo account Battle.net'
  },
  ubisoft: {
    title: 'Ubisoft Connect',
    description: 'Accedi con il tuo account Ubisoft',
    helpText: 'Usa le credenziali di Ubisoft Connect (ex Uplay)'
  },
  itchio: {
    title: 'itch.io',
    description: 'Accedi con il tuo account itch.io',
    helpText: 'Usa email e password del tuo account itch.io'
  }
};

export function GenericCredentialsModal({ isOpen, onClose, onSubmit, provider, isLoading = false }: GenericCredentialsModalProps) {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const info = providerInfo[provider] || {
    title: provider,
    description: `Accedi con il tuo account ${provider}`
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!needs2FA) {
      // Prima fase: email e password
      if (!credentials.email.trim() || !credentials.password.trim()) {
        setError('Per favore, inserisci sia email che password.');
        return;
      }

      setError(null);
      
      // Per GOG, dopo aver inserito email/password, mostra il campo 2FA
      if (provider === 'gog') {
        setNeeds2FA(true);
        return;
      }
      
      // Per altri provider, procedi normalmente
      try {
        await onSubmit(credentials.email, credentials.password);
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore durante la connessione.');
      }
    } else {
      // Seconda fase: codice 2FA per GOG
      if (!twoFactorCode.trim()) {
        setError('Per favore, inserisci il codice 2FA.');
        return;
      }

      setError(null);
      try {
        await onSubmit(credentials.email, credentials.password, twoFactorCode);
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore durante la verifica del codice 2FA.');
      }
    }
  };



  const handleClose = () => {
    setCredentials({ email: '', password: '' });
    setError(null);
    setNeeds2FA(false);
    setTwoFactorCode('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Collega {info.title}</DialogTitle>
              <DialogDescription>{info.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {info.helpText && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{info.helpText}</AlertDescription>
            </Alert>
          )}

          {provider === 'gog' && !needs2FA && (
            <Alert className="border-blue-600 bg-blue-50 dark:bg-blue-950">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                <strong>Nota:</strong> GOG richiede l'autenticazione a due fattori. 
                Dopo aver inserito email e password, ti verrà richiesto il codice 2FA.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!needs2FA ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="La tua email"
                    value={credentials.email}
                    onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && document.getElementById('password')?.focus()}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="La tua password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>
              </>
            ) : (
              <>
                <Alert className="border-green-600 bg-green-50 dark:bg-green-950">
                  <Shield className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    <strong>Verifica 2FA richiesta</strong><br />
                    Inserisci il codice di verifica che hai ricevuto via email o SMS.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="twoFactorCode">Codice di verifica</Label>
                  <Input
                    id="twoFactorCode"
                    type="text"
                    placeholder="Inserisci il codice 2FA"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                    maxLength={6}
                    className="text-center text-lg font-mono"
                  />
                  <p className="text-sm text-muted-foreground">
                    Il codice è composto da 6 cifre
                  </p>
                </div>
              </>
            )}

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={isLoading || (!needs2FA ? (!credentials.email.trim() || !credentials.password.trim()) : !twoFactorCode.trim())}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {needs2FA ? 'Verifica Codice' : 'Collega Account'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
