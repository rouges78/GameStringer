'use client';

import { useState, useEffect } from 'react';
import { useValidation, ValidationConfig, PasswordStrength } from '@/hooks/use-validation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Check, X, AlertCircle, RefreshCw, Copy, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { ProfileNameValidator } from './profile-name-validator';
import { PasswordValidator } from './password-validator';
import { InputValidator } from './input-validator';

export function ValidationDemo() {
  const { 
    isLoading, 
    validationConfig, 
    getValidationConfig, 
    updateValidationConfig,
    validatePassword,
    checkPasswordStrength,
    generatePasswordSuggestions
  } = useValidation();

  const [config, setConfig] = useState<ValidationConfig | null>(null);
  const [profileName, setProfileName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isNameValid, setIsNameValid] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [isTestInputValid, setIsTestInputValid] = useState(false);

  // Load validation config on mount
  useEffect(() => {
    getValidationConfig();
  }, [getValidationConfig]);

  // Update local config when remote config changes
  useEffect(() => {
    if (validationConfig) {
      setConfig(validationConfig);
    }
  }, [validationConfig]);

  // Check password strength when password changes
  useEffect(() => {
    const checkStrength = async () => {
      if (password) {
        const strength = await checkPasswordStrength(password);
        setPasswordStrength(strength);
        const validation = await validatePassword(password);
        setIsPasswordValid(validation.is_valid);
      } else {
        setPasswordStrength(null);
        setIsPasswordValid(false);
      }
    };
    checkStrength();
  }, [password, checkPasswordStrength, validatePassword]);

  // Generate password suggestions
  const handleGenerateSuggestions = async () => {
    const newSuggestions = await generatePasswordSuggestions(3);
    setSuggestions(newSuggestions);
  };

  // Copy suggestion to clipboard
  const handleCopySuggestion = (suggestion: string) => {
    navigator.clipboard.writeText(suggestion);
    setPassword(suggestion);
    toast.success('Password copiata negli appunti');
  };

  // Save config changes
  const handleSaveConfig = async () => {
    if (!config) return;
    const success = await updateValidationConfig(config);
    if (success) {
      toast.success('Configurazione salvata con successo');
    } else {
      toast.error('Errore nel salvataggio della configurazione');
    }
  };

  // Get color based on password strength score
  const getStrengthColor = (score: number) => {
    if (score < 30) return 'bg-red-500';
    if (score < 60) return 'bg-yellow-500';
    if (score < 80) return 'bg-blue-500';
    return 'bg-green-500';
  };

  // Get text based on password strength score
  const getStrengthText = (score: number) => {
    if (score < 30) return 'Debole';
    if (score < 60) return 'Media';
    if (score < 80) return 'Buona';
    return 'Forte';
  };

  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sistema di Validazione</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            {isLoading ? 'Caricamento...' : 'Nessuna configurazione disponibile'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sistema di Validazione</CardTitle>
        <CardDescription>
          Testa e configura il sistema di validazione input con protezione XSS
        </CardDescription>
      </CardHeader>
      <Tabs defaultValue="test">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="test">Test Validazione</TabsTrigger>
          <TabsTrigger value="config">Configurazione</TabsTrigger>
        </TabsList>
        
        <TabsContent value="test" className="space-y-6 p-4">
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              Test Validazione Profilo
            </h3>
            <ProfileNameValidator 
              value={profileName}
              onChange={setProfileName}
              onValidationChange={setIsNameValid}
            />
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Test Validazione Password</h3>
            <PasswordValidator
              value={password}
              onChange={setPassword}
              onValidationChange={setIsPasswordValid}
            />
            
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <Label>Suggerimenti Password</Label>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleGenerateSuggestions}
                  className="h-8 gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Genera
                </Button>
              </div>
              <div className="space-y-2">
                {suggestions.length > 0 ? (
                  suggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-center justify-between bg-muted p-2 rounded-md">
                      <code className="text-xs">{suggestion}</code>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleCopySuggestion(suggestion)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-2">
                    Clicca "Genera" per ottenere suggerimenti
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              Test Protezione XSS
            </h3>
            <InputValidator
              value={testInput}
              onChange={setTestInput}
              onValidationChange={setIsTestInputValid}
              label="Test Input Sicurezza"
              placeholder="Prova: <script>alert('XSS')</script> o javascript:alert(1)"
              showSecurityIndicator={true}
              minLength={3}
              maxLength={100}
              customValidator={async (value) => ({
                isValid: !value.toLowerCase().includes('malicious'),
                message: value.toLowerCase().includes('malicious') 
                  ? 'Contenuto non consentito rilevato' 
                  : 'Input sicuro e valido'
              })}
            />
            <div className="text-xs text-muted-foreground">
              Prova a inserire contenuto potenzialmente pericoloso come script HTML, 
              JavaScript inline, o la parola "malicious" per testare la validazione.
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button 
              disabled={!isNameValid || !isPasswordValid}
              className="w-full"
            >
              Crea Profilo (Demo)
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="config" className="space-y-4 p-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Configurazione Nome Profilo</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="min-length">Lunghezza minima</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="min-length"
                      min={1}
                      max={20}
                      step={1}
                      value={[config.profile_name.min_length]}
                      onValueChange={(value) => setConfig({
                        ...config,
                        profile_name: {
                          ...config.profile_name,
                          min_length: value[0]
                        }
                      })}
                    />
                    <span className="w-8 text-center">{config.profile_name.min_length}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-length">Lunghezza massima</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="max-length"
                      min={10}
                      max={100}
                      step={1}
                      value={[config.profile_name.max_length]}
                      onValueChange={(value) => setConfig({
                        ...config,
                        profile_name: {
                          ...config.profile_name,
                          max_length: value[0]
                        }
                      })}
                    />
                    <span className="w-8 text-center">{config.profile_name.max_length}</span>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="allowed-chars">Caratteri consentiti</Label>
                  <Input
                    id="allowed-chars"
                    value={config.profile_name.allowed_chars}
                    onChange={(e) => setConfig({
                      ...config,
                      profile_name: {
                        ...config.profile_name,
                        allowed_chars: e.target.value
                      }
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Specifica i caratteri consentiti nei nomi profilo
                  </p>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <h3 className="text-lg font-medium">Configurazione Password</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="pwd-min-length">Lunghezza minima</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="pwd-min-length"
                      min={4}
                      max={32}
                      step={1}
                      value={[config.password.min_length]}
                      onValueChange={(value) => setConfig({
                        ...config,
                        password: {
                          ...config.password,
                          min_length: value[0]
                        }
                      })}
                    />
                    <span className="w-8 text-center">{config.password.min_length}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="require-uppercase">Richiedi maiuscole</Label>
                    <Switch
                      id="require-uppercase"
                      checked={config.password.require_uppercase}
                      onCheckedChange={(checked) => setConfig({
                        ...config,
                        password: {
                          ...config.password,
                          require_uppercase: checked
                        }
                      })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="require-lowercase">Richiedi minuscole</Label>
                    <Switch
                      id="require-lowercase"
                      checked={config.password.require_lowercase}
                      onCheckedChange={(checked) => setConfig({
                        ...config,
                        password: {
                          ...config.password,
                          require_lowercase: checked
                        }
                      })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="require-digit">Richiedi numeri</Label>
                    <Switch
                      id="require-digit"
                      checked={config.password.require_digit}
                      onCheckedChange={(checked) => setConfig({
                        ...config,
                        password: {
                          ...config.password,
                          require_digit: checked
                        }
                      })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="require-special">Richiedi caratteri speciali</Label>
                    <Switch
                      id="require-special"
                      checked={config.password.require_special}
                      onCheckedChange={(checked) => setConfig({
                        ...config,
                        password: {
                          ...config.password,
                          require_special: checked
                        }
                      })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="disallow-common">Blocca password comuni</Label>
                    <Switch
                      id="disallow-common"
                      checked={config.password.disallow_common}
                      onCheckedChange={(checked) => setConfig({
                        ...config,
                        password: {
                          ...config.password,
                          disallow_common: checked
                        }
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <Button 
              onClick={handleSaveConfig}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Salvataggio...' : 'Salva Configurazione'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}