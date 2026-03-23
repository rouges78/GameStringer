'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, AlertTriangle, ShieldAlert, Scale, Server, Globe, Brain, Check } from 'lucide-react';
import { VisuallyHidden } from 'radix-ui';
import { useTranslation } from '@/lib/i18n';

const TOS_KEY = 'gamestringer_tos_accepted';
const TOS_VERSION = '2';

export function TermsOfUse() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tosAccepted = localStorage.getItem(TOS_KEY);
    if (tosAccepted !== TOS_VERSION) {
      setIsOpen(true);
    }
  }, []);

  const handleAccept = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOS_KEY, TOS_VERSION);
    }
    setIsOpen(false);
  };

  // Non può essere chiuso senza accettare
  const handleOpenChange = (open: boolean) => {
    if (!open && localStorage.getItem(TOS_KEY) !== TOS_VERSION) {
      return;
    }
    setIsOpen(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="max-w-md p-0 gap-0 overflow-hidden [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <VisuallyHidden.Root>
          <DialogTitle>{t('disclaimer.title')}</DialogTitle>
        </VisuallyHidden.Root>

        {/* Header */}
        <div className="flex items-center gap-3 p-5 bg-gradient-to-r from-orange-500/10 to-transparent border-b border-slate-800/50">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{t('disclaimer.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('disclaimer.subtitle')}</p>
          </div>
        </div>

        {/* Cards Content */}
        <ScrollArea className="max-h-[420px]">
          <div className="p-4 space-y-3">

            {/* Disclaimer */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <h3 className="font-semibold text-amber-400 text-sm">{t('disclaimer.mainDisclaimer')}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{t('disclaimer.mainDisclaimerText')}</p>
            </div>

            {/* Community & Server Esterno — NUOVA SEZIONE */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-orange-500/30">
              <div className="flex items-center gap-2 mb-1.5">
                <Server className="h-4 w-4 text-orange-500 shrink-0" />
                <h3 className="font-semibold text-orange-400 text-sm">{t('disclaimer.communityServer')}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{t('disclaimer.communityServerText')}</p>
            </div>

            {/* Privacy & Dati — NUOVA SEZIONE */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-1.5">
                <Globe className="h-4 w-4 text-blue-500 shrink-0" />
                <h3 className="font-semibold text-blue-400 text-sm">{t('disclaimer.dataPrivacy')}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{t('disclaimer.dataPrivacyText')}</p>
            </div>

            {/* Use at Your Own Risk */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldAlert className="h-4 w-4 text-green-500 shrink-0" />
                <h3 className="font-semibold text-green-400 text-sm">{t('disclaimer.useAtOwnRisk')}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{t('disclaimer.useAtOwnRiskText')}</p>
            </div>

            {/* Intellectual Property */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-1.5">
                <Scale className="h-4 w-4 text-purple-500 shrink-0" />
                <h3 className="font-semibold text-purple-400 text-sm">{t('disclaimer.intellectualProperty')}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{t('disclaimer.intellectualPropertyText')}</p>
            </div>

            {/* Servizi AI — NUOVA SEZIONE */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-1.5">
                <Brain className="h-4 w-4 text-violet-500 shrink-0" />
                <h3 className="font-semibold text-violet-400 text-sm">{t('disclaimer.aiServices')}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{t('disclaimer.aiServicesText')}</p>
            </div>

            {/* Translation Quality + No Warranty row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <h3 className="font-semibold text-rose-400 text-xs">{t('disclaimer.translationQuality')}</h3>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{t('disclaimer.translationQualityText')}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                  <h3 className="font-semibold text-purple-400 text-xs">{t('disclaimer.noWarranty')}</h3>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{t('disclaimer.noWarrantyText')}</p>
              </div>
            </div>

            {/* Summary */}
            <p className="text-xs text-muted-foreground text-center italic pt-1">
              {t('disclaimer.summary')}
            </p>
          </div>
        </ScrollArea>

        {/* Accept Button */}
        <div className="p-4 pt-0">
          <Button
            onClick={handleAccept}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-12 text-sm"
            size="lg"
          >
            <Check className="h-4 w-4 mr-2" />
            {t('disclaimer.acceptButton')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TermsOfUse;
