'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
// Input and Label imports removed — not currently used
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, AlertTriangle, Download, Terminal, CheckCircle } from 'lucide-react';
import { invoke } from '@/lib/tauri-api';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';

interface EpicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (username: string, password: string) => void;
  isLoading: boolean;
}

export function EpicModal({ isOpen, onClose, onSubmit, isLoading: _isLoading }: EpicModalProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [_showPassword, setShowPassword] = useState(false);
  const [_errors, setErrors] = useState<Record<string, string>>({});
  
  // Stati per Legendary
  const [legendaryStatus, setLegendaryStatus] = useState<{ installed: boolean; authenticated: boolean } | null>(null);
  const [_legendaryLoading, setLegendaryLoading] = useState(false);
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
      const status = await invoke<{ installed: boolean; authenticated: boolean }>('check_legendary_status');
      setLegendaryStatus(status);
    } catch (error: unknown) {
      clientLogger.error('Legendary check error: ' + String(error));
      setLegendaryStatus({ installed: false, authenticated: false });
    }
  };

  const handleInstallLegendary = async () => {
    setInstallLegendaryLoading(true);
    try {
      toast.info('🔧 Installing Legendary...');
      const result = await invoke<{ success: boolean; error?: string }>('install_legendary');

      if (result.success) {
        toast.success('✅ Legendary installed successfully!');
        await checkLegendaryStatus(); // Ricontrolla lo stato
      } else {
        toast.error(`❌ Installation error: ${result.error}`);
      }
    } catch (error: unknown) {
      clientLogger.error('Legendary installation error: ' + String(error));
      toast.error('❌ Error installing Legendary');
    } finally {
      setInstallLegendaryLoading(false);
    }
  };

  const handleAuthenticateLegendary = async () => {
    setAuthLegendaryLoading(true);
    try {
      toast.info('🔐 Starting Legendary authentication...');
      const result = await invoke<{ success: boolean; error?: string }>('authenticate_legendary');

      if (result.success) {
        toast.success('✅ Legendary authenticated successfully!');
        await checkLegendaryStatus(); // Ricontrolla lo stato
      } else {
        toast.error(`❌ Authentication error: ${result.error}`);
      }
    } catch (error: unknown) {
      clientLogger.error('Legendary authentication error: ' + String(error));
      toast.error('❌ Error during Legendary authentication');
    } finally {
      setAuthLegendaryLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!username.trim()) {
      newErrors.username = 'Epic Games email/username required';
    } else if (!username.includes('@') && username.length < 3) {
      newErrors.username = 'Enter a valid email or Epic Games username';
    }

    if (!password.trim()) {
      newErrors.password = 'Password required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const _handleSubmit = (e: React.FormEvent) => {
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
            Connect Epic Games Store
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Enter your Epic Games credentials to access your library
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Banner */}
          <Alert className="border-blue-600 bg-blue-900/20">
            <AlertTriangle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-200 text-sm">
              Epic Games doesn&apos;t offer public APIs. Use <strong>{t('epicModalComp.legendary')}</strong> to access your library.
            </AlertDescription>
          </Alert>

          {/* Legendary Status */}
          {legendaryStatus && (
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">{t('epicModalComp.legendaryStatus')}</span>
                <div className="flex gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    legendaryStatus.installed 
                      ? 'bg-green-900/50 text-green-400' 
                      : 'bg-red-900/50 text-red-400'
                  }`}>
                    {legendaryStatus.installed ? '✓ Installed' : '✗ Not installed'}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    legendaryStatus.authenticated 
                      ? 'bg-green-900/50 text-green-400' 
                      : 'bg-yellow-900/50 text-yellow-400'
                  }`}>
                    {legendaryStatus.authenticated ? '✓ Authenticated' : '○ Not authenticated'}
                  </span>
                </div>
              </div>

              {/* Action Button based on status */}
              {!legendaryStatus.installed ? (
                <Button
                  type="button"
                  onClick={handleInstallLegendary}
                  disabled={installLegendaryLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {installLegendaryLoading ? (
                    <>
                      <Download className="h-4 w-4 mr-2 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Install Legendary
                    </>
                  )}
                </Button>
              ) : !legendaryStatus.authenticated ? (
                <Button
                  type="button"
                  onClick={handleAuthenticateLegendary}
                  disabled={authLegendaryLoading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {authLegendaryLoading ? (
                    <>
                      <Terminal className="h-4 w-4 mr-2 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Authenticate with Epic Games
                    </>
                  )}
                </Button>
              ) : (
                <Alert className="border-green-600 bg-green-900/20">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-200 text-sm">
                    Connected! Your Epic Games are now available in the Library.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Loading state */}
          {!legendaryStatus && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              <span className="ml-3 text-gray-400">{t('epicModalComp.checkingStatus')}</span>
            </div>
          )}

          {/* Help Text */}
          <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-700">
            <p><strong>{t('epicModalComp.whatIsLegendary')}</strong></p>
            <p>Legendary is an open-source client that allows you to access the Epic Games library without the official launcher.</p>
            <p className="pt-1">• Safe and open-source</p>
            <p>• Doesn&apos;t require Epic Games launcher</p>
            <p>• Supports 2FA</p>
          </div>

          {/* Close Button */}
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


