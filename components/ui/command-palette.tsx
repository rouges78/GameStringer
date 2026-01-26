'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Home, 
  Gamepad2, 
  Sparkles, 
  Wand2, 
  Globe, 
  Settings,
  Layers,
  FolderOpen,
  BarChart3,
  Cloud,
  FileText,
  Keyboard,
  Moon,
  Sun,
  RefreshCw,
  Database,
  Brain,
  Mic
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useTranslation } from '@/lib/i18n';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  category: 'navigation' | 'action' | 'settings';
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const { t } = useTranslation();

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    { id: 'dashboard', title: t('nav.dashboard'), description: t('commandPalette.dashboardDesc'), icon: <Home className="h-4 w-4" />, action: () => router.push('/'), keywords: ['home', 'main', 'dashboard'], category: 'navigation' },
    { id: 'library', title: t('nav.library'), description: t('commandPalette.libraryDesc'), icon: <Gamepad2 className="h-4 w-4" />, action: () => router.push('/library'), keywords: ['games', 'giochi', 'libreria'], category: 'navigation' },
    { id: 'translator', title: t('nav.translate'), description: t('commandPalette.translateDesc'), icon: <Sparkles className="h-4 w-4" />, action: () => router.push('/ai-translator'), keywords: ['translate', 'traduci', 'ai'], category: 'navigation' },
    { id: 'dictionary', title: t('nav.dictionary'), description: t('commandPalette.dictionaryDesc'), icon: <Database className="h-4 w-4" />, action: () => router.push('/memory'), keywords: ['dizionario', 'glossario', 'termini'], category: 'navigation' },
    { id: 'multiLlm', title: t('nav.multiLlm'), description: t('commandPalette.multiLlmDesc'), icon: <Brain className="h-4 w-4" />, action: () => router.push('/translator/compare'), keywords: ['compare', 'llm', 'ai'], category: 'navigation' },
    { id: 'voice', title: t('nav.voice'), description: t('commandPalette.voiceDesc'), icon: <Mic className="h-4 w-4" />, action: () => router.push('/voice-translator'), keywords: ['voice', 'voce', 'audio'], category: 'navigation' },
    { id: 'patcher', title: t('nav.patcher'), description: t('commandPalette.patcherDesc'), icon: <Wand2 className="h-4 w-4" />, action: () => router.push('/unity-patcher'), keywords: ['unity', 'patch', 'bepinex'], category: 'navigation' },
    { id: 'community', title: t('nav.community'), description: t('commandPalette.communityDesc'), icon: <Globe className="h-4 w-4" />, action: () => router.push('/community-hub'), keywords: ['hub', 'share', 'comunità'], category: 'navigation' },
    { id: 'settings', title: t('nav.settings'), description: t('commandPalette.settingsDesc'), icon: <Settings className="h-4 w-4" />, action: () => router.push('/settings'), keywords: ['config', 'options', 'impostazioni'], category: 'navigation' },
    { id: 'batch', title: t('nav.batch'), description: t('commandPalette.batchDesc'), icon: <Layers className="h-4 w-4" />, action: () => router.push('/batch'), keywords: ['queue', 'multiple', 'batch'], category: 'navigation' },
    { id: 'projects', title: t('commandPalette.projects'), description: t('commandPalette.projectsDesc'), icon: <FolderOpen className="h-4 w-4" />, action: () => router.push('/projects'), keywords: ['project', 'save', 'progetti'], category: 'navigation' },
    { id: 'stats', title: t('commandPalette.stats'), description: t('commandPalette.statsDesc'), icon: <BarChart3 className="h-4 w-4" />, action: () => router.push('/stats'), keywords: ['analytics', 'progress', 'statistiche'], category: 'navigation' },
    
    // Actions
    { id: 'scan', title: t('commandPalette.scanGames'), description: t('commandPalette.scanGamesDesc'), icon: <RefreshCw className="h-4 w-4" />, action: () => { window.dispatchEvent(new CustomEvent('scan-games')); }, keywords: ['refresh', 'find', 'scansiona'], category: 'action' },
    { id: 'shortcuts', title: t('commandPalette.shortcuts'), description: t('commandPalette.shortcutsDesc'), icon: <Keyboard className="h-4 w-4" />, action: () => { window.dispatchEvent(new CustomEvent('show-shortcuts')); }, keywords: ['keyboard', 'hotkeys', 'scorciatoie'], category: 'action' },
    
    // Settings
    { id: 'theme-dark', title: t('commandPalette.darkTheme'), description: t('commandPalette.darkThemeDesc'), icon: <Moon className="h-4 w-4" />, action: () => setTheme('dark'), keywords: ['dark', 'night', 'scuro'], category: 'settings' },
    { id: 'theme-light', title: t('commandPalette.lightTheme'), description: t('commandPalette.lightThemeDesc'), icon: <Sun className="h-4 w-4" />, action: () => setTheme('light'), keywords: ['light', 'day', 'chiaro'], category: 'settings' },
  ], [router, setTheme, t]);

  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    const query = search.toLowerCase();
    return commands.filter(cmd => 
      cmd.title.toLowerCase().includes(query) ||
      cmd.description?.toLowerCase().includes(query) ||
      cmd.keywords?.some(k => k.includes(query))
    );
  }, [commands, search]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      action: [],
      settings: []
    };
    filteredCommands.forEach(cmd => {
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setOpen(prev => !prev);
    }
    
    if (!open) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
      e.preventDefault();
      filteredCommands[selectedIndex].action();
      setOpen(false);
      setSearch('');
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
    }
  }, [open, filteredCommands, selectedIndex]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const executeCommand = (cmd: CommandItem) => {
    cmd.action();
    setOpen(false);
    setSearch('');
  };

  const categoryLabels: Record<string, string> = {
    navigation: t('commandPalette.navigation'),
    action: t('commandPalette.actions'),
    settings: t('commandPalette.settings')
  };

  let flatIndex = 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Command Palette</DialogTitle>
        </VisuallyHidden>
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground mr-2" />
          <Input
            placeholder={t('commandPalette.placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 h-12 text-base"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>
        
        <ScrollArea className="max-h-[300px]">
          {filteredCommands.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t('commandPalette.noResults')} "{search}"
            </div>
          ) : (
            <div className="p-2">
              {Object.entries(groupedCommands).map(([category, items]) => {
                if (items.length === 0) return null;
                return (
                  <div key={category} className="mb-2">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {categoryLabels[category]}
                    </div>
                    {items.map((cmd) => {
                      const currentIndex = flatIndex++;
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => executeCommand(cmd)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                            currentIndex === selectedIndex
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <div className={cn(
                            "flex items-center justify-center h-8 w-8 rounded-lg",
                            currentIndex === selectedIndex ? "bg-primary/20" : "bg-muted"
                          )}>
                            {cmd.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{cmd.title}</div>
                            {cmd.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {cmd.description}
                              </div>
                            )}
                          </div>
                          {currentIndex === selectedIndex && (
                            <kbd className="hidden sm:inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px]">
                              ↵
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px]">↑↓</kbd>
            <span>navigate</span>
            <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px]">↵</kbd>
            <span>select</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px]">Ctrl</kbd>
            <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px]">K</kbd>
            <span>open/close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CommandPalette;



