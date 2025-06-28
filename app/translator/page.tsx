'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, Gamepad2, FolderSearch, FileText, ArrowLeft, Languages, Wand2 } from 'lucide-react';

// Tipi di dati
interface Game { id: string; name: string; imageUrl: string; provider: string; }
interface FileHandle { name: string; handle: any; size: number; }

const TranslatorPage = () => {
  // Stati per la libreria giochi
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Stati per la selezione del gioco e dei file
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isFindingPath, setIsFindingPath] = useState(false);
  const [foundPath, setFoundPath] = useState<string | null>(null);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [gameFiles, setGameFiles] = useState<FileHandle[]>([]);

  // Stati per il traduttore
  const [selectedFile, setSelectedFile] = useState<FileHandle | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [provider, setProvider] = useState<'openai' | 'deepl' | 'google'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [translatedContent, setTranslatedContent] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatorError, setTranslatorError] = useState<string | null>(null);

  // Caricamento iniziale dei giochi
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await fetch('/api/library/games');
        if (!response.ok) {
          throw new Error('Errore nel caricamento della libreria dei giochi.');
        }
        const data = await response.json();
        console.log('Dati ricevuti da /api/library/games:', JSON.stringify(data, null, 2));
        setGames(data);
      } catch (err) {
        setApiError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  // Gestione selezione gioco e ricerca percorso
  const handleGameSelect = async (game: Game) => {
    setSelectedGame(game);
    setIsFindingPath(true);
    setFoundPath(null);
    setGameFiles([]);
    try {
      const response = await fetch(`/api/library/game-path?provider=${game.provider}&gameId=${game.id}`);
      if (response.ok) {
        const data = await response.json();
        setFoundPath(data.path);
        console.log(`Percorso per ${game.name}: ${data.path}`);
      } else {
        console.warn(`Nessun percorso di installazione automatico trovato per ${game.name}`);
      }
    } catch (error) {
      console.error('Errore durante la ricerca del percorso del gioco:', error);
    } finally {
      setIsFindingPath(false);
    }
  };

  // Selezione manuale cartella
  const handleFolderSelect = async () => {
    if (!selectedGame) return;
    setIsReadingFiles(true);
    setGameFiles([]);
    try {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker();
      const files: FileHandle[] = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && (entry.name.endsWith('.txt') || entry.name.endsWith('.json') || entry.name.endsWith('.xml'))) {
          const file = await entry.getFile();
          files.push({ name: entry.name, handle: entry, size: file.size });
        }
      }
      setGameFiles(files.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('Errore durante la selezione della cartella:', err);
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
    try {
      // @ts-ignore
      const fileHandle = await file.handle.getFile();
      const content = await fileHandle.text();
      setOriginalContent(content);
    } catch (err) {
      setTranslatorError('Impossibile leggere il file.');
      console.error('Errore lettura file:', err);
    } finally {
      setIsReadingFile(false);
    }
  };

  // Funzioni di navigazione UI
  const handleBackToLibrary = () => {
    setSelectedGame(null);
    setGameFiles([]);
    setFoundPath(null);
  };

  const handleBackToFileSelection = () => {
    setSelectedFile(null);
    setOriginalContent('');
    setTranslatedContent('');
    setTranslatorError(null);
  };
  
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

  // --- VISTE --- 

  // --- VISTA 1: LIBRERIA GIOCHI ---
  const GameLibraryView = () => (
    <>
      <h2 className="text-2xl font-bold tracking-tight flex items-center">
        <Gamepad2 className="mr-2 h-6 w-6"/>
        Libreria Giochi
      </h2>
      <p className="text-muted-foreground">Seleziona un gioco per iniziare.</p>
      
      {isFindingPath && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Ricerca del percorso del gioco in corso...</span>
        </div>
      )}
      <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-6 ${isFindingPath ? 'opacity-50 pointer-events-none' : ''}`}>
        {games.map((game) => (
          <Card 
            key={game.id} 
            className="hover:shadow-lg transition-shadow duration-200 cursor-pointer flex items-center justify-center text-center p-2 min-h-[100px]"
            onClick={() => handleGameSelect(game)}
          >
            <CardContent className="p-2">
                 <p className="font-semibold text-sm" title={game.name}>{game.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );

  // --- VISTA 2: SELEZIONE CARTELLA E FILE LIST ---
  const FileSelectionView = () => (
    <>
      <Button variant="ghost" onClick={handleBackToLibrary} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Torna alla libreria
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Gamepad2 className="mr-2 h-6 w-6"/>
            {selectedGame?.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">Seleziona la cartella di installazione del gioco per trovare i file di testo (.txt, .json, .xml).</p>
          {foundPath && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm font-semibold text-green-800">Percorso di installazione trovato automaticamente:</p>
              <p className="text-xs text-green-700 font-mono break-all">{foundPath}</p>
              <p className="text-xs text-muted-foreground mt-1">Puoi comunque selezionare una cartella diversa se necessario.</p>
            </div>
          )}
          <Button onClick={handleFolderSelect} className="w-full" disabled={isReadingFiles}>
            <FolderSearch className="mr-2 h-4 w-4" />
            {isReadingFiles ? 'Analisi cartella...' : 'Seleziona manualmente la cartella del gioco'}
          </Button>

          {isReadingFiles && (
            <div className="flex justify-center items-center py-6">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {gameFiles.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-lg mb-2">File di testo trovati</h3>
              <div className="border rounded-md max-h-60 overflow-y-auto">
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
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );

  // --- VISTA 3: TRADUTTORE ---
  const TranslatorView = () => (
    <>
      <Button variant="ghost" onClick={handleBackToFileSelection} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna alla selezione file
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5"/>
            Traduzione di: {selectedFile?.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isReadingFile ? (
              <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-sm font-medium">Testo Originale</label>
                      <Textarea value={originalContent} readOnly className="h-80 resize-none bg-muted/50" />
                  </div>
                  <div className="relative space-y-2">
                      <label className="text-sm font-medium">Traduzione</label>
                      <Textarea value={translatedContent} readOnly={isTranslating} placeholder={isTranslating ? '' : 'La traduzione apparirà qui...'} className="h-80 resize-none" />
                      {isTranslating && <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-md"><Loader2 className="h-6 w-6 animate-spin" /></div>}
                  </div>
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

  // --- LOGICA DI RENDER PRINCIPALE ---
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

        {selectedFile ? <TranslatorView /> : selectedGame ? <FileSelectionView /> : <GameLibraryView />}
    </div>
  )
}

export default TranslatorPage;