'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Upload, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Info, 
  FileText,
  Loader2,
  AlertCircle,
  FolderOpen,
  Copy,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

interface SharedAccount {
  steamId: string;
  username?: string;
  avatar?: string;
}

export function SteamFamilySharing() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectionProgress, setDetectionProgress] = useState(0);

  const handleAutoDetect = async () => {
    setIsDetecting(true);
    setError(null);
    setDetectionProgress(0);
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setDetectionProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/steam/auto-detect-config', {
        method: 'POST',
      });
      
      clearInterval(progressInterval);
      setDetectionProgress(100);
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Rilevamento automatico fallito');
      }
      
      if (result.sharedAccounts && result.sharedAccounts.length > 0) {
        setSharedAccounts(result.sharedAccounts);
        toast.success(`Trovati ${result.sharedAccounts.length} account condivisi!`);
      } else {
        setError('Nessun account condiviso trovato. Assicurati che la condivisione familiare sia attiva.');
      }
      
    } catch (error: any) {
      setError(error.message);
      toast.error('Rilevamento automatico non riuscito');
    } finally {
      setIsDetecting(false);
      setDetectionProgress(0);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error('Seleziona un file prima di procedere');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const fileContent = await selectedFile.text();
      const response = await fetch('/api/steam/shared-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: fileContent,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore durante l\'analisi del file');
      }

      setSharedAccounts(result.sharedAccounts || []);
      if (result.sharedAccounts.length === 0) {
        setError('Nessun account condiviso trovato nel file.');
      } else {
        toast.success(`Trovati ${result.sharedAccounts.length} account condivisi!`);
      }

    } catch (error: any) {
      setError(error.message);
      toast.error('Errore durante l\'analisi del file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setError(null);
    }
  };

  const copyPath = () => {
    navigator.clipboard.writeText('C:\\Program Files (x86)\\Steam\\userdata\\[YOUR_ID]\\7\\remote\\sharedconfig.vdf');
    toast.success('Percorso copiato negli appunti!');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <CardTitle>Gestione Condivisione Familiare</CardTitle>
        </div>
        <CardDescription>
          Rileva automaticamente gli account Steam che condividono la loro libreria con te
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="auto" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="auto">
              <Search className="h-4 w-4 mr-2" />
              Rilevamento Automatico
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Upload className="h-4 w-4 mr-2" />
              Caricamento Manuale
            </TabsTrigger>
          </TabsList>

          <TabsContent value="auto" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Come funziona</AlertTitle>
              <AlertDescription>
                Il sistema cercherà automaticamente la configurazione di Steam sul tuo PC per identificare
                gli account che condividono la loro libreria con te.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-4">
              <Button 
                onClick={handleAutoDetect} 
                disabled={isDetecting}
                className="w-full"
                size="lg"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rilevamento in corso...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Avvia Rilevamento Automatico
                  </>
                )}
              </Button>

              {isDetecting && (
                <div className="space-y-2">
                  <Progress value={detectionProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    Analisi configurazione Steam... {detectionProgress}%
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>File di configurazione</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>Carica il file <code className="font-mono bg-muted px-1 py-0.5 rounded">sharedconfig.vdf</code> che si trova in:</p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="font-mono text-xs bg-muted p-2 rounded flex-1">
                    C:\Program Files (x86)\Steam\userdata\[YOUR_ID]\7\remote\sharedconfig.vdf
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyPath}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="grid w-full gap-2">
                <Label htmlFor="vdf-file">Seleziona il file sharedconfig.vdf</Label>
                <Input
                  id="vdf-file"
                  type="file"
                  accept=".vdf"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
              </div>

              <Button 
                onClick={handleFileUpload} 
                disabled={!selectedFile || isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analisi in corso...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Analizza File
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Errore</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {sharedAccounts.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Account Condivisi Trovati</h3>
              <Badge variant="secondary">{sharedAccounts.length} account</Badge>
            </div>
            
            <div className="grid gap-3">
              {sharedAccounts.map((account, index) => (
                <div
                  key={account.steamId}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{account.username || `Utente ${index + 1}`}</p>
                      <p className="text-sm text-muted-foreground font-mono">{account.steamId}</p>
                    </div>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              ))}
            </div>

            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle>Configurazione completata!</AlertTitle>
              <AlertDescription>
                Gli account condivisi sono stati rilevati con successo. I giochi di questi utenti
                saranno inclusi nella tua libreria quando effettui la scansione.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
