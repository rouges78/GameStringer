'use client';

import { useState } from 'react';
import { HelpCircle, X, Lightbulb, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface FeatureTooltipProps {
  title: string;
  description: string;
  tips?: string[];
  learnMoreUrl?: string;
  children?: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function FeatureTooltip({
  title,
  description,
  tips,
  learnMoreUrl,
  children,
  side = 'right',
  className
}: FeatureTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon" className={cn("h-6 w-6", className)}>
            <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent side={side} className="w-80">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <h4 className="font-semibold">{title}</h4>
            <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 -mt-1" onClick={() => setIsOpen(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">{description}</p>
          
          {tips && tips.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs font-medium text-yellow-500">
                <Lightbulb className="h-3 w-3" />
                Suggerimenti
              </div>
              <ul className="space-y-1">
                {tips.map((tip, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {learnMoreUrl && (
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
              <a href={learnMoreUrl} target="_blank" rel="noopener noreferrer">
                Scopri di più
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface QuickTipProps {
  tip: string;
  variant?: 'info' | 'warning' | 'success';
  className?: string;
}

export function QuickTip({ tip, variant = 'info', className }: QuickTipProps) {
  const colors = {
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    success: 'bg-green-500/10 border-green-500/20 text-green-400'
  };

  return (
    <div className={cn(
      "flex items-start gap-2 p-3 rounded-lg border text-sm",
      colors[variant],
      className
    )}>
      <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <span>{tip}</span>
    </div>
  );
}

export default FeatureTooltip;



