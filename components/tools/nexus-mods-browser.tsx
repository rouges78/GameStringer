'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
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
  const { t } = useTranslation();
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
      toast.error(t('nexusMods.enterApiKey'));
      return;
    }

    setIsValidating(true);
    try {
      nexusModsService.setApiKey(apiKey.trim());
      const info = await nexusModsService.validateApiKey();
      setUserInfo(info);
      setIsConfigured(true);
      setShowApiKeyDialog(false);
      toast.success(`${t('nexusMods.welcome')}, ${info.name}!`);
    } catch (error: any) {
      toast.error(error.message || t('nexusMods.invalidApiKey'));
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
    toast.success(t('nexusMods.disconnected'));
  };

  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) {
      toast.error(t('nexusMods.enterApiKey'));
      return;
    }

    setIsSearching(true);
    setSearchResults([]);

    try {
      const results = await nexusModsService.findTranslationsForGame(searchTerm);
      setSearchResults(results);
      saveRecentSearch(searchTerm);

      if (results.length === 0) {
        toast.info(t('nexusMods.noTranslationsFound'));
      } else {
        toast.success(`${results.length} ${t('nexusMods.foundTranslations')}`);
      }
    } catch (error: any) {
      toast.error(error.message || t('nexusMods.searchError'));
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
      <div className="space-y-4">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 p-3">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                {t('nexusMods.title')}
              </h2>
              <p className="text-white/70 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('nexusMods.subtitle')}
              </p>
            </div>
          </div>
        </div>

        <Card className="max-w-xl mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-4">
              <Key className="h-8 w-8 text-orange-500" />
            </div>
            <CardTitle>{t('nexusMods.configure')}</CardTitle>
            <CardDescription>
              {t('nexusMods.configureDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('nexusMods.getApiKey')}{' '}
                <a
                  href="https://www.nexusmods.com/users/myaccount?tab=api+access"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  nexusmods.com/users/myaccount
                </a>
                {' '}{t('nexusMods.apiKeyTab')}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>{t('nexusMods.apiKey')}</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t('nexusMods.pasteApiKey')}
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
                  {t('nexusMods.verifying')}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('nexusMods.connect')}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                {t('nexusMods.title')}
              </h2>
              <p className="text-white/70 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('nexusMods.subtitleSearch')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {userInfo && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                <CheckCircle className="h-4 w-4 text-white" />
                <span className="text-sm font-medium text-white">{userInfo.name}</span>
                {userInfo.is_premium && (
                  <Badge className="bg-yellow-300 text-yellow-900 text-xs">Premium</Badge>
                )}
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="bg-white/20 text-white hover:bg-white/30 border-white/30"
            >
              {t('nexusMods.disconnect')}
            </Button>
          </div>
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
                placeholder={t('nexusMods.searchPlaceholder')}
                className="pl-10"
              />
            </div>
            <Button onClick={() => handleSearch()} disabled={isSearching}>
              {isSearching ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  {t('nexusMods.search')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search">{t('nexusMods.searchResults')}</TabsTrigger>
          <TabsTrigger value="popular">{t('nexusMods.popularGames')}</TabsTrigger>
          <TabsTrigger value="recent">{t('nexusMods.recentSearches')}</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
          {searchResults.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">{t('nexusMods.searchTranslations')}</p>
                <p className="text-muted-foreground">
                  {t('nexusMods.enterGameName')}
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
                      {t('nexusMods.details')}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => openModPage(result)}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      {t('nexusMods.nexus')}
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
                <p className="text-muted-foreground">{t('nexusMods.noRecentSearches')}</p>
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
                    <p className="text-xs text-muted-foreground">{t('nexusMods.downloads')}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <Heart className="h-5 w-5 mx-auto mb-1 text-red-500" />
                    <p className="text-lg font-bold">{selectedMod.mod.endorsement_count?.toLocaleString() || 0}</p>
                    <p className="text-xs text-muted-foreground">{t('nexusMods.endorsements')}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <p className="text-lg font-bold">{formatDate(selectedMod.mod.updated_timestamp)}</p>
                    <p className="text-xs text-muted-foreground">{t('nexusMods.updated')}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('nexusMods.availableFiles')}
                  </h4>
                  {isLoadingFiles ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : modFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('nexusMods.noFilesAvailable')}
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
                              {t('nexusMods.download')}
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
                  {t('nexusMods.close')}
                </Button>
                <Button onClick={() => openModPage(selectedMod)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('nexusMods.openOnNexus')}
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



