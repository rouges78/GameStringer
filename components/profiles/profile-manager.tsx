'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Settings, Camera, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invoke } from '@tauri-apps/api/core';
import { useProfiles } from '@/hooks/use-profiles';
import { useToast } from '@/hooks/use-toast';

interface ProfileManagerProps {
  onClose?: () => void;
}

export function ProfileManager({ onClose }: ProfileManagerProps) {
  const { currentProfile, updateProfileAvatar, getProfileAvatar } = useProfiles();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  // Carica avatar corrente
  useEffect(() => {
    const loadAvatar = async () => {
      if (currentProfile?.avatar_path) {
        if (currentProfile.avatar_path.startsWith('gradient-')) {
          setAvatarSrc(null);
          return;
        }
        if (currentProfile.avatar_path.startsWith('data:image/')) {
          setAvatarSrc(currentProfile.avatar_path);
          return;
        }
        if (currentProfile.avatar_path.length > 100 && !currentProfile.avatar_path.includes('/')) {
          setAvatarSrc(`data:image/png;base64,${currentProfile.avatar_path}`);
          return;
        }
        if (currentProfile.id) {
          const src = await getProfileAvatar(currentProfile.id);
          if (src) {
            setAvatarSrc(src);
            return;
          }
        }
      }
      setAvatarSrc(null);
    };
    loadAvatar();
  }, [currentProfile?.id, currentProfile?.avatar_path, getProfileAvatar]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProfile) return;

    // Verify file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Select a valid image file (PNG, JPG, GIF)',
        variant: 'destructive',
      });
      return;
    }

    // Verify size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        
        // Update avatar in backend
        const success = await updateProfileAvatar(currentProfile.id, base64Data);
        
        if (success) {
          setAvatarSrc(base64Data);
          toast({
            title: 'Avatar updated',
            description: 'Your avatar has been saved successfully',
          });
        } else {
          toast({
            title: 'Error',
            description: 'Cannot save avatar',
            variant: 'destructive',
          });
        }
        setIsUploading(false);
      };
      reader.onerror = () => {
        toast({
          title: 'Error',
          description: 'Cannot read file',
          variant: 'destructive',
        });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({
        title: 'Error',
        description: 'An error occurred during upload',
        variant: 'destructive',
      });
      setIsUploading(false);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profilo Corrente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {/* Avatar cliccabile */}
              <div 
                className="relative cursor-pointer group"
                onClick={handleAvatarClick}
              >
                <Avatar className="h-16 w-16 ring-2 ring-primary/20 transition-all group-hover:ring-primary/50">
                  <AvatarImage src={avatarSrc || undefined} alt={currentProfile?.name} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-semibold">
                    {currentProfile?.name ? getInitials(currentProfile.name) : <User className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>
                {/* Overlay con icona camera */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
                {/* Input file nascosto */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{currentProfile?.name || 'No profile'}</h3>
                <p className="text-sm text-muted-foreground">Active profile</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click on avatar to change it
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {onClose && (
        <div className="flex justify-end">
          <Button onClick={onClose}>Chiudi</Button>
        </div>
      )}
    </div>
  );
}



