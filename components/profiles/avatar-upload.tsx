'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Camera, Upload, X, Check, User, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AvatarUploadProps {
  currentAvatar?: string;
  userName: string;
  onAvatarChange: (avatarDataUrl: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AvatarUpload({ currentAvatar, userName, onAvatarChange, open, onOpenChange }: AvatarUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File non valido', { description: 'Seleziona un\'immagine (JPG, PNG, GIF)' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File troppo grande', { description: 'Massimo 5MB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      
      // Resize image to max 256x256
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 256;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPreviewUrl(resizedDataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!previewUrl) return;
    
    setIsLoading(true);
    try {
      // Save to localStorage for persistence
      localStorage.setItem(`avatar_${userName}`, previewUrl);
      onAvatarChange(previewUrl);
      toast.success('Avatar updated!');
      onOpenChange(false);
      setPreviewUrl(null);
    } catch (error) {
      toast.error('Error saving');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAvatar = () => {
    localStorage.removeItem(`avatar_${userName}`);
    onAvatarChange('');
    toast.success('Avatar removed');
    onOpenChange(false);
    setPreviewUrl(null);
  };

  const displayAvatar = previewUrl || currentAvatar || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm border-slate-800 bg-slate-950/95 backdrop-blur-xl p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 text-sm text-slate-100">
            <Camera className="h-3.5 w-3.5 text-indigo-400" />
            Cambia Avatar
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-3 py-2">
          {/* Preview */}
          <div className="relative">
            <div className="p-0.5 rounded-full bg-gradient-to-br from-indigo-500/40 via-cyan-500/30 to-blue-500/40">
              <Avatar className="h-20 w-20 ring-2 ring-slate-950">
                <AvatarImage src={displayAvatar || undefined} alt={userName} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white text-2xl font-bold">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
            </div>
            
            {displayAvatar && (
              <button
                onClick={() => setPreviewUrl(null)}
                className="absolute -top-1 -right-1 p-1 bg-red-500/90 rounded-full text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          
          {/* Upload Button */}
          <div className="flex flex-col items-center gap-1.5 w-full">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 h-8 text-xs border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:border-indigo-500/50 text-slate-200 transition-all"
            >
              <ImagePlus className="h-3.5 w-3.5 text-indigo-400" />
              Carica Immagine
            </Button>
            
            <p className="text-[10px] text-slate-500 text-center">
              JPG, PNG o GIF • Max 5MB
            </p>
          </div>
          
          {/* Preset Avatars */}
          <div className="w-full">
            <p className="text-[10px] font-medium mb-2 text-center text-slate-500 uppercase tracking-wider">Preset</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {[
                { emoji: '🎮', from: '#3730a3', to: '#1e40af' },
                { emoji: '🎯', from: '#164e63', to: '#155e75' },
                { emoji: '🎲', from: '#1e3a5f', to: '#1e40af' },
                { emoji: '�', from: '#312e81', to: '#4338ca' },
                { emoji: '🎨', from: '#134e4a', to: '#0f766e' },
                { emoji: '🎭', from: '#1e1b4b', to: '#3730a3' },
                { emoji: '🎸', from: '#0c4a6e', to: '#0369a1' },
                { emoji: '🎹', from: '#1a1a2e', to: '#16213e' },
              ].map((preset, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 256;
                    canvas.height = 256;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      const gradient = ctx.createLinearGradient(0, 0, 256, 256);
                      gradient.addColorStop(0, preset.from);
                      gradient.addColorStop(1, preset.to);
                      ctx.fillStyle = gradient;
                      ctx.fillRect(0, 0, 256, 256);
                      ctx.font = '120px serif';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.fillText(preset.emoji, 128, 138);
                      setPreviewUrl(canvas.toDataURL('image/png'));
                    }
                  }}
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-base",
                    "bg-slate-800/80 border border-slate-700/50",
                    "hover:scale-110 hover:border-indigo-500/50",
                    "transition-all duration-200"
                  )}
                >
                  {preset.emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex gap-1.5 border-t border-slate-800/50 pt-3 mt-1">
          {currentAvatar && (
            <Button variant="ghost" size="sm" onClick={handleRemoveAvatar} className="mr-auto text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-xs">
              Rimuovi
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-300 h-8 text-xs">
            Annulla
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!previewUrl || isLoading} className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white border-0 h-8 text-xs">
            <Check className="h-3.5 w-3.5 mr-1" />
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



