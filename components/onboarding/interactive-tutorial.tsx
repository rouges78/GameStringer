'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  X, ChevronRight, ChevronLeft, Gamepad2, Languages, 
  Settings, Wrench, Library, Home, Sparkles, CheckCircle, FolderTree,
  Brain, Users, Cpu, Mic, Globe, Rocket, Zap, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import Image from 'next/image';

const TUTORIAL_KEY = 'gamestringer-tutorial-completed';
const TUTORIAL_VERSION = '4'; // Versione 4: miglior posizionamento finestra

interface TutorialStep {
  id: string;
  icon: React.ReactNode;
  iconColor: string;
  selector?: string;
  position: 'center' | 'sidebar' | 'top-right';
  showLogo?: boolean;
  features?: { icon: React.ReactNode; text: string; color: string }[];
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    icon: <Rocket className="h-6 w-6" />,
    iconColor: 'text-purple-400',
    position: 'center',
    showLogo: true,
    features: [
      { icon: <Brain className="h-4 w-4" />, text: 'AI Translation', color: 'text-violet-400' },
      { icon: <Gamepad2 className="h-4 w-4" />, text: '7+ Store', color: 'text-teal-400' },
      { icon: <Globe className="h-4 w-4" />, text: '20+ Lingue', color: 'text-blue-400' },
    ]
  },
  {
    id: 'aiFeatures',
    icon: <Brain className="h-6 w-6" />,
    iconColor: 'text-violet-400',
    position: 'center',
    features: [
      { icon: <Zap className="h-4 w-4" />, text: 'Ollama (Gratuito)', color: 'text-green-400' },
      { icon: <Cpu className="h-4 w-4" />, text: 'OpenAI / Claude', color: 'text-blue-400' },
      { icon: <Mic className="h-4 w-4" />, text: 'Voice Clone', color: 'text-pink-400' },
    ]
  },
  {
    id: 'dashboard',
    icon: <Home className="h-6 w-6" />,
    iconColor: 'text-cyan-400',
    selector: '[data-tutorial^="nav-"]', // Prima voce della sidebar
    position: 'sidebar'
  },
  {
    id: 'library',
    icon: <Library className="h-6 w-6" />,
    iconColor: 'text-purple-400',
    selector: '[data-tutorial="nav-library"]',
    position: 'sidebar'
  },
  {
    id: 'translator',
    icon: <Languages className="h-6 w-6" />,
    iconColor: 'text-blue-400',
    selector: '[data-tutorial="nav-ai-translator"]',
    position: 'sidebar'
  },
  {
    id: 'tools',
    icon: <Wrench className="h-6 w-6" />,
    iconColor: 'text-emerald-400',
    selector: '[data-tutorial="nav-unity-patcher"]',
    position: 'sidebar'
  },
  {
    id: 'community',
    icon: <Users className="h-6 w-6" />,
    iconColor: 'text-orange-400',
    selector: '[data-tutorial="nav-community-hub"]',
    position: 'sidebar'
  },
  {
    id: 'settings',
    icon: <Settings className="h-6 w-6" />,
    iconColor: 'text-slate-400',
    selector: '[data-tutorial="nav-settings"]',
    position: 'sidebar'
  },
  {
    id: 'complete',
    icon: <CheckCircle className="h-6 w-6" />,
    iconColor: 'text-green-400',
    position: 'center',
    features: [
      { icon: <Download className="h-4 w-4" />, text: 'Esplora Libreria', color: 'text-teal-400' },
      { icon: <Languages className="h-4 w-4" />, text: 'Inizia a Tradurre', color: 'text-violet-400' },
    ]
  }
];

