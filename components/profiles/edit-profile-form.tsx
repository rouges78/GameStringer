'use client';

import { useState, useEffect } from 'react';
import { useProfiles } from '@/hooks/use-profiles';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { useValidation } from '@/hooks/use-validation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { PasswordValidator } from './password-validator';
import { ProfileNameValidator } from './profile-name-validator';
import { InputValidator } from './input-validator';
import { Save, Loader2, Shield } from 'lucide-react';

export function EditProfileForm() {
  const { currentProfile, updateProfile } = useProfiles();
  const { settings, updateSettings } = useProfileSettings();
  const { sanitizeInput } = useValidation();
  
  const [isLoading, setIsLoading] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [isNameValid, setIsNameValid] = useState(true); // Assume current name is valid
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Initialize form with current profile data
  useEffect(() => {
    if (currentProfile) {
      setProfileName(currentProfile.name);
    }
  }, [currentProfile]);
  
  const handleUpdateProfile = async () => {
    if (!currentProfile) return;
    
    if (!isNameValid) {
      toast.error('Il nome del profilo non è valido');
      return;
    }
    
    setIsLoading(true);
    try {
      // Sanitize input to prevent XSS
      const sanitizedName = await sanitizeInput(profileName);
      
      // Only update if name has changed
      if (sanitizedName !== currentProfile.name) {
        await updateProfile({
          id: currentProfile.id,
          name: sanitizedName
        });
        toast.success('Profilo aggiornato con successo');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Errore durante l\'aggiornamento del profilo');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleChangePassword = async () => {
    if (!currentProfile) return;
    
    if (!currentPassword) {
      toast.error('Inserisci la password attuale');
      return;
    }
    
    if (!isPasswordValid) {
      toast.error('La nuova password non è valida');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Le password non corrispondono');
      return;
    }
    
    setIsChangingPassword(true);
    try {
      // This would call the backend API to change password
      // For now, it's a placeholder
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Password aggiornata con successo');
      
      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsPasswordValid(false);
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Errore durante il cambio password');
    } finally {
      setIsChangingPassword(false);
    }
  };
  
  const handleUpdateSettings = async (key: string, value: any) => {
    if (!settings) return;
    
    try {
      const updatedSettings = { ...settings };
      
      // Update nested settings
      if (key.includes('.')) {
        const [section, field] = key.split('.');
        updatedSettings[section] = {
          ...updatedSettings[section],
          [field]: value
        };
      } else {
        updatedSettings[key] = value;
      }
      
      await updateSettings(updatedSettings);
      toast.success('Impostazioni aggiornate');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Errore durante l\'aggiornamento delle impostazioni');
    }
  };
  
  if (!currentProfile || !settings) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Informazioni Profilo
          </CardTitle>
          <CardDescription>
            Modifica le informazioni del tuo profilo con validazione sicura
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileNameValidator
            value={profileName}
            onChange={setProfileName}
            onValidationChange={setIsNameValid}
          />
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleUpdateProfile} 
            disabled={isLoading || !isNameValid || profileName === currentProfile.name}
            className="flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salva Modifiche
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            Cambio Password
          </CardTitle>
          <CardDescription>
            Aggiorna la password del tuo profilo con validazione avanzata
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InputValidator
            value={currentPassword}
            onChange={setCurrentPassword}
            label="Password Attuale"
            placeholder="Inserisci la password attuale"
            type="password"
            autoComplete="current-password"
            required={true}
            showSecurityIndicator={false}
          />
          
          <Separator />
          
          <PasswordValidator
            value={newPassword}
            onChange={setNewPassword}
            onValidationChange={setIsPasswordValid}
            label="Nuova Password"
            placeholder="Inserisci la nuova password"
            autoComplete="new-password"
          />
          
          <InputValidator
            value={confirmPassword}
            onChange={setConfirmPassword}
            label="Conferma Nuova Password"
            placeholder="Conferma la nuova password"
            type="password"
            autoComplete="new-password"
            required={true}
            showSecurityIndicator={false}
            customValidator={async (value) => ({
              isValid: value === newPassword,
              message: value === newPassword ? 'Password corrispondenti' : 'Le password non corrispondono'
            })}
          />
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleChangePassword} 
            disabled={isChangingPassword || !currentPassword || !isPasswordValid || newPassword !== confirmPassword}
            className="flex items-center gap-2"
          >
            {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Cambia Password
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Preferenze</CardTitle>
          <CardDescription>
            Personalizza le impostazioni del tuo profilo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Tema</h3>
            <Select
              value={settings.theme}
              onValueChange={(value) => handleUpdateSettings('theme', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Chiaro</SelectItem>
                <SelectItem value="dark">Scuro</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Lingua</h3>
            <Select
              value={settings.language}
              onValueChange={(value) => handleUpdateSettings('language', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona lingua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="it">Italiano</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoLogin">Login Automatico</Label>
              <p className="text-xs text-muted-foreground">Accedi automaticamente all'avvio</p>
            </div>
            <Switch
              id="autoLogin"
              checked={settings.auto_login}
              onCheckedChange={(checked) => handleUpdateSettings('auto_login', checked)}
            />
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Notifiche</h3>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="desktopNotifications">Notifiche Desktop</Label>
              <Switch
                id="desktopNotifications"
                checked={settings.notifications.desktop_enabled}
                onCheckedChange={(checked) => handleUpdateSettings('notifications.desktop_enabled', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="soundNotifications">Suoni Notifiche</Label>
              <Switch
                id="soundNotifications"
                checked={settings.notifications.sound_enabled}
                onCheckedChange={(checked) => handleUpdateSettings('notifications.sound_enabled', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}