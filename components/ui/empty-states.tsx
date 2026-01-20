'use client';

import { Button } from '@/components/ui/button';
import { 
  Gamepad2, 
  FileText, 
  Languages, 
  FolderOpen, 
  Search,
  Plus,
  Download,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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
  return (
    <EmptyState
      icon={<Gamepad2 className="h-12 w-12" />}
      title="No games found"
      description="We couldn't find games in your library. Scan to find installed games or manually add a folder."
      action={{
        label: "Scan Games",
        onClick: onScan
      }}
      secondaryAction={{
        label: "Settings",
        href: "/settings"
      }}
    />
  );
}

export function EmptyTranslations() {
  return (
    <EmptyState
      icon={<Languages className="h-12 w-12" />}
      title="No translations"
      description="You haven't created any translations yet. Start by selecting a game from the library or uploading a text file."
      action={{
        label: "Start Translating",
        href: "/ai-translator"
      }}
      secondaryAction={{
        label: "Browse Library",
        href: "/library"
      }}
    />
  );
}

export function EmptyProjects() {
  return (
    <EmptyState
      icon={<FolderOpen className="h-12 w-12" />}
      title="No projects"
      description="Projects allow you to save and organize your translations. Create your first project to get started."
      action={{
        label: "New Project",
        href: "/projects"
      }}
    />
  );
}

export function EmptySearch({ query }: { query: string }) {
  return (
    <EmptyState
      icon={<Search className="h-12 w-12" />}
      title="No results"
      description={`No results found for "${query}". Try different terms or check your filters.`}
    />
  );
}

export function EmptyQueue() {
  return (
    <EmptyState
      icon={<FileText className="h-12 w-12" />}
      title="Queue empty"
      description="The translation queue is empty. Add files or games to start batch translation."
      action={{
        label: "Add to Queue",
        href: "/batch-translation"
      }}
    />
  );
}

export function EmptyWorkshop() {
  return (
    <EmptyState
      icon={<Download className="h-12 w-12" />}
      title="No translations found"
      description="No translations available for the selected filters. Try modifying your search or filters."
    />
  );
}

export function EmptyActivity() {
  return (
    <EmptyState
      icon={<Sparkles className="h-12 w-12" />}
      title="No recent activity"
      description="Your recent actions will appear here. Start by exploring the library or creating a translation."
      action={{
        label: "Explore Library",
        href: "/library"
      }}
      className="py-8"
    />
  );
}



