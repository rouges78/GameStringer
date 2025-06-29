'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle, Gamepad2, FolderSearch, FileText, ArrowLeft, Languages, Wand2, CheckCircle } from 'lucide-react';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { LanguageFlags } from '@/components/ui/language-flags';

// --- Tipi di Dati ---
interface Game {
  id: string;
  name: string;
  provider: string;
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

  // --- EFFETTI ---

  // Caricamento iniziale dei giochi
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await fetch('/api/library/games');
        if (!response.ok) {
          throw new Error('Errore nel caricamento della libreria dei giochi.');
        }
        const data = await response.json() as { games: Game[] };
        if (Array.isArray(data.games)) {
            // Filtra i duplicati basati sul nome del gioco, poi ordina
            const uniqueGamesMap = new Map(data.games.map((game) => [game.name, game]));
            const uniqueGames = Array.from(uniqueGamesMap.values());
            setGames(uniqueGames.sort((a, b) => a.name.localeCompare(b.name)));
        } else {
            throw new Error("Formato dati della libreria non valido.");
        }
      } catch (err) {
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

    const game = games.find(g => g.id === gameId);
    setSelectedGame(game || null);

    if (game) {
      setCurrentStep('confirm-path');
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

        const files: FileHandle[] = await response.json();
        setGameFiles(files.sort((a, b) => a.name.localeCompare(b.name)));
        setCurrentStep('select-file');
    } catch (err: any) {
        setApiError(err.message); // Mostra l'errore all'utente
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
            if (!response.ok) throw new Error((await response.json()).error || 'Errore lettura file.');
            content = (await response.json()).content;
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
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: originalContent, 
          provider,
          apiKey,
          targetLang: 'it' 
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Errore sconosciuto dal server');
      }
      setTranslatedContent(data.translatedText);
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

  const gameOptions: ComboboxOption[] = games.map(g => ({ value: g.id, label: g.name }));

  // --- VISTE ---

  const SelectGameView = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Gamepad2 className="mr-2 h-6 w-6"/>
          Passo 1: Seleziona il Gioco
        </CardTitle>
        <CardDescription>Scegli il titolo di cui vuoi tradurre i file di testo.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
              <Combobox
                options={gameOptions}
                value={selectedGame?.id || ''}
                onChange={handleGameSelect}
                placeholder="Cerca un gioco..."
                emptyPlaceholder="Nessun gioco trovato."
              />
              {supportedLanguages && <LanguageFlags supportedLanguages={supportedLanguages} />}
            </div>
      </CardContent>
    </Card>
  );

  const ConfirmPathView = () => {
    return (
      <>
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna alla selezione del gioco
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FolderSearch className="mr-2 h-6 w-6"/>
              Passo 2: Conferma Percorso per "{selectedGame?.name}"
            </CardTitle>
            <CardDescription>Verifica il percorso di installazione o selezionalo manualmente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isFindingPath ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-3">Ricerca del percorso del gioco in corso...</span>
              </div>
            ) : foundPath ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                    <CheckCircle className="h-6 w-6 text-green-600 mr-3"/>
                    <div>
                        <p className="text-sm font-semibold text-green-800">Percorso di installazione trovato!</p>
                        <p className="text-sm text-green-700 font-mono break-all">{foundPath}</p>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">Clicca per avviare la ricerca dei file di testo in questa cartella.</p>
                <Button onClick={handleConfirmPath} className="w-full mt-4" disabled={isReadingFiles}>
                  {isReadingFiles ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ricerca in corso...</> : 'Conferma e cerca i file'}
                </Button>
              </div>
            ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                    <p className="text-sm font-semibold text-yellow-800">Percorso non trovato automaticamente.</p>
                    <p className="text-xs text-yellow-700">Nessun problema, puoi selezionarlo tu.</p>
                </div>
            )}
             <Button onClick={handleManualFolderSelect} variant="outline" className="w-full" disabled={isReadingFiles}>
                <FolderSearch className="mr-2 h-4 w-4" />
                {isReadingFiles ? 'Analisi cartella...' : 'Seleziona manualmente la cartella'}
            </Button>
          </CardContent>
        </Card>
      </>
    );
  };

  const FileSelectionView = () => (
     <>
      <Button variant="ghost" onClick={handleBack} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Torna alla conferma del percorso
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="mr-2 h-6 w-6"/>
            Passo 3: Seleziona il File da Tradurre
          </CardTitle>
           <CardDescription>
            Sono stati trovati {gameFiles.length} file di testo compatibili.
          </CardDescription>
        </CardHeader>
        <CardContent>
           {isReadingFiles ? (
            <div className="flex justify-center items-center py-6">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : gameFiles.length > 0 ? (
            <div className="border rounded-md max-h-80 overflow-y-auto">
              {gameFiles.map((file) => (
                <div 
                  key={file.name} 
                  onClick={() => handleFileSelect(file)}
                  className="p-3 flex justify-between items-center cursor-pointer hover:bg-muted border-b last:border-b-0"
                >
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 mr-3 text-muted-foreground"/>
                    <span className="font-medium">{file.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{Math.round(file.size / 1024)} KB</span>
                </div>
              ))}
            </div>
          ) : (
             <div className="text-center py-10 text-muted-foreground">
                <p>Nessun file di testo (.txt, .json, .xml) trovato nella cartella selezionata.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );

  const TranslateView = () => {
    // Calcolo costo stimato
    const getEstimatedCost = () => {
        const chars = originalContent.length;
        if (chars === 0) return '0.0000';
        switch (provider) {
        case 'openai': return ((chars / 4) / 1000 * 0.50).toFixed(4); // Stima basata su gpt-4o
        case 'deepl': return (chars / 1000000 * 25).toFixed(4);
        case 'google': return (chars / 1000000 * 20).toFixed(4);
        default: return '0.0000';
        }
    };
    
    return (
        <>
        <Button variant="ghost" onClick={handleBack} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna alla selezione file
        </Button>
        <Card>
            <CardHeader>
            <CardTitle className="flex items-center">
                <Wand2 className="mr-2 h-5 w-5"/>
                Passo 4: Traduci "{selectedFile?.name}"
            </CardTitle>
            </CardHeader>
            <CardContent>
            {isReadingFile ? (
                <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
                <div className="grid md:grid-cols-2 gap-6 h-full">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="original-text">Testo Originale</Label>
                  {isMultiLangFile && availableLanguages.length > 0 && (
                    <Select value={selectedSourceLanguage} onValueChange={(lang) => handleSourceLanguageChange(lang, parsedStrings)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Seleziona Lingua" />
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
                  id="original-text"
                  value={originalContent}
                  readOnly
                  className="h-full min-h-[400px] bg-background/50 font-mono text-sm"
                  placeholder="Il contenuto del file apparirà qui."
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="translated-text">Traduzione</Label>
                <Textarea
                  id="translated-text"
                  value={translatedContent}
                  readOnly
                  className="h-full min-h-[400px] bg-background/50 font-mono text-sm"
                  placeholder="La traduzione apparirà qui."
                />
              </div>
            </div>
            )}
            {translatorError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
                    <AlertTriangle className="h-5 w-5 text-red-600 mr-3"/>
                    <p className="text-sm text-red-800">{translatorError}</p>
                </div>
            )}
            <div className="mt-6 p-4 border rounded-lg bg-slate-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Servizio AI</label>
                        <Select value={provider} onValueChange={(value: 'openai' | 'deepl' | 'google') => setProvider(value)}>
                            <SelectTrigger><SelectValue placeholder="Seleziona un provider" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="openai">OpenAI (gpt-4o)</SelectItem>
                                <SelectItem value="deepl">DeepL</SelectItem>
                                <SelectItem value="google">Google Translate</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">API Key</label>
                        <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="La tua chiave API" />
                    </div>
                    <div className="text-sm text-muted-foreground self-center pt-5">
                        Costo Stimato: <strong>${getEstimatedCost()}</strong>
                    </div>
                </div>
                {translatorError && <p className="text-sm text-red-500 mt-2">{translatorError}</p>}
                <Button onClick={handleStartTranslation} disabled={isTranslating || !apiKey || isReadingFile || !originalContent} className="mt-4 w-full">
                    {isTranslating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Traduzione in corso...</> : <><Wand2 className="mr-2 h-4 w-4" /> Avvia Traduzione AI</>}
                </Button>
            </div>
            </CardContent>
        </Card>
        </>
    );
  }

  const renderCurrentStep = () => {
    switch(currentStep) {
        case 'select-game':
            return <SelectGameView />;
        case 'confirm-path':
            return <ConfirmPathView />;
        case 'select-file':
            return <FileSelectionView />;
        case 'translate':
            return <TranslateView />;
        default:
            return <p>Stato non valido</p>;
    }
  }


  // --- RENDER PRINCIPALE ---
  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>
  }

  if (apiError) {
    return <div className="p-6 text-center text-red-500"><AlertTriangle className="mx-auto h-10 w-10 mb-3"/> <p className="text-lg">{apiError}</p></div>
  }

  return (
    <div className="p-6">
        <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
                <Languages className="mr-3 h-8 w-8"/>
                GameStringer AI Translator
            </h1>
            <p className="text-muted-foreground">Traduci i testi dei tuoi giochi preferiti con l'aiuto dell'IA.</p>
        </div>

        <div className="mx-auto max-w-2xl">
            {renderCurrentStep()}
        </div>
    </div>
  )
}

export default TranslatorPage;