'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { HelpCircle, Play, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useTutorial, getCompletedTutorials } from './tutorial-provider';
import { getAllTutorials } from '@/lib/tutorial-configs';
import type { TutorialConfig } from '@/lib/types/tutorial';

interface TutorialMenuProps {
  userId?: string;
}

export function TutorialMenu({ userId }: TutorialMenuProps) {
  const { startTutorial, isActive } = useTutorial();
  const [open, setOpen] = useState(false);

  const allTutorials = getAllTutorials();
  const completed = typeof window !== 'undefined' ? getCompletedTutorials() : [];

  const handleStart = (tutorial: TutorialConfig) => {
    setOpen(false);
    // Piccolo delay per chiudere il menu prima di aprire il tutorial
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

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-300"
          disabled={isActive}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-slate-400">Tutorial disponibili</p>
        </div>
        <DropdownMenuSeparator />
        {allTutorials.map((tutorial) => {
          const isDone = completed.includes(tutorial.id);
          return (
            <DropdownMenuItem
              key={tutorial.id}
              onClick={() => handleStart(tutorial)}
              className="flex items-center gap-2 cursor-pointer"
            >
              {isDone ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : (
                <Play className="h-3.5 w-3.5 text-purple-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{tutorial.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{tutorial.description}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
        {completed.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleReset}
              className="flex items-center gap-2 cursor-pointer text-slate-400"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">Reset tutti i tutorial</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
