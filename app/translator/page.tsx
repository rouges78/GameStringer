'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, AlertTriangle, FolderOpen, FileText, ArrowLeft, 
  Languages, Wand2, CheckCircle, Book, Search, ChevronRight, Sparkles,
  FolderSearch, X, Zap
} from 'lucide-react';
import { GlossaryManager } from '@/components/glossary/glossary-manager';
import { invoke } from '@/lib/tauri-api';
import { GameGlossary } from '@/types/glossary';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// --- Tipi di Dati ---
interface Game {
  id: string;
  name: string;
  provider: string; // Manteniamo provider se serve altrove
  engine?: string;
  supportedLanguages?: string;
  coverUrl?: string;
  installPath?: string; // Percorso di installazione del gioco
}

interface FileHandle {
  name: string;
  handle?: any; // Opzionale per la selezione manuale
  path?: string;  // Opzionale per la scansione automatica
  size: number;
}

// --- Componente Principale ---
const TranslatorPage = () => {
  // --- STATI GLOBALI ---
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // --- STATI DI FLUSSO ---
  const [currentStep, setCurrentStep] = useState<'select-game' | 'confirm-path' | 'select-file' | 'translate'>('select-game');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  
  // Stati per la ricerca del percorso
  const [isFindingPath, setIsFindingPath] = useState(false);
  const [foundPath, setFoundPath] = useState<string | null>(null);
  
  // Stati per i file
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [gameFiles, setGameFiles] = useState<FileHandle[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileHandle | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Stati per la traduzione
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [provider, setProvider] = useState<'openai' | 'deepl' | 'google'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [translatedContent, setTranslatedContent] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatorError, setTranslatorError] = useState<string | null>(null);
  const [isMultiLangFile, setIsMultiLangFile] = useState(false);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [selectedSourceLanguage, setSelectedSourceLanguage] = useState('');
  const [parsedStrings, setParsedStrings] = useState<{ [key: string]: { [lang: string]: string } } | null>(null);
  const [isIniFile, setIsIniFile] = useState(false);
  const [supportedLanguages, setSupportedLanguages] = useState<string | null>(null);

  // Stati per il glossario
  const [glossary, setGlossary] = useState<GameGlossary | null>(null);
  const [showGlossary, setShowGlossary] = useState(false);

  // --- EFFETTI ---

  // Caricamento iniziale dei giochi - usa direttamente Tauri
  useEffect(() => {
    const fetchGames = async () => {
      try {
        // Carica dalla cache Tauri direttamente
        const cachedGames = await invoke('load_steam_games_cache');
        console.log('[Translator] Cache Tauri:', cachedGames);
        
        if (Array.isArray(cachedGames) && cachedGames.length > 0) {
            // Log per debug - mostra struttura primo gioco
            const installedGames = (cachedGames as any[]).filter((g: any) => g.is_installed);
            console.log(`[Translator] Totale cache: ${cachedGames.length}, Installati: ${installedGames.length}`);
            if (installedGames.length > 0) {
                console.log('[Translator] Esempio gioco installato:', JSON.stringify(installedGames[0], null, 2));
                console.log('[Translator] Chiavi disponibili:', Object.keys(installedGames[0]));
            }
            
            // Usa i giochi installati con nome - il campo è "title" non "name"!
            const games: Game[] = installedGames
                .filter((g: any) => g.title && g.title.trim() !== '')
                .map((g: any) => ({
                    id: String(g.steam_app_id || g.id),
                    name: g.title,
                    provider: g.platform || 'steam',
                    engine: g.engine,
                    supportedLanguages: g.supported_languages,
                    coverUrl: g.header_image || g.image_url,
                    installPath: g.install_path || null,
                }));

            const uniqueGamesMap = new Map(games.map((game) => [game.name, game]));
            const uniqueGames = Array.from(uniqueGamesMap.values());
            setGames(uniqueGames.sort((a, b) => a.name.localeCompare(b.name)));
            console.log(`[Translator] Caricati ${uniqueGames.length} giochi`);
            console.log(`[Translator] Caricati ${uniqueGames.length} giochi installati`);
        } else {
            console.warn('[Translator] Cache vuota, nessun gioco trovato');
            setGames([]);
        }
      } catch (err) {
        console.error('[Translator] Errore caricamento:', err);
        setApiError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  // --- GESTORI DI EVENTI ---

  // Gestione selezione gioco e ricerca automatica percorso
  const handleGameSelect = async (gameId: string) => {
    setSupportedLanguages(null); // Reset
    setFoundPath(null); // Reset percorso
    setScanError(null); // Reset errore scansione
    setIsFindingPath(true);

    const game = games.find(g => g.id === gameId);
    setSelectedGame(game || null);

    if (game) {
      setCurrentStep('confirm-path');
      
      // Cerca automaticamente il percorso di installazione in TUTTE le librerie Steam
      if (game.installPath) {
        try {
          // Usa il nuovo comando che cerca in tutte le librerie Steam
          const fullPath = await invoke<string>('find_game_install_path', { installDir: game.installPath });
          setFoundPath(fullPath);
          console.log('[Translator] Percorso trovato:', fullPath);
        } catch (err) {
          console.warn('[Translator] Gioco non trovato nelle librerie Steam:', err);
          // Non imposta nessun percorso - l'utente dovrà selezionare manualmente
          setFoundPath(null);
        }
      }
      setIsFindingPath(false);
      // Recupera le lingue supportate in background
      try {
        const response = await fetch(`/api/steam/game-details/${game.id}`);
        if (response.ok) {
          const data = await response.json();
          setSupportedLanguages(data.supported_languages);
        }
      } catch (error) {
        console.error('Errore nel recuperare i dettagli del gioco:', error);
      }
    } else {
      setCurrentStep('select-game');
    }

    // Reset stati successivi
    setGameFiles([]);
    setSelectedFile(null);
    setOriginalContent('');
    setTranslatedContent('');
    setTranslatorError(null);
  };

  // Legge i file dalla cartella
  const readFilesFromDirectory = async (dirHandle: any) => {
    setIsReadingFiles(true);
    setGameFiles([]);
    try {
      const files: FileHandle[] = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && (entry.name.endsWith('.txt') || entry.name.endsWith('.json') || entry.name.endsWith('.xml'))) {
          const file = await entry.getFile();
          files.push({ name: entry.name, handle: entry, size: file.size });
        }
      }
      setGameFiles(files.sort((a, b) => a.name.localeCompare(b.name)));
      setCurrentStep('select-file');
    } catch (err) {
      console.error('Errore durante la lettura della cartella:', err);
      setCurrentStep('confirm-path');
    } finally {
      setIsReadingFiles(false);
    }
  }

  // Selezione manuale cartella
  const handleManualFolderSelect = async () => {
    try {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker();
      await readFilesFromDirectory(dirHandle);
    } catch (err) {
      console.error('Selezione manuale annullata o fallita:', err);
    }
  };
  
  // Conferma percorso e lettura file
  const handleConfirmPath = async () => {
    if (!foundPath) return;

    setIsReadingFiles(true);
    setGameFiles([]);
    setTranslatorError(null); // Pulisce errori precedenti
    try {
        const response = await fetch('/api/library/scan-files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ directoryPath: foundPath }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Errore durante la scansione dei file.');
        }

        const data = await response.json();
        // L'API può restituire un array o un oggetto con .files
        const files: FileHandle[] = Array.isArray(data) ? data : (data.files || []);
        setGameFiles(files.sort((a, b) => a.name.localeCompare(b.name)));
        setCurrentStep('select-file');
    } catch (err: any) {
      setScanError(err.message); // Mostra l'errore inline, non blocca la pagina
      console.error('Errore durante la scansione dei file:', err);
      // Rimane al passo corrente per mostrare l'errore
    } finally {
        setIsReadingFiles(false);
    }
  };

  // Selezione e lettura file
  const handleFileSelect = async (file: FileHandle) => {
    setSelectedFile(file);
    setIsReadingFile(true);
    setOriginalContent('');
    setTranslatedContent('');
    setTranslatorError(null);
    setIsMultiLangFile(false);
    setAvailableLanguages([]);
    setSelectedSourceLanguage('');
    setParsedStrings(null);
    setIsIniFile(false);
    setCurrentStep('translate');

    try {
        let content = '';
        if (file.path) {
            const response = await fetch('/api/library/read-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: file.path }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Errore lettura file.');
            content = data.content;
        } else if (file.handle) {
            // @ts-ignore
            const fileHandle = await file.handle.getFile();
            content = await fileHandle.text();
        } else {
            throw new Error('Informazioni sul file non valide.');
        }

        // Chiama il parser per vedere se è un file multilingua
        const parseResponse = await fetch('/api/parser/multilang-csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });

        if (parseResponse.ok) {
            const data = await parseResponse.json();
            if (data.languages && data.languages.length > 0) {
                setIsMultiLangFile(true);
                setAvailableLanguages(data.languages);
                setParsedStrings(data.strings);
                // Imposta una lingua di default
                const defaultLang = data.languages.includes('English') ? 'English' : data.languages[0];
                handleSourceLanguageChange(defaultLang, data.strings);
            } else {
                setOriginalContent(content);
            }
        } else {
             // Se non è un CSV multilingua, controlla se è un file INI
            if (file.name.toLowerCase().endsWith('.ini')) {
                const iniParseResponse = await fetch('/api/parser/ini', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content }),
                });

                if (iniParseResponse.ok) {
                    const data = await iniParseResponse.json();
                    if (data.strings) {
                        setIsIniFile(true);
                        const formattedContent = Object.entries(data.strings)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join('\n');
                        setOriginalContent(formattedContent);
                    } else {
                        setOriginalContent(content); // Fallback
                    }
                } else {
                    setOriginalContent(content); // Fallback
                }
            } else {
                 setOriginalContent(content); // Fallback finale per file di testo semplici
            }
        }
    } catch (err: any) {
      setTranslatorError(err.message || 'Impossibile leggere il file.');
      console.error('Errore lettura file:', err);
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleSourceLanguageChange = (lang: string, strings: any) => {
    if (!strings) return;
    setSelectedSourceLanguage(lang);
    const content = Object.entries(strings)
        .map(([key, translations]) => `${key}: ${ (translations as any)[lang] || ''}`)
        .join('\n');
    setOriginalContent(content);
    setTranslatedContent(''); // Pulisce la traduzione precedente
  };

  // Applica il glossario al testo tradotto
  const applyGlossary = (text: string): string => {
    if (!glossary || glossary.entries.length === 0) return text;
    
    let result = text;
    for (const entry of glossary.entries) {
      if (entry.caseSensitive) {
        result = result.split(entry.original).join(entry.translation);
      } else {
        const regex = new RegExp(entry.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        result = result.replace(regex, entry.translation);
      }
    }
    return result;
  };

  // Avvio traduzione
  const handleStartTranslation = async () => {
    if (!apiKey || !originalContent) {
      setTranslatorError('La chiave API e il contenuto del file sono necessari.');
      return;
    }
    setIsTranslating(true);
    setTranslatorError(null);
    setTranslatedContent('');
    try {
      // Costruisci contesto completo dal glossario per l'IA
      let fullContext = '';
      
      if (glossary) {
        const contextParts: string[] = [];
        
        // Contesto del gioco
        if (glossary.metadata.genre) {
          contextParts.push(`Genere: ${glossary.metadata.genre}`);
        }
        if (glossary.metadata.setting) {
          contextParts.push(`Ambientazione: ${glossary.metadata.setting}`);
        }
        if (glossary.metadata.tone) {
          contextParts.push(`Tono della traduzione: ${glossary.metadata.tone}`);
        }
        if (glossary.metadata.worldContext) {
          contextParts.push(`Contesto: ${glossary.metadata.worldContext}`);
        }
        
        // Personaggi
        if (glossary.metadata.characters && glossary.metadata.characters.length > 0) {
          const charDescs = glossary.metadata.characters.map(c => {
            let desc = c.name;
            if (c.personality) desc += ` (${c.personality})`;
            if (c.speechStyle) desc += ` - parla in modo ${c.speechStyle}`;
            if (c.gender && c.gender !== 'unknown') desc += ` [${c.gender === 'male' ? 'M' : c.gender === 'female' ? 'F' : 'N'}]`;
            return desc;
          });
          contextParts.push(`Personaggi: ${charDescs.join('; ')}`);
        }
        
        // Termini da non tradurre
        if (glossary.metadata.doNotTranslate?.length > 0) {
          contextParts.push(`NON TRADURRE MAI questi termini: ${glossary.metadata.doNotTranslate.join(', ')}`);
        }
        
        // Glossario termini
        if (glossary.entries.length > 0) {
          const terms = glossary.entries.slice(0, 50).map(e => `"${e.original}" → "${e.translation}"`).join(', ');
          contextParts.push(`GLOSSARIO (usa SEMPRE queste traduzioni): ${terms}`);
        }
        
        if (contextParts.length > 0) {
          fullContext = '\n\n' + contextParts.join('\n');
        }
      }

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: originalContent, 
          provider,
          apiKey,
          targetLang: 'it',
          context: fullContext
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Errore sconosciuto dal server');
      }
      
      // Applica glossario post-traduzione per sicurezza
      const finalText = applyGlossary(data.translatedText);
      setTranslatedContent(finalText);
    } catch (err) {
      setTranslatorError(err instanceof Error ? err.message : 'Si è verificato un errore');
    } finally {
      setIsTranslating(false);
    }
  };

  // Funzioni di navigazione UI
  const handleBack = () => {
    switch (currentStep) {
      case 'translate':
        setSelectedFile(null);
        setOriginalContent('');
        setTranslatedContent('');
        setTranslatorError(null);
        setIsMultiLangFile(false);
        setAvailableLanguages([]);
        setSelectedSourceLanguage('');
        setParsedStrings(null);
        setIsIniFile(false);
        setCurrentStep(gameFiles.length > 0 ? 'select-file' : 'confirm-path');
        break;
      case 'select-file':
        setGameFiles([]);
        setCurrentStep('confirm-path');
        break;
      case 'confirm-path':
        setSelectedGame(null);
        setFoundPath(null);
        setCurrentStep('select-game');
        break;
    }
  };

  // Stato per la ricerca giochi
  const [searchQuery, setSearchQuery] = useState('');
  
  // Stato per la ricerca file
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  
  // Filtra giochi in base alla ricerca
  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return games;
    const query = searchQuery.toLowerCase();
    return games.filter(g => g.name.toLowerCase().includes(query));
  }, [games, searchQuery]);

  // Filtra file in base alla ricerca
  const filteredFiles = useMemo(() => {
    if (!fileSearchQuery.trim()) return gameFiles;
    const query = fileSearchQuery.toLowerCase();
    return gameFiles.filter(f => f.name.toLowerCase().includes(query));
  }, [gameFiles, fileSearchQuery]);

  // Step indicator
  const steps = [
    { id: 'select-game', label: 'Gioco', icon: Languages },
    { id: 'confirm-path', label: 'Cartella', icon: FolderOpen },
    { id: 'select-file', label: 'File', icon: FileText },
    { id: 'translate', label: 'Traduci', icon: Sparkles },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  // --- RENDER PRINCIPALE ---
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-muted-foreground">Caricamento giochi installati...</p>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="p-4 rounded-full bg-destructive/10">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <p className="text-lg text-destructive">{apiError}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Riprova
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
            <Languages className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Neural Translator</h1>
            <p className="text-sm text-muted-foreground">Traduci i testi dei tuoi giochi con l'IA</p>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                    isActive && "bg-primary text-primary-foreground shadow-lg shadow-primary/25",
                    isCompleted && "bg-green-500 text-white",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}>
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs mt-1.5 font-medium",
                    isActive && "text-primary",
                    isCompleted && "text-green-500",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "w-16 h-0.5 mx-2 transition-colors duration-300",
                    index < currentStepIndex ? "bg-green-500" : "bg-muted"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto">
        {/* Step 1: Select Game */}
        {currentStep === 'select-game' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca tra i tuoi giochi installati..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 bg-background/50 border-border/50"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Games count */}
            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
              <span>{filteredGames.length} giochi trovati</span>
              {searchQuery && <span>Filtro: "{searchQuery}"</span>}
            </div>

            {/* Games Grid */}
            <ScrollArea className="h-[500px] pr-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredGames.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => handleGameSelect(game.id)}
                    className={cn(
                      "group relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200",
                      "hover:border-primary/50 hover:bg-primary/5 hover:shadow-md",
                      "text-left w-full"
                    )}
                  >
                    {/* Game Cover */}
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {game.coverUrl ? (
                        <Image
                          src={game.coverUrl}
                          alt={game.name}
                          fill
                          className="object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Languages className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Game Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {game.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {game.provider}
                        </Badge>
                        {game.engine && (
                          <span className="text-[10px] text-muted-foreground">
                            {game.engine}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>

              {filteredGames.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="h-10 w-10 mb-3 opacity-50" />
                  <p>Nessun gioco trovato</p>
                  <p className="text-sm">Prova con un altro termine di ricerca</p>
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Step 2: Confirm Path */}
        {currentStep === 'confirm-path' && selectedGame && (
          <div className="space-y-6">
            {/* Back button */}
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Cambia gioco
            </Button>

            {/* Selected Game Card */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {selectedGame.coverUrl ? (
                  <Image
                    src={selectedGame.coverUrl}
                    alt={selectedGame.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Languages className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold">{selectedGame.name}</h2>
                <p className="text-sm text-muted-foreground">
                  Seleziona la cartella con i file di testo da tradurre
                </p>
              </div>
            </div>

            {/* Path Selection */}
            <div className="space-y-4">
              {/* Errore scansione */}
              {scanError && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-destructive">
                        Percorso non accessibile
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 break-all">
                        {scanError}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Il gioco potrebbe non essere installato. Usa il pulsante sotto per selezionare manualmente la cartella.
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setScanError(null)} 
                    variant="outline"
                    size="sm"
                    className="mt-3"
                  >
                    Chiudi
                  </Button>
                </div>
              )}

              {isFindingPath ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-muted-foreground">Ricerca percorso...</span>
                </div>
              ) : foundPath ? (
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-green-600 dark:text-green-400">
                        Percorso trovato!
                      </p>
                      <p className="text-sm text-muted-foreground font-mono mt-1 break-all">
                        {foundPath}
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleConfirmPath} 
                    className="w-full mt-4" 
                    disabled={isReadingFiles}
                  >
                    {isReadingFiles ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Scansione in corso...
                      </>
                    ) : (
                      <>
                        <FolderSearch className="mr-2 h-4 w-4" />
                        Cerca file di testo
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="p-6 rounded-xl border-2 border-dashed border-muted-foreground/25 text-center">
                  <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground mb-1">
                    Seleziona la cartella del gioco
                  </p>
                  <p className="text-xs text-muted-foreground/70 mb-4">
                    Cerca la cartella contenente i file di localizzazione
                  </p>
                </div>
              )}

              <Button 
                onClick={handleManualFolderSelect} 
                variant="outline" 
                className="w-full h-12"
                disabled={isReadingFiles}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                {isReadingFiles ? 'Analisi in corso...' : 'Seleziona cartella manualmente'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Select File */}
        {currentStep === 'select-file' && (
          <div className="space-y-6">
            {/* Back button */}
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Cambia cartella
            </Button>

            {/* Files Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">File trovati</h2>
                <p className="text-sm text-muted-foreground">
                  {filteredFiles.length}/{gameFiles.length} file di testo compatibili
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualFolderSelect}
                className="gap-2"
              >
                <FolderSearch className="h-4 w-4" />
                Cerca altra cartella
              </Button>
            </div>

            {/* Search Files */}
            {gameFiles.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca file per nome..."
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-background/50 border-border/50"
                />
                {fileSearchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setFileSearchQuery('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {/* Files List */}
            {isReadingFiles ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-muted-foreground">Scansione file...</span>
              </div>
            ) : filteredFiles.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredFiles.map((file, index) => (
                    <button
                      key={file.path || `${file.name}-${index}`}
                      onClick={() => handleFileSelect(file)}
                      className={cn(
                        "w-full flex items-center gap-3 p-4 rounded-xl border transition-all",
                        "hover:border-primary/50 hover:bg-primary/5 text-left"
                      )}
                    >
                      <div className="p-2 rounded-lg bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mb-3 opacity-50" />
                <p>Nessun file di testo trovato</p>
                <p className="text-sm">Prova a selezionare un'altra cartella</p>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Translate */}
        {currentStep === 'translate' && selectedFile && (
          <div className="space-y-6">
            {/* Back button */}
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Cambia file
            </Button>

            {/* File Info */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>

            {isReadingFile ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-muted-foreground">Lettura file...</span>
              </div>
            ) : (
              <>
                {/* Translation Panels */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Testo Originale</Label>
                      {isMultiLangFile && availableLanguages.length > 0 && (
                        <Select 
                          value={selectedSourceLanguage} 
                          onValueChange={(lang) => handleSourceLanguageChange(lang, parsedStrings)}
                        >
                          <SelectTrigger className="w-[140px] h-8">
                            <SelectValue placeholder="Lingua" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableLanguages.map(lang => (
                              <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <Textarea
                      value={originalContent}
                      readOnly
                      className="h-[300px] font-mono text-sm bg-muted/30 resize-none"
                      placeholder="Il contenuto del file apparirà qui."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Traduzione Italiana</Label>
                    <Textarea
                      value={translatedContent}
                      readOnly
                      className="h-[300px] font-mono text-sm bg-muted/30 resize-none"
                      placeholder="La traduzione apparirà qui."
                    />
                  </div>
                </div>

                {/* Error */}
                {translatorError && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <p className="text-sm text-destructive">{translatorError}</p>
                  </div>
                )}

                {/* Translation Settings */}
                <div className="p-4 rounded-xl bg-muted/30 border space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Servizio AI</Label>
                      <Select 
                        value={provider} 
                        onValueChange={(value: 'openai' | 'deepl' | 'google') => setProvider(value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4" />
                              OpenAI GPT-4o
                            </div>
                          </SelectItem>
                          <SelectItem value="deepl">DeepL</SelectItem>
                          <SelectItem value="google">Google Translate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">API Key</Label>
                      <Input 
                        type="password" 
                        value={apiKey} 
                        onChange={(e) => setApiKey(e.target.value)} 
                        placeholder="Inserisci la tua API key"
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="text-sm text-muted-foreground">
                        Costo stimato: <span className="font-semibold text-foreground">
                          ${((originalContent.length / 4) / 1000 * 0.50).toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Glossary Toggle */}
                  <div className="flex items-center gap-3 pt-2 border-t">
                    <Button 
                      variant={showGlossary ? "default" : "outline"} 
                      size="sm"
                      onClick={() => setShowGlossary(!showGlossary)}
                    >
                      <Book className="mr-2 h-4 w-4" />
                      Glossario {glossary?.entries.length ? `(${glossary.entries.length})` : ''}
                    </Button>
                    {glossary && glossary.entries.length > 0 && (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Attivo
                      </Badge>
                    )}
                  </div>

                  {/* Translate Button */}
                  <Button 
                    onClick={handleStartTranslation} 
                    disabled={isTranslating || !apiKey || !originalContent}
                    className="w-full h-12 text-base"
                    size="lg"
                  >
                    {isTranslating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Traduzione in corso...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Avvia Traduzione AI
                      </>
                    )}
                  </Button>
                </div>

                {/* Glossary Panel */}
                {showGlossary && selectedGame && (
                  <div className="border rounded-xl overflow-hidden">
                    <GlossaryManager
                      gameId={selectedGame.id}
                      gameName={selectedGame.name}
                      sourceLanguage="en"
                      targetLanguage="it"
                      onGlossaryChange={setGlossary}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TranslatorPage;