/**
 * Translation Analytics System
 * Detailed statistics, trends, and insights for translation projects
 */

export interface TranslationStats {
  totalStrings: number;
  translatedStrings: number;
  reviewedStrings: number;
  approvedStrings: number;
  pendingStrings: number;
  
  totalWords: number;
  translatedWords: number;
  
  totalCharacters: number;
  translatedCharacters: number;
  
  progress: number;
  qualityScore: number;
  
  averageStringLength: number;
  longestString: number;
  shortestString: number;
}

export interface DailyActivity {
  date: string;
  stringsTranslated: number;
  stringsReviewed: number;
  wordsTranslated: number;
  timeSpent: number; // minutes
}

export interface LanguageStats {
  language: string;
  languageCode: string;
  progress: number;
  totalStrings: number;
  translatedStrings: number;
  lastActivity: number;
}

export interface TranslatorStats {
  name: string;
  stringsTranslated: number;
  wordsTranslated: number;
  qualityScore: number;
  averageSpeed: number; // words per hour
}

export interface QualityMetrics {
  consistencyScore: number;
  glossaryAdherence: number;
  lengthVariance: number;
  formattingAccuracy: number;
  placeholderIntegrity: number;
}

export interface ProjectInsights {
  estimatedCompletion: Date | null;
  bottlenecks: string[];
  suggestions: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

const ANALYTICS_KEY = 'gamestringer_analytics';

class TranslationAnalytics {
  private dailyActivity: DailyActivity[] = [];
  private sessionStartTime: number = 0;
  private sessionStrings: number = 0;
  private sessionWords: number = 0;

  constructor() {
    this.load();
    this.startSession();
  }

  // Session tracking
  startSession(): void {
    this.sessionStartTime = Date.now();
    this.sessionStrings = 0;
    this.sessionWords = 0;
  }

  endSession(): void {
    if (this.sessionStartTime === 0) return;
    
    const duration = Math.round((Date.now() - this.sessionStartTime) / 60000);
    const today = new Date().toISOString().split('T')[0];
    
    const existing = this.dailyActivity.find(a => a.date === today);
    if (existing) {
      existing.stringsTranslated += this.sessionStrings;
      existing.wordsTranslated += this.sessionWords;
      existing.timeSpent += duration;
    } else {
      this.dailyActivity.push({
        date: today,
        stringsTranslated: this.sessionStrings,
        stringsReviewed: 0,
        wordsTranslated: this.sessionWords,
        timeSpent: duration,
      });
    }

    this.save();
    this.sessionStartTime = 0;
  }

  // Track translation event
  trackTranslation(sourceText: string, targetText: string): void {
    this.sessionStrings++;
    this.sessionWords += targetText.split(/\s+/).length;
  }

  trackReview(): void {
    const today = new Date().toISOString().split('T')[0];
    const existing = this.dailyActivity.find(a => a.date === today);
    if (existing) {
      existing.stringsReviewed++;
    }
  }

  // Calculate project statistics
  calculateStats(strings: Array<{ source: string; target: string; status: string }>): TranslationStats {
    const totalStrings = strings.length;
    const translatedStrings = strings.filter(s => s.target && s.target.length > 0).length;
    const reviewedStrings = strings.filter(s => s.status === 'reviewed').length;
    const approvedStrings = strings.filter(s => s.status === 'approved').length;
    const pendingStrings = totalStrings - translatedStrings;

    const totalWords = strings.reduce((sum, s) => sum + s.source.split(/\s+/).length, 0);
    const translatedWords = strings
      .filter(s => s.target)
      .reduce((sum, s) => sum + s.target.split(/\s+/).length, 0);

    const totalCharacters = strings.reduce((sum, s) => sum + s.source.length, 0);
    const translatedCharacters = strings
      .filter(s => s.target)
      .reduce((sum, s) => sum + s.target.length, 0);

    const lengths = strings.map(s => s.source.length);
    const averageStringLength = lengths.length > 0 
      ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
      : 0;

    return {
      totalStrings,
      translatedStrings,
      reviewedStrings,
      approvedStrings,
      pendingStrings,
      totalWords,
      translatedWords,
      totalCharacters,
      translatedCharacters,
      progress: totalStrings > 0 ? Math.round((translatedStrings / totalStrings) * 100) : 0,
      qualityScore: this.calculateQualityScore(strings),
      averageStringLength,
      longestString: Math.max(...lengths, 0),
      shortestString: Math.min(...lengths.filter(l => l > 0), 0),
    };
  }

