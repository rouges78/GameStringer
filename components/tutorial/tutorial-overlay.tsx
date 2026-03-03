'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial, safeFindElement } from './tutorial-provider';
import { useTranslation } from '@/lib/i18n';

export function TutorialOverlay() {
  const {
    isActive,
    currentStep,
    totalSteps,
    currentStepData,
    currentTutorial,
    nextStep,
    prevStep,
    skipTutorial,
  } = useTutorial();
  const { t } = useTranslation();

  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const updateHighlight = useCallback(() => {
    if (!currentStepData?.target || currentStepData.target === 'body') {
      setHighlightRect(null);
      return;
    }
    const el = safeFindElement(currentStepData.target);
    if (el) {
      setHighlightRect(el.getBoundingClientRect());
    } else {
      setHighlightRect(null);
    }
  }, [currentStepData]);

  useEffect(() => {
    if (!isActive) return;
    updateHighlight();
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight, true);
    return () => {
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight, true);
    };
  }, [isActive, updateHighlight]);

  if (!isActive || !currentStepData || !currentTutorial) return null;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const getCardStyle = (): React.CSSProperties => {
    if (!highlightRect) return {};
    const pos = currentStepData.position;
    const gap = 16;
    const cardW = 340;
    const cardH = 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = 0;
    let top = 0;

    switch (pos) {
      case 'right':
        left = Math.min(highlightRect.right + gap, vw - cardW - 16);
        top = Math.max(16, highlightRect.top + highlightRect.height / 2 - cardH / 2);
        break;
      case 'left':
        left = Math.max(16, highlightRect.left - cardW - gap);
        top = Math.max(16, highlightRect.top + highlightRect.height / 2 - cardH / 2);
        break;
      case 'top':
        left = Math.max(16, Math.min(highlightRect.left + highlightRect.width / 2 - cardW / 2, vw - cardW - 16));
        top = Math.max(16, highlightRect.top - cardH - gap);
        break;
      case 'bottom':
      default:
        left = Math.max(16, Math.min(highlightRect.left + highlightRect.width / 2 - cardW / 2, vw - cardW - 16));
        top = Math.min(highlightRect.bottom + gap, vh - cardH - 16);
        break;
    }

    // Clamp dentro viewport
    top = Math.max(16, Math.min(top, vh - cardH - 16));
    left = Math.max(16, Math.min(left, vw - cardW - 16));

    return { left, top };
  };

  const isCentered = !highlightRect;
  const cardStyle = isCentered ? {} : getCardStyle();

  return (
    <AnimatePresence>
      {isActive && (
        <>
          {/* Overlay scuro con buco per highlight */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200]"
            style={{
              background: highlightRect
                ? `radial-gradient(ellipse ${highlightRect.width + 60}px ${highlightRect.height + 60}px at ${highlightRect.left + highlightRect.width / 2}px ${highlightRect.top + highlightRect.height / 2}px, transparent 0%, rgba(0,0,0,0.82) 100%)`
                : 'rgba(0,0,0,0.82)',
            }}
            onClick={nextStep}
          />

          {/* Ring di highlight sull'elemento */}
          {highlightRect && (
            <motion.div
              key={`ring-${currentStep}`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed z-[201] pointer-events-none"
              style={{
                left: highlightRect.left - 6,
                top: highlightRect.top - 6,
                width: highlightRect.width + 12,
                height: highlightRect.height + 12,
                borderRadius: 10,
                border: '2px solid rgba(168, 85, 247, 0.8)',
                boxShadow: '0 0 24px rgba(168, 85, 247, 0.45), inset 0 0 16px rgba(168, 85, 247, 0.1)',
              }}
            />
          )}

          {/* Card tutorial */}
          <motion.div
            key={`card-${currentStep}`}
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'fixed z-[202] pointer-events-auto',
              isCentered && 'inset-0 flex items-center justify-center',
            )}
            style={!isCentered ? cardStyle : undefined}
          >
            <div
              className="bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/50 backdrop-blur-xl border border-purple-500/40 rounded-2xl shadow-2xl shadow-purple-500/25 w-[340px]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header con progress dots */}
              <div className="flex items-center justify-between p-3 border-b border-slate-800/50">
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalSteps }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-300',
                        i === currentStep
                          ? 'bg-purple-500 w-4'
                          : i < currentStep
                            ? 'bg-purple-500/50 w-1.5'
                            : 'bg-slate-700 w-1.5',
                      )}
                    />
                  ))}
                </div>
                {currentTutorial.canSkip !== false && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={skipTutorial}
                    className="h-7 px-2 text-slate-500 hover:text-slate-300 text-xs"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    {t('tutorial.overlay.skip')}
                  </Button>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                <motion.div
                  key={currentStepData.id}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 className="text-lg font-bold text-white mb-2">
                    {currentStepData.title}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {currentStepData.description}
                  </p>
                </motion.div>
              </div>

              {/* Footer con navigazione */}
              <div className="flex items-center justify-between p-3 border-t border-slate-800/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prevStep}
                  disabled={isFirstStep}
                  className={cn(
                    'h-8 text-xs',
                    isFirstStep && 'opacity-0 pointer-events-none',
                  )}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  {t('tutorial.overlay.back')}
                </Button>

                <span className="text-[10px] text-slate-600">
                  {currentStep + 1} / {totalSteps}
                </span>

                <Button
                  size="sm"
                  onClick={nextStep}
                  className="h-8 text-xs bg-purple-600 hover:bg-purple-500"
                >
                  {isLastStep ? (
                    <>
                      {t('tutorial.overlay.done')}
                      <Sparkles className="h-3.5 w-3.5 ml-1" />
                    </>
                  ) : (
                    <>
                      {t('tutorial.overlay.forward')}
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </div>

              {/* Hint */}
              <div className="px-3 pb-2 text-center">
                <span className="text-[9px] text-slate-600">
                  {t('tutorial.overlay.hint')}
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