interface InteractiveTutorialProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export function InteractiveTutorial({ onComplete, forceShow = false }: InteractiveTutorialProps) {
  const { t, language } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Aspetta che la lingua sia caricata dal localStorage prima di mostrare il tutorial
    const timer = setTimeout(() => {
      setIsReady(true);
      const tutorialCompleted = localStorage.getItem(TUTORIAL_KEY);
      
      // Mostra tutorial se non è stato completato
      if (tutorialCompleted === TUTORIAL_VERSION) {
        return;
      }
      
      // Avvia automaticamente dopo un breve delay per permettere il rendering della sidebar
      setTimeout(() => setIsVisible(true), 300);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const updateHighlight = useCallback(() => {
    const step = tutorialSteps[currentStep];
    if (step.selector) {
      const el = document.querySelector(step.selector);
      if (el) {
        setHighlightRect(el.getBoundingClientRect());
        return;
      }
    }
    setHighlightRect(null);
  }, [currentStep]);

  useEffect(() => {
    updateHighlight();
    window.addEventListener('resize', updateHighlight);
    return () => window.removeEventListener('resize', updateHighlight);
  }, [updateHighlight]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem(TUTORIAL_KEY, TUTORIAL_VERSION);
    localStorage.setItem('tutorial-completed', 'true');
    setIsVisible(false);
    onComplete?.();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, currentStep]);

  if (!isVisible || !isReady) return null;

  const step = tutorialSteps[currentStep];
  const isLastStep = currentStep === tutorialSteps.length - 1;
  const isFirstStep = currentStep === 0;

  const getStepText = (stepId: string, field: 'title' | 'description') => {
    return t(`tutorial.steps.${stepId}.${field}`);
  };

  const getCardPosition = () => {
    if (step.position === 'sidebar' && highlightRect) {
      // Posiziona la card a destra dell'elemento, centrata verticalmente nella viewport
      const viewportHeight = window.innerHeight;
      const cardHeight = 320; // Altezza approssimativa della card
      return {
        left: Math.min(highlightRect.right + 24, window.innerWidth - 340),
        top: Math.max(60, (viewportHeight - cardHeight) / 2),
      };
    }
    return null;
  };

  const cardPos = getCardPosition();

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Overlay con buco per highlight */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200]"
            style={{
              background: highlightRect 
                ? `radial-gradient(ellipse ${highlightRect.width + 40}px ${highlightRect.height + 40}px at ${highlightRect.left + highlightRect.width/2}px ${highlightRect.top + highlightRect.height/2}px, transparent 0%, rgba(0,0,0,0.85) 100%)`
                : 'rgba(0,0,0,0.85)'
            }}
            onClick={handleNext}
          />

          {/* Highlight ring */}
          {highlightRect && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed z-[201] pointer-events-none"
              style={{
                left: highlightRect.left - 6,
                top: highlightRect.top - 6,
                width: highlightRect.width + 12,
                height: highlightRect.height + 12,
                borderRadius: 12,
                border: '2px solid rgba(168, 85, 247, 0.8)',
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.5), inset 0 0 20px rgba(168, 85, 247, 0.1)',
              }}
            />
          )}

          {/* Card tutorial */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              "fixed z-[202] pointer-events-auto",
              step.position === 'center' && "inset-0 flex items-center justify-center"
            )}
            style={cardPos ? { left: cardPos.left, top: cardPos.top } : undefined}
          >
            <div 
              className="bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/50 backdrop-blur-xl border border-purple-500/40 rounded-2xl shadow-2xl shadow-purple-500/30 w-[340px]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b border-slate-800/50">
                <div className="flex items-center gap-1.5">
                  {tutorialSteps.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        i === currentStep 
                          ? "bg-purple-500 w-4" 
                          : i < currentStep 
                            ? "bg-purple-500/50 w-1.5" 
                            : "bg-slate-700 w-1.5"
                      )}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="h-7 px-2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  {t('tutorial.skip')}
                </Button>
              </div>

              {/* Content */}
              <div className="p-4 text-center">
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Logo per welcome */}
                  {step.showLogo ? (
                    <div className="w-20 h-20 mx-auto mb-3">
                      <Image 
                        src="/logo.png" 
                        alt="GameStringer" 
                        width={80} 
                        height={80} 
                        className="drop-shadow-2xl"
                        priority
                      />
                    </div>
                  ) : (
                    <div className={cn(
                      "w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center",
                      step.iconColor
                    )}>
                      {step.icon}
                    </div>
                  )}
                  
                  <h3 className="text-lg font-bold text-white mb-1.5">
                    {getStepText(step.id, 'title')}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-3">
                    {getStepText(step.id, 'description')}
                  </p>
                  
                  {/* Feature cards */}
                  {step.features && (
                    <div className="flex justify-center gap-2 mt-3">
                      {step.features.map((feature, i) => (
                        <div 
                          key={i}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50"
                        >
                          <span className={feature.color}>{feature.icon}</span>
                          <span className="text-xs text-slate-300">{feature.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-3 border-t border-slate-800/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrev}
                  disabled={isFirstStep}
                  className={cn(
                    "h-8 text-xs",
                    isFirstStep && "opacity-0 pointer-events-none"
                  )}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  {t('tutorial.back')}
                </Button>

                <span className="text-[10px] text-slate-600">
                  {t('tutorial.stepOf').replace('{current}', String(currentStep + 1)).replace('{total}', String(tutorialSteps.length))}
                </span>

                <Button
                  size="sm"
                  onClick={handleNext}
                  className="h-8 text-xs bg-purple-600 hover:bg-purple-500"
                >
                  {isLastStep ? (
                    <>
                      {t('tutorial.finish')}
                      <Sparkles className="h-3.5 w-3.5 ml-1" />
                    </>
                  ) : (
                    <>
                      {t('tutorial.next')}
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </div>

              {/* Hint */}
              <div className="px-3 pb-2 text-center">
                <span className="text-[9px] text-slate-600">
                  {t('tutorial.pressSpace')}
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default InteractiveTutorial;



