'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Key,
  CheckCircle2,
  AlertTriangle,
  Shield
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface RecoveryKeyDisplayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileName: string;
  onConfirm: () => void;
}

// Questo dialog mostrava una "recovery key" a 12 parole presentata come
// "l'unico modo per recuperare la password". Non lo era: la chiave non può
// decifrare il profilo (cifrato con la sola password, vedi
// password-recovery-dialog.tsx), quindi niente parole da salvare. Al loro posto
// un avviso onesto: la password non si può recuperare né resettare.
// Chiuderlo in qualunque modo (X, Esc) vale come conferma: il profilo è già
// creato e create-profile-dialog deve completare il flusso (onProfileCreated).
export function RecoveryKeyDisplay({
  open,
  onOpenChange,
  profileName,
  onConfirm,
}: RecoveryKeyDisplayProps) {
  const { t } = useTranslation();
  const [, setConfirmed] = useState(false);

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (isOpen ? onOpenChange(true) : handleConfirm())}>
      <DialogContent className="sm:max-w-lg bg-slate-900/60 backdrop-blur-2xl border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Key className="h-5 w-5 text-emerald-400" />
            {t('profile.passwordNoticeTitle')}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            <span className="text-white font-medium">{profileName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-200 text-sm ml-2">
              {t('profile.passwordNoticeDesc')}
            </AlertDescription>
          </Alert>

          {/* Security Note */}
          <div className="flex items-start gap-2 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
            <Shield className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-400">
              {t('profile.passwordNoticeHint')}
            </p>
          </div>
        </div>

        {/* Confirm Button */}
        <Button
          onClick={handleConfirm}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          {t('profile.passwordNoticeConfirm')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

