/**
 * String Tags & Labels System
 * Organize and categorize translation strings with custom tags
 */

export interface StringTag {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  createdAt: number;
  usageCount: number;
}

export interface TaggedString {
  stringId: string;
  tags: string[]; // tag IDs
}

export interface TagPreset {
  id: string;
  name: string;
  tags: string[];
}

// Default tags for gaming translations
const DEFAULT_TAGS: Omit<StringTag, 'id' | 'createdAt' | 'usageCount'>[] = [
  { name: 'UI', color: '#3B82F6', icon: '🖥️', description: 'Interfaccia utente' },
  { name: 'Dialogo', color: '#8B5CF6', icon: '💬', description: 'Dialoghi dei personaggi' },
  { name: 'Tutorial', color: '#10B981', icon: '📖', description: 'Testi tutorial' },
  { name: 'Menu', color: '#F59E0B', icon: '📋', description: 'Voci di menu' },
  { name: 'Item', color: '#EF4444', icon: '🎒', description: 'Nomi e descrizioni oggetti' },
  { name: 'Quest', color: '#EC4899', icon: '⚔️', description: 'Missioni e obiettivi' },
  { name: 'Lore', color: '#6366F1', icon: '📜', description: 'Storia e background' },
  { name: 'Sistema', color: '#6B7280', icon: '⚙️', description: 'Messaggi di sistema' },
  { name: 'Errore', color: '#DC2626', icon: '⚠️', description: 'Messaggi di errore' },
  { name: 'Placeholder', color: '#9CA3AF', icon: '🔄', description: 'Testo provvisorio' },
  { name: 'Priorità', color: '#F97316', icon: '🔥', description: 'Da tradurre subito' },
  { name: 'Revisionare', color: '#FBBF24', icon: '👀', description: 'Necessita revisione' },
];

const TAGS_KEY = 'gamestringer_tags';
const TAGGED_STRINGS_KEY = 'gamestringer_tagged_strings';
const PRESETS_KEY = 'gamestringer_tag_presets';

class StringTagsManager {
  private tags: Map<string, StringTag> = new Map();
  private taggedStrings: Map<string, string[]> = new Map();
  private presets: TagPreset[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
    this.initDefaultTags();
  }

  private initDefaultTags(): void {
    if (this.tags.size === 0) {
      DEFAULT_TAGS.forEach((tag, index) => {
        const id = `tag_default_${index}`;
        this.tags.set(id, {
          ...tag,
          id,
          createdAt: Date.now(),
          usageCount: 0,
        });
      });
      this.save();
    }
  }

  // Tag Management

