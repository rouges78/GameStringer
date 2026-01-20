'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Info } from 'lucide-react';

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
    description: 'Accedi con le tue Credentials GOG',
    helpText: 'Usa le stesse Credentials che usi per accedere a GOG.com'
  },
  origin: {
    title: 'EA App / Origin',
    description: 'Accedi con il tuo account EA',
    helpText: 'Usa le Credentials del tuo account EA (ex Origin)'
  },
  battlenet: {
    title: 'Battle.net',
    description: 'Accedi con il tuo account Blizzard',
    helpText: 'Usa le Credentials del tuo account Battle.net'
  },
  ubisoft: {
    title: 'Ubisoft Connect',
    description: 'Accedi con il tuo account Ubisoft',
    helpText: 'Usa le Credentials di Ubisoft Connect (ex Uplay)'
  },
  itchio: {
    title: 'itch.io',
    description: 'Accedi con il tuo account itch.io',
    helpText: 'Usa email e password del tuo account itch.io'
  },
  rockstar: {
    title: 'Rockstar Games',
    description: 'Accedi con il tuo account Rockstar Social Club',
    helpText: 'Usa le Credentials del tuo account Rockstar Social Club per accedere ai games come GTA V e Red Dead Redemption 2'
  }
};

export function GenericCredentialsModal({ isOpen, onClose, onSubmit, provider, isLoading = false }: GenericCredentialsModalProps) {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);

  const info = providerInfo[provider] || {
    title: provider,
    description: `Accedi con il tuo account ${provider}`
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Validazione Credentials
    if (!credentials.email.trim() || !credentials.password.trim()) {
      setError('Per favore, inserisci sia email che password.');
      return;
    }

    setError(null);
    
    // Procedi con la connection per tutti i provider
    try {
      await onSubmit(credentials.email, credentials.password);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error.');
    }
  };



  const handleClose = () => {
    setCredentials({ email: '', password: '' });
    setError(null);
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


          <form onSubmit={handleSubmit} className="space-y-4">
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
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !credentials.email.trim() || !credentials.password.trim()}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect Account
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}



