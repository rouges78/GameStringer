'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Download, 
  Upload, 
  Languages, 
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Play,
  FileCode
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface GameDialoguePatch {
  gameId: string;
  gameName: string;
  sourceFile: string;
  targetLanguage: string;
  version: string;
  translations: Record<string, string>;
  metadata: {
    createdAt: string;
    updatedAt: string;
    translatedCount: number;
    author: string;
    description: string;
  };
}

export default function DialoguePatcherPage() {
  const [patches, setPatches] = useState<GameDialoguePatch[]>([]);
  const [selectedPatch, setSelectedPatch] = useState<GameDialoguePatch | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    loadPatches();
  }, []);

  const loadPatches = async () => {
    try {
      // Carica la patch di Decarnation
      const decarnationPatch: GameDialoguePatch = {
        gameId: "decarnation",
        gameName: "Decarnation",
        sourceFile: "dialogues-resources.assets-52.txt",
        targetLanguage: "it",
        version: "1.0.0",
        translations: {
          "You're twenty-nine, right?": "Hai ventinove anni, giusto?",
          "Right!": "Esatto!",
          "I just wanted to say... I'm really excited to be here. To experience this.": "Volevo solo dirti... Sono davvero entusiasta di essere qui. Di vivere questa esperienza.",
          "Let's say we were lucky...": "Diciamo che siamo stati fortunati...",
          "Lucky?": "Fortunati?",
          "...That I found you in time, in your cabaret.": "...Che ti ho trovata in tempo, nel tuo cabaret.",
          "Before everything falls apart.": "Prima che tutto crolli.",
          "Falls... apart?": "Che tutto... crolli?",
          "The other day I came across the first girl to pose for me...": "L'altro giorno ho incontrato la prima ragazza che ha posato per me...",
          "We weren't even twenty at that time.": "Non avevamo nemmeno vent'anni all'epoca.",
          "Ah, Fannette. As bright as the sun. A Botticelli come to life, you know?": "Ah, Fannette. Luminosa come il sole. Un Botticelli vivente, capisci?",
          "And now... look what's left.": "E ora... guarda cosa ne resta.",
          "A decrepit troll in clown's makeup.": "Un vecchio troll truccato da clown.",
          "I'd like to take a break...": "Vorrei fare una pausa...",
          "Covered in cheap trinkets, clutching a little dog to divert the eye.": "Coperta di gingilli da quattro soldi, che si aggrappa a un cagnolino per distogliere lo sguardo.",
          "It makes me sick.": "Mi fa stare male.",
          "Yes? Who is it?": "Sì? Chi è?",
          "Seriously? It's Joy!": "Sul serio? Sono Joy!",
          "Well, hello, cupcake.": "Ciao, dolcezza.",
          "Nervous? Think it'll be crowded?": "Nervosa? Pensi che ci sarà molta gente?",
          "Joy, I didn't get off work until two in the morning. Go easy on me with the questions, okay?": "Joy, ho finito di lavorare alle due di notte. Vacci piano con le domande, ok?",
          "Oops. Sorry!": "Ops. Scusa!",
          "But yeah, I'm slightly anxious. Mostly curious to see what it looks like.": "Ma sì, sono un po' ansiosa. Soprattutto curiosa di vedere come sarà.",
          "Well, I imagine a statue of you will look...": "Beh, immagino che una statua di te sembrerà...",
          "...like you, probably!": "...come te, probabilmente!",
          "You know what I mean. What will it say about me?": "Sai cosa intendo. Cosa dirà di me?",
          "What will people see in her?": "Cosa vedranno le persone in lei?",
          "And... will it make college girls weak in the knees?": "E... farà sciogliere le studentesse universitarie?",
          "I don't know why I bother...": "Non so perché mi ostino...",
          "Sure you do! Come on, get ready so we can go. I'll wait outside.": "Certo che lo sai! Dai, preparati così possiamo andare. Ti aspetto fuori.",
          "I hope she likes it.": "Spero che le piaccia.",
          "Here's the little blue box for Joy.": "Ecco la scatolina blu per Joy.",
          "Oh, I almost forgot the little blue box for Joy.": "Oh, stavo quasi dimenticando la scatolina blu per Joy."
        },
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          translatedCount: 33,
          author: "GameStringer",
          description: "Patch di traduzione italiana per Decarnation - Dialoghi principali"
        }
      };

      setPatches([decarnationPatch]);
      setSelectedPatch(decarnationPatch);
    } catch (error) {
      console.error('Errore caricamento patch:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le patch di traduzione",
        variant: "destructive"
      });
    }
  };

  const applyPatch = async (patch: GameDialoguePatch) => {
    setIsApplying(true);
    try {
      // Simula applicazione patch
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Patch applicata!",
        description: `${patch.metadata.translatedCount} dialoghi tradotti in italiano per ${patch.gameName}`,
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile applicare la patch",
        variant: "destructive"
      });
    } finally {
      setIsApplying(false);
    }
  };

  const exportPatch = (patch: GameDialoguePatch) => {
    const dataStr = JSON.stringify(patch, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${patch.gameId}-${patch.targetLanguage}-patch.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dialogue Patcher</h1>
          <p className="text-muted-foreground">
            Gestisci e applica patch di traduzione per i dialoghi dei giochi
          </p>
        </div>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Importa Patch
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista Patch */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Patch Disponibili
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {patches.map((patch) => (
                  <Card 
                    key={patch.gameId}
                    className={`cursor-pointer transition-colors ${
                      selectedPatch?.gameId === patch.gameId ? 'border-primary' : ''
                    }`}
                    onClick={() => setSelectedPatch(patch)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{patch.gameName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {patch.metadata.translatedCount} traduzioni
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {patch.targetLanguage.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          v{patch.version}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {patch.metadata.author}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Dettagli Patch */}
        {selectedPatch && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedPatch.gameName}</CardTitle>
                  <CardDescription>{selectedPatch.metadata.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportPatch(selectedPatch)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Esporta
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => applyPatch(selectedPatch)}
                    disabled={isApplying}
                  >
                    {isApplying ? (
                      <>Applicazione in corso...</>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Applica Patch
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Panoramica</TabsTrigger>
                  <TabsTrigger value="translations">Traduzioni</TabsTrigger>
                  <TabsTrigger value="instructions">Istruzioni</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Languages className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Lingua Target</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {selectedPatch.targetLanguage === 'it' ? 'Italiano' : selectedPatch.targetLanguage.toUpperCase()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Traduzioni</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {selectedPatch.metadata.translatedCount}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileCode className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">File Sorgente</span>
                      </div>
                      <code className="text-sm bg-muted p-2 rounded block">
                        {selectedPatch.sourceFile}
                      </code>
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progresso Traduzione</span>
                      <span className="text-muted-foreground">
                        {selectedPatch.metadata.translatedCount} dialoghi
                      </span>
                    </div>
                    <Progress value={75} />
                  </div>
                </TabsContent>

                <TabsContent value="translations">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {Object.entries(selectedPatch.translations).map(([en, it], index) => (
                        <Card key={index}>
                          <CardContent className="p-3">
                            <div className="space-y-2">
                              <div>
                                <Badge variant="outline" className="mb-1">EN</Badge>
                                <p className="text-sm">{en}</p>
                              </div>
                              <div>
                                <Badge variant="outline" className="mb-1">IT</Badge>
                                <p className="text-sm font-medium">{it}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="instructions" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Metodo 1: Injection in Memoria</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>Vai alla sezione "Injekt-Translator"</li>
                        <li>Avvia {selectedPatch.gameName}</li>
                        <li>Seleziona il processo del gioco</li>
                        <li>Clicca su "Inizia Injection"</li>
                        <li>Le traduzioni verranno applicate in tempo reale</li>
                      </ol>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Metodo 2: Modifica File</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                          <p className="text-sm">
                            Fai sempre un backup del file originale prima di modificarlo!
                          </p>
                        </div>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>Trova il file {selectedPatch.sourceFile} nella cartella del gioco</li>
                          <li>Crea un backup del file originale</li>
                          <li>Applica la patch usando il pulsante sopra</li>
                          <li>Sostituisci il file originale con quello patchato</li>
                          <li>Avvia il gioco</li>
                        </ol>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
