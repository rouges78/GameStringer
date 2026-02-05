/**
 * Favorites/Pin Manager for Games
 * Manages pinned games, recently played, and custom collections
 */

export interface FavoriteGame {
  gameId: string;
  gameName: string;
  addedAt: number;
  order: number;
  notes?: string;
}

export interface GameCollection {
  id: string;
  name: string;
  icon: string;
  color: string;
  gameIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface RecentGame {
  gameId: string;
  gameName: string;
  lastAccessed: number;
  accessCount: number;
}

const FAVORITES_KEY = 'gamestringer_favorites';
const COLLECTIONS_KEY = 'gamestringer_collections';
const RECENT_KEY = 'gamestringer_recent';

class FavoritesManager {
  private favorites: FavoriteGame[] = [];
  private collections: GameCollection[] = [];
  private recentGames: RecentGame[] = [];
  private listeners: Set<() => void> = new Set();
  private maxRecent = 20;

  constructor() {
    this.load();
  }

  // Favorites Management
  
  addFavorite(gameId: string, gameName: string, notes?: string): void {
    if (this.isFavorite(gameId)) return;

    this.favorites.push({
      gameId,
      gameName,
      addedAt: Date.now(),
      order: this.favorites.length,
      notes,
    });

    this.save();
    this.notify();
  }

  removeFavorite(gameId: string): void {
    this.favorites = this.favorites.filter(f => f.gameId !== gameId);
    this.reorderFavorites();
    this.save();
    this.notify();
  }

  isFavorite(gameId: string): boolean {
    return this.favorites.some(f => f.gameId === gameId);
  }

  toggleFavorite(gameId: string, gameName: string): boolean {
    if (this.isFavorite(gameId)) {
      this.removeFavorite(gameId);
      return false;
    } else {
      this.addFavorite(gameId, gameName);
      return true;
    }
  }

  getFavorites(): FavoriteGame[] {
    return [...this.favorites].sort((a, b) => a.order - b.order);
  }

  updateFavoriteNotes(gameId: string, notes: string): void {
    const fav = this.favorites.find(f => f.gameId === gameId);
    if (fav) {
      fav.notes = notes;
      this.save();
      this.notify();
    }
  }

  reorderFavorites(newOrder?: string[]): void {
    if (newOrder) {
      this.favorites = newOrder
        .map((id, index) => {
          const fav = this.favorites.find(f => f.gameId === id);
          if (fav) {
            fav.order = index;
            return fav;
          }
          return null;
        })
        .filter((f): f is FavoriteGame => f !== null);
    } else {
      this.favorites.forEach((f, i) => f.order = i);
    }
    this.save();
    this.notify();
  }

  // Collections Management

