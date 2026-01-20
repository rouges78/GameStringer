'use client';

import { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle, Info, AlertCircle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfoTooltipProps {
  content: ReactNode;
  children?: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  variant?: 'default' | 'info' | 'warning' | 'tip';
  className?: string;
  iconSize?: 'sm' | 'md' | 'lg';
}

const variantStyles = {
  default: {
    icon: HelpCircle,
    iconClass: 'text-muted-foreground hover:text-foreground',
    contentClass: '',
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-500 hover:text-blue-400',
    contentClass: 'border-blue-500/30 bg-blue-500/10',
  },
  warning: {
    icon: AlertCircle,
    iconClass: 'text-amber-500 hover:text-amber-400',
    contentClass: 'border-amber-500/30 bg-amber-500/10',
  },
  tip: {
    icon: Lightbulb,
    iconClass: 'text-emerald-500 hover:text-emerald-400',
    contentClass: 'border-emerald-500/30 bg-emerald-500/10',
  },
};

const iconSizes = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function InfoTooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  variant = 'default',
  className,
  iconSize = 'md',
}: InfoTooltipProps) {
  const styles = variantStyles[variant];
  const Icon = styles.icon;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children || (
            <button className={cn(
              "inline-flex items-center justify-center transition-colors cursor-help",
              styles.iconClass,
              className
            )}>
              <Icon className={iconSizes[iconSize]} />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className={cn(
            "max-w-xs text-sm",
            styles.contentClass
          )}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Pre-built tooltips for common use cases
export function TranslationTooltip() {
  return (
    <InfoTooltip
      variant="info"
      content={
        <div className="space-y-1">
          <p className="font-medium">How translation works</p>
          <p className="text-xs text-muted-foreground">
            GameStringer uses local AI (Ollama) to translate texts. 
            Translations are saved in the dictionary for future reuse.
          </p>
        </div>
      }
    />
  );
}

export function PatcherTooltip() {
  return (
    <InfoTooltip
      variant="tip"
      content={
        <div className="space-y-1">
          <p className="font-medium">Unity Patcher</p>
          <p className="text-xs text-muted-foreground">
            Automatically installs BepInEx and XUnity.AutoTranslator 
            to apply translations to Unity games.
          </p>
        </div>
      }
    />
  );
}

export function BatchTooltip() {
  return (
    <InfoTooltip
      variant="info"
      content={
        <div className="space-y-1">
          <p className="font-medium">Batch Translation</p>
          <p className="text-xs text-muted-foreground">
            Add multiple files or games to the queue to translate them 
            automatically one after another.
          </p>
        </div>
      }
    />
  );
}

export function ApiKeyTooltip() {
  return (
    <InfoTooltip
      variant="warning"
      content={
        <div className="space-y-1">
          <p className="font-medium">API Key richiesta</p>
          <p className="text-xs text-muted-foreground">
            Alcune funzionalità richiedono una API key di Steam. 
            Puoi ottenerla su steamcommunity.com/dev/apikey
          </p>
        </div>
      }
    />
  );
}

export default InfoTooltip;
