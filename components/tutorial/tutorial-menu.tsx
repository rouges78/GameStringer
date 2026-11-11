'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  GraduationCap, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles,
  BookOpen,
  Gamepad2,
  Languages,
  Wrench,
  Users,
  ChevronRight
} from 'lucide-react';
import { useTutorial, getCompletedTutorials } from './tutorial-provider';
import { getAllTutorials } from '@/lib/tutorial-configs';
import { useTranslation } from '@/lib/i18n';
import type { TutorialConfig } from '@/lib/types/tutorial';
import { cn } from '@/lib/utils';

interface TutorialMenuProps {
  userId?: string;
  /** Se true, il trigger è una riga full-width (icona + etichetta), tutta cliccabile. */
  fullWidth?: boolean;
}

// Icone per ogni tipo di tutorial
const TUTORIAL_ICONS: Record<string, typeof BookOpen> = {
  'getting-started': Sparkles,
  'library': Gamepad2,
  'translation': Languages,
  'tools': Wrench,
  'community': Users,
};

// Colori per ogni tipo di tutorial
const TUTORIAL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'getting-started': { bg: 'bg-rouge-500/20', text: 'text-rouge-400', border: 'border-rouge-500/30' },
  'library': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'translation': { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  'tools': { bg: 'bg-noir-500/20', text: 'text-noir-400', border: 'border-noir-500/30' },
  'community': { bg: 'bg-rouge-500/20', text: 'text-rouge-400', border: 'border-rouge-500/30' },
};

const DEFAULT_COLOR = { bg: 'bg-rouge-500/20', text: 'text-rouge-400', border: 'border-rouge-500/30' };

export function TutorialMenu({ userId: _userId, fullWidth }: TutorialMenuProps) {
  const { startTutorial, isActive } = useTutorial();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const allTutorials = getAllTutorials();
  const completed = typeof window !== 'undefined' ? getCompletedTutorials() : [];
  const completedCount = completed.length;
  const totalCount = allTutorials.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleStart = (tutorial: TutorialConfig) => {
    setOpen(false);
    setTimeout(() => startTutorial(tutorial), 150);
  };

  const handleReset = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gamestringer_completed_tutorials');
      localStorage.removeItem('gamestringer-tutorial-completed');
      localStorage.removeItem('tutorialSkipped');
      setOpen(false);
    }
  };

  // Prende nome/descrizione da i18n, fallback al config
  const getGuideText = (tutorialId: string, field: 'name' | 'description', fallback: string) => {
    const key = `tutorial.guides.${tutorialId}.${field}`;
    const val = t(key);
    return val === key ? fallback : val;
  };

  // Determina il tipo di tutorial dal suo ID
  const getTutorialType = (id: string): string => {
    if (id.includes('start') || id.includes('intro') || id.includes('welcome')) return 'getting-started';
    if (id.includes('library') || id.includes('game')) return 'library';
    if (id.includes('translat') || id.includes('wizard')) return 'translation';
    if (id.includes('tool') || id.includes('patch')) return 'tools';
    if (id.includes('community') || id.includes('social')) return 'community';
    return 'getting-started';
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {fullWidth ? (
          // Trigger a riga intera: tutta l'area (icona + etichetta) è cliccabile.
          <button
            type="button"
            aria-label={t('nav.tutorialAndGuide')}
            disabled={isActive}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed",
              open ? "bg-noir-800/60" : "hover:bg-noir-800/50"
            )}
          >
            <span className={cn(
              "h-8 w-8 flex items-center justify-center shrink-0 transition-colors",
              open ? "text-rouge-400" : "text-noir-500 group-hover:text-rouge-400"
            )}>
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="text-2xs font-medium text-noir-500 group-hover:text-noir-300 transition-colors uppercase tracking-widest">
              {t('nav.tutorialAndGuide')}
            </span>
          </button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('nav.tutorialAndGuide')}
            className={cn(
              "h-8 w-8 p-0 transition-all",
              open ? "text-rouge-400 bg-rouge-500/10" : "text-noir-500 hover:text-rouge-400 hover:bg-rouge-500/10"
            )}
            disabled={isActive}
          >
            <GraduationCap className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={12}
        className="w-80 p-0 bg-noir-900/95 border-noir-700/50 backdrop-blur-xl shadow-xl shadow-black/50"
      >
        {/* Header */}
        <div className="p-4 border-b border-noir-800/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rouge-500 to-rouge-600 flex items-center justify-center shadow-lg shadow-rouge-500/30">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">{t('nav.tutorialAndGuide')}</h3>
              <p className="text-2xs text-noir-400">Impara a usare GameStringer</p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-2xs">
              <span className="text-noir-400">Progresso</span>
              <span className="text-rouge-400 font-medium">{completedCount}/{totalCount} completati</span>
            </div>
            <div className="h-1.5 bg-noir-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-rouge-500 to-rouge-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tutorial list */}
        <div className="p-2 max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
          {allTutorials.map((tutorial) => {
            const isDone = completed.includes(tutorial.id);
            const type = getTutorialType(tutorial.id);
            const Icon = TUTORIAL_ICONS[type] || BookOpen;
            const colors = TUTORIAL_COLORS[type] || DEFAULT_COLOR;
            
            return (
              <button
                key={tutorial.id}
                onClick={() => handleStart(tutorial)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 group",
                  isDone 
                    ? "bg-noir-800/30 hover:bg-noir-800/50" 
                    : "hover:bg-noir-800/60"
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                  colors.bg
                )}>
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Icon className={cn("h-4 w-4", colors.text)} />
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "text-sm font-medium leading-tight truncate",
                      isDone ? "text-noir-400" : "text-white group-hover:text-rouge-100"
                    )}>
                      {getGuideText(tutorial.id, 'name', tutorial.name)}
                    </p>
                    {isDone && (
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-noir-500 leading-snug mt-0.5 line-clamp-1">
                    {getGuideText(tutorial.id, 'description', tutorial.description)}
                  </p>
                </div>
                
                {/* Arrow */}
                {!isDone && (
                  <ChevronRight className="h-4 w-4 text-noir-600 group-hover:text-rouge-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        {completed.length > 0 && (
          <div className="p-2 border-t border-noir-800/60">
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-noir-400 hover:text-white hover:bg-noir-800/50 transition-colors text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('tutorial.menu.resetAll')}
            </button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

