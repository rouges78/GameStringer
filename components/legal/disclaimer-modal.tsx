'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, FileWarning, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISCLAIMER_ACCEPTED_KEY = 'gamestringer-disclaimer-accepted';
const DISCLAIMER_VERSION = '1.0';

interface DisclaimerModalProps {
  onAccept?: () => void;
}

export function DisclaimerModal({ onAccept }: DisclaimerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (isAtBottom) {
      setHasScrolledToBottom(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Termini d'Uso e Disclaimer</h2>
              <p className="text-sm text-slate-400">Leggi attentamente prima di continuare</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div 
          className="flex-1 overflow-y-auto p-6 space-y-6"
          onScroll={handleScroll}
        >
          {/* Disclaimer principale */}
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-300 mb-1">Disclaimer</h3>
                <p className="text-sm text-slate-300">
                  Lo sviluppatore di GameStringer <strong>non è responsabile</strong> per traduzioni, 
                  patch, modifiche o qualsiasi altro contenuto creato, generato o applicato usando 
                  questo software.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl">
              <FileWarning className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-300 mb-1">Uso a Proprio Rischio</h3>
                <p className="text-sm text-slate-300">
                  L'utente utilizza questo software <strong>a proprio rischio</strong>. 
                  Le modifiche ai file di gioco possono causare malfunzionamenti, crash, 
                  corruzione dei salvataggi o altri problemi. Si raccomanda sempre di fare 
                  un <strong>backup</strong> prima di applicare qualsiasi modifica.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl">
              <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-300 mb-1">Proprietà Intellettuale</h3>
                <p className="text-sm text-slate-300">
                  I giochi, i loro contenuti e marchi appartengono ai rispettivi proprietari. 
                  GameStringer è uno strumento di utilità e <strong>non è affiliato</strong> con 
                  alcun editore o sviluppatore di giochi. L'utente è responsabile del rispetto 
                  dei termini di servizio e delle licenze dei giochi che modifica.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-300 mb-1">Qualità delle Traduzioni</h3>
                <p className="text-sm text-slate-300">
                  Le traduzioni automatiche generate tramite servizi di terze parti (come Google Translate, 
                  DeepL, ecc.) possono contenere <strong>errori, imprecisioni o contenuti inappropriati</strong>. 
                  Lo sviluppatore non garantisce la qualità, accuratezza o appropriatezza delle traduzioni.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl">
              <Shield className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-purple-300 mb-1">Nessuna Garanzia</h3>
                <p className="text-sm text-slate-300">
                  Questo software è fornito <strong>"così com'è"</strong>, senza garanzie di alcun tipo, 
                  esplicite o implicite. Lo sviluppatore non garantisce che il software sia privo di errori 
                  o che funzioni senza interruzioni.
                </p>
              </div>
            </div>
          </div>

          {/* Riepilogo */}
          <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
            <p className="text-sm text-slate-400 text-center">
              Continuando ad usare GameStringer, accetti i termini descritti sopra e 
              riconosci di essere l'unico responsabile dell'uso del software e 
              di qualsiasi modifica apportata ai tuoi giochi.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700/50 bg-slate-800/30">
          <Button
            onClick={handleAccept}
            disabled={!hasScrolledToBottom}
            className="w-full h-12 text-base bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500"
          >
            {hasScrolledToBottom ? (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Ho letto e accetto i termini
              </>
            ) : (
              'Scorri per leggere tutti i termini'
            )}
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



