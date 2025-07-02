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

interface PatchMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  gameId: string;
  gameName: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  size: number;
  filesCount: number;
  translationsCount: number;
  targetLanguage: string;
  sourceLanguage: string;
  isPublished: boolean;
  downloadCount: number;
  rating: number;
  tags: string[];
  type: 'full' | 'partial' | 'mod';
  compatibility: string;
  requirements: string[];
}

interface GameInfo {
  id: string;
  title: string;
  path: string;
  isInstalled: boolean;
}

interface PatchExportProgress {
  isExporting: boolean;
  stage: string;
  progress: number;
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

  // Form state per creazione patch
  const [newPatch, setNewPatch] = useState({
    name: '',
    description: '',
    gameId: '',
    targetLanguage: 'it',
    sourceLanguage: 'en',
    type: 'full' as const,
    tags: [] as string[],
    compatibility: '',
    requirements: [] as string[]
  });

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
    try {
      const response = await fetch('/api/games');
      if (response.ok) {
        const data = await response.json();
        setGames(data);
      }
    } catch (error) {
      console.error('Errore nel caricamento dei giochi:', error);
    }
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

      toast({
        title: 'Export completato',
        description: 'La patch è stata esportata con successo'
      });
    } catch (error) {
      console.error('Errore durante l\'export:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile esportare la patch',
        variant: 'destructive'
      });
    } finally {
      setExportProgress({ isExporting: false, stage: '', progress: 0 });
    }
  };

  const createPatch = async () => {
    try {
      if (!newPatch.name || !newPatch.gameId) {
        toast({
          title: 'Errore',
          description: 'Compila tutti i campi obbligatori',
          variant: 'destructive'
        });
        return;
      }

      const response = await fetch('/api/patches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPatch,
          version: '1.0.0',
          author: 'Current User', // TODO: Get from auth
          isPublished: false,
          downloadCount: 0,
          rating: 0,
          size: 0,
          filesCount: 0,
          translationsCount: 0
        })
      });

      if (!response.ok) {
        throw new Error('Errore nella creazione');
      }

      const createdPatch = await response.json();
      setPatches([...patches, createdPatch]);
      
      // Reset form
      setNewPatch({
        name: '',
        description: '',
        gameId: '',
        targetLanguage: 'it',
        sourceLanguage: 'en',
        type: 'full',
        tags: [],
        compatibility: '',
        requirements: []
      });

      toast({
        title: 'Patch creata',
        description: 'La patch è stata creata con successo'
      });
    } catch (error) {
      console.error('Errore nella creazione della patch:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile creare la patch',
        variant: 'destructive'
      });
    }
  };

  const deletePatch = async (patchId: string) => {
    try {
      const response = await fetch(`/api/patches?id=${patchId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Errore nell\'eliminazione');
      }

      setPatches(patches.filter(p => p.id !== patchId));
      if (selectedPatch?.id === patchId) {
        setSelectedPatch(null);
      }

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

  const getPatchTypeColor = (type: string) => {
    switch (type) {
      case 'full': return 'bg-green-500';
      case 'partial': return 'bg-yellow-500';
      case 'mod': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getGameTitle = (gameId: string) => {
    return games.find(g => g.id === gameId)?.title || 'Gioco sconosciuto';
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
        <Button onClick={loadPatches} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Aggiorna
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca patch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
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

        {/* Tab: Le Mie Patch */}
        <TabsContent value="patches" className="space-y-4">
          {/* Patch Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{patches.length}</p>
                <p className="text-sm text-muted-foreground">Patch Totali</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold">{patches.filter(p => p.isPublished).length}</p>
                <p className="text-sm text-muted-foreground">Pubblicate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                <p className="text-2xl font-bold">{patches.filter(p => !p.isPublished).length}</p>
                <p className="text-sm text-muted-foreground">Bozze</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Download className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold">{patches.reduce((sum, p) => sum + p.downloadCount, 0)}</p>
                <p className="text-sm text-muted-foreground">Download Totali</p>
              </CardContent>
            </Card>
          </div>

          {/* Patch List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredPatches.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Nessuna patch trovata</p>
                <p className="text-sm text-muted-foreground">Crea la tua prima patch nella tab "Crea Nuova"</p>
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
                        <div className="space-y-1">
                          <CardTitle className="text-xl">{patch.name}</CardTitle>
                          <CardDescription>{patch.gameName}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getPatchTypeColor(patch.type)}>
                            {patch.type}
                          </Badge>
                          {patch.isPublished ? (
                            <Badge variant="outline" className="border-green-500 text-green-500">
                              Pubblicata
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                              Bozza
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {patch.description || 'Nessuna descrizione'}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-muted-foreground" />
                          <span>{patch.sourceLanguage} → {patch.targetLanguage}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{patch.translationsCount} traduzioni</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                          <span>{(patch.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Download className="h-4 w-4 text-muted-foreground" />
                          <span>{patch.downloadCount} download</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPatch(patch)}
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Dettagli
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportPatch(patch)}
                          disabled={exportProgress.isExporting}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Esporta
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deletePatch(patch.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Crea Nuova */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Crea Nuova Patch</CardTitle>
              <CardDescription>
                Configura i dettagli della nuova patch di traduzione
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome Patch *</label>
                  <Input
                    placeholder="Es: Traduzione Italiana Completa"
                    value={newPatch.name}
                    onChange={(e) => setNewPatch({ ...newPatch, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Gioco *</label>
                  <Select
                    value={newPatch.gameId}
                    onValueChange={(value) => setNewPatch({ ...newPatch, gameId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un gioco" />
                    </SelectTrigger>
                    <SelectContent>
                      {games.map(game => (
                        <SelectItem key={game.id} value={game.id}>
                          {game.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Descrizione</label>
                <Textarea
                  placeholder="Descrivi la patch..."
                  value={newPatch.description}
                  onChange={(e) => setNewPatch({ ...newPatch, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo</label>
                  <Select
                    value={newPatch.type}
                    onValueChange={(value: any) => setNewPatch({ ...newPatch, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Completa</SelectItem>
                      <SelectItem value="partial">Parziale</SelectItem>
                      <SelectItem value="mod">Mod</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Lingua Origine</label>
                  <Select
                    value={newPatch.sourceLanguage}
                    onValueChange={(value) => setNewPatch({ ...newPatch, sourceLanguage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">Inglese</SelectItem>
                      <SelectItem value="ja">Giapponese</SelectItem>
                      <SelectItem value="de">Tedesco</SelectItem>
                      <SelectItem value="fr">Francese</SelectItem>
                      <SelectItem value="es">Spagnolo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Lingua Target</label>
                  <Select
                    value={newPatch.targetLanguage}
                    onValueChange={(value) => setNewPatch({ ...newPatch, targetLanguage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">Italiano</SelectItem>
                      <SelectItem value="en">Inglese</SelectItem>
                      <SelectItem value="de">Tedesco</SelectItem>
                      <SelectItem value="fr">Francese</SelectItem>
                      <SelectItem value="es">Spagnolo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Compatibilità</label>
                <Input
                  placeholder="Es: v1.0.0 - v1.2.5"
                  value={newPatch.compatibility}
                  onChange={(e) => setNewPatch({ ...newPatch, compatibility: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline">
                  Annulla
                </Button>
                <Button onClick={createPatch}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crea Patch
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Dettagli */}
        <TabsContent value="details" className="space-y-4">
          {selectedPatch ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Dettagli Patch</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPatch(null)}
                    >
                      <ChevronRight className="h-4 w-4 mr-2" />
                      Chiudi
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Info principali */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Gioco</span>
                      <p className="text-lg font-semibold">{selectedPatch.gameName}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Versione</span>
                      <p className="text-lg font-semibold">v{selectedPatch.version}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Autore</span>
                      <p className="text-lg font-semibold">{selectedPatch.author}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Tipo</span>
                      <Badge className={`${getPatchTypeColor(selectedPatch.type)} mt-1`}>
                        {selectedPatch.type}
                      </Badge>
                    </div>
                  </div>

                  {/* Descrizione */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Descrizione</h3>
                    <p className="text-sm">{selectedPatch.description || 'Nessuna descrizione disponibile'}</p>
                  </div>

                  {/* Statistiche */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Statistiche</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedPatch.filesCount} file</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Languages className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedPatch.translationsCount} traduzioni</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{(selectedPatch.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedPatch.downloadCount} download</span>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {selectedPatch.tags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedPatch.tags.map(tag => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
