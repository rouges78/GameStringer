'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Camera, Upload, X, Check, User } from 'lucide-react';
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

  const displayAvatar = previewUrl || currentAvatar;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Cambia Avatar
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-6 py-4">
          {/* Preview */}
          <div className="relative">
            <Avatar className="h-32 w-32 ring-4 ring-primary/20">
              <AvatarImage src={displayAvatar} alt={userName} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-3xl font-bold">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
            
            {displayAvatar && (
              <button
                onClick={() => setPreviewUrl(null)}
                className="absolute -top-2 -right-2 p-1.5 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* Upload Button */}
          <div className="flex flex-col items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Carica Immagine
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              JPG, PNG o GIF • Max 5MB<br />
              L'immagine sarà ridimensionata a 256x256
            </p>
          </div>
          
          {/* Preset Avatars */}
          <div className="w-full">
            <p className="text-sm font-medium mb-3 text-center">Oppure scegli un preset:</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {['🎮', '🎯', '🎲', '🎪', '🎨', '🎭', '🎸', '🎹'].map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => {
                    // Create emoji avatar
                    const canvas = document.createElement('canvas');
                    canvas.width = 256;
                    canvas.height = 256;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      // Gradient background
                      const gradient = ctx.createLinearGradient(0, 0, 256, 256);
                      gradient.addColorStop(0, '#8B5CF6');
                      gradient.addColorStop(1, '#EC4899');
                      ctx.fillStyle = gradient;
                      ctx.fillRect(0, 0, 256, 256);
                      
                      // Emoji
                      ctx.font = '120px serif';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.fillText(emoji, 128, 138);
                      
                      setPreviewUrl(canvas.toDataURL('image/png'));
                    }
                  }}
                  className={cn(
                    "w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-2xl",
                    "hover:scale-110 transition-transform hover:ring-2 ring-white/50"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex gap-2">
          {currentAvatar && (
            <Button variant="destructive" onClick={handleRemoveAvatar} className="mr-auto">
              Rimuovi
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={!previewUrl || isLoading}>
            <Check className="h-4 w-4 mr-2" />
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
