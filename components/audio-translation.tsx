'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX, 
  Languages, 
  Download, 
  Upload,
  Headphones,
  Waveform,
  Settings,
  Trash2,
  Copy,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface AudioTranscription {
  id: string;
  text: string;
  confidence: number;
  language: string;
  timestamp: Date;
  duration: number;
  audioUrl: string;
  segments: TranscriptionSegment[];
}

interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  confidence: number;
  speaker?: string;
}

interface AudioTranslation {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  timestamp: Date;
  audioUrl?: string; // Translated audio URL (TTS)
}

interface AudioSettings {
  inputDevice: string;
  outputDevice: string;
  sampleRate: number;
  bitRate: number;
  noiseReduction: boolean;
  autoGainControl: boolean;
  echoCancellation: boolean;
  realTimeTranscription: boolean;
  autoTranslation: boolean;
  targetLanguage: string;
  voiceSpeed: number;
  voicePitch: number;
  enableTTS: boolean;
}

interface AudioTranslationProps {
  onTranscriptionComplete: (transcription: AudioTranscription) => void;
  onTranslationComplete: (translation: AudioTranslation) => void;
  className?: string;
}

const supportedLanguages = [
  { code: 'en', name: 'Inglese', flag: '🇺🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'es', name: 'Spagnolo', flag: '🇪🇸' },
  { code: 'fr', name: 'Francese', flag: '🇫🇷' },
  { code: 'de', name: 'Tedesco', flag: '🇩🇪' },
  { code: 'ja', name: 'Giapponese', flag: '🇯🇵' },
  { code: 'ko', name: 'Coreano', flag: '🇰🇷' },
  { code: 'zh', name: 'Cinese', flag: '🇨🇳' },
  { code: 'ru', name: 'Russo', flag: '🇷🇺' },
  { code: 'pt', name: 'Portoghese', flag: '🇵🇹' },
];

const AudioTranslation: React.FC<AudioTranslationProps> = ({
  onTranscriptionComplete,
  onTranslationComplete,
  className
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [transcriptions, setTranscriptions] = useState<AudioTranscription[]>([]);
  const [translations, setTranslations] = useState<AudioTranslation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [settings, setSettings] = useState<AudioSettings>({
    inputDevice: 'default',
    outputDevice: 'default',
    sampleRate: 44100,
    bitRate: 128,
    noiseReduction: true,
    autoGainControl: true,
    echoCancellation: true,
    realTimeTranscription: false,
    autoTranslation: true,
    targetLanguage: 'it',
    voiceSpeed: 1.0,
    voicePitch: 1.0,
    enableTTS: true
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inizializza dispositivi audio
  useEffect(() => {
    const getAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioDevices(devices.filter(device => 
          device.kind === 'audioinput' || device.kind === 'audiooutput'
        ));
      } catch (error) {
        console.error('Error retrieving audio devices:', error);
      }
    };

    getAudioDevices();
  }, []);

  // Simula trascrizione audio
  const simulateTranscription = async (audioBlob: Blob): Promise<AudioTranscription> => {
    // Simula progresso
    for (let i = 0; i <= 100; i += 10) {
      setProgress(i);
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    const audioUrl = URL.createObjectURL(audioBlob);
    
    const mockTranscription: AudioTranscription = {
      id: `transcription-${Date.now()}`,
      text: `Questo è un esempio di trascrizione audio. Il personaggio dice: "Benvenuto nel mondo di GameStringer! Qui puoi trovare tesori nascosti e completare missioni epiche. Premi il tasto E per interagire con gli oggetti."`,
      confidence: 87.5,
      language: 'it',
      timestamp: new Date(),
      duration: 15.3,
      audioUrl,
      segments: [
        { start: 0, end: 3.2, text: 'Questo è un esempio di trascrizione audio.', confidence: 90 },
        { start: 3.2, end: 8.5, text: 'Il personaggio dice: "Benvenuto nel mondo di GameStringer!"', confidence: 85 },
        { start: 8.5, end: 12.8, text: 'Qui puoi trovare tesori nascosti e completare missioni epiche.', confidence: 88 },
        { start: 12.8, end: 15.3, text: 'Premi il tasto E per interagire con gli oggetti.', confidence: 82 }
      ]
    };

    return mockTranscription;
  };

  // Simulate translation
  const simulateTranslation = async (text: string, targetLang: string): Promise<AudioTranslation> => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const translations: Record<string, string> = {
      'en': 'This is an example of audio transcription. The character says: "Welcome to the world of GameStringer! Here you can find hidden treasures and complete epic missions. Press the E key to interact with objects."',
      'es': 'Este es un ejemplo de transcripción de audio. El personaje dice: "¡Bienvenido al mundo de GameStringer! Aquí puedes encontrar tesoros ocultos y completar misiones épicas. Presiona la tecla E para interactuar con objetos."',
      'fr': 'Ceci est un exemple de transcription audio. Le personnage dit : "Bienvenue dans le monde de GameStringer ! Ici, vous pouvez trouver des trésors cachés et accomplir des missions épiques. Appuyez sur la touche E pour interagir avec les objets."'
    };

    const mockTranslation: AudioTranslation = {
      id: `translation-${Date.now()}`,
      originalText: text,
      translatedText: translations[targetLang] || translations['en'],
      sourceLanguage: 'it',
      targetLanguage: targetLang,
      confidence: 92.3,
      timestamp: new Date(),
      audioUrl: settings.enableTTS ? 'mock-tts-url' : undefined
    };

    return mockTranslation;
  };

  // Start recording
  const startRecording = async () => {
    try {
      const constraints = {
        audio: {
          deviceId: settings.inputDevice !== 'default' ? { exact: settings.inputDevice } : undefined,
          sampleRate: settings.sampleRate,
          noiseSuppression: settings.noiseReduction,
          autoGainControl: settings.autoGainControl,
          echoCancellation: settings.echoCancellation
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Cannot start recording');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      toast.success('Recording completed');
    }
  };

  // Processa audio
  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setProgress(0);

    try {
      // Transcription
      const transcription = await simulateTranscription(audioBlob);
      setTranscriptions(prev => [transcription, ...prev]);
      onTranscriptionComplete(transcription);

      // Auto translation if enabled
      if (settings.autoTranslation) {
        const translation = await simulateTranslation(transcription.text, settings.targetLanguage);
        setTranslations(prev => [translation, ...prev]);
        onTranslationComplete(translation);
      }

      toast.success('Audio processed successfully');
    } catch (error) {
      console.error('Audio processing error:', error);
      toast.error('Audio processing error');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  // Handle upload file
  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('audio/')) {
      toast.error('Seleziona un file audio valido');
      return;
    }

    processAudio(file);
  };

  // Translate text
  const translateText = async (transcriptionId: string, targetLang: string) => {
    const transcription = transcriptions.find(t => t.id === transcriptionId);
    if (!transcription) return;

    setIsProcessing(true);
    try {
      const translation = await simulateTranslation(transcription.text, targetLang);
      setTranslations(prev => [translation, ...prev]);
      onTranslationComplete(translation);
      toast.success('Translation completed');
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('Translation error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Play audio
  const playAudio = (audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Copy text
  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Text copied to clipboard');
  };

  // Download audio
  const downloadAudio = (audioUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = filename;
    a.click();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Audio Translation</h2>
          <p className="text-muted-foreground">
            Transcribe and translate game audio and dialogues
          </p>
        </div>
        
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Audio Settings</DialogTitle>
              <DialogDescription>
                Configure recording and translation options
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="recording" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="recording">Recording</TabsTrigger>
                <TabsTrigger value="translation">Translation</TabsTrigger>
                <TabsTrigger value="voice">Voice</TabsTrigger>
              </TabsList>

              <TabsContent value="recording" className="space-y-4">
                <div className="space-y-2">
                  <Label>Input Device</Label>
                  <Select 
                    value={settings.inputDevice} 
                    onValueChange={(value) => setSettings(prev => ({ ...prev, inputDevice: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      {audioDevices.filter(d => d.kind === 'audioinput').map(device => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microfono ${device.deviceId.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sample Rate</Label>
                  <Select 
                    value={settings.sampleRate.toString()} 
                    onValueChange={(value) => setSettings(prev => ({ ...prev, sampleRate: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="22050">22.05 kHz</SelectItem>
                      <SelectItem value="44100">44.1 kHz</SelectItem>
                      <SelectItem value="48000">48 kHz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Riduzione Rumore</Label>
                    <Switch
                      checked={settings.noiseReduction}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, noiseReduction: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Controllo Automatico Guadagno</Label>
                    <Switch
                      checked={settings.autoGainControl}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoGainControl: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Cancellazione Eco</Label>
                    <Switch
                      checked={settings.echoCancellation}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, echoCancellation: checked }))}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="translation" className="space-y-4">
                <div className="space-y-2">
                  <Label>Lingua Target</Label>
                  <Select 
                    value={settings.targetLanguage} 
                    onValueChange={(value) => setSettings(prev => ({ ...prev, targetLanguage: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedLanguages.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Real-time Transcription</Label>
                    <Switch
                      checked={settings.realTimeTranscription}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, realTimeTranscription: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Auto Translation</Label>
                    <Switch
                      checked={settings.autoTranslation}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoTranslation: checked }))}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="voice" className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Abilita Text-to-Speech</Label>
                  <Switch
                    checked={settings.enableTTS}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableTTS: checked }))}
                  />
                </div>

                {settings.enableTTS && (
                  <>
                    <div className="space-y-2">
                      <Label>Voice Speed: {settings.voiceSpeed.toFixed(1)}x</Label>
                      <Slider
                        value={[settings.voiceSpeed]}
                        onValueChange={([value]) => setSettings(prev => ({ ...prev, voiceSpeed: value }))}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Voice Pitch: {settings.voicePitch.toFixed(1)}</Label>
                      <Slider
                        value={[settings.voicePitch]}
                        onValueChange={([value]) => setSettings(prev => ({ ...prev, voicePitch: value }))}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                      />
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button onClick={() => setIsSettingsOpen(false)}>
                Save Settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Recording Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            Audio Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              variant={isRecording ? "destructive" : "default"}
              size="lg"
            >
              {isRecording ? (
                <>
                  <Square className="h-5 w-5 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5 mr-2" />
                  Start Recording
                </>
              )}
            </Button>

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              variant="outline"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Audio File
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Processing...</span>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Volume Controls */}
          <div className="flex items-center gap-4">
            <Volume2 className="h-4 w-4" />
            <Slider
              value={[volume]}
              onValueChange={([value]) => setVolume(value)}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground w-12">{volume}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Tabs defaultValue="transcriptions" className="w-full">
        <TabsList>
          <TabsTrigger value="transcriptions">
            Transcriptions ({transcriptions.length})
          </TabsTrigger>
          <TabsTrigger value="translations">
            Translations ({translations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transcriptions" className="space-y-4">
          {transcriptions.map((transcription) => (
            <Card key={transcription.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Trascrizione Audio</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {transcription.confidence.toFixed(1)}% confidenza
                    </Badge>
                    <Badge variant="outline">
                      {supportedLanguages.find(l => l.code === transcription.language)?.name}
                    </Badge>
                  </div>
                </div>
                <CardDescription>
                  {transcription.timestamp.toLocaleString()} • {transcription.duration.toFixed(1)}s
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <Textarea
                  value={transcription.text}
                  readOnly
                  className="min-h-[100px]"
                />

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => playAudio(transcription.audioUrl)}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(transcription.text)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>

                  <Select onValueChange={(lang) => translateText(transcription.id, lang)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Traduci in..." />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedLanguages.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="translations" className="space-y-4">
          {translations.map((translation) => (
            <Card key={translation.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Translation</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {translation.confidence.toFixed(1)}% confidence
                    </Badge>
                    <Badge variant="outline">
                      {supportedLanguages.find(l => l.code === translation.sourceLanguage)?.flag} →{' '}
                      {supportedLanguages.find(l => l.code === translation.targetLanguage)?.flag}
                    </Badge>
                  </div>
                </div>
                <CardDescription>
                  {translation.timestamp.toLocaleString()}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Original Text</Label>
                  <Textarea
                    value={translation.originalText}
                    readOnly
                    className="min-h-[80px] text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Translation</Label>
                  <Textarea
                    value={translation.translatedText}
                    readOnly
                    className="min-h-[80px] font-medium"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {translation.audioUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => playAudio(translation.audioUrl!)}
                    >
                      <Play className="h-4 w-4" />
                      Listen
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(translation.translatedText)}
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AudioTranslation;



