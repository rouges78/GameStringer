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
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-700 p-3">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative flex items-center gap-3">
            <div className="p-2 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <svg viewBox="0 0 162 162" className="h-7 w-7">
                <circle fill="#10B981" cx="81.4" cy="80.8" r="60.5"/>
                <path fill="#F97316" d="M56.3,88.4l0.7,28.3l-7-5.7c-7.8,12.7-10.3,25-6.6,34.1l1.3,3.2l-3.2-1.4c-7.3-3.2-13.9-7.7-19.4-13.5l-0.3-0.3l-0.1-0.5c-0.4-3.5-0.2-7.3,0.7-11.2l0-0.1c1.3-4.9,3.2-9.8,5.6-14.7c1.5-3.1,3.3-6.2,5.3-9.2l-6.1-5L56.3,88.4z"/>
                <path fill="#F97316" d="M105.9,74.1l-0.7-28.3l7,5.7c7.8-12.7,10.3-25,6.6-34.1l-1.3-3.2l3.2,1.4c7.3,3.2,13.9,7.7,19.4,13.5l0.3,0.3l0.1,0.5c0.4,3.5,0.2,7.3-0.7,11.2l0,0.1c-1.3,4.9-3.2,9.8-5.6,14.7c-1.5,3.1-3.3,6.2-5.3,9.2l6.1,5L105.9,74.1z"/>
                <path fill="#F97316" d="M88.5,105.4l28.3-0.7l-5.7,7c12.7,7.8,25,10.3,34.1,6.6l3.2-1.3l-1.4,3.2c-3.2,7.3-7.7,13.9-13.5,19.4l-0.3,0.3l-0.5,0.1c-3.5,0.4-7.3,0.2-11.2-0.7l-0.1,0c-4.9-1.3-9.8-3.2-14.7-5.6c-3.1-1.5-6.2-3.3-9.2-5.3l-5,6.1L88.5,105.4z"/>
                <path fill="#F97316" d="M74.1,57.6l-28.3,0.7l5.7-7c-12.7-7.8-25-10.3-34.1-6.6L14.3,46l1.4-3.2c3.2-7.3,7.7-13.9,13.5-19.4l0.3-0.3L30,23c3.5-0.4,7.3-0.2,11.2,0.7l0.1,0c4.9,1.3,9.8,3.2,14.7,5.6c3.1,1.5,6.2,3.3,9.2,5.3l5-6.1L74.1,57.6z"/>
                <path fill="white" d="M59.3,59.5c-3.5-1.6-6.1-3.2-8.7-5.1c-4-2.8-7.7-5.9-10.8-9.2c-7.6-7.7-11.6-15.6-10.5-22.1L27,25.6c-5.5,5.8-12.8,16-12.9,20.4c0.1,0.5,0.1,0.5,0.1,0.5c1,3.4,2.6,6.8,4.9,10.1l0,0.1c3,4.8,8.9,12.7,29.9,21.9l-3.7,7l28.3-7.6L63.5,51.5L59.3,59.5z"/>
                <path fill="white" d="M103.3,103.5c3.5,1.6,6.1,3.2,8.7,5.1c4,2.8,7.7,5.9,10.8,9.2c7.6,7.7,11.6,15.6,10.5,22.1l2.3-2.4c5.5-5.8,12.8-16,12.9-20.4c-0.1-0.5-0.1-0.5-0.1-0.5c-1-3.4-2.6-6.8-4.9-10.1l0-0.1c-3-4.8-8.9-12.7-29.9-21.9l3.7-7l-28.3,7.6l10.2,26.2L103.3,103.5z"/>
                <path fill="white" d="M104,59.3c1.6-3.5,3.2-6.1,5.1-8.7c2.8-4,5.9-7.7,9.2-10.8c7.7-7.6,15.6-11.6,22.1-10.5L138,27c-5.8-5.5-16-12.8-20.4-12.9c-0.5,0.1-0.5,0.1-0.5,0.1c-3.4,1-6.8,2.6-10.1,4.9l-0.1,0c-4.8,3-12.7,8.9-21.9,29.9l-7-3.7l7.6,28.3L112,63.6L104,59.3z"/>
                <path fill="white" d="M58.2,103.2c-1.6,3.5-3.2,6.1-5.1,8.7c-2.8,4-5.9,7.7-9.2,10.8c-7.7,7.6-15.6,11.6-22.1,10.5l2.4,2.3c5.8,5.5,16,12.8,20.4,12.9c0.5-0.1,0.5-0.1,0.5-0.1c3.4-1,6.8-2.6,10.1-4.9l0.1,0c4.8-3,12.7-8.9,21.9-29.9l7,3.7l-7.6-28.3L50.3,98.9L58.2,103.2z"/>
              </svg>
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
            <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
              <Key className="h-8 w-8 text-emerald-500" />
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
              className="w-full bg-emerald-600 hover:bg-emerald-500"
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
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-700 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <svg viewBox="0 0 162 162" className="h-7 w-7">
                <circle fill="#10B981" cx="81.4" cy="80.8" r="60.5"/>
                <path fill="#F97316" d="M56.3,88.4l0.7,28.3l-7-5.7c-7.8,12.7-10.3,25-6.6,34.1l1.3,3.2l-3.2-1.4c-7.3-3.2-13.9-7.7-19.4-13.5l-0.3-0.3l-0.1-0.5c-0.4-3.5-0.2-7.3,0.7-11.2l0-0.1c1.3-4.9,3.2-9.8,5.6-14.7c1.5-3.1,3.3-6.2,5.3-9.2l-6.1-5L56.3,88.4z"/>
                <path fill="#F97316" d="M105.9,74.1l-0.7-28.3l7,5.7c7.8-12.7,10.3-25,6.6-34.1l-1.3-3.2l3.2,1.4c7.3,3.2,13.9,7.7,19.4,13.5l0.3,0.3l0.1,0.5c0.4,3.5,0.2,7.3-0.7,11.2l0,0.1c-1.3,4.9-3.2,9.8-5.6,14.7c-1.5,3.1-3.3,6.2-5.3,9.2l6.1,5L105.9,74.1z"/>
                <path fill="#F97316" d="M88.5,105.4l28.3-0.7l-5.7,7c12.7,7.8,25,10.3,34.1,6.6l3.2-1.3l-1.4,3.2c-3.2,7.3-7.7,13.9-13.5,19.4l-0.3,0.3l-0.5,0.1c-3.5,0.4-7.3,0.2-11.2-0.7l-0.1,0c-4.9-1.3-9.8-3.2-14.7-5.6c-3.1-1.5-6.2-3.3-9.2-5.3l-5,6.1L88.5,105.4z"/>
                <path fill="#F97316" d="M74.1,57.6l-28.3,0.7l5.7-7c-12.7-7.8-25-10.3-34.1-6.6L14.3,46l1.4-3.2c3.2-7.3,7.7-13.9,13.5-19.4l0.3-0.3L30,23c3.5-0.4,7.3-0.2,11.2,0.7l0.1,0c4.9,1.3,9.8,3.2,14.7,5.6c3.1,1.5,6.2,3.3,9.2,5.3l5-6.1L74.1,57.6z"/>
                <path fill="white" d="M59.3,59.5c-3.5-1.6-6.1-3.2-8.7-5.1c-4-2.8-7.7-5.9-10.8-9.2c-7.6-7.7-11.6-15.6-10.5-22.1L27,25.6c-5.5,5.8-12.8,16-12.9,20.4c0.1,0.5,0.1,0.5,0.1,0.5c1,3.4,2.6,6.8,4.9,10.1l0,0.1c3,4.8,8.9,12.7,29.9,21.9l-3.7,7l28.3-7.6L63.5,51.5L59.3,59.5z"/>
                <path fill="white" d="M103.3,103.5c3.5,1.6,6.1,3.2,8.7,5.1c4,2.8,7.7,5.9,10.8,9.2c7.6,7.7,11.6,15.6,10.5,22.1l2.3-2.4c5.5-5.8,12.8-16,12.9-20.4c-0.1-0.5-0.1-0.5-0.1-0.5c-1-3.4-2.6-6.8-4.9-10.1l0-0.1c-3-4.8-8.9-12.7-29.9-21.9l3.7-7l-28.3,7.6l10.2,26.2L103.3,103.5z"/>
                <path fill="white" d="M104,59.3c1.6-3.5,3.2-6.1,5.1-8.7c2.8-4,5.9-7.7,9.2-10.8c7.7-7.6,15.6-11.6,22.1-10.5L138,27c-5.8-5.5-16-12.8-20.4-12.9c-0.5,0.1-0.5,0.1-0.5,0.1c-3.4,1-6.8,2.6-10.1,4.9l-0.1,0c-4.8,3-12.7,8.9-21.9,29.9l-7-3.7l7.6,28.3L112,63.6L104,59.3z"/>
                <path fill="white" d="M58.2,103.2c-1.6,3.5-3.2,6.1-5.1,8.7c-2.8,4-5.9,7.7-9.2,10.8c-7.7,7.6-15.6,11.6-22.1,10.5l2.4,2.3c5.8,5.5,16,12.8,20.4,12.9c0.5-0.1,0.5-0.1,0.5-0.1c3.4-1,6.8-2.6,10.1-4.9l0.1,0c4.8-3,12.7-8.9,21.9-29.9l7,3.7l-7.6-28.3L50.3,98.9L58.2,103.2z"/>
              </svg>
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
          
          <div className="hidden md:flex items-center gap-2">
            {userInfo && (
              <>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-sm font-bold text-white">{userInfo.name}</span>
                </div>
                {userInfo.is_premium && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
                    <Star className="h-3.5 w-3.5 text-yellow-400" />
                    <span className="text-sm font-bold text-white">Premium</span>
                  </div>
                )}
              </>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="h-8 text-xs bg-black/30 text-white hover:bg-black/40 border-white/10"
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



