'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { 
  User, 
  Eye, 
  EyeOff, 
  Upload,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Camera
} from 'lucide-react';
import { useProfiles } from '@/hooks/use-profiles';
import { CreateProfileRequest } from '@/types/profiles';

interface CreateProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileCreated: (profileId: string) => void;
}

const AVATAR_PRESETS = [
  { id: 'user-1', src: '/avatars/user-1.png', name: 'Avatar 1' },
  { id: 'user-2', src: '/avatars/user-2.png', name: 'Avatar 2' },
  { id: 'user-3', src: '/avatars/user-3.png', name: 'Avatar 3' },
  { id: 'user-4', src: '/avatars/user-4.png', name: 'Avatar 4' },
  { id: 'user-5', src: '/avatars/user-5.png', name: 'Avatar 5' },
  { id: 'user-6', src: '/avatars/user-6.png', name: 'Avatar 6' },
];

export function CreateProfileDialog({ open, onOpenChange, onProfileCreated }: CreateProfileDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: '',
    avatarPath: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);

  const { createProfile } = useProfiles();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleAvatarSelect = (avatarPath: string) => {
    setSelectedAvatar(avatarPath);
    setFormData(prev => ({ ...prev, avatarPath }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'Il nome del profilo è obbligatorio';
    }

    if (formData.name.length < 2) {
      return 'Il nome deve essere di almeno 2 caratteri';
    }

    if (formData.name.length > 50) {
      return 'Il nome non può superare i 50 caratteri';
    }

    if (!formData.password) {
      return 'La password è obbligatoria';
    }

    if (formData.password.length < 6) {
      return 'La password deve essere di almeno 6 caratteri';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Le password non coincidono';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsCreating(true);
    setError(null);

    const request: CreateProfileRequest = {
      name: formData.name.trim(),
      password: formData.password,
      avatar_path: formData.avatarPath || undefined,
    };

    const success = await createProfile(request);
    
    if (success) {
      // Reset form
      setFormData({
        name: '',
        password: '',
        confirmPassword: '',
        avatarPath: '',
      });
      setSelectedAvatar(null);
      onOpenChange(false);
      // Note: onProfileCreated will be called by the parent when currentProfile changes
    } else {
      setError('Errore durante la creazione del profilo');
    }
    
    setIsCreating(false);
  };

  const handleClose = () => {
    if (!isCreating) {
      setFormData({
        name: '',
        password: '',
        confirmPassword: '',
        avatarPath: '',
      });
      setSelectedAvatar(null);
      setError(null);
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Crea Nuovo Profilo</span>
          </DialogTitle>
          <DialogDescription>
            Crea un nuovo profilo per personalizzare la tua esperienza GameStringer.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Avatar del Profilo</Label>
            
            {/* Current Avatar Preview */}
            <div className="flex justify-center">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={formData.avatarPath} alt="Avatar preview" />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-lg font-semibold">
                  {formData.name ? getInitials(formData.name) : <Camera className="h-8 w-8" />}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Avatar Presets */}
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_PRESETS.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => handleAvatarSelect(avatar.src)}
                  className={`relative rounded-full p-1 transition-all ${
                    selectedAvatar === avatar.src
                      ? 'ring-2 ring-primary bg-primary/10'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={avatar.src} alt={avatar.name} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </button>
              ))}
            </div>
          </div>

          {/* Profile Name */}
          <div className="space-y-2">
            <Label htmlFor="profile-name" className="text-sm font-medium">
              Nome Profilo *
            </Label>
            <Input
              id="profile-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Inserisci il nome del profilo"
              disabled={isCreating}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              {formData.name.length}/50 caratteri
            </p>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="profile-password" className="text-sm font-medium">
              Password *
            </Label>
            <div className="relative">
              <Input
                id="profile-password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Inserisci la password"
                className="pr-10"
                disabled={isCreating}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isCreating}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-sm font-medium">
              Conferma Password *
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                placeholder="Conferma la password"
                className="pr-10"
                disabled={isCreating}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isCreating}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Security Info */}
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4">
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Sicurezza del Profilo</p>
                  <ul className="text-xs space-y-1 text-blue-700 dark:text-blue-300">
                    <li>• I tuoi dati saranno crittografati con AES-256</li>
                    <li>• La password non viene mai salvata in chiaro</li>
                    <li>• Ogni profilo ha i propri settings isolati</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
              className="flex-1"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creazione...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Crea Profilo
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}