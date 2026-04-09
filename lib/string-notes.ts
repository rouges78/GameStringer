/**
 * String Notes & Comments System
 * Attach notes, comments, and discussions to translation strings
 */

export interface StringNote {
  id: string;
  stringId: string;
  content: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  type: 'note' | 'comment' | 'question' | 'issue' | 'resolved';
  priority?: 'low' | 'medium' | 'high';
  resolved?: boolean;
  resolvedBy?: string;
  resolvedAt?: number;
  replies?: NoteReply[];
  tags?: string[];
  mentions?: string[];
}

export interface NoteReply {
  id: string;
  content: string;
  author: string;
  createdAt: number;
}

export interface StringHistory {
  stringId: string;
  versions: TranslationVersion[];
}

export interface TranslationVersion {
  id: string;
  target: string;
  author: string;
  timestamp: number;
  reason?: string;
}

export interface NoteFilter {
  type?: StringNote['type'];
  priority?: StringNote['priority'];
  resolved?: boolean;
  author?: string;
  tag?: string;
  search?: string;
}

const NOTES_KEY = 'gamestringer_notes';
const HISTORY_KEY = 'gamestringer_history';

class StringNotesManager {
  private notes: Map<string, StringNote[]> = new Map();
  private history: Map<string, StringHistory> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  // Notes Management

  addNote(
    stringId: string,
    content: string,
    author: string,
    options?: {
      type?: StringNote['type'];
      priority?: StringNote['priority'];
      tags?: string[];
    }
  ): StringNote {
    const note: StringNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      stringId,
      content,
      author,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      type: options?.type || 'note',
      priority: options?.priority,
      tags: options?.tags,
      replies: [],
      mentions: this.extractMentions(content),
    };

    if (!this.notes.has(stringId)) {
      this.notes.set(stringId, []);
    }
    this.notes.get(stringId)!.push(note);

