'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@/lib/tauri-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Layers,
  Plus,
  Copy,
  Trash2,
  Check,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ModProfile {
  id: string;
  name: string;
  description?: string;
  enabled_mods: Record<string, boolean>;
  created_at: string;
  updated_at: string;
  is_default: boolean;
}

interface InstalledMod {
  id: string;
  name: string;
  version?: string;
  author?: string;
  path: string;
  enabled: boolean;
}

interface ModProfileManagerProps {
  gameId: string;
  gameName: string;
}

export function ModProfileManager({ gameId, gameName }: ModProfileManagerProps) {
  const [profiles, setProfiles] = useState<ModProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [mods, setMods] = useState<InstalledMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');
  const [cloneSourceId, setCloneSourceId] = useState('');

  const loadProfiles = async () => {
    setLoading(true);
    try {
      await invoke('init_mod_profiles');
      const result = await invoke('get_mod_profiles', { gameId, gameName });
      setProfiles(result as ModProfile[]);
      
      // Find active profile
      const active = (result as ModProfile[]).find(p => 
        p.is_default || profiles.length === 1
      );
      if (active) {
        setActiveProfileId(active.id);
      }
      
      // Load installed mods
      const modsResult = await invoke('get_installed_mods', { gameId });
      setMods(modsResult as InstalledMod[]);
    } catch (error) {
      console.error('Error loading mod profiles:', error);
      toast.error('Error loading mod profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gameId) {
      loadProfiles();
    }
  }, [gameId, gameName]);

  const createProfile = async () => {
    if (!newProfileName.trim()) {
      toast.error('Profile name required');
      return;
    }

    try {
      const result = await invoke('create_mod_profile', {
        gameId,
        gameName,
        profileName: newProfileName,
        description: newProfileDesc || null
      });
      
      setProfiles(prev => [...prev, result as ModProfile]);
      toast.success('Profile created!');
      setShowCreateDialog(false);
      setNewProfileName('');
      setNewProfileDesc('');
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Error creating profile');
    }
  };

  const cloneProfile = async () => {
    if (!cloneSourceId || !newProfileName.trim()) {
      toast.error('Select a profile and enter a name');
      return;
    }

    try {
      const result = await invoke('clone_mod_profile', {
        gameId,
        sourceProfileId: cloneSourceId,
        newName: newProfileName
      });
      
      setProfiles(prev => [...prev, result as ModProfile]);
      toast.success('Profile cloned!');
      setShowCloneDialog(false);
      setCloneSourceId('');
      setNewProfileName('');
    } catch (error) {
      console.error('Error cloning profile:', error);
      toast.error('Error cloning profile');
    }
  };

  const activateProfile = async (profileId: string) => {
    try {
      await invoke('activate_mod_profile', { gameId, profileId });
      setActiveProfileId(profileId);
      toast.success('Profile activated!');
    } catch (error) {
      console.error('Error activating profile:', error);
      toast.error('Error activating profile');
    }
  };

  const deleteProfile = async (profileId: string) => {
    try {
      await invoke('delete_mod_profile', { gameId, profileId });
      setProfiles(prev => prev.filter(p => p.id !== profileId));
      toast.success('Profile deleted');
    } catch (error) {
      console.error('Error deleting profile:', error);
      toast.error('Error deleting profile');
    }
  };

  const toggleMod = async (modId: string, enabled: boolean) => {
    try {
      await invoke('toggle_mod_in_profile', { gameId, modId, enabled });
      setMods(prev => 
        prev.map(mod => 
          mod.id === modId ? { ...mod, enabled } : mod
        )
      );
    } catch (error) {
      console.error('Error toggling mod:', error);
      toast.error('Error toggling mod state');
    }
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Mod Profiles - {gameName}
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage separate mod configurations for this game
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadProfiles} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          
          {/* Clone Dialog */}
          <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={profiles.length === 0}>
                <Copy className="h-4 w-4 mr-1" />
                Clone
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clone Profile</DialogTitle>
                <DialogDescription>
                  Create a copy of an existing profile
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Profile to clone</Label>
                  <Select value={cloneSourceId} onValueChange={setCloneSourceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>New profile name</Label>
                  <Input
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="Profile name"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCloneDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={cloneProfile}>Clone</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Dialog */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Mod Profile</DialogTitle>
                <DialogDescription>
                  Create a new profile to manage mods
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="E.g.: Vanilla+, Performance, Full Mods"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    value={newProfileDesc}
                    onChange={(e) => setNewProfileDesc(e.target.value)}
                    placeholder="Profile description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createProfile}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Profili */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Layers className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No mod profiles configured</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {profiles.map(profile => (
            <Card 
              key={profile.id} 
              className={`cursor-pointer transition-all ${
                activeProfileId === profile.id 
                  ? 'ring-2 ring-primary' 
                  : 'hover:border-primary/50'
              }`}
              onClick={() => activateProfile(profile.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {profile.name}
                    {profile.is_default && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                  </CardTitle>
                  {activeProfileId === profile.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                {profile.description && (
                  <CardDescription className="text-xs">
                    {profile.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {Object.values(profile.enabled_mods).filter(Boolean).length} active mods
                  </span>
                  {!profile.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProfile(profile.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mods in active profile */}
      {activeProfile && mods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Mods in "{activeProfile.name}"
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mods.map(mod => (
                <div 
                  key={mod.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{mod.name}</p>
                      {mod.version && (
                        <p className="text-xs text-muted-foreground">v{mod.version}</p>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={activeProfile.enabled_mods[mod.id] ?? mod.enabled}
                    onCheckedChange={(checked) => toggleMod(mod.id, checked)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ModProfileManager;
