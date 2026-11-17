'use client';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { NetworkStatusChip } from '@/components/layout/network-status-bar';

interface StatusLineProps {
  ollamaOnline: boolean | null;
  version: string;
  onOpenChangelog: () => void;
}

/**
 * Barra di stato in basso (identità B + C, dal lato "Hex"): rete, modello
 * locale, scorciatoia dei comandi, sito e versione. Raccoglie ciò che prima
 * stava in un riquadro dell'header e nella barra rossa dell'offline.
 *
 * Ollama spento non è un errore — molti usano provider cloud — quindi il suo
 * LED è grigio, non rosso.
 */
export function StatusLine({ ollamaOnline, version, onOpenChangelog }: StatusLineProps) {
  const { t } = useTranslation();

  return (
    <footer className="flex h-7 shrink-0 items-stretch border-t border-border bg-[hsl(var(--sidebar-bg))] font-mono text-[11px] text-muted-foreground">
      <NetworkStatusChip />
      <span className="flex items-center gap-1.5 border-r border-border px-3">
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5', ollamaOnline ? 'bg-success' : 'bg-muted-foreground/60')}
        />
        {ollamaOnline === null ? t('statusLine.ollamaChecking') : ollamaOnline ? t('statusLine.ollamaOn') : t('statusLine.ollamaOff')}
      </span>

      <span className="ml-auto flex items-center gap-1.5 border-l border-border px-3">
        <kbd className="rounded-sm border border-border border-b-2 bg-secondary px-1 text-[10px] text-foreground">Ctrl K</kbd>
        {t('statusLine.commands')}
      </span>
      <a
        href="https://www.gamestringer.ai/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center border-l border-border px-3 hover:bg-accent hover:text-foreground"
        title={t('mainLayout.visitSite')}
      >
        gamestringer.ai
      </a>
      <button
        type="button"
        onClick={onOpenChangelog}
        className="flex items-center border-l border-border px-3 hover:bg-accent hover:text-foreground"
        title={t('common.changelog')}
      >
        v{version}
      </button>
    </footer>
  );
}
