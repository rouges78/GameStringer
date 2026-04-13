'use client';

import { Button } from '@/components/ui/button';
import { 
  Gamepad2, 
  FileText, 
  Languages, 
  FolderOpen, 
  Search,
  Download,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action, 
  secondaryAction,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      {icon && (
        <div className="mb-4 p-4 rounded-2xl bg-muted/50 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      
      <div className="flex items-center gap-3">
        {action && (
          action.href ? (
            <Link href={action.href}>
              <Button>{action.label}</Button>
            </Link>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )
        )}
        {secondaryAction && (
          secondaryAction.href ? (
            <Link href={secondaryAction.href}>
              <Button variant="outline">{secondaryAction.label}</Button>
            </Link>
          ) : (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )
        )}
      </div>
    </div>
  );
}

export function EmptyGames({ onScan }: { onScan?: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<Gamepad2 className="h-12 w-12" />}
      title={t('emptyStates.noGames')}
      description={t('emptyStates.noGamesDesc')}
      action={{
        label: t('emptyStates.scanGames'),
        onClick: onScan
      }}
      secondaryAction={{
        label: t('settings.title'),
        href: "/settings"
      }}
    />
  );
}

export function EmptyTranslations() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<Languages className="h-12 w-12" />}
      title={t('emptyStates.noTranslations')}
      description={t('emptyStates.noTranslationsDesc')}
      action={{
        label: t('emptyStates.startTranslating'),
        href: "/ai-translator"
      }}
      secondaryAction={{
        label: t('emptyStates.browseLibrary'),
        href: "/library"
      }}
    />
  );
}

export function EmptyProjects() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<FolderOpen className="h-12 w-12" />}
      title={t('emptyStates.noProjects')}
      description={t('emptyStates.noProjectsDesc')}
      action={{
        label: t('emptyStates.newProject'),
        href: "/projects"
      }}
    />
  );
}

export function EmptySearch({ query }: { query: string }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<Search className="h-12 w-12" />}
      title={t('emptyStates.noResults')}
      description={t('emptyStates.noResultsDesc').replace('{query}', query)}
    />
  );
}

export function EmptyQueue() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<FileText className="h-12 w-12" />}
      title={t('emptyStates.queueEmpty')}
      description={t('emptyStates.queueEmptyDesc')}
      action={{
        label: t('emptyStates.addToQueue'),
        href: "/batch-translation"
      }}
    />
  );
}

export function EmptyWorkshop() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<Download className="h-12 w-12" />}
      title={t('emptyStates.noWorkshop')}
      description={t('emptyStates.noWorkshopDesc')}
    />
  );
}

export function EmptyActivity() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<Sparkles className="h-12 w-12" />}
      title={t('emptyStates.noActivity')}
      description={t('emptyStates.noActivityDesc')}
      action={{
        label: t('emptyStates.exploreLibrary'),
        href: "/library"
      }}
      className="py-8"
    />
  );
}



