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

import { AVATAR_GRADIENTS, getAvatarGradient, getInitials } from '@/lib/avatar-utils';

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
  const [customImage, setCustomImage] = useState<string | null>(null);

  const { createProfile, authenticateProfile } = useProfiles();

  // Gestione upload immagine personalizzata
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Verifica tipo file
    if (!file.type.startsWith('image/')) {
      setError('Seleziona un file immagine valido');
      return;
    }
    
    // Verifica dimensione (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('L\'immagine deve essere inferiore a 2MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setCustomImage(base64);
      setSelectedAvatar(null); // Deseleziona i preset
      setFormData(prev => ({ ...prev, avatarPath: `custom:${base64}` }));
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleAvatarSelect = (gradientId: string) => {
    setSelectedAvatar(gradientId);
    setCustomImage(null); // Reset immagine custom quando si seleziona un preset
    setFormData(prev => ({ ...prev, avatarPath: gradientId }));
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
      console.log('✅ Profilo creato con successo:', request.name);
      
      // AUTENTICA AUTOMATICAMENTE IL NUOVO PROFILO
      console.log('🔐 Autenticando automaticamente il nuovo profilo...');
      const authSuccess = await authenticateProfile(request.name, request.password);
      
      if (authSuccess) {
        console.log('✅ Autenticazione automatica completata per:', request.name);
        
        // Reset form
        setFormData({
          name: '',
          password: '',
          confirmPassword: '',
          avatarPath: '',
        });
        setSelectedAvatar(null);
        
        // Chiudi il dialog
        onOpenChange(false);
        console.log('✅ Dialog chiuso, profilo autenticato e pronto');
        
        // Notifica il ProtectedRoute che tutto è completato
        onProfileCreated(request.name);
      } else {
        console.error('❌ Errore durante autenticazione automatica');
        setError('Profilo creato ma errore durante l\'autenticazione automatica');
      }
    } else {
      console.error('❌ Errore durante creazione profilo');
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
      setCustomImage(null);
      setError(null);
      onOpenChange(false);
    }
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
            
            {/* Current Avatar Preview - Cliccabile per upload */}
            <div className="flex justify-center">
              <label className="cursor-pointer group relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isCreating}
                />
                <Avatar className="h-20 w-20 border-2 border-border group-hover:border-primary transition-colors">
                  {customImage ? (
                    <AvatarImage src={customImage} alt="Avatar personalizzato" />
                  ) : null}
                  <AvatarFallback className={`bg-gradient-to-br ${getAvatarGradient(formData.avatarPath)} text-white text-lg font-semibold`}>
                    {formData.name ? getInitials(formData.name) : <Camera className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="h-6 w-6 text-white" />
                </div>
              </label>
            </div>
            <p className="text-xs text-center text-muted-foreground">Clicca per caricare un'immagine</p>

            {/* Avatar Presets */}
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_GRADIENTS.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => handleAvatarSelect(avatar.id)}
                  className={`relative rounded-full p-1 transition-all ${
                    selectedAvatar === avatar.id
                      ? 'ring-2 ring-primary bg-primary/10'
                      : 'hover:bg-muted'
                  }`}
                  title={avatar.name}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={`bg-gradient-to-br ${avatar.gradient} text-white text-sm font-semibold`}>
                      {formData.name ? getInitials(formData.name) : <User className="h-4 w-4" />}
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