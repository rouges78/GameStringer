'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from 'radix-ui';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Home, 
  Library, 
  Languages, 
  Brain, 
  Mic, 
  Wrench, 
  Puzzle, 
  Scan, 
  Wand2, 
  Subtitles,
  Users,
  Package,
  Settings,
  Database,
  ArrowRight,
  Gamepad2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface SearchItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  category: 'navigation' | 'tool' | 'game';
  image?: string;
}

interface LibraryGame {
  id: string;
  title: string;
  platform?: string;
  image?: string;
  appId?: string;
}

const navigationItems: SearchItem[] = [
  { id: 'dashboard', title: 'Dashboard', description: 'General overview', icon: Home, path: '/', category: 'navigation' },
  { id: 'library', title: 'Library', description: 'Your games', icon: Library, path: '/library', category: 'navigation' },
  { id: 'translator', title: 'Translate', description: 'AI Translator', icon: Languages, path: '/ai-translator', category: 'navigation' },
  { id: 'dictionary', title: 'Dictionary', description: 'Terms glossary', icon: Database, path: '/memory', category: 'navigation' },
  { id: 'multi-llm', title: 'Multi-LLM', description: 'AI models comparison', icon: Brain, path: '/translator/compare', category: 'navigation' },
  { id: 'voice', title: 'Voice', description: 'Voice translation', icon: Mic, path: '/voice-translator', category: 'navigation' },
  { id: 'patcher', title: 'Patcher', description: 'Unity/Unreal patcher', icon: Wrench, path: '/unity-patcher', category: 'navigation' },
  { id: 'injector', title: 'Injector', description: 'Universal mod injection', icon: Puzzle, path: '/injector', category: 'navigation' },
  { id: 'crawler', title: 'Crawler', description: 'Extract context from games', icon: Scan, path: '/context-harvester', category: 'navigation' },
  { id: 'fixer', title: 'Fixer', description: 'Fix translation tags', icon: Wand2, path: '/fixer', category: 'navigation' },
  { id: 'overlay', title: 'Overlay', description: 'In-game subtitles', icon: Subtitles, path: '/overlay', category: 'navigation' },
  { id: 'community', title: 'Community', description: 'Community translations hub', icon: Users, path: '/community-hub', category: 'navigation' },
  { id: 'patch-hub', title: 'Patch Hub', description: 'Translation packs', icon: Package, path: '/patch-hub', category: 'navigation' },
  { id: 'settings', title: 'Settings', description: 'Configure GameStringer', icon: Settings, path: '/settings', category: 'navigation' },
];

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [games, setGames] = useState<LibraryGame[]>([]);
  const router = useRouter();

  // Load games from library cache on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cached = sessionStorage.getItem('gs_library_games');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setGames(parsed.slice(0, 500)); // Limit to 500 games for performance
        }
      }
    } catch {}
  }, [open]);

  // Convert games to search items
  const gameItems: SearchItem[] = games
    .filter(g => g.title?.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10) // Max 10 game results
    .map(g => ({
      id: `game_${g.id}`,
      title: g.title,
      description: g.platform || 'Game',
      icon: Gamepad2,
      path: `/library/${g.id}`,
      category: 'game' as const,
      image: g.image || undefined
    }));

  // Filter navigation items
  const navItems = navigationItems.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.description.toLowerCase().includes(query.toLowerCase())
  );

  // Combine: nav items first, then games (only if query is not empty)
  const filteredItems = query.length >= 2 
    ? [...navItems, ...gameItems]
    : navItems;

  const handleSelect = useCallback((item: SearchItem) => {
    router.push(item.path);
    onOpenChange(false);
    setQuery('');
  }, [router, onOpenChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
      handleSelect(filteredItems[selectedIndex]);
    }
  }, [filteredItems, selectedIndex, handleSelect]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Backdrop blur overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[60]" />
      )}
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden z-[70]">
        <VisuallyHidden.Root>
          <DialogTitle>{t('globalSearchComp.globalSearch')}</DialogTitle>
        </VisuallyHidden.Root>
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search" placeholder="Search pages, tools..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-2xs font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>
        
        <ScrollArea className="max-h-[400px]">
          {filteredItems.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {query.length < 2 ? 'Type at least 2 characters to search games...' : `No results for "${query}"`}
            </div>
          ) : (
            <div className="p-2">
              {/* Show category labels */}
              {navItems.length > 0 && query.length >= 2 && (
                <div className="px-3 py-1 text-2xs font-medium text-muted-foreground uppercase tracking-wider">
                  Pages
                </div>
              )}
              {filteredItems.map((item, index) => {
                const Icon = item.icon;
                const isGame = item.category === 'game';
                const showGameLabel = isGame && index === navItems.length && gameItems.length > 0;
                
                return (
                  <div key={item.id}>
                    {showGameLabel && (
                      <div className="px-3 py-1 mt-2 text-2xs font-medium text-muted-foreground uppercase tracking-wider border-t pt-2">
                        🎮 Games ({gameItems.length})
                      </div>
                    )}
                    <button
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors",
                        index === selectedIndex 
                          ? "bg-accent text-accent-foreground" 
                          : "hover:bg-muted"
                      )}
                    >
                      {isGame && item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.title}
                          className="w-10 h-10 rounded-lg object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
                          isGame ? "bg-purple-500/20" : (index === selectedIndex ? "bg-primary/20" : "bg-muted")
                        )}>
                          <Icon className={cn("h-4 w-4", isGame && "text-purple-400")} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-2xs">↑↓</kbd>
            <span>{t('globalSearchComp.navigate')}</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-2xs">{t('globalSearchComp.enter')}</kbd>
            <span>{t('globalSearchComp.open')}</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-2xs">{t('globalSearchComp.ctrlk')}</kbd>
            <span>{t('globalSearchComp.search')}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}




