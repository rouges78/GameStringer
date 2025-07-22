'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
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
  Lock,\n  Database
} from 'lucide-react';
import { useProfiles } from '@/hooks/use-profiles';
import { useProfileSettings } from '@/hooks/use-profile-settings';\nimport { MigrationWizard } from './migration-wizard';\nimport { SettingsMigrationWizard } from './settings-migration-wizard';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface ProfileManagerProps {
  onClose?: () => void;
}

interface ExportImportTabProps {
  profileId: string;
}

function ExportImportTab({ profileId }: ExportImportTabProps) {
  const [exportPassword, setExportPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const handleExport = async () => {
    if (!exportPassword.trim()) {
      setExportError('Inserisci una password per l\'export');
      return;
    }

    setIsExporting(true);
    setExportError(null);
    setExportSuccess(null);

    try {
      // Simula chiamata API export
      await new Promise(resolve => setTimeout(resolve, 2000));
      setExportSuccess('Profilo esportato con successo!');
      setExportPassword('');
    } catch (error) {
      setExportError('Errore durante l\'export del profilo');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      setImportError('Seleziona un file da importare');
      return;
    }

    if (!importPassword.trim()) {
      setImportError('Inserisci la password del file');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      // Simula chiamata API import
      await new Promise(resolve => setTimeout(resolve, 2000));
      setImportFile(null);
      setImportPassword('');
    } catch (error) {
      setImportError('Errore durante l\'import del profilo');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5" />
            <span>Esporta Profilo</span>
          </CardTitle>
          <CardDescription>
            Crea un backup crittografato del tuo profilo con tutte le impostazioni e credenziali.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="export-password">Password per Export</Label>
            <Input
              id="export-password"
              type="password"
              value={exportPassword}
              onChange={(e) => setExportPassword(e.target.value)}
              placeholder="Inserisci una password sicura"
              disabled={isExporting}
            />
            <p className="text-xs text-muted-foreground">
              Questa password sarà necessaria per importare il profilo
            </p>
          </div>

          {exportError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{exportError}</AlertDescription>
            </Alert>
          )}

          {exportSuccess && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                {exportSuccess}
              </AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleExport}
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

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Importa Profilo</span>
          </CardTitle>
          <CardDescription>
            Importa un profilo precedentemente esportato.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-file">File Profilo</Label>
            <Input
              id="import-file"
              type="file"
              accept=".gsp"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              disabled={isImporting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-password">Password File</Label>
            <Input
              id="import-password"
              type="password"
              value={importPassword}
              onChange={(e) => setImportPassword(e.target.value)}
              placeholder="Password utilizzata per l'export"
              disabled={isImporting}
            />
          </div>

          {importError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleImport}
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
  );
}

export function ProfileManager({ onClose }: ProfileManagerProps) {
  const { currentProfile, logout, refreshProfiles } = useProfiles();
  const { settings, globalSettings } = useProfileSettings();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);\n  const [showMigrationWizard, setShowMigrationWizard] = useState(false);\n  const [showSettingsMigrationWizard, setShowSettingsMigrationWizard] = useState(false);

  if (!currentProfile) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Nessun profilo attivo
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const success = await logout();
    if (success && onClose) {
      onClose();
    }
    setIsLoggingOut(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshProfiles();
    setIsRefreshing(false);
  };

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

  const getCreatedText = (created: string) => {
    try {
      const date = new Date(created);
      return formatDistanceToNow(date, { 
        addSuffix: true, 
        locale: it 
      });
    } catch {
      return 'Sconosciuto';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={currentProfile.avatar_path} alt={currentProfile.name} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                {getInitials(currentProfile.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{currentProfile.name}</h1>
              <p className="text-muted-foreground">Gestione Profilo</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logout...
                </>
              ) : (
                <>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </>
              )}
            </Button>
            
            {onClose && (
              <Button variant="ghost" onClick={onClose}>
                ✕
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Panoramica</TabsTrigger>
            <TabsTrigger value="security">Sicurezza</TabsTrigger>
            <TabsTrigger value="migration">Migrazione</TabsTrigger>
            <TabsTrigger value="export-import">Export/Import</TabsTrigger>
            <TabsTrigger value="advanced">Avanzate</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Profile Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>Informazioni Profilo</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Nome:</span>
                    <span className="text-sm font-medium">{currentProfile.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">ID:</span>
                    <span className="text-sm font-mono">{currentProfile.id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Creato:</span>
                    <span className="text-sm">{getCreatedText(currentProfile.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Ultimo accesso:</span>
                    <span className="text-sm">{getLastAccessedText(currentProfile.last_accessed)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Settings Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="h-5 w-5" />
                    <span>Impostazioni</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {settings && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Tema:</span>
                        <Badge variant="outline" className="capitalize">
                          {settings.theme}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Lingua:</span>
                        <Badge variant="outline">
                          {settings.language.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Auto-login:</span>
                        <Badge variant={settings.auto_login ? "default" : "secondary"}>
                          {settings.auto_login ? 'Attivo' : 'Disattivo'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Vista libreria:</span>
                        <Badge variant="outline" className="capitalize">
                          {settings.game_library.default_view}
                        </Badge>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Usage Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <HardDrive className="h-5 w-5" />
                    <span>Statistiche Utilizzo</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Accessi totali:</span>
                    <span className="text-sm font-medium">{currentProfile.metadata.access_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Giochi aggiunti:</span>
                    <span className="text-sm font-medium">{currentProfile.metadata.usage_stats.games_added}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Store connessi:</span>
                    <span className="text-sm font-medium">{currentProfile.metadata.usage_stats.stores_connected}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Dimensione dati:</span>
                    <span className="text-sm font-medium">
                      {(currentProfile.metadata.data_size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Credentials */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Key className="h-5 w-5" />
                    <span>Credenziali Store</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.keys(currentProfile.credentials).length > 0 ? (
                      Object.keys(currentProfile.credentials).map((store) => (
                        <div key={store} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{store}</span>
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Configurato
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nessuna credenziale configurata
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-5 w-5" />
                    <span>Impostazioni Sicurezza</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {settings && (
                    <>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">Timeout sessione</p>
                          <p className="text-xs text-muted-foreground">
                            {settings.security.session_timeout} minuti
                          </p>
                        </div>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      
                      <Separator />
                      
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">Password per operazioni sensibili</p>
                          <p className="text-xs text-muted-foreground">
                            {settings.security.require_password_for_sensitive ? 'Richiesta' : 'Non richiesta'}
                          </p>
                        </div>
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      
                      <Separator />
                      
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">Blocco automatico</p>
                          <p className="text-xs text-muted-foreground">
                            Dopo {settings.security.auto_lock_failed_attempts} tentativi falliti
                          </p>
                        </div>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Integrità Dati</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">Hash integrità</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {currentProfile.metadata.integrity_hash.slice(0, 16)}...
                      </p>
                    </div>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">Versione formato</p>
                      <p className="text-xs text-muted-foreground">
                        v{currentProfile.metadata.version}
                      </p>
                    </div>
                    <Badge variant="outline">Aggiornato</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Migration Tab */}\n          <TabsContent value=\"migration\" className=\"space-y-4\">\n            <Card>\n              <CardHeader>\n                <CardTitle className=\"flex items-center space-x-2\">\n                  <Database className=\"h-5 w-5\" />\n                  <span>Migrazione Credenziali</span>\n                </CardTitle>\n                <CardDescription>\n                  Migra le credenziali esistenti al sistema di profili.\n                </CardDescription>\n              </CardHeader>\n              <CardContent className=\"space-y-4\">\n                <Alert>\n                  <AlertTriangle className=\"h-4 w-4\" />\n                  <AlertDescription>\n                    La migrazione trasferirà le credenziali legacy al profilo attivo.\n                    Questa operazione è irreversibile.\n                  </AlertDescription>\n                </Alert>\n                \n                <div className=\"space-y-2\">\n                  <Button \n                    onClick={() => setShowMigrationWizard(true)}\n                    className=\"w-full\"\n                  >\n                    <Database className=\"mr-2 h-4 w-4\" />\n                    Migra Credenziali Legacy\n                  </Button>\n                  \n                  <Button \n                    onClick={() => setShowSettingsMigrationWizard(true)}\n                    className=\"w-full\"\n                    variant=\"outline\"\n                  >\n                    <Settings className=\"mr-2 h-4 w-4\" />\n                    Migra Impostazioni Legacy\n                  </Button>\n                </div>\n              </CardContent>\n            </Card>\n          </TabsContent>\n\n          {/* Export/Import Tab */}
          <TabsContent value="export-import">
            <ExportImportTab profileId={currentProfile.id} />
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Opzioni Avanzate</span>
                </CardTitle>
                <CardDescription>
                  Operazioni avanzate per la gestione del profilo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Le operazioni in questa sezione sono irreversibili. Procedi con cautela.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Rigenera Hash Integrità
                  </Button>
                  
                  <Button variant="outline" className="w-full justify-start">
                    <HardDrive className="mr-2 h-4 w-4" />
                    Ottimizza Storage Profilo
                  </Button>
                  
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="mr-2 h-4 w-4" />
                    Esporta Log Attività
                  </Button>
                  
                  <Separator />
                  
                  <Button variant="destructive" className="w-full justify-start">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Elimina Profilo
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}  
    
      <MigrationWizard 
        isOpen={showMigrationWizard}
        onClose={() => setShowMigrationWizard(false)}
        onComplete={() => {
          setShowMigrationWizard(false);
          refreshProfiles();
        }}
      />  
    
      <SettingsMigrationWizard 
        isOpen={showSettingsMigrationWizard}
        onClose={() => setShowSettingsMigrationWizard(false)}
        onComplete={() => {
          setShowSettingsMigrationWizard(false);
          // Refresh delle impostazioni se necessario
        }}
      />