  // Calculate quality score
  private calculateQualityScore(strings: Array<{ source: string; target: string; status: string }>): number {
    const translated = strings.filter(s => s.target);
    if (translated.length === 0) return 0;

    let score = 100;
    
    // Check for empty translations
    const emptyTargets = translated.filter(s => s.target.trim() === '').length;
    score -= (emptyTargets / translated.length) * 30;

    // Check for untranslated (same as source)
    const untranslated = translated.filter(s => s.source === s.target).length;
    score -= (untranslated / translated.length) * 20;

    // Check for missing placeholders
    const missingPlaceholders = translated.filter(s => {
      const sourcePlaceholders = (s.source.match(/\{[^}]+\}/g) || []).length;
      const targetPlaceholders = (s.target.match(/\{[^}]+\}/g) || []).length;
      return sourcePlaceholders !== targetPlaceholders;
    }).length;
    score -= (missingPlaceholders / translated.length) * 25;

    // Bonus for reviewed/approved
    const reviewedRatio = strings.filter(s => s.status === 'reviewed' || s.status === 'approved').length / strings.length;
    score += reviewedRatio * 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // Get quality metrics
  getQualityMetrics(strings: Array<{ source: string; target: string }>): QualityMetrics {
    const translated = strings.filter(s => s.target);
    
    // Consistency: check if same source has same translation
    const sourceMap = new Map<string, Set<string>>();
    translated.forEach(s => {
      if (!sourceMap.has(s.source)) sourceMap.set(s.source, new Set());
      sourceMap.get(s.source)!.add(s.target);
    });
    const inconsistent = Array.from(sourceMap.values()).filter(v => v.size > 1).length;
    const consistencyScore = sourceMap.size > 0 
      ? Math.round(((sourceMap.size - inconsistent) / sourceMap.size) * 100)
      : 100;

    // Length variance
    const lengthRatios = translated.map(s => s.target.length / Math.max(s.source.length, 1));
    const avgRatio = lengthRatios.reduce((a, b) => a + b, 0) / lengthRatios.length;
    const variance = lengthRatios.reduce((sum, r) => sum + Math.pow(r - avgRatio, 2), 0) / lengthRatios.length;
    const lengthVariance = Math.max(0, 100 - Math.round(variance * 100));

    // Placeholder integrity
    const placeholderCorrect = translated.filter(s => {
      const sourcePh = (s.source.match(/\{[^}]+\}|%[sd@]|\$\d/g) || []).sort().join('');
      const targetPh = (s.target.match(/\{[^}]+\}|%[sd@]|\$\d/g) || []).sort().join('');
      return sourcePh === targetPh;
    }).length;
    const placeholderIntegrity = translated.length > 0 
      ? Math.round((placeholderCorrect / translated.length) * 100)
      : 100;

    // Formatting accuracy (preserve leading/trailing spaces, newlines)
    const formattingCorrect = translated.filter(s => {
      const sourceHasLeading = s.source.match(/^\s/);
      const targetHasLeading = s.target.match(/^\s/);
      const sourceHasTrailing = s.source.match(/\s$/);
      const targetHasTrailing = s.target.match(/\s$/);
      return (!!sourceHasLeading === !!targetHasLeading) && (!!sourceHasTrailing === !!targetHasTrailing);
    }).length;
    const formattingAccuracy = translated.length > 0 
      ? Math.round((formattingCorrect / translated.length) * 100)
      : 100;

    return {
      consistencyScore,
      glossaryAdherence: 85, // Would need glossary to calculate
      lengthVariance,
      formattingAccuracy,
      placeholderIntegrity,
    };
  }

  // Get daily activity for charts
  getDailyActivity(days: number = 30): DailyActivity[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    
    return this.dailyActivity
      .filter(a => a.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Get productivity insights
  getProductivityInsights(): {
    averageStringsPerDay: number;
    averageWordsPerDay: number;
    mostProductiveDay: string | null;
    totalTimeSpent: number;
    streakDays: number;
  } {
    const last30Days = this.getDailyActivity(30);
    
    if (last30Days.length === 0) {
      return {
        averageStringsPerDay: 0,
        averageWordsPerDay: 0,
        mostProductiveDay: null,
        totalTimeSpent: 0,
        streakDays: 0,
      };
    }

    const totalStrings = last30Days.reduce((sum, d) => sum + d.stringsTranslated, 0);
    const totalWords = last30Days.reduce((sum, d) => sum + d.wordsTranslated, 0);
    const totalTime = last30Days.reduce((sum, d) => sum + d.timeSpent, 0);

    const mostProductive = last30Days.reduce((max, d) => 
      d.stringsTranslated > max.stringsTranslated ? d : max
    );

    // Calculate streak
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const sortedDates = last30Days.map(d => d.date).sort().reverse();
    
    for (let i = 0; i < sortedDates.length; i++) {
      const expected = new Date();
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().split('T')[0];
      
      if (sortedDates.includes(expectedStr)) {
        streak++;
      } else {
        break;
      }
    }

    return {
      averageStringsPerDay: Math.round(totalStrings / last30Days.length),
      averageWordsPerDay: Math.round(totalWords / last30Days.length),
      mostProductiveDay: mostProductive.date,
      totalTimeSpent: totalTime,
      streakDays: streak,
    };
  }

  // Estimate completion
  estimateCompletion(totalStrings: number, translatedStrings: number): Date | null {
    const insights = this.getProductivityInsights();
    if (insights.averageStringsPerDay === 0) return null;

    const remaining = totalStrings - translatedStrings;
    const daysNeeded = Math.ceil(remaining / insights.averageStringsPerDay);
    
    const completion = new Date();
    completion.setDate(completion.getDate() + daysNeeded);
    return completion;
  }

  // Get project insights
  getProjectInsights(stats: TranslationStats): ProjectInsights {
    const insights: ProjectInsights = {
      estimatedCompletion: this.estimateCompletion(stats.totalStrings, stats.translatedStrings),
      bottlenecks: [],
      suggestions: [],
      riskLevel: 'low',
    };

    // Identify bottlenecks
    if (stats.progress < 50 && stats.totalStrings > 1000) {
      insights.bottlenecks.push('Progresso lento su progetto grande');
    }
    if (stats.reviewedStrings < stats.translatedStrings * 0.3) {
      insights.bottlenecks.push('Molte traduzioni non revisionate');
    }
    if (stats.qualityScore < 70) {
      insights.bottlenecks.push('Punteggio qualità sotto la media');
    }

    // Generate suggestions
    if (stats.pendingStrings > 100) {
      insights.suggestions.push('Considera la traduzione batch con AI');
    }
    if (stats.qualityScore < 80) {
      insights.suggestions.push('Rivedi le traduzioni per migliorare la qualità');
    }
    if (stats.averageStringLength > 100) {
      insights.suggestions.push('Stringhe lunghe - considera di dividerle');
    }

    // Calculate risk level
    if (insights.bottlenecks.length >= 2 || stats.qualityScore < 60) {
      insights.riskLevel = 'high';
    } else if (insights.bottlenecks.length === 1 || stats.qualityScore < 75) {
      insights.riskLevel = 'medium';
    }

    return insights;
  }

  // Persistence
  private load(): void {
    if (typeof window === 'undefined') return;
    try {
      const data = localStorage.getItem(ANALYTICS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.dailyActivity = parsed.dailyActivity || [];
      }
    } catch (error) {
      console.error('[Analytics] Load failed:', error);
    }
  }

  private save(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify({
        dailyActivity: this.dailyActivity.slice(-90), // Keep 90 days
      }));
    } catch (error) {
      console.error('[Analytics] Save failed:', error);
    }
  }

  // Export data
  exportData(): string {
    return JSON.stringify({
      dailyActivity: this.dailyActivity,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }
}

// Singleton
export const translationAnalytics = new TranslationAnalytics();

// React hook
import { useState, useEffect, useCallback } from 'react';

export function useTranslationAnalytics() {
  const [, forceUpdate] = useState({});

  const refresh = useCallback(() => forceUpdate({}), []);

  useEffect(() => {
    // End session on unmount
    return () => translationAnalytics.endSession();
  }, []);

  return {
    trackTranslation: translationAnalytics.trackTranslation.bind(translationAnalytics),
    trackReview: translationAnalytics.trackReview.bind(translationAnalytics),
    calculateStats: translationAnalytics.calculateStats.bind(translationAnalytics),
    getQualityMetrics: translationAnalytics.getQualityMetrics.bind(translationAnalytics),
    getDailyActivity: translationAnalytics.getDailyActivity.bind(translationAnalytics),
    getProductivityInsights: translationAnalytics.getProductivityInsights.bind(translationAnalytics),
    getProjectInsights: translationAnalytics.getProjectInsights.bind(translationAnalytics),
    estimateCompletion: translationAnalytics.estimateCompletion.bind(translationAnalytics),
    refresh,
  };
}

export default translationAnalytics;
