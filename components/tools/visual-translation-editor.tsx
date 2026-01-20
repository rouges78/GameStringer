'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Type,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Upload,
  Eye,
  EyeOff,
  Layers,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Copy,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Save,
  FolderOpen,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface TextOverlay {
  id: string;
  originalText: string;
  translatedText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  visible: boolean;
  locked: boolean;
}

interface ScreenshotProject {
  id: string;
  name: string;
  gameName: string;
  imagePath: string;
  imageData?: string;
  overlays: TextOverlay[];
  createdAt: string;
  updatedAt: string;
}

const defaultFonts = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Impact',
  'Comic Sans MS',
  'Courier New',
];

const gameStyleFonts = [
  { name: 'RPG Fantasy', family: 'Georgia, serif', style: 'italic' },
  { name: 'Sci-Fi', family: 'Arial, sans-serif', style: 'normal' },
  { name: 'Horror', family: 'Times New Roman, serif', style: 'normal' },
  { name: 'Retro Pixel', family: 'Courier New, monospace', style: 'normal' },
  { name: 'Modern UI', family: 'Helvetica, Arial, sans-serif', style: 'normal' },
];

export function VisualTranslationEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageData, setImageData] = useState<string>('');
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isAddingOverlay, setIsAddingOverlay] = useState(false);
  const [projectName, setProjectName] = useState('Nuovo Progetto');
  const [gameName, setGameName] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);

  const [newOverlayText, setNewOverlayText] = useState({
    original: '',
    translated: ''
  });

  useEffect(() => {
    renderCanvas();
  }, [image, overlays, zoom, showOriginal, selectedOverlay]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = zoom / 100;
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    overlays.forEach(overlay => {
      if (!overlay.visible) return;

      const x = overlay.x * scale;
      const y = overlay.y * scale;
      const width = overlay.width * scale;
      const height = overlay.height * scale;
      const fontSize = overlay.fontSize * scale;

      if (overlay.backgroundOpacity > 0) {
        ctx.fillStyle = overlay.backgroundColor;
        ctx.globalAlpha = overlay.backgroundOpacity;
        ctx.fillRect(x, y, width, height);
        ctx.globalAlpha = 1;
      }

      const text = showOriginal ? overlay.originalText : overlay.translatedText;
      ctx.font = `${overlay.fontStyle} ${overlay.fontWeight} ${fontSize}px ${overlay.fontFamily}`;
      ctx.fillStyle = overlay.color;
      ctx.textAlign = overlay.textAlign;
      ctx.textBaseline = 'top';

      const textX = overlay.textAlign === 'center' ? x + width / 2 :
                    overlay.textAlign === 'right' ? x + width : x;

      const lines = wrapText(ctx, text, width);
      const lineHeight = fontSize * 1.2;
      
      lines.forEach((line, index) => {
        ctx.fillText(line, textX, y + index * lineHeight + 4);
      });

      if (selectedOverlay === overlay.id) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
        ctx.setLineDash([]);

        const handleSize = 8;
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x + width - handleSize/2, y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x + width - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
      }
    });
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.length > 0 ? lines : [''];
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setImageData(event.target?.result as string);
        setOverlays([]);
        setSelectedOverlay(null);
        toast.success('Screenshot loaded');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !image) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scale = zoom / 100;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (isAddingOverlay) {
      const newOverlay: TextOverlay = {
        id: `overlay_${Date.now()}`,
        originalText: newOverlayText.original || 'Original text',
        translatedText: newOverlayText.translated || 'Testo tradotto',
        x: Math.max(0, x - 100),
        y: Math.max(0, y - 20),
        width: 200,
        height: 40,
        fontSize: 16,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'left',
        color: '#ffffff',
        backgroundColor: '#000000',
        backgroundOpacity: 0.7,
        visible: true,
        locked: false
      };
      setOverlays([...overlays, newOverlay]);
      setSelectedOverlay(newOverlay.id);
      setIsAddingOverlay(false);
      setNewOverlayText({ original: '', translated: '' });
      toast.success('Overlay added');
      return;
    }

    const clickedOverlay = overlays.find(o => {
      return x >= o.x && x <= o.x + o.width &&
             y >= o.y && y <= o.y + o.height;
    });

    setSelectedOverlay(clickedOverlay?.id || null);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedOverlay || !canvasRef.current) return;
    
    const overlay = overlays.find(o => o.id === selectedOverlay);
    if (!overlay || overlay.locked) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scale = zoom / 100;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (x >= overlay.x && x <= overlay.x + overlay.width &&
        y >= overlay.y && y <= overlay.y + overlay.height) {
      setIsDragging(true);
      setDragStart({ x: x - overlay.x, y: y - overlay.y });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedOverlay || !canvasRef.current || !image) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scale = zoom / 100;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setOverlays(overlays.map(o => {
      if (o.id === selectedOverlay) {
        return {
          ...o,
          x: Math.max(0, Math.min(image.width - o.width, x - dragStart.x)),
          y: Math.max(0, Math.min(image.height - o.height, y - dragStart.y))
        };
      }
      return o;
    }));
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const updateSelectedOverlay = (updates: Partial<TextOverlay>) => {
    if (!selectedOverlay) return;
    setOverlays(overlays.map(o => 
      o.id === selectedOverlay ? { ...o, ...updates } : o
    ));
  };

  const deleteSelectedOverlay = () => {
    if (!selectedOverlay) return;
    setOverlays(overlays.filter(o => o.id !== selectedOverlay));
    setSelectedOverlay(null);
    toast.success('Overlay deleted');
  };

  const duplicateSelectedOverlay = () => {
    if (!selectedOverlay) return;
    const overlay = overlays.find(o => o.id === selectedOverlay);
    if (!overlay) return;

    const newOverlay: TextOverlay = {
      ...overlay,
      id: `overlay_${Date.now()}`,
      x: overlay.x + 20,
      y: overlay.y + 20
    };
    setOverlays([...overlays, newOverlay]);
    setSelectedOverlay(newOverlay.id);
    toast.success('Overlay duplicated');
  };

  const exportImage = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = `${projectName.replace(/\s+/g, '_')}_preview.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    toast.success('Image exported');
  };

  const exportProject = () => {
    const project: ScreenshotProject = {
      id: `project_${Date.now()}`,
      name: projectName,
      gameName,
      imagePath: '',
      imageData,
      overlays,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `${projectName.replace(/\s+/g, '_')}.gsvte`;
    link.href = URL.createObjectURL(blob);
    link.click();
    toast.success('Project exported');
  };

  const importProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const project: ScreenshotProject = JSON.parse(event.target?.result as string);
        setProjectName(project.name);
        setGameName(project.gameName);
        setOverlays(project.overlays);

        if (project.imageData) {
          const img = new Image();
          img.onload = () => {
            setImage(img);
            setImageData(project.imageData!);
          };
          img.src = project.imageData;
        }

        toast.success('Project imported');
      } catch {
        toast.error('Invalid project file');
      }
    };
    reader.readAsText(file);
  };

  const selectedOverlayData = overlays.find(o => o.id === selectedOverlay);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="h-7 w-7 text-pink-500" />
            Visual Translation Editor
          </h1>
          <p className="text-muted-foreground">
            Preview translations on game screenshots
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Load Screenshot
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <Button variant="outline" onClick={() => setShowExportDialog(true)} disabled={!image}>
            <Download className="h-4 w-4 mr-2" />
            Esporta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Canvas Area */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-48 h-8"
                    placeholder="Nome progetto"
                  />
                  <Input
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    className="w-36 h-8"
                    placeholder="Game name"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setZoom(Math.max(25, zoom - 25))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm w-12 text-center">{zoom}%</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setZoom(Math.min(200, zoom + 25))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={showOriginal}
                      onCheckedChange={setShowOriginal}
                    />
                    <Label className="text-sm">Originale</Label>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-auto bg-muted/30 rounded-lg min-h-[400px] max-h-[600px]">
                {image ? (
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    className={`cursor-${isAddingOverlay ? 'crosshair' : isDragging ? 'grabbing' : 'default'}`}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                    <ImageIcon className="h-16 w-16 mb-4" />
                    <p className="text-lg font-medium">Upload a screenshot</p>
                    <p className="text-sm">Supports PNG, JPG, WebP</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Browse
                    </Button>
                  </div>
                )}
              </div>

              {/* Toolbar */}
              {image && (
                <div className="flex items-center gap-2 mt-4 p-2 bg-muted/50 rounded-lg">
                  <Button
                    variant={isAddingOverlay ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIsAddingOverlay(!isAddingOverlay)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Text
                  </Button>
                  {selectedOverlay && (
                    <>
                      <Separator orientation="vertical" className="h-6" />
                      <Button variant="outline" size="sm" onClick={duplicateSelectedOverlay}>
                        <Copy className="h-4 w-4 mr-1" />
                        Duplicate
                      </Button>
                      <Button variant="outline" size="sm" onClick={deleteSelectedOverlay}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </>
                  )}
                  <div className="flex-1" />
                  <Badge variant="outline">
                    {overlays.length} overlay{overlays.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Properties Panel */}
        <div className="space-y-4">
          {/* Overlays List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Overlay ({overlays.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[150px]">
                {overlays.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No overlays
                  </p>
                ) : (
                  <div className="space-y-1">
                    {overlays.map((overlay, index) => (
                      <div
                        key={overlay.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          selectedOverlay === overlay.id
                            ? 'bg-primary/20 border border-primary/30'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => setSelectedOverlay(overlay.id)}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateSelectedOverlay({ visible: !overlay.visible });
                          }}
                        >
                          {overlay.visible ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                        </Button>
                        <span className="text-sm flex-1 truncate">
                          {overlay.translatedText.substring(0, 20)}...
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Selected Overlay Properties */}
          {selectedOverlayData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Edit3 className="h-4 w-4" />
                  Proprietà
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Testo Originale</Label>
                  <Textarea
                    value={selectedOverlayData.originalText}
                    onChange={(e) => updateSelectedOverlay({ originalText: e.target.value })}
                    rows={2}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Traduzione</Label>
                  <Textarea
                    value={selectedOverlayData.translatedText}
                    onChange={(e) => updateSelectedOverlay({ translatedText: e.target.value })}
                    rows={2}
                    className="text-xs"
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Font Size</Label>
                    <Input
                      type="number"
                      value={selectedOverlayData.fontSize}
                      onChange={(e) => updateSelectedOverlay({ fontSize: parseInt(e.target.value) || 16 })}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Font</Label>
                    <Select
                      value={selectedOverlayData.fontFamily}
                      onValueChange={(v) => updateSelectedOverlay({ fontFamily: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {defaultFonts.map(font => (
                          <SelectItem key={font} value={font} className="text-xs">{font}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant={selectedOverlayData.fontWeight === 'bold' ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateSelectedOverlay({ 
                      fontWeight: selectedOverlayData.fontWeight === 'bold' ? 'normal' : 'bold' 
                    })}
                  >
                    <Bold className="h-3 w-3" />
                  </Button>
                  <Button
                    variant={selectedOverlayData.fontStyle === 'italic' ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateSelectedOverlay({ 
                      fontStyle: selectedOverlayData.fontStyle === 'italic' ? 'normal' : 'italic' 
                    })}
                  >
                    <Italic className="h-3 w-3" />
                  </Button>
                  <Separator orientation="vertical" className="h-6 mx-1" />
                  <Button
                    variant={selectedOverlayData.textAlign === 'left' ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateSelectedOverlay({ textAlign: 'left' })}
                  >
                    <AlignLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    variant={selectedOverlayData.textAlign === 'center' ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateSelectedOverlay({ textAlign: 'center' })}
                  >
                    <AlignCenter className="h-3 w-3" />
                  </Button>
                  <Button
                    variant={selectedOverlayData.textAlign === 'right' ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateSelectedOverlay({ textAlign: 'right' })}
                  >
                    <AlignRight className="h-3 w-3" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Colore Testo</Label>
                    <div className="flex gap-1">
                      <input
                        type="color"
                        value={selectedOverlayData.color}
                        onChange={(e) => updateSelectedOverlay({ color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer"
                      />
                      <Input
                        value={selectedOverlayData.color}
                        onChange={(e) => updateSelectedOverlay({ color: e.target.value })}
                        className="h-8 text-xs flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sfondo</Label>
                    <div className="flex gap-1">
                      <input
                        type="color"
                        value={selectedOverlayData.backgroundColor}
                        onChange={(e) => updateSelectedOverlay({ backgroundColor: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer"
                      />
                      <Input
                        value={selectedOverlayData.backgroundColor}
                        onChange={(e) => updateSelectedOverlay({ backgroundColor: e.target.value })}
                        className="h-8 text-xs flex-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Opacità Sfondo: {Math.round(selectedOverlayData.backgroundOpacity * 100)}%</Label>
                  <Slider
                    value={[selectedOverlayData.backgroundOpacity * 100]}
                    onValueChange={([v]) => updateSelectedOverlay({ backgroundOpacity: v / 100 })}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Larghezza</Label>
                    <Input
                      type="number"
                      value={selectedOverlayData.width}
                      onChange={(e) => updateSelectedOverlay({ width: parseInt(e.target.value) || 100 })}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Altezza</Label>
                    <Input
                      type="number"
                      value={selectedOverlayData.height}
                      onChange={(e) => updateSelectedOverlay({ height: parseInt(e.target.value) || 40 })}
                      className="h-8"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Styles */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Stili Rapidi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {gameStyleFonts.map(style => (
                  <Button
                    key={style.name}
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => {
                      if (selectedOverlay) {
                        updateSelectedOverlay({
                          fontFamily: style.family,
                          fontStyle: style.style as 'normal' | 'italic'
                        });
                      }
                    }}
                    disabled={!selectedOverlay}
                  >
                    {style.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Project</DialogTitle>
            <DialogDescription>
              Choose how to export your work
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button className="w-full" onClick={exportImage}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Export as Image (PNG)
            </Button>
            <Button variant="outline" className="w-full" onClick={exportProject}>
              <Save className="h-4 w-4 mr-2" />
              Save Project (.gsvte)
            </Button>
            <Separator />
            <div>
              <Label className="text-sm">Import Project</Label>
              <input
                type="file"
                accept=".gsvte"
                onChange={importProject}
                className="mt-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default VisualTranslationEditor;
