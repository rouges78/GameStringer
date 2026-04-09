'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Volume2, VolumeX, Play, Pause, Square, Settings,
  RefreshCw, Download, Loader2, Mic, Speaker
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';

// Voci disponibili per la Web Speech API
const BROWSER_VOICES = [
  { id: 'it-IT', name: 'Italiano', lang: 'it-IT' },
  { id: 'en-US', name: 'English (US)', lang: 'en-US' },
  { id: 'en-GB', name: 'English (UK)', lang: 'en-GB' },
  { id: 'es-ES', name: 'Español', lang: 'es-ES' },
  { id: 'fr-FR', name: 'Français', lang: 'fr-FR' },
  { id: 'de-DE', name: 'Deutsch', lang: 'de-DE' },
  { id: 'ja-JP', name: '日本語', lang: 'ja-JP' },
  { id: 'zh-CN', name: '中文', lang: 'zh-CN' },
  { id: 'ko-KR', name: '한국어', lang: 'ko-KR' },
  { id: 'pt-BR', name: 'Português', lang: 'pt-BR' },
  { id: 'ru-RU', name: 'Русский', lang: 'ru-RU' },
];

// Preset di stile vocale
const VOICE_PRESETS = [
  { id: 'normal', name: 'Normale', rate: 1, pitch: 1 },
  { id: 'slow', name: 'Lento', rate: 0.7, pitch: 1 },
  { id: 'fast', name: 'Veloce', rate: 1.3, pitch: 1 },
  { id: 'deep', name: 'Profondo', rate: 0.9, pitch: 0.7 },
  { id: 'high', name: 'Alto', rate: 1, pitch: 1.3 },
  { id: 'dramatic', name: 'Drammatico', rate: 0.8, pitch: 0.9 },
  { id: 'excited', name: 'Eccitato', rate: 1.2, pitch: 1.2 },
  { id: 'whisper', name: 'Sussurro', rate: 0.6, pitch: 0.8 },
];

interface TTSPreviewProps {
  text: string;
  language?: string;
  compact?: boolean;
  autoPlay?: boolean;
  onPlay?: () => void;
  onStop?: () => void;
}

