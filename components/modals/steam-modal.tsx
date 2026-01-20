'use client';

import { useState } from 'react';
import { X, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SteamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (apiKey: string, steamId: string) => Promise<void>;
  isLoading?: boolean;
}

export function SteamModal({ isOpen, onClose, onSubmit, isLoading }: SteamModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validazione API Key
    if (!apiKey || apiKey.length !== 32) {
      setError('API Key must be 32 characters');
      return;
    }

    if (!/^[A-Fa-f0-9]{32}$/.test(apiKey)) {
      setError('Invalid API Key. Must contain only hexadecimal characters');
      return;
    }

    // SECURITY FIX: Enhanced Steam ID64 validation
    if (!steamId || steamId.length !== 17) {
      setError('SteamID must be a 17-digit number');
      return;
    }

    // Validate Steam ID64 format (must start with 76561198)
    if (!/^76561198\d{9}$/.test(steamId)) {
      setError('Invalid SteamID. Must start with 76561198 followed by 9 digits');
      return;
    }

    // Additional validation: check if it's in valid Steam ID64 range
    const numericSteamId = BigInt(steamId);
    const minSteamId = BigInt('76561198000000000');
    const maxSteamId = BigInt('76561198999999999');
    
    if (numericSteamId < minSteamId || numericSteamId > maxSteamId) {
      setError('SteamID out of valid range');
      return;
    }

    try {
      await onSubmit(apiKey, steamId);
      setApiKey('');
      setSteamId('');
      onClose();
    } catch (err) {
      setError('Error connecting to Steam');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          disabled={isLoading}
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-bold mb-2">Connect Steam Account</h2>
        <p className="text-muted-foreground mb-6">
          Enter your API Key and SteamID64 to connect your Steam account and access your game library.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apikey">Steam API Key</Label>
            <Input
              id="apikey"
              type="text"
              placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isLoading}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              La tua chiave API Steam di 32 caratteri esadecimali.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="steamid">SteamID64</Label>
            <Input
              id="steamid"
              type="text"
              placeholder="76561198000000000"
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              disabled={isLoading}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Il tuo SteamID64 è un numero univoco di 17 cifre che identifica il tuo account Steam.
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="bg-muted/50 rounded-md p-4 space-y-3">
            <div>
              <p className="text-sm font-medium">How to get your Steam API Key:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Visit <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">steamcommunity.com/dev/apikey</a></li>
                <li>Log in with your Steam account</li>
                <li>Enter a domain name (e.g. localhost)</li>
                <li>Copy the generated API key</li>
              </ol>
            </div>
            
            <div>
              <p className="text-sm font-medium">How to find your SteamID64:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Open Steam and go to your profile</li>
                <li>Copy your profile URL</li>
                <li>Visit one of these sites to convert it:</li>
              </ol>
              <div className="flex gap-2 mt-2">
                <a
                  href="https://steamid.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm flex items-center gap-1"
                >
                  SteamID.io <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-muted-foreground">•</span>
                <a
                  href="https://steamidfinder.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm flex items-center gap-1"
                >
                  SteamID Finder <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !apiKey || !steamId}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect Steam
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
