'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@/lib/tauri-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Puzzle, 
  Download, 
  Trash2, 
  RefreshCw, 
  Plus,
  Package,
  Code,
  Gamepad2,
  Languages,
  Palette,
  Wrench
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

interface Extension {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  extension_type: string;
  enabled: boolean;
  path: string;
}

const getExtensionIcon = (type: string) => {
  switch (type) {
    case 'GameStore': return Package;
    case 'GameSupport': return Gamepad2;
    case 'TranslationTool': return Languages;
    case 'Theme': return Palette;
    case 'Utility': return Wrench;
    default: return Code;
  }
};

const getExtensionTypeBadge = (type: string) => {
  const colors: Record<string, string> = {
    'GameStore': 'bg-blue-500',
    'GameSupport': 'bg-green-500',
    'TranslationTool': 'bg-purple-500',
    'Theme': 'bg-pink-500',
    'Utility': 'bg-orange-500',
  };
  return colors[type] || 'bg-gray-500';
};

export function ExtensionManager() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newExtension, setNewExtension] = useState({
    name: '',
    description: '',
    author: '',
    type: 'Utility'
  });

  const loadExtensions = async () => {
    setLoading(true);
    try {
      // Initialize system if needed
      await invoke('init_extension_system');
      
      const result = await invoke('get_installed_extensions');
      setExtensions(result as Extension[]);
    } catch (error) {
      console.error('Error loading extensions:', error);
      toast.error('Error loading extensions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExtensions();
  }, []);

  const toggleExtension = async (extensionId: string, enabled: boolean) => {
    try {
      await invoke('toggle_extension', { extensionId, enabled });
      setExtensions(prev => 
        prev.map(ext => 
          ext.id === extensionId ? { ...ext, enabled } : ext
        )
      );
      toast.success(enabled ? 'Extension enabled' : 'Extension disabled');
    } catch (error) {
      console.error('Error toggling extension:', error);
      toast.error('Error toggling extension state');
    }
  };

  const uninstallExtension = async (extensionId: string) => {
    try {
      await invoke('uninstall_extension', { extensionId });
      setExtensions(prev => prev.filter(ext => ext.id !== extensionId));
      toast.success('Extension uninstalled');
    } catch (error) {
      console.error('Error uninstalling:', error);
      toast.error('Error during uninstallation');
    }
  };

  const createExtension = async () => {
    if (!newExtension.name.trim()) {
      toast.error('Extension name required');
      return;
    }

    try {
      await invoke('create_extension_template', {
        name: newExtension.name,
        description: newExtension.description || 'New GameStringer extension',
        author: newExtension.author || 'Unknown',
        extensionType: newExtension.type
      });
      
      toast.success('Extension template created! Check the extensions folder.');
      setShowCreateDialog(false);
      setNewExtension({ name: '', description: '', author: '', type: 'Utility' });
      
      // Reload extensions
      await loadExtensions();
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Error creating template');
    }
  };

  return (
    <div className="space-y-6">
      {/* Compact header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Puzzle className="h-5 w-5 text-purple-400" />
          <h2 className="text-lg font-bold">Extensions</h2>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-400 border-purple-500/30">
            {extensions.length} installed
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadExtensions} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-3 w-3 mr-1" />
                Create
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Extension</DialogTitle>
                <DialogDescription>
                  Create a template for a new GameStringer extension
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ext-name">Name</Label>
                  <Input
                    id="ext-name"
                    value={newExtension.name}
                    onChange={(e) => setNewExtension(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My extension"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ext-desc">Description</Label>
                  <Input
                    id="ext-desc"
                    value={newExtension.description}
                    onChange={(e) => setNewExtension(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Extension description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ext-author">Author</Label>
                  <Input
                    id="ext-author"
                    value={newExtension.author}
                    onChange={(e) => setNewExtension(prev => ({ ...prev, author: e.target.value }))}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ext-type">Type</Label>
                  <Select
                    value={newExtension.type}
                    onValueChange={(value) => setNewExtension(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GameStore">Game Store</SelectItem>
                      <SelectItem value="GameSupport">Game Support</SelectItem>
                      <SelectItem value="TranslationTool">Translation Tool</SelectItem>
                      <SelectItem value="Theme">Theme</SelectItem>
                      <SelectItem value="Utility">Utility</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createExtension}>
                  Create Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Extensions list - compact style like Parser */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : extensions.length === 0 ? (
        <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Puzzle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No extensions installed</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Create or install extensions to expand GameStringer functionality
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {extensions.map(ext => {
            const Icon = getExtensionIcon(ext.extension_type);
            return (
              <div 
                key={ext.id} 
                className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                  ext.enabled 
                    ? 'bg-slate-800/30 border-purple-500/30' 
                    : 'bg-slate-900/30 border-slate-800/50 opacity-50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`w-1.5 h-8 rounded-full ${ext.enabled ? 'bg-purple-500' : 'bg-slate-600'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium truncate">{ext.name}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">v{ext.version}</Badge>
                      <Badge className={`text-[9px] px-1 py-0 shrink-0 ${getExtensionTypeBadge(ext.extension_type)}`}>
                        {ext.extension_type}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{ext.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => uninstallExtension(ext.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  <Switch
                    checked={ext.enabled}
                    onCheckedChange={(checked) => toggleExtension(ext.id, checked)}
                    className="shrink-0"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ExtensionManager;