export function TTSPreview({
  text,
  language = 'it-IT',
  compact = false,
  autoPlay = false,
  onPlay,
  onStop
}: TTSPreviewProps) {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(language);
  const [selectedPreset, setSelectedPreset] = useState(VOICE_PRESETS[0]);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [useOpenAI, setUseOpenAI] = useState(false);
  const [openAIVoice, setOpenAIVoice] = useState('nova');
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Carica le voci del browser
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Aggiorna rate e pitch quando cambia il preset
  useEffect(() => {
    setRate(selectedPreset.rate);
    setPitch(selectedPreset.pitch);
  }, [selectedPreset]);

  // Auto-play se richiesto
  useEffect(() => {
    if (autoPlay && text) {
      handlePlay();
    }
  }, [autoPlay, text]);

  const findBestVoice = (lang: string): SpeechSynthesisVoice | null => {
    // Prima cerca una voce esatta
    let voice = availableVoices.find(v => v.lang === lang);
    if (voice) return voice;

    // Cerca una voce con lo stesso prefisso di lingua
    const langPrefix = lang.split('-')[0];
    voice = availableVoices.find(v => v.lang.startsWith(langPrefix));
    if (voice) return voice;

    // Fallback alla prima voce disponibile
    return availableVoices[0] || null;
  };

  const handlePlay = async () => {
    if (!text) {
      toast.error('Nessun testo da riprodurre');
      return;
    }

    // Stop qualsiasi riproduzione in corso
    handleStop();

    if (useOpenAI) {
      await playWithOpenAI();
    } else {
      playWithBrowser();
    }
  };

  const playWithBrowser = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = findBestVoice(selectedVoice);
    
    if (voice) {
      utterance.voice = voice;
    }
    
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    utterance.lang = selectedVoice;

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      onPlay?.();
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      onStop?.();
    };

    utterance.onerror = (e) => {
      clientLogger.error('TTS Error:', e);
      setIsPlaying(false);
      toast.error('Errore nella riproduzione vocale');
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const playWithOpenAI = async () => {
    setIsLoading(true);
    
    try {
      // Chiamata diretta OpenAI TTS (no API routes Next.js)
      let openaiKey = '';
      try {
        const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
        openaiKey = settings?.openaiApiKey || settings?.voice?.openaiKey || '';
      } catch {}
      if (!openaiKey) throw new Error('OpenAI API key non configurata');

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: openAIVoice,
          speed: rate,
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Errore API TTS');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(audioUrl);
      audio.volume = volume;
      
      audio.onplay = () => {
        setIsPlaying(true);
        setIsPaused(false);
        onPlay?.();
      };
      
      audio.onended = () => {
        setIsPlaying(false);
        setIsPaused(false);
        URL.revokeObjectURL(audioUrl);
        onStop?.();
      };
      
      audio.onerror = () => {
        setIsPlaying(false);
        toast.error('Errore riproduzione audio');
      };
      
      audioRef.current = audio;
      audio.play();
      
    } catch (error: unknown) {
      clientLogger.error('OpenAI TTS Error:', error);
      toast.error('Errore TTS OpenAI. Prova con la voce del browser.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = () => {
    if (useOpenAI && audioRef.current) {
      audioRef.current.pause();
      setIsPaused(true);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    if (useOpenAI && audioRef.current) {
      audioRef.current.play();
      setIsPaused(false);
    } else {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  };

  const handleStop = () => {
    if (useOpenAI && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } else {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    onStop?.();
  };

  const applyPreset = (preset: typeof VOICE_PRESETS[0]) => {
    setSelectedPreset(preset);
    setRate(preset.rate);
    setPitch(preset.pitch);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={isPlaying ? handleStop : handlePlay}
          disabled={!text || isLoading}
          className="h-7 px-2"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isPlaying ? (
            <Square className="h-3 w-3" />
          ) : (
            <Volume2 className="h-3 w-3" />
          )}
        </Button>
        
        <Select value={selectedVoice} onValueChange={setSelectedVoice}>
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BROWSER_VOICES.map(v => (
              <SelectItem key={v.id} value={v.id} className="text-xs">
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-green-400" />
            <CardTitle className="text-base">{t('ttsPreviewComp.texttospeechPreview')}</CardTitle>
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7">
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">{t('ttsPreviewComp.impostazioniVoce')}</h4>

                {/* Provider Toggle */}
                <div className="flex gap-2">
                  <Button
                    variant={!useOpenAI ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setUseOpenAI(false)}
                    className="flex-1 h-7 text-xs"
                  >
                    <Speaker className="h-3 w-3 mr-1" />
                    Browser
                  </Button>
                  <Button
                    variant={useOpenAI ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setUseOpenAI(true)}
                    className="flex-1 h-7 text-xs"
                  >
                    <Mic className="h-3 w-3 mr-1" />
                    OpenAI
                  </Button>
                </div>

                {useOpenAI ? (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('ttsPreviewComp.voceOpenai')}</label>
                    <Select value={openAIVoice} onValueChange={setOpenAIVoice}>
                      <SelectTrigger className="bg-muted/50 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nova">{t('ttsPreviewComp.novaFemminile')}</SelectItem>
                        <SelectItem value="alloy">{t('ttsPreviewComp.alloyNeutro')}</SelectItem>
                        <SelectItem value="echo">{t('ttsPreviewComp.echoMaschile')}</SelectItem>
                        <SelectItem value="fable">{t('ttsPreviewComp.fableNarratore')}</SelectItem>
                        <SelectItem value="onyx">{t('ttsPreviewComp.onyxProfondo')}</SelectItem>
                        <SelectItem value="shimmer">{t('ttsPreviewComp.shimmerSoft')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('ttsPreviewComp.lingua')}</label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                      <SelectTrigger className="bg-muted/50 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BROWSER_VOICES.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Rate */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Velocità: {rate.toFixed(1)}x
                  </label>
                  <Slider
                    value={[rate]}
                    onValueChange={([v]) => setRate(v)}
                    min={0.5}
                    max={2}
                    step={0.1}
                  />
                </div>

                {/* Pitch (solo browser) */}
                {!useOpenAI && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Tono: {pitch.toFixed(1)}
                    </label>
                    <Slider
                      value={[pitch]}
                      onValueChange={([v]) => setPitch(v)}
                      min={0.5}
                      max={2}
                      step={0.1}
                    />
                  </div>
                )}

                {/* Volume */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Volume: {Math.round(volume * 100)}%
                  </label>
                  <Slider
                    value={[volume]}
                    onValueChange={([v]) => setVolume(v)}
                    min={0}
                    max={1}
                    step={0.1}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Voice Presets */}
        <div className="flex gap-1 mt-2 flex-wrap">
          {VOICE_PRESETS.slice(0, 5).map(preset => (
            <Badge
              key={preset.id}
              variant={selectedPreset.id === preset.id ? 'default' : 'outline'}
              className="text-micro cursor-pointer"
              onClick={() => applyPreset(preset)}
            >
              {preset.name}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2">
        {/* Text Preview */}
        <div className="p-3 bg-muted/30 rounded-lg border border-border/50 mb-3 min-h-[60px]">
          <p className="text-sm text-gray-300 line-clamp-3">
            {text || <span className="text-gray-500 italic">{t('ttsPreviewComp.nessunTestoDaRiprodurre')}</span>}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isPlaying ? (
              <Button
                onClick={handlePlay}
                disabled={!text || isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Riproduci
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={isPaused ? handleResume : handlePause}
                >
                  {isPaused ? (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Riprendi
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pausa
                    </>
                  )}
                </Button>
                <Button variant="destructive" onClick={handleStop}>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {useOpenAI ? `OpenAI: ${openAIVoice}` : selectedVoice}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {rate}x
            </Badge>
          </div>
        </div>

        {/* Playing indicator */}
        {isPlaying && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-green-500 rounded-full animate-pulse"
                  style={{
                    height: `${10 + Math.random() * 15}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-green-400">
              {isPaused ? 'In pausa' : 'Riproduzione in corso...'}
            </span>
          </div>
        )}

        {/* Info */}
        <div className="mt-3 p-2 bg-primary/10 rounded border border-primary/20 text-2xs text-muted-foreground">
          💡 {useOpenAI 
            ? 'OpenAI TTS offre voci di alta qualità (richiede API key)' 
            : 'Usa le voci del browser - gratis e offline'
          }
        </div>
      </CardContent>
    </Card>
  );
}