  createTag(
    name: string,
    color: string,
    options?: { icon?: string; description?: string }
  ): StringTag {
    const id = `tag_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const tag: StringTag = {
      id,
      name,
      color,
      icon: options?.icon,
      description: options?.description,
      createdAt: Date.now(),
      usageCount: 0,
    };

    this.tags.set(id, tag);
    this.save();
    this.notify();
    return tag;
  }

  updateTag(tagId: string, updates: Partial<Pick<StringTag, 'name' | 'color' | 'icon' | 'description'>>): void {
    const tag = this.tags.get(tagId);
    if (tag) {
      Object.assign(tag, updates);
      this.save();
      this.notify();
    }
  }

  deleteTag(tagId: string): void {
    this.tags.delete(tagId);
    
    // Remove tag from all strings
    for (const [stringId, tags] of this.taggedStrings) {
      const filtered = tags.filter(t => t !== tagId);
      if (filtered.length === 0) {
        this.taggedStrings.delete(stringId);
      } else {
        this.taggedStrings.set(stringId, filtered);
      }
    }

    this.save();
    this.notify();
  }

  getTag(tagId: string): StringTag | undefined {
    return this.tags.get(tagId);
  }

  getAllTags(): StringTag[] {
    return Array.from(this.tags.values())
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  getPopularTags(limit: number = 10): StringTag[] {
    return this.getAllTags().slice(0, limit);
  }

  searchTags(query: string): StringTag[] {
    const lower = query.toLowerCase();
    return this.getAllTags().filter(tag =>
      tag.name.toLowerCase().includes(lower) ||
      tag.description?.toLowerCase().includes(lower)
    );
  }

  // String Tagging

  addTagToString(stringId: string, tagId: string): void {
    if (!this.tags.has(tagId)) return;

    const currentTags = this.taggedStrings.get(stringId) || [];
    if (!currentTags.includes(tagId)) {
      currentTags.push(tagId);
      this.taggedStrings.set(stringId, currentTags);
      
      // Update usage count
      const tag = this.tags.get(tagId)!;
      tag.usageCount++;
      
      this.save();
      this.notify();
    }
  }

  removeTagFromString(stringId: string, tagId: string): void {
    const currentTags = this.taggedStrings.get(stringId);
    if (!currentTags) return;

    const filtered = currentTags.filter(t => t !== tagId);
    if (filtered.length === 0) {
      this.taggedStrings.delete(stringId);
    } else {
      this.taggedStrings.set(stringId, filtered);
    }

    // Update usage count
    const tag = this.tags.get(tagId);
    if (tag && tag.usageCount > 0) {
      tag.usageCount--;
    }

    this.save();
    this.notify();
  }

  toggleTag(stringId: string, tagId: string): boolean {
    const currentTags = this.taggedStrings.get(stringId) || [];
    if (currentTags.includes(tagId)) {
      this.removeTagFromString(stringId, tagId);
      return false;
    } else {
      this.addTagToString(stringId, tagId);
      return true;
    }
  }

  getTagsForString(stringId: string): StringTag[] {
    const tagIds = this.taggedStrings.get(stringId) || [];
    return tagIds
      .map(id => this.tags.get(id))
      .filter((t): t is StringTag => t !== undefined);
  }

  getStringsWithTag(tagId: string): string[] {
    const strings: string[] = [];
    for (const [stringId, tags] of this.taggedStrings) {
      if (tags.includes(tagId)) {
        strings.push(stringId);
      }
    }
    return strings;
  }

  getStringsWithAnyTags(tagIds: string[]): string[] {
    const strings: string[] = [];
    for (const [stringId, tags] of this.taggedStrings) {
      if (tagIds.some(id => tags.includes(id))) {
        strings.push(stringId);
      }
    }
    return strings;
  }

  getStringsWithAllTags(tagIds: string[]): string[] {
    const strings: string[] = [];
    for (const [stringId, tags] of this.taggedStrings) {
      if (tagIds.every(id => tags.includes(id))) {
        strings.push(stringId);
      }
    }
    return strings;
  }

  // Bulk Operations

  bulkAddTag(stringIds: string[], tagId: string): number {
    let count = 0;
    for (const stringId of stringIds) {
      const currentTags = this.taggedStrings.get(stringId) || [];
      if (!currentTags.includes(tagId)) {
        currentTags.push(tagId);
        this.taggedStrings.set(stringId, currentTags);
        count++;
      }
    }

    if (count > 0) {
      const tag = this.tags.get(tagId);
      if (tag) tag.usageCount += count;
      this.save();
      this.notify();
    }

    return count;
  }

  bulkRemoveTag(stringIds: string[], tagId: string): number {
    let count = 0;
    for (const stringId of stringIds) {
      const currentTags = this.taggedStrings.get(stringId);
      if (currentTags?.includes(tagId)) {
        const filtered = currentTags.filter(t => t !== tagId);
        if (filtered.length === 0) {
          this.taggedStrings.delete(stringId);
        } else {
          this.taggedStrings.set(stringId, filtered);
        }
        count++;
      }
    }

    if (count > 0) {
      const tag = this.tags.get(tagId);
      if (tag) tag.usageCount = Math.max(0, tag.usageCount - count);
      this.save();
      this.notify();
    }

    return count;
  }

  clearTagsFromString(stringId: string): void {
    const tags = this.taggedStrings.get(stringId);
    if (tags) {
      tags.forEach(tagId => {
        const tag = this.tags.get(tagId);
        if (tag && tag.usageCount > 0) tag.usageCount--;
      });
      this.taggedStrings.delete(stringId);
      this.save();
      this.notify();
    }
  }

  // Presets

  createPreset(name: string, tagIds: string[]): TagPreset {
    const preset: TagPreset = {
      id: `preset_${Date.now()}`,
      name,
      tags: tagIds,
    };
    this.presets.push(preset);
    this.save();
    this.notify();
    return preset;
  }

  deletePreset(presetId: string): void {
    this.presets = this.presets.filter(p => p.id !== presetId);
    this.save();
    this.notify();
  }

  applyPreset(stringId: string, presetId: string): void {
    const preset = this.presets.find(p => p.id === presetId);
    if (preset) {
      preset.tags.forEach(tagId => this.addTagToString(stringId, tagId));
    }
  }

  getPresets(): TagPreset[] {
    return [...this.presets];
  }

  // Stats

  getStats(): {
    totalTags: number;
    taggedStrings: number;
    mostUsedTag: StringTag | null;
    untaggedCount: number;
  } {
    const allTags = this.getAllTags();
    
    return {
      totalTags: allTags.length,
      taggedStrings: this.taggedStrings.size,
      mostUsedTag: allTags.length > 0 ? allTags[0] : null,
      untaggedCount: 0, // Would need total strings count to calculate
    };
  }

  // Persistence

  private load(): void {
    if (typeof window === 'undefined') return;

    try {
      const tagsData = localStorage.getItem(TAGS_KEY);
      if (tagsData) {
        const parsed = JSON.parse(tagsData);
        this.tags = new Map(parsed.map((t: StringTag) => [t.id, t]));
      }

      const stringsData = localStorage.getItem(TAGGED_STRINGS_KEY);
      if (stringsData) {
        this.taggedStrings = new Map(Object.entries(JSON.parse(stringsData)));
      }

      const presetsData = localStorage.getItem(PRESETS_KEY);
      if (presetsData) {
        this.presets = JSON.parse(presetsData);
      }
    } catch (error: unknown) {
      clientLogger.error('[StringTags] Load failed:', error);
    }
  }

  private save(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(TAGS_KEY, JSON.stringify(Array.from(this.tags.values())));
      localStorage.setItem(TAGGED_STRINGS_KEY, JSON.stringify(Object.fromEntries(this.taggedStrings)));
      localStorage.setItem(PRESETS_KEY, JSON.stringify(this.presets));
    } catch (error: unknown) {
      clientLogger.error('[StringTags] Save failed:', error);
    }
  }

  // Subscriptions

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  // Export/Import

  exportData(): string {
    return JSON.stringify({
      tags: Array.from(this.tags.values()),
      taggedStrings: Object.fromEntries(this.taggedStrings),
      presets: this.presets,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  importData(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      if (parsed.tags) {
        this.tags = new Map(parsed.tags.map((t: StringTag) => [t.id, t]));
      }
      if (parsed.taggedStrings) {
        this.taggedStrings = new Map(Object.entries(parsed.taggedStrings));
      }
      if (parsed.presets) {
        this.presets = parsed.presets;
      }
      this.save();
      this.notify();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton
export const stringTagsManager = new StringTagsManager();

// React hook
import { useState, useEffect, useCallback } from 'react';
import { clientLogger } from '@/lib/client-logger';

export function useStringTags(stringId?: string) {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    return stringTagsManager.subscribe(() => forceUpdate({}));
  }, []);

  return {
    // All tags
    tags: stringTagsManager.getAllTags(),
    popularTags: stringTagsManager.getPopularTags(),
    presets: stringTagsManager.getPresets(),
    
    // String-specific
    stringTags: stringId ? stringTagsManager.getTagsForString(stringId) : [],
    
    // Tag management
    createTag: stringTagsManager.createTag.bind(stringTagsManager),
    updateTag: stringTagsManager.updateTag.bind(stringTagsManager),
    deleteTag: stringTagsManager.deleteTag.bind(stringTagsManager),
    searchTags: stringTagsManager.searchTags.bind(stringTagsManager),
    
    // String tagging
    addTag: stringTagsManager.addTagToString.bind(stringTagsManager),
    removeTag: stringTagsManager.removeTagFromString.bind(stringTagsManager),
    toggleTag: stringTagsManager.toggleTag.bind(stringTagsManager),
    clearTags: stringTagsManager.clearTagsFromString.bind(stringTagsManager),
    
    // Bulk
    bulkAddTag: stringTagsManager.bulkAddTag.bind(stringTagsManager),
    bulkRemoveTag: stringTagsManager.bulkRemoveTag.bind(stringTagsManager),
    
    // Filter
    getStringsWithTag: stringTagsManager.getStringsWithTag.bind(stringTagsManager),
    getStringsWithAnyTags: stringTagsManager.getStringsWithAnyTags.bind(stringTagsManager),
    getStringsWithAllTags: stringTagsManager.getStringsWithAllTags.bind(stringTagsManager),
    
    // Presets
    createPreset: stringTagsManager.createPreset.bind(stringTagsManager),
    applyPreset: stringTagsManager.applyPreset.bind(stringTagsManager),
    
    // Stats
    stats: stringTagsManager.getStats(),
  };
}

export default stringTagsManager;
