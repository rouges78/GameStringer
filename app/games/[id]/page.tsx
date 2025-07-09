
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
  Eye,
  Globe
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
  const [steamDetails, setSteamDetails] = useState<any>(null);

  useEffect(() => {
    if (gameId) {
      const fetchGameData = async () => {
        setIsLoading(true);
        try {
          // Carica dati base del gioco da Tauri
          const response = await fetch(`/api/steam/games/${gameId}`);
          
          // Carica dettagli estesi da Steam API
          let steamApiData = null;
          try {
            const steamResponse = await fetch(`https://store.steampowered.com/api/appdetails?appids=${gameId}&l=it&cc=IT`);
            const steamJson = await steamResponse.json();
            if (steamJson[gameId]?.success) {
              steamApiData = steamJson[gameId].data;
            }
          } catch (error) {
            console.warn('Impossibile caricare dettagli Steam API:', error);
          }
          
          if (response.ok) {
            const data = await response.json();
            
            // Combina dati base con dettagli Steam API
            const enhancedGame = {
              ...data,
              ...steamApiData,
              // Mantieni campi essenziali dal backend
              lastScanned: new Date().toISOString(),
              detectedFiles: [],
              installPath: data.is_installed ? `C:\\Program Files (x86)\\Steam\\steamapps\\common\\${data.name.replace(/ /g, '')}` : null,
              platform: 'Steam',
              storeId: data.appid,
              title: steamApiData?.name || data.name,
              description: steamApiData?.short_description?.replace(/<[^>]*>?/gm, '') || data.short_description || 'Nessuna descrizione disponibile.',
              detailedDescription: steamApiData?.detailed_description?.replace(/<[^>]*>?/gm, '') || null,
              aboutGame: steamApiData?.about_the_game?.replace(/<[^>]*>?/gm, '') || null,
              coverUrl: steamApiData?.header_image || data.header_image || `https://steamcdn-a.akamaihd.net/steam/apps/${data.appid}/library_600x900.jpg`,
              screenshots: steamApiData?.screenshots || [],
              movies: steamApiData?.movies || [],
              metacritic: steamApiData?.metacritic || null,
              achievements: steamApiData?.achievements || null,
              background: steamApiData?.background || null,
              website: steamApiData?.website || null,
              legal_notice: steamApiData?.legal_notice || null,
              recommendations: steamApiData?.recommendations || null
            };

            setGame(enhancedGame);
            setSteamDetails(steamApiData);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900">
      {/* Hero Background */}
      {game.background && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url(${game.background})` }}
        />
      )}
      
      <div className="relative z-10 p-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center space-x-4"
        >
          <Link href="/library">
            <Button variant="outline" size="icon" className="bg-black/20 backdrop-blur-sm border-white/20">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              {game.title}
            </h1>
            {game.developers && (
              <p className="text-lg text-gray-300 mt-1">
                di {game.developers.join(', ')}
              </p>
            )}
            <p className="text-gray-400 mt-2 max-w-3xl">{game.description}</p>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center space-x-3">
            {game.metacritic && (
              <div className="text-center">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm ${
                  game.metacritic.score >= 80 ? 'bg-green-600' : 
                  game.metacritic.score >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                }`}>
                  {game.metacritic.score}
                </div>
                <p className="text-xs text-gray-400 mt-1">Metacritic</p>
              </div>
            )}
            
            {game.recommendations && (
              <div className="text-center">
                <div className="text-blue-400 font-bold">
                  {game.recommendations.total.toLocaleString()}
                </div>
                <p className="text-xs text-gray-400">👍 Raccomandazioni</p>
              </div>
            )}
          </div>
        </motion.div>

      {/* Game Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Cover and Actions */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1"
        >
          <Card className="bg-black/20 backdrop-blur-xl border-white/10 shadow-2xl">
            <CardContent className="p-6">
              <div className="relative aspect-[3/4] bg-muted rounded-xl overflow-hidden mb-6 shadow-lg">
                <Image
                  src={game.coverUrl}
                  alt={game.title}
                  fill
                  className="object-cover"
                />
                {game.is_vr && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-purple-600/90 text-white">
                      🥽 VR
                    </Badge>
                  </div>
                )}
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
          {/* Screenshots Gallery */}
          {game.screenshots && game.screenshots.length > 0 && (
            <Card className="bg-black/20 backdrop-blur-xl border-white/10">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {game.screenshots.slice(0, 6).map((screenshot: any, index: number) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * index }}
                      className="relative aspect-video bg-muted rounded-lg overflow-hidden group cursor-pointer"
                    >
                      <Image
                        src={screenshot.path_thumbnail}
                        alt={`Screenshot ${index + 1}`}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye className="h-6 w-6 text-white" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Descrizione dettagliata */}
          {(game.detailedDescription || game.aboutGame) && (
            <Card className="bg-black/20 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Trama e Descrizione</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-gray prose-invert max-w-none">
                  <p className="text-gray-300 leading-relaxed">
                    {game.detailedDescription || game.aboutGame}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card className="bg-black/20 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Informazioni Gioco</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Settings className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-white">Motore</p>
                      <p className="text-sm text-gray-300">{game.engine || 'Non rilevato'}</p>
                    </div>
                  </div>
                  
                  {game.developers && game.developers.length > 0 && (
                    <div className="flex items-center space-x-3">
                      <Monitor className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Sviluppatore</p>
                        <p className="text-sm text-gray-300">{game.developers.join(', ')}</p>
                      </div>
                    </div>
                  )}
                  
                  {game.publishers && game.publishers.length > 0 && (
                    <div className="flex items-center space-x-3">
                      <Archive className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Publisher</p>
                        <p className="text-sm text-gray-300">{game.publishers.join(', ')}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-3">
                    <Monitor className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-white">Piattaforma</p>
                      <p className="text-sm text-gray-300">{game.platform}</p>
                    </div>
                  </div>
                  
                  {game.release_date && (
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Data di Rilascio</p>
                        <p className="text-sm text-gray-300">
                          {game.release_date.coming_soon ? 'Prossimamente' : game.release_date.date}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <HardDrive className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-white">File Rilevati</p>
                      <p className="text-sm text-gray-300">{game.detectedFiles.length} file</p>
                    </div>
                  </div>
                  
                  {game.is_installed && game.installPath && (
                    <div className="flex items-center space-x-3">
                      <Folder className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Directory</p>
                        <p className="text-xs text-gray-300 truncate">{game.installPath}</p>
                      </div>
                    </div>
                  )}
                  
                  {game.supported_languages && (
                    <div className="flex items-center space-x-3">
                      <Languages className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Lingue Supportate</p>
                        <p className="text-xs text-gray-300">{game.supported_languages.replace(/<[^>]*>?/gm, '').substring(0, 50)}...</p>
                      </div>
                    </div>
                  )}
                  
                  {game.storeId && (
                    <div className="flex items-center space-x-3">
                      <Archive className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-white">ID Store</p>
                        <p className="text-sm text-gray-300">{game.storeId}</p>
                      </div>
                    </div>
                  )}
                  
                  {game.website && (
                    <div className="flex items-center space-x-3">
                      <Globe className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Sito Web</p>
                        <a href={game.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 truncate">
                          {game.website}
                        </a>
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
            <Card className="mt-6 bg-black/20 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Requisiti di Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {game.pc_requirements.minimum && (
                    <div>
                      <h4 className="font-semibold mb-2 text-white">Minimi</h4>
                      <div className="text-sm text-gray-300 prose prose-sm max-w-none prose-invert" 
                           dangerouslySetInnerHTML={{ __html: game.pc_requirements.minimum }} />
                    </div>
                  )}
                  {game.pc_requirements.recommended && (
                    <div>
                      <h4 className="font-semibold mb-2 text-white">Consigliati</h4>
                      <div className="text-sm text-gray-300 prose prose-sm max-w-none prose-invert" 
                           dangerouslySetInnerHTML={{ __html: game.pc_requirements.recommended }} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* DLC */}
          {dlcGames.length > 0 && (
            <Card className="bg-black/20 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Contenuti Aggiuntivi (DLC)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {dlcGames.map((dlc) => (
                    <div key={dlc.steam_appid} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                      {dlc.header_image && (
                        <img 
                          src={dlc.header_image} 
                          alt={dlc.name}
                          className="w-20 h-10 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-white">{dlc.name}</h4>
                        {dlc.is_free ? (
                          <span className="text-xs text-green-400">Gratuito</span>
                        ) : dlc.price_overview ? (
                          <span className="text-xs text-gray-300">
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
          <TabsList className="bg-black/20 backdrop-blur-xl border-white/10">
            <TabsTrigger value="files" className="data-[state=active]:bg-white/20 data-[state=active]:text-white">File Rilevati</TabsTrigger>
            <TabsTrigger value="translations" className="data-[state=active]:bg-white/20 data-[state=active]:text-white">Traduzioni</TabsTrigger>
            <TabsTrigger value="patches" className="data-[state=active]:bg-white/20 data-[state=active]:text-white">Patch</TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="space-y-4">
            <Card className="bg-black/20 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-white">File di Testo Rilevati</CardTitle>
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
            <Card className="bg-black/20 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Traduzioni Attive</CardTitle>
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
            <Card className="bg-black/20 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Patch Generate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-white">Nessuna patch creata</h3>
                  <p className="text-gray-300 mb-4">
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
    </div>
  );
}
