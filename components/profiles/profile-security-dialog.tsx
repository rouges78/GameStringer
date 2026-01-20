'use client';

import { useState } from 'react';
import { useProfileAuth } from '@/lib/profile-auth';
import { useProfiles } from '@/hooks/use-profiles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Key, 
  Lock,
  Trash2,
  AlertTriangle,
  Eye,
  EyeOff,
  CheckCircle,
  ShieldCheck,
  Fingerprint
} from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';

interface ProfileSecurityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSecurityDialog({ open, onOpenChange }: ProfileSecurityDialogProps) {
  const { currentProfile, logout } = useProfileAuth();
  const { deleteProfile } = useProfiles();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showDeleteSection, setShowDeleteSection] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      await invoke('change_profile_password', {
        profileId: currentProfile?.id,
        currentPassword,
        newPassword
      });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error?.message || 'Error changing password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (deleteConfirmation !== currentProfile?.name) {
      toast.error('Name does not match');
      return;
    }

    if (!currentPassword) {
      toast.error('Enter password to confirm');
      return;
    }

    setIsDeletingProfile(true);
    try {
      const profileId = currentProfile!.id;
      const pwd = currentPassword;
      
      // Logout FIRST - backend doesn't allow deleting active profile
      await logout();
      
      // Use invoke directly - hook may not work after logout
      const response = await invoke<{ success: boolean; error?: string }>('delete_profile', {
        profileId,
        password: pwd
      });
      
      if (response.success) {
        toast.success('Profile deleted');
        onOpenChange(false);
      } else {
        toast.error(response.error || 'Incorrect password');
      }
    } catch (error: any) {
      console.error('Delete profile error:', error);
      toast.error(error?.message || 'Error during deletion');
    } finally {
      setIsDeletingProfile(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto p-0">
        {/* Accessibilità - DialogTitle nascosto */}
        <VisuallyHidden>
          <DialogTitle>Profile Security</DialogTitle>
        </VisuallyHidden>
        
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-t-lg border-b border-cyan-500/20 bg-gradient-to-r from-cyan-950/80 via-teal-950/60 to-emerald-950/80 p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/20 rounded-full blur-3xl" />
          
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-600 shadow-lg shadow-cyan-500/30">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                Profile Security
              </h2>
              <p className="text-sm text-cyan-200/60 mt-0.5">
                Protect {currentProfile?.name}
              </p>
            </div>
          </div>
          
          {/* Quick stats */}
          <div className="relative flex gap-4 mt-4 pt-3 border-t border-cyan-500/20">
            <div className="flex items-center gap-1.5 text-xs text-cyan-300/80">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>AES-256 Encryption</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-300/80">
              <Fingerprint className="h-3.5 w-3.5" />
              <span>Password protected</span>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Change Password */}
          <Card className="border-cyan-500/20 bg-cyan-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-cyan-300">
                <Key className="h-4 w-4" />
                Change Password
              </CardTitle>
              <CardDescription className="text-xs">
                Change your profile password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">Password attuale</Label>
                <div className="flex gap-2">
                  <Input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Nuova password</Label>
                <div className="flex gap-2">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Confirm new password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
                {newPassword && confirmPassword && (
                  <div className="flex items-center gap-1 text-xs">
                    {newPassword === confirmPassword ? (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-green-500">Le password coincidono</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                        <span className="text-red-500">Le password non coincidono</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <Button 
                onClick={handleChangePassword} 
                disabled={isChangingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                className="w-full"
              >
                <Key className="h-4 w-4 mr-2" />
                {isChangingPassword ? 'Changing...' : 'Change Password'}
              </Button>
            </CardContent>
          </Card>

          {/* Security Info */}
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-emerald-300">
                <Lock className="h-4 w-4" />
                Security Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-emerald-200/70">
              <p>• Profile data is encrypted with AES-256-GCM</p>
              <p>• Password is never stored in plain text</p>
              <p>• After 3 failed attempts the profile is locked for 15 minutes</p>
              <p>• Sessions expire automatically after the set timeout</p>
            </CardContent>
          </Card>

          {/* Delete Profile */}
          <Card className="border-red-500/30 bg-red-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-red-400">
                <Trash2 className="h-4 w-4" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!showDeleteSection ? (
                <Button 
                  variant="outline" 
                  className="w-full border-red-500/50 text-red-500 hover:bg-red-500/10"
                  onClick={() => setShowDeleteSection(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Profile
                </Button>
              ) : (
                <>
                  <Alert className="border-red-500/50 bg-red-950/20">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <AlertDescription className="text-xs text-red-400">
                      This action is irreversible. All profile data will be permanently deleted.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">
                      Type "{currentProfile?.name}" to confirm
                    </Label>
                    <Input
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder={currentProfile?.name}
                      className="border-red-500/30"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Password</Label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="border-red-500/30"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowDeleteSection(false);
                        setDeleteConfirmation('');
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={handleDeleteProfile}
                      disabled={isDeletingProfile || deleteConfirmation !== currentProfile?.name || !currentPassword}
                      className="flex-1"
                    >
                      {isDeletingProfile ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
