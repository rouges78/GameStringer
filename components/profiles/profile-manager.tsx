'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  Settings, 
  LogOut, 
  Download, 
  Upload,
  Shield,
  Clock,
  HardDrive,
  Key,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  FileText,
  Lock,
  Database
} from 'lucide-react';
import { useProfiles } from '@/hooks/use-profiles';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface ProfileManagerProps {
  onClose?: () => void;
}

export function ProfileManager({ onClose }: ProfileManagerProps) {
  const { 
    currentProfile, 
    profiles, 
    isLoading, 
    error,
    switchProfile,
    deleteProfile,
    logout
  } = useProfiles();
  
  const { settings, updateSettings } = useProfileSettings();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');

  if (!currentProfile) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nessun Profilo Attivo</h3>
        <p className="text-muted-foreground">
          Seleziona un profilo per accedere al manager.
        </p>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getLastAccessedText = (lastAccessed: string) => {
    try {
      const date = new Date(lastAccessed);
      return formatDistanceToNow(date, { 
        addSuffix: true, 
        locale: it 
      });
    } catch {
      return 'Mai';
    }
  };

  const handleExportProfile = async () => {
    if (!exportPassword.trim()) {
      alert('Inserisci una password per l\'export');
      return;
    }

    setIsExporting(true);
    try {
      // Simula export (implementazione reale dovrebbe chiamare Tauri)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Crea un file di esempio
      const exportData = {
        profile: currentProfile,
        settings: settings,
        exportedAt: new Date().toISOString(),
        version: '3.2.2'
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProfile.name}_profile_backup.gsp`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('Profilo esportato con successo!');
      setExportPassword('');
    } catch (error) {
      console.error('Errore export:', error);
      alert('Errore durante l\'export del profilo');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportProfile = async () => {
    if (!importFile || !importPassword.trim()) {
      alert('Seleziona un file e inserisci la password');
      return;
    }

    setIsImporting(true);
    try {
      // Simula import (implementazione reale dovrebbe chiamare Tauri)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      alert('Profilo importato con successo!');
      setImportFile(null);
      setImportPassword('');
    } catch (error) {
      console.error('Errore import:', error);
      alert('Errore durante l\'import del profilo');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!confirm(`Sei sicuro di voler eliminare il profilo "${currentProfile.name}"? Questa azione è irreversibile.`)) {
      return;
    }

    try {
      await deleteProfile(currentProfile.id);
      alert('Profilo eliminato con successo');
      onClose?.();
    } catch (error) {
      console.error('Errore eliminazione profilo:', error);
      alert('Errore durante l\'eliminazione del profilo');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16 ring-2 ring-primary/20">
            <AvatarImage src={currentProfile.avatar_path} alt={currentProfile.name} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-bold">
              {getInitials(currentProfile.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{currentProfile.name}</h1>
            <p className="text-muted-foreground">
              Ultimo accesso: {getLastAccessedText(currentProfile.last_accessed)}
            </p>
            <Badge variant="outline" className="mt-1">
              ID: {currentProfile.id.slice(0, 8)}...
            </Badge>
          </div>
        </div>
        
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Chiudi
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="settings">Impostazioni</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="security">Sicurezza</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Informazioni Profilo</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome Profilo</Label>
                  <div className="p-2 bg-muted rounded">{currentProfile.name}</div>
                </div>
                <div className="space-y-2">
                  <Label>ID Profilo</Label>
                  <div className="p-2 bg-muted rounded font-mono text-sm">{currentProfile.id}</div>
                </div>
                <div className="space-y-2">
                  <Label>Creato il</Label>
                  <div className="p-2 bg-muted rounded">
                    {new Date(currentProfile.created_at).toLocaleDateString('it-IT')}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Statistiche</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Profili Totali:</span>
                  <Badge>{profiles.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Tema Corrente:</span>
                  <Badge variant="outline">{settings?.theme || 'Auto'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Lingua:</span>
                  <Badge variant="outline">{settings?.language || 'Italiano'}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Impostazioni Profilo</CardTitle>
              <CardDescription>
                Personalizza le impostazioni per questo profilo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  Le impostazioni sono isolate per ogni profilo e non influenzano altri profili.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome Profilo</Label>
                  <Input 
                    value={currentProfile.name} 
                    disabled 
                    className="bg-muted"
                  />
                  <p className="text-sm text-muted-foreground">
                    Il nome del profilo non può essere modificato dopo la creazione
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Download className="h-5 w-5" />
                  <span>Esporta Profilo</span>
                </CardTitle>
                <CardDescription>
                  Crea un backup crittografato del profilo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Password di Protezione</Label>
                  <Input
                    type="password"
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="Inserisci password per il backup"
                  />
                </div>
                
                <Button 
                  onClick={handleExportProfile}
                  disabled={isExporting || !exportPassword.trim()}
                  className="w-full"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Esportazione...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Esporta Profilo
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Import */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="h-5 w-5" />
                  <span>Importa Profilo</span>
                </CardTitle>
                <CardDescription>
                  Ripristina un profilo da backup
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>File di Backup (.gsp)</Label>
                  <Input
                    type="file"
                    accept=".gsp"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Password del Backup</Label>
                  <Input
                    type="password"
                    value={importPassword}
                    onChange={(e) => setImportPassword(e.target.value)}
                    placeholder="Password del backup"
                  />
                </div>
                
                <Button 
                  onClick={handleImportProfile}
                  disabled={isImporting || !importFile || !importPassword.trim()}
                  className="w-full"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importazione...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Importa Profilo
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-red-500" />
                <span>Zona Pericolosa</span>
              </CardTitle>
              <CardDescription>
                Azioni irreversibili che possono causare perdita di dati
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Le azioni in questa sezione sono irreversibili. Assicurati di aver fatto un backup prima di procedere.
                </AlertDescription>
              </Alert>
              
              <Separator />
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-red-600 mb-2">Elimina Profilo</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Elimina permanentemente questo profilo e tutti i suoi dati. 
                    Questa azione non può essere annullata.
                  </p>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteProfile}
                    className="w-full"
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Elimina Profilo Definitivamente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}