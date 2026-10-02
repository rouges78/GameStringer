'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Shield,
  Key,
  Eye,
  EyeOff,
  Check,
  X,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';
import { safeInvoke as invoke } from '@/lib/tauri-wrapper';
import { ProfileResponse } from '@/types/profiles';

interface SecurityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  profileName: string;
}

export function SecurityDialog({ open, onOpenChange, profileId, profileName }: SecurityDialogProps) {
  const { t } = useTranslation();

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Le schede Sessioni, 2FA e Attività erano simulate (2FA con codice demo,
  // log di accesso inventato, "disconnetti tutte le sessioni" solo un toast) e
  // sono state rimosse. Puliamo quello che avevano scritto in localStorage,
  // compresa la "nuova password" lasciata in base64 dal vecchio cambio finto.
  useEffect(() => {
    if (open && profileId) {
      try {
        localStorage.removeItem(`security_${profileId}`);
        localStorage.removeItem(`activity_${profileId}`);
        localStorage.removeItem(`password_${profileId}`);
      } catch (e: unknown) {
        clientLogger.warn('Error clearing legacy security data:', e);
      }
    }
  }, [open, profileId]);

  // "Ricorda password" (profile-selector.tsx) tiene la password nello store
  // cifrato con questo nome: dopo un cambio va aggiornata, altrimenti al
  // prossimo avvio verrebbe proposta la vecchia.
  const updateRememberedPassword = async (password: string) => {
    const name = `PROFILE_PASSWORD_${profileId}`;
    try {
      localStorage.removeItem(`gs_pwd_${profileId}`);
      if (await invoke<boolean | null>('has_secure_key', { name })) {
        await invoke('set_secure_key', { name, value: password });
      }
    } catch (e: unknown) {
      clientLogger.warn('Could not update remembered password, removing it:', e);
      try {
        await invoke('remove_secure_key', { name });
      } catch (removeError: unknown) {
        clientLogger.warn('Could not remove remembered password:', removeError);
      }
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error(t('securityDialog.enterCurrentPassword'));
      return;
    }

    if (newPassword.length < 4) {
      toast.error(t('securityDialog.passwordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('securityDialog.passwordsDontMatch'));
      return;
    }

    setIsChangingPassword(true);

    try {
      // Il backend verifica la vecchia password decifrando il profilo e lo
      // ri-cifra con la nuova. Gli errori arrivano come { success: false }.
      const response = await invoke<ProfileResponse<boolean> | null>('change_profile_password', {
        profileId,
        oldPassword: currentPassword,
        newPassword,
      });

      if (!response?.success) {
        clientLogger.warn(`change_profile_password failed: ${response?.error ?? 'no response'}`);
        toast.error(t('securityDialog.passwordChangeFailed'));
        return;
      }

      await updateRememberedPassword(newPassword);

      toast.success(t('securityDialog.passwordChanged'));

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: unknown) {
      clientLogger.error('Error changing profile password:', e);
      toast.error(t('securityDialog.passwordChangeFailed'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden bg-slate-900/60 backdrop-blur-2xl border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            {t('profile.security')} - {profileName}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Key className="h-4 w-4 mr-2" />
                {t('securityDialog.changePassword')}</CardTitle>
              <CardDescription className="text-xs">
                {t('securityDialog.changePasswordDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password" className="text-xs">{t('securityDialogComp.currentPassword')}</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••"
                      className="pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-xs">{t('securityDialogComp.newPassword')}</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••"
                      className="pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-xs">{t('securityDialogComp.confirmPassword')}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••"
                    autoComplete="new-password"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <X className="h-3 w-3" /> {t('securityDialog.passwordsDontMatch')}</p>
                  )}
                  {confirmPassword && newPassword === confirmPassword && (
                    <p className="text-xs text-green-500 flex items-center gap-1">
                      <Check className="h-3 w-3" /> {t('securityDialog.passwordsMatch')}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isChangingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                  className="w-full"
                >
                  {isChangingPassword ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Key className="h-4 w-4 mr-2" />
                  )}
                  {t('securityDialog.changePassword')}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}




