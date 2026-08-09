'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus,
  Download,
  Upload,
  Edit,
  Trash2,
  Copy,
  Star,
  Search,
  Globe,
  GamepadIcon,
  Hash,
  CheckCircle,
  FileText
} from 'lucide-react';
import { translationProfileManager, TranslationProfile, TranslationEntry } from '@/lib/game-translation-profiles';
import { useTranslation } from '@/lib/i18n';

interface TranslationProfileManagerProps {
  processName?: string;
  onProfileSelect?: (profile: TranslationProfile) => void;
  selectedProfileId?: string;
}

export function TranslationProfileManager({
  processName, 
  onProfileSelect,
  selectedProfileId 
}: TranslationProfileManagerProps) {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<TranslationProfile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<TranslationProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<TranslationProfile | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TranslationProfile | null>(null);
  const [newTranslation, setNewTranslation] = useState<TranslationEntry>({
    id: '',
    original: '',
    translated: '',
    category: 'general'
  });
  const [statistics, setStatistics] = useState<{
    totalProfiles: number;
    officialProfiles: number;
    totalTranslations: number;
    averageTranslationsPerProfile: number;
    totalGames: number;
    totalLanguages: number;
  } | null>(null);

  // Form state per nuovo profilo
  const [newProfile, setNewProfile] = useState({
    gameName: '',
    processName: processName || '',
    language: 'it',
    description: '',
    tags: ''
  });

  useEffect(() => {
    loadProfiles();
    loadStatistics();
  }, []);

  useEffect(() => {
    filterProfiles();
  }, [profiles, searchQuery, processName]);

  useEffect(() => {
    if (selectedProfileId) {
      const profile = profiles.find(p => p.id === selectedProfileId);
      if (profile) {
        setSelectedProfile(profile);
      }
    }
  }, [selectedProfileId, profiles]);

  const loadProfiles = () => {
    const allProfiles = translationProfileManager.getAllProfiles();
    setProfiles(allProfiles);
  };

  const loadStatistics = () => {
    const stats = translationProfileManager.getStatistics();
    setStatistics(stats);
  };

  const filterProfiles = () => {
    let filtered = [...profiles];

    // Filtra per processo se specificato
    if (processName) {
      filtered = filtered.filter(p => 
        p.processName.toLowerCase() === processName.toLowerCase()
      );
    }

    // Filtra per ricerca
    if (searchQuery) {
      filtered = translationProfileManager.searchProfiles(searchQuery);
    }

    // Sort per rating e data
    filtered.sort((a, b) => {
      const ratingDiff = (b.metadata.rating || 0) - (a.metadata.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime();
    });

    setFilteredProfiles(filtered);
  };

  const handleCreateProfile = () => {
    const profile = {
      gameName: newProfile.gameName,
      processName: newProfile.processName,
      language: newProfile.language,
      translations: [],
      settings: {
        autoDetectContext: true,
        caseSensitive: false,
        wholeWordOnly: true
      }
    };

    const id = translationProfileManager.createProfile(profile);
    if (id) {
      const profile = translationProfileManager.getProfile(id);
      if (profile) {
        translationProfileManager.updateProfile(id, {
          metadata: {
            ...profile.metadata,
            description: newProfile.description,
            tags: newProfile.tags.split(',').map(t => t.trim()).filter(Boolean)
          }
        });
      }
      loadProfiles();
      setIsCreateDialogOpen(false);
      setNewProfile({
        gameName: '',
        processName: processName || '',
        language: 'it',
        description: '',
        tags: ''
      });
    }
  };

  const handleUpdateProfile = () => {
    if (!editingProfile) return;

    translationProfileManager.updateProfile(editingProfile.id, editingProfile);
    loadProfiles();
    setIsEditDialogOpen(false);
    setEditingProfile(null);
  };

  const handleDeleteProfile = async (id: string) => {
    const { confirmDialog } = await import('@/lib/confirm-dialog');
    if (await confirmDialog(t('translationProfileManager.confirmDelete'))) {
      translationProfileManager.deleteProfile(id);
      loadProfiles();
      if (selectedProfile?.id === id) {
        setSelectedProfile(null);
      }
    }
  };

  const handleExportProfile = (profile: TranslationProfile) => {
    const data = translationProfileManager.exportProfile(profile.id);
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${profile.gameName.replace(/\s+/g, '_')}_${profile.language}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImportProfile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const id = translationProfileManager.importProfile(e.target?.result as string);
        if (id) {
          loadProfiles();
          alert(t('translationProfileManager.importSuccess'));
        } else {
          alert(t('translationProfileManager.importError'));
        }
      };
      reader.readAsText(file);
    }
  };

  const handleCloneProfile = (profile: TranslationProfile) => {
    const newId = translationProfileManager.cloneProfile(profile.id);
    if (newId) {
      loadProfiles();
    }
  };

  const handleSelectProfile = (profile: TranslationProfile) => {
    setSelectedProfile(profile);
    if (onProfileSelect) {
      onProfileSelect(profile);
    }
  };

  const handleAddTranslation = () => {
    if (!editingProfile || !newTranslation.original || !newTranslation.translated) return;

    const updatedTranslations = [
      ...editingProfile.translations,
      {
        ...newTranslation,
        id: Date.now().toString()
      }
    ];

    setEditingProfile({
      ...editingProfile,
      translations: updatedTranslations
    });

    setNewTranslation({
      id: '',
      original: '',
      translated: '',
      category: 'general'
    });
  };

  const handleRemoveTranslation = (translationId: string) => {
    if (!editingProfile) return;

    const updatedTranslations = editingProfile.translations.filter(
      t => t.id !== translationId
    );

    setEditingProfile({
      ...editingProfile,
      translations: updatedTranslations
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header con statistiche */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t('translationProfileManager.totalProfiles')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.totalProfiles}</div>
              <p className="text-xs text-muted-foreground">
                {statistics.officialProfiles}  {t('translationProfileManager.officialUnit')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Hash className="w-4 h-4" />
                {t('translationProfileManager.translationsStat')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.totalTranslations}</div>
              <p className="text-xs text-muted-foreground">
                ~{Math.round(statistics.averageTranslationsPerProfile)}  {t('translationProfileManager.perProfile')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GamepadIcon className="w-4 h-4" />
                {t('translationProfileManager.gamesStat')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.totalGames}</div>
              <p className="text-xs text-muted-foreground">
                {t('translationProfileManager.supported')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {t('translationProfileManager.languagesStat')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.totalLanguages}</div>
              <p className="text-xs text-muted-foreground">
                {t('translationProfileManager.available')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              aria-label={t('translationProfileManager.searchAria')} placeholder={t('translationProfileManager.searchPh')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {t('translationProfileManager.newProfile')}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{t('translationProfileManagerComp.createNewProfile')}</DialogTitle>
                <DialogDescription>
                  {t('translationProfileManager.newProfileDesc')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('translationProfileManagerComp.gameName')}</Label>
                  <Input
                    value={newProfile.gameName}
                    onChange={(e) => setNewProfile({ ...newProfile, gameName: e.target.value })}
                    placeholder={t('translationProfileManager.gameNamePh')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('translationProfileManagerComp.processName')}</Label>
                  <Input
                    value={newProfile.processName}
                    onChange={(e) => setNewProfile({ ...newProfile, processName: e.target.value })}
                    placeholder={t('translationProfileManager.exePh')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('translationProfileManagerComp.language')}</Label>
                  <Select
                    value={newProfile.language}
                    onValueChange={(value) => setNewProfile({ ...newProfile, language: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">{t('translationProfileManagerComp.italiano')}</SelectItem>
                      <SelectItem value="es">{t('translationProfileManagerComp.spagnolo')}</SelectItem>
                      <SelectItem value="fr">{t('translationProfileManagerComp.francese')}</SelectItem>
                      <SelectItem value="de">{t('translationProfileManagerComp.tedesco')}</SelectItem>
                      <SelectItem value="pt">{t('translationProfileManagerComp.portoghese')}</SelectItem>
                      <SelectItem value="ru">{t('translationProfileManagerComp.russo')}</SelectItem>
                      <SelectItem value="ja">{t('translationProfileManagerComp.giapponese')}</SelectItem>
                      <SelectItem value="ko">{t('translationProfileManagerComp.coreano')}</SelectItem>
                      <SelectItem value="zh">{t('translationProfileManagerComp.cinese')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('translationProfileManagerComp.description')}</Label>
                  <Textarea
                    value={newProfile.description}
                    onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })}
                    placeholder={t('translationProfileManager.descPh')}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('translationProfileManagerComp.tagsCommaSeparated')}</Label>
                  <Input
                    value={newProfile.tags}
                    onChange={(e) => setNewProfile({ ...newProfile, tags: e.target.value })}
                    placeholder={t('translationProfileManager.tagsPh')}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  {t('translationProfileManager.cancel')}</Button>
                <Button onClick={handleCreateProfile}>
                  {t('translationProfileManager.createProfile')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Label htmlFor="import-profile" className="cursor-pointer">
            <Button variant="outline" asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                {t('translationProfileManager.importBtn')}</span>
            </Button>
            <Input
              id="import-profile"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportProfile}
            />
          </Label>
        </div>
      </div>

      {/* Lista profili */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('translationProfileManagerComp.profiliDisponibili')}</h3>
          <ScrollArea className="h-[600px]">
            <div className="space-y-3 pr-4">
              {filteredProfiles.map((profile) => (
                <Card 
                  key={profile.id}
                  className={`cursor-pointer transition-colors ${
                    selectedProfile?.id === profile.id 
                      ? 'border-primary' 
                      : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => handleSelectProfile(profile)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {profile.gameName}
                          {profile.metadata.isOfficial && (
                            <Badge variant="secondary" className="text-xs">
                              {t('translationProfileManager.official')}</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {profile.processName} • {profile.language.toUpperCase()}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        {profile.metadata.rating && (
                          <div className="flex items-center">
                            <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                            <span className="text-sm ml-1">{profile.metadata.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {profile.metadata.description || 'No description'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{profile.translations.length}  {t('translationProfileManager.translationsUnit')}</span>
                        <span>{t('translationProfileManager.updatedLabel')} {formatDate(profile.metadata.updatedAt)}</span>
                      </div>
                      {profile.metadata.tags && profile.metadata.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {profile.metadata.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {profile.metadata.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{profile.metadata.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProfile(profile);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloneProfile(profile);
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportProfile(profile);
                        }}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      {!profile.metadata.isOfficial && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProfile(profile.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Dettagli profilo selezionato */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('translationProfileManagerComp.profileDetails')}</h3>
          {selectedProfile ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedProfile.gameName}</CardTitle>
                <CardDescription>
                  {selectedProfile.metadata.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="translations">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="translations">{t('translationProfileManagerComp.translations')}</TabsTrigger>
                    <TabsTrigger value="info">{t('translationProfileManagerComp.information')}</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="translations" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        {selectedProfile.translations.length}  {t('translationProfileManager.translationsUnit')}</p>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (onProfileSelect) {
                            onProfileSelect(selectedProfile);
                          }
                        }}
                      >
                        {t('translationProfileManager.useThisProfile')}</Button>
                    </div>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2 pr-4">
                        {selectedProfile.translations.map((translation) => (
                          <div
                            key={translation.id}
                            className="p-3 rounded-lg bg-muted/50 space-y-1"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium">{translation.original}</p>
                                <p className="text-sm text-muted-foreground">→ {translation.translated}</p>
                              </div>
                              {translation.isVerified && (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              )}
                            </div>
                            {translation.category && (
                              <Badge variant="outline" className="text-xs">
                                {translation.category}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  
                  <TabsContent value="info" className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm">{t('translationProfileManagerComp.process')}</Label>
                        <p className="text-sm text-muted-foreground">{selectedProfile.processName}</p>
                      </div>
                      <div>
                        <Label className="text-sm">{t('translationProfileManagerComp.language')}</Label>
                        <p className="text-sm text-muted-foreground">{selectedProfile.language.toUpperCase()}</p>
                      </div>
                      <div>
                        <Label className="text-sm">{t('translationProfileManagerComp.author')}</Label>
                        <p className="text-sm text-muted-foreground">
                          {selectedProfile.metadata.author || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm">{t('translationProfileManagerComp.created')}</Label>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(selectedProfile.metadata.createdAt)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm">{t('translationProfileManagerComp.lastUpdated')}</Label>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(selectedProfile.metadata.updatedAt)}
                        </p>
                      </div>
                      {selectedProfile.metadata.tags && selectedProfile.metadata.tags.length > 0 && (
                        <div>
                          <Label className="text-sm">{t('translationProfileManagerComp.tags')}</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedProfile.metadata.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-[500px]">
                <p className="text-muted-foreground">
                  {t('translationProfileManager.selectProfilePrompt')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog per modificare profilo */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('translationProfileManagerComp.editProfile')}</DialogTitle>
            <DialogDescription>
              {t('translationProfileManager.editDesc')}</DialogDescription>
          </DialogHeader>
          {editingProfile && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('translationProfileManagerComp.gameName')}</Label>
                  <Input
                    value={editingProfile.gameName}
                    onChange={(e) => setEditingProfile({
                      ...editingProfile,
                      gameName: e.target.value
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('translationProfileManagerComp.process')}</Label>
                  <Input
                    value={editingProfile.processName}
                    onChange={(e) => setEditingProfile({
                      ...editingProfile,
                      processName: e.target.value
                    })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('translationProfileManagerComp.description')}</Label>
                <Textarea
                  value={editingProfile.metadata.description || ''}
                  onChange={(e) => setEditingProfile({
                    ...editingProfile,
                    metadata: {
                      ...editingProfile.metadata,
                      description: e.target.value
                    }
                  })}
                  rows={3}
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>{t('translationProfileManager.translationsHeader')} ({editingProfile.translations.length})</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t('translationProfileManager.originalTextPh')}
                      value={newTranslation.original}
                      onChange={(e) => setNewTranslation({
                        ...newTranslation,
                        original: e.target.value
                      })}
                      className="w-40"
                    />
                    <Input
                      placeholder={t('common.traduzione')}
                      value={newTranslation.translated}
                      onChange={(e) => setNewTranslation({
                        ...newTranslation,
                        translated: e.target.value
                      })}
                      className="w-40"
                    />
                    <Button onClick={handleAddTranslation} size="sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 pr-4">
                    {editingProfile.translations.map((translation) => (
                      <div
                        key={translation.id}
                        className="flex items-center gap-2 p-2 rounded bg-muted/50"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{translation.original}</p>
                          <p className="text-sm text-muted-foreground">→ {translation.translated}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveTranslation(translation.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t('translationProfileManager.cancel')}</Button>
            <Button onClick={handleUpdateProfile}>
              {t('translationProfileManager.saveChanges')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}




