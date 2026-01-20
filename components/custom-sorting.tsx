'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Save, Trash2, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Game {
  id: string;
  name: string;
  store: string;
  genre?: string;
  engine?: string;
  year?: number;
  rating?: number;
  playtime?: number;
  size?: number;
  lastPlayed?: Date;
  isInstalled?: boolean;
  installDate?: Date;
}

type SortField = 'name' | 'store' | 'genre' | 'engine' | 'year' | 'rating' | 'playtime' | 'size' | 'lastPlayed' | 'installDate';
type SortDirection = 'asc' | 'desc';

interface SortRule {
  field: SortField;
  direction: SortDirection;
  priority: number;
}

interface SortPreset {
  id: string;
  name: string;
  description?: string;
  rules: SortRule[];
  isDefault?: boolean;
}

interface CustomSortingProps {
  games: Game[];
  onSortChange: (sortedGames: Game[]) => void;
  className?: string;
}

const sortFieldLabels: Record<SortField, string> = {
  name: 'Name',
  store: 'Store',
  genre: 'Genre',
  engine: 'Engine',
  year: 'Year',
  rating: 'Rating',
  playtime: 'Playtime',
  size: 'Size',
  lastPlayed: 'Last Played',
  installDate: 'Install Date'
};

const defaultPresets: SortPreset[] = [
  {
    id: 'alphabetical',
    name: 'Alphabetical',
    description: 'Sort by name A-Z',
    rules: [{ field: 'name', direction: 'asc', priority: 1 }],
    isDefault: true
  },
  {
    id: 'by-store',
    name: 'By Store',
    description: 'Group by store, then alphabetical',
    rules: [
      { field: 'store', direction: 'asc', priority: 1 },
      { field: 'name', direction: 'asc', priority: 2 }
    ],
    isDefault: true
  },
  {
    id: 'by-rating',
    name: 'By Rating',
    description: 'Sort by rating descending',
    rules: [
      { field: 'rating', direction: 'desc', priority: 1 },
      { field: 'name', direction: 'asc', priority: 2 }
    ],
    isDefault: true
  },
  {
    id: 'recently-played',
    name: 'Recently Played',
    description: 'Sort by last played',
    rules: [
      { field: 'lastPlayed', direction: 'desc', priority: 1 },
      { field: 'name', direction: 'asc', priority: 2 }
    ],
    isDefault: true
  },
  {
    id: 'by-size',
    name: 'By Size',
    description: 'Sort by size descending',
    rules: [
      { field: 'size', direction: 'desc', priority: 1 },
      { field: 'name', direction: 'asc', priority: 2 }
    ],
    isDefault: true
  }
];

