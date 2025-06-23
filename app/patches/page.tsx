
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Archive, 
  Download, 
  Package, 
  Upload, 
  Settings, 
  FileText,
  Zap,
  Shield,
  Calendar,
  Users,
  HardDrive,
  CheckCircle,
  RefreshCw,
  Play,
  Eye
} from 'lucide-react';
import { motion } from 'framer-motion';
import { mockPatches, mockGames } from '@/lib/mock-data';

interface PatchExportProgress {
  isExporting: boolean;
  stage: string;
  progress: number;
}

export default function PatchesPage() {
  const [patches] = useState(mockPatches);
  const [games] = useState(mockGames);
  const [selectedPatch, setSelectedPatch] = useState<any>(null);
  const [exportProgress, setExportProgress] = useState<PatchExportProgress>({
    isExporting: false,
    stage: '',
    progress: 0
  });

  const [newPatchForm, setNewPatchForm] = useState({
    gameId: '',
    name: '',
    description: '',
    targetLanguage: 'it',
    patchType: 'REPLACEMENT',
    includeBackup: true,
    digitallySigned: false
  });

  const exportPatch = async (patch: any) => {
    setExportProgress({ isExporting: true, stage: 'Preparazione file...', progress: 0 });
    
    const stages = [
      'Raccolta traduzioni...',
      'Creazione archivi...',
      'Generazione installer...',
      'Firma digitale...',
      'Finalizzazione...'
    ];
    
    for (let i = 0; i < stages.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setExportProgress({
        isExporting: true,
        stage: stages[i],
        progress: ((i + 1) / stages.length) * 100
      });
    }
    
    setExportProgress({ isExporting: false, stage: 'Completato!', progress: 100 });
    
    // Simulate download
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = '#';
      link.download = `${patch.name.replace(/\s+/g, '_')}_v${patch.version}.exe`;
      link.click();
    }, 1000);
  };

  const createPatch = async () => {
    // Simulate patch creation
    console.log('Creating patch with:', newPatchForm);
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
    return games.find(g => g.id === gameId)?.title || 'Unknown Game';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestione Patch</h1>
          <p className="text-muted-foreground">Crea, gestisci ed esporta patch di traduzione</p>
        </div>
        
        <Button>
          <Package className="h-4 w-4 mr-2" />
          Nuova Patch
        </Button>
      </div>

      <Tabs defaultValue="patches" className="space-y-4">
        <TabsList>
          <TabsTrigger value="patches">Patch Create</TabsTrigger>
          <TabsTrigger value="create">Crea Nuova</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
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
                  {patches.filter(p => p.isPublished).length}
                </div>
                <div className="text-sm text-muted-foreground">Pubblicate</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-500">
                  {patches.reduce((sum, p) => sum + p.installCount, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Installazioni</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-500">
                  {patches.reduce((sum, p) => sum + p.translationCount, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Traduzioni</div>
              </CardContent>
            </Card>
          </div>

          {/* Patch List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {patches.map((patch, index) => (
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
                        <span>{patch.translationCount.toLocaleString()} traduzioni</span>
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
                      {patch.isPublished && (
                        <Button variant="outline" size="sm">
                          <Play className="h-4 w-4 mr-2" />
                          Testa
                        </Button>
                      )}
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
                  setNewPatchForm(prev => ({ ...prev, patchType: value }))
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

        <TabsContent value="export" className="space-y-4">
          {/* Export Progress */}
          {exportProgress.isExporting && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                    <span>Esportazione in Corso</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{exportProgress.stage}</span>
                      <span>{Math.round(exportProgress.progress)}%</span>
                    </div>
                    <Progress value={exportProgress.progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Export Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Download className="h-5 w-5" />
                <span>Opzioni di Export</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4 text-center">
                    <Package className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <h3 className="font-semibold">Installer EXE</h3>
                    <p className="text-sm text-muted-foreground">Installer autonomo con GUI</p>
                  </CardContent>
                </Card>
                
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4 text-center">
                    <Archive className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <h3 className="font-semibold">Archivio ZIP</h3>
                    <p className="text-sm text-muted-foreground">File compressi per installazione manuale</p>
                  </CardContent>
                </Card>
                
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4 text-center">
                    <Zap className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                    <h3 className="font-semibold">Live Patch</h3>
                    <p className="text-sm text-muted-foreground">Patch runtime per modalità tempo reale</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm">Backup automatico</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm">Compressione aggressiva</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm">Firma digitale</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm">Check integrità</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Export History */}
          <Card>
            <CardHeader>
              <CardTitle>Cronologia Export</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {patches.filter(p => p.filePath).map((patch, index) => (
                  <div key={patch.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-sm font-medium">{patch.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Esportato {new Date(patch.updatedAt).toLocaleDateString('it-IT')} • 
                          {patch.fileSize ? ` ${(patch.fileSize / 1024 / 1024).toFixed(1)} MB` : ''}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
