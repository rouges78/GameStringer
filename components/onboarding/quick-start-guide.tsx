'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Gamepad2, Languages, Brain, ChevronRight, 
  CheckCircle2, Sparkles, X, Rocket
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

const QUICK_START_KEY = 'gamestringer_quick_start_dismissed';

interface QuickStartStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  action: string;
  href: string;
}

export function QuickStartGuide() {
  const { t: _t } = useTranslation();
  const [isDismissed, setIsDismissed] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(QUICK_START_KEY);
      const completed = localStorage.getItem('gamestringer_quick_start_completed');
      setIsDismissed(dismissed === 'true');
      if (completed) {
        setCompletedSteps(JSON.parse(completed));
      }
    }
  }, []);

  const steps: QuickStartStep[] = [
    {
      id: 'scan-library',
      title: '1. Scansiona la Libreria',
      description: 'Trova automaticamente i tuoi giochi da Steam, Epic, GOG e altri store',
      icon: Gamepad2,
      color: 'text-teal-500',
      action: 'Scansiona Giochi',
      href: '/library'
    },
    {
      id: 'setup-ai',
      title: '2. Configura l\'AI',
      description: 'Installa Ollama (gratuito) o connetti OpenAI per traduzioni di qualità',
      icon: Brain,
      color: 'text-violet-500',
      action: 'Configura AI',
      href: '/settings'
    },
    {
      id: 'translate',
      title: '3. Traduci un Gioco',
      description: 'Seleziona un gioco e avvia la traduzione automatica',
      icon: Languages,
      color: 'text-blue-500',
      action: 'Vai al Traduttore',
      href: '/ai-translator'
    }
  ];

  const markStepComplete = (stepId: string) => {
    const newCompleted = [...completedSteps, stepId];
    setCompletedSteps(newCompleted);
    localStorage.setItem('gamestringer_quick_start_completed', JSON.stringify(newCompleted));
  };

  const dismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(QUICK_START_KEY, 'true');
  };

  const allComplete = completedSteps.length >= steps.length;

  if (isDismissed) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Guida Rapida</CardTitle>
            <Badge variant="secondary" className="ml-2">
              {completedSteps.length}/{steps.length}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={dismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step) => {
          const isComplete = completedSteps.includes(step.id);
          const Icon = step.icon;
          
          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-4 p-3 rounded-lg transition-all',
                isComplete 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : 'bg-muted/50 hover:bg-muted'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                isComplete ? 'bg-green-500/20' : 'bg-muted'
              )}>
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Icon className={cn('h-5 w-5', step.color)} />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className={cn(
                  'font-medium text-sm',
                  isComplete && 'line-through text-muted-foreground'
                )}>
                  {step.title}
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                  {step.description}
                </p>
              </div>

              {!isComplete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    markStepComplete(step.id);
                    window.location.href = step.href;
                  }}
                >
                  {step.action}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          );
        })}

        {allComplete && (
          <div className="text-center py-4">
            <Sparkles className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-500">
              Configurazione completata! 🎉
            </p>
            <Button variant="link" size="sm" onClick={dismiss}>
              Nascondi guida
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default QuickStartGuide;
