
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
import InlineTranslator from '@/components/inline-translator';

export default function GameDetailPage() {
  const params = useParams();
  const gameId = params.id as string;
  
  const [game, setGame] = useState<any>(null);
  const [translations, setTranslations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [dlcGames, setDlcGames] = useState<any[]>([]);
  const [showTranslation, setShowTranslation] = useState(false);

  useEffect(() => {
    if (gameId) {
      const fetchGameData = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(`/api/steam/games/${gameId}`);
          if (response.ok) {
            const data = await response.json();
            // Simula dati che non sono ancora nell'API
            // Mantieni i dati esistenti dall'API e aggiungi campi simulati
            data.lastScanned = new Date().toISOString();
            data.detectedFiles = [];
            data.installPath = data.is_installed ? `C:\Program Files (x86)\Steam\steamapps\common\${data.name.replace(/ /g, '')}` : null;
            data.platform = 'Steam';
            data.storeId = data.appid;
            data.title = data.name;
            data.description = data.short_description?.replace(/<[^>]*>?/gm, '') || 'Nessuna descrizione.';
            data.coverUrl = data.header_image || `https://steamcdn-a.akamaihd.net/steam/apps/${data.appid}/library_600x900.jpg`;

            setGame(data);
            // TODO: Caricare le traduzioni reali
            setTranslations(mockTranslations.filter(t => t.gameId === gameId));
            
            // Carica i DLC se presenti
            if (data.dlc && data.dlc.length > 0) {
              const dlcPromises = data.dlc.map(async (dlcId: number) => {
                try {
                  const dlcResponse = await fetch(`https://store.steampowered.com/api/appdetails?appids=${dlcId}&l=it`);
                  const dlcData = await dlcResponse.json();
                  if (dlcData[dlcId]?.success) {
                    return dlcData[dlcId].data;
                  }
                } catch (e) {
                  console.error(`Errore caricamento DLC ${dlcId}:`, e);
                }
                return null;
              });
              
              const dlcResults = await Promise.all(dlcPromises);
              setDlcGames(dlcResults.filter((dlc: any) => dlc !== null));
            }
          } else {
            console.error('Errore nel caricamento del gioco');
          }
        } catch (error) {
          console.error('Errore:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchGameData();
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

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Caricamento dati del gioco...</p>
        </div>
      </div>
    );
  }

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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Cover and Actions - più piccola */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1"
        >
          <Card>
            <CardContent className="p-4">
              <div className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden mb-4 max-w-[200px] mx-auto">
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
                  <Badge variant={game.is_installed ? "default" : "secondary"}>
                    {game.is_installed ? 'Installato' : 'Non Installato'}
                  </Badge>
                  {game.is_free && (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-500">
                      Free to Play
                    </Badge>
                  )}
                </div>
                
                {game.is_installed && (
                  <div className="space-y-2">
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={() => setShowTranslation(true)}
                    >
                      <Languages className="h-4 w-4 mr-2" />
                      Avvia Traduzione
                    </Button>
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
                
                {!game.is_installed && (
                  <Button variant="outline" className="w-full" disabled>
                    <Download className="h-4 w-4 mr-2" />
                    Gioco Non Installato
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Game Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-3 space-y-6"
        >
          {/* Descrizione del gioco */}
          {game.short_description && (
            <Card>
              <CardHeader>
                <CardTitle>Descrizione</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{game.short_description}</p>
              </CardContent>
            </Card>
          )}
          
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
                  
                  {game.developers && game.developers.length > 0 && (
                    <div className="flex items-center space-x-3">
                      <Monitor className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Sviluppatore</p>
                        <p className="text-sm text-muted-foreground">{game.developers.join(', ')}</p>
                      </div>
                    </div>
                  )}
                  
                  {game.publishers && game.publishers.length > 0 && (
                    <div className="flex items-center space-x-3">
                      <Archive className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Publisher</p>
                        <p className="text-sm text-muted-foreground">{game.publishers.join(', ')}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-3">
                    <Monitor className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Piattaforma</p>
                      <p className="text-sm text-muted-foreground">{game.platform}</p>
                    </div>
                  </div>
                  
                  {game.release_date && (
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Data di Rilascio</p>
                        <p className="text-sm text-muted-foreground">
                          {game.release_date.coming_soon ? 'Prossimamente' : game.release_date.date}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <HardDrive className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">File Rilevati</p>
                      <p className="text-sm text-muted-foreground">{game.detectedFiles.length} file</p>
                    </div>
                  </div>
                  
                  {game.is_installed && game.installPath && (
                    <div className="flex items-center space-x-3">
                      <Folder className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Directory</p>
                        <p className="text-xs text-muted-foreground truncate">{game.installPath}</p>
                      </div>
                    </div>
                  )}
                  
                  {game.supported_languages && (
                    <div className="flex items-center space-x-3">
                      <Languages className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Lingue Supportate</p>
                        <p className="text-xs text-muted-foreground">{game.supported_languages.replace(/<[^>]*>?/gm, '').substring(0, 50)}...</p>
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
              
              {/* Categorie */}
              {game.categories && game.categories.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold mb-3">Categorie</h4>
                  <div className="flex flex-wrap gap-2">
                    {game.categories.map((category: any) => (
                      <Badge key={category.id} variant="outline">
                        {category.description}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Generi */}
              {game.genres && game.genres.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-3">Generi</h4>
                  <div className="flex flex-wrap gap-2">
                    {game.genres.map((genre: any) => (
                      <Badge key={genre.id} variant="secondary">
                        {genre.description}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Requisiti di Sistema */}
          {game.pc_requirements && (game.pc_requirements.minimum || game.pc_requirements.recommended) && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Requisiti di Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {game.pc_requirements.minimum && (
                    <div>
                      <h4 className="font-semibold mb-2">Minimi</h4>
                      <div className="text-sm text-muted-foreground prose prose-sm max-w-none" 
                           dangerouslySetInnerHTML={{ __html: game.pc_requirements.minimum }} />
                    </div>
                  )}
                  {game.pc_requirements.recommended && (
                    <div>
                      <h4 className="font-semibold mb-2">Consigliati</h4>
                      <div className="text-sm text-muted-foreground prose prose-sm max-w-none" 
                           dangerouslySetInnerHTML={{ __html: game.pc_requirements.recommended }} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* DLC */}
          {dlcGames.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Contenuti Aggiuntivi (DLC)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {dlcGames.map((dlc) => (
                    <div key={dlc.steam_appid} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      {dlc.header_image && (
                        <img 
                          src={dlc.header_image} 
                          alt={dlc.name}
                          className="w-20 h-10 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{dlc.name}</h4>
                        {dlc.is_free ? (
                          <span className="text-xs text-green-600">Gratuito</span>
                        ) : dlc.price_overview ? (
                          <span className="text-xs text-muted-foreground">
                            {dlc.price_overview.final_formatted}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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
      
      {/* Inline Translator Modal */}
      {showTranslation && game && (
        <InlineTranslator
          gameId={game.appid.toString()}
          gameName={game.name}
          gamePath={game.installPath}
          onClose={() => setShowTranslation(false)}
        />
      )}
    </div>
  );
}
