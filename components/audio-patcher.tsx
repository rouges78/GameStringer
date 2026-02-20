'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Music, Undo2, PlayCircle, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';

interface AudioFile {
  name: string;
  path: string;
  size_bytes: number;
  extension: string;
}

interface AudioPatcherProps {
  gamePath: string;
}

export default function AudioPatcher({ gamePath }: AudioPatcherProps) {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedFile, setSelectedFile] = useState<AudioFile | null>(null);
  const [isPatching, setIsPatching] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [xttsText, setXttsText] = useState('');

  const scanAudioFiles = async () => {
    if (!gamePath) {
      toast.error('Path del gioco non disponibile');
      return;
    }
    setIsScanning(true);
    setAudioFiles([]);
    setSelectedFile(null);

    try {
      const files = await invoke<AudioFile[]>('scan_game_audio_files', { gamePath });
      setAudioFiles(files);
      if (files.length === 0) {
        toast.info('Nessun file audio supportato trovato nella cartella del gioco.');
      } else {
        toast.success(`Trovati ${files.length} file audio.`);
      }
    } catch (err: unknown) {
      console.error('Errore durante la scansione audio:', err);
      toast.error('Errore durante la scansione audio', { description: err.toString() });
    } finally {
      setIsScanning(false);
    }
  };

  const handlePatch = async () => {
    if (!selectedFile) return;
    if (!xttsText.trim()) {
      toast.error('Inserisci il testo da sintetizzare.');
      return;
    }

    setIsPatching(true);
    const toastId = toast.loading('Generazione audio con XTTS...');

    try {
      // 1. Genera audio Base64 da XTTS (backend esistente)
      const base64Audio = await invoke<string>('tts_synthesize', {
        text: xttsText,
        voiceId: 'base', // Oppure consenti la selezione di una voce clone
        language: 'it',
      });

      toast.loading('Sostituzione del file audio originale in corso...', { id: toastId });

      // 2. Sostituisce il file in-game
      await invoke('replace_audio_file', {
        originalPath: selectedFile.path,
        newAudioBase64: base64Audio,
      });

      toast.success('File audio patchato con successo! Backup originale creato.', { id: toastId });
      setXttsText(''); // Pulisci l'input
    } catch (err: unknown) {
      console.error('Errore patch audio:', err);
      toast.error('Errore durante la patch audio', { description: err.toString(), id: toastId });
    } finally {
      setIsPatching(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) return;

    setIsRestoring(true);
    try {
      await invoke('restore_audio_file', { originalPath: selectedFile.path });
      toast.success('File originale ripristinato con successo.');
    } catch (err: unknown) {
      console.error('Errore restore audio:', err);
      toast.error('Errore durante il ripristino del file audio', { description: err.toString() });
    } finally {
      setIsRestoring(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
        <div>
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-1.5">
            <Music className="h-4 w-4 text-purple-400" /> Scanner Audio
          </h3>
          <p className="text-xs text-slate-400">
            Cerca file .wav, .ogg e .mp3 nella cartella del gioco.
          </p>
        </div>
        <Button 
          onClick={scanAudioFiles} 
          disabled={isScanning || !gamePath}
          size="sm"
          className="bg-purple-600 hover:bg-purple-700"
        >
          {isScanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          {isScanning ? 'Scansione...' : 'Scansiona'}
        </Button>
      </div>

      {audioFiles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lista file */}
          <div className="bg-black/30 border border-white/5 rounded-lg flex flex-col h-[400px]">
            <div className="p-3 border-b border-white/5 flex justify-between items-center bg-black/40 rounded-t-lg">
              <span className="text-xs font-semibold text-white/70 uppercase">File Audio Trovati ({audioFiles.length})</span>
            </div>
            <div className="overflow-y-auto p-2 space-y-1 flex-1 custom-scrollbar">
              {audioFiles.map((file, i) => (
                <div 
                  key={i}
                  onClick={() => setSelectedFile(file)}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                    selectedFile?.path === file.path 
                      ? 'bg-purple-600/30 border border-purple-500/50' 
                      : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Music className={`h-3.5 w-3.5 shrink-0 ${selectedFile?.path === file.path ? 'text-purple-400' : 'text-slate-400'}`} />
                    <span className="text-xs truncate text-white/90" title={file.name}>{file.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 ml-2 bg-black/40 px-1.5 py-0.5 rounded">
                    {formatSize(file.size_bytes)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Dettagli File Selezionato / Patcher */}
          <div className="bg-black/30 border border-white/5 rounded-lg p-4 flex flex-col justify-center relative h-[400px]">
            {!selectedFile ? (
              <div className="text-center text-white/30 space-y-2">
                <HardDrive className="h-10 w-10 mx-auto opacity-20" />
                <p className="text-sm">Seleziona un file audio dalla lista</p>
                <p className="text-xs opacity-60">Potrai rimpiazzarlo con XTTS</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="mb-4">
                  <h4 className="text-sm font-bold text-purple-400 mb-1 truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate" title={selectedFile.path}>
                    {selectedFile.path}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-black/50 px-2 py-1 rounded text-white/70">
                      Formato: <span className="font-semibold text-white">{selectedFile.extension.toUpperCase()}</span>
                    </span>
                    <span className="text-xs bg-black/50 px-2 py-1 rounded text-white/70">
                      Size: <span className="font-semibold text-white">{formatSize(selectedFile.size_bytes)}</span>
                    </span>
                  </div>
                </div>

                <div className="flex-1 bg-black/40 rounded p-3 mb-4 border border-white/5 flex flex-col">
                  <label className="text-xs font-semibold text-white/70 uppercase mb-2">Testo da Sintetizzare (XTTS)</label>
                  <textarea
                    value={xttsText}
                    onChange={(e) => setXttsText(e.target.value)}
                    placeholder="Scrivi qui il dialogo tradotto in italiano..."
                    className="flex-1 bg-black/50 border border-white/10 rounded p-2 text-sm text-white focus:outline-none focus:border-purple-500 resize-none custom-scrollbar"
                  />
                  <div className="mt-2 flex justify-end">
                     {/* Potremmo aggiungere un pulsante per selezionare la voce clonate in futuro */}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-auto pt-4 border-t border-white/5">
                  <Button 
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-xs" 
                    onClick={handlePatch}
                    disabled={isPatching || !xttsText.trim() || isRestoring}
                  >
                    {isPatching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
                    {isPatching ? 'Patching...' : 'Genera & Patcha File'}
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="bg-black/30 border-white/10 hover:bg-red-900/30 hover:text-red-400 hover:border-red-900/50 text-xs"
                    onClick={handleRestore}
                    disabled={isRestoring || isPatching}
                    title="Ripristina il file originale (se esiste un backup)"
                  >
                    {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
