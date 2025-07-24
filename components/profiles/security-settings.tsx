'use client';

import { useState, useEffect } from 'react';
import { useProfiles } from '@/hooks/use-profiles';
import { useSecurity, RateLimiterConfig } from '@/hooks/use-security';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Shield, Lock, AlertTriangle, Save } from 'lucide-react';

export function SecuritySettings() {
  const { currentProfile } = useProfiles();
  const { 
    isLoading, 
    rateLimiterConfig, 
    getRateLimiterConfig, 
    setRateLimiterConfig,
    getLoginAttemptsInfo,
    resetLoginAttempts
  } = useSecurity();
  
  const [config, setConfig] = useState<RateLimiterConfig | null>(null);
  const [loginAttempts, setLoginAttempts] = useState<any>(null);
  
  // Carica la configurazione all'avvio
  useEffect(() => {
    getRateLimiterConfig();
  }, [getRateLimiterConfig]);
  
  // Aggiorna lo stato locale quando cambia la configurazione remota
  useEffect(() => {
    if (rateLimiterConfig) {
      setConfig(rateLimiterConfig);
    }
  }, [rateLimiterConfig]);
  
  // Carica le informazioni sui tentativi di login quando cambia il profilo
  useEffect(() => {
    if (currentProfile) {
      loadLoginAttemptsInfo();
    }
  }, [currentProfile]);
  
  // Carica le informazioni sui tentativi di login
  const loadLoginAttemptsInfo = async () => {
    if (!currentProfile) return;
    
    const info = await getLoginAttemptsInfo(currentProfile.id);
    if (info) {
      setLoginAttempts(info);
    }
  };
  
  // Gestisce il reset dei tentativi di login
  const handleResetAttempts = async () => {
    if (!currentProfile) return;
    
    const success = await resetLoginAttempts(currentProfile.id);
    if (success) {
      toast.success('Tentativi di login resettati con successo');
      await loadLoginAttemptsInfo();
    } else {
      toast.error('Errore nel reset dei tentativi di login');
    }
  };
  
  // Salva la configurazione
  const handleSaveConfig = async () => {
    if (!config) return;
    
    const success = await setRateLimiterConfig(config);
    if (success) {
      toast.success('Configurazione di sicurezza salvata con successo');
    } else {
      toast.error('Errore nel salvataggio della configurazione di sicurezza');
    }
  };
  
  // Formatta la durata in formato leggibile
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} secondi`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minuti`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ore`;
    return `${Math.floor(seconds / 86400)} giorni`;
  };
  
  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Impostazioni di Sicurezza
          </CardTitle>
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
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Impostazioni di Sicurezza
        </CardTitle>
        <CardDescription>
          Configura le impostazioni di sicurezza per i profili utente
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Rate Limiting */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Protezione Accessi
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max-attempts">Tentativi massimi prima del blocco</Label>
              <Input
                id="max-attempts"
                type="number"
                min="1"
                max="20"
                value={config.max_attempts}
                onChange={(e) => setConfig({
                  ...config,
                  max_attempts: parseInt(e.target.value) || 5
                })}
              />
              <p className="text-xs text-muted-foreground">
                Numero di tentativi falliti prima che l'account venga temporaneamente bloccato
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="block-duration">Durata blocco</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="block-duration"
                  type="number"
                  min="30"
                  max="86400"
                  value={config.block_duration_seconds}
                  onChange={(e) => setConfig({
                    ...config,
                    block_duration_seconds: parseInt(e.target.value) || 300
                  })}
                />
                <span className="text-sm whitespace-nowrap">
                  ({formatDuration(config.block_duration_seconds)})
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Durata del blocco dopo troppi tentativi falliti (in secondi)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reset-after">Reset tentativi dopo</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="reset-after"
                  type="number"
                  min="300"
                  max="86400"
                  value={config.reset_after_seconds}
                  onChange={(e) => setConfig({
                    ...config,
                    reset_after_seconds: parseInt(e.target.value) || 3600
                  })}
                />
                <span className="text-sm whitespace-nowrap">
                  ({formatDuration(config.reset_after_seconds)})
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tempo dopo il quale i tentativi falliti vengono resettati (in secondi)
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="exponential-backoff">Backoff esponenziale</Label>
                <Switch
                  id="exponential-backoff"
                  checked={config.exponential_backoff}
                  onCheckedChange={(checked) => setConfig({
                    ...config,
                    exponential_backoff: checked
                  })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Aumenta progressivamente la durata del blocco ad ogni violazione
              </p>
            </div>
          </div>
          
          {config.exponential_backoff && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="backoff-factor">Fattore di incremento</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    id="backoff-factor"
                    min={1.1}
                    max={5}
                    step={0.1}
                    value={[config.backoff_factor]}
                    onValueChange={(value) => setConfig({
                      ...config,
                      backoff_factor: value[0]
                    })}
                  />
                  <span className="w-12 text-right">{config.backoff_factor.toFixed(1)}x</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Moltiplicatore per ogni blocco successivo (es: 2x = raddoppia ogni volta)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="max-block-duration">Durata massima blocco</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="max-block-duration"
                    type="number"
                    min="300"
                    max="2592000"
                    value={config.max_block_duration_seconds}
                    onChange={(e) => setConfig({
                      ...config,
                      max_block_duration_seconds: parseInt(e.target.value) || 86400
                    })}
                  />
                  <span className="text-sm whitespace-nowrap">
                    ({formatDuration(config.max_block_duration_seconds)})
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Limite massimo per la durata del blocco con backoff esponenziale
                </p>
              </div>
            </div>
          )}
        </div>
        
        <Separator />
        
        {/* Informazioni tentativi di login */}
        {currentProfile && loginAttempts && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Tentativi di Accesso
            </h3>
            
            <div className="bg-muted p-4 rounded-md">
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="font-medium">Tentativi falliti:</dt>
                  <dd>{loginAttempts.failed_attempts}</dd>
                </div>
                
                {loginAttempts.failed_attempts > 0 && (
                  <div className="flex justify-between">
                    <dt className="font-medium">Ultimo tentativo:</dt>
                    <dd>{new Date(loginAttempts.last_attempt).toLocaleString()}</dd>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <dt className="font-medium">Numero di blocchi:</dt>
                  <dd>{loginAttempts.block_count}</dd>
                </div>
                
                {loginAttempts.is_blocked && (
                  <>
                    <div className="flex justify-between text-red-600">
                      <dt className="font-medium">Stato:</dt>
                      <dd className="font-bold">BLOCCATO</dd>
                    </div>
                    
                    <div className="flex justify-between">
                      <dt className="font-medium">Bloccato fino a:</dt>
                      <dd>{new Date(loginAttempts.blocked_until).toLocaleString()}</dd>
                    </div>
                    
                    <div className="flex justify-between">
                      <dt className="font-medium">Tempo rimanente:</dt>
                      <dd>{formatDuration(loginAttempts.remaining_seconds || 0)}</dd>
                    </div>
                  </>
                )}
              </dl>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={handleResetAttempts}
                disabled={isLoading}
              >
                Reset Tentativi
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={handleSaveConfig}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isLoading ? 'Salvataggio...' : 'Salva Configurazione'}
        </Button>
      </CardFooter>
    </Card>
  );
}4"
                onClick={handleResetAttempts}
                disabled={isLoading}
              >
                Reset Tentativi
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={handleSaveConfig}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isLoading ? 'Salvataggio...' : 'Salva Configurazione'}
        </Button>
      </CardFooter>
    </Card>
  );
}4"
                onClick={handleResetAttempts}
                disabled={isLoading}
              >
                Reset Tentativi
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={handleSaveConfig}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isLoading ? 'Salvataggio...' : 'Salva Configurazione'}
        </Button>
      </CardFooter>
    </Card>
  );
}