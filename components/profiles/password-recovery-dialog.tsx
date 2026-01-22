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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Key, KeyRound, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { 
  stringToRecoveryKey, 
  isValidRecoveryKeyFormat, 
  verifyProfileRecoveryKey 
} from '@/lib/recovery-key';

interface PasswordRecoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileName?: string;
  profileId?: string;
}

type RecoveryStep = 'key' | 'newPassword' | 'success';

export function PasswordRecoveryDialog({
  open,
  onOpenChange,
  profileName,
  profileId,
}: PasswordRecoveryDialogProps) {
  const [step, setStep] = useState<RecoveryStep>('key');
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerifyKey = async () => {
    setError(null);
    
    const words = stringToRecoveryKey(recoveryKeyInput);
    
    if (!isValidRecoveryKeyFormat(words)) {
      setError('Invalid recovery key. Enter all 12 words separated by spaces.');
      return;
    }

    setLoading(true);
    
    // Verifica recovery key
    const keyId = profileId || profileName || '';
    const isValid = await verifyProfileRecoveryKey(keyId, words);
    
    if (!isValid) {
      setError('Recovery key does not match. Please check and try again.');
      setLoading(false);
      return;
    }
    
    setStep('newPassword');
    setLoading(false);
  };

  const handleResetPassword = async () => {
    setError(null);
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    
    // TODO: Implementare reset password effettivo via backend
    // Per ora simula il successo
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setStep('success');
    setLoading(false);
  };

  const handleClose = () => {
    setStep('key');
    setRecoveryKeyInput('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    onOpenChange(false);
  };

  const handleBack = () => {
    setError(null);
    if (step === 'newPassword') setStep('key');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 border-purple-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            {step === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            ) : (
              <KeyRound className="h-5 w-5 text-purple-400" />
            )}
            {step === 'key' && 'Recover Password'}
            {step === 'newPassword' && 'New Password'}
            {step === 'success' && 'Password Reset'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {step === 'key' && `Enter your 12-word recovery key for ${profileName || 'this profile'}`}
            {step === 'newPassword' && 'Choose a new secure password'}
            {step === 'success' && 'Your password has been reset successfully'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step: Recovery Key */}
          {step === 'key' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-key" className="text-gray-300 flex items-center gap-2">
                  <Key className="h-4 w-4 text-purple-400" />
                  Recovery Key (12 words)
                </Label>
                <textarea
                  id="recovery-key"
                  placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
                  value={recoveryKeyInput}
                  onChange={(e) => setRecoveryKeyInput(e.target.value.toLowerCase())}
                  className="w-full h-24 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-md text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none font-mono text-sm"
                />
              </div>
              
              <p className="text-xs text-gray-500">
                Enter the 12 words you saved when creating this profile, separated by spaces.
              </p>
            </div>
          )}

          {/* Step: New Password */}
          {step === 'newPassword' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-gray-300">
                  New password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-gray-300">
                  Confirm password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="text-center py-4">
              <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <p className="text-gray-300">
                You can now log in with your new password.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {step === 'newPassword' && (
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={loading}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          
          <div className="flex-1" />
          
          {step === 'key' && (
            <Button
              onClick={handleVerifyKey}
              disabled={loading || !recoveryKeyInput.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              Verify Key
            </Button>
          )}
          
          {step === 'newPassword' && (
            <Button
              onClick={handleResetPassword}
              disabled={loading || !newPassword || !confirmPassword}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <KeyRound className="h-4 w-4 mr-2" />
              )}
              Reset Password
            </Button>
          )}
          
          {step === 'success' && (
            <Button
              onClick={handleClose}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
