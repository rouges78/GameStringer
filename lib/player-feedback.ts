/**
 * Player Feedback Loop - Sistema raccolta feedback traduzioni dai giocatori
 * Permette di raccogliere, analizzare e applicare feedback sulla qualità delle traduzioni
 */

export interface FeedbackEntry {
  id: string;
  translationId: string;
  originalText: string;
  translatedText: string;
  suggestedText?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  category: FeedbackCategory;
  comment?: string;
  context?: string;
  gameId?: string;
  language: string;
  submittedAt: string;
  status: 'pending' | 'reviewed' | 'applied' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
}

export type FeedbackCategory = 
  | 'accuracy'      // Traduzione non accurata
  | 'naturalness'   // Suona innaturale
  | 'context'       // Manca contesto
  | 'terminology'   // Terminologia errata
  | 'formatting'    // Problemi di formattazione
  | 'typo'          // Errore di battitura
  | 'cultural'      // Adattamento culturale
  | 'other';        // Altro

export interface FeedbackStats {
  total: number;
  pending: number;
  reviewed: number;
  applied: number;
  rejected: number;
  averageRating: number;
  byCategory: Record<FeedbackCategory, number>;
  byGame: Record<string, number>;
  recentTrend: 'improving' | 'stable' | 'declining';
}

