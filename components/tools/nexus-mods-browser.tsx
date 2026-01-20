'use client';

import { useState, useEffect } from 'react';
import {
  Download,
  Search,
  ExternalLink,
  Key,
  CheckCircle,
  XCircle,
  Star,
  Users,
  Clock,
  FileText,
  RefreshCw,
  Settings,
  Globe,
  Shield,
  Gamepad2,
  Filter,
  Eye,
  Heart,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  nexusModsService,
  type NexusMod,
  type NexusModFile,
  type NexusUserValidation,
  type TranslationModResult
} from '@/lib/nexus-mods-service';

export function NexusModsBrowser() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [userInfo, setUserInfo] = useState<NexusUserValidation | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TranslationModResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMod, setSelectedMod] = useState<TranslationModResult | null>(null);
  const [modFiles, setModFiles] = useState<NexusModFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [showModDetails, setShowModDetails] = useState(false);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularGames] = useState([
    { name: 'Skyrim Special Edition', domain: 'skyrimspecialedition' },
    { name: 'Baldur\'s Gate 3', domain: 'baldursgate3' },
    { name: 'Cyberpunk 2077', domain: 'cyberpunk2077' },
    { name: 'Elden Ring', domain: 'eldenring' },
    { name: 'Starfield', domain: 'starfield' },
    { name: 'The Witcher 3', domain: 'witcher3' },
    { name: 'Fallout 4', domain: 'fallout4' },
    { name: 'Stardew Valley', domain: 'stardewvalley' },
  ]);

  useEffect(() => {
    checkConfiguration();
    loadRecentSearches();
  }, []);

  const checkConfiguration = async () => {
    if (nexusModsService.hasApiKey()) {
      setIsConfigured(true);
      try {
        const info = await nexusModsService.validateApiKey();
        setUserInfo(info);
      } catch {
        setIsConfigured(false);
      }
    }
  };

  const loadRecentSearches = () => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('nexus_recent_searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  };

  const saveRecentSearch = (query: string) => {
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 10);
    setRecentSearches(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexus_recent_searches', JSON.stringify(updated));
    }
  };

  const handleValidateApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Enter an API key');
      return;
    }

    setIsValidating(true);
    try {
      nexusModsService.setApiKey(apiKey.trim());
      const info = await nexusModsService.validateApiKey();
      setUserInfo(info);
      setIsConfigured(true);
      setShowApiKeyDialog(false);
      toast.success(`Welcome, ${info.name}!`);
    } catch (error: any) {
      toast.error(error.message || 'Invalid API key');
      nexusModsService.clearApiKey();
    } finally {
      setIsValidating(false);
    }
  };

  const handleLogout = () => {
    nexusModsService.clearApiKey();
    setIsConfigured(false);
    setUserInfo(null);
    setSearchResults([]);
    toast.success('Disconnected from Nexus Mods');
  };

  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) {
      toast.error('Enter a game name');
      return;
    }

    setIsSearching(true);
    setSearchResults([]);

    try {
      const results = await nexusModsService.findTranslationsForGame(searchTerm);
      setSearchResults(results);
      saveRecentSearch(searchTerm);

      if (results.length === 0) {
        toast.info('No Italian translations found for this game');
      } else {
        toast.success(`Found ${results.length} translations`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Search error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleViewMod = async (result: TranslationModResult) => {
    setSelectedMod(result);
    setShowModDetails(true);
    setIsLoadingFiles(true);

    try {
      const filesData = await nexusModsService.getModFiles(result.gameId, result.mod.mod_id);
      setModFiles(filesData.files || []);
    } catch (error) {
      console.error('Error loading mod files:', error);
      setModFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const openModPage = (result: TranslationModResult) => {
    const url = nexusModsService.getModPageUrl(result.gameId, result.mod.mod_id);
    window.open(url, '_blank');
  };

  const openDownloadPage = (fileId: number) => {
    if (!selectedMod) return;
    const url = nexusModsService.getManualDownloadUrl(
      selectedMod.gameId,
      selectedMod.mod.mod_id,
      fileId
    );
    window.open(url, '_blank');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatSize = (kb: number) => {
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  if (!isConfigured) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="h-7 w-7 text-orange-500" />
              Nexus Mods Integration
            </h1>
            <p className="text-muted-foreground">
              Search and download translation patches from Nexus Mods
            </p>
          </div>
        </div>

        <Card className="max-w-xl mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-4">
              <Key className="h-8 w-8 text-orange-500" />
            </div>
            <CardTitle>Configure Nexus Mods</CardTitle>
            <CardDescription>
              To search translations on Nexus Mods, you need a free API key
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Get your free API key from{' '}
                <a
                  href="https://www.nexusmods.com/users/myaccount?tab=api+access"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  nexusmods.com/users/myaccount
                </a>
                {' '}(tab "API Access")
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your API key..."
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={handleValidateApiKey}
              disabled={isValidating || !apiKey.trim()}
            >
              {isValidating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Connect to Nexus Mods
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-7 w-7 text-orange-500" />
            Nexus Mods Integration
          </h1>
          <p className="text-muted-foreground">
            Search and download Italian translation patches
          </p>
        </div>
        <div className="flex items-center gap-2">
          {userInfo && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">{userInfo.name}</span>
              {userInfo.is_premium && (
                <Badge className="bg-yellow-500 text-xs">Premium</Badge>
              )}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Disconnect
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search translations by game name (e.g. Skyrim, Baldur's Gate 3)..."
                className="pl-10"
              />
            </div>
            <Button onClick={() => handleSearch()} disabled={isSearching}>
              {isSearching ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search">Search Results</TabsTrigger>
          <TabsTrigger value="popular">Popular Games</TabsTrigger>
          <TabsTrigger value="recent">Recent Searches</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
          {searchResults.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">Search translations</p>
                <p className="text-muted-foreground">
                  Enter a game name to find Italian translation patches
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((result) => (
                <Card key={result.mod.mod_id} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    {result.mod.picture_url && (
                      <img
                        src={result.mod.picture_url}
                        alt={result.mod.name}
                        className="w-full h-32 object-cover rounded-lg mb-2"
                      />
                    )}
                    <CardTitle className="text-base line-clamp-2">{result.mod.name}</CardTitle>
                    <CardDescription className="text-xs">
                      by {result.mod.author}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {result.mod.summary}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {result.mod.downloads?.toLocaleString() || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {result.mod.endorsement_count?.toLocaleString() || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(result.mod.updated_timestamp)}
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleViewMod(result)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => openModPage(result)}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Nexus
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="popular" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {popularGames.map((game) => (
              <Card
                key={game.domain}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  setSearchQuery(game.name);
                  handleSearch(game.name);
                }}
              >
                <CardContent className="p-4 text-center">
                  <Gamepad2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-medium text-sm">{game.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recent" className="mt-4">
          {recentSearches.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No recent searches</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {recentSearches.map((search, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    setSearchQuery(search);
                    handleSearch(search);
                  }}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {search}
                </Button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Mod Details Dialog */}
      <Dialog open={showModDetails} onOpenChange={setShowModDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedMod && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedMod.mod.name}</DialogTitle>
                <DialogDescription>
                  by {selectedMod.mod.author} • v{selectedMod.mod.version}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {selectedMod.mod.picture_url && (
                  <img
                    src={selectedMod.mod.picture_url}
                    alt={selectedMod.mod.name}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                )}

                <p className="text-sm text-muted-foreground">
                  {selectedMod.mod.summary}
                </p>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <Download className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-lg font-bold">{selectedMod.mod.downloads?.toLocaleString() || 0}</p>
                    <p className="text-xs text-muted-foreground">Download</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <Heart className="h-5 w-5 mx-auto mb-1 text-red-500" />
                    <p className="text-lg font-bold">{selectedMod.mod.endorsement_count?.toLocaleString() || 0}</p>
                    <p className="text-xs text-muted-foreground">Endorsement</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <p className="text-lg font-bold">{formatDate(selectedMod.mod.updated_timestamp)}</p>
                    <p className="text-xs text-muted-foreground">Updated</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Available Files
                  </h4>
                  {isLoadingFiles ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : modFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No files available
                    </p>
                  ) : (
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {modFiles.map((file) => (
                          <div
                            key={file.file_id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{file.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>v{file.version}</span>
                                <span>•</span>
                                <span>{formatSize(file.size_kb)}</span>
                                <span>•</span>
                                <span>{file.uploaded_time}</span>
                              </div>
                              {file.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {file.description}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => openDownloadPage(file.file_id)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowModDetails(false)}>
                  Close
                </Button>
                <Button onClick={() => openModPage(selectedMod)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open on Nexus Mods
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default NexusModsBrowser;



