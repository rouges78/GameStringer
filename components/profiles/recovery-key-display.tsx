'use client';

import React, { useState } from 'react';
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
  Copy, 
  CheckCircle2, 
  AlertTriangle, 
  Download,
  Shield
} from 'lucide-react';
import { formatRecoveryKeyForDisplay, recoveryKeyToString } from '@/lib/recovery-key';

interface RecoveryKeyDisplayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recoveryKey: string[];
  profileName: string;
  onConfirm: () => void;
}

export function RecoveryKeyDisplay({
  open,
  onOpenChange,
  recoveryKey,
  profileName,
  onConfirm,
}: RecoveryKeyDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const formattedGroups = formatRecoveryKeyForDisplay(recoveryKey);
  const keyString = recoveryKeyToString(recoveryKey);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(keyString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const content = `GameStringer Recovery Key
========================
Profile: ${profileName}
Date: ${new Date().toLocaleDateString()}

Your 12-word recovery key:
${keyString}

IMPORTANT: Keep this file safe and secure!
You will need these words to recover your password.
Do not share this with anyone.
`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gamestringer-recovery-${profileName.toLowerCase().replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-gradient-to-br from-slate-900 via-emerald-900/20 to-slate-900 border-emerald-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Key className="h-5 w-5 text-emerald-400" />
            Recovery Key
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Save this key to recover your password for <span className="text-white font-medium">{profileName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-200 text-sm ml-2">
              <strong>Important:</strong> Write down or save these 12 words. You won't be able to see them again!
            </AlertDescription>
          </Alert>

          {/* Recovery Key Grid */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="grid grid-cols-3 gap-3">
              {formattedGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="space-y-2">
                  {group.map((word, wordIndex) => {
                    const number = groupIndex * 3 + wordIndex + 1;
                    return (
                      <div 
                        key={wordIndex}
                        className="flex items-center gap-2 bg-slate-900/50 rounded px-3 py-2"
                      >
                        <span className="text-xs text-slate-500 w-4">{number}.</span>
                        <span className="text-emerald-300 font-mono text-sm">{word}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCopy}
              className="flex-1 border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-white"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownload}
              className="flex-1 border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          {/* Security Note */}
          <div className="flex items-start gap-2 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
            <Shield className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-400">
              This key is the only way to recover your password if you forget it. 
              Store it in a safe place, like a password manager or a secure note.
            </p>
          </div>
        </div>

        {/* Confirm Button */}
        <Button
          onClick={handleConfirm}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          I've saved my recovery key
        </Button>
      </DialogContent>
    </Dialog>
  );
}
