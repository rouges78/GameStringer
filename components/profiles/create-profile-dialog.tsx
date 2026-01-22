'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  Eye, 
  EyeOff, 
  Upload,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Camera,
  Sparkles,
  Shield,
  Lock,
  X
} from 'lucide-react';
import { useProfiles } from '@/hooks/use-profiles';
import { CreateProfileRequest } from '@/types/profiles';
import { generateRecoveryKey, saveRecoveryKeyHash } from '@/lib/recovery-key';
import { RecoveryKeyDisplay } from '@/components/profiles/recovery-key-display';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { DialogTitle } from '@/components/ui/dialog';

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
  const [recoveryKey, setRecoveryKey] = useState<string[]>([]);
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);

  const { createProfile, authenticateProfile } = useProfiles();

  // Gestione upload immagine personalizzata
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Verifica tipo file
    if (!file.type.startsWith('image/')) {
      setError('Select a valid image file');
      return;
    }
    
    // Verifica dimensione (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB');
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
      return 'Profile name is required';
    }

    if (formData.name.length < 2) {
      return 'Name must be at least 2 characters';
    }

    if (formData.name.length > 50) {
      return 'Name cannot exceed 50 characters';
    }

    if (!formData.password) {
      return 'Password is required';
    }

    if (formData.password.length < 6) {
      return 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
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
      console.log('✅ Profile created successfully:', request.name);
      
      // Genera Recovery Key
      const newRecoveryKey = generateRecoveryKey();
      setRecoveryKey(newRecoveryKey);
      
      // Salva hash della recovery key (usa il nome come ID temporaneo)
      await saveRecoveryKeyHash(request.name, newRecoveryKey);
      
      // Mostra dialog recovery key
      setPendingProfileId(request.name);
      setShowRecoveryKey(true);
    } else {
      console.error('❌ Error during profile creation');
      setError('Error creating profile');
    }
    
    setIsCreating(false);
  };

  const handleRecoveryKeyConfirmed = () => {
    // Reset form
    setFormData({
      name: '',
      password: '',
      confirmPassword: '',
      avatarPath: '',
    });
    setSelectedAvatar(null);
    setCustomImage(null);
    setRecoveryKey([]);
    setShowRecoveryKey(false);
    
    // Chiudi il dialog
    onOpenChange(false);
    
    // Notifica il ProtectedRoute
    if (pendingProfileId) {
      onProfileCreated(pendingProfileId);
      setPendingProfileId(null);
    }
  };

  const handleClose = () => {
    if (!isCreating && !showRecoveryKey) {
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
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden bg-slate-950/95 backdrop-blur-xl border-slate-800/50 shadow-2xl">
        <VisuallyHidden><DialogTitle>Create New Profile</DialogTitle></VisuallyHidden>
        
        {/* Hero Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-600 p-3">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <button 
            onClick={handleClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </button>
          
          <div className="relative flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-lg">New Profile</h2>
              <p className="text-white/70 text-xs">Customize your experience</p>
            </div>
          </div>
        </motion.div>

        <motion.form 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          onSubmit={handleSubmit} 
          className="p-4 space-y-4">
          {/* Avatar Section */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-gradient-to-r from-blue-500/10 to-rose-500/10 border border-blue-500/20">
            <label className="cursor-pointer group relative shrink-0">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={isCreating}
              />
              <Avatar className="h-12 w-12 ring-2 ring-blue-500/50 shadow-md group-hover:ring-blue-400 transition-all">
                {customImage ? (
                  <AvatarImage src={customImage} alt="Avatar" />
                ) : null}
                <AvatarFallback className={`bg-gradient-to-br ${getAvatarGradient(formData.avatarPath)} text-white text-xl font-bold`}>
                  {formData.name ? getInitials(formData.name) : <Camera className="h-6 w-6" />}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="h-5 w-5 text-white" />
              </div>
            </label>
            
            <div className="flex-1">
              <p className="text-xs font-medium text-blue-300 mb-1.5">Choose a color</p>
              <div className="flex flex-wrap gap-1.5">
                {AVATAR_GRADIENTS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => handleAvatarSelect(avatar.id)}
                    className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatar.gradient} transition-all ${
                      selectedAvatar === avatar.id
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950 scale-110'
                        : 'hover:scale-110'
                    }`}
                    title={avatar.name}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Nome */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3 w-3" />
                Profile Name
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="What do you want to be called?"
                disabled={isCreating}
                maxLength={50}
                className="h-10 bg-slate-900/50 border-slate-700 focus:border-blue-500 focus:ring-blue-500/20 text-white placeholder:text-slate-500"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="h-3 w-3" />
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Minimum 6 characters"
                  disabled={isCreating}
                  className="h-10 pr-10 bg-slate-900/50 border-slate-700 focus:border-blue-500 focus:ring-blue-500/20 text-white placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Conferma Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle className="h-3 w-3" />
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="Repeat password"
                  disabled={isCreating}
                  className="h-10 pr-10 bg-slate-900/50 border-slate-700 focus:border-blue-500 focus:ring-blue-500/20 text-white placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30"
              >
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Security Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Shield className="h-5 w-5 text-emerald-400" />
            <div className="text-xs">
              <p className="font-medium text-emerald-300">AES-256 Protection</p>
              <p className="text-emerald-400/70">Your data is encrypted</p>
            </div>
          </motion.div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isCreating}
              className="flex-1 h-10 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
              className="flex-1 h-10 bg-gradient-to-r from-blue-600 to-rose-600 hover:from-blue-500 hover:to-rose-500 text-white border-0 shadow-lg shadow-blue-900/30"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create Profile
                </>
              )}
            </Button>
          </div>
        </motion.form>

        {/* Recovery Key Display Dialog */}
        <RecoveryKeyDisplay
          open={showRecoveryKey}
          onOpenChange={setShowRecoveryKey}
          recoveryKey={recoveryKey}
          profileName={formData.name || pendingProfileId || ''}
          onConfirm={handleRecoveryKeyConfirmed}
        />
      </DialogContent>
    </Dialog>
  );
}


