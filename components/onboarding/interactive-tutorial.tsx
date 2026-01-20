'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  X, ChevronRight, ChevronLeft, Gamepad2, Languages, 
  Settings, Wand2, Library, Home, Sparkles, CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: string; // CSS selector to highlight
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Benvenuto in GameStringer!',
    description: 'Il software professionale per la localizzazione di videogames. Traduci games Unity, Unreal, Godot, RPG Maker e altri engine con AI avanzata.',
    icon: <Sparkles className="h-8 w-8 text-purple-400" />,
    position: 'center'
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Panoramica completa: games recenti, traduzioni in corso, statistiche e accesso rapido a tutte le funzioni.',
    icon: <Home className="h-8 w-8 text-cyan-400" />,
    position: 'center'
  },
  {
    id: 'library',
    title: 'library games',
    description: 'Tutti i tuoi games da Steam, Epic, GOG, Ubisoft, EA e altre piattaforme. Include supporto Family Sharing e filtri avanzati per lingua e backlog.',
    icon: <Library className="h-8 w-8 text-purple-400" />,
    position: 'center'
  },
  {
    id: 'translator',
    title: 'Neural Translator Pro',
    description: 'Traduzione batch con AI (Claude, OpenAI, Gemini, DeepSeek). Supporta JSON, CSV, PO, RESX e altri formati. Include Translation Memory e Quality Gates.',
    icon: <Languages className="h-8 w-8 text-blue-400" />,
    position: 'center'
  },
  {
    id: 'unity-patcher',
    title: 'Game Patcher',
    description: 'Installa automaticamente mod di traduzione per games Unity (BepInEx + XUnity), con supporto per Unity 4.x fino a 2023. Rileva engine e suggerisce tool alternativi.',
    icon: <Gamepad2 className="h-8 w-8 text-emerald-400" />,
    position: 'center'
  },
  {
    id: 'settings',
    title: 'Impostazioni',
    description: 'Configura API di traduzione, collega account store (Steam, Epic, GOG), gestisci profili utente e personalizza l\'interfaccia.',
    icon: <Settings className="h-8 w-8 text-slate-400" />,
    position: 'center'
  },
  {
    id: 'complete',
    title: 'Pronto per iniziare!',
    description: 'Esplora la library per i tuoi games, usa il Translator Pro per tradurre file, o il Game Patcher per mod automatiche. Buona localizzazione!',
    icon: <CheckCircle className="h-8 w-8 text-green-400" />,
    position: 'center'
  }
];

interface InteractiveTutorialProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export function InteractiveTutorial({ onComplete, forceShow = false }: InteractiveTutorialProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Mostra tutorial solo se non è stato completato
    const tutorialCompleted = localStorage.getItem('tutorial-completed');
    if (!tutorialCompleted || forceShow) {
      setIsVisible(true);
    }
  }, [forceShow]);

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
    localStorage.setItem('tutorial-completed', 'true');
    localStorage.setItem('profile-welcome-shown', 'true');
    setIsVisible(false);
    onComplete?.();
  };

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

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, currentStep]);

  if (!isVisible) return null;

  const step = tutorialSteps[currentStep];
  const isLastStep = currentStep === tutorialSteps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Overlay scuro */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            onClick={handleNext}
          />

          {/* Card tutorial */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none"
          >
            <div 
              className="bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/20 max-w-md w-full mx-4 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  {tutorialSteps.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        i === currentStep 
                          ? "bg-purple-500 w-6" 
                          : i < currentStep 
                            ? "bg-purple-500/50" 
                            : "bg-slate-700"
                      )}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="h-8 px-2 text-slate-500 hover:text-slate-300"
                >
                  <X className="h-4 w-4 mr-1" />
                  Salta
                </Button>
              </div>

              {/* Content */}
              <div className="p-6 text-center">
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{step.description}</p>
                </motion.div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4 border-t border-slate-800">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={isFirstStep}
                  className={cn(
                    "h-9",
                    isFirstStep && "opacity-0 pointer-events-none"
                  )}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Indietro
                </Button>

                <span className="text-xs text-slate-600">
                  {currentStep + 1} / {tutorialSteps.length}
                </span>

                <Button
                  onClick={handleNext}
                  className="h-9 bg-purple-600 hover:bg-purple-500"
                >
                  {isLastStep ? (
                    <>
                      Inizia
                      <Sparkles className="h-4 w-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Avanti
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>

              {/* Hint */}
              <div className="px-4 pb-3 text-center">
                <span className="text-[10px] text-slate-600">
                  Premi Spazio o clicca per continuare • Esc per saltare
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



