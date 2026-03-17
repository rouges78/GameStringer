'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Info, ExternalLink } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface GenericCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, password: string, twoFactorCode?: string) => Promise<void>;
  provider: string;
  isLoading?: boolean;
}

const providerInfo: Record<string, { title: string; description: string; helpText?: string; helpUrl?: string; helpLinkText?: string; resetUrl?: string; resetLinkText?: string }> = {
  gog: {
    title: 'GOG Galaxy',
    description: 'Accedi con le tue Credentials GOG',
    helpText: 'Usa le stesse Credentials che usi per accedere a GOG.com',
    helpUrl: 'https://login.gog.com/register',
    helpLinkText: 'Crea account o recupera password su GOG.com',
    resetUrl: 'https://login.gog.com/password/reset',
    resetLinkText: 'Password dimenticata?'
  },
  origin: {
    title: 'EA App / Origin',
    description: 'Accedi con il tuo account EA',
    helpText: 'Usa le Credentials del tuo account EA (ex Origin)',
    helpUrl: 'https://myaccount.ea.com/cp-ui/aboutme/index',
    helpLinkText: 'Gestisci il tuo account EA',
    resetUrl: 'https://signin.ea.com/p/juno/resetPassword',
    resetLinkText: 'Password dimenticata?'
  },
  battlenet: {
    title: 'Battle.net',
    description: 'Accedi con il tuo account Blizzard',
    helpText: 'Usa le Credentials del tuo account Battle.net',
    helpUrl: 'https://account.blizzard.com/overview',
    helpLinkText: 'Gestisci il tuo account Blizzard',
    resetUrl: 'https://account.blizzard.com/support/password-reset',
    resetLinkText: 'Password dimenticata?'
  },
  ubisoft: {
    title: 'Ubisoft Connect',
    description: 'Accedi con il tuo account Ubisoft',
    helpText: 'Usa le Credentials di Ubisoft Connect (ex Uplay)',
    helpUrl: 'https://account.ubisoft.com/en-US/login',
    helpLinkText: 'Gestisci il tuo account Ubisoft',
    resetUrl: 'https://account.ubisoft.com/en-US/security-settings',
    resetLinkText: 'Password dimenticata?'
  },
  itchio: {
    title: 'itch.io',
    description: 'Accedi con il tuo account itch.io',
    helpText: 'Usa email e password del tuo account itch.io',
    helpUrl: 'https://itch.io/user/settings/api-keys',
    helpLinkText: 'Ottieni la tua API Key su itch.io',
    resetUrl: 'https://itch.io/user/forgot-password',
    resetLinkText: 'Password dimenticata?'
  },
  rockstar: {
    title: 'Rockstar Games',
    description: 'Accedi con il tuo account Rockstar Social Club',
    helpText: 'Usa le Credentials del tuo account Rockstar Social Club',
    helpUrl: 'https://socialclub.rockstargames.com/settings',
    helpLinkText: 'Gestisci il tuo account Rockstar',
    resetUrl: 'https://signin.rockstargames.com/recover',
    resetLinkText: 'Password dimenticata?'
  },
  amazon: {
    title: 'Amazon Games',
    description: 'Accedi con il tuo account Amazon',
    helpText: 'Usa le Credentials del tuo account Amazon per accedere ai giochi Prime Gaming',
    helpUrl: 'https://gaming.amazon.com/home',
    helpLinkText: 'Apri Prime Gaming',
    resetUrl: 'https://www.amazon.com/ap/forgotpassword',
    resetLinkText: 'Password dimenticata?'
  }
};

export function GenericCredentialsModal({ isOpen, onClose, onSubmit, provider, isLoading = false }: GenericCredentialsModalProps) {
  const { t } = useTranslation();
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

          {(info.helpUrl || info.resetUrl) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {info.helpUrl && (
                <a
                  href={info.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  {info.helpLinkText || 'Gestisci account'}
                </a>
              )}
              {info.resetUrl && (
                <a
                  href={info.resetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 underline underline-offset-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  {info.resetLinkText || 'Password dimenticata?'}
                </a>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('genericCredentialsModalComp.email')}</Label>
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
              <Label htmlFor="password">{t('genericCredentialsModalComp.password')}</Label>
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