  createCollection(name: string, icon: string = '📁', color: string = '#6366f1'): GameCollection {
    const collection: GameCollection = {
      id: `col_${Date.now()}`,
      name,
      icon,
      color,
      gameIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.collections.push(collection);
    this.save();
    this.notify();
    return collection;
  }

  deleteCollection(collectionId: string): void {
    this.collections = this.collections.filter(c => c.id !== collectionId);
    this.save();
    this.notify();
  }

  updateCollection(collectionId: string, updates: Partial<Pick<GameCollection, 'name' | 'icon' | 'color'>>): void {
    const collection = this.collections.find(c => c.id === collectionId);
    if (collection) {
      Object.assign(collection, updates, { updatedAt: Date.now() });
      this.save();
      this.notify();
    }
  }

  addToCollection(collectionId: string, gameId: string): void {
    const collection = this.collections.find(c => c.id === collectionId);
    if (collection && !collection.gameIds.includes(gameId)) {
      collection.gameIds.push(gameId);
      collection.updatedAt = Date.now();
      this.save();
      this.notify();
    }
  }

  removeFromCollection(collectionId: string, gameId: string): void {
    const collection = this.collections.find(c => c.id === collectionId);
    if (collection) {
      collection.gameIds = collection.gameIds.filter(id => id !== gameId);
      collection.updatedAt = Date.now();
      this.save();
      this.notify();
    }
  }

  getCollections(): GameCollection[] {
    return [...this.collections];
  }

  getCollectionsForGame(gameId: string): GameCollection[] {
    return this.collections.filter(c => c.gameIds.includes(gameId));
  }

  // Recent Games Management

  addRecent(gameId: string, gameName: string): void {
    const existing = this.recentGames.find(r => r.gameId === gameId);
    
    if (existing) {
      existing.lastAccessed = Date.now();
      existing.accessCount++;
    } else {
      this.recentGames.push({
        gameId,
        gameName,
        lastAccessed: Date.now(),
        accessCount: 1,
      });
    }

    // Trim to max
    this.recentGames.sort((a, b) => b.lastAccessed - a.lastAccessed);
    if (this.recentGames.length > this.maxRecent) {
      this.recentGames = this.recentGames.slice(0, this.maxRecent);
    }

    this.save();
    this.notify();
  }

  getRecentGames(limit?: number): RecentGame[] {
    const sorted = [...this.recentGames].sort((a, b) => b.lastAccessed - a.lastAccessed);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  getMostPlayed(limit: number = 10): RecentGame[] {
    return [...this.recentGames]
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  clearRecent(): void {
    this.recentGames = [];
    this.save();
    this.notify();
  }

  // Stats

  getStats(): {
    totalFavorites: number;
    totalCollections: number;
    totalRecentGames: number;
    gamesInCollections: number;
  } {
    const uniqueGamesInCollections = new Set(
      this.collections.flatMap(c => c.gameIds)
    );

    return {
      totalFavorites: this.favorites.length,
      totalCollections: this.collections.length,
      totalRecentGames: this.recentGames.length,
      gamesInCollections: uniqueGamesInCollections.size,
    };
  }

  // Persistence

  private load(): void {
    if (typeof window === 'undefined') return;

    try {
      const favData = localStorage.getItem(FAVORITES_KEY);
      if (favData) this.favorites = JSON.parse(favData);

      const colData = localStorage.getItem(COLLECTIONS_KEY);
      if (colData) this.collections = JSON.parse(colData);

      const recData = localStorage.getItem(RECENT_KEY);
      if (recData) this.recentGames = JSON.parse(recData);
    } catch (error) {
      console.error('[FavoritesManager] Failed to load:', error);
    }
  }

  private save(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(this.favorites));
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(this.collections));
      localStorage.setItem(RECENT_KEY, JSON.stringify(this.recentGames));
    } catch (error) {
      console.error('[FavoritesManager] Failed to save:', error);
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
      favorites: this.favorites,
      collections: this.collections,
      recentGames: this.recentGames,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  importData(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      if (parsed.favorites) this.favorites = parsed.favorites;
      if (parsed.collections) this.collections = parsed.collections;
      if (parsed.recentGames) this.recentGames = parsed.recentGames;
      this.save();
      this.notify();
      return true;
    } catch (error) {
      console.error('[FavoritesManager] Import failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const favoritesManager = new FavoritesManager();

// React hook
import { useState, useEffect, useCallback } from 'react';

export function useFavorites() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    return favoritesManager.subscribe(() => forceUpdate({}));
  }, []);

  return {
    favorites: favoritesManager.getFavorites(),
    collections: favoritesManager.getCollections(),
    recentGames: favoritesManager.getRecentGames(),
    
    // Favorites
    addFavorite: favoritesManager.addFavorite.bind(favoritesManager),
    removeFavorite: favoritesManager.removeFavorite.bind(favoritesManager),
    toggleFavorite: favoritesManager.toggleFavorite.bind(favoritesManager),
    isFavorite: favoritesManager.isFavorite.bind(favoritesManager),
    
    // Collections
    createCollection: favoritesManager.createCollection.bind(favoritesManager),
    deleteCollection: favoritesManager.deleteCollection.bind(favoritesManager),
    addToCollection: favoritesManager.addToCollection.bind(favoritesManager),
    removeFromCollection: favoritesManager.removeFromCollection.bind(favoritesManager),
    
    // Recent
    addRecent: favoritesManager.addRecent.bind(favoritesManager),
    getMostPlayed: favoritesManager.getMostPlayed.bind(favoritesManager),
    
    // Stats
    getStats: favoritesManager.getStats.bind(favoritesManager),
  };
}

export default favoritesManager;