    this.save();
    this.notify();
    return note;
  }

  updateNote(noteId: string, updates: Partial<Pick<StringNote, 'content' | 'type' | 'priority' | 'tags'>>): void {
    for (const [_, notes] of this.notes) {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        Object.assign(note, updates, { 
          updatedAt: Date.now(),
          mentions: updates.content ? this.extractMentions(updates.content) : note.mentions
        });
        this.save();
        this.notify();
        return;
      }
    }
  }

  deleteNote(noteId: string): void {
    for (const [stringId, notes] of this.notes) {
      const index = notes.findIndex(n => n.id === noteId);
      if (index !== -1) {
        notes.splice(index, 1);
        if (notes.length === 0) {
          this.notes.delete(stringId);
        }
        this.save();
        this.notify();
        return;
      }
    }
  }

  resolveNote(noteId: string, resolvedBy: string): void {
    for (const [_, notes] of this.notes) {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        note.resolved = true;
        note.resolvedBy = resolvedBy;
        note.resolvedAt = Date.now();
        note.type = 'resolved';
        this.save();
        this.notify();
        return;
      }
    }
  }

  addReply(noteId: string, content: string, author: string): NoteReply | null {
    for (const [_, notes] of this.notes) {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        const reply: NoteReply = {
          id: `reply_${Date.now()}`,
          content,
          author,
          createdAt: Date.now(),
        };
        if (!note.replies) note.replies = [];
        note.replies.push(reply);
        note.updatedAt = Date.now();
        this.save();
        this.notify();
        return reply;
      }
    }
    return null;
  }

  getNotesForString(stringId: string): StringNote[] {
    return this.notes.get(stringId) || [];
  }

  getAllNotes(filter?: NoteFilter): StringNote[] {
    const allNotes: StringNote[] = [];
    for (const notes of this.notes.values()) {
      allNotes.push(...notes);
    }

    if (!filter) return allNotes.sort((a, b) => b.createdAt - a.createdAt);

    return allNotes
      .filter(note => {
        if (filter.type && note.type !== filter.type) return false;
        if (filter.priority && note.priority !== filter.priority) return false;
        if (filter.resolved !== undefined && note.resolved !== filter.resolved) return false;
        if (filter.author && note.author !== filter.author) return false;
        if (filter.tag && !note.tags?.includes(filter.tag)) return false;
        if (filter.search) {
          const search = filter.search.toLowerCase();
          if (!note.content.toLowerCase().includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getUnresolvedCount(): number {
    return this.getAllNotes({ resolved: false, type: 'issue' }).length;
  }

  // Version History

  recordVersion(stringId: string, target: string, author: string, reason?: string): void {
    if (!this.history.has(stringId)) {
      this.history.set(stringId, { stringId, versions: [] });
    }

    const history = this.history.get(stringId)!;
    
    // Don't record if same as last version
    const lastVersion = history.versions[history.versions.length - 1];
    if (lastVersion && lastVersion.target === target) return;

    history.versions.push({
      id: `ver_${Date.now()}`,
      target,
      author,
      timestamp: Date.now(),
      reason,
    });

    // Keep only last 50 versions per string
    if (history.versions.length > 50) {
      history.versions = history.versions.slice(-50);
    }

    this.save();
  }

  getHistory(stringId: string): TranslationVersion[] {
    return this.history.get(stringId)?.versions || [];
  }

  revertToVersion(stringId: string, versionId: string): string | null {
    const history = this.history.get(stringId);
    if (!history) return null;

    const version = history.versions.find(v => v.id === versionId);
    return version?.target || null;
  }

  compareVersions(stringId: string, versionId1: string, versionId2: string): {
    v1: TranslationVersion | null;
    v2: TranslationVersion | null;
    diff: { added: string[]; removed: string[]; };
  } {
    const history = this.history.get(stringId);
    const v1 = history?.versions.find(v => v.id === versionId1) || null;
    const v2 = history?.versions.find(v => v.id === versionId2) || null;

    const words1 = v1?.target.split(/\s+/) || [];
    const words2 = v2?.target.split(/\s+/) || [];

    return {
      v1,
      v2,
      diff: {
        added: words2.filter(w => !words1.includes(w)),
        removed: words1.filter(w => !words2.includes(w)),
      },
    };
  }

  // Stats

  getStats(): {
    totalNotes: number;
    unresolvedIssues: number;
    stringWithNotes: number;
    notesByType: Record<string, number>;
    notesByAuthor: Record<string, number>;
    totalVersions: number;
  } {
    const allNotes = this.getAllNotes();
    const notesByType: Record<string, number> = {};
    const notesByAuthor: Record<string, number> = {};

    allNotes.forEach(note => {
      notesByType[note.type] = (notesByType[note.type] || 0) + 1;
      notesByAuthor[note.author] = (notesByAuthor[note.author] || 0) + 1;
    });

    let totalVersions = 0;
    for (const history of this.history.values()) {
      totalVersions += history.versions.length;
    }

    return {
      totalNotes: allNotes.length,
      unresolvedIssues: this.getUnresolvedCount(),
      stringWithNotes: this.notes.size,
      notesByType,
      notesByAuthor,
      totalVersions,
    };
  }

  // Helpers

  private extractMentions(content: string): string[] {
    const mentions = content.match(/@(\w+)/g) || [];
    return mentions.map(m => m.slice(1));
  }

  // Persistence

  private load(): void {
    if (typeof window === 'undefined') return;

    try {
      const notesData = localStorage.getItem(NOTES_KEY);
      if (notesData) {
        const parsed = JSON.parse(notesData);
        this.notes = new Map(Object.entries(parsed));
      }

      const historyData = localStorage.getItem(HISTORY_KEY);
      if (historyData) {
        const parsed = JSON.parse(historyData);
        this.history = new Map(Object.entries(parsed));
      }
    } catch (error: unknown) {
      clientLogger.error('[StringNotes] Load failed:', error);
    }
  }

  private save(): void {
    if (typeof window === 'undefined') return;

    try {
      const notesObj = Object.fromEntries(this.notes);
      localStorage.setItem(NOTES_KEY, JSON.stringify(notesObj));

      const historyObj = Object.fromEntries(this.history);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(historyObj));
    } catch (error: unknown) {
      clientLogger.error('[StringNotes] Save failed:', error);
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

  // Export

  exportNotes(): string {
    return JSON.stringify({
      notes: Object.fromEntries(this.notes),
      history: Object.fromEntries(this.history),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  importNotes(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      if (parsed.notes) {
        this.notes = new Map(Object.entries(parsed.notes));
      }
      if (parsed.history) {
        this.history = new Map(Object.entries(parsed.history));
      }
      this.save();
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  clearAll(): void {
    this.notes.clear();
    this.history.clear();
    this.save();
    this.notify();
  }
}

// Singleton
export const stringNotesManager = new StringNotesManager();

// React hooks
import { useState, useEffect, useCallback } from 'react';
import { clientLogger } from '@/lib/client-logger';

export function useStringNotes(stringId?: string) {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    return stringNotesManager.subscribe(() => forceUpdate({}));
  }, []);

  return {
    notes: stringId ? stringNotesManager.getNotesForString(stringId) : [],
    allNotes: stringNotesManager.getAllNotes(),
    history: stringId ? stringNotesManager.getHistory(stringId) : [],
    stats: stringNotesManager.getStats(),
    
    addNote: stringNotesManager.addNote.bind(stringNotesManager),
    updateNote: stringNotesManager.updateNote.bind(stringNotesManager),
    deleteNote: stringNotesManager.deleteNote.bind(stringNotesManager),
    resolveNote: stringNotesManager.resolveNote.bind(stringNotesManager),
    addReply: stringNotesManager.addReply.bind(stringNotesManager),
    
    recordVersion: stringNotesManager.recordVersion.bind(stringNotesManager),
    revertToVersion: stringNotesManager.revertToVersion.bind(stringNotesManager),
    compareVersions: stringNotesManager.compareVersions.bind(stringNotesManager),
  };
}

export default stringNotesManager;
