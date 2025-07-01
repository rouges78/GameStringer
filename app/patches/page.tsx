
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { 
  Package, 
  Download, 
  Upload, 
  FileText,
  Shield,
  Calendar,
  Users,
  HardDrive,
  CheckCircle,
  RefreshCw,
  Eye,
  Trash2,
  AlertTriangle,
  FolderOpen,
  FileArchive,
  FileCode,
  Languages,
  Save,
  Plus,
  Search,
  Filter,
  MoreVertical,
  ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { PatchMetadata, TranslationEntry } from '@/lib/patch-manager';

interface PatchExportProgress {
  isExporting: boolean;
  stage: string;
  progress: number;
}

interface GameInfo {
  id: string;
  title: string;
  path: string;
  isInstalled: boolean;
}

export default function PatchesPage() {
  const [patches, setPatches] = useState<PatchMetadata[]>([]);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [selectedPatch, setSelectedPatch] = useState<PatchMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'published' | 'draft'>('all');
  const [exportProgress, setExportProgress] = useState<PatchExportProgress>({
    isExporting: false,
    stage: '',
    progress: 0
  });

  const [newPatchForm, setNewPatchForm] = useState({
    gameId: '',
    gameName: '',
    name: '',
    description: '',
    targetLanguage: 'it',
    sourceLanguage: 'en',
    patchType: 'REPLACEMENT' as 'REPLACEMENT' | 'INJECTION' | 'HYBRID',
    includeBackup: true,
    digitallySigned: false,
    author: ''
  });

  // Carica le patch all'avvio
  useEffect(() => {
    loadPatches();
    loadGames();
  }, []);

  const loadPatches = async () => {
    try {
      const response = await fetch('/api/patches');
      if (response.ok) {
        const data = await response.json();
        setPatches(data);
      }
    } catch (error) {
      console.error('Errore nel caricamento delle patch:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare le patch',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadGames = async () => {
    // Carica i giochi dal sistema
    // Per ora usiamo dati di esempio
    setGames([
      { id: 'cyberpunk2077', title: 'Cyberpunk 2077', path: 'C:\\Games\\Cyberpunk 2077', isInstalled: true },
      { id: 'witcher3', title: 'The Witcher 3', path: 'C:\\Games\\The Witcher 3', isInstalled: true },
      { id: 'baldursgate3', title: 'Baldur\'s Gate 3', path: 'C:\\Games\\Baldurs Gate 3', isInstalled: true },
      { id: 'starfield', title: 'Starfield', path: 'C:\\Games\\Starfield', isInstalled: true }
    ]);
  };

  const exportPatch = async (patch: PatchMetadata) => {
    try {
      setExportProgress({ isExporting: true, stage: 'Preparazione export...', progress: 10 });
      
      const response = await fetch('/api/patches/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patchId: patch.id,
          options: {
            format: 'zip',
            includeInstaller: true,
            includeReadme: true,
            compression: 'normal'
          }
        })
      });

      if (!response.ok) {
        throw new Error('Errore nell\'export');
      }

      setExportProgress({ isExporting: true, stage: 'Download in corso...', progress: 90 });

      // Scarica il file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${patch.name.replace(/\s+/g, '_')}_v${patch.version}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportProgress({ isExporting: false, stage: 'Completato!', progress: 100 });
      
      toast({
        title: 'Export completato',
        description: `La patch ${patch.name} è stata esportata con successo`
      });
    } catch (error) {
      console.error('Errore export:', error);
      setExportProgress({ isExporting: false, stage: '', progress: 0 });
      toast({
        title: 'Errore',
        description: 'Impossibile esportare la patch',
        variant: 'destructive'
      });
    }
  };

  const createPatch = async () => {
    if (!newPatchForm.gameId || !newPatchForm.name) {
      toast({
        title: 'Errore',
        description: 'Compila tutti i campi obbligatori',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Ottieni le traduzioni per il gioco selezionato
      // Per ora usiamo traduzioni di esempio
      const translations: TranslationEntry[] = [
        {
          id: '1',
          originalText: 'New Game',
          translatedText: 'Nuovo Gioco',
          context: 'Main Menu',
          reviewed: true
        },
        {
          id: '2',
          originalText: 'Continue',
          translatedText: 'Continua',
          context: 'Main Menu',
          reviewed: true
        }
      ];

      const response = await fetch('/api/patches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          options: {
            ...newPatchForm,
            gameName: games.find(g => g.id === newPatchForm.gameId)?.title || ''
          },
          translations
        })
      });

      if (!response.ok) {
        throw new Error('Errore nella creazione');
      }

      const newPatch = await response.json();
      setPatches([newPatch, ...patches]);
      
      toast({
        title: 'Patch creata',
        description: `La patch ${newPatch.name} è stata creata con successo`
      });

      // Reset form
      setNewPatchForm({
        gameId: '',
        gameName: '',
        name: '',
        description: '',
        targetLanguage: 'it',
        sourceLanguage: 'en',
        patchType: 'REPLACEMENT',
        includeBackup: true,
        digitallySigned: false,
        author: ''
      });
    } catch (error) {
      console.error('Errore creazione patch:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile creare la patch',
        variant: 'destructive'
      });
    }
  };

  const getPatchTypeColor = (type: string) => {
    switch (type) {
      case 'REPLACEMENT': return 'bg-blue-500/10 text-blue-500';
      case 'INJECTION': return 'bg-purple-500/10 text-purple-500';
      case 'HYBRID': return 'bg-orange-500/10 text-orange-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getGameTitle = (gameId: string) => {
    return games.find(g => g.id === gameId)?.title || 'Gioco Sconosciuto';
  };

  const deletePatch = async (patchId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa patch?')) return;

    try {
      // Per ora rimuoviamo solo dalla lista locale
      setPatches(patches.filter(p => p.id !== patchId));
      toast({
        title: 'Patch eliminata',
        description: 'La patch è stata eliminata con successo'
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile eliminare la patch',
        variant: 'destructive'
      });
    }
  };

  // Filtra le patch
  const filteredPatches = patches.filter(patch => {
    const matchesSearch = patch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patch.gameName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || 
                         (filterType === 'published' && patch.isPublished) ||
                         (filterType === 'draft' && !patch.isPublished);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestione Patch</h1>
          <p className="text-muted-foreground">Crea, gestisci ed esporta patch di traduzione</p>
        </div>
      </div>

      {/* Barra di ricerca e filtri */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca patch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={(value: 'all' | 'published' | 'draft') => setFilterType(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le patch</SelectItem>
            <SelectItem value="published">Pubblicate</SelectItem>
            <SelectItem value="draft">Bozze</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="patches" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="patches">Le Mie Patch</TabsTrigger>
          <TabsTrigger value="create">Crea Nuova</TabsTrigger>
          <TabsTrigger value="details">Dettagli</TabsTrigger>
        </TabsList>

        <TabsContent value="patches" className="space-y-4">
          {/* Patch Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-500">{patches.length}</div>
                <div className="text-sm text-muted-foreground">Patch Totali</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-500">
                  {filteredPatches.filter(p => p.isPublished).length}
                </div>
                <div className="text-sm text-muted-foreground">Pubblicate</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-500">
                  {filteredPatches.reduce((sum, p) => sum + p.installCount, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Installazioni</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-500">
                  {filteredPatches.reduce((sum, p) => sum + p.translations.length, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Traduzioni</div>
              </CardContent>
            </Card>
          </div>

          {/* Patch List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPatches.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Nessuna patch trovata</p>
                <p className="text-sm text-muted-foreground">Crea la tua prima patch per iniziare</p>

const deletePatch = async (patchId: string) => {
  if (!confirm('Sei sicuro di voler eliminare questa patch?')) return;

  try {
    // Per ora rimuoviamo solo dalla lista locale
    setPatches(patches.filter(p => p.id !== patchId));
    toast({
      title: 'Patch eliminata',
      description: 'La patch è stata eliminata con successo'
    });
  } catch (error) {
    toast({
      title: 'Errore',
      description: 'Impossibile eliminare la patch',
      variant: 'destructive'
    });
  }
};

// Filtra le patch
const filteredPatches = patches.filter(patch => {
  const matchesSearch = patch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       patch.gameName.toLowerCase().includes(searchTerm.toLowerCase());
  const matchesFilter = filterType === 'all' || 
                       (filterType === 'published' && patch.isPublished) ||
                       (filterType === 'draft' && !patch.isPublished);
  return matchesSearch && matchesFilter;
});

return (
  <div className="p-6 space-y-6">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Gestione Patch</h1>
        <p className="text-muted-foreground">Crea, gestisci ed esporta patch di traduzione</p>
      </div>
    </div>

    {/* Barra di ricerca e filtri */}
    <div className="flex gap-4 items-center">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca patch..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      <Select value={filterType} onValueChange={(value: 'all' | 'published' | 'draft') => setFilterType(value)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutte le patch</SelectItem>
          <SelectItem value="published">Pubblicate</SelectItem>
          <SelectItem value="draft">Bozze</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <Tabs defaultValue="patches" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="patches">Le Mie Patch</TabsTrigger>
        <TabsTrigger value="create">Crea Nuova</TabsTrigger>
        <TabsTrigger value="details">Dettagli</TabsTrigger>
      </TabsList>

      <TabsContent value="patches" className="space-y-4">
        {/* Patch Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-500">{patches.length}</div>
              <div className="text-sm text-muted-foreground">Patch Totali</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-500">
                {filteredPatches.filter(p => p.isPublished).length}
              </div>
              <div className="text-sm text-muted-foreground">Pubblicate</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-500">
                {filteredPatches.reduce((sum, p) => sum + p.installCount, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Installazioni</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-500">
                {filteredPatches.reduce((sum, p) => sum + p.translations.length, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Traduzioni</div>
            </CardContent>
          </Card>
        </div>

        {/* Patch List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPatches.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nessuna patch trovata</p>
              <p className="text-sm text-muted-foreground">Crea la tua prima patch per iniziare</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredPatches.map((patch, index) => (
            <motion.div
              key={patch.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{patch.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {getGameTitle(patch.gameId)} • v{patch.version}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getPatchTypeColor(patch.patchType)}>
                        {patch.patchType}
                      </Badge>
                      <Badge variant={patch.isPublished ? "default" : "secondary"}>
                        {patch.isPublished ? 'Pubblicata' : 'Draft'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{patch.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{patch.translations.length.toLocaleString()} traduzioni</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{patch.installCount.toLocaleString()} installazioni</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {patch.fileSize ? `${(patch.fileSize / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{new Date(patch.createdAt).toLocaleDateString('it-IT')}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 pt-2 border-t">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedPatch(patch)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Dettagli
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => exportPatch(patch)}
                      disabled={exportProgress.isExporting}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Esporta
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deletePatch(patch.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="create" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Crea Nuova Patch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Gioco</label>
                <Select value={newPatchForm.gameId} onValueChange={(value) => 
                  setNewPatchForm(prev => ({ ...prev, gameId: value }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona gioco..." />
                  </SelectTrigger>
                  <SelectContent>
                    {games.filter(g => g.isInstalled).map(game => (
                      <SelectItem key={game.id} value={game.id}>
                        {game.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Lingua Target</label>
                <Select value={newPatchForm.targetLanguage} onValueChange={(value) => 
                  setNewPatchForm(prev => ({ ...prev, targetLanguage: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="it">Italiano</SelectItem>
                    <SelectItem value="es">Spagnolo</SelectItem>
                    <SelectItem value="fr">Francese</SelectItem>
                    <SelectItem value="de">Tedesco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Nome Patch</label>
              <Input
                value={newPatchForm.name}
                onChange={(e) => setNewPatchForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="es. Cyberpunk 2077 - Traduzione Italiana Completa"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Descrizione</label>
              <Textarea
                value={newPatchForm.description}
                onChange={(e) => setNewPatchForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrivi la patch e le sue caratteristiche..."
                className="min-h-[100px]"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Tipo Patch</label>
              <Select value={newPatchForm.patchType} onValueChange={(value) => 
                setNewPatchForm(prev => ({ ...prev, patchType: value as 'REPLACEMENT' | 'INJECTION' | 'HYBRID' }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REPLACEMENT">Replacement - Sostituisce file originali</SelectItem>
                  <SelectItem value="INJECTION">Injection - Injection runtime</SelectItem>
                  <SelectItem value="HYBRID">Hybrid - Combinazione dei due</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newPatchForm.includeBackup}
                  onChange={(e) => setNewPatchForm(prev => ({ ...prev, includeBackup: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Includi backup automatico</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newPatchForm.digitallySigned}
                  onChange={(e) => setNewPatchForm(prev => ({ ...prev, digitallySigned: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Firma digitale</span>
              </label>
            </div>
            
            <Button onClick={createPatch} className="w-full">
              <Package className="h-4 w-4 mr-2" />
              Crea Patch
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="details" className="space-y-4">
        {/* Selected Patch Details */}
        {selectedPatch ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Dettagli Patch</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPatch(null)}
                  >
                    ✕
                  </Button>
                </div>
                <CardDescription>{selectedPatch.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Info principali */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Gioco</span>
                    <p className="mt-1">{selectedPatch.gameName}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Versione</span>
                    <p className="mt-1">v{selectedPatch.version}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Tipo</span>
                    <Badge className={`mt-1 ${getPatchTypeColor(selectedPatch.patchType)}`}>
                      {selectedPatch.patchType}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Stato</span>
                    <Badge variant={selectedPatch.isPublished ? "default" : "secondary"} className="mt-1">
                      {selectedPatch.isPublished ? 'Pubblicata' : 'Bozza'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Lingua</span>
                    <p className="mt-1">{selectedPatch.sourceLanguage.toUpperCase()} → {selectedPatch.targetLanguage.toUpperCase()}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Autore</span>
                    <p className="mt-1">{selectedPatch.author || 'N/D'}</p>
                  </div>
                </div>
                
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Descrizione</span>
                  <p className="mt-1 text-sm">{selectedPatch.description || 'Nessuna descrizione disponibile'}</p>
                </div>
                
                {/* Statistiche */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-500">{selectedPatch.translations.length}</div>
                    <div className="text-sm text-muted-foreground">Traduzioni</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">{selectedPatch.installCount}</div>
                    <div className="text-sm text-muted-foreground">Installazioni</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">
                      {selectedPatch.fileSize ? `${(selectedPatch.fileSize / 1024 / 1024).toFixed(1)} MB` : '0 MB'}
                    </div>
                    <div className="text-sm text-muted-foreground">Dimensione</div>
                  </div>
                </div>

                {/* Opzioni */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Backup automatico</span>
                    </div>
                    <Badge variant={selectedPatch.includeBackup ? "default" : "secondary"}>
                      {selectedPatch.includeBackup ? 'Attivo' : 'Disattivo'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Firma digitale</span>
                    </div>
                    <Badge variant={selectedPatch.digitallySigned ? "default" : "secondary"}>
                      {selectedPatch.digitallySigned ? 'Firmata' : 'Non firmata'}
                    </Badge>
                  </div>
                </div>

                {/* Date */}
                <div className="space-y-2 pt-4 border-t text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Creata:</span>
                    <span>{new Date(selectedPatch.createdAt).toLocaleString('it-IT')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Aggiornata:</span>
                    <span>{new Date(selectedPatch.updatedAt).toLocaleString('it-IT')}</span>
                  </div>
                </div>
                
                {/* Azioni */}
                <div className="flex items-center gap-2 pt-4">
                  <Button 
                    onClick={() => exportPatch(selectedPatch)}
                    disabled={exportProgress.isExporting}
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Esporta
                  </Button>
                  {!selectedPatch.isPublished && (
                    <Button variant="outline" className="flex-1">
                      <Upload className="h-4 w-4 mr-2" />
                      Pubblica
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Eye className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Seleziona una patch</p>
              <p className="text-sm text-muted-foreground">Clicca su "Dettagli" per vedere più informazioni</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
