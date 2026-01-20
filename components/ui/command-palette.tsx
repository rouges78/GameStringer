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
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

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

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    { id: 'dashboard', title: 'Dashboard', description: 'Go to dashboard', icon: <Home className="h-4 w-4" />, action: () => router.push('/'), keywords: ['home', 'main'], category: 'navigation' },
    { id: 'library', title: 'Library', description: 'Browse your games', icon: <Gamepad2 className="h-4 w-4" />, action: () => router.push('/library'), keywords: ['games', 'games'], category: 'navigation' },
    { id: 'translator', title: 'Translate', description: 'AI Translation Assistant', icon: <Sparkles className="h-4 w-4" />, action: () => router.push('/ai-translator'), keywords: ['translate', 'ai'], category: 'navigation' },
    { id: 'patcher', title: 'Patcher', description: 'Unity/Unreal Patcher', icon: <Wand2 className="h-4 w-4" />, action: () => router.push('/unity-patcher'), keywords: ['unity', 'patch', 'bepinex'], category: 'navigation' },
    { id: 'community', title: 'Community', description: 'Community hub', icon: <Globe className="h-4 w-4" />, action: () => router.push('/community-hub'), keywords: ['hub', 'share'], category: 'navigation' },
    { id: 'settings', title: 'Settings', description: 'Configure GameStringer', icon: <Settings className="h-4 w-4" />, action: () => router.push('/settings'), keywords: ['config', 'options'], category: 'navigation' },
    { id: 'batch', title: 'Batch Translation', description: 'Translate multiple files in queue', icon: <Layers className="h-4 w-4" />, action: () => router.push('/batch-translation'), keywords: ['queue', 'multiple'], category: 'navigation' },
    { id: 'projects', title: 'Projects', description: 'Manage .gsproj projects', icon: <FolderOpen className="h-4 w-4" />, action: () => router.push('/projects'), keywords: ['project', 'save'], category: 'navigation' },
    { id: 'stats', title: 'Statistics', description: 'Statistics dashboard', icon: <BarChart3 className="h-4 w-4" />, action: () => router.push('/stats'), keywords: ['analytics', 'progress'], category: 'navigation' },
    { id: 'workshop', title: 'Steam Workshop', description: 'Download translations', icon: <Cloud className="h-4 w-4" />, action: () => router.push('/workshop'), keywords: ['steam', 'download'], category: 'navigation' },
    
    // Actions
    { id: 'scan', title: 'Scan Games', description: 'Search for new installed games', icon: <RefreshCw className="h-4 w-4" />, action: () => { window.dispatchEvent(new CustomEvent('scan-games')); }, keywords: ['refresh', 'find'], category: 'action' },
    { id: 'shortcuts', title: 'Keyboard Shortcuts', description: 'Show all shortcuts', icon: <Keyboard className="h-4 w-4" />, action: () => { window.dispatchEvent(new CustomEvent('show-shortcuts')); }, keywords: ['keyboard', 'hotkeys'], category: 'action' },
    
    // Settings
    { id: 'theme-dark', title: 'Dark Theme', description: 'Enable dark theme', icon: <Moon className="h-4 w-4" />, action: () => setTheme('dark'), keywords: ['dark', 'night'], category: 'settings' },
    { id: 'theme-light', title: 'Light Theme', description: 'Enable light theme', icon: <Sun className="h-4 w-4" />, action: () => setTheme('light'), keywords: ['light', 'day'], category: 'settings' },
  ], [router, setTheme]);

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
    navigation: 'Navigation',
    action: 'Actions',
    settings: 'Settings'
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
            placeholder="Cerca comandi, pagine, azioni..."
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
              No results for "{search}"
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



