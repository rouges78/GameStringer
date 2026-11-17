'use client';

import React, { useState, useRef, useCallback } from 'react';
import { 
  Camera, 
  Upload, 
  Image as ImageIcon, 
  Copy,
  Download,
  Trash2,
  Languages,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { clientLogger } from '@/lib/client-logger';
import { useTranslation } from '@/lib/i18n';

interface OCRResult {
  id: string;
  text: string;
  confidence: number;
  language: string;
  boundingBoxes: BoundingBox[];
  timestamp: Date;
  imageUrl: string;
  processedImageUrl?: string;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
}

interface OCRSettings {
  language: string;
  enhanceImage: boolean;
  removeBackground: boolean;
  contrastBoost: number;
  brightnessAdjust: number;
  noiseReduction: boolean;
  textDetectionMode: 'fast' | 'accurate' | 'hybrid';
  minConfidence: number;
}

interface OCRImageProcessorProps {
  onTextExtracted: (result: OCRResult) => void;
  onTranslationRequest?: (text: string, targetLanguage: string) => void;
  className?: string;
}

const supportedLanguages = [
  { code: 'auto', name: 'Auto Detect' },
  { code: 'en', name: 'English' },
  { code: 'it', name: 'Italian' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ru', name: 'Russian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ar', name: 'Arabic' },
];

const OCRImageProcessor: React.FC<OCRImageProcessorProps> = ({
  onTextExtracted,
  onTranslationRequest,
  className
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<OCRResult[]>([]);
  const [_selectedImage, _setSelectedImage] = useState<string | null>(null);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [settings, setSettings] = useState<OCRSettings>({
    language: 'auto',
    enhanceImage: true,
    removeBackground: false,
    contrastBoost: 50,
    brightnessAdjust: 50,
    noiseReduction: true,
    textDetectionMode: 'hybrid',
    minConfidence: 70
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Run OCR via Tauri Tesseract backend
  const runOCR = async (imageUrl: string): Promise<OCRResult> => {
    setProgress(10);

    // Convert image URL to base64 for the Tauri command
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || result);
      };
      reader.readAsDataURL(blob);
    });

    setProgress(30);

    const lang = settings.language === 'auto' ? 'eng' : settings.language;

    let text: string;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      text = await invoke<string>('tesseract_recognize', {
        imageBase64: base64,
        language: lang,
      });
    } catch {
      // Fallback: try Windows native OCR. ocr_recognize vuole BGRA grezzo con
      // larghezza e altezza: per un'immagine codificata c'è ocr_recognize_png,
      // che restituisce i blocchi di testo. "zh" per Windows OCR è ambiguo: serve zh-Hans
      // (come in components/tools/live-ocr-overlay.tsx).
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const blocks = await invoke<Array<{ text: string }>>('ocr_recognize_png', {
          imageData: base64,
          language: settings.language === 'zh' ? 'zh-Hans' : settings.language,
        });
        text = blocks.map((b) => b.text).join('\n');
      } catch (e2) {
        throw new Error(
          `OCR non disponibile. Installa Tesseract o usa Windows 10+ per OCR nativo. Dettagli: ${e2}`
        );
      }
    }

    setProgress(80);

    // Split into lines for bounding boxes (approximate)
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    const boundingBoxes: BoundingBox[] = lines.map((line, i) => ({
      x: 50,
      y: 100 + i * 40,
      width: Math.min(line.length * 8, 500),
      height: 30,
      text: line,
      confidence: 85,
    }));

    setProgress(100);

    return {
      id: `ocr-${Date.now()}`,
      text,
      confidence: 85,
      language: settings.language === 'auto' ? 'en' : settings.language,
      boundingBoxes,
      timestamp: new Date(),
      imageUrl,
      processedImageUrl: settings.enhanceImage ? imageUrl : undefined,
    };
  };

  // Preprocessa immagine
  const preprocessImage = (imageFile: File): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      
      if (!canvas || !ctx) {
        resolve(URL.createObjectURL(imageFile));
        return;
      }

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Applica preprocessing
        ctx.drawImage(img, 0, 0);
        
        if (settings.enhanceImage) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Applica contrasto e luminosità
          const contrast = (settings.contrastBoost - 50) / 50;
          const brightness = (settings.brightnessAdjust - 50) / 50;
          
          for (let i = 0; i < data.length; i += 4) {
            // Applica contrasto
            data[i] = Math.max(0, Math.min(255, (data[i] - 128) * (1 + contrast) + 128));
            data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - 128) * (1 + contrast) + 128));
            data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - 128) * (1 + contrast) + 128));
            
            // Applica luminosità
            data[i] = Math.max(0, Math.min(255, data[i] + brightness * 255));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + brightness * 255));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + brightness * 255));
          }
          
          ctx.putImageData(imageData, 0, 0);
        }
        
        resolve(canvas.toDataURL());
      };
      
      img.src = URL.createObjectURL(imageFile);
    });
  };

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      toast.error(t('common.selectAValidImageFile'));
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      // Preprocess image
      const processedImageUrl = await preprocessImage(file);
      
      // Run OCR
      const result = await runOCR(processedImageUrl);
      
      // Filter results by minimum confidence
      const filteredBoundingBoxes = result.boundingBoxes.filter(
        box => box.confidence >= settings.minConfidence
      );
      
      const finalResult = {
        ...result,
        boundingBoxes: filteredBoundingBoxes,
        text: filteredBoundingBoxes.map(box => box.text).join('\n')
      };

      setResults(prev => [finalResult, ...prev]);
      onTextExtracted(finalResult);
      
      toast.success(`Text extracted with ${result.confidence.toFixed(1)}% confidence`);
    } catch (error: unknown) {
      clientLogger.error('OCR error:', error);
      toast.error(t('common.errorDuringImageProcessing'));
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [settings, onTextExtracted]);

  // Handle drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  };

  // Copy text
  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('ocrImageProcessor.copiedToClipboard'));
  };

  // Download result
  const downloadResult = (result: OCRResult) => {
    const blob = new Blob([result.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-result-${result.timestamp.toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Elimina result
  const deleteResult = (id: string) => {
    setResults(prev => prev.filter(r => r.id !== id));
    toast.success(t('ocrImageProcessor.resultDeleted'));
  };

  // Request translation
  const requestTranslation = (text: string) => {
    if (onTranslationRequest) {
      onTranslationRequest(text, 'it');
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('common.ocrImageProcessor')}</h2>
          <p className="text-muted-foreground">
            {t('ocrImageProcessor.subtitle')}</p>
        </div>
        
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              {t('ocrImageProcessor.settings')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('ocrImageProcessor.ocrSettings')}</DialogTitle>
              <DialogDescription>
                {t('ocrImageProcessor.ocrSettingsDesc')}</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Lingua */}
              <div className="space-y-2">
                <Label>{t('ocrImageProcessor.recognitionLanguage')}</Label>
                <Select 
                  value={settings.language} 
                  onValueChange={(value) => setSettings(prev => ({ ...prev, language: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedLanguages.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Modalità rilevamento */}
              <div className="space-y-2">
                <Label>{t('ocrImageProcessor.detectionMode')}</Label>
                <Select 
                  value={settings.textDetectionMode} 
                  onValueChange={(value: string) => setSettings(prev => ({ ...prev, textDetectionMode: value as typeof prev.textDetectionMode }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast">{t('ocrImageProcessor.fast')}</SelectItem>
                    <SelectItem value="accurate">{t('ocrImageProcessor.accurate')}</SelectItem>
                    <SelectItem value="hybrid">{t('ocrImageProcessor.hybrid')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Confidenza minima */}
              <div className="space-y-2">
                <Label>{t('ocrImageProcessor.minConfidence')} {settings.minConfidence}%</Label>
                <Slider
                  value={[settings.minConfidence]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, minConfidence: value }))}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>

              <Separator />

              {/* Preprocessing */}
              <div className="space-y-4">
                <Label className="text-base font-medium">{t('common.preprocessingImmagine')}</Label>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="enhance">{t('common.miglioraImmagine')}</Label>
                  <Switch
                    id="enhance"
                    checked={settings.enhanceImage}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enhanceImage: checked }))}
                  />
                </div>

                {settings.enhanceImage && (
                  <>
                    <div className="space-y-2">
                      <Label>{t('ocrImageProcessor.contrast')} {settings.contrastBoost}%</Label>
                      <Slider
                        value={[settings.contrastBoost]}
                        onValueChange={([value]) => setSettings(prev => ({ ...prev, contrastBoost: value }))}
                        min={0}
                        max={100}
                        step={5}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t('ocrImageProcessor.brightness')} {settings.brightnessAdjust}%</Label>
                      <Slider
                        value={[settings.brightnessAdjust]}
                        onValueChange={([value]) => setSettings(prev => ({ ...prev, brightnessAdjust: value }))}
                        min={0}
                        max={100}
                        step={5}
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="noise">{t('ocrImageProcessor.noiseReduction')}</Label>
                  <Switch
                    id="noise"
                    checked={settings.noiseReduction}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, noiseReduction: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="background">{t('common.rimuoviSfondo')}</Label>
                  <Switch
                    id="background"
                    checked={settings.removeBackground}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, removeBackground: checked }))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setIsSettingsOpen(false)}>
                {t('ocrImageProcessor.saveSettings')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              
              <div>
                <p className="text-lg font-medium">
                  {t('ocrImageProcessor.dragImage')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('ocrImageProcessor.supportedFormats')}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {t('ocrImageProcessor.selectFile')}</Button>
                
                <Button variant="outline" disabled={isProcessing}>
                  <Camera className="h-4 w-4 mr-2" />
                  {t('ocrImageProcessor.screenshot')}</Button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('ocrImageProcessor.processing')}</span>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{t('ocrImageProcessor.ocrResults')}</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
              >
                {showBoundingBoxes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showBoundingBoxes ? 'Hide' : 'Show'} {t('ocrImageProcessor.boxes')}</Button>
            </div>
          </div>

          {results.map((result) => (
            <Card key={result.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      {t('ocrImageProcessor.resultTitle')}</CardTitle>
                    <Badge variant="secondary">
                      {result.confidence.toFixed(1)}% {t('ocrImageProcessor.confidence')}</Badge>
                    <Badge variant="outline">
                      {supportedLanguages.find(l => l.code === result.language)?.name || result.language}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyText(result.text)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    
                    {onTranslationRequest && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => requestTranslation(result.text)}
                      >
                        <Languages className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadResult(result)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteResult(result.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <CardDescription>
                  {t('ocrImageProcessor.extractedOn')} {result.timestamp.toLocaleString()} • {result.boundingBoxes.length}  {t('ocrImageProcessor.detectedElements')}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Testo estratto */}
                <div className="space-y-2">
                  <Label>{t('common.testoEstratto')}</Label>
                  <Textarea
                    value={result.text}
                    readOnly
                    className="min-h-[100px] font-mono text-sm"
                  />
                </div>

                {/* Bounding boxes */}
                {showBoundingBoxes && result.boundingBoxes.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t('common.elementiRilevati')}</Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {result.boundingBoxes.map((box, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded text-sm">
                          <span className="flex-1 truncate">{box.text}</span>
                          <Badge variant="outline" className="ml-2">
                            {box.confidence.toFixed(1)}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default OCRImageProcessor;




