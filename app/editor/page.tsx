'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FileText, Save, Languages, Search, Edit3, 
  CheckCircle, AlertCircle, Copy, Download, Upload,
  Loader2, ChevronRight, Sparkles,
  ArrowLeftRight, LayoutPanelLeft, X, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clientLogger } from '@/lib/client-logger';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import { notifications } from '@/lib/notifications';
import { offlineCache } from '@/lib/offline-cache';
import { TranslationImportDialog } from '@/components/translation-import-dialog';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ensureArray } from '@/lib/array-utils';
import { cn } from '@/lib/utils';
import { invoke } from '@/lib/tauri-api';
import { activityHistory } from '@/lib/activity-history';
import { useTranslation } from '@/lib/i18n';
import { storageManager } from '@/lib/storage-manager';
import { get, set } from 'idb-keyval';
import { loadGlossary, type AutoGlossaryEntry } from '@/lib/auto-glossary';
import { BookOpen, FolderTree, Globe } from 'lucide-react';

// --- Types ---
interface Game {
  id: string;
  title: string;
  platform: string;
  coverUrl?: string;
}

// Struttura gerarchica per Explorer
interface GameProject {
  game: Game;
  files: TranslatedFile[];
  totalStrings: number;
  completedStrings: number;
  lastUpdated: string;
}

interface TranslatedFile {
  id: string;
  filename: string;
  path: string;
  stringCount: number;
  completedCount: number;
  targetLanguage: string;
  sourceLanguage: string;
  lastUpdated: string;
}

interface AISuggestion {
  id: string;
  suggestion: string;
  confidence: number;
  provider: string;
}

interface ParsedLine {
  lineNumber: number;
  id: string;
  key: string;
  originalText: string;
  translatedText: string;
  raw: string;
  languageColumns?: string[]; // Per file multi-lingua: array di testi per ogni lingua
}

// Lingue supportate per file multi-lingua (ordine tipico nei file di localizzazione)
const _SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Francese' },
  { code: 'en', name: 'Inglese' },
  { code: 'de', name: 'Tedesco' },
  { code: 'es', name: 'Spagnolo' },
  { code: 'pl', name: 'Polacco' },
  { code: 'zh', name: 'Cinese' },
  { code: 'ja', name: 'Giapponese' },
  { code: 'ko', name: 'Coreano' },
  { code: 'ru', name: 'Russo' },
  { code: 'pt', name: 'Portoghese' },
  { code: 'it', name: 'Italiano' },
];

interface Translation {
  id: string;
  gameId: string;
  filePath: string;
  originalText: string;
  translatedText: string;
  targetLanguage: string;
  sourceLanguage: string;
  status: 'pending' | 'completed' | 'reviewed' | 'edited';
  confidence: number;
  isManualEdit: boolean;
  context?: string;
  updatedAt: string;
  game: Game;
  suggestions: AISuggestion[];
  parsedLines?: ParsedLine[];
}

// Rileva se un file è multi-lingua (ha colonne separate per ogni lingua)
function detectMultiLanguageFormat(content: string): boolean {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return false;
  
  // Controlla se le righe hanno pattern con ,, (separatori vuoti tra lingue)
  const sampleLine = lines.find(l => l.includes(',,'));
  return !!sampleLine;
}

// Parser per file di localizzazione (CSV-like, dialoghi)
function parseLocalizationContent(content: string, sourceLanguageIndex?: number): ParsedLine[] {
  const lines = content.split('\n');
  const parsed: ParsedLine[] = [];
  const isMultiLang = detectMultiLanguageFormat(content);
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // Pattern Decarnation/Unity: #ID,key,subkey,speaker,Speaker,text (6+ colonne)
    // Esempio: #2-05_Bargain,Bargain_dialog2.10,,gloria,Gloria,"Tu penses que..."
    const parts = trimmed.split(',');
    if (parts.length >= 5 && trimmed.startsWith('#')) {
      // Estrai ID e key dalle prime colonne
      const id = parts[0].replace(/^#/, '');
      const key = parts[1] || '';
      // Il testo è tutto dopo la 5a colonna (speaker name)
      const textParts = parts.slice(5);
      const text = textParts.join(',').replace(/^"|"$/g, '').trim();
      
      if (text) {
        parsed.push({
          lineNumber: index + 1,
          id,
          key,
          originalText: text,
          translatedText: '',
          raw: line
        });
        return;
      }
    }
    
    // Pattern CSV generico con almeno 4 colonne (potenzialmente multi-lingua)
    if (parts.length >= 4) {
      const id = parts[0].replace(/^#/, '') || `line_${index}`;
      const key = parts[1] || '';
      
      // Per file multi-lingua: estrai le colonne di testo separate da ,,
      const textPart = parts.slice(3).join(',');
      // Split per ,, per separare le lingue (pattern: "testo_fr,,testo_en,,testo_de")
      const langColumns = textPart.split(',,').map(t => t.replace(/^"|"$/g, '').trim()).filter(t => t);
      
      // Se abbiamo più colonne lingua, è un file multi-lingua
      if (isMultiLang && langColumns.length > 1) {
        const selectedText = sourceLanguageIndex !== undefined && langColumns[sourceLanguageIndex] 
          ? langColumns[sourceLanguageIndex] 
          : langColumns[0]; // Default: prima lingua
        
        parsed.push({
          lineNumber: index + 1,
          id,
          key,
          originalText: selectedText,
          translatedText: '',
          raw: line,
          languageColumns: langColumns
        });
        return;
      }
      
      // Altrimenti usa tutto il testo
      const text = textPart.replace(/^"|"$/g, '').trim();
      if (text && text.length > 2) {
        parsed.push({
          lineNumber: index + 1,
          id,
          key,
          originalText: text,
          translatedText: '',
          raw: line
        });
        return;
      }
    }
    
    // Pattern key=value (INI style)
    const iniMatch = trimmed.match(/^([^=]+)=(.*)$/);
    if (iniMatch) {
      parsed.push({
        lineNumber: index + 1,
        id: `line_${index}`,
        key: iniMatch[1],
        originalText: iniMatch[2],
        translatedText: '',
        raw: line
      });
      return;
    }
    
    // Linea generica (testo semplice, non commenti)
    if (trimmed.length > 3 && !trimmed.startsWith('//') && !trimmed.startsWith('#') && !trimmed.startsWith('[')) {
      parsed.push({
        lineNumber: index + 1,
        id: `line_${index}`,
        key: '',
        originalText: trimmed,
        translatedText: '',
        raw: line
      });
    }
  });
  
  return parsed;
}

