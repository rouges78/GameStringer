'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Key, Info, ExternalLink } from 'lucide-react';

interface ItchioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (apiKey: string) => Promise<void>;
  isLoading?: boolean;
}

export function ItchioModal({ isOpen, onClose, onSubmit, isLoading = false }: ItchioModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!apiKey.trim()) {
      setError('Per favore, inserisci una chiave API valida.');
      return;
    }

    setError('');
    try {
      await onSubmit(apiKey);
      setApiKey('');
      onClose();
    } catch (err) {
      setError('Errore durante la connessione. Verifica la chiave API.');
    }
  };

  const handleClose = () => {
    setApiKey('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Collega Account itch.io</DialogTitle>
              <DialogDescription>
                Inserisci la tua chiave API per accedere alla tua libreria di giochi
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <p className="mb-2">Per ottenere la tua chiave API:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Vai su <a href="https://itch.io/user/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  itch.io/user/settings/api-keys
                  <ExternalLink className="h-3 w-3" />
                </a></li>
                <li>Clicca su "Generate new API key"</li>
                <li>Dai un nome alla chiave (es. "GameStringer")</li>
                <li>Copia la chiave generata</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="api-key">Chiave API</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Inserisci la tua chiave API di itch.io"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              disabled={isLoading}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !apiKey.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connessione in corso...
              </>
            ) : (
              'Collega Account'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
