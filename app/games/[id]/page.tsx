
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Play, 
  Settings, 
  Download, 
  FileText, 
  Archive,
  Calendar,
  HardDrive,
  Monitor,
  Folder,
  Languages,
  Zap,
  Eye
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { mockGames, mockTranslations } from '@/lib/mock-data';

export default function GameDetailPage() {
  const params = useParams();
  const gameId = params.id as string;
  
  const [game, setGame] = useState<any>(null);
  const [translations, setTranslations] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    const foundGame = mockGames.find(g => g.id === gameId);
    if (foundGame) {
      setGame(foundGame);
      setTranslations(mockTranslations.filter(t => t.gameId === gameId));
    }
  }, [gameId]);

  const scanGameFiles = async () => {
    setIsScanning(true);
    setScanProgress(0);
    
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setScanProgress(i);
    }
    
    setIsScanning(false);
    
    // Simula il discovery di nuovi file
    if (game) {
      const newFiles = [
        'localization/text_en.csv',
        'dialog/main_quest.json',
        'ui/interface_strings.txt',
        'subtitles/cutscenes.srt'
      ];
      setGame({ ...game, detectedFiles: [...game.detectedFiles, ...newFiles] });
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'steam': return 'bg-blue-500/10 text-blue-500';
      case 'epic games': return 'bg-gray-500/10 text-gray-500';
      case 'gog': return 'bg-purple-500/10 text-purple-500';
      case 'ea app': return 'bg-orange-500/10 text-orange-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  if (!game) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Link href="/games">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Gioco non trovato</h1>
            <p className="text-muted-foreground">Il gioco richiesto non esiste.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center space-x-4"
      >
        <Link href="/games">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{game.title}</h1>
          <p className="text-muted-foreground">{game.description}</p>
        </div>
      </motion.div>

      {/* Game Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cover and Actions */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden mb-4">
                <Image
                  src={game.coverUrl}
                  alt={game.title}
                  fill
                  className="object-cover"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className={getPlatformColor(game.platform)}>
                    {game.platform}
                  </Badge>
                  <Badge variant={game.isInstalled ? "default" : "secondary"}>
                    {game.isInstalled ? 'Installato' : 'Non Installato'}
                  </Badge>
                </div>
                
                {game.isInstalled && (
                  <div className="space-y-2">
                    <Link href={`/translator?gameId=${game.id}`} className="block">
                      <Button className="w-full">
                        <Languages className="h-4 w-4 mr-2" />
                        Avvia Traduzione
                      </Button>
                    </Link>
                    <Link href={`/realtime?gameId=${game.id}`} className="block">
                      <Button variant="outline" className="w-full">
                        <Zap className="h-4 w-4 mr-2" />
                        Modalità Tempo Reale
                      </Button>
                    </Link>
                    <Button variant="outline" className="w-full" onClick={scanGameFiles} disabled={isScanning}>
                      <FileText className="h-4 w-4 mr-2" />
                      {isScanning ? 'Scansione...' : 'Scansiona File'}
                    </Button>
                  </div>
                )}
                
                {!game.isInstalled && (
                  <Button variant="outline" className="w-full" disabled>
                    <Download className="h-4 w-4 mr-2" />
                    Gioco Non Installato
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Game Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle>Informazioni Gioco</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Motore</p>
                      <p className="text-sm text-muted-foreground">{game.engine || 'Non rilevato'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Monitor className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Piattaforma</p>
                      <p className="text-sm text-muted-foreground">{game.platform}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Ultima Scansione</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(game.lastScanned).toLocaleString('it-IT')}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <HardDrive className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">File Rilevati</p>
                      <p className="text-sm text-muted-foreground">{game.detectedFiles.length} file</p>
                    </div>
                  </div>
                  
                  {game.isInstalled && (
                    <div className="flex items-center space-x-3">
                      <Folder className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Directory</p>
                        <p className="text-xs text-muted-foreground truncate">{game.installPath}</p>
                      </div>
                    </div>
                  )}
                  
                  {game.storeId && (
                    <div className="flex items-center space-x-3">
                      <Archive className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">ID Store</p>
                        <p className="text-sm text-muted-foreground">{game.storeId}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {isScanning && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Scansione file in corso...</span>
                    <span>{scanProgress}%</span>
                  </div>
                  <Progress value={scanProgress} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Tabs defaultValue="files" className="space-y-4">
          <TabsList>
            <TabsTrigger value="files">File Rilevati</TabsTrigger>
            <TabsTrigger value="translations">Traduzioni</TabsTrigger>
            <TabsTrigger value="patches">Patch</TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>File di Testo Rilevati</CardTitle>
              </CardHeader>
              <CardContent>
                {game.detectedFiles.length > 0 ? (
                  <div className="space-y-3">
                    {game.detectedFiles.map((file: string, index: number) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{file}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary">Text</Badge>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            Anteprima
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nessun file rilevato</h3>
                    <p className="text-muted-foreground mb-4">
                      Esegui una scansione per trovare file di testo traducibili.
                    </p>
                    <Button onClick={scanGameFiles} disabled={isScanning}>
                      <FileText className="h-4 w-4 mr-2" />
                      Scansiona File
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="translations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Traduzioni Attive</CardTitle>
              </CardHeader>
              <CardContent>
                {translations.length > 0 ? (
                  <div className="space-y-4">
                    {translations.map((translation, index) => (
                      <motion.div
                        key={translation.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-4 border rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium text-sm">{translation.filePath}</p>
                            <p className="text-xs text-muted-foreground">
                              {translation.sourceLanguage.toUpperCase()} → {translation.targetLanguage.toUpperCase()}
                            </p>
                          </div>
                          <Badge variant={
                            translation.status === 'COMPLETED' ? 'default' :
                            translation.status === 'REVIEWED' ? 'secondary' : 'outline'
                          }>
                            {translation.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground mb-1">Originale:</p>
                            <p className="bg-muted/50 p-2 rounded text-xs">{translation.originalText}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1">Traduzione:</p>
                            <p className="bg-muted/50 p-2 rounded text-xs">{translation.translatedText}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>Confidenza: {Math.round((translation.confidence || 0) * 100)}%</span>
                            {translation.isManualEdit && <Badge variant="outline">Modificato</Badge>}
                          </div>
                          <Button size="sm" variant="outline">
                            <Languages className="h-4 w-4 mr-2" />
                            Modifica
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Languages className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nessuna traduzione</h3>
                    <p className="text-muted-foreground mb-4">
                      Inizia a tradurre i file di questo gioco.
                    </p>
                    <Link href={`/translator?gameId=${game.id}`}>
                      <Button>
                        <Languages className="h-4 w-4 mr-2" />
                        Avvia Traduzione
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patches" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Patch Generate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nessuna patch creata</h3>
                  <p className="text-muted-foreground mb-4">
                    Completa alcune traduzioni per generare patch.
                  </p>
                  <Link href="/patches">
                    <Button>
                      <Archive className="h-4 w-4 mr-2" />
                      Gestisci Patch
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