export interface FeedbackFilter {
  status?: FeedbackEntry['status'];
  category?: FeedbackCategory;
  rating?: number;
  gameId?: string;
  language?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface FeedbackReport {
  period: string;
  stats: FeedbackStats;
  topIssues: Array<{ category: FeedbackCategory; count: number; examples: string[] }>;
  improvementSuggestions: string[];
  comparisonWithPrevious?: {
    ratingChange: number;
    volumeChange: number;
  };
}

// Categorie con descrizioni localizzate
export const FEEDBACK_CATEGORIES: Record<FeedbackCategory, { icon: string; color: string }> = {
  accuracy: { icon: '🎯', color: 'red' },
  naturalness: { icon: '💬', color: 'amber' },
  context: { icon: '📖', color: 'blue' },
  terminology: { icon: '📚', color: 'purple' },
  formatting: { icon: '✏️', color: 'cyan' },
  typo: { icon: '🔤', color: 'orange' },
  cultural: { icon: '🌍', color: 'green' },
  other: { icon: '💡', color: 'gray' },
};

class PlayerFeedbackService {
  private feedbackEntries: FeedbackEntry[] = [];
  private readonly STORAGE_KEY = 'gamestringer_player_feedback';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.feedbackEntries = JSON.parse(stored);
      }
    }
  }

  private saveToStorage() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.feedbackEntries));
    }
  }

  // Aggiunge nuovo feedback
  submitFeedback(feedback: Omit<FeedbackEntry, 'id' | 'submittedAt' | 'status'>): FeedbackEntry {
    const entry: FeedbackEntry = {
      ...feedback,
      id: crypto.randomUUID(),
      submittedAt: new Date().toISOString(),
      status: 'pending',
    };

    this.feedbackEntries.push(entry);
    this.saveToStorage();
    return entry;
  }

  // Ottieni tutti i feedback con filtri opzionali
  getFeedback(filter?: FeedbackFilter): FeedbackEntry[] {
    let entries = [...this.feedbackEntries];

    if (filter) {
      if (filter.status) {
        entries = entries.filter(e => e.status === filter.status);
      }
      if (filter.category) {
        entries = entries.filter(e => e.category === filter.category);
      }
      if (filter.rating) {
        entries = entries.filter(e => e.rating === filter.rating);
      }
      if (filter.gameId) {
        entries = entries.filter(e => e.gameId === filter.gameId);
      }
      if (filter.language) {
        entries = entries.filter(e => e.language === filter.language);
      }
      if (filter.dateFrom) {
        entries = entries.filter(e => e.submittedAt >= filter.dateFrom!);
      }
      if (filter.dateTo) {
        entries = entries.filter(e => e.submittedAt <= filter.dateTo!);
      }
    }

    return entries.sort((a, b) => 
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }

  // Ottieni un singolo feedback
  getFeedbackById(id: string): FeedbackEntry | undefined {
    return this.feedbackEntries.find(e => e.id === id);
  }

  // Aggiorna stato del feedback
  updateFeedbackStatus(
    id: string, 
    status: FeedbackEntry['status'], 
    reviewedBy?: string
  ): FeedbackEntry | null {
    const index = this.feedbackEntries.findIndex(e => e.id === id);
    if (index === -1) return null;

    this.feedbackEntries[index] = {
      ...this.feedbackEntries[index],
      status,
      reviewedBy,
      reviewedAt: new Date().toISOString(),
    };

    this.saveToStorage();
    return this.feedbackEntries[index];
  }

  // Elimina feedback
  deleteFeedback(id: string): boolean {
    const index = this.feedbackEntries.findIndex(e => e.id === id);
    if (index === -1) return false;

    this.feedbackEntries.splice(index, 1);
    this.saveToStorage();
    return true;
  }

  // Calcola statistiche
  getStats(filter?: FeedbackFilter): FeedbackStats {
    const entries = this.getFeedback(filter);

    const byCategory: Record<FeedbackCategory, number> = {
      accuracy: 0,
      naturalness: 0,
      context: 0,
      terminology: 0,
      formatting: 0,
      typo: 0,
      cultural: 0,
      other: 0,
    };

    const byGame: Record<string, number> = {};

    let totalRating = 0;

    entries.forEach(entry => {
      byCategory[entry.category]++;
      if (entry.gameId) {
        byGame[entry.gameId] = (byGame[entry.gameId] || 0) + 1;
      }
      totalRating += entry.rating;
    });

    // Calcola trend (ultimi 30 giorni vs 30 giorni precedenti)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentEntries = entries.filter(e => new Date(e.submittedAt) >= thirtyDaysAgo);
    const olderEntries = entries.filter(e => 
      new Date(e.submittedAt) >= sixtyDaysAgo && 
      new Date(e.submittedAt) < thirtyDaysAgo
    );

    const recentAvg = recentEntries.length > 0 
      ? recentEntries.reduce((sum, e) => sum + e.rating, 0) / recentEntries.length 
      : 0;
    const olderAvg = olderEntries.length > 0 
      ? olderEntries.reduce((sum, e) => sum + e.rating, 0) / olderEntries.length 
      : 0;

    let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recentAvg > olderAvg + 0.3) recentTrend = 'improving';
    else if (recentAvg < olderAvg - 0.3) recentTrend = 'declining';

    return {
      total: entries.length,
      pending: entries.filter(e => e.status === 'pending').length,
      reviewed: entries.filter(e => e.status === 'reviewed').length,
      applied: entries.filter(e => e.status === 'applied').length,
      rejected: entries.filter(e => e.status === 'rejected').length,
      averageRating: entries.length > 0 ? totalRating / entries.length : 0,
      byCategory,
      byGame,
      recentTrend,
    };
  }

  // Genera report
  generateReport(period: 'week' | 'month' | 'quarter'): FeedbackReport {
    const now = new Date();
    let dateFrom: Date;

    switch (period) {
      case 'week':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
    }

    const stats = this.getStats({ dateFrom: dateFrom.toISOString() });

    // Top issues
    const topIssues = Object.entries(stats.byCategory)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({
        category: category as FeedbackCategory,
        count,
        examples: this.getFeedback({ category: category as FeedbackCategory })
          .slice(0, 3)
          .map(e => e.originalText.substring(0, 50)),
      }));

    // Suggerimenti
    const suggestions: string[] = [];
    if (stats.byCategory.accuracy > stats.total * 0.3) {
      suggestions.push('Considera di rivedere le traduzioni con AI più avanzate per migliorare l\'accuratezza');
    }
    if (stats.byCategory.naturalness > stats.total * 0.2) {
      suggestions.push('Utilizza traduttori madrelingua per rendere le traduzioni più naturali');
    }
    if (stats.byCategory.terminology > stats.total * 0.15) {
      suggestions.push('Crea un glossario condiviso per standardizzare la terminologia');
    }
    if (stats.averageRating < 3) {
      suggestions.push('Il rating medio è basso, considera una revisione generale delle traduzioni');
    }

    return {
      period,
      stats,
      topIssues,
      improvementSuggestions: suggestions,
    };
  }

  // Esporta feedback per analisi esterna
  exportFeedback(format: 'json' | 'csv'): string {
    const entries = this.getFeedback();

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }

    // CSV
    const headers = [
      'ID', 'Original', 'Translated', 'Suggested', 'Rating', 
      'Category', 'Comment', 'Game', 'Language', 'Status', 'Date'
    ];
    
    const rows = entries.map(e => [
      e.id,
      `"${e.originalText.replace(/"/g, '""')}"`,
      `"${e.translatedText.replace(/"/g, '""')}"`,
      e.suggestedText ? `"${e.suggestedText.replace(/"/g, '""')}"` : '',
      e.rating,
      e.category,
      e.comment ? `"${e.comment.replace(/"/g, '""')}"` : '',
      e.gameId || '',
      e.language,
      e.status,
      e.submittedAt,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // Importa feedback da file
  importFeedback(data: string, format: 'json'): number {
    try {
      const entries: FeedbackEntry[] = JSON.parse(data);
      let imported = 0;

      for (const entry of entries) {
        if (entry.originalText && entry.translatedText && entry.rating) {
          this.feedbackEntries.push({
            ...entry,
            id: entry.id || crypto.randomUUID(),
            status: entry.status || 'pending',
            submittedAt: entry.submittedAt || new Date().toISOString(),
          });
          imported++;
        }
      }

      this.saveToStorage();
      return imported;
    } catch (error) {
      console.error('Errore importazione feedback:', error);
      return 0;
    }
  }

  // Applica suggerimento automaticamente
  applySuggestion(feedbackId: string): { success: boolean; message: string } {
    const feedback = this.getFeedbackById(feedbackId);
    if (!feedback) {
      return { success: false, message: 'Feedback non trovato' };
    }
    if (!feedback.suggestedText) {
      return { success: false, message: 'Nessun suggerimento disponibile' };
    }

    // In produzione, questo aggiornerebbe la Translation Memory
    this.updateFeedbackStatus(feedbackId, 'applied');
    
    return { 
      success: true, 
      message: `Suggerimento applicato: "${feedback.suggestedText.substring(0, 30)}..."` 
    };
  }
}

export const playerFeedbackService = new PlayerFeedbackService();
