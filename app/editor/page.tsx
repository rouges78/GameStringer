'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FileText, Save, Languages, Search, Edit3, 
  CheckCircle, AlertCircle, Lightbulb, Copy, Download, Upload, 
  Loader2, Trash2, ChevronRight, Sparkles, 
  ArrowLeftRight, LayoutPanelLeft, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
const SUPPORTED_LANGUAGES = [
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
  const [viewMode, setViewMode] = useState<'lines' | 'full'>('lines');
  const [isMultiLangFile, setIsMultiLangFile] = useState(false);
  const [sourceLanguageIndex, setSourceLanguageIndex] = useState(0);
  const [targetLanguageIndex, setTargetLanguageIndex] = useState<number | null>(null); // null = nuova traduzione
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

  // --- Effects ---
  useEffect(() => {
    fetchGames();
    fetchGameProjects(); // Carica progetti con traduzioni
  }, []);

  useEffect(() => {
    // Non caricare traduzioni dal server se ci sono results parziali da Neural Translator
    const hasPartialData = localStorage.getItem('gamestringer_partial_translations');
    const hasEditorFile = sessionStorage.getItem('editorFile');
    if (!hasPartialData && !hasEditorFile) {
      fetchTranslations();
    }
  }, [filterGame, filterStatus]);

  // Load from session storage (Neural Translator integration)
  useEffect(() => {
    const editorFileData = sessionStorage.getItem('editorFile');
    if (editorFileData) {
      try {
        const data = JSON.parse(editorFileData);
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
            console.log(`[Editor] Rilevate ${langCount} lingue nel file multi-lingua`);
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
        sessionStorage.removeItem('editorFile');
        
        toast({
          title: "File caricato",
          description: isMultiLang 
            ? `${data.filename} - ${parsedLines.length} stringhe (multi-lingua rilevato)`
            : `${data.filename} - ${parsedLines.length} stringhe trovate`,
        });
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading editor file:', err);
        sessionStorage.removeItem('editorFile');
      }
    }
  }, [toast]);

  // Load partial translations from Neural Translator (localStorage)
  useEffect(() => {
    const partialData = localStorage.getItem('gamestringer_partial_translations');
    if (partialData) {
      try {
        const data = JSON.parse(partialData);
        console.log('[Editor] Loading...sultati parziali:', data.items?.length, 'traduzioni');
        
        // Crea traduzioni dall'array di items
        if (data.items && data.items.length > 0) {
          const partialTranslations: Translation[] = data.items.map((item: any, index: number) => ({
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
          // localStorage.removeItem('gamestringer_partial_translations');
        }
        setIsLoading(false);
      } catch (err) {
        console.error('[Editor] Error loading partial translations:', err);
      }
    }
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
        setGames(ensureArray(data).map((g: any) => ({
          id: g.id,
          title: g.title,
          platform: 'Unknown',
          coverUrl: g.header_image || g.coverUrl
        })));
      }
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };

  // Carica progetti con traduzioni (dalla Translation Memory e dizionari via Tauri)
  const fetchGameProjects = async () => {
    setIsLoading(true);
    try {
      const projectsMap = new Map<string, GameProject>();
      
      // Carica dizionari da Tauri
      try {
        const dictData = await invoke<any[]>('list_installed_dictionaries');
        for (const dict of ensureArray(dictData) as any[]) {
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
        console.warn('[Editor] Dizionari non disponibili:', dictError);
      }
      
      // Carica anche dai games con traduzioni saved (API Next.js come fallback)
      try {
        const transResponse = await fetch('/api/translations');
        const transData = transResponse.ok ? await transResponse.json() : [];
        
        for (const trans of ensureArray(transData) as any[]) {
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
        console.warn('[Editor] Traduzioni non disponibili:', transError);
      }
      
      // Se non ci sono progetti, mostra i games dalla library che hanno file di localizzazione
      if (projectsMap.size === 0) {
        try {
          const gamesResponse = await fetch('/api/games');
          const gamesData = gamesResponse.ok ? await gamesResponse.json() : [];
          
          // Filtra games con traduzioni (quelli che hanno translationStats)
          for (const game of ensureArray(gamesData) as any[]) {
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
          console.warn('[Editor] games non disponibili:', gamesError);
        }
      }
      
      setGameProjects(Array.from(projectsMap.values()));
    } catch (error) {
      console.error('Error loading game projects:', error);
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
    } catch (error) {
      console.error('Error loading translations:', error);
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
          console.log('[Editor] Traduzione salvata nel dizionario');
        } catch (dictError) {
          console.warn('[Editor] Impossibile salvare nel dizionario:', dictError);
        }
      }
      
      toast({ title: 'Salvato', description: 'Traduzione updated e salvata nel dizionario' });
    } catch (error) {
      console.error('Error saving translation:', error);
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
    } catch (error) {
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

  const handleManualSave = () => {
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
        
        let updated = prev.map(t => {
          const match = toUpdate.find(u => u.id === t.id);
          return match || t;
        });
        
        return [...updated, ...toAdd];
      });
      
      // Salva anche in localStorage per persistenza
      const existingData = localStorage.getItem('gamestringer_partial_translations');
      if (existingData) {
        try {
          const data = JSON.parse(existingData);
          // Aggiorna gli items esistenti con le modifiche manuali
          const updatedItems = data.items.map((item: any) => {
            const editedLine = translatedLines.find(l => 
              l.originalText === item.sourceText || l.id === item.id
            );
            if (editedLine) {
              return {
                ...item,
                translatedText: editedLine.translatedText,
                isManualEdit: true,
              };
            }
            return item;
          });
          data.items = updatedItems;
          data.timestamp = Date.now();
          localStorage.setItem('gamestringer_partial_translations', JSON.stringify(data));
          console.log('[Editor] saved modifiche manuali in localStorage:', translatedLines.length);
        } catch (err) {
          console.error('[Editor] error salvataggio localStorage:', err);
        }
      } else {
        // Crea nuovi dati se non esistono
        const newData = {
          timestamp: Date.now(),
          gameId: selectedTranslation.gameId,
          gameName: selectedTranslation.game.title,
          sourceLanguage: selectedTranslation.sourceLanguage,
          targetLanguage: 'it',
          completed: translatedLines.length,
          total: selectedTranslation.parsedLines.length,
          items: translatedLines.map(line => ({
            id: `manual-${line.lineNumber}`,
            sourceText: line.originalText,
            translatedText: line.translatedText,
            fromMemory: false,
            isManualEdit: true,
            metadata: { key: line.key, lineNumber: line.lineNumber }
          })),
        };
        localStorage.setItem('gamestringer_partial_translations', JSON.stringify(newData));
        console.log('[Editor] Creati nuovi dati in localStorage:', translatedLines.length);
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

  const deleteTranslation = async (id: string) => {
    if (!confirm('Eliminare questa traduzione?')) return;
    try {
      const response = await fetch(`/api/translations?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        setTranslations(prev => prev.filter(t => t.id !== id));
        if (selectedTranslation?.id === id) setSelectedTranslation(null);
        toast({ title: 'Eliminata', description: 'Traduzione rimossa' });
      }
    } catch (error) {
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
    } catch (error) {
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
    <div className="flex h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-900 via-purple-900/5 to-slate-900 overflow-hidden">
      {/* --- SIDEBAR: LIST & FILTERS --- */}
      <div className="w-80 border-r border-border/40 bg-slate-900/50 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border/40 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-purple-400" />
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Explorer</span>
            </h2>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowImportDialog(true)}>
                      <Upload className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Importa file</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Select onValueChange={(format) => exportTranslations(format as any)}>
                      <SelectTrigger className="h-7 w-7 p-0 border-0 bg-transparent">
                        <Download className="h-4 w-4" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="po">PO (gettext)</SelectItem>
                      </SelectContent>
                    </Select>
                  </TooltipTrigger>
                  <TooltipContent>Esporta</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Cerca..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs bg-slate-800/50 border-slate-700"
            />
            {searchTerm && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setSearchTerm('')}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-7 text-xs flex-1 bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="pending">In attesa</SelectItem>
                <SelectItem value="completed">Completati</SelectItem>
                <SelectItem value="edited">Modificati</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterGame} onValueChange={setFilterGame}>
              <SelectTrigger className="h-7 text-xs flex-1 bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="game" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">Tutti i games</SelectItem>
                {games.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
            <span>{filteredTranslations.length} elementi</span>
            <div className="flex gap-2">
              <span className="text-green-400">{stats.completed} ✓</span>
              <span className="text-yellow-400">{stats.pending} ⏳</span>
            </div>
          </div>
        </div>

        {/* Explorer List - Gerarchia games → File → Stringhe */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
            </div>
          ) : explorerView === 'games' ? (
            // Vista games
            gameProjects.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground text-sm">
                <Languages className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>Nessun progetto</p>
                <p className="text-xs mt-1 opacity-70">Traduci un game con Neural Translator</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {gameProjects.map((project, index) => (
                  <motion.div
                    key={project.game.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => { setSelectedProject(project); setExplorerView('files'); }}
                    className="flex items-center gap-3 p-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                      <Languages className="h-5 w-5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-purple-400 transition-colors">
                        {project.game.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {project.files.length} file • {project.totalStrings} stringhe
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-green-500/10 text-green-400 border-green-500/30">
                        {Math.round((project.completedStrings / Math.max(project.totalStrings, 1)) * 100)}%
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          ) : explorerView === 'files' && selectedProject ? (
            // Vista File del game selezionato
            <div className="flex flex-col">
              {/* Header con back button */}
              <div className="flex items-center gap-2 p-3 border-b border-slate-700 bg-slate-800/50 sticky top-0 z-10">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setExplorerView('games'); setSelectedProject(null); }}>
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </Button>
                <span className="font-medium text-sm truncate">{selectedProject.game.title}</span>
              </div>
              {selectedProject.files.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-sm">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>Nessun file</p>
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
                      "flex items-center gap-3 p-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-all cursor-pointer group",
                      selectedFile?.id === file.id && "bg-purple-500/10 border-l-2 border-l-purple-500"
                    )}
                  >
                    <div className="p-2 rounded bg-blue-500/10">
                      <FileText className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-blue-400 transition-colors">
                        {file.filename}
                      </p>
                      <p className="text-xs text-slate-500">
                        {file.stringCount} stringhe • {file.targetLanguage.toUpperCase()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-green-500/10 text-green-400 border-green-500/30">
                      {Math.round((file.completedCount / Math.max(file.stringCount, 1)) * 100)}%
                    </Badge>
                  </motion.div>
                ))
              )}
            </div>
          ) : (
            // Vista Stringhe (fallback alla lista originale)
            <div className="flex flex-col">
              {/* Header con back button */}
              <div className="flex items-center gap-2 p-3 border-b border-slate-700 bg-slate-800/50 sticky top-0 z-10">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setExplorerView('files'); setSelectedFile(null); }}>
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </Button>
                <span className="font-medium text-sm truncate">{selectedFile?.filename || 'Stringhe'}</span>
              </div>
              {filteredTranslations.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-sm">
                  <Languages className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>Nessuna stringa</p>
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
                      "flex flex-col items-start p-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-all text-left group relative cursor-pointer",
                      selectedTranslation?.id === t.id && "bg-purple-500/10 border-l-2 border-l-purple-500"
                    )}
                  >
                    <p className={cn(
                      "text-sm line-clamp-1 w-full",
                      selectedTranslation?.id === t.id ? "text-white" : "text-slate-300"
                    )}>
                      {t.originalText}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 w-full">
                      {t.translatedText || <span className="italic opacity-50">— non tradotto —</span>}
                    </p>
                    <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5 gap-0.5 mt-1", getStatusColor(t.status))}>
                      {getStatusIcon(t.status)}
                      <span className="ml-0.5">{t.status}</span>
                    </Badge>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* --- MAIN AREA: EDITOR --- */}
      <div className="flex-1 flex flex-col bg-slate-950/50 relative overflow-hidden">
        {selectedTranslation ? (
          <>
            {/* Toolbar */}
            <div className="h-auto min-h-12 border-b border-slate-800 flex flex-col gap-2 px-4 py-2 bg-slate-900/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-1.5 rounded-md bg-purple-500/20">
                    <Languages className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="truncate max-w-[150px]">{selectedTranslation.game.title}</span>
                      <ChevronRight className="h-3 w-3" />
                      <span className="truncate max-w-[150px] text-slate-500">{selectedTranslation.filePath.split('/').pop()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isMultiLangFile && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-green-500/30 text-green-400">
                          Multi-lingua
                        </Badge>
                      )}
                      {selectedTranslation.confidence > 0 && (
                        <span className="text-[10px] text-green-400">{Math.round(selectedTranslation.confidence * 100)}%</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={generateSuggestions} disabled={isGeneratingSuggestions}>
                    {isGeneratingSuggestions ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5 text-purple-400" />}
                    AI
                  </Button>
                  <Separator orientation="vertical" className="h-5 bg-slate-700" />
                  <Button 
                    size="sm" 
                    className={cn("h-8 text-xs", hasUnsavedChanges ? "bg-purple-600 hover:bg-purple-700" : "bg-slate-700")}
                    onClick={handleManualSave} 
                    disabled={!hasUnsavedChanges || isSaving}
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Salva
                  </Button>
                </div>
              </div>
              
              {/* Language Selector for multi-language files */}
              {isMultiLangFile && detectedLanguages.length > 0 && (
                <div className="flex items-center gap-4 pt-1 border-t border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 uppercase">Traduci da:</span>
                    <Select value={String(sourceLanguageIndex)} onValueChange={(v) => setSourceLanguageIndex(Number(v))}>
                      <SelectTrigger className="h-7 w-[130px] text-xs bg-slate-800/50 border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {detectedLanguages.map((lang, idx) => (
                          <SelectItem key={idx} value={String(idx)}>{lang}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <ArrowLeftRight className="h-3 w-3 text-slate-600" />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-purple-400 uppercase font-bold">→ Italiano</span>
                  </div>
                </div>
              )}
            </div>

            {/* Split Editor */}
            <div className="flex-1 flex overflow-hidden">
              {/* Strings List Panel (when parsed lines exist) */}
              {selectedTranslation.parsedLines && selectedTranslation.parsedLines.length > 0 ? (
                <div className="w-[320px] flex flex-col border-r border-slate-800 bg-slate-900/30">
                  <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-800">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Progresso
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {Math.round((selectedTranslation.parsedLines.filter(l => l.translatedText).length / selectedTranslation.parsedLines.length) * 100)}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-300"
                        style={{ 
                          width: `${(selectedTranslation.parsedLines.filter(l => l.translatedText).length / selectedTranslation.parsedLines.length) * 100}%` 
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-green-400 text-xs font-medium">
                        {selectedTranslation.parsedLines.filter(l => l.translatedText).length} tradotte
                      </span>
                      <span className="text-slate-500 text-xs">
                        {selectedTranslation.parsedLines.length - selectedTranslation.parsedLines.filter(l => l.translatedText).length} rimanenti
                      </span>
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-1">
                      {selectedTranslation.parsedLines.map((line, idx) => (
                        <button
                          key={line.lineNumber}
                          onClick={() => setSelectedLine(line)}
                          className={cn(
                            "w-full text-left p-2 rounded-md mb-0.5 transition-all border-l-2",
                            "hover:bg-slate-800/50",
                            selectedLine?.lineNumber === line.lineNumber 
                              ? "bg-purple-500/20 border-l-purple-500" 
                              : line.translatedText 
                                ? "border-l-green-500/50 bg-green-500/5" 
                                : "border-l-transparent"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "text-[9px] font-mono",
                              line.translatedText ? "text-green-500" : "text-slate-600"
                            )}>
                              {line.translatedText ? "✓" : "○"} #{line.lineNumber}
                            </span>
                            {line.key && (
                              <span className="text-[9px] text-purple-400 truncate max-w-[100px]">{line.key}</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                            {line.originalText}
                          </p>
                          {line.translatedText && (
                            <p className="text-[10px] text-green-400/70 line-clamp-1 mt-1 italic">
                              {line.translatedText}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                /* Original Panel (fallback for non-parsed content) */
                <div className="flex-1 flex flex-col border-r border-slate-800 min-w-[300px]">
                  <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Originale</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                      navigator.clipboard.writeText(selectedTranslation.originalText);
                      toast({ title: 'Copiato negli appunti' });
                    }}>
                      <Copy className="h-3 w-3 text-slate-500" />
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 p-6">
                    <p className="text-base leading-relaxed text-slate-300 whitespace-pre-wrap">
                      {selectedTranslation.originalText}
                    </p>
                  </ScrollArea>
                </div>
              )}

              {/* Selected String Editor */}
              {selectedTranslation.parsedLines && selectedTranslation.parsedLines.length > 0 && selectedLine ? (
                <div className="flex-1 flex flex-col min-w-[400px]">
                  {/* Original text of selected line */}
                  <div className="border-b border-slate-800">
                    <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Originale</span>
                        <span className="text-[9px] text-slate-600">Riga {selectedLine.lineNumber}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                        navigator.clipboard.writeText(selectedLine.originalText);
                        toast({ title: 'Copiato negli appunti' });
                      }}>
                        <Copy className="h-3 w-3 text-slate-500" />
                      </Button>
                    </div>
                    <div className="p-4 max-h-[200px] overflow-y-auto no-scrollbar">
                      <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                        {selectedLine.originalText}
                      </p>
                    </div>
                  </div>
                  
                  {/* Translation input */}
                  <div className="flex-1 flex flex-col">
                    <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Traduzione</span>
                      {selectedLine.translatedText && (
                        <Badge variant="outline" className="text-[9px] h-4 border-green-500/30 text-green-400">
                          Tradotto
                        </Badge>
                      )}
                    </div>
                    <div className="flex-1 p-4">
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
                        className="w-full h-full min-h-[150px] resize-none border-slate-700 bg-slate-800/30 text-sm leading-relaxed focus-visible:ring-purple-500/50 placeholder:text-slate-600"
                        placeholder="Inserisci la traduzione per questa stringa..."
                        spellCheck={false}
                      />
                    </div>
                  </div>
                </div>
              ) : selectedTranslation.parsedLines && selectedTranslation.parsedLines.length > 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                  <p className="text-sm">Seleziona una stringa dalla lista</p>
                </div>
              ) : (
                /* Original full editor for non-parsed content */
                <div className="flex-1 flex flex-col min-w-[300px] bg-slate-900/20">
                  <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Traduzione</span>
                    {hasUnsavedChanges && (
                      <Badge variant="outline" className="text-[9px] h-4 border-yellow-500/30 text-yellow-400 animate-pulse">
                        Non salvato
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1 p-4">
                    <Textarea
                      value={selectedTranslation.translatedText}
                      onChange={(e) => handleTranslationChange(e.target.value)}
                      className="w-full h-full min-h-[200px] resize-none border-slate-700 bg-slate-800/30 text-base leading-relaxed focus-visible:ring-purple-500/50 placeholder:text-slate-600"
                      placeholder="Inserisci la traduzione..."
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
            <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-6 border border-slate-700">
              <LayoutPanelLeft className="h-8 w-8 opacity-50" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-slate-400">Nessuna selezione</h3>
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
  );
}