export default function EditorPage() {
  // --- State ---
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [selectedTranslation, setSelectedTranslation] = useState<Translation | null>(null);
  const [selectedLine, setSelectedLine] = useState<ParsedLine | null>(null);
  const [_viewMode, _setViewMode] = useState<'lines' | 'full'>('lines');
  const [isMultiLangFile, setIsMultiLangFile] = useState(false);
  const [sourceLanguageIndex, setSourceLanguageIndex] = useState(0);
  const [_targetLanguageIndex, _setTargetLanguageIndex] = useState<number | null>(null); // null = nuova traduzione
  const [detectedLanguages, setDetectedLanguages] = useState<string[]>([]);
  const [rawContent, setRawContent] = useState<string>(''); // Per ri-parsare quando cambia lingua
  const [games, setGames] = useState<Game[]>([]);
  const [gameProjects, setGameProjects] = useState<GameProject[]>([]); // Gerarchia games con traduzioni
  const [selectedProject, setSelectedProject] = useState<GameProject | null>(null);
  const [selectedFile, setSelectedFile] = useState<TranslatedFile | null>(null);
  const [explorerView, setExplorerView] = useState<'games' | 'files' | 'strings'>('games');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterGame, setFilterGame] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveTimeoutId, setSaveTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [glossaryTerms, setGlossaryTerms] = useState<AutoGlossaryEntry[]>([]);
  const [showGlossaryPanel, setShowGlossaryPanel] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  // --- Derived State ---
  const filteredTranslations = useMemo(() => {
    return translations.filter(t => {
      const matchesGame = filterGame === 'all' || t.gameId === filterGame;
      const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
      const matchesSearch = !searchTerm || 
        t.originalText.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.translatedText.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesGame && matchesStatus && matchesSearch;
    });
  }, [translations, filterGame, filterStatus, searchTerm]);

  const stats = useMemo(() => {
    const total = filteredTranslations.length;
    const completed = filteredTranslations.filter(t => t.status === 'completed' || t.status === 'reviewed').length;
    const pending = filteredTranslations.filter(t => t.status === 'pending').length;
    const edited = filteredTranslations.filter(t => t.status === 'edited').length;
    return { total, completed, pending, edited };
  }, [filteredTranslations]);

  // --- Glossary matching: carica termini quando cambia la stringa selezionata ---
  useEffect(() => {
    if (!selectedTranslation?.gameId) {
      setGlossaryTerms([]);
      return;
    }
    const gameId = selectedTranslation.gameId;
    const sourceText = selectedLine?.originalText || selectedTranslation.originalText || '';
    if (!sourceText) {
      setGlossaryTerms([]);
      return;
    }
    const glossary = loadGlossary(gameId);
    if (!glossary || glossary.entries.length === 0) {
      setGlossaryTerms([]);
      return;
    }
    // Cerca termini che appaiono nel testo sorgente
    const lowerSource = sourceText.toLowerCase();
    const matching = glossary.entries.filter(entry =>
      lowerSource.includes(entry.sourceTerm.toLowerCase())
    );
    setGlossaryTerms(matching);
  }, [selectedTranslation?.gameId, selectedLine?.originalText, selectedTranslation?.originalText]);

  // --- Effects ---
  useEffect(() => {
    fetchGames();
    fetchGameProjects(); // Carica progetti con traduzioni
  }, []);

  useEffect(() => {
    // Non caricare traduzioni dal server se ci sono results parziali da Neural Translator
    const checkStorage = async () => {
      const hasPartialData = await storageManager.getPartialTranslations();
      const hasEditorFile = await storageManager.getEditorFile();
      if (!hasPartialData && !hasEditorFile) {
        fetchTranslations();
      }
    };
    checkStorage();
  }, [filterGame, filterStatus]);

  // Load from session storage (Neural Translator integration)
  useEffect(() => {
    const loadEditorFile = async () => {
      const data = await storageManager.getEditorFile();
      if (data) {
        try {
          const content = data.originalContent || data.content || '';
          setRawContent(content);
          
          // Rileva se è un file multi-lingua
          const isMultiLang = detectMultiLanguageFormat(content);
          setIsMultiLangFile(isMultiLang);
          
          // Se multi-lingua, rileva le lingue disponibili dalla prima riga con dati
          if (isMultiLang) {
            const lines = content.split('\n').filter((l: string) => l.trim());
            // Trova una riga con molti ,, per contare le lingue
            const sampleLines = lines.filter((l: string) => l.includes(',,'));
            if (sampleLines.length > 0) {
              // Conta quante volte appare ,, + 1 = numero di lingue
              const maxSeparators = Math.max(...sampleLines.slice(0, 10).map((l: string) => (l.match(/,,/g) || []).length));
              const langCount = maxSeparators + 1;
              // Genera nomi lingue basati sul numero di colonne trovate
              const defaultLangs = ['Francese', 'Inglese', 'Tedesco', 'Spagnolo', 'Polacco', 'Cinese', 'Giapponese', 'Coreano', 'Russo', 'Portoghese'];
              setDetectedLanguages(defaultLangs.slice(0, Math.min(langCount, defaultLangs.length)));
              clientLogger.debug(`[Editor] Rilevate ${langCount} lingue nel file multi-lingua`);
            }
          }
          
          const parsedLines = parseLocalizationContent(content, 0);
          
          const translatorTranslation: Translation = {
            id: `translator-${Date.now()}`,
            gameId: data.gameId || 'unknown',
            filePath: data.filePath || data.filename,
            originalText: content,
            translatedText: data.content || '',
            targetLanguage: data.targetLanguage || 'it',
            sourceLanguage: data.sourceLanguage || 'en',
            status: 'pending',
            confidence: 85,
            isManualEdit: false,
            context: `Tradotto con Neural Translator - ${data.gameName || 'game sconosciuto'}`,
            updatedAt: new Date().toISOString(),
            game: {
              id: data.gameId || 'unknown',
              title: data.gameName || 'game sconosciuto',
              platform: 'Neural Translator'
            },
            suggestions: [],
            parsedLines
          };
          
          setTranslations([translatorTranslation]);
          setSelectedTranslation(translatorTranslation);
          if (parsedLines.length > 0) {
            setSelectedLine(parsedLines[0]);
          }
          await storageManager.clearEditorFile();
          
          toast({
            title: "File caricato",
            description: isMultiLang 
              ? `${data.filename} - ${parsedLines.length} stringhe (multi-lingua rilevato)`
              : `${data.filename} - ${parsedLines.length} stringhe trovate`,
          });
          setIsLoading(false);
        } catch (err: unknown) {
          clientLogger.error('Error loading editor file:', err);
          await storageManager.clearEditorFile();
        }
      }
    };
    loadEditorFile();
  }, [toast]);

  // Load partial translations from Neural Translator (localStorage)
  useEffect(() => {
    const loadPartialTranslations = async () => {
      const data = await storageManager.getPartialTranslations();
      if (data) {
        try {
          clientLogger.debug('[Editor] Loading...sultati parziali:', data.items?.length, 'traduzioni');
          
          // Crea traduzioni dall'array di items
          if (data.items && data.items.length > 0) {
            const partialTranslations: Translation[] = data.items.map((item: unknown, index: number) => ({
              id: `partial-${index}-${item.id}`,
              gameId: data.gameId || 'unknown',
              filePath: data.files?.[0]?.path || 'Neural Translator',
              originalText: item.sourceText,
              translatedText: item.translatedText || '',
              targetLanguage: data.targetLanguage || 'it',
              sourceLanguage: data.sourceLanguage || 'en',
              status: item.translatedText ? 'completed' : 'pending',
              confidence: item.fromMemory ? 100 : 85,
              isManualEdit: false,
              context: item.metadata?.key || `Riga ${item.metadata?.lineNumber || index + 1}`,
              updatedAt: new Date(data.timestamp).toISOString(),
              game: {
                id: data.gameId || 'unknown',
                title: data.gameName || 'game sconosciuto',
                platform: 'Neural Translator'
              },
              suggestions: [],
            }));
            
            setTranslations(partialTranslations);
            if (partialTranslations.length > 0) {
              setSelectedTranslation(partialTranslations[0]);
            }
            
            toast({
              title: "results parziali caricati",
              description: `${data.completed}/${data.total} stringhe tradotte da ${data.gameName || 'Neural Translator'}`,
            });
            
            // Non rimuovere i dati - l'utente potrebbe volerli rivedere più volte
            // await storageManager.clearPartialTranslations();
          }
          setIsLoading(false);
        } catch (err: unknown) {
          clientLogger.error('[Editor] Error loading partial translations:', err);
        }
      }
    };
    loadPartialTranslations();
  }, [toast]);

  // Ri-parsa quando cambia la lingua sorgente
  useEffect(() => {
    if (rawContent && isMultiLangFile && selectedTranslation) {
      const parsedLines = parseLocalizationContent(rawContent, sourceLanguageIndex);
      setSelectedTranslation(prev => prev ? { ...prev, parsedLines } : null);
      if (parsedLines.length > 0) {
        setSelectedLine(parsedLines[0]);
      }
    }
  }, [sourceLanguageIndex]);

  // --- Actions ---
  const fetchGames = async () => {
    try {
      const response = await fetch('/api/games');
      if (response.ok) {
        const data = await response.json();
        setGames(ensureArray(data).map((g: unknown) => ({
          id: g.id,
          title: g.title,
          platform: 'Unknown',
          coverUrl: g.header_image || g.coverUrl
        })));
      }
    } catch (error: unknown) {
      clientLogger.error('Error loading games:', error);
    }
  };

  // Carica progetti con traduzioni (dalla Translation Memory e dizionari via Tauri)
  const fetchGameProjects = async () => {
    setIsLoading(true);
    try {
      const projectsMap = new Map<string, GameProject>();
      
      // Carica dizionari da Tauri
      try {
        const dictData = await invoke<unknown[]>('list_installed_dictionaries');
        for (const dict of ensureArray(dictData) as unknown[]) {
          const gameId = dict.game_id || dict.id || 'unknown';
          const gameName = dict.game_name || 'game sconosciuto';
          
          if (!projectsMap.has(gameId)) {
            projectsMap.set(gameId, {
              game: { id: gameId, title: gameName, platform: 'dictionary' },
              files: [],
              totalStrings: 0,
              completedStrings: 0,
              lastUpdated: dict.updated_at || new Date().toISOString()
            });
          }
          
          const project = projectsMap.get(gameId)!;
          project.totalStrings += dict.entries_count || 0;
          project.completedStrings += dict.entries_count || 0;
          project.files.push({
            id: `dict-${dict.id}`,
            filename: `Dizionario ${dict.target_language?.toUpperCase() || 'IT'}`,
            path: dict.file_path || '',
            stringCount: dict.entries_count || 0,
            completedCount: dict.entries_count || 0,
            targetLanguage: dict.target_language || 'it',
            sourceLanguage: dict.source_language || 'en',
            lastUpdated: dict.updated_at || new Date().toISOString()
          });
        }
      } catch (dictError) {
        clientLogger.warn('[Editor] Dizionari non disponibili:', dictError);
      }
      
      // Carica anche dai games con traduzioni saved (API Next.js come fallback)
      try {
        const transResponse = await fetch('/api/translations');
        const transData = transResponse.ok ? await transResponse.json() : [];
        
        for (const trans of ensureArray(transData) as unknown[]) {
          const gameId = trans.gameId || 'unknown';
          const gameName = trans.game?.title || 'game sconosciuto';
          
          if (!projectsMap.has(gameId)) {
            projectsMap.set(gameId, {
              game: { id: gameId, title: gameName, platform: trans.game?.platform || 'unknown' },
              files: [],
              totalStrings: 0,
              completedStrings: 0,
              lastUpdated: trans.updatedAt || new Date().toISOString()
            });
          }
          
          const project = projectsMap.get(gameId)!;
          project.totalStrings += 1;
          if (trans.status === 'completed' || trans.status === 'reviewed') {
            project.completedStrings += 1;
          }
        }
      } catch (transError) {
        clientLogger.warn('[Editor] Traduzioni non disponibili:', transError);
      }
      
      // Se non ci sono progetti, mostra i games dalla library che hanno file di localizzazione
      if (projectsMap.size === 0) {
        try {
          const gamesResponse = await fetch('/api/games');
          const gamesData = gamesResponse.ok ? await gamesResponse.json() : [];
          
          // Filtra games con traduzioni (quelli che hanno translationStats)
          for (const game of ensureArray(gamesData) as unknown[]) {
            if (game.translationStats && game.translationStats.total > 0) {
              projectsMap.set(game.id, {
                game: { 
                  id: game.id, 
                  title: game.title, 
                  platform: game.platform || 'steam',
                  coverUrl: game.header_image
                },
                files: [{
                  id: `game-${game.id}`,
                  filename: 'File di localizzazione',
                  path: game.install_path || '',
                  stringCount: game.translationStats.total,
                  completedCount: game.translationStats.completed,
                  targetLanguage: 'it',
                  sourceLanguage: 'en',
                  lastUpdated: game.updatedAt || new Date().toISOString()
                }],
                totalStrings: game.translationStats.total,
                completedStrings: game.translationStats.completed,
                lastUpdated: game.updatedAt || new Date().toISOString()
              });
            }
          }
        } catch (gamesError) {
          clientLogger.warn('[Editor] games non disponibili:', gamesError);
        }
      }
      
      setGameProjects(Array.from(projectsMap.values()));
    } catch (error: unknown) {
      clientLogger.error('Error loading game projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTranslations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterGame !== 'all') params.append('gameId', filterGame);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      
      const response = await fetch(`/api/translations?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTranslations(data);
        if (selectedTranslation) {
          const updated = data.find((t: Translation) => t.id === selectedTranslation.id);
          if (updated) setSelectedTranslation(updated);
        }
      }
    } catch (error: unknown) {
      clientLogger.error('Error loading translations:', error);
      toast({ title: 'error', description: 'Impossibile caricare le traduzioni', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateTranslation = async (updates: Partial<Translation>) => {
    if (!selectedTranslation) return;
    setIsSaving(true);
    setHasUnsavedChanges(false);
    
    try {
      const updatedTranslation = { ...selectedTranslation, ...updates, isManualEdit: true };
      setSelectedTranslation(updatedTranslation);
      setTranslations(prev => prev.map(t => t.id === updatedTranslation.id ? updatedTranslation : t));

      const response = await fetch('/api/translations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedTranslation.id, ...updates, isManualEdit: true })
      });

      if (!response.ok) throw new Error('Failed to save');
      
      // Integrazione con Dictionaries: salva automaticamente nel dizionario del game
      if (updates.translatedText && selectedTranslation.originalText) {
        try {
          await fetch('/api/dictionaries/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gameId: selectedTranslation.gameId,
              gameName: selectedTranslation.game?.title || 'Unknown',
              sourceLanguage: selectedTranslation.sourceLanguage,
              targetLanguage: selectedTranslation.targetLanguage,
              original: selectedTranslation.originalText,
              translated: updates.translatedText
            })
          });
          clientLogger.debug('[Editor] Traduzione salvata nel dizionario');
        } catch (dictError) {
          clientLogger.warn('[Editor] Impossibile salvare nel dizionario:', dictError);
        }
      }
      
      toast({ title: 'Salvato', description: 'Traduzione updated e salvata nel dizionario' });
    } catch (error: unknown) {
      clientLogger.error('Error saving translation:', error);
      toast({ title: 'error', description: 'Impossibile salvare le modifiche', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const generateSuggestions = async () => {
    if (!selectedTranslation || !selectedLine) {
      notifications.warning('Seleziona prima una stringa da tradurre');
      return;
    }
    
    // Check offline cache first
    const cached = offlineCache.get(
      selectedLine.originalText, 
      'en', 
      selectedTranslation.targetLanguage
    );
    if (cached) {
      handleTranslationChange(cached);
      notifications.success('Traduzione trovata in cache');
      return;
    }
    
    // Online translation
    if (!offlineCache.isOnline()) {
      notifications.error('Offline - traduzione non disponibile');
      return;
    }
    
    // TODO: Implementare integrazione con API di traduzione (DeepL, Google Translate, etc.)
    setIsGeneratingSuggestions(true);
    try {
      const response = await fetch('/api/translations/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          translationId: selectedTranslation.id,
          originalText: selectedTranslation.originalText,
          targetLanguage: selectedTranslation.targetLanguage
        })
      });

      if (response.ok) {
        const suggestions = await response.json();
        const updated = { ...selectedTranslation, suggestions };
        setSelectedTranslation(updated);
        setTranslations(prev => prev.map(t => t.id === updated.id ? updated : t));
        
        // Cache translations for offline use
        if (suggestions.length > 0 && selectedLine) {
          offlineCache.set(
            selectedLine.originalText,
            suggestions[0],
            'en',
            selectedTranslation.targetLanguage
          );
        }
        notifications.success(`${suggestions.length} suggerimenti trovati`);
      }
    } catch {
      notifications.error('Impossibile generare suggerimenti');
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleTranslationChange = useCallback((newText: string) => {
    if (!selectedTranslation) return;
    setSelectedTranslation(prev => prev ? ({ ...prev, translatedText: newText }) : null);
    setHasUnsavedChanges(true);
    
    if (saveTimeoutId) clearTimeout(saveTimeoutId);
    
    const newTimeoutId = setTimeout(() => {
      updateTranslation({ translatedText: newText });
    }, 2000);
    setSaveTimeoutId(newTimeoutId);
  }, [selectedTranslation, saveTimeoutId]);

  const handleManualSave = async () => {
    if (!selectedTranslation || !hasUnsavedChanges) return;
    if (saveTimeoutId) clearTimeout(saveTimeoutId);
    
    // Se stiamo lavorando con parsedLines (file multi-stringa), aggiungi le stringhe tradotte all'Explorer
    if (selectedTranslation.parsedLines) {
      const translatedLines = selectedTranslation.parsedLines.filter(l => l.translatedText);
      
      // Crea Translation objects per ogni stringa tradotta e aggiungile alla lista
      const newTranslations: Translation[] = translatedLines.map(line => ({
        id: `${selectedTranslation.id}-line-${line.lineNumber}`,
        gameId: selectedTranslation.gameId,
        filePath: selectedTranslation.filePath,
        originalText: line.originalText,
        translatedText: line.translatedText,
        targetLanguage: 'it',
        sourceLanguage: selectedTranslation.sourceLanguage,
        status: 'edited' as const,
        confidence: 100,
        isManualEdit: true,
        context: `${line.key || `Riga ${line.lineNumber}`} - ${selectedTranslation.game.title}`,
        updatedAt: new Date().toISOString(),
        game: selectedTranslation.game,
        suggestions: []
      }));
      
      // Aggiorna la lista translations rimuovendo duplicati e aggiungendo nuove
      setTranslations(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const toAdd = newTranslations.filter(t => !existingIds.has(t.id));
        const toUpdate = newTranslations.filter(t => existingIds.has(t.id));
        
        const updated = prev.map(t => {
          const match = toUpdate.find(u => u.id === t.id);
          return match || t;
        });
        
        return [...updated, ...toAdd];
      });
      
      // Salva anche in IndexedDB per persistenza
      try {
        const existingData = await get<unknown>('gamestringer_partial_translations');
        if (existingData) {
          const updatedItems = existingData.items.filter((item: unknown) => 
            !translatedLines.some(l => 
              (item.metadata?.key === l.key && item.metadata?.lineNumber === l.lineNumber) ||
              item.sourceText === l.originalText
            )
          );
          
          translatedLines.forEach(line => {
            updatedItems.push({
              sourceText: line.originalText,
              translatedText: line.translatedText,
              fromMemory: false,
              metadata: { key: line.key, lineNumber: line.lineNumber }
            });
          });
          
          existingData.items = updatedItems;
          existingData.timestamp = Date.now();
          await set('gamestringer_partial_translations', existingData);
          clientLogger.debug('[Editor] saved modifiche manuali in IndexedDB:', translatedLines.length);
        } else {
          // Crea nuova struttura
          const newData = {
            timestamp: Date.now(),
            gameId: selectedTranslation.gameId,
            items: translatedLines.map(line => ({
              sourceText: line.originalText,
              translatedText: line.translatedText,
              fromMemory: false,
              metadata: { key: line.key, lineNumber: line.lineNumber }
            })),
          };
          await set('gamestringer_partial_translations', newData);
          clientLogger.debug('[Editor] Creati nuovi dati in IndexedDB:', translatedLines.length);
        }
      } catch (err: unknown) {
        clientLogger.error('[Editor] error salvataggio IndexedDB:', err);
      }
      
      setHasUnsavedChanges(false);
      
      // Traccia attività
      activityHistory.add({
        activity_type: 'translation',
        title: `Modifiche saved: ${selectedTranslation.game.title}`,
        description: `${translatedLines.length} stringhe modificate`,
        game_name: selectedTranslation.game.title,
        game_id: selectedTranslation.gameId,
      });
      
      toast({ 
        title: 'Salvato', 
        description: `${translatedLines.length} traduzioni saved` 
      });
    } else {
      updateTranslation({ translatedText: selectedTranslation.translatedText });
      
      // Traccia attività per singola modifica
      activityHistory.add({
        activity_type: 'translation',
        title: `Traduzione modificata: ${selectedTranslation.game.title}`,
        game_name: selectedTranslation.game.title,
        game_id: selectedTranslation.gameId,
      });
    }
  };

  const _deleteTranslation = async (id: string) => {
    if (!confirm('Eliminare questa traduzione?')) return;
    try {
      const response = await fetch(`/api/translations?id=${id}`, { method: 'DELETE', headers: { 'X-GS-Client': 'gamestringer' } });
      if (response.ok) {
        setTranslations(prev => prev.filter(t => t.id !== id));
        if (selectedTranslation?.id === id) setSelectedTranslation(null);
        toast({ title: 'Eliminata', description: 'Traduzione rimossa' });
      }
    } catch {
      toast({ title: 'error', description: 'Impossibile eliminare', variant: 'destructive' });
    }
  };

  const exportTranslations = async (format: 'json' | 'csv' | 'po') => {
    if (!filterGame || filterGame === 'all') {
      toast({
        title: 'Select a game',
        description: 'Devi selezionare un game specifico per esportare',
        variant: 'destructive'
      });
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append('gameId', filterGame);
      params.append('format', format);
      if (filterStatus !== 'all') params.append('status', filterStatus);

      const response = await fetch(`/api/translations/export?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || `translations.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({ title: 'Esportazione completata', description: `Traduzioni esportate in ${format.toUpperCase()}` });
      }
    } catch {
      toast({ title: 'error', description: 'Impossibile esportare', variant: 'destructive' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'reviewed': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'edited': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': case 'reviewed': return <CheckCircle className="h-3 w-3" />;
      case 'edited': return <Edit3 className="h-3 w-3" />;
      case 'pending': return <AlertCircle className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-transparent overflow-hidden">
      {/* Hero Header Premium */}
      <div className="relative overflow-hidden rounded-xl mx-4 mt-4 mb-3 bg-slate-950/60 border border-slate-800/50 p-4 shadow-xl backdrop-blur-md group/header transition-all duration-500 hover:border-indigo-500/30 hover:bg-slate-950/80 shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent translate-y-1/2 -translate-x-1/4 pointer-events-none" />
        
        <div className="relative flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900/80 rounded-xl shadow-inner border border-slate-700/50 group-hover/header:border-indigo-500/40 group-hover/header:shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all duration-300">
              <LayoutPanelLeft className="h-7 w-7 text-indigo-400 group-hover/header:text-indigo-300 transition-colors" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-extrabold text-white tracking-tight drop-shadow-sm">{t('editor.title') || 'Editor Traduzioni'}</h1>
              <p className="text-slate-400 text-xs font-medium mt-0.5">{t('editor.subtitle') || 'Revisiona e gestisci le tue traduzioni'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-slate-900/60 text-slate-300 border-slate-700/50 px-3 py-1.5 shadow-sm rounded-lg text-xs font-medium tracking-wide">
              <span className="text-indigo-400 font-bold mr-1.5">{gameProjects.length}</span>{t('editor.projects') || 'progetti'}
            </Badge>
            <Popover>
              <PopoverTrigger asChild>
                <button className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 transition-colors border border-slate-700/50 text-slate-400 hover:text-indigo-300 shadow-sm">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="max-w-xs p-4 bg-slate-900/95 backdrop-blur-xl border-slate-700/50 shadow-2xl rounded-xl">
                <p className="font-semibold text-sm mb-1.5 text-indigo-300">{t('editor.helpTitle') || 'A cosa serve l\'Editor?'}</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('editor.helpDescription') || 'Questa è la tua area di lavoro manuale. Qui finiscono tutti i file estratti e tradotti in automatico dal Neural Translator. Puoi revisionare i testi, correggere errori o creare nuovi progetti da zero esportandoli per la Community.'}
                </p>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden mx-4 mb-4 rounded-xl border border-slate-800/50 shadow-2xl bg-slate-950/40 backdrop-blur-sm">
      {/* --- SIDEBAR: LIST & FILTERS --- */}
      <div className="w-[320px] border-r border-slate-800/50 bg-slate-900/40 flex flex-col z-10 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800/50 space-y-3 relative z-10">
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2 text-sm tracking-wide text-slate-200">
              <div className="p-1 rounded bg-indigo-500/20 border border-indigo-500/30">
                <FileText className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              Explorer
            </h2>
            <div className="flex items-center gap-1.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Importa" className="h-7 w-7 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10" onClick={() => setShowImportDialog(true)}>
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-800 border-slate-700 text-xs">{t('editorPage.importFile')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Select onValueChange={(format) => exportTranslations(format as string)}>
                      <SelectTrigger className="h-7 w-7 p-0 border-0 bg-transparent text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg flex items-center justify-center [&>svg]:hidden">
                        <Download className="h-3.5 w-3.5" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="json">{t('editorPage.exportJson')}</SelectItem>
                        <SelectItem value="csv">{t('editorPage.exportCsv')}</SelectItem>
                        <SelectItem value="po">{t('editorPage.exportPo')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-800 border-slate-700 text-xs">{t('editorPage.exportProject')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            <Input 
              aria-label="Cerca" placeholder="Cerca stringa o gioco..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-9 pr-8 text-xs bg-slate-950/60 border-slate-700/50 focus-visible:ring-indigo-500/30 rounded-lg shadow-inner text-slate-200 placeholder:text-slate-500"
            />
            {searchTerm && (
              <Button variant="ghost" size="icon" aria-label="Chiudi" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 hover:bg-slate-800 rounded-md" onClick={() => setSearchTerm('')}>
                <X className="h-3 w-3 text-slate-400" />
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs flex-1 bg-slate-950/60 border-slate-700/50 rounded-lg text-slate-300">
                <SelectValue placeholder={t('gameDetails.status')} />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 z-50">
                <SelectItem value="all">{t('editorPage.allStates')}</SelectItem>
                <SelectItem value="pending">{t('batch.pending')}</SelectItem>
                <SelectItem value="completed">{t('batch.completed')}</SelectItem>
                <SelectItem value="edited">{t('editorPage.modified')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterGame} onValueChange={setFilterGame}>
              <SelectTrigger className="h-8 text-xs flex-1 bg-slate-950/60 border-slate-700/50 rounded-lg text-slate-300">
                <SelectValue placeholder={t('projects.game')} />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 z-50">
                <SelectItem value="all">{t('dictionary.allGames')}</SelectItem>
                {games.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between text-micro font-semibold uppercase tracking-widest text-slate-500 px-1 pt-1">
            <span>{filteredTranslations.length} elementi</span>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> {stats.completed}</span>
              <span className="text-amber-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {stats.pending}</span>
            </div>
          </div>
        </div>

        {/* Explorer List */}
        <ScrollArea className="flex-1 relative z-10 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500">
              <div className="p-3 bg-slate-800/50 rounded-full border border-slate-700/50 mb-3 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              </div>
              <span className="text-xs font-medium tracking-wide">{t('editorPage.loadingProjects')}</span>
            </div>
          ) : explorerView === 'games' ? (
            // Vista games
            gameProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-10 h-full text-slate-500">
                <div className="w-16 h-16 rounded-full bg-slate-800/30 flex items-center justify-center mb-4 border border-slate-800">
                  <Languages className="h-8 w-8 opacity-40 text-slate-400" />
                </div>
                <p className="font-semibold text-slate-300">{t('projects.noProjects')}</p>
                <p className="text-[11px] mt-1.5 opacity-70 max-w-[200px] leading-relaxed">{t('editorPage.traduciUnGiocoConNeuralTransla')}</p>
              </div>
            ) : (
              <div className="flex flex-col p-2 gap-1">
                {gameProjects.map((project, index) => (
                  <motion.div
                    key={project.game.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => { setSelectedProject(project); setExplorerView('files'); }}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-transparent hover:border-indigo-500/30 hover:bg-slate-800/50 transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center group-hover:border-indigo-500/50 group-hover:shadow-[0_0_10px_rgba(99,102,241,0.2)] transition-all">
                      <Languages className="h-4 w-4 text-indigo-400/80 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate text-slate-200 group-hover:text-indigo-300 transition-colors">
                        {project.game.title}
                      </p>
                      <p className="text-2xs text-slate-500 font-medium">
                        {project.files.length} file • {project.totalStrings} stringhe
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 pr-1">
                      <Badge variant="outline" className="text-micro h-4 px-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        {Math.round((project.completedStrings / Math.max(project.totalStrings, 1)) * 100)}%
                      </Badge>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors group-hover:translate-x-0.5" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          ) : explorerView === 'files' && selectedProject ? (
            // Vista File del game selezionato
            <div className="flex flex-col">
              {/* Header con back button */}
              <div className="flex items-center gap-2 p-2 border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                <Button variant="ghost" size="icon" aria-label="Indietro" className="h-7 w-7 rounded-lg hover:bg-slate-800" onClick={() => { setExplorerView('games'); setSelectedProject(null); }}>
                  <ChevronRight className="h-4 w-4 rotate-180 text-slate-400" />
                </Button>
                <span className="font-bold text-xs text-slate-300 truncate tracking-wide">{selectedProject.game.title}</span>
              </div>
              <div className="p-2 gap-1 flex flex-col">
                {selectedProject.files.length === 0 ? (
                  <div className="text-center p-8 text-slate-500 text-sm">
                    <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p>{t('editorPage.noFile')}</p>
                  </div>
                ) : (
                  selectedProject.files.map((file, index) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => { setSelectedFile(file); setExplorerView('strings'); }}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer group",
                        selectedFile?.id === file.id 
                          ? "bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.1)]" 
                          : "border-transparent hover:border-slate-700/50 hover:bg-slate-800/40"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-md", 
                        selectedFile?.id === file.id ? "bg-indigo-500/20" : "bg-slate-800 group-hover:bg-slate-700"
                      )}>
                        <FileText className={cn(
                          "h-4 w-4",
                          selectedFile?.id === file.id ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-300"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-semibold text-xs truncate transition-colors",
                          selectedFile?.id === file.id ? "text-indigo-300" : "text-slate-300 group-hover:text-white"
                        )}>
                          {file.filename}
                        </p>
                        <p className="text-2xs text-slate-500 font-medium">
                          {file.stringCount} stringhe • <span className="uppercase text-slate-400">{file.targetLanguage}</span>
                        </p>
                      </div>
                      <Badge variant="outline" className="text-micro h-4 px-1.5 bg-emerald-500/5 text-emerald-400/80 border-emerald-500/20 font-mono">
                        {Math.round((file.completedCount / Math.max(file.stringCount, 1)) * 100)}%
                      </Badge>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          ) : (
            // Vista Stringhe (fallback alla lista originale)
            <div className="flex flex-col">
              {/* Header con back button */}
              <div className="flex items-center gap-2 p-2 border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                <Button variant="ghost" size="icon" aria-label="Indietro" className="h-7 w-7 rounded-lg hover:bg-slate-800" onClick={() => { setExplorerView('files'); setSelectedFile(null); }}>
                  <ChevronRight className="h-4 w-4 rotate-180 text-slate-400" />
                </Button>
                <span className="font-bold text-xs text-slate-300 truncate tracking-wide">{selectedFile?.filename || 'Stringhe'}</span>
              </div>
              
              <div className="flex flex-col p-1.5">
                {filteredTranslations.length === 0 ? (
                  <div className="text-center p-8 text-slate-500 text-sm">
                    <Languages className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p>{t('editorPage.noStrings')}</p>
                  </div>
                ) : (
                  filteredTranslations.map((t, index) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => setSelectedTranslation(t)}
                      className={cn(
                        "flex flex-col items-start p-2.5 rounded-lg border transition-all text-left group relative cursor-pointer mb-1",
                        selectedTranslation?.id === t.id 
                          ? "bg-indigo-500/10 border-indigo-500/40 shadow-sm" 
                          : "border-transparent hover:bg-slate-800/40 hover:border-slate-700/50"
                      )}
                    >
                      <p className={cn(
                        "text-[13px] font-medium line-clamp-1 w-full",
                        selectedTranslation?.id === t.id ? "text-indigo-100" : "text-slate-300"
                      )}>
                        {t.originalText}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-1 w-full">
                        {t.translatedText || <span className="italic opacity-50">— non tradotto —</span>}
                      </p>
                      <Badge variant="outline" className={cn("text-2xs uppercase tracking-wider font-bold h-4 px-1.5 gap-1 mt-2", getStatusColor(t.status))}>
                        {getStatusIcon(t.status)}
                        <span>{t.status}</span>
                      </Badge>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* --- MAIN AREA: EDITOR --- */}
      <div className="flex-1 flex flex-col bg-slate-950/20 relative overflow-hidden">
        {selectedTranslation ? (
          <>
            {/* Toolbar */}
            <div className="h-auto min-h-12 border-b border-slate-800/60 flex flex-col gap-2 px-4 py-2.5 bg-slate-900/60 backdrop-blur-md z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 shadow-inner">
                    <Languages className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                      <span className="truncate max-w-[150px] hover:text-white transition-colors cursor-default">{selectedTranslation.game.title}</span>
                      <ChevronRight className="h-3 w-3 text-slate-600" />
                      <span className="truncate max-w-[150px] text-slate-500">{selectedTranslation.filePath.split('/').pop()}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isMultiLangFile && (
                        <Badge variant="outline" className="text-micro h-4 px-1.5 border-emerald-500/30 text-emerald-400 uppercase tracking-widest font-bold">
                          Multi-Lang
                        </Badge>
                      )}
                      {selectedTranslation.confidence > 0 && (
                        <span className="text-2xs font-mono text-emerald-500/80">CONF:{Math.round(selectedTranslation.confidence * 100)}%</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="xs" className="text-xs font-semibold text-slate-300 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors" onClick={generateSuggestions} disabled={isGeneratingSuggestions}>
                    {isGeneratingSuggestions ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5 text-indigo-400" />}
                    Traduci AI
                  </Button>
                  <Button
                    variant="ghost" size="sm" className={cn("h-8 text-xs font-semibold rounded-lg transition-colors", glossaryTerms.length > 0 ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" : "text-slate-300 hover:text-amber-300 hover:bg-amber-500/10")}
                    onClick={() => setShowGlossaryPanel(!showGlossaryPanel)}
                  >
                    <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                    {glossaryTerms.length > 0 ? `Glossario (${glossaryTerms.length})` : 'Glossario'}
                  </Button>
                  <Separator orientation="vertical" className="h-5 bg-slate-700/50 mx-1" />
                  {/* Cross-navigation */}
                  <Link href={`/batch?game=${encodeURIComponent(selectedTranslation.game?.title || '')}`}>
                    <Button variant="ghost" size="xs" className="text-xs text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-lg">
                      <FolderTree className="h-3.5 w-3.5 mr-1" />{t('aiTranslator.batch')}</Button>
                  </Link>
                  <Link href={`/glossary?gameId=${selectedTranslation.gameId || ''}`}>
                    <Button variant="ghost" size="xs" className="text-xs text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg hidden sm:flex">
                      <BookOpen className="h-3.5 w-3.5 mr-1" />{t('nav.memory')}</Button>
                  </Link>
                  <Separator orientation="vertical" className="h-5 bg-slate-700/50 mx-1" />
                  <Button 
                    size="sm" 
                    className={cn("h-8 text-xs font-bold rounded-lg shadow-sm transition-all", hasUnsavedChanges ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20" : "bg-slate-800 text-slate-400 hover:bg-slate-700")}
                    onClick={handleManualSave} 
                    disabled={!hasUnsavedChanges || isSaving}
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Salva
                  </Button>
                  <Link href={`/community-hub?action=publish&gameId=${selectedTranslation.gameId || ''}&gameName=${encodeURIComponent(selectedTranslation.game?.title || '')}`}>
                    <Button variant="ghost" size="xs" className="text-xs font-semibold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg border border-blue-500/20 hidden lg:flex">
                      <Globe className="h-3.5 w-3.5 mr-1" />
                      Condividi
                    </Button>
                  </Link>
                </div>
              </div>
              
              {/* Language Selector for multi-language files */}
              {isMultiLangFile && detectedLanguages.length > 0 && (
                <div className="flex items-center gap-4 pt-2 mt-1 border-t border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-bold text-slate-500 uppercase tracking-widest">{t('editorPage.sourceLabel')}</span>
                    <Select value={String(sourceLanguageIndex)} onValueChange={(v) => setSourceLanguageIndex(Number(v))}>
                      <SelectTrigger className="h-7 w-[140px] text-xs bg-slate-950/50 border-slate-700/50 rounded-md font-medium text-slate-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {detectedLanguages.map((lang, idx) => (
                          <SelectItem key={idx} value={String(idx)}>{lang}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <ArrowLeftRight className="h-3.5 w-3.5 text-slate-600" />
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-bold text-slate-500 uppercase tracking-widest">{t('editorPage.destLabel')}</span>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{t('languages.it')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Split Editor */}
            <div className="flex-1 flex overflow-hidden bg-slate-950/20">
              {/* Strings List Panel (when parsed lines exist) */}
              {selectedTranslation.parsedLines && selectedTranslation.parsedLines.length > 0 ? (
                <div className="w-[340px] flex flex-col border-r border-slate-800/50 bg-slate-900/40 relative z-10 shadow-[5px_0_15px_-5px_rgba(0,0,0,0.3)]">
                  <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800/50 backdrop-blur-md sticky top-0 z-20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-2xs font-bold text-slate-500 uppercase tracking-widest">
                        Progresso File
                      </span>
                      <Badge variant="outline" className="text-micro h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        {Math.round((selectedTranslation.parsedLines.filter(l => l.translatedText).length / selectedTranslation.parsedLines.length) * 100)}%
                      </Badge>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 transition-all duration-500 relative"
                        style={{ 
                          width: `${(selectedTranslation.parsedLines.filter(l => l.translatedText).length / selectedTranslation.parsedLines.length) * 100}%` 
                        }}
                      >
                        <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-emerald-400 text-2xs font-semibold flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {selectedTranslation.parsedLines.filter(l => l.translatedText).length} fatte
                      </span>
                      <span className="text-amber-400/80 text-2xs font-semibold flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {selectedTranslation.parsedLines.length - selectedTranslation.parsedLines.filter(l => l.translatedText).length} da fare
                      </span>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 custom-scrollbar">
                    <div className="p-2 space-y-1">
                      {selectedTranslation.parsedLines.map((line, _idx) => {
                        const isSelected = selectedLine?.lineNumber === line.lineNumber;
                        const isTranslated = !!line.translatedText;
                        return (
                          <button
                            key={line.lineNumber}
                            onClick={() => setSelectedLine(line)}
                            className={cn(
                              "w-full text-left p-2.5 rounded-xl transition-all relative overflow-hidden group border",
                              isSelected 
                                ? "bg-indigo-500/15 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.15)]" 
                                : isTranslated 
                                  ? "bg-slate-800/30 border-transparent hover:bg-slate-800/60 hover:border-slate-700/50" 
                                  : "bg-slate-900/40 border-transparent hover:bg-slate-800/60 hover:border-slate-700/50"
                            )}
                          >
                            {/* Linea laterale indicatore status */}
                            <div className={cn(
                              "absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all duration-300",
                              isSelected ? "bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" : 
                              isTranslated ? "bg-emerald-500/50" : "bg-transparent group-hover:bg-slate-700"
                            )} />
                            
                            <div className="flex justify-between items-start mb-1.5 pl-2">
                              <span className={cn(
                                "text-micro font-bold tracking-wider uppercase flex items-center gap-1",
                                isTranslated ? "text-emerald-400" : "text-amber-500/70"
                              )}>
                                {isTranslated ? <CheckCircle className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                                #{line.lineNumber}
                              </span>
                              {line.key && (
                                <span className="text-2xs font-mono text-slate-500 truncate max-w-[120px] bg-slate-950/50 px-1.5 py-0.5 rounded border border-slate-800/50">
                                  {line.key}
                                </span>
                              )}
                            </div>
                            
                            <div className="pl-2 pr-1 space-y-1.5">
                              <p className={cn(
                                "text-xs line-clamp-2 leading-relaxed font-medium transition-colors",
                                isSelected ? "text-indigo-100" : "text-slate-300"
                              )}>
                                {line.originalText}
                              </p>
                              {isTranslated && (
                                <p className="text-[11px] text-emerald-300/80 line-clamp-1 italic bg-emerald-500/5 p-1 rounded border border-emerald-500/10">
                                  {line.translatedText}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                /* Original Panel (fallback for non-parsed content) */
                <div className="flex-1 flex flex-col border-r border-slate-800/50 min-w-[300px] bg-slate-900/20">
                  <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800/50 flex justify-between items-center backdrop-blur-md">
                    <span className="text-2xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />{t('qaCheck.originalText')}</span>
                    <Button variant="ghost" size="icon" aria-label="Copia" className="h-7 w-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition-colors" onClick={() => {
                      navigator.clipboard.writeText(selectedTranslation.originalText);
                      toast({ title: 'Copiato negli appunti' });
                    }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 p-6 custom-scrollbar">
                    <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-4 shadow-inner">
                      <p className="text-[13px] leading-relaxed text-slate-300 whitespace-pre-wrap font-medium">
                        {selectedTranslation.originalText}
                      </p>
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Selected String Editor */}
              {selectedTranslation.parsedLines && selectedTranslation.parsedLines.length > 0 && selectedLine ? (
                <div className="flex-1 flex flex-col min-w-[400px] relative z-0">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
                  
                  {/* Original text of selected line */}
                  <div className="border-b border-slate-800/50 bg-slate-900/20">
                    <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800/50 flex justify-between items-center backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <span className="text-2xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" />{t('mangaTranslator.source')}</span>
                        <Badge variant="outline" className="text-micro h-4 bg-slate-800/50 text-slate-400 border-slate-700/50">Riga {selectedLine.lineNumber}</Badge>
                      </div>
                      <Button variant="ghost" size="icon" aria-label="Copia" className="h-7 w-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition-colors" onClick={() => {
                        navigator.clipboard.writeText(selectedLine.originalText);
                        toast({ title: 'Copiato negli appunti' });
                      }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="p-5 max-h-[250px] overflow-y-auto custom-scrollbar">
                      <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-4 shadow-inner relative group/orig">
                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-700/50 rounded-l-xl group-hover/orig:bg-indigo-500/50 transition-colors" />
                        <p className="text-[14px] leading-relaxed text-slate-200 whitespace-pre-wrap font-medium pl-2">
                          {selectedLine.originalText}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Translation input */}
                  <div className="flex-1 flex flex-col bg-slate-950/40">
                    <div className="px-4 py-3 bg-indigo-950/30 border-b border-indigo-500/20 flex justify-between items-center backdrop-blur-md">
                      <span className="text-2xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Edit3 className="h-3.5 w-3.5" />{t('offlineTranslator.translation')}</span>
                      {selectedLine.translatedText && (
                        <Badge variant="outline" className="text-micro h-4 bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold uppercase tracking-wider">
                          <CheckCircle className="h-2.5 w-2.5 mr-1" />{t('batchTranslator.done')}</Badge>
                      )}
                    </div>
                    <div className="flex-1 p-5 relative">
                      <div className="absolute inset-5 bg-indigo-500/5 rounded-xl blur-xl pointer-events-none" />
                      <Textarea
                        value={selectedLine.translatedText}
                        onChange={(e) => {
                          const newText = e.target.value;
                          setSelectedLine(prev => prev ? { ...prev, translatedText: newText } : null);
                          // Update in parsedLines array
                          if (selectedTranslation.parsedLines) {
                            const updatedLines = selectedTranslation.parsedLines.map(l => 
                              l.lineNumber === selectedLine.lineNumber ? { ...l, translatedText: newText } : l
                            );
                            setSelectedTranslation({ ...selectedTranslation, parsedLines: updatedLines });
                          }
                          setHasUnsavedChanges(true);
                        }}
                        className="relative w-full h-full min-h-[150px] resize-none border-indigo-500/20 bg-slate-900/60 text-[14px] font-medium leading-relaxed focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/50 placeholder:text-slate-600 rounded-xl shadow-inner p-4 transition-all hover:bg-slate-900/80 custom-scrollbar"
                        placeholder="Inserisci la traduzione per questa stringa..."
                        spellCheck={false}
                      />
                    </div>
                    {/* Glossary Hints Panel */}
                    {showGlossaryPanel && glossaryTerms.length > 0 && (
                      <div className="border-t border-amber-500/20 bg-gradient-to-b from-amber-950/40 to-slate-950/80 px-5 py-3 max-h-[160px] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-2 mb-2.5">
                          <div className="p-1 rounded bg-amber-500/20 border border-amber-500/30">
                            <BookOpen className="h-3 w-3 text-amber-400" />
                          </div>
                          <span className="text-2xs font-bold text-amber-400 uppercase tracking-widest">{t('editorPage.translationMemory')}</span>
                          <span className="text-micro text-amber-500/60 ml-auto">{glossaryTerms.length} termini trovati</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {glossaryTerms.map(term => (
                            <button
                              key={term.id}
                              onClick={() => {
                                navigator.clipboard.writeText(term.targetTerm);
                                toast({ title: `Copiato: ${term.targetTerm}` });
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all text-xs group shadow-sm"
                              title={`${term.sourceTerm} → ${term.targetTerm}${term.context ? ` (${term.context})` : ''}`}
                            >
                              <span className="text-amber-200/60 font-medium group-hover:text-amber-200 transition-colors">{term.sourceTerm}</span>
                              <ChevronRight className="h-3 w-3 text-amber-500/40" />
                              <span className="text-amber-300 font-bold group-hover:text-amber-100 transition-colors">{term.targetTerm}</span>
                              {term.tier === 'locked' && <span className="text-red-400 text-2xs ml-0.5" title="Termine bloccato (priorità alta)">🔒</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : selectedTranslation.parsedLines && selectedTranslation.parsedLines.length > 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-950/20 relative">
                  <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5 pointer-events-none" />
                  <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/50 mb-4 shadow-inner">
                    <LayoutPanelLeft className="h-10 w-10 text-slate-600 opacity-50" />
                  </div>
                  <p className="text-sm font-semibold text-slate-400 tracking-wide">{t('editorPage.selectString')}</p>
                  <p className="text-xs text-slate-600 mt-1">per iniziare a modificare la traduzione</p>
                </div>
              ) : (
                /* Original full editor for non-parsed content */
                <div className="flex-1 flex flex-col min-w-[300px] bg-slate-950/20 relative z-0">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
                  <div className="px-4 py-3 bg-indigo-950/30 border-b border-indigo-500/20 flex justify-between items-center backdrop-blur-md">
                    <span className="text-2xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Edit3 className="h-3.5 w-3.5" /> Area di Traduzione
                    </span>
                    {hasUnsavedChanges && (
                      <Badge variant="outline" className="text-micro h-4 bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold uppercase tracking-wider animate-pulse">
                        <AlertCircle className="h-2.5 w-2.5 mr-1" /> Modificato
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1 p-5 relative">
                    <div className="absolute inset-5 bg-indigo-500/5 rounded-xl blur-xl pointer-events-none" />
                    <Textarea
                      value={selectedTranslation.translatedText}
                      onChange={(e) => handleTranslationChange(e.target.value)}
                      className="relative w-full h-full min-h-[200px] resize-none border-indigo-500/20 bg-slate-900/60 text-[14px] font-medium leading-relaxed focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/50 placeholder:text-slate-600 rounded-xl shadow-inner p-4 transition-all hover:bg-slate-900/80 custom-scrollbar"
                      placeholder={t('qaCheck.enterTranslation')}
                      spellCheck={false}
                    />
                  </div>
                  {/* Glossary Hints Panel (full editor mode) */}
                  {showGlossaryPanel && glossaryTerms.length > 0 && (
                    <div className="border-t border-amber-500/20 bg-gradient-to-b from-amber-950/40 to-slate-950/80 px-5 py-3 max-h-[160px] overflow-y-auto custom-scrollbar">
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="p-1 rounded bg-amber-500/20 border border-amber-500/30">
                          <BookOpen className="h-3 w-3 text-amber-400" />
                        </div>
                        <span className="text-2xs font-bold text-amber-400 uppercase tracking-widest">{t('editorPage.translationMemory')}</span>
                        <span className="text-micro text-amber-500/60 ml-auto">{glossaryTerms.length} termini trovati</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {glossaryTerms.map(term => (
                          <button
                            key={term.id}
                            onClick={() => {
                              navigator.clipboard.writeText(term.targetTerm);
                              toast({ title: `Copiato: ${term.targetTerm}` });
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all text-xs group shadow-sm"
                            title={`${term.sourceTerm} → ${term.targetTerm}${term.context ? ` (${term.context})` : ''}`}
                          >
                            <span className="text-amber-200/60 font-medium group-hover:text-amber-200 transition-colors">{term.sourceTerm}</span>
                            <ChevronRight className="h-3 w-3 text-amber-500/40" />
                            <span className="text-amber-300 font-bold group-hover:text-amber-100 transition-colors">{term.targetTerm}</span>
                            {term.tier === 'locked' && <span className="text-red-400 text-2xs ml-0.5" title="Termine bloccato">🔒</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
            <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-6 border border-slate-700">
              <LayoutPanelLeft className="h-8 w-8 opacity-50" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-slate-400">{t('editorPage.noSelection')}</h3>
            <p className="text-sm text-center max-w-xs opacity-70">
              Seleziona una stringa dalla lista per iniziare a modificare la traduzione
            </p>
          </div>
        )}
      </div>

      {/* Import Dialog */}
      <TranslationImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        games={games}
        onImportComplete={fetchTranslations}
      />
      </div>
    </div>
  );
}