const CustomSorting: React.FC<CustomSortingProps> = ({
  games,
  onSortChange,
  className
}) => {
  const [presets, setPresets] = useState<SortPreset[]>(defaultPresets);
  const [activePreset, setActivePreset] = useState<string>('alphabetical');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [sortRules, setSortRules] = useState<SortRule[]>([
    { field: 'name', direction: 'asc', priority: 1 }
  ]);

  // Load saved presets from localStorage
  useEffect(() => {
    const savedPresets = localStorage.getItem('gamestringer-sort-presets');
    const savedActivePreset = localStorage.getItem('gamestringer-active-preset');
    
    if (savedPresets) {
      try {
        const parsed = JSON.parse(savedPresets);
        setPresets([...defaultPresets, ...parsed]);
      } catch (error) {
        console.error('Error loading presets:', error);
      }
    }
    
    if (savedActivePreset) {
      setActivePreset(savedActivePreset);
    }
  }, []);

  // Save custom presets to localStorage
  const saveCustomPresets = (newPresets: SortPreset[]) => {
    const customPresets = newPresets.filter(p => !p.isDefault);
    localStorage.setItem('gamestringer-sort-presets', JSON.stringify(customPresets));
  };

  // Apply sorting
  const applySorting = (rules: SortRule[]) => {
    const sortedGames = [...games].sort((a, b) => {
      for (const rule of rules.sort((r1, r2) => r1.priority - r2.priority)) {
        const aValue = a[rule.field];
        const bValue = b[rule.field];
        
        // Gestisci valori null/undefined
        if (aValue == null && bValue == null) continue;
        if (aValue == null) return rule.direction === 'asc' ? 1 : -1;
        if (bValue == null) return rule.direction === 'asc' ? -1 : 1;
        
        let comparison = 0;
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        }
        
        if (comparison !== 0) {
          return rule.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
    
    onSortChange(sortedGames);
  };

  // Cambia preset attivo
  const changeActivePreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setActivePreset(presetId);
      localStorage.setItem('gamestringer-active-preset', presetId);
      applySorting(preset.rules);
    }
  };

  // Apply sorting when games or active preset change
  useEffect(() => {
    const preset = presets.find(p => p.id === activePreset);
    if (preset) {
      applySorting(preset.rules);
    }
  }, [games, activePreset, presets]);

  // Add sort rule
  const addSortRule = () => {
    const newRule: SortRule = {
      field: 'name',
      direction: 'asc',
      priority: sortRules.length + 1
    };
    setSortRules([...sortRules, newRule]);
  };

  // Remove sort rule
  const removeSortRule = (index: number) => {
    const newRules = sortRules.filter((_, i) => i !== index);
    // Reorder priorities
    const reorderedRules = newRules.map((rule, i) => ({
      ...rule,
      priority: i + 1
    }));
    setSortRules(reorderedRules);
  };

  // Update sort rule
  const updateSortRule = (index: number, field: SortField, direction: SortDirection) => {
    const newRules = [...sortRules];
    newRules[index] = { ...newRules[index], field, direction };
    setSortRules(newRules);
  };

  // Save new preset
  const saveNewPreset = () => {
    if (!newPresetName.trim()) {
      toast.error('Enter a name for the preset');
      return;
    }

    const newPreset: SortPreset = {
      id: `custom-${Date.now()}`,
      name: newPresetName.trim(),
      description: newPresetDescription.trim() || undefined,
      rules: [...sortRules]
    };

    const newPresets = [...presets, newPreset];
    setPresets(newPresets);
    saveCustomPresets(newPresets);
    
    setActivePreset(newPreset.id);
    localStorage.setItem('gamestringer-active-preset', newPreset.id);
    
    setIsDialogOpen(false);
    setNewPresetName('');
    setNewPresetDescription('');
    setSortRules([{ field: 'name', direction: 'asc', priority: 1 }]);
    
    toast.success('Preset saved successfully!');
  };

  // Delete custom preset
  const deletePreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset?.isDefault) {
      toast.error('Cannot delete default presets');
      return;
    }

    const newPresets = presets.filter(p => p.id !== presetId);
    setPresets(newPresets);
    saveCustomPresets(newPresets);
    
    if (activePreset === presetId) {
      setActivePreset('alphabetical');
      localStorage.setItem('gamestringer-active-preset', 'alphabetical');
    }
    
    toast.success('Preset deleted');
  };

  const activePresetData = presets.find(p => p.id === activePreset);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Selector preset */}
      <Select value={activePreset} onValueChange={changeActivePreset}>
        <SelectTrigger className="w-[200px]">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {presets.map(preset => (
            <SelectItem key={preset.id} value={preset.id}>
              <div className="flex flex-col">
                <span className="font-medium">{preset.name}</span>
                {preset.description && (
                  <span className="text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Indicatore regole attive */}
      {activePresetData && (
        <div className="flex items-center gap-1">
          {activePresetData.rules.map((rule, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {sortFieldLabels[rule.field]}
              {rule.direction === 'asc' ? (
                <ArrowUp className="h-3 w-3 ml-1" />
              ) : (
                <ArrowDown className="h-3 w-3 ml-1" />
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Menu azioni */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Preset
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {presets.filter(p => !p.isDefault).map(preset => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => deletePreset(preset.id)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete "{preset.name}"
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog to create new preset */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Sort Preset</DialogTitle>
            <DialogDescription>
              Configure sorting rules for your custom preset.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Name and description */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preset-name">Preset Name</Label>
                <Input
                  id="preset-name"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="E.g.: My Favorites"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preset-description">Description (optional)</Label>
                <Input
                  id="preset-description"
                  value={newPresetDescription}
                  onChange={(e) => setNewPresetDescription(e.target.value)}
                  placeholder="E.g.: Games sorted by rating and time"
                />
              </div>
            </div>

            {/* Sort rules */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Sort Rules</Label>
                <Button variant="outline" size="sm" onClick={addSortRule}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>
              
              {sortRules.map((rule, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Badge variant="outline">#{rule.priority}</Badge>
                  
                  <Select
                    value={rule.field}
                    onValueChange={(value) => updateSortRule(index, value as SortField, rule.direction)}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(sortFieldLabels).map(([field, label]) => (
                        <SelectItem key={field} value={field}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select
                    value={rule.direction}
                    onValueChange={(value) => updateSortRule(index, rule.field, value as SortDirection)}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">
                        <div className="flex items-center gap-2">
                          <ArrowUp className="h-4 w-4" />
                          Crescente
                        </div>
                      </SelectItem>
                      <SelectItem value="desc">
                        <div className="flex items-center gap-2">
                          <ArrowDown className="h-4 w-4" />
                          Decrescente
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {sortRules.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeSortRule(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveNewPreset}>
              <Save className="h-4 w-4 mr-2" />
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomSorting;
