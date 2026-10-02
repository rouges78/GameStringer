'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from 'radix-ui';
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from '@/components/ui/command';
import { 
  Home, 
  Gamepad2, 
  Sparkles, 
  Wand2, 
  Globe, 
  Settings,
  Layers,
  FolderOpen,
  BarChart3,
  FileText,
  Keyboard,
  Moon,
  RefreshCw,
  Database,
  Brain,
  Mic,
  BookOpen,
  Scan,
  ShoppingBag,
  Package,
  Workflow,
  ShieldCheck,
  Eye,
  Puzzle
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from '@/lib/i18n';

interface PaletteCommand {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  category: 'navigation' | 'action' | 'settings';
  /** Fuori dalla palette finché la pagina non funziona: torna togliendo il flag. */
  hidden?: boolean;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();
  const { setTheme, theme: _theme } = useTheme();
  const { t } = useTranslation();

  const commands: PaletteCommand[] = useMemo(() => [
    // Navigation
    { id: 'dashboard', title: t('nav.dashboard'), description: t('commandPalette.dashboardDesc'), icon: <Home className="h-4 w-4" />, action: () => router.push('/'), keywords: ['home', 'main', 'dashboard'], category: 'navigation' },
    { id: 'library', title: t('nav.library'), description: t('commandPalette.libraryDesc'), icon: <Gamepad2 className="h-4 w-4" />, action: () => router.push('/library'), keywords: ['games', 'giochi', 'libreria'], category: 'navigation' },
    { id: 'translator', title: t('nav.translate'), description: t('commandPalette.translateDesc'), icon: <Sparkles className="h-4 w-4" />, action: () => router.push('/ai-translator'), keywords: ['translate', 'traduci', 'ai'], category: 'navigation' },
    { id: 'dictionary', title: t('nav.dictionary'), description: t('commandPalette.dictionaryDesc'), icon: <Database className="h-4 w-4" />, action: () => router.push('/memory'), keywords: ['dizionario', 'glossario', 'termini'], category: 'navigation' },
    { id: 'multiLlm', title: t('nav.multiLlm'), description: t('commandPalette.multiLlmDesc'), icon: <Brain className="h-4 w-4" />, action: () => router.push('/translator/compare'), keywords: ['compare', 'llm', 'ai'], category: 'navigation' },
    { id: 'voice', title: t('nav.voice'), description: t('commandPalette.voiceDesc'), icon: <Mic className="h-4 w-4" />, action: () => router.push('/voice-translator'), keywords: ['voice', 'voce', 'audio'], category: 'navigation' },
    { id: 'patcher', title: t('nav.patcher'), description: t('commandPalette.patcherDesc'), icon: <Wand2 className="h-4 w-4" />, action: () => router.push('/unity-patcher'), keywords: ['unity', 'patch', 'bepinex'], category: 'navigation' },
    { id: 'community', title: t('nav.community'), description: t('commandPalette.communityDesc'), icon: <Globe className="h-4 w-4" />, action: () => router.push('/community-hub'), keywords: ['hub', 'share', 'comunità'], category: 'navigation' },
    { id: 'patch-hub', title: t('patchHubPage.title'), description: t('patchHubPage.subtitle'), icon: <Package className="h-4 w-4" />, action: () => router.push('/patch-hub'), keywords: ['patch', 'pack', 'traduzioni', 'hub'], category: 'navigation' },
    { id: 'settings', title: t('nav.settings'), description: t('commandPalette.settingsDesc'), icon: <Settings className="h-4 w-4" />, action: () => router.push('/settings'), keywords: ['config', 'options', 'impostazioni'], category: 'navigation' },
    // Batch nascosti: /batch dichiara "non implementato" con Avvia disabilitato, e
    // /batch-translation fa fallire ogni job con BATCH_NON_IMPLEMENTATO.
    { id: 'batch', title: t('nav.batch'), description: t('commandPalette.batchDesc'), icon: <Layers className="h-4 w-4" />, action: () => router.push('/batch'), keywords: ['queue', 'multiple', 'batch'], category: 'navigation', hidden: true },
    { id: 'guide', title: t('nav.guide'), description: t('commandPalette.settingsDesc'), icon: <FolderOpen className="h-4 w-4" />, action: () => router.push('/guide'), keywords: ['guide', 'help', 'guida'], category: 'navigation' },
    { id: 'stats', title: t('commandPalette.stats'), description: t('commandPalette.statsDesc'), icon: <BarChart3 className="h-4 w-4" />, action: () => router.push('/stats'), keywords: ['analytics', 'progress', 'statistiche'], category: 'navigation' },
    { id: 'glossary', title: t('nav.glossary'), description: t('commandPalette.dictionaryDesc'), icon: <BookOpen className="h-4 w-4" />, action: () => router.push('/glossary'), keywords: ['glossary', 'terms', 'glossario'], category: 'navigation' },
    { id: 'editor', title: t('nav.editor'), description: t('editor.subtitle'), icon: <FileText className="h-4 w-4" />, action: () => router.push('/editor'), keywords: ['edit', 'editor', 'modifica'], category: 'navigation' },
    { id: 'ocr', title: t('nav.ocrTranslator'), description: t('ocrTranslator.subtitle'), icon: <Scan className="h-4 w-4" />, action: () => router.push('/ocr-translator'), keywords: ['ocr', 'screen', 'immagine', 'schermo'], category: 'navigation' },
    { id: 'stores', title: t('nav.stores'), description: t('stores.steam'), icon: <ShoppingBag className="h-4 w-4" />, action: () => router.push('/stores'), keywords: ['store', 'steam', 'epic', 'negozio'], category: 'navigation' },
    { id: 'batch-queue', title: t('nav.translationQueue'), description: t('commandPalette.batchDesc'), icon: <Layers className="h-4 w-4" />, action: () => router.push('/batch-translation'), keywords: ['queue', 'coda', 'batch'], category: 'navigation', hidden: true },
    { id: 'ai-pipeline', title: t('nav.aiPipeline'), description: t('aiTranslation.subtitle'), icon: <Workflow className="h-4 w-4" />, action: () => router.push('/ai-pipeline'), keywords: ['pipeline', 'workflow', 'qa'], category: 'navigation' },
    { id: 'qa-check', title: t('nav.qaCheck'), description: t('qaCheck.subtitle'), icon: <ShieldCheck className="h-4 w-4" />, action: () => router.push('/qa-check'), keywords: ['quality', 'check', 'qualità'], category: 'navigation' },
    { id: 'vision', title: t('nav.visionLlm'), description: t('aiTranslation.subtitle'), icon: <Eye className="h-4 w-4" />, action: () => router.push('/vision-translator'), keywords: ['vision', 'llm', 'visual', 'immagine'], category: 'navigation' },
    // Arrivavano da Ctrl+K solo tramite GlobalSearch, non più montata nel layout.
    { id: 'injector', title: t('nav.injector'), description: t('universalInjector.subtitle'), icon: <Puzzle className="h-4 w-4" />, action: () => router.push('/injector'), keywords: ['inject', 'mod', 'dll'], category: 'navigation' },
    { id: 'crawler', title: t('nav.contextHarvester'), description: t('contextHarvesterPage.subtitle'), icon: <Scan className="h-4 w-4" />, action: () => router.push('/context-harvester'), keywords: ['crawler', 'context', 'contesto'], category: 'navigation' },
    { id: 'fixer', title: t('nav.fixer'), description: t('translationFixer.subtitle'), icon: <Wand2 className="h-4 w-4" />, action: () => router.push('/fixer'), keywords: ['fix', 'tag', 'correggi'], category: 'navigation' },
    
    // Actions — nascoste: nessuno ascolta 'scan-games' né 'show-shortcuts', quindi
    // la voce chiudeva la palette senza fare nulla. Scansione: pulsante in Libreria;
    // scorciatoie: Ctrl+/.
    { id: 'scan', title: t('commandPalette.scanGames'), description: t('commandPalette.scanGamesDesc'), icon: <RefreshCw className="h-4 w-4" />, action: () => { window.dispatchEvent(new CustomEvent('scan-games')); }, keywords: ['refresh', 'find', 'scansiona'], category: 'action', hidden: true },
    { id: 'shortcuts', title: t('commandPalette.shortcuts'), description: t('commandPalette.shortcutsDesc'), icon: <Keyboard className="h-4 w-4" />, action: () => { window.dispatchEvent(new CustomEvent('show-shortcuts')); }, keywords: ['keyboard', 'hotkeys', 'scorciatoie'], category: 'action', hidden: true },
    
    // Settings (dark mode forzato — light non supportato)
    { id: 'theme-dark', title: t('commandPalette.darkTheme'), description: t('commandPalette.darkThemeDesc'), icon: <Moon className="h-4 w-4" />, action: () => setTheme('dark'), keywords: ['dark', 'night', 'scuro'], category: 'settings' },
  ], [router, setTheme, t]);

  const filteredCommands = useMemo(() => {
    const visible = commands.filter(cmd => !cmd.hidden);
    if (!search) return visible;
    const query = search.toLowerCase();
    return visible.filter(cmd => 
      cmd.title.toLowerCase().includes(query) ||
      cmd.description?.toLowerCase().includes(query) ||
      cmd.keywords?.some(k => k.includes(query))
    );
  }, [commands, search]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, PaletteCommand[]> = {
      navigation: [],
      action: [],
      settings: []
    };
    filteredCommands.forEach(cmd => {
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Su window resta SOLO Ctrl+K. Frecce e Invio li gestisce cmdk sul proprio
  // input: il vecchio listener su window eseguiva il comando selezionato qui
  // anche quando Invio era premuto in un altro dialog (es. Dashboard).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const executeCommand = (cmd: PaletteCommand) => {
    cmd.action();
    setOpen(false);
  };

  const categoryLabels: Record<string, string> = {
    navigation: t('commandPalette.navigation'),
    action: t('commandPalette.actions'),
    settings: t('commandPalette.settings')
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden">
        <VisuallyHidden.Root>
          <DialogTitle>{t('globalSearchComp.globalSearch')}</DialogTitle>
        </VisuallyHidden.Root>
        {/* Filtro nostro (sottostringa su titolo/descrizione/keyword), cmdk solo per tastiera e selezione */}
        <Command shouldFilter={false} className="rounded-none bg-transparent text-inherit">
          <CommandInput
            placeholder={t('commandPalette.placeholder')}
            value={search}
            onValueChange={setSearch}
            className="h-12 pr-8 text-base"
            autoFocus
          />
          <CommandList className="p-1">
            {filteredCommands.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t('commandPalette.noResults')} &quot;{search}&quot;
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, items]) => {
                if (items.length === 0) return null;
                return (
                  <CommandGroup key={category} heading={categoryLabels[category]}>
                    {items.map((cmd) => (
                      <CommandItem
                        key={cmd.id}
                        value={cmd.id}
                        onSelect={() => executeCommand(cmd)}
                        className="group gap-3 px-3 py-2 rounded-lg cursor-pointer"
                      >
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted group-data-[selected=true]:bg-primary/20">
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
                        <kbd className="hidden group-data-[selected=true]:inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-2xs">
                          ↵
                        </kbd>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })
            )}
          </CommandList>
        </Command>

        <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-2xs">↑↓</kbd>
            <span>{t('globalSearchComp.navigate')}</span>
            <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-2xs">{t('globalSearchComp.enter')}</kbd>
            <span>{t('globalSearchComp.open')}</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-2xs">{t('globalSearchComp.ctrlk')}</kbd>
            <span>{t('globalSearchComp.search')}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CommandPalette;




