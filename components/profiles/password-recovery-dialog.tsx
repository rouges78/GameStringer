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
import { Mail, KeyRound, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordRecoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileName?: string;
  profileEmail?: string;
}

type RecoveryStep = 'email' | 'code' | 'newPassword' | 'success';

export function PasswordRecoveryDialog({
  open,
  onOpenChange,
  profileName,
  profileEmail,
}: PasswordRecoveryDialogProps) {
  const [step, setStep] = useState<RecoveryStep>('email');
  const [email, setEmail] = useState(profileEmail || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState('');

  const maskEmail = (email: string) => {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const maskedLocal = local.slice(0, 2) + '***' + local.slice(-1);
    return `${maskedLocal}@${domain}`;
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSendCode = async () => {
    setError(null);
    
    if (!validateEmail(email)) {
      setError('Inserisci un indirizzo email valido');
      return;
    }

    setLoading(true);
    
    // Simula invio email (in produzione userebbe un backend reale)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setMaskedEmail(maskEmail(email));
    setStep('code');
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    setError(null);
    
    if (code.length !== 6) {
      setError('Il codice deve essere di 6 cifre');
      return;
    }

    setLoading(true);
    
    // Simula verifica codice (in produzione verificherebbe con backend)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Per demo, accetta qualsiasi codice di 6 cifre
    if (!/^\d{6}$/.test(code)) {
      setError('Codice non valido');
      setLoading(false);
      return;
    }
    
    setStep('newPassword');
    setLoading(false);
  };

  const handleResetPassword = async () => {
    setError(null);
    
    if (newPassword.length < 4) {
      setError('La password deve essere di almeno 4 caratteri');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Le password non coincidono');
      return;
    }

    setLoading(true);
    
    // Simula reset password
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setStep('success');
    setLoading(false);
  };

  const handleClose = () => {
    setStep('email');
    setEmail(profileEmail || '');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    onOpenChange(false);
  };

  const handleBack = () => {
    setError(null);
    if (step === 'code') setStep('email');
    else if (step === 'newPassword') setStep('code');
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
            {step === 'email' && 'Recupera Password'}
            {step === 'code' && 'Verifica Email'}
            {step === 'newPassword' && 'Nuova Password'}
            {step === 'success' && 'Password Reimpostata'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {step === 'email' && `Recupera la password per il profilo ${profileName || 'selezionato'}`}
            {step === 'code' && `Inserisci il codice inviato a ${maskedEmail}`}
            {step === 'newPassword' && 'Scegli una nuova password sicura'}
            {step === 'success' && 'La tua password è stata reimpostata con successo'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step: Email */}
          {step === 'email' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-email" className="text-gray-300">
                  Email di recupero
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="recovery-email"
                    type="email"
                    placeholder="nome@esempio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>
              
              <p className="text-xs text-gray-500">
                Ti invieremo un codice di verifica a 6 cifre per reimpostare la password.
              </p>
            </div>
          )}

          {/* Step: Code */}
          {step === 'code' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verification-code" className="text-gray-300">
                  Codice di verifica
                </Label>
                <Input
                  id="verification-code"
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-[0.5em] bg-slate-800/50 border-slate-700 text-white font-mono"
                  maxLength={6}
                />
              </div>
              
              <p className="text-xs text-gray-500">
                Non hai ricevuto il codice?{' '}
                <button 
                  className="text-purple-400 hover:underline"
                  onClick={handleSendCode}
                  disabled={loading}
                >
                  Invia di nuovo
                </button>
              </p>
            </div>
          )}

          {/* Step: New Password */}
          {step === 'newPassword' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-gray-300">
                  Nuova password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-gray-300">
                  Conferma password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
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
                Ora puoi accedere al tuo profilo con la nuova password.
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
          {step !== 'email' && step !== 'success' && (
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={loading}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Indietro
            </Button>
          )}
          
          <div className="flex-1" />
          
          {step === 'email' && (
            <Button
              onClick={handleSendCode}
              disabled={loading || !email}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Invia codice
            </Button>
          )}
          
          {step === 'code' && (
            <Button
              onClick={handleVerifyCode}
              disabled={loading || code.length !== 6}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Verifica
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
              Reimposta password
            </Button>
          )}
          
          {step === 'success' && (
            <Button
              onClick={handleClose}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Fatto
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
