'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { KeyRound, AlertCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface PasswordRecoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileName?: string;
  profileId?: string;
}

// Un reset della password non è possibile: il file del profilo è cifrato con
// una chiave derivata dalla password (PBKDF2 -> AES-256-GCM, vedi
// src-tauri/src/profiles/encryption.rs) e nessun'altra chiave la avvolge. La
// recovery key a 12 parole era solo un hash SHA-256 in localStorage: verificarla
// non permette di decifrare il profilo. Il vecchio flusso simulava il reset e
// diceva "fatto" senza salvare nulla; qui diciamo come stanno le cose.
export function PasswordRecoveryDialog({
  open,
  onOpenChange,
  profileName,
}: PasswordRecoveryDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900/60 backdrop-blur-2xl border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <KeyRound className="h-5 w-5 text-purple-400" />
            {t('profile.recoveryUnavailableTitle')}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {profileName || t('profile.thisProfile')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200">{t('profile.passwordUnrecoverableDesc')}</p>
          </div>

          <p className="text-xs text-gray-500">
            {t('profile.recoveryUnavailableHint')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <div className="flex-1" />
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {t('common.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
