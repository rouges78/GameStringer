'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, FileWarning, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';

const DISCLAIMER_ACCEPTED_KEY = 'gamestringer-disclaimer-accepted';
const DISCLAIMER_VERSION = '1.0';

interface DisclaimerModalProps {
  onAccept?: () => void;
}

export function DisclaimerModal({ onAccept }: DisclaimerModalProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(DISCLAIMER_ACCEPTED_KEY);
    if (accepted !== DISCLAIMER_VERSION) {
      setIsOpen(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, DISCLAIMER_VERSION);
    setIsOpen(false);
    onAccept?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl max-w-md w-full shadow-2xl">
        {/* Header compatto */}
        <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{t('disclaimer.title')}</h2>
              <p className="text-xs text-slate-400">{t('disclaimer.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Content compatto */}
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-300">{t('disclaimer.mainDisclaimer')}</h3>
              <p className="text-xs text-slate-300">{t('disclaimer.mainDisclaimerText')}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg">
            <FileWarning className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-blue-300">{t('disclaimer.useAtOwnRisk')}</h3>
              <p className="text-xs text-slate-300">{t('disclaimer.useAtOwnRiskText')}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg">
            <Shield className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-green-300">{t('disclaimer.intellectualProperty')}</h3>
              <p className="text-xs text-slate-300">{t('disclaimer.intellectualPropertyText')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-start gap-2 p-2 bg-slate-800/50 border border-slate-700/50 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-semibold text-red-300">{t('disclaimer.translationQuality')}</h3>
                <p className="text-[10px] text-slate-400">{t('disclaimer.translationQualityText')}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 bg-slate-800/50 border border-slate-700/50 rounded-lg">
              <Shield className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-semibold text-purple-300">{t('disclaimer.noWarranty')}</h3>
                <p className="text-[10px] text-slate-400">{t('disclaimer.noWarrantyText')}</p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 text-center px-2">
            {t('disclaimer.summary')}
          </p>
        </div>

        {/* Footer compatto */}
        <div className="p-4 border-t border-slate-700/50">
          <Button
            onClick={handleAccept}
            className="w-full h-10 text-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {t('disclaimer.acceptButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useDisclaimerAccepted() {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const value = localStorage.getItem(DISCLAIMER_ACCEPTED_KEY);
    setAccepted(value === DISCLAIMER_VERSION);
  }, []);

  return accepted;
}

export function resetDisclaimer() {
  localStorage.removeItem(DISCLAIMER_ACCEPTED_KEY);
}



